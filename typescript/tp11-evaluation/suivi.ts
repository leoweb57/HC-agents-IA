// TP 10 : construire la trace Langfuse d'une question. Fourni.
//
// Avec l'Agent SDK, la boucle tourne dans un autre processus : on ne peut pas décorer ses appels au modèle.
// Mais le SDK raconte tout dans son flux de messages. Ce fichier traduit ce flux en observations Langfuse :
//
//     agent-atelier                 la racine (créée par observe()) : la question, la réponse
//     ├── démarrage du SDK          le temps que met le SDK à lancer son processus, à chaque question
//     ├── appel au modèle           une « generation » : modèle, tokens, coût, ce que le modèle a répondu
//     ├── mcp__atelier__…           un « tool » : ses paramètres, son résultat, sa durée
//     └── appel au modèle           …
//
// Ce qu'on lit dans le flux, dans l'ordre où ça arrive :
//
//     system « init »               le SDK est prêt                        → le premier appel au modèle part
//     message_start                 le modèle commence à répondre          → on note le modèle et l'heure du premier token
//     assistant                     un bloc de sa réponse                  → du texte, ou une demande d'outil : l'outil part
//     message_delta, message_stop   il a fini                              → l'usage exact en tokens ; on ferme l'appel
//     user                          le résultat d'un outil                 → on ferme l'outil ; tous revenus : l'appel suivant part
//     result                        la fin du tour                         → la réponse et le coût

import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { type LangfuseGeneration, type LangfuseSpan, type LangfuseTool, startObservation, updateActiveObservation } from "@langfuse/tracing";

// Tarifs publics en dollars par million de tokens (novembre 2026) : lu, écrit en cache, relu en cache, produit.
// Langfuse calcule le coût tout seul pour les modèles qu'il connaît ; le lui donner évite d'en dépendre.
const PRIX: Record<string, Record<string, number>> = {
  "claude-haiku-5-5": { input: 0.1, cache_creation_input_tokens: 0.125, cache_read_input_tokens: 0.01, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, cache_creation_input_tokens: 2.5, cache_read_input_tokens: 0.2, output: 10 },
  "claude-opus-5-5": { input: 4, cache_creation_input_tokens: 5, cache_read_input_tokens: 0.4, output: 20 },
};

/** Le prompt géré dans Langfuse auquel relier les appels au modèle (TP 11). */
export type PromptLangfuse = { name: string; version: number; isFallback: boolean };

/** Le bilan d'un tour, pour l'afficher ou l'évaluer sans passer par Langfuse. */
export type Bilan = {
  reponse: string;
  outils: { nom: string; parametres: unknown }[];
  resultats: { outil: string; parametres: unknown; resultat: string }[];
  appels: number;
  tokens: number;
  cout: number;
  coutSdk: number;
  duree: number;
  session?: string;
};

/** Le résultat d'un outil arrive en texte, ou en liste de blocs de texte. */
function enTexte(contenu: unknown): string {
  if (Array.isArray(contenu)) return contenu.map((bloc) => (bloc as { text?: string }).text ?? "").join("\n");
  return contenu == null ? "" : String(contenu);
}

/** Suit une question. À créer dans la fonction enveloppée par observe() : ses observations s'accrochent dessous. */
export class Suivi {
  private demarrage: LangfuseSpan | undefined;
  private appel: LangfuseGeneration | undefined; // l'appel au modèle en cours
  private modele = "";
  private contenu: unknown[] = []; // ce que le modèle a produit pendant cet appel
  private outils = new Map<string, { observation: LangfuseTool; nom: string; parametres: unknown }>(); // les outils en cours
  private attendDesOutils = false;
  private debut = performance.now();
  bilan: Bilan = { reponse: "", outils: [], resultats: [], appels: 0, tokens: 0, cout: 0, coutSdk: 0, duree: 0 };

  constructor(
    private question: string,
    private prompt?: PromptLangfuse, // chaque appel au modèle y sera relié
  ) {
    this.demarrage = startObservation("démarrage du SDK");
  }

  /** Demande au SDK de signaler aussi le début et la fin de chaque réponse du modèle. */
  brancher(options: Options): Options {
    return { ...options, includePartialMessages: true };
  }

