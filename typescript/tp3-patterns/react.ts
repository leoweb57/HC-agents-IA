// TP 3, pattern 1 : ReAct. Le modèle avance pas à pas : il demande un outil, lit le résultat, décide de la suite.
//
// C'est la boucle du TP 2, rangée dans une fonction pour que les deux autres patterns puissent la réutiliser.
//
// Lancement, depuis le dossier du TP :
//   npx tsx react.ts

import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

const MODELE = process.env.MODELE ?? "";
const DATA = "../../data";
const LIMITE_TOURS = 10;

export const SYSTEME =
  "Tu es l'assistant d'un atelier de production. " +
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. " +
  "Réponds en français, en moins de 150 mots, uniquement à partir des données fournies ou renvoyées par les outils.";
export const QUESTION =
  "Fais le bilan de la semaine pour la presse 4 : arrêts, ordres de fabrication et contrôles qualité. " +
  "Termine par une recommandation.";

// ---------- Les outils ----------

type Enregistrement = Record<string, unknown>;

function charger(fichier: string): Enregistrement[] {
  return JSON.parse(readFileSync(`${DATA}/${fichier}`, "utf-8"));
}

const FONCTIONS: Record<string, (args: Record<string, string>) => unknown> = {
  lister_arrets: (args) => charger("arrets_machine.json").filter((arret) => arret.machine_id === args.machine_id),
  lister_ordres_fabrication: (args) =>
    charger("ordres_fabrication.json").filter((ordre) => ordre.machine_id === args.machine_id),
  lister_controles_qualite: (args) =>
    charger("controles_qualite.json").filter((controle) => controle.of_id === args.of_id),
};

const MACHINE_ID = {
  type: "string",
  description:
    "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.",
};

const OUTILS: Anthropic.Tool[] = [
  {
    name: "lister_arrets",
    description:
      "Liste les arrêts d'une machine sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
    input_schema: { type: "object", properties: { machine_id: MACHINE_ID }, required: ["machine_id"] },
  },
  {
    name: "lister_ordres_fabrication",
    description:
      "Liste les ordres de fabrication d'une machine sur la semaine en cours : article, quantités prévue et produite, statut, dates.",
    input_schema: { type: "object", properties: { machine_id: MACHINE_ID }, required: ["machine_id"] },
  },
  {
    name: "lister_controles_qualite",
    description:
      "Liste les contrôles qualité d'un ordre de fabrication : taille de l'échantillon, non-conformes, défaut principal, décision.",
    input_schema: {
      type: "object",
      properties: {
        of_id: { type: "string", description: "Identifiant de l'ordre de fabrication, par exemple OF-2231." },
      },
      required: ["of_id"],
    },
  },
];

// ---------- Appeler le modèle en comptant ce que ça coûte ----------

const client = new Anthropic();

export type Session = Anthropic.MessageParam[];
export type Effort = "low" | "medium" | "high";

/** Additionne les appels au modèle et les tokens consommés. */
export class Compteur {
  appels = 0;
  entree = 0;
  sortie = 0;

  ajouter(usage: Anthropic.Usage): void {
    this.appels += 1;
    this.entree += usage.input_tokens;
    this.sortie += usage.output_tokens;
  }

  toString(): string {
    return `${this.appels} appels au modèle, ${this.entree} tokens en entrée, ${this.sortie} tokens en sortie`;
  }
}

/** Un appel au modèle. Les outils sont toujours déclarés, le modèle choisit de s'en servir ou non. */
export async function appeler(
  compteur: Compteur,
  session: Session,
  systeme: string = SYSTEME,
  effort?: Effort,
): Promise<Anthropic.Message> {
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 4000,
    system: systeme,
    tools: OUTILS,
    messages: session,
    // niveau de raisonnement : low, medium, high...
    ...(effort ? { output_config: { effort } } : {}),
  });
  compteur.ajouter(reponse.usage);
  return reponse;
}

export function texte(reponse: Anthropic.Message): string {
  return reponse.content
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("")
    .trim();
}

// ---------- Le pattern ReAct ----------

/** Fait tourner la boucle sur une session, jusqu'à la réponse du modèle ou la limite de tours. */
export async function boucleReact(
  session: Session,
  compteur: Compteur,
  effort?: Effort,
  bavard: boolean = true,
): Promise<string> {
  for (let tour = 1; tour <= LIMITE_TOURS; tour++) {
    const reponse = await appeler(compteur, session, SYSTEME, effort);
    session.push({ role: "assistant", content: reponse.content });

    if (reponse.stop_reason !== "tool_use") {
      return texte(reponse);
    }

    const resultats: Anthropic.ToolResultBlockParam[] = [];
    for (const bloc of reponse.content) {
      if (bloc.type === "tool_use") {
        if (bavard) console.log(`  outil : ${bloc.name}(${JSON.stringify(bloc.input)})`);
        const sortie = FONCTIONS[bloc.name](bloc.input as Record<string, string>);
        resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: JSON.stringify(sortie) });
      }
    }
    session.push({ role: "user", content: resultats });
  }
  return "Limite de tours atteinte.";
}

export async function executer(bavard: boolean = true): Promise<[string, Compteur]> {
  const compteur = new Compteur();
  const session: Session = [{ role: "user", content: QUESTION }];
  return [await boucleReact(session, compteur, undefined, bavard), compteur];
}

// Ce bloc ne s'exécute que si ce fichier est lancé directement (pas quand il est importé).
if (process.argv[1] === import.meta.filename) {
  const [reponse, compteur] = await executer();
  console.log(`\n${reponse}\n`);
  console.log(`ReAct : ${compteur}`);
}
