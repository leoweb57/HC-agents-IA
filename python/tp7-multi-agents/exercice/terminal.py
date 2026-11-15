"""TP 7 : une conversation avec l'agent, dans le terminal. Fourni.

Lancement, depuis le dossier du TP :
    python exercice/terminal.py v1      l'agent seul
    python exercice/terminal.py v2      le chef d'atelier et ses spécialistes
"""

import asyncio
import sys

from claude_agent_sdk import ResultMessage, query

from mesures import Mesure

version = sys.argv[1] if len(sys.argv) > 1 else "v2"
if version == "v1":
    from agent_v1 import creer_options
else:
    from agent_v2 import creer_options


async def demander_accord(nom_outil: str, parametres: dict) -> bool:
    """Appelée quand l'agent veut utiliser l'outil d'action."""
    print(f"  L'agent veut créer une demande d'intervention : {parametres}")
    reponse = await asyncio.to_thread(input, "  Valider ? (o/n) ")
    return reponse.strip().lower().startswith("o")


async def main():
    session_id = None  # pas encore de conversation
    print(f"Agent {version}. Posez vos questions. Ligne vide pour quitter.")
    while True:
        texte = await asyncio.to_thread(input, "\nVous : ")
        if not texte.strip():
            break
        mesure = Mesure()
        async for message in query(prompt=texte, options=creer_options(session_id, demander_accord)):
            mesure.voir(message)
            if isinstance(message, ResultMessage):
                session_id = message.session_id  # on garde l'identifiant pour le message suivant
                print(f"\nAgent : {message.result}")
                print(f"  [{mesure.ligne()}]")


asyncio.run(main())