  /** À appeler pour chaque message que renvoie query(). */
  voir(message: SDKMessage): void {
    if (message.type === "system" && message.subtype === "init" && this.demarrage) {
      this.demarrage.end();
      this.demarrage = undefined;
      this.ouvrirAppel(this.question); // le SDK est prêt : le premier appel au modèle part avec la question
    } else if (message.type === "stream_event") {
      this.evenement(message.event as { type: string; [cle: string]: any });
    } else if (message.type === "assistant") {
      for (const bloc of message.message.content) {
        if (bloc.type === "text") {
          this.contenu.push(bloc.text);
        } else if (bloc.type === "tool_use") {
          // Le modèle demande un outil : le SDK le lance aussitôt.
          this.contenu.push({ outil: bloc.name, parametres: bloc.input });
          const observation = startObservation(bloc.name, { input: bloc.input }, { asType: "tool" });
          this.outils.set(bloc.id, { observation, nom: bloc.name, parametres: bloc.input });
          this.bilan.outils.push({ nom: bloc.name, parametres: bloc.input });
        }
      }
    } else if (message.type === "user" && Array.isArray(message.message.content)) {
      for (const bloc of message.message.content) {
        if (bloc.type === "tool_result" && this.outils.has(bloc.tool_use_id)) {
          this.fermerOutil(bloc.tool_use_id, enTexte(bloc.content), bloc.is_error === true);
        }
      }
      this.appelSuivant();
    } else if (message.type === "result") {
      this.fermerAppel();
      const reponse = message.subtype === "success" ? message.result : "";
      this.bilan = { ...this.bilan, reponse, coutSdk: message.total_cost_usd, duree: (performance.now() - this.debut) / 1000, session: message.session_id };
      updateActiveObservation({
        output: reponse,
        metadata: { appels_au_modele: this.bilan.appels, cout_cumule_sdk_usd: message.total_cost_usd, session_claude: message.session_id },
      });
    }
  }

  // ---------- les appels au modèle ----------

  private ouvrirAppel(entree: unknown): void {
    this.appel = startObservation("appel au modèle", { input: entree, prompt: this.prompt }, { asType: "generation" });
    this.contenu = [];
  }

  private fermerAppel(): void {
    if (this.appel) {
      this.appel.update({ output: this.contenu });
      this.appel.end();
      this.appel = undefined;
    }
  }

  /** Le modèle est rappelé quand sa réponse est finie et que tous les outils qu'il a demandés ont répondu. */
  private appelSuivant(): void {
    if (!this.appel && this.outils.size === 0 && this.attendDesOutils) {
      this.attendDesOutils = false;
      this.ouvrirAppel("(les résultats des outils)");
    }
  }

  private evenement(evenement: { type: string; [cle: string]: any }): void {
    if (evenement.type === "message_start") {
      // Le premier token arrive.
      if (!this.appel) this.ouvrirAppel("(suite)");
      this.modele = evenement.message.model;
      this.appel!.update({ model: this.modele, completionStartTime: new Date() });
    } else if (evenement.type === "message_delta" && this.appel) {
      // La réponse est complète : l'usage aussi.
      const u = evenement.usage;
      const usage: Record<string, number> = {
        input: u.input_tokens ?? 0,
        cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
        output: u.output_tokens ?? 0,
      };
      this.appel.update({ usageDetails: usage });
      const prix = PRIX[this.modele];
      if (prix) {
        const couts = Object.fromEntries(Object.entries(usage).map(([cle, valeur]) => [cle, (valeur * prix[cle]) / 1e6]));
        const total = Object.values(couts).reduce((a, b) => a + b, 0);
        this.appel.update({ costDetails: { ...couts, total } });
        this.bilan.cout += total;
      }
      this.bilan.appels += 1;
      this.bilan.tokens += Object.values(usage).reduce((a, b) => a + b, 0);
      this.attendDesOutils = evenement.delta?.stop_reason === "tool_use";
    } else if (evenement.type === "message_stop") {
      this.fermerAppel();
      this.appelSuivant();
    }
  }

  // ---------- les outils ----------

  private fermerOutil(id: string, resultat: string, enErreur: boolean): void {
    const { observation, nom, parametres } = this.outils.get(id)!;
    this.outils.delete(id);
    // En erreur : l'outil a échoué, ou la permission a été refusée.
    observation.update(enErreur ? { output: resultat, level: "ERROR", statusMessage: resultat.slice(0, 200) } : { output: resultat });
    observation.end();
    this.bilan.resultats.push({ outil: nom, parametres, resultat });
  }
}

/** Le bilan d'un tour, en une ligne. */
export function resume(bilan: Bilan): string {
  const s = (n: number) => (n > 1 ? "s" : "");
  const tokens = bilan.tokens.toLocaleString("fr-FR").replace(/ /g, " ");
  const cout = bilan.cout.toFixed(4).replace(".", ",");
  const duree = bilan.duree.toFixed(1).replace(".", ",");
  return `${bilan.appels} appel${s(bilan.appels)} au modèle · ${bilan.outils.length} outil${s(bilan.outils.length)} · ${tokens} tokens · ${cout} $ · ${duree} s`;
}
