"""TP 1, étape 3 : envoyer cinq fois le même prompt et comparer (solution).

Lancement, depuis le dossier python/ :
    python tp1-premiers-appels/solution/variabilite.py
    python tp1-premiers-appels/solution/variabilite.py --temperature 0
"""

import argparse
import os

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

MODELE = os.environ.get("MODELE") or "claude-haiku-5-5"
NOMBRE_ESSAIS = 5

PROMPT_OUVERT = "Propose un nom pour un agent IA qui suit la production d'un atelier. Réponds par le nom seul."
PROMPT_ATELIER = "Pourquoi la presse 4 s'est-elle arrêtée ce matin ? Réponds en une phrase."

client = anthropic.Anthropic()


def demander(prompt: str, temperature: float | None = None) -> str:
    """Envoie un prompt et renvoie le texte de la réponse."""
    options = {}
    if temperature is not None:
        options["temperature"] = temperature
    reponse = client.messages.create(
        model=MODELE,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
        **options,
    )
    return "".join(bloc.text for bloc in reponse.content if bloc.type == "text").strip()


def comparer(titre: str, prompt: str, temperature: float | None) -> None:
    print(f"=== {titre} ===")
    print(f"Prompt : {prompt}")
    reponses = []
    for numero in range(1, NOMBRE_ESSAIS + 1):
        texte = demander(prompt, temperature)
        reponses.append(texte)
        print(f"  Essai {numero} : {texte}")
    print(f"  Réponses distinctes : {len(set(reponses))} sur {NOMBRE_ESSAIS}")
    print()


def main() -> None:
    analyseur = argparse.ArgumentParser(description="Rejoue le même prompt plusieurs fois.")
    analyseur.add_argument("--temperature", type=float, default=None, help="Entre 0 et 1. Absent : valeur par défaut de l'API.")
    arguments = analyseur.parse_args()

    try:
        comparer("Prompt ouvert", PROMPT_OUVERT, arguments.temperature)
        comparer("Question sur l'atelier", PROMPT_ATELIER, arguments.temperature)
    except anthropic.BadRequestError as erreur:
        # Par exemple : paramètre temperature refusé pour ce modèle.
        print(f"L'API a refusé la requête : {erreur.message}")


if __name__ == "__main__":
    main()
