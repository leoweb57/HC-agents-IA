"""TP 5 : le serveur MCP « atelier » (solution).

C'est le fichier exercice/serveur_atelier.py une fois terminé, bonus compris.
Les commentaires « Pourquoi » expliquent les choix.

Pour le voir tourner, copiez-le à la place de exercice/serveur_atelier.py.
"""

import json
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

DATA = Path(__file__).resolve().parents[3] / "data"


def charger(fichier: str) -> list[dict]:
    return json.loads((DATA / fichier).read_text(encoding="utf-8"))


# Pourquoi ce fichier n'importe rien de l'agent ni de l'Agent SDK : un serveur MCP est un programme
# indépendant. Il ne connaît que le protocole. Demain, plusieurs agents s'y brancheront.
serveur = MCPServer("atelier")


# Pourquoi les mêmes noms et les mêmes descriptions qu'hier : pour le modèle, rien ne doit changer.
# L'outil s'appelait mcp__atelier__lister_arrets dans l'agent, il s'appelle toujours ainsi :
# « atelier » est maintenant le nom du serveur externe.
@serveur.tool()
def lister_arrets(machine_id: str) -> list[dict]:
    """Liste les arrêts d'une machine de l'atelier sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.

    machine_id : identifiant de la machine. P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.
    """
    return [arret for arret in charger("arrets_machine.json") if arret["machine_id"] == machine_id]


# Pourquoi lever une erreur plutôt que renvoyer {"erreur": ...} comme hier : le protocole a un champ
# prévu pour cela. La bibliothèque transforme l'exception en résultat marqué « isError », avec le message.
# Le modèle le lit et peut se corriger ; le harnais, lui, sait que l'appel a échoué.
@serveur.tool()
def lire_ordre_fabrication(of_id: str) -> dict:
    """Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.

    of_id : identifiant de l'ordre de fabrication, par exemple OF-2231.
    """
    for ordre in charger("ordres_fabrication.json"):
        if ordre["id"] == of_id:
            return ordre
    raise ToolError(f"Aucun ordre de fabrication {of_id}.")


# ---------- Bonus : deux outils dont les agents de l'après-midi auront besoin ----------

@serveur.tool()
def lister_controles_qualite(of_id: str) -> list[dict]:
    """Liste les contrôles qualité d'un ordre de fabrication : date, taille de l'échantillon, non-conformes, défaut principal, décision.

    of_id : identifiant de l'ordre de fabrication, par exemple OF-2231.
    """
    return [controle for controle in charger("controles_qualite.json") if controle["of_id"] == of_id]


# Pourquoi un paramètre « depuis » : l'historique compte plusieurs centaines d'arrêts. Tout renvoyer
# remplirait le contexte du modèle. Un serveur doit permettre de ne demander que l'utile.
@serveur.tool()
def historique_arrets(machine_id: str, depuis: str = "2026-01-01") -> list[dict]:
    """Liste tous les arrêts d'une machine depuis janvier 2026, semaine en cours comprise, en version courte : date, durée, catégorie, cause. Sert à chercher une récurrence.

    machine_id : identifiant de la machine, P1 à P4, A1 ou C1.
    depuis : date de début au format AAAA-MM-JJ. Par défaut, depuis le 1er janvier 2026.
    """
    return [
        {cle: arret[cle] for cle in ("debut", "duree_min", "categorie", "cause")}
        for arret in charger("historique_arrets.json")
        if arret["machine_id"] == machine_id and arret["debut"] >= depuis
    ]


# Pourquoi run() sans argument : le transport par défaut est stdio. C'est l'agent qui lancera ce fichier.
if __name__ == "__main__":
    serveur.run()
