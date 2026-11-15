// TP 5 : interroger un serveur MCP, sans agent ni modèle. Fourni.
//
// Ce programme est un client MCP minimal. Il lance le serveur (transport stdio), fait la poignée
// de main, lui demande la liste de ses outils, et peut en appeler un.
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/decouvrir.ts exemple/memoire.ts                              ce que le serveur annonce
//   npx tsx exercice/decouvrir.ts exercice/serveur_atelier.ts                     votre serveur
//   npx tsx exercice/decouvrir.ts exercice/serveur_atelier.ts lister_arrets machine_id=P4    appeler un outil

import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [fichier, outil, ...paires] = process.argv.slice(2);
if (!fichier) {
  console.error("Indiquez le fichier du serveur, par exemple : npx tsx exercice/decouvrir.ts exemple/memoire.ts");
  process.exit(1);
}
const parametres = Object.fromEntries(paires.map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]));

// Transport stdio : le client lance le serveur comme un programme,
// et lui parle par son entrée et sa sortie standard.
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", path.resolve(fichier)],
});
const client = new Client({ name: "decouvrir", version: "1.0.0" });

try {
  await client.connect(transport); // la demande « initialize »
  console.log(`Serveur « ${client.getServerVersion()?.name} »\n`);

  const { tools: outils } = await client.listTools(); // la demande « tools/list »
  for (const o of outils) {
    console.log(`- ${o.name} : ${(o.description ?? "").trim().split("\n")[0]}`);
    console.log(`    entrée : ${JSON.stringify(Object.keys(o.inputSchema.properties ?? {}))}`);
    console.log(`    sortie : ${o.outputSchema ? "un schéma est déclaré" : "pas de schéma"}`);
  }

  if (outil) {
    const reponse = await client.callTool({ name: outil, arguments: parametres }); // la demande « tools/call »
    console.log(`\nRésultat de ${outil}(${JSON.stringify(parametres)})${reponse.isError ? " : ERREUR" : ""}`);
    for (const contenu of reponse.content as { type: string; text?: string }[]) {
      console.log(`  [${contenu.type}] ${contenu.text ?? ""}`);
    }
  }
  await client.close();
} catch {
  console.error(
    "Le serveur n'a pas répondu. Est-il créé, et lancé à la fin du fichier ? Son erreur éventuelle est affichée au-dessus.",
  );
  process.exit(1);
}
