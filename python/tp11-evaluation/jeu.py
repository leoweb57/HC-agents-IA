"""TP 11 : le jeu de questions, c'est-à-dire le dataset. Fourni.

Un cas = une question, les points qu'une bonne réponse doit contenir, et ce qu'on attend du trajet
(les outils à appeler, l'action à demander ou non). Les cas sont écrits et relus par quelqu'un du métier.

Le fichier jeu_de_questions.json est la source. publier_jeu() le copie dans un dataset Langfuse :
chaque évaluation y devient alors un « run » qu'on compare aux précédents, cas par cas.
"""

import json
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from langfuse import get_client

load_dotenv(find_dotenv())  # les clés Langfuse sont dans le fichier .env, à la racine du dépôt
NOM = "atelier-questions"
FICHIER = Path(__file__).resolve().parent / "jeu_de_questions.json"
langfuse = get_client()


def cas_locaux() -> list[dict]:
    """Les cas du fichier, au format que Langfuse attend : input, expected_output, metadata."""
    return [
        {
            "input": cas["question"],
            "expected_output": {"points": cas["points_attendus"]},
            "metadata": {
                "id": cas["id"],
                "outils": cas["outils_attendus"],
                "action": cas.get("action_attendue"),
                "format": cas.get("format"),
                "source": cas.get("source", "métier"),
            },
        }
        for cas in json.loads(FICHIER.read_text(encoding="utf-8"))
    ]


def lire_jeu() -> list:
    """Les cas du dataset Langfuse s'il existe (l'évaluation y sera rattachée), sinon ceux du fichier."""
    try:
        cas = langfuse.get_dataset(NOM).items
        if cas:
            return cas
    except Exception:
        pass
    return cas_locaux()


def publier_jeu() -> None:
    """Copie le fichier dans le dataset Langfuse. Un cas déjà présent est mis à jour, pas dupliqué."""
    langfuse.create_dataset(name=NOM, description="Questions de chefs d'équipe à l'agent d'atelier, avec les points attendus.")
    for cas in cas_locaux():
        langfuse.create_dataset_item(dataset_name=NOM, id=f"{NOM}-{cas['metadata']['id']}", input=cas["input"], expected_output=cas["expected_output"], metadata=cas["metadata"])
    print(f"  dataset « {NOM} » : {len(cas_locaux())} cas")


def lire(cas, champ: str):
    """Un cas est un dictionnaire (fichier) ou un objet (Langfuse) : on lit ses champs de la même façon."""
    return cas[champ] if isinstance(cas, dict) else getattr(cas, champ)
