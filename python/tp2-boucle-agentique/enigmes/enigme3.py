"""Énigme 3 : l'agent tourne en rond.

Lancement, depuis le dossier du TP :
    python enigmes/enigme3.py

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
ARRET_DE_SECURITE = 8  # ne pas toucher : protège vos crédits pendant l'énigme

SYSTEME = (
    "Tu es l'assistant d'un atelier de production. "
    "Nous sommes le vendredi 13 mars 2026, il est 11 h. "
    "Réponds en français, en deux ou trois phrases, uniquement à partir des résultats des outils."
)


def lister_arrets(machine_id: str) -> list[dict]:
    arrets = json.loads((DATA / "arrets_machine.json").read_text(encoding="utf-8"))
    return [arret for arret in arrets if arret["machine_id"] == machine_id]


FONCTIONS = {"lister_arrets": lister_arrets}

OUTILS = [
    {
        "name": "lister_arrets",
        "description": "Liste les arrêts d'une machine de l'atelier sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
        "input_schema": {
            "type": "object",
            "properties": {
                "machine_id": {
                    "type": "string",
                    "description": "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.",
                }
            },
            "required": ["machine_id"],
        },
    }
]

client = anthropic.Anthropic()
question = " ".join(sys.argv[1:]) or input("Votre question : ")
session = [{"role": "user", "content": question}]
tour = 0

while True:
    tour += 1
    if tour > ARRET_DE_SECURITE:
        print(f"Arrêt de sécurité après {ARRET_DE_SECURITE} tours.")
        break

    reponse = client.messages.create(model=MODELE, max_tokens=1000, system=SYSTEME, tools=OUTILS, messages=session)

    if reponse.stop_reason != "tool_use":
        print()
        print("".join(bloc.text for bloc in reponse.content if bloc.type == "text"))
        break

    for bloc in reponse.content:
        if bloc.type == "tool_use":
            sortie = FONCTIONS[bloc.name](**bloc.input)
            print(f"Tour {tour} : {bloc.name}({bloc.input}) -> {len(sortie)} arrêt(s)")
