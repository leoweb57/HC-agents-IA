// TP 5 : le serveur MCP « atelier » (à écrire).
//
// Vous sortez de l'agent ses deux outils de lecture, pour en faire un serveur MCP :
// un programme à part, que n'importe quel agent pourra utiliser.
// Le modèle à suivre est exemple/memoire.ts. Cherchez « À ÉCRIRE ».
//
// Pour tester votre serveur, sans agent ni modèle, depuis le dossier du TP :
//   npx tsx exercice/decouvrir.ts exercice/serveur_atelier.ts
//   npx tsx exercice/decouvrir.ts exercice/serveur_atelier.ts lister_arrets machine_id=P4

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

// Étape 1. Créer le serveur, avec le nom « atelier ».
// À ÉCRIRE

// Étape 2. Déclarer les deux outils de lecture de l'agent : lister_arrets et lire_ordre_fabrication.
//   Reprenez leur code dans exercice/agent.ts. Ce qui change :
//   - on écrit serveur.registerTool(nom, { description, inputSchema }, fonction) ;
//   - la fonction reçoit directement les paramètres : async ({ machine_id }) => ... ;
//   - pour un ordre de fabrication introuvable, renvoyez une erreur : resultat("...", true).
// À ÉCRIRE

// Bonus. Deux outils de plus, dont les agents de l'après-midi auront besoin :
//   - lister_controles_qualite(of_id) : les contrôles d'un ordre de fabrication (fichier controles_qualite.json) ;
//   - historique_arrets(machine_id, depuis) : les arrêts passés d'une machine (fichier historique_arrets.json).
//     Ce fichier est long : ne renvoyez que les champs utiles, et seulement à partir de la date « depuis ».
// À ÉCRIRE

// Étape 3. Lancer le serveur, en transport stdio.
// À ÉCRIRE
