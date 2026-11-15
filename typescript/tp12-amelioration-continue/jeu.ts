// TP 12 : le jeu de questions, c'est-à-dire le dataset. Fourni : celui du TP 11, qui sait maintenant s'enrichir.
//
// Un cas = une question, les points qu'une bonne réponse doit contenir, et ce qu'on attend du trajet
// (les outils à appeler, l'action à demander ou non). Les cas sont écrits et relus par quelqu'un du métier.
//
// Le fichier jeu_de_questions.json est la source. publierJeu() le copie dans un dataset Langfuse :
// chaque évaluation y devient alors un « run » qu'on compare aux précédents, cas par cas.
//
// Nouveau au TP 12 : les cas issus des retours s'ajoutent dans jeu_enrichi.json, qui prend alors le relais.
// Pour repartir du jeu d'origine, supprimez ce fichier.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TP } from "./agent.ts";
import { AVEC_LANGFUSE, langfuse } from "./langfuse.ts";

export const NOM = "atelier-questions";
const FICHIER = path.join(TP, "jeu_de_questions.json");
const ENRICHI = path.join(TP, "jeu_enrichi.json");

/** Un cas, au format que Langfuse attend : input, expectedOutput, metadata. */
export type Cas = {
  input: string;
  expectedOutput: { points: string[] };
  metadata: { id: string; outils: string[]; action?: Record<string, string> | null; format?: string | null; source: string };
  trace?: string; // la trace d'où vient le cas, quand il sort d'un retour utilisateur
};

export type CasDuFichier = { id: string; question: string; points_attendus: string[]; outils_attendus: string[]; action_attendue?: Record<string, string>; format?: string; source?: string; trace_id?: string };

/** Le jeu enrichi s'il existe, sinon le jeu d'origine. */
function casDuFichier(): CasDuFichier[] {
  return JSON.parse(readFileSync(existsSync(ENRICHI) ? ENRICHI : FICHIER, "utf-8"));
}

/** Ajoute des cas au jeu enrichi. Un cas qui existe déjà (même id) est remplacé : son attendu a changé. */
export function ajouterDesCas(nouveaux: CasDuFichier[]): void {
  const cas = new Map(casDuFichier().map((c) => [c.id, c]));
  for (const nouveau of nouveaux) cas.set(nouveau.id, nouveau);
  writeFileSync(ENRICHI, `${JSON.stringify([...cas.values()], null, 2)}\n`);
}

/** Les cas du fichier. */
export function casLocaux(): Cas[] {
  return casDuFichier().map((cas) => ({
    input: cas.question,
    expectedOutput: { points: cas.points_attendus },
    metadata: { id: cas.id, outils: cas.outils_attendus, action: cas.action_attendue ?? null, format: cas.format ?? null, source: cas.source ?? "métier" },
    trace: cas.trace_id,
  }));
}

/** Les cas du dataset Langfuse s'il existe (l'évaluation y sera rattachée), sinon ceux du fichier. */
export async function lireJeu(): Promise<Cas[]> {
  if (AVEC_LANGFUSE) {
    try {
      const cas = (await langfuse.dataset.get(NOM)).items;
      if (cas.length) return cas as unknown as Cas[];
    } catch {
      // le dataset n'est pas publié : on prend le fichier
    }
  }
  return casLocaux();
}

/** Copie le fichier dans le dataset Langfuse. Un cas déjà présent est mis à jour, pas dupliqué. */
export async function publierJeu(): Promise<void> {
  await langfuse.api.datasets.create({ name: NOM, description: "Questions de chefs d'équipe à l'agent d'atelier, avec les points attendus." });
  for (const cas of casLocaux()) {
    await langfuse.dataset.createItem({
      datasetName: NOM,
      id: `${NOM}-${cas.metadata.id}`,
      input: cas.input,
      expectedOutput: cas.expectedOutput,
      metadata: cas.metadata,
      sourceTraceId: cas.trace, // dans Langfuse, le cas renvoie à la conversation qui l'a fait naître
    });
  }
  console.log(`  dataset « ${NOM} » : ${casLocaux().length} cas`);
}
