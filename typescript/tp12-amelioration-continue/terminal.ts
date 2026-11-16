// TP 12 : l'agent « en production ». C'est le terminal du TP 10, avec une différence.
//
// Lancement, depuis le dossier du TP :
//   npx tsx terminal.ts
//
// La différence : le prompt système n'est plus dans le code. À chaque question, l'agent lit dans Langfuse
// la version qui porte l'étiquette « production ». Déplacer l'étiquette change son comportement à la question suivante.
// Sans Langfuse, il lit la copie du dépôt (prompts/v1.md).
//
// Comme au TP 10 : une trace par question, une session par conversation, et votre avis en score et dans retours.jsonl.

import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getActiveTraceId, observe, propagateAttributes, updateActiveObservation } from "@langfuse/tracing";
import { type DemanderAccord, TP, creerOptions } from "./agent.ts";
import { AVEC_LANGFUSE, langfuse, toutEnvoyer } from "./langfuse.ts";
import { texteDuPrompt } from "./prompts.ts";
import { Suivi, resume } from "./suivi.ts";

const RETOURS = path.join(TP, "retours.jsonl");
const clavier = createInterface({ input: process.stdin, output: process.stdout });

const demanderAccord: DemanderAccord = async (nomOutil, parametres) => {
  console.log(`  L'agent veut créer une demande d'intervention : ${JSON.stringify(parametres)}`);
  const reponse = await demander("  Valider ? (o/n) ");
  return reponse.trim().toLowerCase().startsWith("o");
};

// observe() : chaque appel de cette fonction devient une trace, et la fonction en est la racine.
// On ne garde pas ses paramètres comme entrée de la trace : l'entrée, c'est la question.
const poser = observe(
  async (question: string, sessionClaude?: string) => {
    const { systeme, prompt } = await texteDuPrompt("production"); // relu à chaque question : la version en production peut avoir changé
    updateActiveObservation({ input: question, metadata: { prompt: prompt ? `version ${prompt.version}` : "copie du dépôt" } }, { asType: "agent" });
    const suivi = new Suivi(question, prompt); // chaque appel au modèle est relié à la version du prompt
    const options = suivi.brancher(creerOptions(systeme, sessionClaude, demanderAccord));
    for await (const message of query({ prompt: question, options })) {
      suivi.voir(message); // chaque message du SDK devient une observation, ou en complète une
    }
    return { bilan: suivi.bilan, traceId: getActiveTraceId() ?? "" };
  },
  { name: "agent-atelier", asType: "agent", captureInput: false, captureOutput: false },
);

/** L'adresse de la trace dans Langfuse, ou son identifiant si le serveur ne répond pas. */
async function adresse(traceId: string): Promise<string> {
  if (!AVEC_LANGFUSE) return traceId || "(pas de trace : Langfuse n'est pas configuré)";
  try {
    return await langfuse.getTraceUrl(traceId);
  } catch {
    return traceId;
  }
}

/** Une saisie au clavier. Si l'entrée est fermée (Ctrl+D), on rend une ligne vide : le programme s'arrête proprement. */
async function demander(texte: string): Promise<string> {
  try {
    return await clavier.question(texte);
  } catch {
    return "";
  }
}

/** Le retour de l'utilisateur : un score sur la trace, et une ligne dans un fichier local. */
async function noter(traceId: string, question: string, reponse: string): Promise<void> {
  const avis = (await demander("  Cette réponse vous a-t-elle aidé ? (o/n, Entrée pour passer) ")).trim().toLowerCase();
  if (!avis) return;
  const utile = avis.startsWith("o");
  const commentaire = utile ? "" : (await demander("  Qu'est-ce qui n'allait pas ? ")).trim();
  if (AVEC_LANGFUSE) {
    langfuse.score.create({ traceId, name: "avis_utilisateur", value: utile ? 1 : 0, dataType: "BOOLEAN", comment: commentaire || undefined });
  }
  // La même information en local : le TP 12 s'en sert, même sans Langfuse.
  appendFileSync(RETOURS, `${JSON.stringify({ trace_id: traceId, question, reponse, utile, commentaire })}\n`);
}

const utilisateur = process.argv[2] ?? "chef-equipe-1";
const conversation = `conversation-${randomUUID().slice(0, 8)}`; // la session Langfuse : une par conversation
let sessionClaude: string | undefined; // la session du SDK : la mémoire de la conversation
console.log(`Session Langfuse : ${conversation}. Posez vos questions. Ligne vide pour quitter.`);
while (true) {
  const question = await demander("\nVous : ");
  if (!question.trim()) break;
  // Ce qui vaut pour toute la trace : la session, l'utilisateur, des étiquettes pour filtrer.
  const { bilan, traceId } = await propagateAttributes({ sessionId: conversation, userId: utilisateur, tags: ["atelier", "production"] }, () =>
    poser(question, sessionClaude),
  );
  sessionClaude = bilan.session;
  console.log(`\nAgent : ${bilan.reponse}`);
  console.log(`  [bilan] ${resume(bilan)}`);
  console.log(`  [trace] ${await adresse(traceId)}`);
  await noter(traceId, question, bilan.reponse);
}
clavier.close();
await toutEnvoyer(); // on attend que tout soit parti avant de quitter
