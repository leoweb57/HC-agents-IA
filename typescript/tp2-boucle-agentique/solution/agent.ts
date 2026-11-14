// TP 2 : la boucle agentique écrite à la main (solution).
//
// Lancement, depuis le dossier du TP :
//   npx tsx solution/agent.ts

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

// ---------- Les deux outils : les fonctions, exécutées par notre code ----------

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

// ---------- Les deux outils : les descriptions, lues par le modèle ----------

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

// ---------- La boucle ----------

const client = new Anthropic();

// La session : tout ce qu'on renvoie au modèle à chaque tour (paramètre messages de l'API).
const session: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];

let termine = false;
for (let tour = 1; tour <= LIMITE_TOURS && !termine; tour++) {
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 1000,
    system: SYSTEME,
    tools: OUTILS,
    messages: session,
  });
  console.log(`Tour ${tour} : ${reponse.usage.input_tokens} tokens en entrée`);

  // 1. La réponse du modèle rejoint la session.
  session.push({ role: "assistant", content: reponse.content });

  // 2. Sortie normale : le modèle ne demande plus d'outil.
  if (reponse.stop_reason !== "tool_use") {
    console.log();
    console.log(
      reponse.content
        .filter((bloc) => bloc.type === "text")
        .map((bloc) => bloc.text)
        .join(""),
    );
    termine = true;
    continue;
  }

  // 3. Sinon, on exécute chaque outil demandé et on renvoie les résultats.
  const resultats: Anthropic.ToolResultBlockParam[] = [];
  for (const bloc of reponse.content) {
    if (bloc.type === "tool_use") {
      console.log(`  outil demandé : ${bloc.name}(${JSON.stringify(bloc.input)})`);
      const sortie = FONCTIONS[bloc.name](bloc.input as Record<string, string>);
      resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: JSON.stringify(sortie) });
    }
  }
  session.push({ role: "user", content: resultats });
}

// Sortie de secours : la limite de tours est atteinte.
if (!termine) {
  console.log("Limite de tours atteinte, arrêt.");
}
