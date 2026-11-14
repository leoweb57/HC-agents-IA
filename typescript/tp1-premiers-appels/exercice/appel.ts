// TP 1, étape 1 : un premier appel à l'API Messages.
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/appel.ts

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const MODELE = process.env.MODELE ?? "";
const PROMPT = "Explique en deux phrases ce qu'est un MES (Manufacturing Execution System).";

// À FAIRE 1 : importer le SDK (import Anthropic from "@anthropic-ai/sdk") et créer le client.
//   La clé ANTHROPIC_API_KEY est lue automatiquement dans l'environnement.

// À FAIRE 2 : envoyer PROMPT au modèle avec client.messages.create({...})
//   Paramètres obligatoires : model, max_tokens, messages.

// À FAIRE 3 : afficher le texte de la réponse.
//   La réponse contient une liste de blocs (content) ; le texte est dans les blocs de type "text".

// À FAIRE 4 : afficher les tokens consommés en entrée et en sortie (usage).

export {};
