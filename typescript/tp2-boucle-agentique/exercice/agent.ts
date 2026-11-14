// TP 2 : la boucle agentique écrite à la main.
//
// Lancement, depuis le dossier du TP :
//   npx tsx exercice/agent.ts

import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const MODELE = process.env.MODELE ?? "";
const DATA = "../../data";
const LIMITE_TOURS = 10;

const SYSTEME =
  "Tu es l'assistant d'un atelier de production. " +
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. " +
  "Réponds en français, en deux ou trois phrases, uniquement à partir des résultats des outils.";
const QUESTION = "Pourquoi la presse 4 s'est-elle arrêtée ce matin, et où en est l'ordre de fabrication qui était en cours ?";

// ---------- Les deux outils : les fonctions, exécutées par notre code (déjà écrites) ----------

type Enregistrement = Record<string, unknown>;

function lire(fichier: string): Enregistrement[] {
  return JSON.parse(readFileSync(`${DATA}/${fichier}`, "utf-8"));
}

function listerArrets(args: Record<string, string>): unknown {
  return lire("arrets_machine.json").filter((arret) => arret.machine_id === args.machine_id);
}

function lireOrdreFabrication(args: Record<string, string>): unknown {
  const ordre = lire("ordres_fabrication.json").find((o) => o.id === args.of_id);
  return ordre ?? { erreur: `Aucun ordre de fabrication ${args.of_id}.` };
}

const FONCTIONS: Record<string, (args: Record<string, string>) => unknown> = {
  lister_arrets: listerArrets,
  lire_ordre_fabrication: lireOrdreFabrication,
};

// ---------- Les deux outils : les descriptions, lues par le modèle (déjà écrites) ----------

const OUTILS: Anthropic.Tool[] = [
  {
    name: "lister_arrets",
    description:
      "Liste les arrêts d'une machine de l'atelier sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
    input_schema: {
      type: "object",
      properties: {
        machine_id: {
          type: "string",
          description:
            "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.",
        },
      },
      required: ["machine_id"],
    },
  },
  {
    name: "lire_ordre_fabrication",
    description:
      "Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.",
    input_schema: {
      type: "object",
      properties: {
        of_id: { type: "string", description: "Identifiant de l'ordre de fabrication, par exemple OF-2231." },
      },
      required: ["of_id"],
    },
  },
];

// ---------- La boucle : à vous ----------

const client = new Anthropic();

// La session : tout ce qu'on renvoie au modèle à chaque tour (paramètre messages de l'API).
const session: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];

// À FAIRE : écrire la boucle, limitée à LIMITE_TOURS tours.
//
// À chaque tour :
//   1. Appeler le modèle avec client.messages.create({...})
//      Paramètres : model, max_tokens, system: SYSTEME, tools: OUTILS, messages: session
//
//   2. Ajouter la réponse du modèle à la session :
//      session.push({ role: "assistant", content: reponse.content })
//
//   3. Si reponse.stop_reason n'est pas "tool_use" : afficher le texte et sortir de la boucle.
//
//   4. Sinon, pour chaque bloc de reponse.content dont le type est "tool_use" :
//        - exécuter la fonction : FONCTIONS[bloc.name](bloc.input as Record<string, string>)
//        - préparer un résultat :
//          { type: "tool_result", tool_use_id: bloc.id, content: JSON.stringify(sortie) }
//      puis ajouter tous les résultats à la session, dans un seul message :
//      session.push({ role: "user", content: resultats })
//      (resultats est un tableau de type Anthropic.ToolResultBlockParam[])
//
// Conseil : affichez le numéro du tour et l'outil demandé, pour voir la boucle travailler.
