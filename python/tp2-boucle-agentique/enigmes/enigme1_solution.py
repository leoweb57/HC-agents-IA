"""Énigme 1, corrigée : l'agent ne trouvait aucun arrêt.

Lancement, depuis le dossier du TP :
    python enigmes/enigme1_solution.py

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


MACHINES = ["P1", "P2", "P3", "P4", "A1", "C1"]


def lister_arrets(machine_id: str) -> list[dict] | dict:
    # CORRECTION 2 : un identifiant inconnu renvoie une erreur explicite, avec les valeurs acceptées,
    # au lieu d'une liste vide. Une liste vide voulait dire « aucun arrêt » : le modèle la croyait.
    # Avec ce message, il peut se corriger tout seul au tour suivant.
    if machine_id not in MACHINES:
        return {"erreur": f"Machine inconnue : {machine_id}. Identifiants valides : {', '.join(MACHINES)}."}
    arrets = json.loads((DATA / "arrets_machine.json").read_text(encoding="utf-8"))
    return [arret for arret in arrets if arret["machine_id"] == machine_id]


FONCTIONS = {"lister_arrets": lister_arrets}

# CORRECTION 1 : la description. Le modèle ne lit jamais la fonction, seulement ce texte.
# Avant : "Arrêts." et "La machine." Il envoyait donc "presse 4", que le code ne connaît pas.
# Maintenant, la description dit ce que l'outil renvoie, et le paramètre donne son format exact.
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
            print(f"Tour {tour} : {bloc.name}({bloc.input})")
            resultats.append(
                {"type": "tool_result", "tool_use_id": bloc.id, "content": json.dumps(sortie, ensure_ascii=False)}
            )
    session.append({"role": "user", "content": resultats})
