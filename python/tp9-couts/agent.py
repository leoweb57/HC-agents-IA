"""L'agent d'atelier du jour 3. Fourni : c'est l'agent du TP 6, un seul agent, réuni dans un seul fichier.

Rien de nouveau ici : le serveur MCP « atelier » (quatre lectures), le skill de diagnostic,
l'outil d'action soumis à l'accord d'une personne, et la trace dans le terminal.
Les scripts du TP partent de ces options, puis y ajoutent ce qu'ils veulent montrer.
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

# Le SDK avertit que les outils de allowed_tools ne passeront pas par can_use_tool.
# C'est voulu (les lectures passent d'office), donc on masque l'avertissement.
warnings.filterwarnings("ignore", category=CanUseToolShadowedWarning)

MODELE = os.environ["MODELE"]
TP = Path(__file__).resolve().parent
DEMANDES = TP / "demandes_intervention.json"

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

# ---------- Le serveur MCP « atelier » : les quatre lectures ----------

# Transport stdio : le SDK lance lui-même le programme au démarrage de l'agent.
SERVEUR_ATELIER = {"command": sys.executable, "args": [str(TP / "serveur_atelier.py")]}

OUTILS_DE_LECTURE = [
    "mcp__atelier__lister_arrets",
    "mcp__atelier__historique_arrets",
    "mcp__atelier__lister_controles_qualite",
    "mcp__atelier__lire_ordre_fabrication",
]


# ---------- L'outil d'action : créer une demande d'intervention ----------

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
    return {"content": [{"type": "text", "text": json.dumps(demande, ensure_ascii=False)}]}


actions = create_sdk_mcp_server(name="actions", version="1.0.0", tools=[creer_demande_intervention])
OUTIL_D_ACTION = "mcp__actions__creer_demande_intervention"


# ---------- La trace dans le terminal : un hook appelé avant chaque outil ----------

async def journal(donnees, tool_use_id, contexte):
    print(f"  [outil] {donnees['tool_name']}({json.dumps(donnees['tool_input'], ensure_ascii=False)})")
    return {}


# ---------- Les permissions : l'accord d'une personne pour l'action ----------

def creer_permission(demander_accord):
    """Fabrique la fonction que le SDK appelle pour chaque outil qui n'est pas autorisé d'office."""

    async def autoriser(nom_outil: str, parametres: dict[str, Any], contexte):
        if nom_outil == OUTIL_D_ACTION:
            if demander_accord and await demander_accord(nom_outil, parametres):
                return PermissionResultAllow(updated_input=parametres)
            return PermissionResultDeny(message="La création a été refusée par l'utilisateur.")
        return PermissionResultDeny(message="Outil non autorisé.")

    return autoriser


# ---------- Les options de l'agent ----------

def creer_options(session_id: str | None = None, demander_accord=None) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        model=MODELE,
        system_prompt=SYSTEME,
        mcp_servers={"atelier": dict(SERVEUR_ATELIER), "actions": actions},
        tools=["Read", "Skill"],  # les outils intégrés : lire un fichier, charger un skill
        setting_sources=["project"],  # pour que le SDK lise .claude/skills/
        skills=["diagnostic-arret"],
        cwd=str(TP),
        allowed_tools=list(OUTILS_DE_LECTURE),  # ce qui s'exécute sans rien demander
        can_use_tool=creer_permission(demander_accord),  # l'action passe par l'accord d'une personne
        hooks={"PreToolUse": [HookMatcher(hooks=[journal])]},  # la trace
        max_turns=15,
        max_budget_usd=0.50,
        resume=session_id,
    )
