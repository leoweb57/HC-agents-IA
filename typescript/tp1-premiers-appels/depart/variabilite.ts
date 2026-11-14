// TP 1, étape 3 : envoyer cinq fois le même prompt et comparer.
//
// Lancement, depuis le dossier typescript/ :
//   npx tsx tp1-premiers-appels/depart/variabilite.ts

import { MODELE } from "../../env.ts";

const NOMBRE_ESSAIS = 5;

const PROMPT_OUVERT = "Propose un nom pour un agent IA qui suit la production d'un atelier. Réponds par le nom seul.";
const PROMPT_ATELIER = "Pourquoi la presse 4 s'est-elle arrêtée ce matin ? Réponds en une phrase.";

// À FAIRE 1 : créer le client, comme à l'étape 2.

// À FAIRE 2 : écrire une fonction demander(prompt) qui envoie le prompt
//   et renvoie le texte de la réponse.

// À FAIRE 3 : pour chacun des deux prompts, appeler demander() NOMBRE_ESSAIS fois
//   et afficher les réponses numérotées, l'une sous l'autre.

console.log(`Modèle configuré : ${MODELE}. ${NOMBRE_ESSAIS} essais à faire pour :`);
console.log(`- ${PROMPT_OUVERT}`);
console.log(`- ${PROMPT_ATELIER}`);
