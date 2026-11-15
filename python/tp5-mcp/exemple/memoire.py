"""Mémoire : le serveur MCP du cours, pour l'exemple. Fourni, à lire.

Il propose deux outils : écrire une note, et relire les notes.
Les notes sont gardées dans le fichier memoire.json du TP.

C'est un programme à part, qui ne sait rien de votre agent. C'est le client qui le lance
quand il s'y connecte (transport stdio). Pour voir ce qu'il annonce :
    python exercice/decouvrir.py exemple/memoire.py
"""

import json
from pathlib import Path

from mcp.server.mcpserver import MCPServer

MEMOIRE = Path(__file__).resolve().parents[1] / "memoire.json"

# 1. On crée le serveur, avec la bibliothèque officielle du protocole. Son nom est celui que les clients verront.
serveur = MCPServer("memoire")


def lire_notes() -> list[dict]:
    return json.loads(MEMOIRE.read_text(encoding="utf-8")) if MEMOIRE.exists() else []


# 2. On déclare ses outils. Le nom de la fonction devient le nom de l'outil, son commentaire
#    devient la description, ses paramètres typés deviennent le schéma d'entrée,
#    et un type de retour précis (list[dict], par exemple) devient le schéma de sortie.
@serveur.tool()
def memoriser(auteur: str, note: str) -> dict:
    """Enregistre une note dans la mémoire : une consigne, une habitude, une décision à retenir.

    auteur : le prénom de la personne qui demande de retenir la note.
    note : la note, en une phrase complète et compréhensible hors contexte.
    """
    notes = lire_notes()
    notes.append({"auteur": auteur, "note": note})
    MEMOIRE.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"enregistre": True, "nombre_de_notes": len(notes)}


@serveur.tool()
def lire_memoire(recherche: str = "") -> list[dict]:
    """Relit les notes de la mémoire. Sans recherche, renvoie toutes les notes.

    recherche : un mot à chercher dans les notes, par exemple « presse 4 ». Laisser vide pour tout lire.
    """
    return [note for note in lire_notes() if recherche.strip().lower() in note["note"].lower()]


# 3. On lance le serveur. Transport par défaut : stdio, c'est-à-dire l'entrée et la sortie standard.
if __name__ == "__main__":
    serveur.run()
