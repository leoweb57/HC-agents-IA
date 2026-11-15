// TP 8, étape 4 : une sortie structurée, validée par un schéma.
//
// Un texte libre se lit. Une fiche se contrôle : chaque champ a un type, votre code peut la vérifier,
// la ranger en base, ou décider à partir d'elle. Le SDK valide la sortie contre le schéma et relance
// le modèle si elle n'est pas conforme.
//
// Lancement, depuis le dossier du TP :
//   npx tsx 4_sortie_structuree.ts

import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { creerOptions } from "./agent.ts";

/** Ce qu'on attend d'un diagnostic. Zod en tire le schéma JSON, puis vérifie la réponse. */
const FicheDiagnostic = z.object({
  machine_id: z.string().describe("P1 à P4, A1 ou C1"),
  arret_id: z.string(),
  ordre_fabrication: z.string(),
  cause: z.string(),
  recurrence_30_jours: z.number().int().describe("Nombre d'arrêts de même cause sur 30 jours, celui-ci compris"),
  etape_procedure: z.string(),
  recommandation: z.string(),
  proposer_demande_intervention: z.boolean(),
  priorite: z.enum(["normale", "haute"]),
});

const options = {
  ...creerOptions(),
  outputFormat: { type: "json_schema" as const, schema: z.toJSONSchema(FicheDiagnostic, { target: "draft-7" }) as Record<string, unknown> },
};
try {
  for await (const message of query({ prompt: "Diagnostique l'arrêt de ce matin sur la presse 4.", options })) {
    if (message.type !== "result") continue;
    if (message.subtype !== "success" || !message.structured_output) {
      console.log(`Pas de fiche valide : ${message.subtype}`);
      break;
    }
    // La fiche est déjà conforme au schéma. On la charge dans un objet typé.
    const fiche = FicheDiagnostic.parse(message.structured_output);
    console.log(`\n${JSON.stringify(fiche, null, 2)}\n`);
    // À partir d'ici, c'est du code ordinaire : une règle métier, sans modèle.
    if (fiche.recurrence_30_jours >= 3 && !fiche.proposer_demande_intervention) {
      console.log("Contrôle : trois arrêts en trente jours sans proposition d'intervention. À relire par une personne.");
    } else {
      console.log("Contrôle : la fiche respecte la règle « trois arrêts en trente jours → proposer une intervention ».");
    }
  }
} catch (erreur) {
  console.log(`La session s'est terminée sur une erreur : ${erreur}`);
}
