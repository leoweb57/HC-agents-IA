"""Un serveur MCP écrit par nous : la mémoire commune de l'atelier.

Il expose deux outils : écrire une note, et relire les notes.
Les notes sont gardées dans le fichier memoire.json du TP. Elles survivent à la conversation :
tout agent qui se branche sur ce serveur les retrouve.

C'est un programme à part, qui ne sait rien de votre agent. Il se lance tout seul quand un client
s'y connecte. Pour le lancer à la main (il attend alors des messages sur son entrée standard) :
    python serveur/memoire.py
"""

import json
from datetime import datetime
from pathlib import Path

from mcp.server.mcpserver import MCPServer

MEMOIRE = Path(__file__).resolve().parents[1] / "memoire.json"

# 1. On crée le serveur. Son nom est celui que les clients verront.
serveur = MCPServer("memoire")


def lire_notes() -> list[dict]:
    return json.loads(MEMOIRE.read_text(encoding="utf-8")) if MEMOIRE.exists() else []


# 2. On déclare ses outils. Le nom de la fonction devient le nom de l'outil, son commentaire
#    devient la description, et ses paramètres typés deviennent le schéma : comme hier avec @tool.
@serveur.tool()
def memoriser(auteur: str, note: str) -> dict:
    """Enregistre une note dans la mémoire commune de l'atelier : une consigne, une habitude, une décision à retenir.

    auteur : le prénom de la personne qui demande de retenir la note.
    note : la note, en une phrase complète et compréhensible hors contexte.
    """
    notes = lire_notes()
    notes.append({"date": datetime.now().strftime("%Y-%m-%d %H:%M"), "auteur": auteur, "note": note})
    MEMOIRE.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"enregistre": True, "nombre_de_notes": len(notes)}


@serveur.tool()
def lire_memoire(recherche: str = "") -> list[dict]:
    """Relit les notes de la mémoire commune de l'atelier. Sans recherche, renvoie toutes les notes.

    recherche : un mot à chercher dans les notes, par exemple « presse 4 ». Laisser vide pour tout lire.
    """
    return [note for note in lire_notes() if recherche.strip().lower() in note["note"].lower()]


# 3. On lance le serveur. Transport par défaut : stdio, c'est-à-dire l'entrée et la sortie standard.
if __name__ == "__main__":
    serveur.run()
