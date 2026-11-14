// Charge le fichier .env de la racine du dépôt et expose le modèle à utiliser.
// À importer en première ligne de chaque TP : import { MODELE } from "../../env.ts";

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cheminEnv = fileURLToPath(new URL("../.env", import.meta.url));

export const envTrouve = existsSync(cheminEnv);
if (envTrouve) {
  process.loadEnvFile(cheminEnv);
}

export const MODELE = process.env.MODELE || "claude-haiku-5-5";
