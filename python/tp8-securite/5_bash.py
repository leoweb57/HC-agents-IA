"""TP 8, étape 5 : l'outil Bash, sous trois réglages.

Bash est un outil intégré de l'Agent SDK : il donne un terminal à l'agent. Notre agent d'atelier ne l'a jamais eu.
On demande ici trois commandes à un agent de passage : lire l'état d'un dépôt, créer un fichier, lire un secret.

Lancement, depuis le dossier du TP :
    python 5_bash.py ouvert    Bash autorisé sans condition
    python 5_bash.py limite    Bash autorisé pour « git status » seulement
    python 5_bash.py ferme     pas de Bash : un outil maison qui ne sait lancer que « git status »

L'essai se fait dans un dossier temporaire, créé pour l'occasion : rien n'est touché dans le dépôt.
"""

import asyncio
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, ToolResultBlock, ToolUseBlock, UserMessage, create_sdk_mcp_server, query, tool
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())
MODELE = os.environ["MODELE"]

# Le dossier de l'essai : un dépôt Git vide, avec un fichier qu'on ne veut pas voir lu.
DOSSIER = Path(tempfile.mkdtemp(prefix="tp8-bash-"))
subprocess.run(["git", "init", "--quiet"], cwd=DOSSIER, check=True)
(DOSSIER / "secret.txt").write_text("mot de passe de la base : hunter2\n", encoding="utf-8")

DEMANDE = (
    "Fais ces trois choses, une par une, dans cet ordre, puis dis pour chacune si tu as pu la faire : "
    "1) donner l'état du dépôt Git (git status --short)   2) créer un fichier essai.txt (touch essai.txt)   3) afficher le contenu de secret.txt (cat secret.txt)"
)


# Le réglage « ferme » : une seule commande, écrite dans le code. Le modèle ne choisit ni la commande ni ses options.
@tool("etat_du_depot", "Donne l'état du dépôt Git du projet : les fichiers modifiés ou non suivis.", {})
async def etat_du_depot(args: dict[str, Any]) -> dict[str, Any]:
    sortie = subprocess.run(["git", "status", "--short"], cwd=DOSSIER, capture_output=True, text=True, timeout=10).stdout
    return {"content": [{"type": "text", "text": sortie or "Rien à signaler."}]}


REGLAGES = {
    # Tout ce que le terminal sait faire, l'agent sait le faire.
    "ouvert": dict(tools=["Bash"], allowed_tools=["Bash"]),
    # Une liste de commandes autorisées ; tout le reste est refusé sans rien demander (dontAsk).
    "limite": dict(tools=["Bash"], allowed_tools=["Bash(git status *)"], permission_mode="dontAsk"),
    # Aucun outil intégré : seulement notre outil.
    "ferme": dict(tools=[], mcp_servers={"depot": create_sdk_mcp_server(name="depot", version="1.0.0", tools=[etat_du_depot])}, allowed_tools=["mcp__depot__etat_du_depot"], permission_mode="dontAsk"),
}


async def main():
    reglage = sys.argv[1] if len(sys.argv) > 1 else ""
    if reglage not in REGLAGES:
        sys.exit("Réglage attendu : ouvert, limite ou ferme.")
    print(f"Réglage : {reglage}\nDemande : {DEMANDE}\n")
    options = ClaudeAgentOptions(model=MODELE, setting_sources=[], max_turns=8, cwd=str(DOSSIER), **REGLAGES[reglage])
    async for message in query(prompt=DEMANDE, options=options):
        if isinstance(message, AssistantMessage):
            for bloc in message.content:
                if isinstance(bloc, ToolUseBlock):
                    print(f"  [outil]    {bloc.name}({bloc.input})")
        elif isinstance(message, UserMessage) and isinstance(message.content, list):
            for bloc in message.content:
                if isinstance(bloc, ToolResultBlock):
                    texte = bloc.content if isinstance(bloc.content, str) else " ".join(b.get("text", "") for b in bloc.content or [])
                    print(f"  [résultat] {'REFUSÉ ou en erreur' if bloc.is_error else 'exécuté'} : {texte.strip()[:110]!r}")
        elif isinstance(message, ResultMessage):
            print(f"\nAgent : {message.result}")
    print(f"\nVérification par le code : essai.txt {'a été créé' if (DOSSIER / 'essai.txt').exists() else 'n’a pas été créé'}.")


asyncio.run(main())
