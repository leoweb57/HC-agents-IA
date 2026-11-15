// TP 12, étape 2 : transformer un retour en cas de test.
//
// Lancement, depuis le dossier du TP :
//   npx tsx 2_qualifier.ts
//
// Un retour négatif dit que quelque chose ne va pas. Il ne dit pas ce qu'il fallait répondre.
// Quelqu'un du métier l'écrit : c'est la qualification. Ici, ce travail est déjà fait, dans cas_qualifies.json :
//   - le cas « Où en est l'OF-2231 ? » existait : son attendu gagne un point (signaler l'arrêt du matin) ;
//   - un cas voisin vérifie que la correction vaut pour un autre ordre de fabrication ;
//   - un troisième vérifie le cas sans arrêt : l'agent doit dire qu'il n'y en a pas eu, sans en inventer.
//
// Le programme ajoute ces cas au jeu de questions : dans jeu_enrichi.json, et dans le dataset Langfuse.

import { readFileSync } from "node:fs";
import path from "node:path";
import { TP } from "./agent.ts";
import { type CasDuFichier, ajouterDesCas, casLocaux, publierJeu } from "./jeu.ts";
import { AVEC_LANGFUSE, toutEnvoyer } from "./langfuse.ts";
import { lireRetours } from "./retours.ts";

const retours = lireRetours();
const qualifies: CasDuFichier[] = JSON.parse(readFileSync(path.join(TP, "cas_qualifies.json"), "utf-8"));

// On relie chaque cas au retour qui l'a fait naître : même question, avis négatif.
// (Les retours d'exemple n'ont pas de vraie trace : on ne garde que les identifiants de trace de Langfuse.)
for (const cas of qualifies) {
  const origine = retours.find((r) => r.question === cas.question && !r.utile);
  if (origine && AVEC_LANGFUSE && !origine.trace_id.startsWith("exemple")) cas.trace_id = origine.trace_id;
}

ajouterDesCas(qualifies);
console.log(`Jeu de questions : ${casLocaux().length} cas, dont ${qualifies.length} issus des retours.`);
for (const cas of qualifies) console.log(`  ${cas.id} : ${cas.points_attendus.at(-1)}`);

if (AVEC_LANGFUSE) {
  await publierJeu();
  await toutEnvoyer();
} else {
  console.log("  (Langfuse n'est pas configuré : seul jeu_enrichi.json a été écrit.)");
}
