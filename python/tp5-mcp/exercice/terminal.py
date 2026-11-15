"""TP 5 : une conversation avec l'agent, dans le terminal. Fourni.

Chaque lancement démarre une conversation neuve : c'est ce qui permet de tester la mémoire commune.

Lancement, depuis le dossier du TP :
    python exercice/terminal.py
"""

import asyncio

from agent import creer_options
from claude_agent_sdk import ResultMessage, query


async def demander_accord(nom_outil: str, parametres: dict) -> bool:
    """Appelée quand l'agent veut utiliser l'outil d'action."""
    print(f"  L'agent veut créer une demande d'intervention : {parametres}")
    reponse = await asyncio.to_thread(input, "  Valider ? (o/n) ")
    return reponse.strip().lower().startswith("o")


async def main():
    session_id = None  # pas encore de conversation
    utilisateur = (await asyncio.to_thread(input, "Votre prénom : ")).strip()
    print("Posez vos questions à l'agent d'atelier. Ligne vide pour quitter.")
    while True:
        texte = await asyncio.to_thread(input, "\nVous : ")
        if not texte.strip():
            break
        async for message in query(prompt=texte, options=creer_options(session_id, demander_accord, utilisateur)):
            if isinstance(message, ResultMessage):
                session_id = message.session_id  # on garde l'identifiant pour le message suivant
                print(f"\nAgent : {message.result}")


asyncio.run(main())
