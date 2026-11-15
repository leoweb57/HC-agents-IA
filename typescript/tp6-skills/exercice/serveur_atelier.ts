// TP 6 : le serveur MCP « atelier », avec trois défauts (à corriger).
//
// C'est le serveur du TP 5, dans lequel trois défauts de conception ont été glissés :
// un mauvais aiguillage, une erreur silencieuse, une sortie trop grosse.
// Le fichier README donne trois questions à poser à l'agent pour les faire apparaître.
//
// Pour interroger le serveur sans agent, depuis le dossier du TP :
//   npx tsx exercice/decouvrir.ts exercice/serveur_atelier.ts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DATA = fileURLToPath(new URL("../../../data/", import.meta.url));

type Enregistrement = Record<string, unknown>;

function charger(fichier: string): Enregistrement[] {
  return JSON.parse(readFileSync(DATA + fichier, "utf-8"));
}

/** Met des données au format attendu par le protocole pour un résultat d'outil. */
function resultat(donnees: unknown, erreur = false) {
  const texte = typeof donnees === "string" ? donnees : JSON.stringify(donnees);
  return { content: [{ type: "text" as const, text: texte }], isError: erreur };
}

const serveur = new McpServer({ name: "atelier", version: "1.0.0" });

serveur.registerTool(
  "lister_arrets",
  {
    description: "Arrêts d'une machine.",
    inputSchema: { machine_id: z.string().describe("Identifiant de la machine, P1 à P4, A1 ou C1.") },
  },
  async ({ machine_id }) => resultat(charger("arrets_machine.json").filter((arret) => arret.machine_id === machine_id)),
);

serveur.registerTool(
  "lire_ordre_fabrication",
  {
    description:
      "Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.",
    inputSchema: { of_id: z.string().describe("Identifiant de l'ordre de fabrication, par exemple OF-2231.") },
  },
  async ({ of_id }) => {
    const ordre = charger("ordres_fabrication.json").find((o) => o.id === of_id);
    return resultat(
      ordre ?? { id: of_id, article: null, machine_id: null, quantite_prevue: 0, quantite_produite: 0, statut: "inconnu" },
    );
  },
);

serveur.registerTool(
  "lister_controles_qualite",
  {
    description:
      "Liste les contrôles qualité d'un ordre de fabrication : date, taille de l'échantillon, non-conformes, défaut principal, décision.",
    inputSchema: { of_id: z.string().describe("Identifiant de l'ordre de fabrication, par exemple OF-2231.") },
  },
  async ({ of_id }) => resultat(charger("controles_qualite.json").filter((controle) => controle.of_id === of_id)),
);

serveur.registerTool(
  "historique_arrets",
  {
    description: "Liste les arrêts récents d'une machine : date, durée, catégorie, cause.",
    inputSchema: { machine_id: z.string().describe("Identifiant de la machine, P1 à P4, A1 ou C1.") },
  },
  async ({ machine_id }) => resultat(charger("historique_arrets.json").filter((arret) => arret.machine_id === machine_id)),
);

await serveur.connect(new StdioServerTransport());
