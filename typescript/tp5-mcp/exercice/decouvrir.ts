// TP 5 : se brancher sur un serveur MCP et lui demander ce qu'il sait faire. Fourni.
//
// Ce programme est un client MCP minimal, sans modèle ni agent.
// Il ouvre une session avec le serveur et lui pose la question « quels outils as-tu ? ».
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/decouvrir.ts memoire       notre serveur, lancé sur ce poste (transport stdio)
//   npx tsx exercice/decouvrir.ts github        le serveur officiel de GitHub, à distance (transport HTTP)
//   npx tsx exercice/decouvrir.ts github repos  le même, limité aux outils sur les dépôts, en lecture seule

import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const GITHUB = "https://api.githubcopilot.com/mcp/";
const [nom = "memoire", toolset] = process.argv.slice(2);

let transport;
if (nom === "memoire") {
  // Transport stdio : le client lance le serveur comme un programme, et lui parle
  // par son entrée et sa sortie standard.
  transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.resolve("serveur/memoire.ts")],
  });
} else {
  // Transport HTTP : le serveur tourne ailleurs. On s'identifie avec un jeton, dans un en-tête.
  const entetes: Record<string, string> = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` };
  if (toolset) Object.assign(entetes, { "X-MCP-Toolsets": toolset, "X-MCP-Readonly": "true" });
  transport = new StreamableHTTPClientTransport(new URL(GITHUB), { requestInit: { headers: entetes } });
}

const client = new Client({ name: "decouvrir", version: "1.0.0" });
await client.connect(transport); // la poignée de main du protocole
const { tools: outils } = await client.listTools(); // la demande « tools/list »

const definitions = outils.reduce((total, outil) => total + JSON.stringify(outil).length, 0);
console.log(
  `Le serveur « ${nom} » expose ${outils.length} outil(s), soit environ ${Math.floor(definitions / 4)} tokens de définitions.\n`,
);
for (const outil of outils) {
  console.log(`- ${outil.name} : ${(outil.description ?? "").trim().split("\n")[0].slice(0, 90)}`);
}
await client.close();
