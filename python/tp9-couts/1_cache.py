"""TP 9, étape 1 : le cache de prompt, mesuré sur une conversation.

Quatre questions dans la même session. À chaque appel, le modèle relit tout : son prompt système,
la définition de ses outils, puis toute la conversation. Le cache évite de le payer plein tarif.

Lancement, depuis le dossier du TP :
    python 1_cache.py
"""

import asyncio

from agent import creer_options
from mesures import milliers, poser

QUESTIONS = [
    "Où en est l'OF-2231 ?",
    "Quels arrêts la presse 4 a-t-elle eus cette semaine ?",
    "Et la presse 3 ?",
    "Quels contrôles qualité a-t-on sur l'OF-2231 ?",
]


async def main():
    session, total, total_sans = None, 0.0, 0.0
    print(f"{'question':42} {'appels':>6} {'tokens lus':>11} {'dont cache':>11} {'coût':>10} {'sans cache':>11}")
    for question in QUESTIONS:
        options = creer_options(session)
        options.hooks = {}  # pas de trace d'outils : on ne regarde que les chiffres
        m = await poser(question, options)
        session = m["session"]
        total += m["cout"]
        total_sans += m["cout_sans_cache"]
        part = 100 * m["relus_en_cache"] // m["lus"]
        print(f"{question[:42]:42} {m['appels']:>6} {milliers(m['lus']):>11} {part:>10} % {m['cout']:>8.5f} $ {m['cout_sans_cache']:>9.5f} $")
    print(f"\nLa conversation a coûté {total:.5f} $. Sans cache, elle aurait coûté {total_sans:.5f} $, soit {total_sans / total:.1f} fois plus.")


asyncio.run(main())
