"""Énigme 3, corrigée : l'agent tournait en rond.

Lancement, depuis le dossier du TP :
    python enigmes/enigme3_solution.py

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

# CORRECTION 3 : une vraie limite de tours remplace le "while True".
# La boucle a désormais deux sorties : la réponse du modèle, ou la limite.
for tour in range(1, LIMITE_TOURS + 1):
    reponse = client.messages.create(model=MODELE, max_tokens=1000, system=SYSTEME, tools=OUTILS, messages=session)

    # CORRECTION 1 : la réponse du modèle est ajoutée à la session.
    # Avant, rien n'y était ajouté : à chaque tour, le modèle recevait la question seule,
    # sans trace de sa demande précédente, et refaisait donc la même.
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

    # CORRECTION 2 : le résultat de l'outil est ajouté à la session.
    # C'est notre code qui le fait, l'API ne s'en charge pas.
    # Le modèle n'a aucune mémoire : ce qui n'est pas dans la session n'a jamais eu lieu.
    session.append({"role": "user", "content": resultats})
else:
    print("Limite de tours atteinte, arrêt.")
