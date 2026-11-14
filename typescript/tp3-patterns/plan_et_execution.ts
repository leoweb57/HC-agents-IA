// TP 3, pattern 2 : Plan-and-Execute. Un premier appel écrit le plan, puis chaque étape est exécutée, puis on synthétise.
//
// Lancement, depuis le dossier du TP :
//   npx tsx plan_et_execution.ts

import { QUESTION, Compteur, appeler, boucleReact, texte } from "./react.ts";

const PLANIFICATEUR =
  "Tu prépares le travail d'un agent d'atelier. Nous sommes le vendredi 13 mars 2026. " +
  "Découpe la demande en 3 à 5 étapes courtes, dans l'ordre. " +
  "Chaque étape doit pouvoir se faire avec les outils disponibles. " +
  "N'appelle aucun outil maintenant. Réponds uniquement par une liste JSON de chaînes de caractères.";

/** 1. Planifier : un seul appel, sans exécuter d'outil. */
async function planifier(compteur: Compteur): Promise<string[]> {
  const reponse = await appeler(compteur, [{ role: "user", content: QUESTION }], PLANIFICATEUR);
  const brut = texte(reponse);
  // Le modèle entoure parfois le JSON de texte : on garde ce qui est entre les crochets.
  return JSON.parse(brut.slice(brut.indexOf("["), brut.lastIndexOf("]") + 1));
}

/** 2. Exécuter : une petite boucle ReAct par étape, avec les résultats des étapes précédentes. */
async function executerEtape(etape: string, notes: string[], compteur: Compteur, bavard: boolean): Promise<string> {
  const consigne =
    `Demande d'origine : ${QUESTION}\n\n` +
    `Résultats déjà obtenus :\n${notes.join("\n") || "aucun"}\n\n` +
    `Étape à réaliser maintenant : ${etape}\n` +
    "Donne uniquement les faits utiles pour cette étape, sans conclure.";
  return boucleReact([{ role: "user", content: consigne }], compteur, undefined, bavard);
}

/** 3. Synthétiser : un dernier appel, à partir des résultats de toutes les étapes. */
async function synthetiser(notes: string[], compteur: Compteur): Promise<string> {
  const consigne = `Demande : ${QUESTION}\n\nRésultats des étapes :\n${notes.join("\n")}\n\nRédige la réponse finale.`;
  return texte(await appeler(compteur, [{ role: "user", content: consigne }]));
}

export async function executer(bavard: boolean = true): Promise<[string, Compteur]> {
  const compteur = new Compteur();
  const plan = await planifier(compteur);
  const notes: string[] = [];
  for (const [index, etape] of plan.entries()) {
    if (bavard) console.log(`Étape ${index + 1} : ${etape}`);
    notes.push(`Étape ${index + 1} (${etape}) : ${await executerEtape(etape, notes, compteur, bavard)}`);
  }
  return [await synthetiser(notes, compteur), compteur];
}

if (process.argv[1] === import.meta.filename) {
  const [reponse, compteur] = await executer();
  console.log(`\n${reponse}\n`);
  console.log(`Plan-and-Execute : ${compteur}`);
}
