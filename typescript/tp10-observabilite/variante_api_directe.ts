// TP 10, variante : un appel direct à l'API, tracé sans une ligne de traçage.
//
//   npx tsx variante_api_directe.ts
//
// Le SDK Anthropic émet lui-même une trace OpenTelemetry pour chaque appel à l'API : modèle, tokens, durée.
// Dès que Langfuse est branché, il la reçoit. Notre seul geste : observe() autour de notre fonction,
// pour que l'appel se range sous elle.
//
// C'est le cas simple, celui de la boucle écrite à la main au jour 1. Avec l'Agent SDK, les appels au modèle
// partent d'un autre processus : ce mécanisme ne les voit pas. D'où suivi.ts.

import Anthropic from "@anthropic-ai/sdk";
import { observe } from "@langfuse/tracing";
import { MODELE } from "./agent.ts";
import { toutEnvoyer } from "./langfuse.ts";

// « content » : la trace porte aussi le texte de la question et de la réponse. Par défaut, elle n'a que les mesures.
const client = new Anthropic({ openTelemetry: { traces: { contentMode: "content" } } });

const demander = observe(
  async (question: string) => {
    const reponse = await client.messages.create({ model: MODELE, max_tokens: 300, messages: [{ role: "user", content: question }] });
    const bloc = reponse.content.find((b) => b.type === "text");
    return bloc?.type === "text" ? bloc.text : "";
  },
  { name: "question-directe" },
);

console.log(await demander("En une phrase : à quoi sert un éjecteur sur une presse à injecter ?"));
await toutEnvoyer();
