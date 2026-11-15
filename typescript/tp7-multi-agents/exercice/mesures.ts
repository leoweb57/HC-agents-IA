// TP 7 : mesurer ce qu'une question a coûté. Fourni.
//
// On donne à la mesure chaque message que le SDK envoie pendant une question. Elle compte,
// agent par agent, les appels au modèle et les tokens lus, puis le nombre d'outils, la durée et le prix.

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export class Mesure {
  private debut = Date.now();
  private sousAgents = new Map<string, string>(); // identifiant d'une délégation -> nom du sous-agent
  private dejaVus = new Set<string>(); // les réponses du modèle déjà comptées
  agents = new Map<string, [number, number]>(); // nom de l'agent -> [appels au modèle, tokens lus]
  outils = 0; // appels d'outils, délégations non comprises
  duree = 0;
  cout = 0;
  reponse = "";

  voir(message: SDKMessage): void {
    if (message.type === "assistant") {
      // Un message qui vient d'un sous-agent porte l'identifiant de la délégation qui l'a lancé.
      const qui = message.parent_tool_use_id
        ? (this.sousAgents.get(message.parent_tool_use_id) ?? "sous-agent")
        : "principal";
      // Le SDK envoie un message par bloc de la réponse : on ne compte l'appel au modèle qu'une fois.
      if (!this.dejaVus.has(message.message.id)) {
        this.dejaVus.add(message.message.id);
        const u = message.message.usage;
        const lus = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        const compte = this.agents.get(qui) ?? [0, 0];
        this.agents.set(qui, [compte[0] + 1, compte[1] + lus]);
      }
      for (const bloc of message.message.content) {
        if (bloc.type === "tool_use") {
          if (bloc.name === "Agent" || bloc.name === "Task") {
            // une délégation : on retient à qui
            const entree = bloc.input as Record<string, unknown>;
            this.sousAgents.set(bloc.id, String(entree.subagent_type ?? "sous-agent"));
          } else {
            this.outils += 1;
          }
        }
      }
    } else if (message.type === "result") {
      this.duree = (Date.now() - this.debut) / 1000;
      this.cout = message.total_cost_usd ?? 0;
      this.reponse = message.subtype === "success" ? message.result : "Je n'ai pas pu répondre.";
    }
  }

  get appels(): number {
    return [...this.agents.values()].reduce((somme, compte) => somme + compte[0], 0);
  }

  get tokensLus(): number {
    return [...this.agents.values()].reduce((somme, compte) => somme + compte[1], 0);
  }

  /** Le détail par agent : « principal 2 appels, 11 265 tokens · maintenance 3 appels, 17 000 tokens ». */
  detail(): string {
    return [...this.agents.entries()]
      .map(([nom, [appels, tokens]]) => `${nom} ${pluriel(appels, "appel")}, ${milliers(tokens)} tokens`)
      .join(" · ");
  }

  /** Le résumé d'une question, sur une ligne. */
  ligne(): string {
    let texte =
      `${pluriel(this.appels, "appel")} au modèle, ${pluriel(this.outils, "outil")}, ` +
      `${milliers(this.tokensLus)} tokens lus, ${this.duree.toFixed(1)} s, ${this.cout.toFixed(4)} $`;
    if (this.agents.size > 1) texte += ` (${this.detail()})`;
    return texte;
  }
}

/** 2, « appel » -> « 2 appels ». */
export function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

/** 12345 -> « 12 345 ». */
export function milliers(nombre: number): string {
  return String(nombre).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
