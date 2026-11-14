// TP 4, partie 3 : une interface de discussion dans le navigateur.
//
// Un petit serveur web, sans dépendance de plus : il sert la page interface.html
// et fait le lien entre cette page et l'agent.
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/interface.ts
// Puis ouvrir http://localhost:8000

import { readFileSync } from "node:fs";
import { type IncomingMessage, createServer } from "node:http";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { creerOptions } from "./agent.ts";

const PORT = 8000;
const PAGE = readFileSync(new URL("./interface.html", import.meta.url), "utf-8");

// Les demandes d'accord en attente : la page répond plus tard, par une autre requête.
const accordsEnAttente = new Map<string, (accord: boolean) => void>();

async function lireJson(requete: IncomingMessage): Promise<any> {
  let corps = "";
  for await (const morceau of requete) corps += morceau;
  return JSON.parse(corps || "{}");
}

createServer(async (requete, reponse) => {
  // La page de discussion
  if (requete.method === "GET" && requete.url === "/") {
    reponse.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(PAGE);
    return;
  }

  // La page répond à une demande d'accord : { id, accord }
  if (requete.method === "POST" && requete.url === "/accord") {
    const { id, accord } = await lireJson(requete);
    accordsEnAttente.get(id)?.(Boolean(accord));
    accordsEnAttente.delete(id);
    reponse.writeHead(204).end();
    return;
  }

  // La page envoie un message : { texte, sessionId }. On lui renvoie des événements, un par ligne.
  if (requete.method === "POST" && requete.url === "/message") {
    const { texte, sessionId } = await lireJson(requete);
    reponse.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8" });
    const envoyer = (evenement: object) => reponse.write(`${JSON.stringify(evenement)}\n`);

    // Quand l'agent veut agir, on prévient la page et on attend sa réponse.
    const demanderAccord = (nomOutil: string, parametres: Record<string, unknown>) =>
      new Promise<boolean>((resoudre) => {
        const id = crypto.randomUUID();
        accordsEnAttente.set(id, resoudre);
        envoyer({ type: "accord", id, parametres });
      });

    try {
      for await (const message of query({ prompt: texte, options: creerOptions(sessionId, demanderAccord) })) {
        if (message.type === "assistant") {
          for (const bloc of message.message.content) {
            if (bloc.type === "tool_use") envoyer({ type: "outil", nom: bloc.name, parametres: bloc.input });
          }
        } else if (message.type === "result") {
          envoyer({
            type: "reponse",
            texte: message.subtype === "success" ? message.result : "Je n'ai pas pu répondre.",
            sessionId: message.session_id,
          });
        }
      }
    } catch (erreur) {
      envoyer({ type: "reponse", texte: `Erreur : ${erreur}`, sessionId });
    }
    reponse.end();
    return;
  }

  reponse.writeHead(404).end();
}).listen(PORT, () => console.log(`Interface de discussion : http://localhost:${PORT}`));
