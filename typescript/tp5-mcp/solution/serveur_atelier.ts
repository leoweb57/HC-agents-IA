// TP 5 : le serveur MCP « atelier » (solution).
//
// C'est le fichier exercice/serveur_atelier.ts une fois terminé, bonus compris.
// Les commentaires « Pourquoi » expliquent les choix.
//
// Pour le voir tourner, copiez-le à la place de exercice/serveur_atelier.ts.

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

// Pourquoi ce fichier n'importe rien de l'agent ni de l'Agent SDK : un serveur MCP est un programme
// indépendant. Il ne connaît que le protocole. Demain, plusieurs agents s'y brancheront.
const serveur = new McpServer({ name: "atelier", version: "1.0.0" });

// Pourquoi les mêmes noms et les mêmes descriptions qu'hier : pour le modèle, rien ne doit changer.
// L'outil s'appelait mcp__atelier__lister_arrets dans l'agent, il s'appelle toujours ainsi :
// « atelier » est maintenant le nom du serveur externe.
serveur.registerTool(
  "lister_arrets",
  {
    description:
      "Liste les arrêts d'une machine de l'atelier sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
    inputSchema: {
      machine_id: z
        .string()
        .describe(
          "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.",
        ),
    },
  },
  async ({ machine_id }) => resultat(charger("arrets_machine.json").filter((arret) => arret.machine_id === machine_id)),
);

// Pourquoi isError plutôt qu'un objet { erreur: ... } comme hier : le protocole a un champ prévu pour cela.
// Le modèle lit le message et peut se corriger ; le harnais, lui, sait que l'appel a échoué.
serveur.registerTool(
  "lire_ordre_fabrication",
  {
    description:
      "Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.",
    inputSchema: { of_id: z.string().describe("Identifiant de l'ordre de fabrication, par exemple OF-2231.") },
  },
  async ({ of_id }) => {
    const ordre = charger("ordres_fabrication.json").find((o) => o.id === of_id);
    return ordre ? resultat(ordre) : resultat(`Aucun ordre de fabrication ${of_id}.`, true);
  },
);

// ---------- Bonus : deux outils dont les agents de l'après-midi auront besoin ----------

serveur.registerTool(
  "lister_controles_qualite",
  {
    description:
      "Liste les contrôles qualité d'un ordre de fabrication : date, taille de l'échantillon, non-conformes, défaut principal, décision.",
    inputSchema: { of_id: z.string().describe("Identifiant de l'ordre de fabrication, par exemple OF-2231.") },
  },
  async ({ of_id }) => resultat(charger("controles_qualite.json").filter((controle) => controle.of_id === of_id)),
);

// Pourquoi un paramètre « depuis » : l'historique compte plusieurs centaines d'arrêts. Tout renvoyer
// remplirait le contexte du modèle. Un serveur doit permettre de ne demander que l'utile.
serveur.registerTool(
  "historique_arrets",
  {
    description: "Liste tous les arrêts d'une machine depuis janvier 2026, semaine en cours comprise, en version courte : date, durée, catégorie, cause. Sert à chercher une récurrence.",
    inputSchema: {
      machine_id: z.string().describe("Identifiant de la machine, P1 à P4, A1 ou C1."),
      depuis: z
        .string()
        .default("2026-01-01")
        .describe("Date de début au format AAAA-MM-JJ. Par défaut, depuis le 1er janvier 2026."),
    },
  },
  async ({ machine_id, depuis }) =>
    resultat(
      charger("historique_arrets.json")
        .filter((arret) => arret.machine_id === machine_id && String(arret.debut) >= depuis)
        .map(({ debut, duree_min, categorie, cause }) => ({ debut, duree_min, categorie, cause })),
    ),
);

// Pourquoi le transport stdio : c'est l'agent qui lancera ce fichier, et lui parlera
// par son entrée et sa sortie standard.
await serveur.connect(new StdioServerTransport());
