"""TP 9, étape 2 : le cache est un préfixe. Essai direct sur l'API, sans l'Agent SDK.

Le modèle met en cache le DÉBUT de ce qu'on lui envoie, jusqu'à un point qu'on lui désigne.
Tout ce qui change avant ce point annule le cache de ce qui suit.
On envoie trois fois un long contexte stable, avec l'heure placée APRÈS puis AVANT lui.

Lancement, depuis le dossier du TP :
    python 2_cache_prefixe.py
"""

import datetime
import os
import time

import anthropic
from dotenv import find_dotenv, load_dotenv

from agent import TP

load_dotenv(find_dotenv())
client = anthropic.Anthropic()

# Un long contexte stable : le début de l'historique des arrêts.
historique = (TP.parents[1] / "data" / "historique_arrets.json").read_text(encoding="utf-8")[:24000]
STABLE = {
    "type": "text",
    "text": "Tu es l'assistant de l'atelier. Voici l'historique des arrêts :\n" + historique,
    "cache_control": {"type": "ephemeral"},  # « mets en cache tout ce qui précède ce point »
}
QUESTION = "Combien d'arrêts concernent P2 dans cet extrait ? Un nombre seulement."


def heure() -> dict:
    return {"type": "text", "text": f"Heure du serveur : {datetime.datetime.now().strftime('%H:%M:%S.%f')}"}


def appeler(systeme: list) -> str:
    reponse = client.messages.create(model=os.environ["MODELE"], max_tokens=60, system=systeme, messages=[{"role": "user", "content": QUESTION}])
    u = reponse.usage
    return f"lus plein tarif {u.input_tokens:>6} · écrits en cache {u.cache_creation_input_tokens:>6} · relus en cache {u.cache_read_input_tokens:>6}"


print("A. L'heure APRÈS le contexte stable : le début ne change pas")
for essai in range(3):
    print("   ", appeler([STABLE, heure()]))
    time.sleep(1)
print("B. L'heure AVANT le contexte stable : le début change à chaque appel")
for essai in range(3):
    print("   ", appeler([heure(), STABLE]))
    time.sleep(1)
