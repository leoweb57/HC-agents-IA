// TP 7 : poser les mêmes questions aux deux agents, et comparer. Fourni.
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/comparer.ts         les trois questions
//   npx tsx exercice/comparer.ts 2       seulement la question 2
//
// Chaque question part d'une conversation neuve, d'abord avec l'agent v1, puis avec l'agent v2.

import { type Options, query } from "@anthropic-ai/claude-agent-sdk";
import { creerOptions as creerOptionsV1 } from "./agent_v1.ts";
import { creerOptions as creerOptionsV2 } from "./agent_v2.ts";
import { Mesure, milliers } from "./mesures.ts";

const QUESTIONS = [
  "Où en est l'OF-2231 ?",
  "Diagnostique l'arrêt de ce matin sur la presse 4.",
  "Fais le point sur l'OF-2231 : avancement, arrêts, qualité, et ce que tu recommandes.",
];

/** Pose une question dans une conversation neuve, et renvoie la mesure. */
async function poser(creerOptions: () => Options, question: string): Promise<Mesure> {
  const mesure = new Mesure();
  for await (const message of query({ prompt: question, options: creerOptions() })) {
    mesure.voir(message);
  }
  return mesure;
}

const choix = process.argv.slice(2).map(Number);
const numeros = choix.length ? choix : QUESTIONS.map((_, i) => i + 1);
const resultats: { numero: number; question: string; mesures: Record<string, Mesure> }[] = [];
const trait = "=".repeat(100);

for (const numero of numeros) {
  const question = QUESTIONS[numero - 1];
  console.log(`\n${trait}\nQuestion ${numero} : ${question}`);
  const mesures: Record<string, Mesure> = {};
  for (const [version, creerOptions] of [["v1", creerOptionsV1], ["v2", creerOptionsV2]] as const) {
    console.log(`\n--- Agent ${version}`);
    mesures[version] = await poser(() => creerOptions(), question);
    console.log(`\n${mesures[version].reponse}`);
  }
  resultats.push({ numero, question, mesures });
}

console.log(`\n${trait}\nRécapitulatif\n`);
console.log(
  "".padEnd(8) + "appels au modèle".padStart(18) + "outils".padStart(9) + "tokens lus".padStart(13) + "durée".padStart(10) + "coût".padStart(12),
);
for (const { numero, question, mesures } of resultats) {
  console.log(`\n${numero}. ${question}`);
  for (const [version, m] of Object.entries(mesures)) {
    console.log(
      `   ${version}`.padEnd(8) +
        String(m.appels).padStart(18) +
        String(m.outils).padStart(9) +
        milliers(m.tokensLus).padStart(13) +
        `${m.duree.toFixed(1)} s`.padStart(10) +
        `${m.cout.toFixed(4)} $`.padStart(12),
    );
    if (m.agents.size > 1) console.log(`        ${m.detail()}`);
  }
}
