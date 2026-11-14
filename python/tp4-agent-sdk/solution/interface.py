"""TP 4, partie 3 : une interface de discussion dans le navigateur, avec Chainlit.

Lancement, depuis le dossier du TP :
    chainlit run solution/interface.py
Puis ouvrir http://localhost:8000
"""

import chainlit as cl
from agent import creer_options
from claude_agent_sdk import AssistantMessage, ResultMessage, ToolUseBlock, query


async def demander_accord(nom_outil: str, parametres: dict) -> bool:
    """Affiche deux boutons et attend le choix de l'utilisateur."""
    reponse = await cl.AskActionMessage(
        content=f"L'agent veut créer une demande d'intervention :\n\n{parametres}",
        actions=[
            cl.Action(name="valider", payload={"accord": True}, label="Valider"),
            cl.Action(name="refuser", payload={"accord": False}, label="Refuser"),
        ],
        timeout=300,
    ).send()
    return bool(reponse and reponse.get("payload", {}).get("accord"))


@cl.on_chat_start
async def accueil():
    await cl.Message(content="Bonjour, je suis l'assistant de l'atelier. Que voulez-vous savoir ?").send()


@cl.on_message
async def repondre(message: cl.Message):
    # Chainlit garde une mémoire par conversation : on y range l'identifiant de session du SDK.
    session_id = cl.user_session.get("session_id")

    async for evenement in query(prompt=message.content, options=creer_options(session_id, demander_accord)):
        if isinstance(evenement, AssistantMessage):
            for bloc in evenement.content:
                if isinstance(bloc, ToolUseBlock):  # une demande d'outil : on l'affiche comme une étape
                    async with cl.Step(name=bloc.name, type="tool") as etape:
                        etape.input = bloc.input
        elif isinstance(evenement, ResultMessage):
            cl.user_session.set("session_id", evenement.session_id)
            await cl.Message(content=evenement.result or "Je n'ai pas pu répondre.").send()
