// TP 10, variante : la même question, tracée par l'export OpenTelemetry du SDK lui-même.
//
//   npx tsx variante_otel_natif.ts "Où en est l'OF-2231 ?"
//
// Le processus du SDK sait exporter ses propres traces : on lui indique où, par des variables d'environnement.
// Aucun code à écrire. À comparer dans Langfuse avec la trace de terminal.ts : ici, chaque appel au modèle
// a sa durée et ses tokens exacts, chaque outil sa durée, mais le texte des échanges n'y est pas.
// Cet export est en bêta.

import { query } from "@anthropic-ai/claude-agent-sdk";
import { observe, propagateAttributes } from "@langfuse/tracing";
import { creerOptions } from "./agent.ts";
import { toutEnvoyer } from "./langfuse.ts";

// Langfuse reçoit de l'OpenTelemetry sur /api/public/otel, avec ses deux clés en authentification « Basic ».
const CLES = Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString("base64");
const EXPORT = {
  CLAUDE_CODE_ENABLE_TELEMETRY: "1",
  CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1", // les traces (les métriques et les journaux n'en ont pas besoin)
  OTEL_TRACES_EXPORTER: "otlp",
  OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
  OTEL_EXPORTER_OTLP_ENDPOINT: `${process.env.LANGFUSE_BASE_URL}/api/public/otel`,
  // Le second en-tête demande à Langfuse 4 d'afficher les traces tout de suite, et non avec plusieurs minutes de retard.
  OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Basic ${CLES},x-langfuse-ingestion-version=4`,
  OTEL_TRACES_EXPORT_INTERVAL: "1000", // en millisecondes : on n'attend pas pour envoyer
};

const poser = observe(
  async (question: string) => {
    // Les variables sont passées au processus du SDK, en plus de celles du programme.
    // Le SDK lui transmet aussi l'identité de notre trace : ses observations s'accrochent sous la nôtre.
    const options = { ...creerOptions(), env: { ...process.env, ...EXPORT } };
    let reponse = "";
    for await (const message of query({ prompt: question, options })) {
      if (message.type === "result" && message.subtype === "success") reponse = message.result;
    }
    return reponse;
  },
  { name: "agent-atelier (OTel natif)" },
);

const question = process.argv[2] ?? "Où en est l'OF-2231 ?";
console.log(
  await propagateAttributes({ sessionId: "variante-otel-natif", userId: "chef-equipe-1", tags: ["atelier", "tp10", "variante"] }, () => poser(question)),
);
await toutEnvoyer();
