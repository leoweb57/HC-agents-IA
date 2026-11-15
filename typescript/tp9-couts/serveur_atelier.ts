// Le serveur MCP « atelier ». Fourni : c'est celui des TP 6 et 7.
//
// Il propose quatre outils de lecture : lister_arrets, historique_arrets,
// lister_controles_qualite et lire_ordre_fabrication.
//
// Nouveau au jour 3 : la variable d'environnement ATELIER_DONNEES désigne le dossier des données.
// Sans elle, le serveur lit le dossier data/ à la racine du dépôt.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DATA = process.env.ATELIER_DONNEES ? `${process.env.ATELIER_DONNEES}/` : fileURLToPath(new URL("../../data/", import.meta.url));

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

// Correction 1, le mauvais aiguillage. Deux outils parlaient d'« arrêts » sans dire lesquels :
// le modèle choisissait au hasard. Chaque description dit maintenant ce que l'outil couvre
// (le détail de la semaine en cours ici, tout l'historique en version courte pour historique_arrets)
// et renvoie vers l'autre.
serveur.registerTool(
  "lister_arrets",
  {
    description:
      "Liste les arrêts d'une machine sur la semaine en cours, avec le détail : date, durée, cause, commentaire et ordre de fabrication concerné. Pour chercher une récurrence sur une période plus longue, utiliser historique_arrets.",
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

// Correction 2, l'erreur silencieuse. Pour un identifiant inconnu, l'outil renvoyait une fiche vide :
// le modèle la prenait pour une vraie réponse. Il renvoie maintenant un résultat marqué isError,
// avec un message qui dit quoi faire. C'est une erreur métier (la demande est bien formée,
// mais l'objet n'existe pas) : le modèle doit la dire, pas réessayer.
serveur.registerTool(
  "lire_ordre_fabrication",
  {
    description:
      "Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.",
    inputSchema: { of_id: z.string().describe("Identifiant de l'ordre de fabrication, par exemple OF-2231.") },
  },
  async ({ of_id }) => {
    const ordre = charger("ordres_fabrication.json").find((o) => o.id === of_id);
    return ordre ? resultat(ordre) : resultat(
          `Aucun ordre de fabrication ${of_id}. Vérifier l'identifiant auprès de l'utilisateur, sans en deviner un autre.`,
          true,
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

// Correction 3, la sortie trop grosse. L'outil renvoyait tout l'historique de la machine, avec tous
// les champs. Il filtre maintenant à partir d'une date, et ne garde que quatre champs utiles.
// Ce que l'outil renvoie reste dans le contexte jusqu'à la fin de la conversation.
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
