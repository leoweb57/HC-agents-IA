// Vérifie que le poste est prêt pour les TP : Node, clé API, appel minimal.

import Anthropic from "@anthropic-ai/sdk";
import { MODELE, envTrouve } from "./env.ts";

function echec(message: string): never {
  console.log(`ÉCHEC : ${message}`);
  process.exit(1);
}

// 1. Version de Node
const [majeure, mineure] = process.versions.node.split(".").map(Number);
if (majeure < 20 || (majeure === 20 && mineure < 12)) {
  echec(`Node 20.12 ou plus récent est requis (version trouvée : ${process.versions.node}).`);
}
console.log(`Node ${process.versions.node} : OK`);

// 2. Fichier .env et clé API (la clé n'est jamais affichée)
if (!envTrouve) {
  echec("Fichier .env introuvable. À la racine du dépôt : cp .env.example .env");
}
if (!process.env.ANTHROPIC_API_KEY) {
  echec("ANTHROPIC_API_KEY est vide dans .env.");
}
console.log("Clé API trouvée dans .env : OK");

// 3. Appel minimal
const client = new Anthropic();
try {
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 50,
    messages: [{ role: "user", content: "Réponds uniquement par le mot : prêt" }],
  });
  const texte = reponse.content
    .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("");
  console.log(`Appel à ${MODELE} : OK (réponse : ${JSON.stringify(texte.trim())})`);
  console.log("Tout est en place.");
} catch (erreur) {
  if (erreur instanceof Anthropic.AuthenticationError) {
    echec("La clé API est refusée. Vérifiez qu'elle est complète et active dans la Console Anthropic.");
  }
  if (erreur instanceof Anthropic.NotFoundError) {
    echec(`Le modèle « ${MODELE} » est inconnu. Vérifiez la variable MODELE dans .env.`);
  }
  if (erreur instanceof Anthropic.APIConnectionError) {
    echec("Impossible de joindre l'API. Vérifiez le réseau, le VPN ou le proxy (variable HTTPS_PROXY).");
  }
  if (erreur instanceof Anthropic.APIError) {
    echec(`L'API a répondu avec une erreur ${erreur.status} : ${erreur.message}`);
  }
  throw erreur;
}
