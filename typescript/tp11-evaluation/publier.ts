// TP 11, étape 1 : publier les prompts et le jeu de questions dans Langfuse.
//
// Lancement, depuis le dossier du TP :
//   npx tsx publier.ts
//
// À faire une fois. Sans Langfuse, on peut sauter cette étape : l'évaluation lira les fichiers du dépôt.

import { publierJeu } from "./jeu.ts";
import { AVEC_LANGFUSE, toutEnvoyer } from "./langfuse.ts";
import { publierPrompt } from "./prompts.ts";

if (!AVEC_LANGFUSE) {
  console.log("Langfuse n'est pas configuré : pas de LANGFUSE_PUBLIC_KEY dans le fichier .env. Rien à publier.");
  process.exit(1);
}
console.log("Publication dans Langfuse :");
await publierPrompt("v1", "Le prompt des jours 1 et 2.", true);
await publierPrompt("v2", "Réponses en une phrase, pour la lecture sur téléphone.");
await publierJeu();
await toutEnvoyer();
console.log("À voir dans Langfuse : Prompts > agent-atelier, et Datasets > atelier-questions.");
