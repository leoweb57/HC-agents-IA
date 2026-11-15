// Un serveur MCP écrit par nous : la mémoire commune de l'atelier.
//
// Il expose deux outils : écrire une note, et relire les notes.
// Les notes sont gardées dans le fichier memoire.json du TP. Elles survivent à la conversation :
// tout agent qui se branche sur ce serveur les retrouve.
//
// C'est un programme à part, qui ne sait rien de votre agent. Il se lance tout seul quand un client
// s'y connecte. Pour le lancer à la main (il attend alors des messages sur son entrée standard) :
//   npx tsx serveur/memoire.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const MEMOIRE = fileURLToPath(new URL("../memoire.json", import.meta.url));

type Note = { date: string; auteur: string; note: string };

function lireNotes(): Note[] {
  return existsSync(MEMOIRE) ? JSON.parse(readFileSync(MEMOIRE, "utf-8")) : [];
}

/** Met des données au format attendu par le protocole pour un résultat d'outil. */
function resultat(donnees: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(donnees) }] };
}

// 1. On crée le serveur. Son nom est celui que les clients verront.
const serveur = new McpServer({ name: "memoire", version: "1.0.0" });

// 2. On déclare ses outils : un nom, une description, un schéma, une fonction. Comme hier avec tool().
serveur.registerTool(
  "memoriser",
  {
    description:
      "Enregistre une note dans la mémoire commune de l'atelier : une consigne, une habitude, une décision à retenir.",
    inputSchema: {
      auteur: z.string().describe("Le prénom de la personne qui demande de retenir la note."),
      note: z.string().describe("La note, en une phrase complète et compréhensible hors contexte."),
    },
  },
  async ({ auteur, note }) => {
    const notes = lireNotes();
    notes.push({ date: new Date().toISOString().slice(0, 16).replace("T", " "), auteur, note });
    writeFileSync(MEMOIRE, JSON.stringify(notes, null, 2));
    return resultat({ enregistre: true, nombre_de_notes: notes.length });
  },
);

serveur.registerTool(
  "lire_memoire",
  {
    description: "Relit les notes de la mémoire commune de l'atelier. Sans recherche, renvoie toutes les notes.",
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
