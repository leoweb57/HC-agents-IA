// TP 12 : lire les retours des utilisateurs. Fourni.
//
// Le terminal (terminal.ts) note chaque avis deux fois : un score sur la trace dans Langfuse, et une ligne
// dans retours.jsonl. On lit ici le fichier : tout le TP marche donc aussi sans Langfuse.
// Si vous n'avez pas encore donné d'avis, on lit les trois retours d'exemple.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { TP } from "./agent.ts";

export const FICHIER = existsSync(path.join(TP, "retours.jsonl")) ? path.join(TP, "retours.jsonl") : path.join(TP, "retours_exemple.jsonl");

export type Retour = { trace_id: string; question: string; reponse: string; utile: boolean; commentaire: string };

export function lireRetours(): Retour[] {
  return readFileSync(FICHIER, "utf-8").split("\n").filter((ligne) => ligne.trim()).map((ligne) => JSON.parse(ligne));
}
