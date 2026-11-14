"""TP 2 : la boucle agentique écrite à la main.

Lancement, depuis le dossier du TP :
    python exercice/agent.py
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


# ---------- Les deux outils : les fonctions, exécutées par notre code (déjà écrites) ----------

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


# ---------- Les deux outils : les descriptions, lues par le modèle (déjà écrites) ----------

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


# ---------- La boucle : à vous ----------

client = anthropic.Anthropic()

# La session : tout ce qu'on renvoie au modèle à chaque tour (paramètre messages de l'API).
session = [{"role": "user", "content": QUESTION}]

# À FAIRE : écrire la boucle, limitée à LIMITE_TOURS tours.
#
# À chaque tour :
#   1. Appeler le modèle avec client.messages.create(...)
#      Paramètres : model, max_tokens, system=SYSTEME, tools=OUTILS, messages=session
#
#   2. Ajouter la réponse du modèle à la session :
#      {"role": "assistant", "content": reponse.content}
#
#   3. Si reponse.stop_reason n'est pas "tool_use" : afficher le texte et sortir de la boucle.
#
#   4. Sinon, pour chaque bloc de reponse.content dont le type est "tool_use" :
#        - exécuter la fonction : FONCTIONS[bloc.name](**bloc.input)
#        - préparer un résultat :
#          {"type": "tool_result", "tool_use_id": bloc.id, "content": json.dumps(sortie, ensure_ascii=False)}
#      puis ajouter tous les résultats à la session, dans un seul message :
#      {"role": "user", "content": [les résultats]}
#
# Conseil : affichez le numéro du tour et l'outil demandé, pour voir la boucle travailler.
