"""TP 10, variante : la même question, tracée par une instrumentation automatique.

    pip install openinference-instrumentation-claude-agent-sdk
    python variante_openinference.py "Où en est l'OF-2231 ?"

C'est la voie que documente Langfuse pour le Claude Agent SDK : deux lignes, et le SDK est tracé.
À comparer dans Langfuse avec la trace de terminal.py : ici, une seule observation pour tout l'agent
(tokens cumulés) et une par outil. Pas de détail appel par appel.
"""

import asyncio
import sys

import claude_agent_sdk

from agent import creer_options  # lit le fichier .env : à importer avant Langfuse
from langfuse import get_client, observe, propagate_attributes
from openinference.instrumentation.claude_agent_sdk import ClaudeAgentSDKInstrumentor

langfuse = get_client()
ClaudeAgentSDKInstrumentor().instrument()  # les deux lignes : claude_agent_sdk.query est désormais tracée


@observe(name="agent-atelier (OpenInference)")
async def poser(question: str) -> str:
    reponse = ""
    # Le piège : l'instrumentation remplace la fonction query du module. Un « from claude_agent_sdk import query »
    # fait avant l'appel à instrument() garderait l'ancienne fonction, non tracée. On passe donc par le module.
    async for message in claude_agent_sdk.query(prompt=question, options=creer_options()):
        if isinstance(message, claude_agent_sdk.ResultMessage):
            reponse = message.result or ""
    return reponse


async def main():
    question = sys.argv[1] if len(sys.argv) > 1 else "Où en est l'OF-2231 ?"
    with propagate_attributes(session_id="variante-openinference", user_id="chef-equipe-1", tags=["atelier", "tp10", "variante"]):
        print(await poser(question))
    langfuse.flush()


asyncio.run(main())
