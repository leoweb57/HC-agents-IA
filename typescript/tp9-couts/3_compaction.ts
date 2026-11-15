// TP 9, étape 3 : la compaction. Résumer la conversation pour libérer le contexte.
//
// Cinq questions dans une session, puis une dernière qui a besoin du début de la conversation.
//   npx tsx 3_compaction.ts sans      on laisse le contexte grossir
//   npx tsx 3_compaction.ts avec      on compacte avant la dernière question
//
// Le SDK compacte tout seul quand le contexte approche de sa limite. Ici on le déclenche à la main,
// en envoyant « /compact » comme un message, pour voir ce que ça change et ce que ça coûte.

import { query } from "@anthropic-ai/claude-agent-sdk";
import { creerOptions } from "./agent.ts";
import { milliers, pluriel, poser } from "./mesures.ts";

const QUESTIONS = [
  "Où en est l'OF-2231 ?",
  "Diagnostique l'arrêt de ce matin sur la presse 4.",
  "Quels arrêts la presse 3 a-t-elle eus cette semaine ?",
  "Quels contrôles qualité a-t-on sur l'OF-2231 ?",
  "La presse 4 a-t-elle souvent des défauts d'éjection ?",
];
const DERNIERE = "Rappelle-moi en une phrase l'avancement de l'OF-2231 et le nombre de non-conformes de son dernier contrôle.";

const options = (session?: string) => ({ ...creerOptions(session), hooks: {} });

async function compacter(session: string): Promise<void> {
  const debut = performance.now();
  for await (const message of query({ prompt: "/compact", options: options(session) })) {
    // Le SDK signale la compaction par un message système, avec la taille avant et après.
    if (message.type === "system" && message.subtype === "compact_boundary") {
      const c = message.compact_metadata;
      const duree = ((performance.now() - debut) / 1000).toFixed(1);
      console.log(`/compact : la conversation passe de ${milliers(c.pre_tokens)} à ${milliers(c.post_tokens ?? 0)} tokens, en ${duree} s`);
    }
  }
}

const avec = process.argv[2] === "avec";
let session: string | undefined;
for (const question of QUESTIONS) {
  const m = await poser(question, options(session));
  session = m.session;
  console.log(`${question.slice(0, 52).padEnd(52)} ${pluriel(m.appels, "appel")} · dernier appel ${milliers(m.tokensParAppel.at(-1) ?? 0).padStart(6)} tokens lus`);
}
if (avec && session) await compacter(session);
const m = await poser(DERNIERE, options(session));
console.log(`\n${DERNIERE}\n→ ${m.reponse}`);
console.log(`\n${pluriel(m.appels, "appel")} · ${milliers(m.tokensParAppel.at(-1) ?? 0)} tokens lus au dernier appel · outils rappelés : ${m.outils.length ? m.outils.join(", ") : "aucun"}`);
console.log(`Coût de toute la session : ${m.coutSession.toFixed(5)} $`);
