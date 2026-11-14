"""Énigme 1 : l'agent ne trouve aucun arrêt.

Lancement, depuis le dossier du TP :
    python enigmes/enigme1.py

Question à poser : Quels arrêts a eus la presse 4 cette semaine ?
"""

import json
import os
import sys
from pathlib import Path

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

MODELE = os.environ["MODELE"]
DATA = Path(__file__).resolve().parents[3] / "data"
LIMITE_TOURS = 10

SYSTEME = (
    "Tu es l'assistant d'un atelier de production. "
    "Nous sommes le vendredi 13 mars 2026, il est 11 h. "
    "Réponds en français, en deux ou trois phrases, uniquement à partir des résultats des outils."
)


def lister_arrets(machine: str) -> list[dict]:
    arrets = json.loads((DATA / "arrets_machine.json").read_text(encoding="utf-8"))
    return [arret for arret in arrets if arret["machine_id"] == machine]


FONCTIONS = {"lister_arrets": lister_arrets}

OUTILS = [
    {
        "name": "lister_arrets",
        "description": "Arrêts.",
        "input_schema": {
            "type": "object",
            "properties": {"machine": {"type": "string", "description": "La machine."}},
            "required": ["machine"],
        },
    }
]

client = anthropic.Anthropic()
question = " ".join(sys.argv[1:]) or input("Votre question : ")
session = [{"role": "user", "content": question}]

for tour in range(1, LIMITE_TOURS + 1):
    reponse = client.messages.create(model=MODELE, max_tokens=1000, system=SYSTEME, tools=OUTILS, messages=session)
    session.append({"role": "assistant", "content": reponse.content})

    if reponse.stop_reason != "tool_use":
        print()
        print("".join(bloc.text for bloc in reponse.content if bloc.type == "text"))
        break

    resultats = []
    for bloc in reponse.content:
        if bloc.type == "tool_use":
            sortie = FONCTIONS[bloc.name](**bloc.input)
            print(f"Tour {tour} : {bloc.name}({bloc.input}) -> {len(sortie)} arrêt(s)")
            resultats.append(
                {"type": "tool_result", "tool_use_id": bloc.id, "content": json.dumps(sortie, ensure_ascii=False)}
            )
    session.append({"role": "user", "content": resultats})
