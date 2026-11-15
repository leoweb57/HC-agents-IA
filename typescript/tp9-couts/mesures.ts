// TP 9 : mesurer ce qu'une question a coûté. Fourni.
//
// Le SDK donne l'usage de chaque appel au modèle : ce qui a été lu sans cache, écrit en cache, relu en cache, et produit.

import { type Options, query } from "@anthropic-ai/claude-agent-sdk";

// Tarif public de Claude Haiku 5.5, en dollars par million de tokens (novembre 2026).
// Relire un token en cache coûte dix fois moins cher que le lire ; l'écrire en cache coûte 25 % de plus.
export const PRIX = { entree: 0.1, ecriture_cache: 0.125, lecture_cache: 0.01, sortie: 0.5 };

export type Mesures = {
  session: string;
  reponse: string;
  appels: number;
  tokensParAppel: number[];
  outils: string[];
  lus: number;
  relusEnCache: number;
  sortie: number;
  duree: number;
  cout: number; // ce que le tour a coûté, cache compris
  coutSansCache: number; // ce qu'il aurait coûté sans cache
  coutSession: number; // le total du SDK, cumulé depuis le début de la session
};

/** Pose une question et renvoie les mesures du tour. */
export async function poser(question: string, options: Options): Promise<Mesures> {
  const debut = performance.now();
  const dejaVus = new Set<string>();
  const tokensParAppel: number[] = [];
  const outils: string[] = [];
  let m: Mesures | undefined;
  for await (const message of query({ prompt: question, options })) {
    if (message.type === "assistant") {
      // Le SDK envoie un message par bloc de la réponse : on ne compte chaque appel au modèle qu'une fois.
      if (!dejaVus.has(message.message.id)) {
        dejaVus.add(message.message.id);
        const u = message.message.usage;
        tokensParAppel.push((u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0));
      }
      for (const bloc of message.message.content) if (bloc.type === "tool_use") outils.push(bloc.name);
    } else if (message.type === "result") {
      const u = message.usage;
      const [entree, ecriture, lecture, sortie] = [u.input_tokens ?? 0, u.cache_creation_input_tokens ?? 0, u.cache_read_input_tokens ?? 0, u.output_tokens ?? 0];
      const lus = entree + ecriture + lecture;
      m = {
        session: message.session_id,
        reponse: message.subtype === "success" ? message.result : "",
        appels: tokensParAppel.length,
        tokensParAppel,
        outils,
        lus,
        relusEnCache: lecture,
        sortie,
        duree: (performance.now() - debut) / 1000,
        cout: (entree * PRIX.entree + ecriture * PRIX.ecriture_cache + lecture * PRIX.lecture_cache + sortie * PRIX.sortie) / 1e6,
        coutSansCache: (lus * PRIX.entree + sortie * PRIX.sortie) / 1e6,
        coutSession: message.total_cost_usd ?? 0,
      };
    }
  }
  if (!m) throw new Error("Pas de résultat.");
  return m;
}

/** 12345 -> « 12 345 ». */
export function milliers(nombre: number): string {
  return nombre.toLocaleString("fr-FR").replace(/ /g, " ");
}

/** 2, « appel » -> « 2 appels ». */
export function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}
