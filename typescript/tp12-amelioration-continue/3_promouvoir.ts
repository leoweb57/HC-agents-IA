// TP 12, étape 3 : mettre en production la version qui a passé l'évaluation.
//
// Lancement, depuis le dossier du TP :
//   npx tsx 3_promouvoir.ts v3
//
// Dans Langfuse, on déplace l'étiquette « production ». L'agent lit son prompt par cette étiquette :
// sa prochaine réponse utilise la nouvelle version, sans livraison de code ni redémarrage.
// Revenir en arrière, c'est remettre l'étiquette sur l'ancienne version : npx tsx 3_promouvoir.ts v1

import { promouvoir } from "./prompts.ts";

await promouvoir(process.argv[2] ?? "v3");
