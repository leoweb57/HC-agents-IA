"""TP 7 : ce que l'agent v1 et l'agent v2 ont en commun. Fourni.

Le serveur MCP « atelier », l'outil d'action, la trace et les permissions.
Rien n'est à modifier ici : les deux agents s'en servent tels quels. C'est ce qui rend
la comparaison honnête : mêmes données, mêmes outils, même skill, même modèle.
"""

import json
import os
import sys
import warnings
from pathlib import Path
from typing import Annotated, Any

from claude_agent_sdk import (
    CanUseToolShadowedWarning,
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
TP = Path(__file__).resolve().parents[1]
DEMANDES = TP / "demandes_intervention.json"


# ---------- Le serveur MCP « atelier » : les quatre lectures (TP 5 et 6) ----------

# Transport stdio : le SDK lance lui-même le programme au démarrage de l'agent.
SERVEUR_ATELIER = {"command": sys.executable, "args": [str(TP / "serveur_atelier.py")]}

# Le nom complet d'un outil MCP : mcp__<serveur>__<outil>. C'est sous ce nom qu'on l'autorise,
# et c'est sous ce nom qu'on le donne, ou pas, à un sous-agent.
LISTER_ARRETS = "mcp__atelier__lister_arrets"
HISTORIQUE_ARRETS = "mcp__atelier__historique_arrets"
LISTER_CONTROLES_QUALITE = "mcp__atelier__lister_controles_qualite"
LIRE_ORDRE_FABRICATION = "mcp__atelier__lire_ordre_fabrication"
OUTILS_DE_LECTURE = [LISTER_ARRETS, HISTORIQUE_ARRETS, LISTER_CONTROLES_QUALITE, LIRE_ORDRE_FABRICATION]


# ---------- L'outil d'action : créer une demande d'intervention (TP 4) ----------

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


# ---------- La trace : un hook appelé avant chaque outil (TP 4) ----------

# Nouveau par rapport au jour 1 : quand l'appel vient d'un sous-agent, le SDK ajoute son nom
# dans agent_type. Le même hook voit donc les outils de tous les agents, et sait qui appelle.
# Pour une délégation, on affiche le texte envoyé au sous-agent : c'est tout ce qu'il recevra.

async def journal(donnees, tool_use_id, contexte):
    qui = donnees.get("agent_type") or "principal"
    outil, parametres = donnees["tool_name"], donnees["tool_input"]
    if outil == "Agent":
        print(f"  [{qui}] délègue à « {parametres.get('subagent_type')} » : {parametres.get('prompt')}")
    else:
        print(f"  [{qui}] {outil}({json.dumps(parametres, ensure_ascii=False)})")
    return {}


# ---------- Les permissions : l'accord d'une personne pour l'action (TP 4) ----------

# Ce qui ne passe pas par cette fonction :
# - les outils de allowed_tools, autorisés d'office ;
# - Read dans le dossier de travail (cwd, ici le dossier du TP) : le SDK y laisse lire sans rien demander.
#   C'est ce qui permet au skill de lire ses procédures. Hors de ce dossier, Read arrive ici, et il est refusé.

def creer_permission(demander_accord):
    """Fabrique la fonction que le SDK appelle pour chaque outil qui n'est pas autorisé d'office."""

    async def autoriser(nom_outil: str, parametres: dict[str, Any], contexte):
        if nom_outil == OUTIL_D_ACTION:
            if demander_accord and await demander_accord(nom_outil, parametres):
                return PermissionResultAllow(updated_input=parametres)
            return PermissionResultDeny(message="La création a été refusée par l'utilisateur.")
        return PermissionResultDeny(message="Outil non autorisé.")

    return autoriser
