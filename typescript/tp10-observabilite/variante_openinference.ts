// TP 10, variante : la même question, tracée par une instrumentation automatique.
//
//   npx tsx variante_openinference.ts "Où en est l'OF-2231 ?"
//
// C'est la voie que documente Langfuse pour le Claude Agent SDK : trois lignes, et le SDK est tracé.
// À comparer dans Langfuse avec la trace de terminal.ts : ici, une seule observation pour tout l'agent
// (tokens cumulés) et une par outil. Pas de détail appel par appel.

import * as ClaudeAgentSDK from "@anthropic-ai/claude-agent-sdk";
import { ClaudeAgentSDKInstrumentation } from "@arizeai/openinference-instrumentation-claude-agent-sdk";
import { observe, propagateAttributes } from "@langfuse/tracing";
import { creerOptions } from "./agent.ts";
import { toutEnvoyer, traces } from "./langfuse.ts";

// Les trois lignes : on enveloppe le module du SDK, et on appelle la fonction query de l'enveloppe.
const instrumentation = new ClaudeAgentSDKInstrumentation({ tracerProvider: traces });
const sdkTrace = instrumentation.manuallyInstrument(ClaudeAgentSDK);

const poser = observe(
  async (question: string) => {
    let reponse = "";
    for await (const message of sdkTrace.query({ prompt: question, options: creerOptions() })) {
      if (message.type === "result" && message.subtype === "success") reponse = message.result;
    }
    return reponse;
  },
  { name: "agent-atelier (OpenInference)" },
);

const question = process.argv[2] ?? "Où en est l'OF-2231 ?";
console.log(
  await propagateAttributes({ sessionId: "variante-openinference", userId: "chef-equipe-1", tags: ["atelier", "tp10", "variante"] }, () =>
    poser(question),
  ),
);
await toutEnvoyer();
