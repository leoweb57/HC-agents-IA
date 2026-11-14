// TP 4 : l'agent d'atelier avec l'Agent SDK (solution).
//
// Ce fichier décrit l'agent : ses outils, son prompt système, ses règles.
// Il ne se lance pas seul. Trois programmes s'en servent, depuis le dossier du TP :
//   npx tsx solution/question.ts     une seule question, comme au TP 2
//   npx tsx solution/terminal.ts     une conversation dans le terminal
//   npx tsx solution/interface.ts    une interface de discussion dans le navigateur

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type CanUseTool,
  type HookCallback,
  type Options,
  createSdkMcpServer,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

// Le SDK prévient que les outils de allowedTools ne passent pas par canUseTool : c'est voulu ici.
process.removeAllListeners("warning");

const MODELE = process.env.MODELE ?? "";
const DATA = "../../data";
const PROCEDURES = path.resolve("procedures");
const DEMANDES = path.resolve("demandes_intervention.json");

// ---------- 1. Le prompt système : rôle, contexte, règles, format ----------

const SYSTEME =
  // Le rôle
  "Tu es l'assistant de l'atelier d'injection. Tu aides les chefs d'équipe. " +
  // Le contexte
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. " +
  "Les procédures de maintenance sont deux fichiers : defaut_ejection.md et derive_temps_de_cycle.md. " +
  // Les règles
  "Réponds uniquement à partir des résultats des outils. Si une donnée manque, dis-le. " +
  "Ne crée une demande d'intervention que si on te le demande explicitement. " +
  // Le format
  "Réponds en français, en trois phrases au plus.";

// ---------- 2. Les outils de l'atelier ----------

type Enregistrement = Record<string, unknown>;

function charger(fichier: string): Enregistrement[] {
  return JSON.parse(readFileSync(`${DATA}/${fichier}`, "utf-8"));
}

/** Met des données au format attendu par le SDK pour un résultat d'outil. */
function resultat(donnees: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(donnees) }] };
}

const listerArrets = tool(
  "lister_arrets",
  "Liste les arrêts d'une machine de l'atelier sur la semaine en cours : date, durée, cause et ordre de fabrication concerné.",
  {
    machine_id: z
      .string()
      .describe(
        "Identifiant de la machine : P1 à P4 pour les presses 1 à 4, A1 pour la ligne d'assemblage, C1 pour la cellule de contrôle.",
      ),
  },
  async (args) => resultat(charger("arrets_machine.json").filter((arret) => arret.machine_id === args.machine_id)),
);

const lireOrdreFabrication = tool(
  "lire_ordre_fabrication",
  "Renvoie le détail d'un ordre de fabrication : article, machine, quantités prévue et produite, statut, dates.",
  { of_id: z.string().describe("Identifiant de l'ordre de fabrication, par exemple OF-2231.") },
  async (args) => {
    const ordre = charger("ordres_fabrication.json").find((o) => o.id === args.of_id);
    return resultat(ordre ?? { erreur: `Aucun ordre de fabrication ${args.of_id}.` });
  },
);

// Un outil d'action : il écrit. Il ne s'exécute qu'après l'accord d'une personne (voir plus bas).
const creerDemandeIntervention = tool(
  "creer_demande_intervention",
  "Crée une demande d'intervention de maintenance pour une machine. À n'utiliser que si l'utilisateur le demande.",
  {
    machine_id: z.string().describe("Identifiant de la machine, P1 à P4, A1 ou C1."),
    motif: z.string().describe("Motif de la demande, en une phrase."),
    priorite: z.string().describe("Priorité : normale ou haute."),
  },
  async (args) => {
    const demandes: Enregistrement[] = existsSync(DEMANDES) ? JSON.parse(readFileSync(DEMANDES, "utf-8")) : [];
    const demande = { id: `DI-${String(demandes.length + 1).padStart(4, "0")}`, ...args };
    demandes.push(demande);
    writeFileSync(DEMANDES, JSON.stringify(demandes, null, 2));
    return resultat(demande);
  },
);

// Les outils sont regroupés dans un serveur interne au programme.
// Leur nom complet devient : mcp__atelier__lister_arrets, etc.
const atelier = createSdkMcpServer({
  name: "atelier",
  version: "1.0.0",
  tools: [listerArrets, lireOrdreFabrication, creerDemandeIntervention],
});

const OUTILS_DE_LECTURE = ["mcp__atelier__lister_arrets", "mcp__atelier__lire_ordre_fabrication"];
const OUTIL_D_ACTION = "mcp__atelier__creer_demande_intervention";

// ---------- 3. La trace : un hook appelé avant chaque outil ----------

const journal: HookCallback = async (donnees) => {
  if (donnees.hook_event_name === "PreToolUse") {
    console.log(`  [journal] ${donnees.tool_name}(${JSON.stringify(donnees.tool_input)})`);
  }
  return {};
};

// ---------- 4. Les permissions : qui décide pour les outils qui ne sont pas autorisés d'office ----------

export type DemanderAccord = (nomOutil: string, parametres: Record<string, unknown>) => Promise<boolean>;

/** Fabrique la fonction que le SDK appelle pour chaque outil absent de allowedTools. */
function creerPermission(demanderAccord?: DemanderAccord): CanUseTool {
  return async (nomOutil, parametres) => {
    // L'outil d'action : on demande à une personne.
    if (nomOutil === OUTIL_D_ACTION) {
      if (demanderAccord && (await demanderAccord(nomOutil, parametres))) {
        return { behavior: "allow", updatedInput: parametres };
      }
      return { behavior: "deny", message: "La création a été refusée par l'utilisateur." };
    }

    // Read, l'outil intégré du SDK : seulement dans le dossier des procédures.
    if (nomOutil === "Read") {
      const chemin = path.resolve(PROCEDURES, String(parametres.file_path ?? ""));
      if (path.dirname(chemin) === PROCEDURES) {
        return { behavior: "allow", updatedInput: parametres };
      }
      return { behavior: "deny", message: "Lecture limitée au dossier des procédures." };
    }

    return { behavior: "deny", message: "Outil non autorisé." };
  };
}

// ---------- 5. Les options : tout ce qui décrit l'agent ----------

export function creerOptions(sessionId?: string, demanderAccord?: DemanderAccord): Options {
  return {
    model: MODELE,
    systemPrompt: SYSTEME,
    mcpServers: { atelier }, // nos outils
    tools: ["Read"], // le seul outil intégré du SDK qu'on garde : lire un fichier
    allowedTools: OUTILS_DE_LECTURE, // ce qui s'exécute sans rien demander
    canUseTool: creerPermission(demanderAccord), // tout le reste passe par cette fonction
    hooks: { PreToolUse: [{ hooks: [journal] }] }, // la trace
    maxTurns: 10, // la limite de tours
    resume: sessionId, // reprendre une conversation, si on en a l'identifiant
    cwd: PROCEDURES, // le dossier de travail de l'agent
    settingSources: [], // ne charge aucun réglage de Claude Code présent sur la machine
  };
}
