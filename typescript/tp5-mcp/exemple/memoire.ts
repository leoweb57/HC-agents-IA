// Mémoire : le serveur MCP du cours, pour l'exemple. Fourni, à lire.
//
// Il propose deux outils : écrire une note, et relire les notes.
// Les notes sont gardées dans le fichier memoire.json du TP.
//
// C'est un programme à part, qui ne sait rien de votre agent. C'est le client qui le lance
// quand il s'y connecte (transport stdio). Pour voir ce qu'il annonce :
//   npx tsx exercice/decouvrir.ts exemple/memoire.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const MEMOIRE = fileURLToPath(new URL("../memoire.json", import.meta.url));

type Note = { auteur: string; note: string };

function lireNotes(): Note[] {
  return existsSync(MEMOIRE) ? JSON.parse(readFileSync(MEMOIRE, "utf-8")) : [];
}

/** Met des données au format attendu par le protocole pour un résultat d'outil. */
function resultat(donnees: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(donnees) }] };
}

// 1. On crée le serveur, avec la bibliothèque officielle du protocole. Son nom est celui que les clients verront.
const serveur = new McpServer({ name: "memoire", version: "1.0.0" });

// 2. On déclare ses outils : un nom, une description, un schéma d'entrée, une fonction.
serveur.registerTool(
  "memoriser",
  {
    description:
      "Enregistre une note dans la mémoire : une consigne, une habitude, une décision à retenir.",
    inputSchema: {
      auteur: z.string().describe("Le prénom de la personne qui demande de retenir la note."),
      note: z.string().describe("La note, en une phrase complète et compréhensible hors contexte."),
    },
  },
  async ({ auteur, note }) => {
    const notes = lireNotes();
    notes.push({ auteur, note });
    writeFileSync(MEMOIRE, JSON.stringify(notes, null, 2));
    return resultat({ enregistre: true, nombre_de_notes: notes.length });
  },
);

serveur.registerTool(
  "lire_memoire",
  {
    description: "Relit les notes de la mémoire. Sans recherche, renvoie toutes les notes.",
    inputSchema: {
      recherche: z
        .string()
        .default("")
        .describe("Un mot à chercher dans les notes, par exemple « presse 4 ». Laisser vide pour tout lire."),
    },
  },
  async ({ recherche }) =>
    resultat(lireNotes().filter((n) => n.note.toLowerCase().includes(recherche.trim().toLowerCase()))),
);

// 3. On lance le serveur, en transport stdio : l'entrée et la sortie standard.
await serveur.connect(new StdioServerTransport());
