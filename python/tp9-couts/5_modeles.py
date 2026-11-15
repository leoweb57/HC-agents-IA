"""TP 9, étape 5 : le modèle et le niveau d'effort. Même agent, même question, autre réglage.

    python 5_modeles.py                         le modèle du fichier .env, effort par défaut
    python 5_modeles.py claude-sonnet-5-5       un autre modèle
    python 5_modeles.py claude-haiku-5-5 low    un niveau d'effort : low, medium, high

Attention au prix : un modèle plus grand coûte de vingt à cinquante fois plus cher sur cette question.
Le coût affiché est celui que calcule le SDK, avec le tarif du modèle choisi.
"""

import asyncio
import sys

from agent import MODELE, creer_options
from mesures import milliers, pluriel, poser

QUESTION = "Diagnostique l'arrêt de ce matin sur la presse 4."


async def main():
    options = creer_options()
    options.hooks = {}
    options.model = sys.argv[1] if len(sys.argv) > 1 else MODELE
    if len(sys.argv) > 2:
        options.effort = sys.argv[2]
    m = await poser(QUESTION, options)
    print(f"{options.model}, effort {options.effort or 'par défaut'}\n\n{m['reponse']}\n")
    print(f"{pluriel(m['appels'], 'appel')} au modèle · {milliers(m['lus'])} tokens lus · {milliers(m['sortie'])} tokens produits · {m['duree']:.1f} s · {m['cout_session']:.4f} $")


asyncio.run(main())
