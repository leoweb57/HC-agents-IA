// TP 3, variante du pattern 2 : Plan-and-Execute avec replanification. Après chaque étape, le plan est révisé.
//
// Lancement, depuis le dossier du TP :
//   npx tsx replanification.ts

import { executerEtape, planifier, synthetiser } from "./plan_et_execution.ts";
import { QUESTION, Compteur, appeler, texte } from "./react.ts";

const LIMITE_ETAPES = 6;

const REPLANIFICATEUR =
  "Tu révises le plan d'un agent d'atelier en cours de route. Nous sommes le vendredi 13 mars 2026. " +
  "On te donne la demande, les résultats déjà obtenus et les étapes qui restent. " +
  "Garde, modifie, supprime ou ajoute des étapes selon ce que les résultats ont révélé. " +
  "Ne garde pas d'étape de rédaction : la réponse finale sera rédigée à part. " +
  "N'appelle aucun outil. Réponds uniquement par une liste JSON de chaînes de caractères (les étapes restantes), vide s'il n'y a plus rien à chercher.";

/** Un appel au modèle : il relit les résultats et renvoie la suite du plan, révisée. */
async function replanifier(notes: string[], plan: string[], compteur: Compteur): Promise<string[]> {
  const consigne =
    `Demande : ${QUESTION}\n\n` +
    `Résultats déjà obtenus :\n${notes.join("\n")}\n\n` +
    `Étapes restantes : ${JSON.stringify(plan)}`;
  const brut = texte(await appeler(compteur, [{ role: "user", content: consigne }], REPLANIFICATEUR));
  return JSON.parse(brut.slice(brut.indexOf("["), brut.lastIndexOf("]") + 1));
}

export async function executer(bavard: boolean = true): Promise<[string, Compteur]> {
  const compteur = new Compteur();
  let plan = await planifier(compteur);
  const notes: string[] = [];
  while (plan.length > 0 && notes.length < LIMITE_ETAPES) {
    const etape = plan.shift() as string;
    if (bavard) console.log(`Étape ${notes.length + 1} : ${etape}`);
    notes.push(`Étape ${notes.length + 1} (${etape}) : ${await executerEtape(etape, notes, compteur, bavard)}`);
    plan = await replanifier(notes, plan, compteur);
    if (bavard) console.log(`  plan révisé : ${JSON.stringify(plan)}`);
  }
  return [await synthetiser(notes, compteur), compteur];
}

if (process.argv[1] === import.meta.filename) {
  const [reponse, compteur] = await executer();
  console.log(`\n${reponse}\n`);
  console.log(`Plan-and-Execute avec replanification : ${compteur}`);
}
