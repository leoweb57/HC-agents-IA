"""TP 1, étape 1 : un premier appel à l'API Messages (solution).

Lancement, depuis le dossier du TP :
    python solution/appel.py
"""

import os

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

MODELE = os.environ["MODELE"]
PROMPT = "Explique en deux phrases ce qu'est un MES (Manufacturing Execution System)."

# Le client lit ANTHROPIC_API_KEY dans l'environnement.
client = anthropic.Anthropic()

reponse = client.messages.create(
    model=MODELE,
    max_tokens=300,
    messages=[{"role": "user", "content": PROMPT}],
)

# content est une liste de blocs : on garde ceux qui portent du texte.
texte = "".join(bloc.text for bloc in reponse.content if bloc.type == "text")

print(texte)
print()
print(f"Modèle : {reponse.model}")
print(f"Tokens en entrée : {reponse.usage.input_tokens}")
print(f"Tokens en sortie : {reponse.usage.output_tokens}")
