"""TP 1, étape 2 : envoyer cinq fois le même prompt et comparer (solution).

Lancement, depuis le dossier du TP :
    python solution/variabilite.py
"""

import os

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

MODELE = os.environ["MODELE"]
NOMBRE_ESSAIS = 5

PROMPT_OUVERT = "Propose un nom pour un agent IA qui suit la production d'un atelier. Réponds par le nom seul."
PROMPT_ATELIER = "Pourquoi la presse 4 s'est-elle arrêtée ce matin ? Réponds en une phrase."

client = anthropic.Anthropic()


def demander(prompt: str) -> str:
    """Envoie un prompt et renvoie le texte de la réponse."""
    reponse = client.messages.create(
        model=MODELE,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
        # Pour aller plus loin : ajouter temperature=0 ou temperature=1 ici.
    )
    return "".join(bloc.text for bloc in reponse.content if bloc.type == "text").strip()


for prompt in (PROMPT_OUVERT, PROMPT_ATELIER):
    print(f"Prompt : {prompt}")
    for numero in range(1, NOMBRE_ESSAIS + 1):
        print(f"  Essai {numero} : {demander(prompt)}")
    print()
