// TP 3, pattern 4 : le raisonnement intégré au modèle. Même boucle ReAct, deux niveaux d'effort.
//
// Les modèles récents réfléchissent avant de répondre. On ne l'écrit plus dans le prompt : on règle un niveau.
//
// Lancement, depuis le dossier du TP :
//   npx tsx raisonnement.ts

import { QUESTION, Compteur, type Effort, boucleReact } from "./react.ts";

for (const effort of ["low", "high"] as Effort[]) {
  const compteur = new Compteur();
  console.log(`=== Effort : ${effort} ===`);
  const reponse = await boucleReact([{ role: "user", content: QUESTION }], compteur, effort);
  console.log(`\n${reponse}\n`);
  console.log(`Effort ${effort} : ${compteur}\n`);
}
