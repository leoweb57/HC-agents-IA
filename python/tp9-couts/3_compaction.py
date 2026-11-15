"""TP 9, étape 3 : la compaction. Résumer la conversation pour libérer le contexte.

Cinq questions dans une session, puis une dernière qui a besoin du début de la conversation.
    python 3_compaction.py sans      on laisse le contexte grossir
    python 3_compaction.py avec      on compacte avant la dernière question

Le SDK compacte tout seul quand le contexte approche de sa limite. Ici on le déclenche à la main,
en envoyant « /compact » comme un message, pour voir ce que ça change et ce que ça coûte.
"""

import asyncio
import sys
import time

from claude_agent_sdk import SystemMessage, query

from agent import creer_options
from mesures import milliers, pluriel, poser

QUESTIONS = [
    "Où en est l'OF-2231 ?",
    "Diagnostique l'arrêt de ce matin sur la presse 4.",
    "Quels arrêts la presse 3 a-t-elle eus cette semaine ?",
    "Quels contrôles qualité a-t-on sur l'OF-2231 ?",
    "La presse 4 a-t-elle souvent des défauts d'éjection ?",
]
DERNIERE = "Rappelle-moi en une phrase l'avancement de l'OF-2231 et le nombre de non-conformes de son dernier contrôle."


def options(session):
    o = creer_options(session)
    o.hooks = {}
    return o


async def compacter(session: str) -> None:
    debut = time.monotonic()
    async for message in query(prompt="/compact", options=options(session)):
        # Le SDK signale la compaction par un message système, avec la taille avant et après.
        if isinstance(message, SystemMessage) and message.subtype == "compact_boundary":
            c = message.data["compact_metadata"]
            print(f"/compact : la conversation passe de {milliers(c['pre_tokens'])} à {milliers(c['post_tokens'])} tokens, en {time.monotonic() - debut:.1f} s")


async def main():
    avec = len(sys.argv) > 1 and sys.argv[1] == "avec"
    session = None
    for question in QUESTIONS:
        m = await poser(question, options(session))
        session = m["session"]
        print(f"{question[:52]:52} {pluriel(m['appels'], 'appel')} · dernier appel {milliers(m['tokens_par_appel'][-1]):>6} tokens lus")
    if avec:
        await compacter(session)
    m = await poser(DERNIERE, options(session))
    print(f"\n{DERNIERE}\n→ {m['reponse']}")
    print(f"\n{pluriel(m['appels'], 'appel')} · {milliers(m['tokens_par_appel'][-1])} tokens lus au dernier appel · outils rappelés : {m['outils'] or 'aucun'}")
    print(f"Coût de toute la session : {m['cout_session']:.5f} $")


asyncio.run(main())
