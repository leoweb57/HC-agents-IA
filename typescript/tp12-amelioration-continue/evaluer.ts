// TP 12 : l'évaluation du TP 11, inchangée. On la rejoue sur le jeu enrichi par les retours.
//
// Lancement, depuis le dossier du TP :
//   npx tsx evaluer.ts v1 --reference  évalue la v1 sur le jeu enrichi et en fait la référence
//   npx tsx evaluer.ts v3              évalue la v3 et la compare à la référence
//
// Le programme se termine en erreur si la version évaluée fait moins bien que la référence :
// on peut le brancher sur l'intégration continue, comme des tests unitaires.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Evaluation, Evaluator, ExperimentItemResult } from "@langfuse/client";
import { observe, updateActiveObservation } from "@langfuse/tracing";
import { MODELE, OUTIL_D_ACTION, TP, creerOptions } from "./agent.ts";
import { type Cas, lireJeu } from "./jeu.ts";
import { CRITERES, MODELE_DU_JUGE, juger } from "./juge.ts";
import { langfuse, toutEnvoyer } from "./langfuse.ts";
import { texteDuPrompt } from "./prompts.ts";
import { type Bilan, Suivi } from "./suivi.ts";

const REFERENCE = path.join(TP, "reference.json");
const JUGEMENTS = Object.keys(CRITERES); // exactitude, complétude, ancrage, pertinence : notés 1 ou 0 par le juge
const CONTROLES = ["outils", "consignes"]; // notés 1 ou 0 par le code
const EFFORT = ["etapes", "cout", "duree"]; // mesurés : plus bas, c'est mieux
const QUALITE = [...JUGEMENTS, ...CONTROLES];
// L'écart toléré avant de parler de régression. Le juge et l'agent ne répondent pas deux fois pareil :
// sur dix cas, on a vu un cas basculer d'une évaluation à l'autre. Un contrôle par le code, lui, ne varie pas.
const TOLERANCE: Record<string, number> = Object.fromEntries([...JUGEMENTS.map((nom) => [nom, 0.1]), ...CONTROLES.map((nom) => [nom, 0])]);
const TITRES: Record<string, string> = { exactitude: "exact.", completude: "complét.", ancrage: "ancrage", pertinence: "pertin.", outils: "outils", consignes: "consignes", etapes: "étapes", cout: "coût $", duree: "durée s" };

const VERSION = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "v1";
const { systeme: SYSTEME, prompt: PROMPT } = await texteDuPrompt(VERSION);
const BILANS = new Map<string, Bilan>(); // question -> bilan du tour (outils appelés, résultats, coût) : les contrôles en ont besoin

// ---------- La tâche : l'agent répond à une question du jeu ----------

/** En évaluation, personne ne valide : l'action n'est jamais exécutée. On vérifie seulement qu'elle a été demandée. */
const refuser = async () => false;

const repondre = observe(
  async (question: string): Promise<Bilan> => {
    updateActiveObservation({ input: question }, { asType: "agent" });
    const suivi = new Suivi(question, PROMPT); // chaque appel au modèle sera relié à la version du prompt
    const options = suivi.brancher(creerOptions(SYSTEME, undefined, refuser, false));
    for await (const message of query({ prompt: question, options })) suivi.voir(message);
    return suivi.bilan;
  },
  { name: "agent-atelier", asType: "agent", captureInput: false, captureOutput: false },
);

async function tache(cas: { input?: unknown }): Promise<string> {
  const question = String(cas.input);
  const bilan = await repondre(question);
  BILANS.set(question, bilan);
  return bilan.reponse;
}

// ---------- Les contrôles par le code : gratuits, immédiats, toujours le même verdict ----------

