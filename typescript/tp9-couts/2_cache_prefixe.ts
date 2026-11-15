// TP 9, étape 2 : le cache est un préfixe. Essai direct sur l'API, sans l'Agent SDK.
//
// Le modèle met en cache le DÉBUT de ce qu'on lui envoie, jusqu'à un point qu'on lui désigne.
// Tout ce qui change avant ce point annule le cache de ce qui suit.
// On envoie trois fois un long contexte stable, avec l'heure placée APRÈS puis AVANT lui.
//
// Lancement, depuis le dossier du TP :
//   npx tsx 2_cache_prefixe.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { MODELE, TP } from "./agent.ts";

const client = new Anthropic();

// Un long contexte stable : le début de l'historique des arrêts.
const historique = readFileSync(path.join(TP, "../../data/historique_arrets.json"), "utf-8").slice(0, 24000);
const STABLE = {
  type: "text" as const,
  text: `Tu es l'assistant de l'atelier. Voici l'historique des arrêts :\n${historique}`,
  cache_control: { type: "ephemeral" as const }, // « mets en cache tout ce qui précède ce point »
};
const QUESTION = "Combien d'arrêts concernent P2 dans cet extrait ? Un nombre seulement.";

const heure = () => ({ type: "text" as const, text: `Heure du serveur : ${new Date().toISOString()}` });

async function appeler(systeme: Anthropic.TextBlockParam[]): Promise<string> {
  const reponse = await client.messages.create({ model: MODELE, max_tokens: 60, system: systeme, messages: [{ role: "user", content: QUESTION }] });
  const u = reponse.usage;
  const n = (v: number | null | undefined) => String(v ?? 0).padStart(6);
  return `lus plein tarif ${n(u.input_tokens)} · écrits en cache ${n(u.cache_creation_input_tokens)} · relus en cache ${n(u.cache_read_input_tokens)}`;
}

const pause = () => new Promise((fin) => setTimeout(fin, 1000));

console.log("A. L'heure APRÈS le contexte stable : le début ne change pas");
for (let essai = 0; essai < 3; essai++) {
  console.log("   ", await appeler([STABLE, heure()]));
  await pause();
}
console.log("B. L'heure AVANT le contexte stable : le début change à chaque appel");
for (let essai = 0; essai < 3; essai++) {
  console.log("   ", await appeler([heure(), STABLE]));
  await pause();
}
