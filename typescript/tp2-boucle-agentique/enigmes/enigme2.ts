// Énigme 2 : la réponse est juste, mais la facture ne l'est pas.
//
// Lancement, depuis le dossier du TP :
//   npx tsx enigmes/enigme2.ts
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
  return JSON.parse(readFileSync(`${DATA}/historique_arrets.json`, "utf-8"));
}

const FONCTIONS: Record<string, (args: Record<string, string>) => Enregistrement[]> = {
  lister_arrets: listerArrets,
};

const OUTILS: Anthropic.Tool[] = [
  {
    name: "lister_arrets",
    description: "Liste les arrêts d'une machine de l'atelier : date, durée, cause et ordre de fabrication concerné.",
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
let totalEntree = 0;

for (let tour = 1; tour <= LIMITE_TOURS; tour++) {
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 1000,
    system: SYSTEME,
    tools: OUTILS,
    messages: session,
  });
  totalEntree += reponse.usage.input_tokens;
  console.log(`Tour ${tour} : ${reponse.usage.input_tokens} tokens en entrée`);
  session.push({ role: "assistant", content: reponse.content });

  if (reponse.stop_reason !== "tool_use") {
    console.log();
    console.log(
      reponse.content
        .filter((bloc) => bloc.type === "text")
        .map((bloc) => bloc.text)
        .join(""),
    );
    console.log();
    console.log(`Total : ${totalEntree} tokens en entrée`);
    break;
  }

  const resultats: Anthropic.ToolResultBlockParam[] = [];
  for (const bloc of reponse.content) {
    if (bloc.type === "tool_use") {
      const sortie = FONCTIONS[bloc.name](bloc.input as Record<string, string>);
      console.log(`  outil demandé : ${bloc.name}(${JSON.stringify(bloc.input)})`);
      resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: JSON.stringify(sortie) });
    }
  }
  session.push({ role: "user", content: resultats });
}
