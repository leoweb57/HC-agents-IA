"""TP 4 : l'agent d'atelier avec l'Agent SDK (à compléter).

Ce fichier décrit l'agent : ses outils, son prompt système, ses règles.
Il ne se lance pas seul. Trois programmes s'en servent :
    python exercice/question.py     une seule question, comme au TP 2
    python exercice/terminal.py     une conversation dans le terminal
    chainlit run exercice/interface.py     une interface de discussion dans le navigateur
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


# ---------- Le prompt système (partie 2, étape 4) ----------

# Pour l'instant, celui du TP 2. À réécrire en quatre parties : rôle, contexte, règles, format.
SYSTEME = (
    "Tu es l'assistant d'un atelier de production. "
    "Nous sommes le vendredi 13 mars 2026, il est 11 h. "
    "Réponds en français, en deux ou trois phrases, uniquement à partir des résultats des outils."
)


# ---------- Fourni : l'accès aux données de l'atelier ----------

def charger(fichier: str) -> list[dict]:
    return json.loads((DATA / fichier).read_text(encoding="utf-8"))


def resultat(donnees: Any) -> dict[str, Any]:
    """Met des données au format attendu par le SDK pour un résultat d'outil."""
    return {"content": [{"type": "text", "text": json.dumps(donnees, ensure_ascii=False)}]}


def arrets_de(machine_id: str) -> list[dict]:
    return [arret for arret in charger("arrets_machine.json") if arret["machine_id"] == machine_id]


def ordre_de_fabrication(of_id: str) -> dict:
    for ordre in charger("ordres_fabrication.json"):
        if ordre["id"] == of_id:
            return ordre
    return {"erreur": f"Aucun ordre de fabrication {of_id}."}


def enregistrer_demande(machine_id: str, motif: str, priorite: str) -> dict:
    demandes = json.loads(DEMANDES.read_text(encoding="utf-8")) if DEMANDES.exists() else []
    demande = {"id": f"DI-{len(demandes) + 1:04d}", "machine_id": machine_id, "motif": motif, "priorite": priorite}
    demandes.append(demande)
    DEMANDES.write_text(json.dumps(demandes, ensure_ascii=False, indent=2), encoding="utf-8")
    return demande


# ---------- PARTIE 1 ----------

# Étape 1. Déclarer les deux outils de lecture avec @tool : un nom, une description, un schéma, une fonction.
# Le premier est écrit. Écrivez le second, lire_ordre_fabrication, sur le même modèle :
# il reçoit of_id et renvoie resultat(ordre_de_fabrication(...)).

@tool(
    "lister_arrets",
    "Liste les arrêts d'une machine de l'atelier sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
    {"machine_id": Annotated[str, "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle."]},
)
async def lister_arrets(args: dict[str, Any]) -> dict[str, Any]:
    return resultat(arrets_de(args["machine_id"]))


# À ÉCRIRE : l'outil lire_ordre_fabrication


# Étape 2. Regrouper les outils dans un serveur interne, avec create_sdk_mcp_server.
# Leur nom complet devient : mcp__atelier__lister_arrets, etc.

# À ÉCRIRE : atelier = create_sdk_mcp_server(name="atelier", version="1.0.0", tools=[...])


# Étape 3. Décrire l'agent dans creer_options.

def creer_options(session_id: str | None = None, demander_accord=None) -> ClaudeAgentOptions:
    # À ÉCRIRE : renvoyer ClaudeAgentOptions(...) avec
    #   model            le modèle (MODELE)
    #   system_prompt    le prompt système (SYSTEME)
    #   mcp_servers      {"atelier": atelier}
    #   tools            [] : aucun outil intégré du SDK pour l'instant
    #   allowed_tools    les noms complets des deux outils de lecture
    #   max_turns        la limite de tours, 10
    #   setting_sources  [] : ne charge aucun réglage de Claude Code présent sur la machine
    raise NotImplementedError("Partie 1 : écrivez creer_options dans exercice/agent.py")


# ---------- PARTIE 2 ----------

# Étape 4. Réécrire SYSTEME, en haut du fichier, en quatre parties : rôle, contexte, règles, format.

# Étape 5. La session : ajouter resume=session_id dans creer_options.

# Étape 6. La trace : écrire un hook appelé avant chaque outil, et le brancher dans creer_options.
#   async def journal(donnees, tool_use_id, contexte):
#       afficher donnees["tool_name"] et donnees["tool_input"], puis renvoyer {}
#   hooks={"PreToolUse": [HookMatcher(hooks=[journal])]}

# Étape 7. Un outil d'action : creer_demande_intervention(machine_id, motif, priorite).
#   - le déclarer avec @tool (il appelle enregistrer_demande) et l'ajouter au serveur ;
#   - ne PAS le mettre dans allowed_tools ;
#   - écrire la fonction de permission et la brancher : can_use_tool=creer_permission(demander_accord).

def creer_permission(demander_accord):
    """Fabrique la fonction que le SDK appelle pour chaque outil absent de allowed_tools."""

    async def autoriser(nom_outil: str, parametres: dict[str, Any], contexte):
        # À ÉCRIRE :
        #   si nom_outil est l'outil d'action : appeler await demander_accord(nom_outil, parametres)
        #     accord  -> return PermissionResultAllow(updated_input=parametres)
        #     refus   -> return PermissionResultDeny(message="...")
        return PermissionResultDeny(message="Outil non autorisé.")

    return autoriser

# Étape 8. Un outil intégré du SDK : Read, pour lire les procédures du dossier procedures/.
#   - tools=["Read"] et cwd=str(PROCEDURES) dans creer_options ;
#   - indiquer les deux fichiers de procédures dans le prompt système ;
#   - dans autoriser : n'accepter Read que pour un fichier du dossier PROCEDURES.
