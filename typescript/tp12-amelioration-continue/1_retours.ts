// TP 12, étape 1 : relire les retours des utilisateurs.
//
// Lancement, depuis le dossier du TP :
//   npx tsx 1_retours.ts
//
// Un retour négatif est un cas de test en puissance : une vraie question, posée par un vrai utilisateur,
// à laquelle l'agent a mal répondu.
//
// Dans Langfuse, la même relecture se fait à l'écran : filtrer les traces sur le score avis_utilisateur = 0.

import path from "node:path";
import { FICHIER, lireRetours } from "./retours.ts";

const retours = lireRetours();
const positifs = retours.filter((retour) => retour.utile).length;
console.log(`${path.basename(FICHIER)} : ${retours.length} retour(s), dont ${positifs} positif(s) et ${retours.length - positifs} négatif(s).`);
for (const retour of retours.filter((r) => !r.utile)) {
  console.log(`\n  Question    : ${retour.question}`);
  console.log(`  Réponse     : ${retour.reponse}`);
  console.log(`  Commentaire : ${retour.commentaire || "(aucun)"}`);
  console.log(`  Trace       : ${retour.trace_id}`);
}
