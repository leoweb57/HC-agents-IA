"""TP 6 : le serveur MCP « atelier », avec trois défauts (à corriger).

C'est le serveur du TP 5, dans lequel trois défauts de conception ont été glissés :
un mauvais aiguillage, une erreur silencieuse, une sortie trop grosse.
Le fichier README donne trois questions à poser à l'agent pour les faire apparaître.

Pour interroger le serveur sans agent, depuis le dossier du TP :
    python exercice/decouvrir.py exercice/serveur_atelier.py
"""

import json
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

DATA = Path(__file__).resolve().parents[3] / "data"


def charger(fichier: str) -> list[dict]:
    return json.loads((DATA / fichier).read_text(encoding="utf-8"))


serveur = MCPServer("atelier")


@serveur.tool()
def lister_arrets(machine_id: str) -> list[dict]:
    """Arrêts d'une machine.

    machine_id : identifiant de la machine, P1 à P4, A1 ou C1.
    """
    return [arret for arret in charger("arrets_machine.json") if arret["machine_id"] == machine_id]


@serveur.tool()
def lire_ordre_fabrication(of_id: str) -> dict:
    """Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.

    of_id : identifiant de l'ordre de fabrication, par exemple OF-2231.
    """
    for ordre in charger("ordres_fabrication.json"):
        if ordre["id"] == of_id:
            return ordre
    return {"id": of_id, "article": None, "machine_id": None, "quantite_prevue": 0, "quantite_produite": 0, "statut": "inconnu"}


@serveur.tool()
def lister_controles_qualite(of_id: str) -> list[dict]:
    """Liste les contrôles qualité d'un ordre de fabrication : date, taille de l'échantillon, non-conformes, défaut principal, décision.

    of_id : identifiant de l'ordre de fabrication, par exemple OF-2231.
    """
    return [controle for controle in charger("controles_qualite.json") if controle["of_id"] == of_id]


@serveur.tool()
def historique_arrets(machine_id: str) -> list[dict]:
    """Liste les arrêts récents d'une machine : date, durée, catégorie, cause.

    machine_id : identifiant de la machine, P1 à P4, A1 ou C1.
    """
    return [arret for arret in charger("historique_arrets.json") if arret["machine_id"] == machine_id]


if __name__ == "__main__":
    serveur.run()
