// TP 12 : le prompt système de l'agent, géré dans Langfuse. Fourni : celui du TP 11, plus la mise en production.
//
// Dans Langfuse, un prompt a un nom, des versions numérotées (1, 2, 3…) et des étiquettes.
// Une étiquette désigne une version : « production » est celle que lit l'agent en service.
// Changer le prompt de l'agent, c'est déplacer l'étiquette : pas de livraison de code.
//
// Le dépôt garde une copie de chaque version dans prompts/ : elle sert à publier, et de secours sans Langfuse.

import { readFileSync } from "node:fs";
import path from "node:path";
import { TP } from "./agent.ts";
import { AVEC_LANGFUSE, langfuse } from "./langfuse.ts";
import type { PromptLangfuse } from "./suivi.ts";

export const NOM = "agent-atelier";

/** Le texte d'une version dans le dépôt. Sans Langfuse, la production reste la v1. */
export function copieLocale(etiquette: string): string {
  return readFileSync(path.join(TP, "prompts", `${etiquette === "production" ? "v1" : etiquette}.md`), "utf-8").trim();
}

/** Le prompt qui porte cette étiquette dans Langfuse, ou rien s'il n'y est pas. */
async function lirePrompt(etiquette: string): Promise<{ texte: string; version: number } | undefined> {
  if (!AVEC_LANGFUSE) return undefined;
  try {
    // On relit Langfuse à chaque fois. En production, on passerait par langfuse.prompt.get(), qui garde un cache d'une minute.
    const prompt = await langfuse.api.prompts.get(NOM, { label: etiquette });
    return prompt.type === "text" ? { texte: prompt.prompt, version: prompt.version } : undefined;
  } catch {
    return undefined; // pas publié, ou Langfuse injoignable : l'appelant prendra la copie du dépôt
  }
}

/** Le texte à donner à l'agent, et le prompt Langfuse à relier aux traces (ou rien). */
export async function texteDuPrompt(etiquette = "production"): Promise<{ systeme: string; prompt?: PromptLangfuse }> {
  const prompt = await lirePrompt(etiquette);
  if (!prompt) return { systeme: copieLocale(etiquette) };
  return { systeme: prompt.texte, prompt: { name: NOM, version: prompt.version, isFallback: false } };
}

/** Crée une nouvelle version du prompt dans Langfuse à partir du fichier prompts/<etiquette>.md. */
export async function publierPrompt(etiquette: string, message: string, enProduction = false): Promise<void> {
  const texte = copieLocale(etiquette);
  const existant = await lirePrompt(etiquette);
  if (existant && existant.texte.trim() === texte) {
    console.log(`  prompt « ${etiquette} » : déjà publié (version ${existant.version})`);
    return;
  }
  const etiquettes = [etiquette, ...(enProduction ? ["production"] : [])];
  const cree = await langfuse.prompt.create({ name: NOM, type: "text", prompt: texte, labels: etiquettes, commitMessage: message });
  console.log(`  prompt « ${etiquette} » : publié, version ${cree.version}, étiquettes ${JSON.stringify(etiquettes)}`);
}

/** Met une version en production : dans Langfuse, on déplace l'étiquette « production » sur elle. */
export async function promouvoir(etiquette: string): Promise<void> {
  const prompt = await lirePrompt(etiquette);
  if (!prompt) {
    console.log(`  « ${etiquette} » n'est pas publié dans Langfuse : rien à déplacer.`);
    return;
  }
  await langfuse.prompt.update({ name: NOM, version: prompt.version, newLabels: ["production"] });
  console.log(`  la version ${prompt.version} (« ${etiquette} ») porte maintenant l'étiquette « production ».`);
}
