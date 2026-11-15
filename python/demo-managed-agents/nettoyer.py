"""Démonstration Managed Agents, étape 3 : supprimer ce qu'on a créé.

Sur la plateforme, rien ne disparaît tout seul : les sessions (avec tout leur historique),
les fichiers et l'agent restent chez Anthropic jusqu'à ce qu'on les supprime.

Lancement, depuis le dossier de la démonstration :
    python nettoyer.py
"""

import json
import sys
from pathlib import Path

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

IDENTIFIANTS = Path(__file__).resolve().parent / "identifiants.json"
if not IDENTIFIANTS.exists():
    sys.exit("Rien à nettoyer : identifiants.json n'existe pas.")
ids = json.loads(IDENTIFIANTS.read_text(encoding="utf-8"))

client = anthropic.Anthropic()


def essayer(quoi: str, action, *arguments) -> None:
    """Une suppression qui échoue ne doit pas empêcher les suivantes."""
    try:
        action(*arguments)
        print(f"{quoi} : fait")
    except anthropic.APIError as erreur:
        print(f"{quoi} : {erreur}")


for session_id in ids["sessions"]:
    essayer(f"Session {session_id} supprimée", client.beta.sessions.delete, session_id)
for nom, identifiant in ids["fichiers"].items():
    essayer(f"Fichier {nom} supprimé", client.beta.files.delete, identifiant)
# Un agent ne se supprime pas : il s'archive. Il reste lisible, mais on ne peut plus ouvrir de session avec lui.
essayer("Agent archivé", client.beta.agents.archive, ids["agent_id"])
essayer("Environnement supprimé", client.beta.environments.delete, ids["environment_id"])

IDENTIFIANTS.unlink()
