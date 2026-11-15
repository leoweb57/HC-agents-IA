// TP 5 : une conversation avec l'agent, dans le terminal. Fourni.
//
// Chaque lancement démarre une conversation neuve : c'est ce qui permet de tester la mémoire commune.
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/terminal.ts

import { createInterface } from "node:readline/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { type DemanderAccord, creerOptions } from "./agent.ts";

const clavier = createInterface({ input: process.stdin, output: process.stdout });

/** Appelée quand l'agent veut utiliser l'outil d'action. */
const demanderAccord: DemanderAccord = async (nomOutil, parametres) => {
  console.log(`  L'agent veut créer une demande d'intervention : ${JSON.stringify(parametres)}`);
  const reponse = await clavier.question("  Valider ? (o/n) ");
  return reponse.trim().toLowerCase().startsWith("o");
};

let sessionId: string | undefined; // pas encore de conversation
const utilisateur = (await clavier.question("Votre prénom : ")).trim();
console.log("Posez vos questions à l'agent d'atelier. Ligne vide pour quitter.");
while (true) {
  const texte = await clavier.question("\nVous : ");
  if (!texte.trim()) break;
  for await (const message of query({ prompt: texte, options: creerOptions(sessionId, demanderAccord, utilisateur) })) {
    if (message.type === "result") {
      sessionId = message.session_id; // on garde l'identifiant pour le message suivant
      console.log(`\nAgent : ${message.subtype === "success" ? message.result : "Je n'ai pas pu répondre."}`);
    }
  }
}
clavier.close();
