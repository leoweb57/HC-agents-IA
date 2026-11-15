// Démonstration Managed Agents, étape 2 : une conversation avec l'agent hébergé.
//
// On ouvre une session : un agent, dans un environnement, avec les fichiers de données.
// Ensuite on n'appelle plus de boucle : on échange des événements avec la plateforme.
//   - on envoie :  user.message
//   - on reçoit :  agent.tool_use, agent.message, session.status_idle…
// L'outil d'action est un outil maison : la plateforme ne l'exécute pas. Elle se met en attente
// (requires_action), on l'exécute ici, après accord, et on renvoie le résultat.
//
// Lancement, depuis le dossier de la démonstration :
//   npx tsx parler.ts                          une conversation au clavier
//   npx tsx parler.ts "Où en est l'OF-2231 ?"    une ou plusieurs questions, puis on quitte

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const IDENTIFIANTS = "identifiants.json";
const DEMANDES = "demandes_intervention.json";

if (!existsSync(IDENTIFIANTS)) {
  console.error("Lancez d'abord : npx tsx creer.ts");
  process.exit(1);
}
const ids = JSON.parse(readFileSync(IDENTIFIANTS, "utf-8"));

const client = new Anthropic();
const clavier = createInterface({ input: process.stdin, output: process.stdout });

const pluriel = (nombre: number, mot: string) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

/** L'outil d'action. Le même code qu'au TP 4 : il tourne ici, sur notre machine. */
function creerDemandeIntervention(parametres: Record<string, unknown>): string {
  const demandes = existsSync(DEMANDES) ? JSON.parse(readFileSync(DEMANDES, "utf-8")) : [];
  const demande = { id: `DI-${String(demandes.length + 1).padStart(4, "0")}`, ...parametres };
  demandes.push(demande);
  writeFileSync(DEMANDES, JSON.stringify(demandes, null, 2));
  return JSON.stringify(demande);
}

/** La plateforme attend : on demande l'accord, on exécute, on renvoie le résultat. */
async function repondreALOutilMaison(sessionId: string, demandeDOutil: { id: string; input: Record<string, unknown> }) {
  console.log(`  L'agent veut créer une demande d'intervention : ${JSON.stringify(demandeDOutil.input)}`);
  const reponse = await clavier.question("  Valider ? (o/n) ");
  const accord = reponse.trim().toLowerCase().startsWith("o");
  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.custom_tool_result",
        custom_tool_use_id: demandeDOutil.id,
        content: [
          {
            type: "text",
            text: accord ? creerDemandeIntervention(demandeDOutil.input) : "La création a été refusée par l'utilisateur.",
          },
        ],
        is_error: !accord,
      },
    ],
  });
}

/** Un tour de conversation : on envoie un message, on lit les événements jusqu'à la fin du tour. */
async function poser(sessionId: string, question: string) {
  const debut = Date.now();
  let appels = 0;
  let outils = 0;
  let tokensLus = 0;
  // Les demandes d'outil maison en attente, par identifiant d'événement.
  const outilsMaison = new Map<string, { id: string; input: Record<string, unknown> }>();

  // On ouvre le flux avant d'envoyer le message, pour ne manquer aucun événement.
  const flux = await client.beta.sessions.events.stream(sessionId);
  await client.beta.sessions.events.send(sessionId, {
    events: [{ type: "user.message", content: [{ type: "text", text: question }] }],
  });

  lecture: for await (const evenement of flux) {
    switch (evenement.type) {
      case "agent.tool_use": // un outil intégré, exécuté dans le bac à sable
        outils += 1;
        console.log(`  [agent.tool_use] ${evenement.name}(${JSON.stringify(evenement.input).slice(0, 150)})`);
        break;

      case "agent.custom_tool_use": // notre outil : la plateforme ne l'exécute pas
        outils += 1;
        outilsMaison.set(evenement.id, { id: evenement.id, input: evenement.input as Record<string, unknown> });
        console.log(`  [agent.custom_tool_use] ${evenement.name}`);
        break;

      case "agent.message": {
        const texte = evenement.content.map((bloc) => (bloc.type === "text" ? bloc.text : "")).join("");
        console.log(`\nAgent : ${texte}`);
        break;
      }

      case "span.model_request_end": { // la fin d'un appel au modèle, avec son usage
        appels += 1;
        const usage = evenement.model_usage;
        tokensLus += usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens;
        break;
      }

      case "session.status_idle": { // la session s'arrête : pourquoi ?
        const raison = evenement.stop_reason;
        console.log(`  [session.status_idle] ${raison.type}`);
        if (raison.type !== "requires_action") break lecture; // end_turn : l'agent a fini de répondre
        for (const identifiant of raison.event_ids) {
          const demandeDOutil = outilsMaison.get(identifiant); // elle nous attend
          if (demandeDOutil) await repondreALOutilMaison(sessionId, demandeDOutil);
        }
        break;
      }

      case "session.error":
      case "session.status_terminated":
        console.log(`  [${evenement.type}]`);
        break lecture;
    }
  }

  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  const tokens = tokensLus.toLocaleString("fr-FR").replace(/\s/g, " "); // 15 336 plutôt que 15336
  console.log(`  [${pluriel(appels, "appel")} au modèle, ${pluriel(outils, "outil")}, ${tokens} tokens lus, ${duree} s]`);
}

// Une session : un agent, dans un environnement, avec ses fichiers montés en lecture seule.
const session = await client.beta.sessions.create({
  agent: ids.agent_id,
  environment_id: ids.environment_id,
  title: "Démonstration formation",
  resources: Object.entries(ids.fichiers as Record<string, string>).map(([nom, identifiant]) => ({
    type: "file" as const,
    file_id: identifiant,
    mount_path: `/${nom}`,
  })),
});
ids.sessions.push(session.id);
writeFileSync(IDENTIFIANTS, JSON.stringify(ids, null, 2));
console.log(`Session ouverte : ${session.id}`);

const questions = process.argv.slice(2);
if (questions.length > 0) {
  for (const question of questions) {
    console.log(`\nVous : ${question}`);
    await poser(session.id, question);
  }
} else {
  console.log("Posez vos questions. Ligne vide pour quitter.");
  while (true) {
    const question = await clavier.question("\nVous : ");
    if (!question.trim()) break;
    await poser(session.id, question);
  }
}
clavier.close();