const controles: Evaluator<string, Cas["expectedOutput"], Cas["metadata"]> = async ({ input, output, metadata }) => {
  const bilan = BILANS.get(input)!;
  const appeles = bilan.outils.map((outil) => outil.nom.split("__").at(-1) ?? "");
  const manquants = (metadata?.outils ?? []).filter((nom) => !appeles.includes(nom));

  // Les consignes qu'un programme sait vérifier : l'action et le format.
  const ecarts: string[] = [];
  const demandes = bilan.outils.filter((outil) => outil.nom === OUTIL_D_ACTION).map((outil) => outil.parametres as Record<string, unknown>);
  const attendue = metadata?.action;
  if (demandes.length && !attendue) ecarts.push("une action a été demandée sans qu'on la réclame");
  if (attendue && !demandes.some((d) => Object.entries(attendue).every(([cle, valeur]) => String(d[cle] ?? "").toLowerCase() === valeur.toLowerCase()))) {
    ecarts.push(`l'action attendue n'a pas été demandée avec ${JSON.stringify(attendue)}`);
  }
  if (metadata?.format === "diagnostic") {
    for (const ligne of ["Constat", "Récurrence", "Procédure", "Recommandation"]) if (!String(output).includes(ligne)) ecarts.push(`ligne « ${ligne} » absente`);
  }

  return [
    { name: "outils", value: manquants.length ? 0 : 1, comment: manquants.length ? `non appelés : ${manquants}` : `appelés : ${appeles}` },
    { name: "consignes", value: ecarts.length ? 0 : 1, comment: ecarts.join(" ; ") || "action et format conformes" },
    { name: "etapes", value: bilan.appels, comment: "appels au modèle" },
    { name: "cout", value: Number(bilan.coutSdk.toFixed(6)), comment: "dollars" },
    { name: "duree", value: Number(bilan.duree.toFixed(1)), comment: "secondes" },
  ];
};

// ---------- Les jugements : un appel au modèle juge par critère ----------

const OUTILS_DE_L_AGENT =
  "Outils dont dispose l'assistant : les arrêts d'une machine sur la semaine en cours, l'historique des arrêts d'une machine, " +
  "les contrôles qualité et le détail d'un ordre de fabrication, la création d'une demande d'intervention. Il n'en a pas d'autre.";

/** Ce que l'agent avait le droit de savoir : son prompt système, ses outils, et ses appels avec leurs résultats. */
function sources(bilan: Bilan): string {
  const appels = bilan.resultats.map((r) => `Appel : ${r.outil}(${JSON.stringify(r.parametres)})\nRésultat : ${r.resultat}`);
  return [`Contexte donné à l'assistant : ${SYSTEME}`, OUTILS_DE_L_AGENT, ...appels].join("\n\n");
}

/** Fabrique l'évaluateur d'un critère. */
function jugement(critere: string): Evaluator<string, Cas["expectedOutput"], Cas["metadata"]> {
  return async ({ input, output, expectedOutput }) => {
    const verdict = await juger(critere, {
      question: input,
      reponse: String(output),
      points: (expectedOutput?.points ?? []).map((point) => `- ${point}`).join("\n"),
      sources: sources(BILANS.get(input)!),
    });
    return { name: critere, value: verdict.verdict ? 1 : 0, comment: verdict.raisonnement };
  };
}

/** Les moyennes du jeu entier : c'est elles qu'on compare d'une version à l'autre. */
function calculerMoyennes(resultats: ExperimentItemResult[]): Record<string, number> {
  const notes: Record<string, number[]> = {};
  for (const resultat of resultats) for (const e of resultat.evaluations) (notes[e.name] ??= []).push(Number(e.value));
  return Object.fromEntries(Object.entries(notes).map(([nom, valeurs]) => [nom, Number((valeurs.reduce((a, b) => a + b, 0) / valeurs.length).toFixed(4))]));
}

const moyennes = async ({ itemResults }: { itemResults: ExperimentItemResult[] }): Promise<Evaluation[]> =>
  Object.entries(calculerMoyennes(itemResults)).map(([nom, valeur]) => ({ name: `moyenne_${nom}`, value: valeur }));

// ---------- L'affichage et la comparaison ----------

const idDuCas = (resultat: ExperimentItemResult): string => (resultat.item.metadata as Cas["metadata"]).id;

