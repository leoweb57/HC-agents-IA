// Énigme 1 : l'agent ne trouve aucun arrêt.
//
// Lancement, depuis le dossier du TP :
//   npx tsx enigmes/enigme1.ts
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
  return arrets.filter((arret) => arret.machine_id === args.machine);
}

const FONCTIONS: Record<string, (args: Record<string, string>) => Enregistrement[]> = {
  lister_arrets: listerArrets,
};

const OUTILS: Anthropic.Tool[] = [
  {
    name: "lister_arrets",
    description: "Arrêts.",
    input_schema: {
      type: "object",
      properties: { machine: { type: "string", description: "La machine." } },
      required: ["machine"],
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

for (let tour = 1; tour <= LIMITE_TOURS; tour++) {
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 1000,
    system: SYSTEME,
    tools: OUTILS,
    messages: session,
  });
  session.push({ role: "assistant", content: reponse.content });

  if (reponse.stop_reason !== "tool_use") {
    console.log();
    console.log(
      reponse.content
        .filter((bloc) => bloc.type === "text")
        .map((bloc) => bloc.text)
        .join(""),
    );
    break;
  }

  const resultats: Anthropic.ToolResultBlockParam[] = [];
  for (const bloc of reponse.content) {
    if (bloc.type === "tool_use") {
      const sortie = FONCTIONS[bloc.name](bloc.input as Record<string, string>);
      console.log(`Tour ${tour} : ${bloc.name}(${JSON.stringify(bloc.input)}) -> ${sortie.length} arrêt(s)`);
      resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: JSON.stringify(sortie) });
    }
  }
  session.push({ role: "user", content: resultats });
}
