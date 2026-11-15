"""TP 5 : brancher des serveurs MCP sur l'agent d'atelier (à compléter).

Ce fichier est l'agent du TP 4, terminé. Vous pouvez le remplacer par le vôtre.
Les parties 2 et 3 du TP se font ici : cherchez « TP 5 » et « À ÉCRIRE ».

Pour parler à l'agent, depuis le dossier du TP :
    python exercice/terminal.py
"""

import json
import os
import sys
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

# Pourquoi : le SDK avertit que les outils de allowed_tools ne passeront pas par can_use_tool.
# C'est exactement ce qu'on veut (les lectures passent d'office), donc on masque l'avertissement.
warnings.filterwarnings("ignore", category=CanUseToolShadowedWarning)

MODELE = os.environ["MODELE"]
TP = Path(__file__).resolve().parents[1]
DATA = TP.parents[1] / "data"
PROCEDURES = TP / "procedures"
DEMANDES = TP / "demandes_intervention.json"
SERVEUR_MEMOIRE = TP / "serveur" / "memoire.py"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")


# ---------- 1. Le prompt système : rôle, contexte, règles, format (étape 4) ----------

# Pourquoi quatre parties : le modèle relit ce texte à chaque tour. On y met ce qui doit rester vrai
# tout au long de la conversation, et rien d'autre. La date est indispensable : sans elle,
# « ce matin » ne veut rien dire pour le modèle.
# Pourquoi la règle sur les demandes d'intervention est aussi ici : le prompt oriente le modèle,
# mais ce n'est pas lui qui protège. La vraie protection est la fonction de permission, plus bas.

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


# ---------- 2. Les outils de l'atelier (étapes 1, 2 et 7) ----------

# Pourquoi les descriptions sont aussi détaillées : c'est tout ce que le modèle voit d'un outil.
# La correspondance « presse 4 = P4 » est écrite dans la description du paramètre (énigme 1 du TP 2).

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
# Pourquoi il est déclaré comme les autres : pour le SDK, lecture ou action, c'est le même objet.
# La différence se fait dans les permissions, pas dans la déclaration.
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


# ---------- TP 5 : brancher des serveurs MCP externes ----------

# Un serveur MCP externe ne se déclare pas avec @tool : c'est un programme à part.
# On dit seulement au SDK comment le joindre, dans mcp_servers. Le SDK lui demande ses outils.

# Partie 2. Brancher notre serveur « memoire » (transport stdio : le SDK lance le programme).
#   Dans creer_options, ajouter à mcp_servers :
#       "memoire": {"command": sys.executable, "args": [str(SERVEUR_MEMOIRE)]}
#   Autoriser ses deux outils : "mcp__memoire__lire_memoire" et "mcp__memoire__memoriser".
#   Ajouter au prompt système quand consulter la mémoire, et quand y écrire.

# Partie 3. Brancher le serveur officiel de GitHub (transport HTTP : le serveur tourne chez GitHub).
#   Dans creer_options, ajouter à mcp_servers :
#       "github": {
#           "type": "http",
#           "url": "https://api.githubcopilot.com/mcp/",
#           "headers": {
#               "Authorization": f"Bearer {GITHUB_TOKEN}",   # le jeton, lu dans le fichier .env
#               "X-MCP-Toolsets": "repos",                    # seulement les outils sur les dépôts
#               "X-MCP-Readonly": "true",                     # seulement les outils de lecture
#           },
#       }
#   Autoriser ses outils : "mcp__github__*".


# ---------- 3. La trace : un hook appelé avant chaque outil (étape 6) ----------

# Pourquoi un hook plutôt qu'un print dans chaque outil : le hook voit tous les outils,
# y compris Read, qui n'est pas notre code. Il renvoie {} : il observe, il ne bloque rien.

async def journal(donnees, tool_use_id, contexte):
    print(f"  [journal] {donnees['tool_name']}({json.dumps(donnees['tool_input'], ensure_ascii=False)})")
    return {}


# ---------- 4. Les permissions : qui décide pour les outils qui ne sont pas autorisés d'office (étapes 7 et 8) ----------

# Pourquoi une fonction qui en fabrique une autre : la façon de demander l'accord dépend du programme
# (une question au clavier dans terminal.py, deux boutons dans interface.py). L'agent ne change pas.
# Pourquoi tout refuser à la fin : un outil qu'on n'a pas prévu ne doit jamais passer par défaut.

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
            # Pourquoi resolve() : pour qu'un chemin comme ../../.env soit ramené à son vrai dossier avant le test.
            chemin = Path(parametres.get("file_path", ""))
            chemin = (chemin if chemin.is_absolute() else PROCEDURES / chemin).resolve()
            if chemin.parent == PROCEDURES:
                return PermissionResultAllow(updated_input=parametres)
            return PermissionResultDeny(message="Lecture limitée au dossier des procédures.")

        return PermissionResultDeny(message="Outil non autorisé.")

    return autoriser


# ---------- 5. Les options : tout ce qui décrit l'agent (étapes 3, 5, 6, 7 et 8) ----------

# Pourquoi tools et allowed_tools sont deux listes : tools dit quels outils intégrés existent pour le modèle,
# allowed_tools dit lesquels s'exécutent sans rien demander. L'outil d'action et Read n'y sont pas :
# ils passent donc par can_use_tool.
# Pourquoi setting_sources=[] : sans cela, le SDK charge les réglages de Claude Code s'il est installé
# sur la machine, et l'agent ne se comporte plus de la même façon d'un poste à l'autre.

def creer_options(session_id: str | None = None, demander_accord=None, utilisateur: str = "") -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        model=MODELE,
        system_prompt=SYSTEME + f" Tu parles avec {utilisateur or 'un utilisateur inconnu'}.",
        mcp_servers={"atelier": atelier},  # nos outils. À ÉCRIRE : ajouter ici les serveurs memoire, puis github
        tools=["Read"],  # le seul outil intégré du SDK qu'on garde : lire un fichier
        allowed_tools=OUTILS_DE_LECTURE,  # ce qui s'exécute sans rien demander. À ÉCRIRE : y ajouter les outils des serveurs
        can_use_tool=creer_permission(demander_accord),  # tout le reste passe par cette fonction
        hooks={"PreToolUse": [HookMatcher(hooks=[journal])]},  # la trace
        max_turns=10,  # la limite de tours
        resume=session_id,  # reprendre une conversation, si on en a l'identifiant
        cwd=str(PROCEDURES),  # le dossier de travail de l'agent
        setting_sources=[],  # ne charge aucun réglage de Claude Code présent sur la machine
    )
