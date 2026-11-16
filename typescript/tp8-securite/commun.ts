// Fourni. Lance un agent, affiche ce qu'il fait, renvoie son dernier message.
//
// Les quatre scripts du TP s'en servent. Rien à modifier ici.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Options, type SDKResultMessage, query } from "@anthropic-ai/claude-agent-sdk";

const TP = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.join(TP, "../../.env")); // lit le fichier .env à la racine du dépôt
export const MODELE = process.env.MODELE ?? "";

/** Les options communes à tous les essais. Chaque script y ajoute ce qu'il veut montrer. */
export function options(reglages: Options): Options {
  return { model: MODELE, settingSources: [], maxTurns: 10, ...reglages };
}

/** Envoie la demande, affiche chaque appel d'outil et son résultat, puis renvoie le dernier message. */
export async function lancer(demande: string, opts: Options): Promise<SDKResultMessage> {
  console.log(`Demande : ${demande}\n`);
  let fin: SDKResultMessage | undefined;
  for await (const message of query({ prompt: demande, options: opts })) {
    if (message.type === "assistant") {
      for (const bloc of message.message.content) {
        if (bloc.type === "tool_use") console.log(`  [outil]    ${bloc.name}(${JSON.stringify(bloc.input)})`);
      }
    } else if (message.type === "user" && Array.isArray(message.message.content)) {
      for (const bloc of message.message.content) {
        if (bloc.type !== "tool_result") continue;
        const texte = typeof bloc.content === "string" ? bloc.content : (bloc.content ?? []).map((b) => ("text" in b ? b.text : "")).join(" ");
        console.log(`  [résultat] ${bloc.is_error ? "REFUSÉ ou en erreur" : "exécuté"} : ${JSON.stringify(texte.trim().slice(0, 120))}`);
      }
    } else if (message.type === "result") {
      fin = message;
    }
  }
  if (!fin) throw new Error("La session s'est terminée sans réponse.");
  return fin;
}

/** La réponse de l'agent, ou la raison de l'arrêt. */
export function reponse(fin: SDKResultMessage): string {
  return fin.subtype === "success" ? fin.result : fin.subtype;
}
