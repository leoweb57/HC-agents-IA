"""TP 12 : lire les retours des utilisateurs. Fourni.

Le terminal (terminal.py) note chaque avis deux fois : un score sur la trace dans Langfuse, et une ligne
dans retours.jsonl. On lit ici le fichier : tout le TP marche donc aussi sans Langfuse.
Si vous n'avez pas encore donné d'avis, on lit les trois retours d'exemple.
"""

import json
from pathlib import Path

TP = Path(__file__).resolve().parent
FICHIER = TP / "retours.jsonl" if (TP / "retours.jsonl").exists() else TP / "retours_exemple.jsonl"


def lire_retours() -> list[dict]:
    return [json.loads(ligne) for ligne in FICHIER.read_text(encoding="utf-8").splitlines() if ligne.strip()]
