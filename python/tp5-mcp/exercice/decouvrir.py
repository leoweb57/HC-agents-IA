"""TP 5 : interroger un serveur MCP, sans agent ni modèle. Fourni.

Ce programme est un client MCP minimal. Il lance le serveur (transport stdio), fait la poignée
de main, lui demande la liste de ses outils, et peut en appeler un.

Lancement, depuis le dossier du TP :
    python exercice/decouvrir.py exemple/memoire.py                              ce que le serveur annonce
    python exercice/decouvrir.py exercice/serveur_atelier.py                     votre serveur
    python exercice/decouvrir.py exercice/serveur_atelier.py lister_arrets machine_id=P4    appeler un outil
"""

import asyncio
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main(fichier: str, outil: str | None, parametres: dict[str, str]):
    # Transport stdio : le client lance le serveur comme un programme,
    # et lui parle par son entrée et sa sortie standard.
    serveur = StdioServerParameters(command=sys.executable, args=[fichier])
    async with stdio_client(serveur) as (lecture, ecriture):
        async with ClientSession(lecture, ecriture) as session:
            poignee = await session.initialize()  # la demande « initialize »
            print(f"Serveur « {poignee.server_info.name} », protocole {poignee.protocol_version}\n")

            outils = (await session.list_tools()).tools  # la demande « tools/list »
            for o in outils:
                print(f"- {o.name} : {(o.description or '').strip().splitlines()[0]}")
                print(f"    entrée : {list(o.input_schema.get('properties', {}))}")
                print(f"    sortie : {'un schéma est déclaré' if o.output_schema else 'pas de schéma'}")

            if outil:
                reponse = await session.call_tool(outil, parametres)  # la demande « tools/call »
                print(f"\nRésultat de {outil}({parametres}){' : ERREUR' if reponse.is_error else ''}")
                for contenu in reponse.content:
                    print(f"  [{contenu.type}] {getattr(contenu, 'text', '')}")


if len(sys.argv) < 2:
    sys.exit("Indiquez le fichier du serveur, par exemple : python exercice/decouvrir.py exemple/memoire.py")
try:
    asyncio.run(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None, dict(a.split("=", 1) for a in sys.argv[3:])))
except Exception:
    sys.exit("Le serveur n'a pas répondu. Est-il créé, et lancé à la fin du fichier ? Son erreur éventuelle est affichée au-dessus.")
