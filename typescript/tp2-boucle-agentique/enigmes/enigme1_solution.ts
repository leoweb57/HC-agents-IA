// Énigme 1, corrigée : l'agent ne trouvait aucun arrêt.
//
// Lancement, depuis le dossier du TP :
//   npx tsx enigmes/enigme1_solution.ts
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

const MACHINES = ["P1", "P2", "P3", "P4", "A1", "C1"];

function listerArrets(args: Record<string, string>): unknown {
  // CORRECTION 2 : un identifiant inconnu renvoie une erreur explicite, avec les valeurs acceptées,
  // au lieu d'une liste vide. Une liste vide voulait dire « aucun arrêt » : le modèle la croyait.
  // Avec ce message, il peut se corriger tout seul au tour suivant.
  if (!MACHINES.includes(args.machine_id)) {
    return { erreur: `Machine inconnue : ${args.machine_id}. Identifiants valides : ${MACHINES.join(", ")}.` };
  }
  const arrets: Enregistrement[] = JSON.parse(readFileSync(`${DATA}/arrets_machine.json`, "utf-8"));
  return arrets.filter((arret) => arret.machine_id === args.machine_id);
}

const FONCTIONS: Record<string, (args: Record<string, string>) => unknown> = {
  lister_arrets: listerArrets,
};

// CORRECTION 1 : la description. Le modèle ne lit jamais la fonction, seulement ce texte.
// Avant : "Arrêts." et "La machine." Il envoyait donc "presse 4", que le code ne connaît pas.
// Maintenant, la description dit ce que l'outil renvoie, et le paramètre donne son format exact.
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
      console.log(`Tour ${tour} : ${bloc.name}(${JSON.stringify(bloc.input)})`);
      resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: JSON.stringify(sortie) });
    }
  }
  session.push({ role: "user", content: resultats });
}
