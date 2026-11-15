// Démonstration Managed Agents, étape 3 : supprimer ce qu'on a créé.
//
// Sur la plateforme, rien ne disparaît tout seul : les sessions (avec tout leur historique),
// les fichiers et l'agent restent chez Anthropic jusqu'à ce qu'on les supprime.
//
// Lancement, depuis le dossier de la démonstration :
//   npx tsx nettoyer.ts

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const IDENTIFIANTS = "identifiants.json";
if (!existsSync(IDENTIFIANTS)) {
  console.error("Rien à nettoyer : identifiants.json n'existe pas.");
  process.exit(0);
}
const ids = JSON.parse(readFileSync(IDENTIFIANTS, "utf-8"));

const client = new Anthropic();

/** Une suppression qui échoue ne doit pas empêcher les suivantes. */
async function essayer(quoi: string, action: () => Promise<unknown>) {
  try {
    await action();
    console.log(`${quoi} : fait`);
  } catch (erreur) {
    console.log(`${quoi} : ${erreur instanceof Error ? erreur.message : erreur}`);
  }
}

for (const sessionId of ids.sessions as string[]) {
  await essayer(`Session ${sessionId} supprimée`, () => client.beta.sessions.delete(sessionId));
}
for (const [nom, identifiant] of Object.entries(ids.fichiers as Record<string, string>)) {
  await essayer(`Fichier ${nom} supprimé`, () => client.beta.files.delete(identifiant));
}
// Un agent ne se supprime pas : il s'archive. Il reste lisible, mais on ne peut plus ouvrir de session avec lui.
await essayer("Agent archivé", () => client.beta.agents.archive(ids.agent_id));
await essayer("Environnement supprimé", () => client.beta.environments.delete(ids.environment_id));

unlinkSync(IDENTIFIANTS);
