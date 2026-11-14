// TP 1, étape 2 : envoyer cinq fois le même prompt et comparer.
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/variabilite.ts

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const MODELE = process.env.MODELE ?? "";
const NOMBRE_ESSAIS = 5;

const PROMPT_OUVERT = "Propose un nom pour un agent IA qui suit la production d'un atelier. Réponds par le nom seul.";
const PROMPT_ATELIER = "Pourquoi la presse 4 s'est-elle arrêtée ce matin ? Réponds en une phrase.";

// À FAIRE 1 : créer le client, comme à l'étape 1.

// À FAIRE 2 : écrire une fonction demander(prompt) qui envoie le prompt
//   et renvoie le texte de la réponse.

// À FAIRE 3 : pour chacun des deux prompts, appeler demander() NOMBRE_ESSAIS fois
//   et afficher les réponses numérotées, l'une sous l'autre.

export {};
