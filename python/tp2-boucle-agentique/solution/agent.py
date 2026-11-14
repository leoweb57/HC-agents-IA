"""TP 2 : la boucle agentique écrite à la main (solution).

Lancement, depuis le dossier du TP :
    python solution/agent.py
"""

import json
import os
from pathlib import Path

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

MODELE = os.environ["MODELE"]
DATA = Path(__file__).resolve().parents[3] / "data"
LIMITE_TOURS = 10

SYSTEME = (
    "Tu es l'assistant d'un atelier de production. "
    "Nous sommes le vendredi 13 mars 2026, il est 11 h. "
    "Réponds en français, en deux ou trois phrases, uniquement à partir des résultats des outils."
)
QUESTION = "Pourquoi la presse 4 s'est-elle arrêtée ce matin, et où en est l'ordre de fabrication qui était en cours ?"


# ---------- Les deux outils : les fonctions, exécutées par notre code ----------

def lister_arrets(machine_id: str) -> list[dict]:
    arrets = json.loads((DATA / "arrets_machine.json").read_text(encoding="utf-8"))
    return [arret for arret in arrets if arret["machine_id"] == machine_id]


def lire_ordre_fabrication(of_id: str) -> dict:
    ordres = json.loads((DATA / "ordres_fabrication.json").read_text(encoding="utf-8"))
    for ordre in ordres:
        if ordre["id"] == of_id:
            return ordre
    return {"erreur": f"Aucun ordre de fabrication {of_id}."}


FONCTIONS = {"lister_arrets": lister_arrets, "lire_ordre_fabrication": lire_ordre_fabrication}


# ---------- Les deux outils : les descriptions, lues par le modèle ----------

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
    },
    {
        "name": "lire_ordre_fabrication",
        "description": "Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.",
        "input_schema": {
            "type": "object",
            "properties": {
                "of_id": {"type": "string", "description": "Identifiant de l'ordre de fabrication, par exemple OF-2231."}
            },
            "required": ["of_id"],
        },
    },
]


# ---------- La boucle ----------

client = anthropic.Anthropic()

# La session : tout ce qu'on renvoie au modèle à chaque tour (paramètre messages de l'API).
session = [{"role": "user", "content": QUESTION}]

for tour in range(1, LIMITE_TOURS + 1):
    reponse = client.messages.create(
        model=MODELE,
        max_tokens=1000,
        system=SYSTEME,
        tools=OUTILS,
        messages=session,
    )
    print(f"Tour {tour} : {reponse.usage.input_tokens} tokens en entrée")

    # 1. La réponse du modèle rejoint la session.
    session.append({"role": "assistant", "content": reponse.content})

    # 2. Sortie normale : le modèle ne demande plus d'outil.
    if reponse.stop_reason != "tool_use":
        print()
        print("".join(bloc.text for bloc in reponse.content if bloc.type == "text"))
        break

    # 3. Sinon, on exécute chaque outil demandé et on renvoie les résultats.
    resultats = []
    for bloc in reponse.content:
        if bloc.type == "tool_use":
            print(f"  outil demandé : {bloc.name}({bloc.input})")
            sortie = FONCTIONS[bloc.name](**bloc.input)
            resultats.append(
                {
                    "type": "tool_result",
                    "tool_use_id": bloc.id,
                    "content": json.dumps(sortie, ensure_ascii=False),
                }
            )
    session.append({"role": "user", "content": resultats})
else:
    # Sortie de secours : la limite de tours est atteinte.
    print("Limite de tours atteinte, arrêt.")
