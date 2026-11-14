// TP 1, étape 3 : envoyer cinq fois le même prompt et comparer (solution).
//
// Lancement, depuis le dossier typescript/ :
//   npx tsx tp1-premiers-appels/solution/variabilite.ts
//   npx tsx tp1-premiers-appels/solution/variabilite.ts --temperature 0

import Anthropic from "@anthropic-ai/sdk";
import { MODELE } from "../../env.ts";

const NOMBRE_ESSAIS = 5;

const PROMPT_OUVERT = "Propose un nom pour un agent IA qui suit la production d'un atelier. Réponds par le nom seul.";
const PROMPT_ATELIER = "Pourquoi la presse 4 s'est-elle arrêtée ce matin ? Réponds en une phrase.";

const client = new Anthropic();

/** Lit l'option --temperature sur la ligne de commande. Absente : valeur par défaut de l'API. */
function lireTemperature(): number | undefined {
  const position = process.argv.indexOf("--temperature");
  if (position === -1) return undefined;
  const valeur = Number(process.argv[position + 1]);
  if (Number.isNaN(valeur)) {
    console.log("--temperature attend un nombre entre 0 et 1.");
    process.exit(1);
  }
  return valeur;
}

/** Envoie un prompt et renvoie le texte de la réponse. */
async function demander(prompt: string, temperature?: number): Promise<string> {
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
    ...(temperature === undefined ? {} : { temperature }),
  });
  return reponse.content
    .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("")
    .trim();
}

async function comparer(titre: string, prompt: string, temperature?: number): Promise<void> {
  console.log(`=== ${titre} ===`);
  console.log(`Prompt : ${prompt}`);
  const reponses: string[] = [];
  for (let numero = 1; numero <= NOMBRE_ESSAIS; numero++) {
    const texte = await demander(prompt, temperature);
    reponses.push(texte);
    console.log(`  Essai ${numero} : ${texte}`);
  }
  console.log(`  Réponses distinctes : ${new Set(reponses).size} sur ${NOMBRE_ESSAIS}`);
  console.log();
}

const temperature = lireTemperature();

try {
  await comparer("Prompt ouvert", PROMPT_OUVERT, temperature);
  await comparer("Question sur l'atelier", PROMPT_ATELIER, temperature);
} catch (erreur) {
  if (erreur instanceof Anthropic.BadRequestError) {
    // Par exemple : paramètre temperature refusé pour ce modèle.
    console.log(`L'API a refusé la requête : ${erreur.message}`);
  } else {
    throw erreur;
  }
}
