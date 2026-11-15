"""TP 9 : un gros serveur MCP, pour l'essai de recherche d'outils. Fourni : 60 outils « usine » aux descriptions réalistes."""
from mcp.server.mcpserver import MCPServer
serveur = MCPServer("usine")
DOMAINES = {
    "energie": "la consommation électrique en kWh relevée par le compteur divisionnaire",
    "temperature": "la température du fourreau et du moule relevée par les sondes",
    "pression": "la pression hydraulique mesurée sur le groupe de fermeture",
    "cadence": "la cadence réelle en pièces par heure calculée sur le dernier poste",
    "rebuts": "le nombre de pièces rebutées et le motif principal de rebut",
    "stock_matiere": "le stock de matière première disponible en kilogrammes dans le silo",
    "maintenance_preventive": "la date et le contenu de la prochaine visite de maintenance préventive",
    "outillage": "le moule monté, son nombre de cycles et sa prochaine révision",
    "operateurs": "l'équipe affectée au poste et les habilitations de chaque opérateur",
    "planning": "les ordres de fabrication planifiés sur les sept prochains jours",
}
MACHINES = ["P1", "P2", "P3", "P4", "A1", "C1"]
def fabriquer(domaine, quoi, machine):
    def outil(jour: str = "2026-03-13") -> dict:
        return {"machine": machine, "domaine": domaine, "jour": jour, "valeur": len(domaine) * 7 + len(machine)}
    outil.__name__ = f"lire_{domaine}_{machine.lower()}"
    outil.__doc__ = f"Renvoie {quoi} pour la machine {machine} de l'atelier d'injection, pour un jour donné. À utiliser pour toute question sur ce sujet et cette machine uniquement.\n\njour : la date au format AAAA-MM-JJ, par défaut aujourd'hui."
    return outil
for d, quoi in DOMAINES.items():
    for m in MACHINES:
        serveur.tool()(fabriquer(d, quoi, m))
if __name__ == "__main__":
    serveur.run()
