// La connexion à Langfuse. Fourni : c'est celle du TP 10.
//
// Le SDK Langfuse s'appuie sur OpenTelemetry : on déclare une fois où partent les traces.
// Ses réglages sont lus dans le fichier .env : LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY et LANGFUSE_BASE_URL.
// Sans ces lignes, rien n'est envoyé et le programme tourne quand même.

import "./agent.ts"; // charge le fichier .env avant de lire les réglages
import { LangfuseClient } from "@langfuse/client";
import { LangfuseSpanProcessor, isDefaultExportSpan } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

export const AVEC_LANGFUSE = Boolean(process.env.LANGFUSE_PUBLIC_KEY);

// Les traces : chaque observation terminée part vers Langfuse.
// shouldExportSpan : par défaut, Langfuse ne garde que les spans des bibliothèques qu'il reconnaît.
// Celle de variante_openinference.ts n'en fait pas partie en JavaScript : on l'ajoute.
const aGarder = ({ otelSpan }: { otelSpan: { instrumentationScope: { name: string } } }) =>
  isDefaultExportSpan(otelSpan as never) || otelSpan.instrumentationScope.name.startsWith("@arizeai/openinference");
export const traces = new NodeTracerProvider({ spanProcessors: AVEC_LANGFUSE ? [new LangfuseSpanProcessor({ shouldExportSpan: aGarder })] : [] });
traces.register();

// Le reste (scores, prompts, datasets) passe par le client.
export const langfuse = new LangfuseClient();

/** À appeler avant de quitter : attend que tout soit parti. */
export async function toutEnvoyer(): Promise<void> {
  if (!AVEC_LANGFUSE) return;
  await traces.forceFlush();
  await langfuse.flush();
}
