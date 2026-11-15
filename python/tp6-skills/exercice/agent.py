"""TP 6 : donner un skill à l'agent d'atelier (à compléter).

Ce fichier est l'agent du TP 5, terminé, branché sur le serveur MCP « atelier ».
Le skill s'écrit dans .claude/skills/diagnostic-arret/SKILL.md. Ici, cherchez « À ÉCRIRE ».

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
SKILL = TP / ".claude" / "skills" / "diagnostic-arret"
DEMANDES = TP / "demandes_intervention.json"
SERVEUR_ATELIER = TP / "serveur_atelier.py"


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
    # Les règles
    "Réponds uniquement à partir des résultats des outils. Si une donnée manque, dis-le. "
    "Ne crée une demande d'intervention que si on te le demande explicitement. "
    # Le format
    "Réponds en français, en trois phrases au plus, sauf si un skill impose un autre format."
)


# ---------- 2. L'outil d'action de l'agent (étape 7) ----------

def resultat(donnees: Any) -> dict[str, Any]:
    """Met des données au format attendu par le SDK pour un résultat d'outil."""
    return {"content": [{"type": "text", "text": json.dumps(donnees, ensure_ascii=False)}]}


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


# Pourquoi un serveur interne reste : l'action est propre à cet agent, et elle passe par l'accord
# d'une personne. Elle reste donc dans son code. Pourquoi « actions » : le nom « atelier » est
# maintenant celui du serveur externe, et deux serveurs ne peuvent pas porter le même nom.
actions = create_sdk_mcp_server(name="actions", version="1.0.0", tools=[creer_demande_intervention])

# Pourquoi ces noms n'ont pas bougé : le préfixe est le nom du serveur, et il s'appelle toujours « atelier ».
# Le code a déménagé, le modèle ne voit aucune différence.
OUTILS_DE_LECTURE = [
    "mcp__atelier__lister_arrets",
    "mcp__atelier__lire_ordre_fabrication",
    "mcp__atelier__lister_controles_qualite",  # bonus
    "mcp__atelier__historique_arrets",  # bonus
]
OUTIL_D_ACTION = "mcp__actions__creer_demande_intervention"


# ---------- Le serveur MCP « atelier » (TP 5) ----------

# Pourquoi pas de @tool pour les lectures : elles vivent maintenant dans un programme à part,
# serveur_atelier.py. On dit seulement au SDK comment le lancer ; c'est le serveur qui annonce
# ses outils, leurs descriptions et leurs schémas.
# Pourquoi une commande : en transport stdio, le SDK lance lui-même le programme au démarrage de l'agent,
# et lui parle par son entrée et sa sortie standard. Rien à lancer à la main.
# Pourquoi sys.executable : pour le lancer avec le même Python que l'agent, donc avec ses dépendances.
SERVEUR_EXTERNE = {"command": sys.executable, "args": [str(SERVEUR_ATELIER)]}


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

        # Read, l'outil intégré du SDK : seulement dans le dossier du skill, où sont les procédures.
        if nom_outil == "Read":
            chemin = Path(parametres.get("file_path", ""))
            chemin = (chemin if chemin.is_absolute() else TP / chemin).resolve()
            if SKILL in chemin.parents:
                return PermissionResultAllow(updated_input=parametres)
            return PermissionResultDeny(message="Lecture limitée au dossier du skill.")

        return PermissionResultDeny(message="Outil non autorisé.")

    return autoriser


# ---------- 5. Les options : tout ce qui décrit l'agent (étapes 3, 5, 6, 7 et 8) ----------

# Pourquoi tools et allowed_tools sont deux listes : tools dit quels outils intégrés existent pour le modèle,
# allowed_tools dit lesquels s'exécutent sans rien demander. L'outil d'action et Read n'y sont pas :
# ils passent donc par can_use_tool.

def creer_options(session_id: str | None = None, demander_accord=None) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        model=MODELE,
        system_prompt=SYSTEME,
        mcp_servers={"atelier": SERVEUR_EXTERNE, "actions": actions},  # le serveur externe, et notre action
        tools=["Read"],  # À ÉCRIRE (étape 2) : ajouter l'outil intégré "Skill"
        setting_sources=[],  # À ÉCRIRE (étape 2) : ["project"], pour que le SDK lise le dossier .claude/ du TP
        # À ÉCRIRE (étape 2) : skills=["diagnostic-arret"], la liste des skills que le modèle peut charger
        cwd=str(TP),  # le dossier de travail : c'est là que le SDK cherche .claude/skills/
        allowed_tools=OUTILS_DE_LECTURE,  # ce qui s'exécute sans rien demander
        can_use_tool=creer_permission(demander_accord),  # tout le reste passe par cette fonction
        hooks={"PreToolUse": [HookMatcher(hooks=[journal])]},  # la trace
        max_turns=15,  # la limite de tours : un diagnostic enchaîne plusieurs outils
        resume=session_id,  # reprendre une conversation, si on en a l'identifiant
    )
