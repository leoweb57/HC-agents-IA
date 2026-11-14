// Énigme 3, corrigée : l'agent tournait en rond.
//
// Lancement, depuis le dossier du TP :
//   npx tsx enigmes/enigme3_solution.ts
//
// Question à poser : Quels arrêts a eus la presse 4 cette semaine ?

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile("../../.env");

const MODELE = process.env.MODELE ?? "";
const DATA = "../../data";
const LIMITE_TOURS = 10;

const SYSTEME =
  "Tu es l'assistant d'un atelier de production. " +
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. " +
  "Réponds en français, en deux ou trois phrases, uniquement à partir des résultats des outils.";

type Enregistrement = Record<string, unknown>;

function listerArrets(args: Record<string, string>): Enregistrement[] {
  const arrets: Enregistrement[] = JSON.parse(readFileSync(`${DATA}/arrets_machine.json`, "utf-8"));
  return arrets.filter((arret) => arret.machine_id === args.machine_id);
}

const FONCTIONS: Record<string, (args: Record<string, string>) => Enregistrement[]> = {
  lister_arrets: listerArrets,
};

const OUTILS: Anthropic.Tool[] = [
  {
    name: "lister_arrets",
    description: "Liste les arrêts d'une machine de l'atelier sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
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
];

async function lireQuestion(): Promise<string> {
  const saisie = process.argv.slice(2).join(" ");
  if (saisie) return saisie;
  const clavier = createInterface({ input: process.stdin, output: process.stdout });
  const question = await clavier.question("Votre question : ");
  clavier.close();
  return question;
}

const client = new Anthropic();
const session: Anthropic.MessageParam[] = [{ role: "user", content: await lireQuestion() }];
let termine = false;

// CORRECTION 3 : une vraie limite de tours remplace le "while (true)".
// La boucle a désormais deux sorties : la réponse du modèle, ou la limite.
for (let tour = 1; tour <= LIMITE_TOURS && !termine; tour++) {
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 1000,
    system: SYSTEME,
    tools: OUTILS,
    messages: session,
  });

  // CORRECTION 1 : la réponse du modèle est ajoutée à la session.
  // Avant, rien n'y était ajouté : à chaque tour, le modèle recevait la question seule,
  // sans trace de sa demande précédente, et refaisait donc la même.
  session.push({ role: "assistant", content: reponse.content });

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

  const resultats: Anthropic.ToolResultBlockParam[] = [];
  for (const bloc of reponse.content) {
    if (bloc.type === "tool_use") {
      const sortie = FONCTIONS[bloc.name](bloc.input as Record<string, string>);
      console.log(`Tour ${tour} : ${bloc.name}(${JSON.stringify(bloc.input)}) -> ${sortie.length} arrêt(s)`);
      resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: JSON.stringify(sortie) });
    }
  }

  // CORRECTION 2 : le résultat de l'outil est ajouté à la session.
  // C'est notre code qui le fait, l'API ne s'en charge pas.
  // Le modèle n'a aucune mémoire : ce qui n'est pas dans la session n'a jamais eu lieu.
  session.push({ role: "user", content: resultats });
}

if (!termine) {
  console.log("Limite de tours atteinte, arrêt.");
}
