// TP 9 : un gros serveur MCP, pour l'essai de recherche d'outils. Fourni : 60 outils « usine » aux descriptions réalistes.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const serveur = new McpServer({ name: "usine", version: "1.0.0" });

const DOMAINES: Record<string, string> = {
  energie: "la consommation électrique en kWh relevée par le compteur divisionnaire",
  temperature: "la température du fourreau et du moule relevée par les sondes",
  pression: "la pression hydraulique mesurée sur le groupe de fermeture",
  cadence: "la cadence réelle en pièces par heure calculée sur le dernier poste",
  rebuts: "le nombre de pièces rebutées et le motif principal de rebut",
  stock_matiere: "le stock de matière première disponible en kilogrammes dans le silo",
  maintenance_preventive: "la date et le contenu de la prochaine visite de maintenance préventive",
  outillage: "le moule monté, son nombre de cycles et sa prochaine révision",
  operateurs: "l'équipe affectée au poste et les habilitations de chaque opérateur",
  planning: "les ordres de fabrication planifiés sur les sept prochains jours",
};
const MACHINES = ["P1", "P2", "P3", "P4", "A1", "C1"];

// Dix domaines, six machines : soixante outils, un par couple.
for (const [domaine, quoi] of Object.entries(DOMAINES)) {
  for (const machine of MACHINES) {
    serveur.registerTool(
      `lire_${domaine}_${machine.toLowerCase()}`,
      {
        description: `Renvoie ${quoi} pour la machine ${machine} de l'atelier d'injection, pour un jour donné. À utiliser pour toute question sur ce sujet et cette machine uniquement.`,
        inputSchema: { jour: z.string().default("2026-03-13").describe("La date au format AAAA-MM-JJ, par défaut aujourd'hui.") },
      },
      async ({ jour }) => ({
        content: [{ type: "text" as const, text: JSON.stringify({ machine, domaine, jour, valeur: domaine.length * 7 + machine.length }) }],
      }),
    );
  }
}

await serveur.connect(new StdioServerTransport());
