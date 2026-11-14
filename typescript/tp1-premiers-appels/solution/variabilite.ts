// TP 1, étape 2 : envoyer cinq fois le même prompt et comparer (solution).
//
// Lancement, depuis le dossier du TP :
//   npx tsx solution/variabilite.ts

import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const MODELE = process.env.MODELE ?? "";
const NOMBRE_ESSAIS = 5;

const PROMPT_OUVERT = "Propose un nom pour un agent IA qui suit la production d'un atelier. Réponds par le nom seul.";
const PROMPT_ATELIER = "Pourquoi la presse 4 s'est-elle arrêtée ce matin ? Réponds en une phrase.";

const client = new Anthropic();

/** Envoie un prompt et renvoie le texte de la réponse. */
async function demander(prompt: string): Promise<string> {
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  return reponse.content
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("")
    .trim();
}

for (const prompt of [PROMPT_OUVERT, PROMPT_ATELIER]) {
  console.log(`Prompt : ${prompt}`);
  for (let numero = 1; numero <= NOMBRE_ESSAIS; numero++) {
    console.log(`  Essai ${numero} : ${await demander(prompt)}`);
  }
  console.log();
}
