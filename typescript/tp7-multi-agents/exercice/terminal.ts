// TP 7 : une conversation avec l'agent, dans le terminal. Fourni.
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/terminal.ts v1      l'agent seul
//   npx tsx exercice/terminal.ts v2      le chef d'atelier et ses spécialistes

import { createInterface } from "node:readline/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { creerOptions as creerOptionsV1 } from "./agent_v1.ts";
import { creerOptions as creerOptionsV2 } from "./agent_v2.ts";
import type { DemanderAccord } from "./commun.ts";
import { Mesure } from "./mesures.ts";

const version = process.argv[2] ?? "v2";
const creerOptions = version === "v1" ? creerOptionsV1 : creerOptionsV2;

const clavier = createInterface({ input: process.stdin, output: process.stdout });

/** Appelée quand l'agent veut utiliser l'outil d'action. */
const demanderAccord: DemanderAccord = async (nomOutil, parametres) => {
  console.log(`  L'agent veut créer une demande d'intervention : ${JSON.stringify(parametres)}`);
  const reponse = await clavier.question("  Valider ? (o/n) ");
  return reponse.trim().toLowerCase().startsWith("o");
};

let sessionId: string | undefined; // pas encore de conversation
console.log(`Agent ${version}. Posez vos questions. Ligne vide pour quitter.`);
while (true) {
  const texte = await clavier.question("\nVous : ");
  if (!texte.trim()) break;
  const mesure = new Mesure();
  for await (const message of query({ prompt: texte, options: creerOptions(sessionId, demanderAccord) })) {
    mesure.voir(message);
    if (message.type === "result") {
      sessionId = message.session_id; // on garde l'identifiant pour le message suivant
      console.log(`\nAgent : ${mesure.reponse}`);
      console.log(`  [${mesure.ligne()}]`);
    }
  }
}
clavier.close();
