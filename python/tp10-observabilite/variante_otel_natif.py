"""TP 10, variante : la même question, tracée par l'export OpenTelemetry du SDK lui-même.

    python variante_otel_natif.py "Où en est l'OF-2231 ?"

Le processus du SDK sait exporter ses propres traces : on lui indique où, par des variables d'environnement.
Aucun code à écrire. À comparer dans Langfuse avec la trace de terminal.py : ici, chaque appel au modèle
a sa durée et ses tokens exacts, chaque outil sa durée, mais le texte des échanges n'y est pas.
Cet export est en bêta.
"""

import asyncio
import base64
import os
import sys

from claude_agent_sdk import ResultMessage, query

from agent import creer_options  # lit le fichier .env : à importer avant Langfuse
from langfuse import get_client, observe, propagate_attributes

langfuse = get_client()

# Langfuse reçoit de l'OpenTelemetry sur /api/public/otel, avec ses deux clés en authentification « Basic ».
CLES = base64.b64encode(f"{os.environ['LANGFUSE_PUBLIC_KEY']}:{os.environ['LANGFUSE_SECRET_KEY']}".encode()).decode()
EXPORT = {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "CLAUDE_CODE_ENHANCED_TELEMETRY_BETA": "1",  # les traces (les métriques et les journaux n'en ont pas besoin)
    "OTEL_TRACES_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
    "OTEL_EXPORTER_OTLP_ENDPOINT": f"{os.environ['LANGFUSE_BASE_URL']}/api/public/otel",
    # Le second en-tête demande à Langfuse 4 d'afficher les traces tout de suite, et non avec plusieurs minutes de retard.
    "OTEL_EXPORTER_OTLP_HEADERS": f"Authorization=Basic {CLES},x-langfuse-ingestion-version=4",
    "OTEL_TRACES_EXPORT_INTERVAL": "1000",  # en millisecondes : on n'attend pas pour envoyer
}


@observe(name="agent-atelier (OTel natif)")
async def poser(question: str) -> str:
    options = creer_options()
    options.env = {**(options.env or {}), **EXPORT}  # les variables sont passées au processus du SDK
    reponse = ""
    async for message in query(prompt=question, options=options):
        if isinstance(message, ResultMessage):
            reponse = message.result or ""
    return reponse


async def main():
    question = sys.argv[1] if len(sys.argv) > 1 else "Où en est l'OF-2231 ?"
    with propagate_attributes(session_id="variante-otel-natif", user_id="chef-equipe-1", tags=["atelier", "tp10", "variante"]):
        print(await poser(question))
    langfuse.flush()


asyncio.run(main())
