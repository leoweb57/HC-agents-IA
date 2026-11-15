"""TP 5 : se brancher sur un serveur MCP et lui demander ce qu'il sait faire. Fourni.

Ce programme est un client MCP minimal, sans modèle ni agent.
Il ouvre une session avec le serveur et lui pose la question « quels outils as-tu ? ».

Lancement, depuis le dossier du TP :
    python exercice/decouvrir.py memoire       notre serveur, lancé sur ce poste (transport stdio)
    python exercice/decouvrir.py github        le serveur officiel de GitHub, à distance (transport HTTP)
    python exercice/decouvrir.py github repos  le même, limité aux outils sur les dépôts, en lecture seule
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

TP = Path(__file__).resolve().parents[1]
GITHUB = "https://api.githubcopilot.com/mcp/"


async def interroger(lecture, ecriture, nom: str):
    async with ClientSession(lecture, ecriture) as session:
        await session.initialize()  # la poignée de main du protocole
        outils = (await session.list_tools()).tools  # la demande « tools/list »
        definitions = sum(len(outil.model_dump_json()) for outil in outils)
        print(f"Le serveur « {nom} » expose {len(outils)} outil(s), soit environ {definitions // 4} tokens de définitions.\n")
        for outil in outils:
            description = (outil.description or "").strip().splitlines()[0][:90]
            print(f"- {outil.name} : {description}")


async def main(nom: str, toolset: str | None):
    if nom == "memoire":
        # Transport stdio : le client lance le serveur comme un programme, et lui parle
        # par son entrée et sa sortie standard.
        serveur = StdioServerParameters(command=sys.executable, args=[str(TP / "serveur" / "memoire.py")])
        async with stdio_client(serveur) as (lecture, ecriture):
            await interroger(lecture, ecriture, nom)
    else:
        # Transport HTTP : le serveur tourne ailleurs. On s'identifie avec un jeton, dans un en-tête.
        entetes = {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"}
        if toolset:
            entetes |= {"X-MCP-Toolsets": toolset, "X-MCP-Readonly": "true"}
        async with create_mcp_http_client(headers=entetes) as http:
            async with streamable_http_client(GITHUB, http_client=http) as (lecture, ecriture):
                await interroger(lecture, ecriture, nom)


arguments = sys.argv[1:] + [None, None]
asyncio.run(main(arguments[0] or "memoire", arguments[1]))
