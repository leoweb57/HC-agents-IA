// TP 1, étape 2 : un premier appel à l'API Messages (solution).
//
// Lancement, depuis le dossier typescript/ :
//   npx tsx tp1-premiers-appels/solution/appel.ts

import Anthropic from "@anthropic-ai/sdk";
import { MODELE } from "../../env.ts";

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
  .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === "text")
  .map((bloc) => bloc.text)
  .join("");

console.log(texte);
console.log();
console.log(`Modèle : ${reponse.model}`);
console.log(`Tokens en entrée : ${reponse.usage.input_tokens}`);
console.log(`Tokens en sortie : ${reponse.usage.output_tokens}`);
console.log(`Raison de l'arrêt : ${reponse.stop_reason}`);
