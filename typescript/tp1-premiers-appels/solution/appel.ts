// TP 1, étape 1 : un premier appel à l'API Messages (solution).
//
// Lancement, depuis le dossier du TP :
//   npx tsx solution/appel.ts

import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const MODELE = process.env.MODELE ?? "";
const PROMPT = "Explique en deux phrases ce qu'est un MES (Manufacturing Execution System).";

// Le client lit ANTHROPIC_API_KEY dans l'environnement.
const client = new Anthropic();

const reponse = await client.messages.create({
  model: MODELE,
  max_tokens: 300,
  messages: [{ role: "user", content: PROMPT }],
});

// content est une liste de blocs : on garde ceux qui portent du texte.
const texte = reponse.content
  .filter((bloc) => bloc.type === "text")
  .map((bloc) => bloc.text)
  .join("");

console.log(texte);
console.log();
console.log(`Modèle : ${reponse.model}`);
console.log(`Tokens en entrée : ${reponse.usage.input_tokens}`);
console.log(`Tokens en sortie : ${reponse.usage.output_tokens}`);
