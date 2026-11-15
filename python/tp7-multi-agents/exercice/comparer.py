"""TP 7 : poser les mêmes questions aux deux agents, et comparer. Fourni.

Lancement, depuis le dossier du TP :
    python exercice/comparer.py         les trois questions
    python exercice/comparer.py 2       seulement la question 2

Chaque question part d'une conversation neuve, d'abord avec l'agent v1, puis avec l'agent v2.
"""

import asyncio
import sys

from claude_agent_sdk import query

import agent_v1
import agent_v2
from mesures import Mesure, milliers

QUESTIONS = [
    "Où en est l'OF-2231 ?",
    "Diagnostique l'arrêt de ce matin sur la presse 4.",
    "Fais le point sur l'OF-2231 : avancement, arrêts, qualité, et ce que tu recommandes.",
]


async def poser(creer_options, question: str) -> Mesure:
    """Pose une question dans une conversation neuve, et renvoie la mesure."""
    mesure = Mesure()
    async for message in query(prompt=question, options=creer_options()):
        mesure.voir(message)
    return mesure


async def main():
    choix = [int(arg) for arg in sys.argv[1:]] or range(1, len(QUESTIONS) + 1)
    resultats = []
    for numero in choix:
        question = QUESTIONS[numero - 1]
        print(f"\n{'=' * 100}\nQuestion {numero} : {question}")
        mesures = {}
        for version, agent in (("v1", agent_v1), ("v2", agent_v2)):
            print(f"\n--- Agent {version}")
            mesures[version] = await poser(agent.creer_options, question)
            print(f"\n{mesures[version].reponse}")
        resultats.append((numero, question, mesures))

    print(f"\n{'=' * 100}\nRécapitulatif\n")
    print(f"{'':<8}{'appels au modèle':>18}{'outils':>9}{'tokens lus':>13}{'durée':>10}{'coût':>12}")
    for numero, question, mesures in resultats:
        print(f"\n{numero}. {question}")
        for version, m in mesures.items():
            print(
                f"{'   ' + version:<8}{m.appels:>18}{m.outils:>9}{milliers(m.tokens_lus):>13}"
                f"{m.duree:>8.1f} s{m.cout:>10.4f} $"
            )
            if len(m.agents) > 1:
                print(f"        {m.detail()}")


asyncio.run(main())
