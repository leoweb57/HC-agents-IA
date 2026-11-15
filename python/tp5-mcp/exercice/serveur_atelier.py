"""TP 5 : le serveur MCP « atelier » (à écrire).

Vous sortez de l'agent ses deux outils de lecture, pour en faire un serveur MCP :
un programme à part, que n'importe quel agent pourra utiliser.
Le modèle à suivre est exemple/memoire.py. Cherchez « À ÉCRIRE ».

Pour tester votre serveur, sans agent ni modèle, depuis le dossier du TP :
    python exercice/decouvrir.py exercice/serveur_atelier.py
    python exercice/decouvrir.py exercice/serveur_atelier.py lister_arrets machine_id=P4
"""

import json
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

DATA = Path(__file__).resolve().parents[3] / "data"


def charger(fichier: str) -> list[dict]:
    return json.loads((DATA / fichier).read_text(encoding="utf-8"))


# Étape 1. Créer le serveur, avec le nom « atelier ».
# À ÉCRIRE


# Étape 2. Déclarer les deux outils de lecture de l'agent : lister_arrets et lire_ordre_fabrication.
#   Reprenez leur code dans exercice/agent.py. Ce qui change :
#   - le décorateur est celui du serveur, sans argument ;
#   - la description est le commentaire de la fonction, paramètres compris ;
#   - les paramètres sont ceux de la fonction, typés : machine_id: str ;
#   - la fonction renvoie directement les données (list[dict] ou dict), sans passer par resultat() ;
#   - pour un ordre de fabrication introuvable, levez une erreur : raise ToolError("...").
# À ÉCRIRE


# Bonus. Deux outils de plus, dont les agents de l'après-midi auront besoin :
#   - lister_controles_qualite(of_id) : les contrôles d'un ordre de fabrication (fichier controles_qualite.json) ;
#   - historique_arrets(machine_id, depuis) : les arrêts passés d'une machine (fichier historique_arrets.json).
#     Ce fichier est long : ne renvoyez que les champs utiles, et seulement à partir de la date « depuis ».
# À ÉCRIRE


# Étape 3. Lancer le serveur.
# À ÉCRIRE
