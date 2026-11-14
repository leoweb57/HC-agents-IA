// TP 3 : lance les trois patterns sur la même demande et compare ce qu'ils consomment.
//
// Lancement, depuis le dossier du TP :
//   npx tsx comparer.ts

import { QUESTION, type Compteur, executer as react } from "./react.ts";
import { executer as planEtExecution } from "./plan_et_execution.ts";
import { executer as reflection } from "./reflection.ts";

console.log(`Demande : ${QUESTION}\n`);
const resultats: [string, Compteur][] = [];
for (const [nom, executer] of [
  ["ReAct", react],
  ["Plan-and-Execute", planEtExecution],
  ["Reflection", reflection],
] as const) {
  console.log(`--- ${nom} ---`);
  const [reponse, compteur] = await executer(false);
  console.log(`${reponse}\n`);
  resultats.push([nom, compteur]);
}

console.log("Pattern".padEnd(18) + "Appels".padStart(8) + "Tokens entrée".padStart(16) + "Tokens sortie".padStart(16));
for (const [nom, compteur] of resultats) {
  console.log(
    nom.padEnd(18) +
      String(compteur.appels).padStart(8) +
      String(compteur.entree).padStart(16) +
      String(compteur.sortie).padStart(16),
  );
}
