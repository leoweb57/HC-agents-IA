"""TP 6 : le serveur MCP « atelier », corrigé (solution).

C'est le fichier exercice/serveur_atelier.py une fois ses trois défauts corrigés.
Les commentaires « Correction » disent ce qui a changé, et pourquoi.

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


# Correction 1, le mauvais aiguillage. Deux outils parlaient d'« arrêts » sans dire lesquels :
# le modèle choisissait au hasard. Chaque description dit maintenant ce que l'outil couvre
# (le détail de la semaine en cours ici, tout l'historique en version courte pour historique_arrets) et renvoie vers l'autre.
@serveur.tool()
def lister_arrets(machine_id: str) -> list[dict]:
    """Liste les arrêts d'une machine sur la semaine en cours, avec le détail : date, durée, cause, commentaire et ordre de fabrication concerné. Pour chercher une récurrence sur une période plus longue, utiliser historique_arrets.

    machine_id : identifiant de la machine. P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.
    """
    return [arret for arret in charger("arrets_machine.json") if arret["machine_id"] == machine_id]


# Correction 2, l'erreur silencieuse. Pour un identifiant inconnu, l'outil renvoyait une fiche vide :
# le modèle la prenait pour une vraie réponse. Il lève maintenant une erreur : la bibliothèque en fait
# un résultat marqué « isError », avec un message qui dit quoi faire. C'est une erreur métier
# (la demande est bien formée, mais l'objet n'existe pas) : le modèle doit la dire, pas réessayer.
@serveur.tool()
def lire_ordre_fabrication(of_id: str) -> dict:
    """Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.

    of_id : identifiant de l'ordre de fabrication, par exemple OF-2231.
    """
    for ordre in charger("ordres_fabrication.json"):
        if ordre["id"] == of_id:
            return ordre
    raise ToolError(f"Aucun ordre de fabrication {of_id}. Vérifier l'identifiant auprès de l'utilisateur, sans en deviner un autre.")


@serveur.tool()
def lister_controles_qualite(of_id: str) -> list[dict]:
    """Liste les contrôles qualité d'un ordre de fabrication : date, taille de l'échantillon, non-conformes, défaut principal, décision.

    of_id : identifiant de l'ordre de fabrication, par exemple OF-2231.
    """
    return [controle for controle in charger("controles_qualite.json") if controle["of_id"] == of_id]


# Correction 3, la sortie trop grosse. L'outil renvoyait tout l'historique de la machine, avec tous
# les champs. Il filtre maintenant à partir d'une date, et ne garde que quatre champs utiles.
# Ce que l'outil renvoie reste dans le contexte jusqu'à la fin de la conversation.
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