function afficher(resultats: ExperimentItemResult[]): void {
  console.log(`\n${"cas".padEnd(24)}${[...QUALITE, ...EFFORT].map((c) => TITRES[c].padStart(10)).join("")}`);
  for (const resultat of [...resultats].sort((a, b) => idDuCas(a).localeCompare(idDuCas(b)))) {
    const notes = Object.fromEntries(resultat.evaluations.map((e) => [e.name, Number(e.value)]));
    const cellules: string[] = QUALITE.map((c) => (notes[c] === 1 ? "oui" : notes[c] === 0 ? "NON" : "?")); // « ? » : l'évaluateur a échoué
    cellules.push((notes.etapes ?? 0).toFixed(0), (notes.cout ?? 0).toFixed(4), (notes.duree ?? 0).toFixed(1));
    console.log(`${idDuCas(resultat).padEnd(24)}${cellules.map((c) => c.padStart(10)).join("")}`);
    for (const e of resultat.evaluations) if (QUALITE.includes(e.name) && e.value !== 1) console.log(`    ${e.name} : ${e.comment}`);
  }
}

/** Affiche les moyennes face à la référence. Renvoie true s'il y a une régression. */
function comparer(actuelles: Record<string, number>): boolean {
  const reference = existsSync(REFERENCE) ? (JSON.parse(readFileSync(REFERENCE, "utf-8")) as { version: string; modele: string; date: string; moyennes: Record<string, number> }) : undefined;
  console.log(`\n${"moyenne".padEnd(14)}${VERSION.padStart(10)}${reference ? `${"référence".padStart(12)}${"écart".padStart(10)}` : ""}`);
  let regression = false;
  for (const nom of [...QUALITE, ...EFFORT]) {
    const chiffres = nom === "cout" ? 4 : 2;
    const valeur = actuelles[nom] ?? 0;
    let ligne = `${TITRES[nom].padEnd(14)}${valeur.toFixed(chiffres).padStart(10)}`;
    if (reference) {
      const avant = reference.moyennes[nom] ?? 0;
      const ecart = valeur - avant;
      ligne += `${avant.toFixed(chiffres).padStart(12)}${`${ecart >= 0 ? "+" : ""}${ecart.toFixed(chiffres)}`.padStart(10)}`;
      if (QUALITE.includes(nom) && valeur < avant - TOLERANCE[nom] - 1e-9) {
        ligne += "   RÉGRESSION";
        regression = true;
      }
    }
    console.log(ligne);
  }
  if (reference) console.log(`(référence : ${reference.version}, ${reference.modele}, le ${reference.date})`);
  return regression;
}

const cas = await lireJeu();
console.log(`Évaluation du prompt ${VERSION} (${PROMPT ? `version ${PROMPT.version} dans Langfuse` : "copie du dépôt"}) : ${cas.length} cas, agent ${MODELE}, juge ${MODELE_DU_JUGE}.`);
const maintenant = new Date();
const resultat = await langfuse.experiment.run({
  name: "agent-atelier",
  runName: `${VERSION} · ${MODELE} · ${maintenant.toLocaleString("fr-FR")}`,
  data: cas,
  task: tache,
  evaluators: [controles, ...JUGEMENTS.map(jugement)],
  runEvaluators: [moyennes],
  maxConcurrency: 3, // trois questions à la fois : chacune lance un processus du SDK
  metadata: { prompt: VERSION, modele: MODELE, juge: MODELE_DU_JUGE },
});
await toutEnvoyer();

afficher(resultat.itemResults);
const notesAttendues = cas.length * QUALITE.length;
const notesRecues = resultat.itemResults.flatMap((r) => r.evaluations).filter((e) => QUALITE.includes(e.name)).length;
if (notesRecues < notesAttendues) {
  // Une question ou un juge en échec : on ne conclut pas sur une évaluation à trous.
  console.log(`\nÉvaluation incomplète : ${notesRecues} notes sur ${notesAttendues}. Voir les erreurs plus haut, puis relancer.`);
  process.exit(2);
}
const actuelles = calculerMoyennes(resultat.itemResults);
const regression = comparer(actuelles);

if (process.argv.includes("--reference")) {
  writeFileSync(REFERENCE, JSON.stringify({ version: VERSION, modele: MODELE, date: maintenant.toLocaleDateString("fr-FR"), moyennes: actuelles }, null, 2));
  console.log(`\nRéférence enregistrée dans ${path.basename(REFERENCE)}.`);
} else if (regression) {
  console.log(`\nRégression : le prompt ${VERSION} fait moins bien que la référence. On ne le met pas en production.`);
  process.exit(1);
}
