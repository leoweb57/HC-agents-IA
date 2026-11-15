"""TP 11, étape 1 : publier les prompts et le jeu de questions dans Langfuse.

Lancement, depuis le dossier du TP :
    python publier.py

À faire une fois. Sans Langfuse, on peut sauter cette étape : l'évaluation lira les fichiers du dépôt.
"""

import os
import sys

from jeu import publier_jeu
from prompts import langfuse, publier_prompt

if not os.environ.get("LANGFUSE_PUBLIC_KEY"):
    sys.exit("Langfuse n'est pas configuré : pas de LANGFUSE_PUBLIC_KEY dans le fichier .env. Rien à publier.")

print("Publication dans Langfuse :")
publier_prompt("v1", "Le prompt des jours 1 et 2.", en_production=True)
publier_prompt("v2", "Réponses en une phrase, pour la lecture sur téléphone.")
publier_jeu()
langfuse.flush()
print("À voir dans Langfuse : Prompts > agent-atelier, et Datasets > atelier-questions.")
