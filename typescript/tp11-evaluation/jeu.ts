// TP 11 : le jeu de questions, c'est-à-dire le dataset. Fourni.
//
// Un cas = une question, les points qu'une bonne réponse doit contenir, et ce qu'on attend du trajet
// (les outils à appeler, l'action à demander ou non). Les cas sont écrits et relus par quelqu'un du métier.
//
// Le fichier jeu_de_questions.json est la source. publierJeu() le copie dans un dataset Langfuse :
// chaque évaluation y devient alors un « run » qu'on compare aux précédents, cas par cas.

import { readFileSync } from "node:fs";
import path from "node:path";
import { TP } from "./agent.ts";
import { AVEC_LANGFUSE, langfuse } from "./langfuse.ts";

export const NOM = "atelier-questions";
const FICHIER = path.join(TP, "jeu_de_questions.json");

/** Un cas, au format que Langfuse attend : input, expectedOutput, metadata. */
export type Cas = {
  input: string;
  expectedOutput: { points: string[] };
  metadata: { id: string; outils: string[]; action?: Record<string, string> | null; format?: string | null; source: string };
};

type CasDuFichier = { id: string; question: string; points_attendus: string[]; outils_attendus: string[]; action_attendue?: Record<string, string>; format?: string; source?: string };

/** Les cas du fichier. */
export function casLocaux(): Cas[] {
  return (JSON.parse(readFileSync(FICHIER, "utf-8")) as CasDuFichier[]).map((cas) => ({
    input: cas.question,
    expectedOutput: { points: cas.points_attendus },
    metadata: { id: cas.id, outils: cas.outils_attendus, action: cas.action_attendue ?? null, format: cas.format ?? null, source: cas.source ?? "métier" },
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
    await langfuse.dataset.createItem({ datasetName: NOM, id: `${NOM}-${cas.metadata.id}`, input: cas.input, expectedOutput: cas.expectedOutput, metadata: cas.metadata });
  }
  console.log(`  dataset « ${NOM} » : ${casLocaux().length} cas`);
}
