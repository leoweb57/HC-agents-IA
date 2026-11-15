// TP 9, étape 1 : le cache de prompt, mesuré sur une conversation.
//
// Quatre questions dans la même session. À chaque appel, le modèle relit tout : son prompt système,
// la définition de ses outils, puis toute la conversation. Le cache évite de le payer plein tarif.
//
// Lancement, depuis le dossier du TP :
//   npx tsx 1_cache.ts

import { creerOptions } from "./agent.ts";
import { milliers, poser } from "./mesures.ts";

const QUESTIONS = [
  "Où en est l'OF-2231 ?",
  "Quels arrêts la presse 4 a-t-elle eus cette semaine ?",
  "Et la presse 3 ?",
  "Quels contrôles qualité a-t-on sur l'OF-2231 ?",
];

let session: string | undefined;
let [total, totalSans] = [0, 0];
console.log(`${"question".padEnd(42)} ${"appels".padStart(6)} ${"tokens lus".padStart(11)} ${"dont cache".padStart(11)} ${"coût".padStart(10)} ${"sans cache".padStart(11)}`);
for (const question of QUESTIONS) {
  const options = { ...creerOptions(session), hooks: {} }; // pas de trace d'outils : on ne regarde que les chiffres
  const m = await poser(question, options);
  session = m.session;
  total += m.cout;
  totalSans += m.coutSansCache;
  const part = Math.floor((100 * m.relusEnCache) / m.lus);
  console.log(
    `${question.slice(0, 42).padEnd(42)} ${String(m.appels).padStart(6)} ${milliers(m.lus).padStart(11)} ${String(part).padStart(10)} % ${m.cout.toFixed(5).padStart(8)} $ ${m.coutSansCache.toFixed(5).padStart(9)} $`,
  );
}
console.log(`\nLa conversation a coûté ${total.toFixed(5)} $. Sans cache, elle aurait coûté ${totalSans.toFixed(5)} $, soit ${(totalSans / total).toFixed(1)} fois plus.`);
