// TP 4, partie 1 : une seule question, comme au TP 2, mais avec l'Agent SDK.
//
// Lancement, depuis le dossier du TP :
//   npx tsx solution/question.ts

import { query } from "@anthropic-ai/claude-agent-sdk";
import { creerOptions } from "./agent.ts";

const QUESTION = "Pourquoi la presse 4 s'est-elle arrêtée ce matin, et où en est l'ordre de fabrication qui était en cours ?";

// query fait tourner la boucle et renvoie les messages au fur et à mesure.
for await (const message of query({ prompt: QUESTION, options: creerOptions() })) {
  if (message.type === "result") {
    // le dernier message : la réponse finale
    console.log(`\n${message.subtype === "success" ? message.result : "L'agent s'est arrêté sans répondre."}\n`);
    console.log(`${message.num_turns} tours, ${message.total_cost_usd.toFixed(4)} $, session ${message.session_id}`);
  }
}
