"""Énigme 2, corrigée : la réponse était juste, mais pas la facture.

Lancement, depuis le dossier du TP :
    python enigmes/enigme2_solution.py

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


def lister_arrets(machine_id: str, depuis: str) -> list[dict]:
    historique = json.loads((DATA / "historique_arrets.json").read_text(encoding="utf-8"))
    # CORRECTION 1 : le tri se fait ici, dans le code, pas dans le modèle.
    # Avant, la fonction ignorait machine_id et renvoyait les 512 arrêts de l'historique :
    # près de 50 000 tokens, relus et facturés à chaque tour suivant.
    # On filtre maintenant sur la machine et sur la période.
    arrets = [arret for arret in historique if arret["machine_id"] == machine_id and arret["debut"][:10] >= depuis]
    # CORRECTION 2 : on ne renvoie que les champs utiles à la réponse.
    champs = ("debut", "duree_min", "categorie", "cause", "of_id")
    return [{champ: arret[champ] for champ in champs} for arret in arrets]


FONCTIONS = {"lister_arrets": lister_arrets}

OUTILS = [
    {
        "name": "lister_arrets",
        "description": "Liste les arrêts d'une machine de l'atelier à partir d'une date : date, durée, cause et ordre de fabrication concerné.",
        "input_schema": {
            "type": "object",
            "properties": {
                "machine_id": {
                    "type": "string",
                    "description": "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.",
                },
                # CORRECTION 3 : un paramètre de période, pour que le modèle demande seulement ce qu'il lui faut.
                "depuis": {
                    "type": "string",
                    "description": "Date de début de la période, au format AAAA-MM-JJ. Seuls les arrêts à partir de cette date sont renvoyés.",
                },
            },
            "required": ["machine_id", "depuis"],
        },
    }
]

client = anthropic.Anthropic()
question = " ".join(sys.argv[1:]) or input("Votre question : ")
session = [{"role": "user", "content": question}]
total_entree = 0

for tour in range(1, LIMITE_TOURS + 1):
    reponse = client.messages.create(model=MODELE, max_tokens=1000, system=SYSTEME, tools=OUTILS, messages=session)
    total_entree += reponse.usage.input_tokens
    print(f"Tour {tour} : {reponse.usage.input_tokens} tokens en entrée")
    session.append({"role": "assistant", "content": reponse.content})

    if reponse.stop_reason != "tool_use":
        print()
        print("".join(bloc.text for bloc in reponse.content if bloc.type == "text"))
        print()
        print(f"Total : {total_entree} tokens en entrée")
        break

    resultats = []
    for bloc in reponse.content:
        if bloc.type == "tool_use":
            sortie = FONCTIONS[bloc.name](**bloc.input)
            print(f"  outil demandé : {bloc.name}({bloc.input})")
            resultats.append(
                {"type": "tool_result", "tool_use_id": bloc.id, "content": json.dumps(sortie, ensure_ascii=False)}
            )
    session.append({"role": "user", "content": resultats})
