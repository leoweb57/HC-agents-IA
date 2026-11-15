"""TP 9, étape 4 : la recherche d'outils. Soixante outils de plus, sans les payer à chaque appel.

On branche sur l'agent un second serveur MCP, « usine », qui apporte 60 outils.
    python 4_recherche_outils.py sans     toutes les définitions d'outils sont envoyées à chaque appel
    python 4_recherche_outils.py avec     le modèle ne voit que leurs noms, et cherche ceux dont il a besoin

Ce qui active la recherche : l'outil intégré ToolSearch, à ajouter à la liste des outils intégrés.
Notre agent ne l'avait pas : c'est pour cela qu'on ne l'a jamais vue au jour 2.
"""

import asyncio
import sys

from agent import TP, creer_options
from mesures import milliers, pluriel, poser

QUESTIONS = ["Où en est l'OF-2231 ?", "Quelle est la pression hydraulique de la presse 3 aujourd'hui ?"]


async def main():
    avec = len(sys.argv) > 1 and sys.argv[1] == "avec"
    for question in QUESTIONS:
        options = creer_options()
        options.hooks = {}
        options.mcp_servers["usine"] = {"command": sys.executable, "args": [str(TP / "serveur_usine.py")]}
        options.allowed_tools.append("mcp__usine__*")  # tout le serveur, en lecture
        if avec:
            options.tools.append("ToolSearch")
        else:
            options.env = {"ENABLE_TOOL_SEARCH": "false"}
        m = await poser(question, options)
        print(f"\n{question}\n→ {m['reponse'][:160]}")
        print(f"  outils appelés : {m['outils']}")
        print(f"  {pluriel(m['appels'], 'appel')} · tokens lus par appel : {[milliers(n) for n in m['tokens_par_appel']]} · total {milliers(m['lus'])} · {m['duree']:.1f} s")


asyncio.run(main())
