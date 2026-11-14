"""TP 4 : l'agent d'atelier avec l'Agent SDK (solution).

Ce fichier décrit l'agent : ses outils, son prompt système, ses règles.
Il ne se lance pas seul. Trois programmes s'en servent :
    python solution/question.py     une seule question, comme au TP 2
    python solution/terminal.py     une conversation dans le terminal
    chainlit run solution/interface.py     une interface de discussion dans le navigateur
"""

import json
import os
import warnings
from pathlib import Path
from typing import Annotated, Any

from claude_agent_sdk import (
    CanUseToolShadowedWarning,
    ClaudeAgentOptions,
    HookMatcher,
    PermissionResultAllow,
    PermissionResultDeny,
    create_sdk_mcp_server,
    tool,
)
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

# Le SDK prévient que les outils de allowed_tools ne passent pas par can_use_tool : c'est voulu ici.
warnings.filterwarnings("ignore", category=CanUseToolShadowedWarning)

MODELE = os.environ["MODELE"]
TP = Path(__file__).resolve().parents[1]
DATA = TP.parents[1] / "data"
PROCEDURES = TP / "procedures"
DEMANDES = TP / "demandes_intervention.json"


# ---------- 1. Le prompt système : rôle, contexte, règles, format ----------

SYSTEME = (
    # Le rôle
    "Tu es l'assistant de l'atelier d'injection. Tu aides les chefs d'équipe. "
    # Le contexte
    "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. "
    "Les procédures de maintenance sont deux fichiers : defaut_ejection.md et derive_temps_de_cycle.md. "
    # Les règles
    "Réponds uniquement à partir des résultats des outils. Si une donnée manque, dis-le. "
    "Ne crée une demande d'intervention que si on te le demande explicitement. "
    # Le format
    "Réponds en français, en trois phrases au plus."
)


# ---------- 2. Les outils de l'atelier ----------

def charger(fichier: str) -> list[dict]:
    return json.loads((DATA / fichier).read_text(encoding="utf-8"))


def resultat(donnees: Any) -> dict[str, Any]:
    """Met des données au format attendu par le SDK pour un résultat d'outil."""
    return {"content": [{"type": "text", "text": json.dumps(donnees, ensure_ascii=False)}]}


@tool(
    "lister_arrets",
    "Liste les arrêts d'une machine de l'atelier sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
    {"machine_id": Annotated[str, "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle."]},
)
async def lister_arrets(args: dict[str, Any]) -> dict[str, Any]:
    return resultat([arret for arret in charger("arrets_machine.json") if arret["machine_id"] == args["machine_id"]])


@tool(
    "lire_ordre_fabrication",
    "Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.",
    {"of_id": Annotated[str, "Identifiant de l'ordre de fabrication, par exemple OF-2231."]},
)
async def lire_ordre_fabrication(args: dict[str, Any]) -> dict[str, Any]:
    for ordre in charger("ordres_fabrication.json"):
        if ordre["id"] == args["of_id"]:
            return resultat(ordre)
    return resultat({"erreur": f"Aucun ordre de fabrication {args['of_id']}."})


# Un outil d'action : il écrit. Il ne s'exécute qu'après l'accord d'une personne (voir plus bas).
@tool(
    "creer_demande_intervention",
    "Crée une demande d'intervention de maintenance pour une machine. À n'utiliser que si l'utilisateur le demande.",
    {
        "machine_id": Annotated[str, "Identifiant de la machine, P1 à P4, A1 ou C1."],
        "motif": Annotated[str, "Motif de la demande, en une phrase."],
        "priorite": Annotated[str, "Priorité : normale ou haute."],
    },
)
async def creer_demande_intervention(args: dict[str, Any]) -> dict[str, Any]:
    demandes = json.loads(DEMANDES.read_text(encoding="utf-8")) if DEMANDES.exists() else []
    demande = {"id": f"DI-{len(demandes) + 1:04d}", **args}
    demandes.append(demande)
    DEMANDES.write_text(json.dumps(demandes, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultat(demande)


# Les outils sont regroupés dans un serveur interne au programme.
# Leur nom complet devient : mcp__atelier__lister_arrets, etc.
atelier = create_sdk_mcp_server(
    name="atelier",
    version="1.0.0",
    tools=[lister_arrets, lire_ordre_fabrication, creer_demande_intervention],
)

OUTILS_DE_LECTURE = ["mcp__atelier__lister_arrets", "mcp__atelier__lire_ordre_fabrication"]
OUTIL_D_ACTION = "mcp__atelier__creer_demande_intervention"


# ---------- 3. La trace : un hook appelé avant chaque outil ----------

async def journal(donnees, tool_use_id, contexte):
    print(f"  [journal] {donnees['tool_name']}({json.dumps(donnees['tool_input'], ensure_ascii=False)})")
    return {}


# ---------- 4. Les permissions : qui décide pour les outils qui ne sont pas autorisés d'office ----------

def creer_permission(demander_accord):
    """Fabrique la fonction que le SDK appelle pour chaque outil absent de allowed_tools."""

    async def autoriser(nom_outil: str, parametres: dict[str, Any], contexte):
        # L'outil d'action : on demande à une personne.
        if nom_outil == OUTIL_D_ACTION:
            if demander_accord and await demander_accord(nom_outil, parametres):
                return PermissionResultAllow(updated_input=parametres)
            return PermissionResultDeny(message="La création a été refusée par l'utilisateur.")

        # Read, l'outil intégré du SDK : seulement dans le dossier des procédures.
        if nom_outil == "Read":
            chemin = Path(parametres.get("file_path", ""))
            chemin = (chemin if chemin.is_absolute() else PROCEDURES / chemin).resolve()
            if chemin.parent == PROCEDURES:
                return PermissionResultAllow(updated_input=parametres)
            return PermissionResultDeny(message="Lecture limitée au dossier des procédures.")

        return PermissionResultDeny(message="Outil non autorisé.")

    return autoriser


# ---------- 5. Les options : tout ce qui décrit l'agent ----------

def creer_options(session_id: str | None = None, demander_accord=None) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        model=MODELE,
        system_prompt=SYSTEME,
        mcp_servers={"atelier": atelier},  # nos outils
        tools=["Read"],  # le seul outil intégré du SDK qu'on garde : lire un fichier
        allowed_tools=OUTILS_DE_LECTURE,  # ce qui s'exécute sans rien demander
        can_use_tool=creer_permission(demander_accord),  # tout le reste passe par cette fonction
        hooks={"PreToolUse": [HookMatcher(hooks=[journal])]},  # la trace
        max_turns=10,  # la limite de tours
        resume=session_id,  # reprendre une conversation, si on en a l'identifiant
        cwd=str(PROCEDURES),  # le dossier de travail de l'agent
        setting_sources=[],  # ne charge aucun réglage de Claude Code présent sur la machine
    )
