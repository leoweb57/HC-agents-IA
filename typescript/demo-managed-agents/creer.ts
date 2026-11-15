// Démonstration Managed Agents, étape 1 : créer l'agent d'atelier sur la plateforme.
//
// Ce n'est pas un TP : c'est le code des slides du module 4, à lire et à lancer.
// On crée, une fois pour toutes :
//   - un environnement : le bac à sable où tourneront les outils de l'agent ;
//   - les fichiers de données de l'atelier, envoyés à la plateforme ;
//   - un agent : un modèle, un prompt système, des outils.
// Les identifiants sont écrits dans identifiants.json, que parler.ts et nettoyer.ts relisent.
//
// Lancement, depuis le dossier de la démonstration :
//   npx tsx creer.ts

import { createReadStream, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const MODELE = process.env.MODELE ?? "";
const DATA = path.resolve("../../data");
const FICHIERS = ["arrets_machine.json", "historique_arrets.json", "ordres_fabrication.json", "controles_qualite.json"];

// Le prompt système de l'agent v1 (TP 6 et 7), à une phrase près : celle qui dit où sont les données.
// Chez nous, l'agent les lisait avec les outils du serveur MCP. Ici, ce sont des fichiers.
const SYSTEME =
  // Le rôle
  "Tu es l'assistant de l'atelier d'injection. Tu aides les chefs d'équipe. " +
  // Le contexte
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. " +
  // Les données
  "Les données de l'atelier sont des fichiers JSON, dans /mnt/session/uploads/ : " +
  "arrets_machine.json (les arrêts de la semaine en cours), historique_arrets.json (tous les arrêts depuis janvier), " +
  "ordres_fabrication.json et controles_qualite.json. " +
  // Les règles
  "Réponds uniquement à partir de ces fichiers. Si une donnée manque, dis-le. " +
  "Ne crée une demande d'intervention que si on te le demande explicitement. " +
  // Le format
  "Réponds en français, en trois phrases au plus.";

// Le client lit ANTHROPIC_API_KEY dans l'environnement.
const client = new Anthropic();

// 1. L'environnement : un conteneur chez Anthropic, sans accès à Internet.
const environnement = await client.beta.environments.create({
  name: "atelier-formation",
  config: { type: "cloud", networking: { type: "limited" } },
});
console.log(`Environnement créé : ${environnement.id}`);

// 2. Les fichiers de données. On les envoie une fois ; chaque session les montera en lecture seule.
const fichiers: Record<string, string> = {};
for (const nom of FICHIERS) {
  const fichier = await client.beta.files.upload({ file: createReadStream(path.join(DATA, nom)) });
  fichiers[nom] = fichier.id;
  console.log(`Fichier envoyé : ${nom} (${fichier.id})`);
}

// 3. L'agent : la définition. Elle est versionnée : chaque modification crée une nouvelle version.
const agent = await client.beta.agents.create({
  name: "Agent d'atelier (formation)",
  model: MODELE,
  system: SYSTEME,
  tools: [
    // Les outils intégrés de la plateforme. Ils s'exécutent dans le bac à sable, pas chez nous.
    // On n'active que ceux qui servent à lire les fichiers : pas d'écriture, pas de web.
    {
      type: "agent_toolset_20260401",
      default_config: { enabled: false },
      configs: [
        { name: "bash", enabled: true },
        { name: "read", enabled: true },
        { name: "glob", enabled: true },
        { name: "grep", enabled: true },
      ],
    },
    // L'outil d'action du TP 4, déclaré comme un « outil maison » (custom).
    // La plateforme ne l'exécute pas : elle nous demandera de le faire. Voir parler.ts.
    {
      type: "custom",
      name: "creer_demande_intervention",
      description:
        "Crée une demande d'intervention de maintenance pour une machine. À n'utiliser que si l'utilisateur le demande.",
      input_schema: {
        type: "object",
        properties: {
          machine_id: { type: "string", description: "Identifiant de la machine, P1 à P4, A1 ou C1." },
          motif: { type: "string", description: "Motif de la demande, en une phrase." },
          priorite: { type: "string", description: "Priorité : normale ou haute." },
        },
        required: ["machine_id", "motif", "priorite"],
      },
    },
  ],
});
console.log(`Agent créé : ${agent.id}, version ${agent.version}`);

writeFileSync(
  "identifiants.json",
  JSON.stringify({ environment_id: environnement.id, agent_id: agent.id, fichiers, sessions: [] }, null, 2),
);
console.log("Identifiants écrits dans identifiants.json. Suite : npx tsx parler.ts");
