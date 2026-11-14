"""TP 3, pattern 1 : ReAct. Le modèle avance pas à pas : il demande un outil, lit le résultat, décide de la suite.

C'est la boucle du TP 2, rangée dans une fonction pour que les deux autres patterns puissent la réutiliser.

Lancement, depuis le dossier du TP :
    python react.py
"""

import json
import os
from pathlib import Path

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

MODELE = os.environ["MODELE"]
DATA = Path(__file__).resolve().parents[2] / "data"
LIMITE_TOURS = 10

SYSTEME = (
    "Tu es l'assistant d'un atelier de production. "
    "Nous sommes le vendredi 13 mars 2026, il est 11 h. "
    "Réponds en français, en moins de 150 mots, uniquement à partir des données fournies ou renvoyées par les outils."
)
QUESTION = (
    "Fais le bilan de la semaine pour la presse 4 : arrêts, ordres de fabrication et contrôles qualité. "
    "Termine par une recommandation."
)


# ---------- Les outils ----------

def charger(fichier: str) -> list[dict]:
    return json.loads((DATA / fichier).read_text(encoding="utf-8"))


def lister_arrets(machine_id: str) -> list[dict]:
    return [arret for arret in charger("arrets_machine.json") if arret["machine_id"] == machine_id]


def lister_ordres_fabrication(machine_id: str) -> list[dict]:
    return [ordre for ordre in charger("ordres_fabrication.json") if ordre["machine_id"] == machine_id]


def lister_controles_qualite(of_id: str) -> list[dict]:
    return [controle for controle in charger("controles_qualite.json") if controle["of_id"] == of_id]


FONCTIONS = {
    "lister_arrets": lister_arrets,
    "lister_ordres_fabrication": lister_ordres_fabrication,
    "lister_controles_qualite": lister_controles_qualite,
}

MACHINE_ID = {
    "type": "string",
    "description": "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.",
}

OUTILS = [
    {
        "name": "lister_arrets",
        "description": "Liste les arrêts d'une machine sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
        "input_schema": {"type": "object", "properties": {"machine_id": MACHINE_ID}, "required": ["machine_id"]},
    },
    {
        "name": "lister_ordres_fabrication",
        "description": "Liste les ordres de fabrication d'une machine sur la semaine en cours : article, quantités prévue et produite, statut, dates.",
        "input_schema": {"type": "object", "properties": {"machine_id": MACHINE_ID}, "required": ["machine_id"]},
    },
    {
        "name": "lister_controles_qualite",
        "description": "Liste les contrôles qualité d'un ordre de fabrication : taille de l'échantillon, non-conformes, défaut principal, décision.",
        "input_schema": {
            "type": "object",
            "properties": {
                "of_id": {"type": "string", "description": "Identifiant de l'ordre de fabrication, par exemple OF-2231."}
            },
            "required": ["of_id"],
        },
    },
]


# ---------- Appeler le modèle en comptant ce que ça coûte ----------

client = anthropic.Anthropic()


class Compteur:
    """Additionne les appels au modèle et les tokens consommés."""

    def __init__(self) -> None:
        self.appels = 0
        self.entree = 0
        self.sortie = 0

    def ajouter(self, usage) -> None:
        self.appels += 1
        self.entree += usage.input_tokens
        self.sortie += usage.output_tokens

    def __str__(self) -> str:
        return f"{self.appels} appels au modèle, {self.entree} tokens en entrée, {self.sortie} tokens en sortie"


def appeler(compteur: Compteur, session: list, systeme: str = SYSTEME, effort: str | None = None):
    """Un appel au modèle. Les outils sont toujours déclarés, le modèle choisit de s'en servir ou non."""
    options = {}
    if effort:
        options["output_config"] = {"effort": effort}  # niveau de raisonnement : low, medium, high...
    reponse = client.messages.create(
        model=MODELE, max_tokens=4000, system=systeme, tools=OUTILS, messages=session, **options
    )
    compteur.ajouter(reponse.usage)
    return reponse


def texte(reponse) -> str:
    return "".join(bloc.text for bloc in reponse.content if bloc.type == "text").strip()


# ---------- Le pattern ReAct ----------

def boucle_react(session: list, compteur: Compteur, effort: str | None = None, bavard: bool = True) -> str:
    """Fait tourner la boucle sur une session, jusqu'à la réponse du modèle ou la limite de tours."""
    for _ in range(LIMITE_TOURS):
        reponse = appeler(compteur, session, effort=effort)
        session.append({"role": "assistant", "content": reponse.content})

        if reponse.stop_reason != "tool_use":
            return texte(reponse)

        resultats = []
        for bloc in reponse.content:
            if bloc.type == "tool_use":
                if bavard:
                    print(f"  outil : {bloc.name}({bloc.input})")
                sortie = FONCTIONS[bloc.name](**bloc.input)
                resultats.append(
                    {"type": "tool_result", "tool_use_id": bloc.id, "content": json.dumps(sortie, ensure_ascii=False)}
                )
        session.append({"role": "user", "content": resultats})
    return "Limite de tours atteinte."


def executer(bavard: bool = True) -> tuple[str, Compteur]:
    compteur = Compteur()
    session = [{"role": "user", "content": QUESTION}]
    return boucle_react(session, compteur, bavard=bavard), compteur


if __name__ == "__main__":
    reponse, compteur = executer()
    print()
    print(reponse)
    print()
    print(f"ReAct : {compteur}")
