"""TP 4, partie 1 : une seule question, comme au TP 2, mais avec l'Agent SDK.

Lancement, depuis le dossier du TP :
    python exercice/question.py
"""

import asyncio

from agent import creer_options
from claude_agent_sdk import ResultMessage, query

QUESTION = "Pourquoi la presse 4 s'est-elle arrêtée ce matin, et où en est l'ordre de fabrication qui était en cours ?"


async def main():
    # query fait tourner la boucle et renvoie les messages au fur et à mesure.
    async for message in query(prompt=QUESTION, options=creer_options()):
        if isinstance(message, ResultMessage):  # le dernier message : la réponse finale
            print()
            print(message.result)
            print()
            print(f"{message.num_turns} tours, {message.total_cost_usd:.4f} $, session {message.session_id}")


asyncio.run(main())
