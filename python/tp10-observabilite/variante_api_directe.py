"""TP 10, variante : un appel direct à l'API, tracé sans une ligne de traçage.

    python variante_api_directe.py

Le SDK Anthropic émet lui-même une trace OpenTelemetry pour chaque appel à l'API : modèle, tokens, durée.
Dès que Langfuse est initialisé, il la reçoit. Notre seul geste : le décorateur @observe sur notre fonction,
pour que l'appel se range sous elle.

C'est le cas simple, celui de la boucle écrite à la main au jour 1. Avec l'Agent SDK, les appels au modèle
partent d'un autre processus : ce mécanisme ne les voit pas. D'où suivi.py.
"""

import anthropic

from agent import MODELE  # lit le fichier .env : à importer avant Langfuse
from langfuse import get_client, observe

langfuse = get_client()
# « content » : la trace porte aussi le texte de la question et de la réponse. Par défaut, elle n'a que les mesures.
client = anthropic.Anthropic(open_telemetry={"traces": {"content_mode": "content"}})


@observe(name="question-directe")
def demander(question: str) -> str:
    reponse = client.messages.create(model=MODELE, max_tokens=300, messages=[{"role": "user", "content": question}])
    return next(bloc.text for bloc in reponse.content if bloc.type == "text")


print(demander("En une phrase : à quoi sert un éjecteur sur une presse à injecter ?"))
langfuse.flush()
