// TP 9, étape 4 : la recherche d'outils. Soixante outils de plus, sans les payer à chaque appel.
//
// On branche sur l'agent un second serveur MCP, « usine », qui apporte 60 outils.
//   npx tsx 4_recherche_outils.ts sans     toutes les définitions d'outils sont envoyées à chaque appel
//   npx tsx 4_recherche_outils.ts avec     le modèle ne voit que leurs noms, et cherche ceux dont il a besoin
//
// Ce qui active la recherche : l'outil intégré ToolSearch, à ajouter à la liste des outils intégrés.
// Notre agent ne l'avait pas : c'est pour cela qu'on ne l'a jamais vue au jour 2.

import path from "node:path";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { TP, creerOptions } from "./agent.ts";
import { milliers, pluriel, poser } from "./mesures.ts";

const QUESTIONS = ["Où en est l'OF-2231 ?", "Quelle est la pression hydraulique de la presse 3 aujourd'hui ?"];

const avec = process.argv[2] === "avec";
for (const question of QUESTIONS) {
  const base = creerOptions();
  const options: Options = {
    ...base,
    hooks: {},
    mcpServers: { ...base.mcpServers, usine: { command: process.execPath, args: ["--import", "tsx", path.join(TP, "serveur_usine.ts")] } },
    allowedTools: [...(base.allowedTools ?? []), "mcp__usine__*"], // tout le serveur, en lecture
  };
  if (avec) options.tools = ["Read", "Skill", "ToolSearch"];
  else options.env = { ...process.env, ENABLE_TOOL_SEARCH: "false" };
  const m = await poser(question, options);
  console.log(`\n${question}\n→ ${m.reponse.slice(0, 160)}`);
  console.log(`  outils appelés : ${m.outils.join(", ")}`);
  console.log(`  ${pluriel(m.appels, "appel")} · tokens lus par appel : ${m.tokensParAppel.map(milliers).join(", ")} · total ${milliers(m.lus)} · ${m.duree.toFixed(1)} s`);
}
