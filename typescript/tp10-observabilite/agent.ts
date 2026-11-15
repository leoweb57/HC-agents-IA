// L'agent d'atelier du jour 3. Fourni : c'est l'agent du TP 6, un seul agent, réuni dans un seul fichier.
//
// Rien de nouveau ici : le serveur MCP « atelier » (quatre lectures), le skill de diagnostic,
// l'outil d'action soumis à l'accord d'une personne, et la trace dans le terminal.
// Les scripts du TP partent de ces options, puis y ajoutent ce qu'ils veulent montrer.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CanUseTool,
  type HookCallback,
  type Options,
  createSdkMcpServer,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export const TP = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.join(TP, "../../.env")); // lit le fichier .env à la racine du dépôt

// Le SDK avertit que les outils de allowedTools ne passeront pas par canUseTool.
// C'est voulu (les lectures passent d'office), donc on masque l'avertissement.
process.removeAllListeners("warning");

export const MODELE = process.env.MODELE ?? "";
const DEMANDES = path.join(TP, "demandes_intervention.json");

export const SYSTEME =
  // Le rôle
  "Tu es l'assistant de l'atelier d'injection. Tu aides les chefs d'équipe. " +
  // Le contexte
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. " +
  // Les règles
  "Réponds uniquement à partir des résultats des outils. Si une donnée manque, dis-le. " +
  "Ne crée une demande d'intervention que si on te le demande explicitement. " +
  // Le format
  "Réponds en français, en trois phrases au plus, sauf si un skill impose un autre format.";

// ---------- Le serveur MCP « atelier » : les quatre lectures ----------

// Transport stdio : le SDK lance lui-même le programme au démarrage de l'agent.
export const SERVEUR_ATELIER = { command: process.execPath, args: ["--import", "tsx", path.join(TP, "serveur_atelier.ts")] };

export const OUTILS_DE_LECTURE = [
  "mcp__atelier__lister_arrets",
  "mcp__atelier__historique_arrets",
  "mcp__atelier__lister_controles_qualite",
  "mcp__atelier__lire_ordre_fabrication",
];

// ---------- L'outil d'action : créer une demande d'intervention ----------

const creerDemandeIntervention = tool(
  "creer_demande_intervention",
  "Crée une demande d'intervention de maintenance pour une machine. À n'utiliser que si l'utilisateur le demande.",
  {
    machine_id: z.string().describe("Identifiant de la machine, P1 à P4, A1 ou C1."),
    motif: z.string().describe("Motif de la demande, en une phrase."),
    priorite: z.string().describe("Priorité : normale ou haute."),
  },
  async (args) => {
    const demandes: Record<string, unknown>[] = existsSync(DEMANDES) ? JSON.parse(readFileSync(DEMANDES, "utf-8")) : [];
    const demande = { id: `DI-${String(demandes.length + 1).padStart(4, "0")}`, ...args };
    demandes.push(demande);
    writeFileSync(DEMANDES, JSON.stringify(demandes, null, 2));
    return { content: [{ type: "text" as const, text: JSON.stringify(demande) }] };
  },
);

// Un serveur par agent lancé : un serveur interne ne se partage pas entre deux agents qui tournent en même temps.
const creerActions = () => createSdkMcpServer({ name: "actions", version: "1.0.0", tools: [creerDemandeIntervention] });
export const OUTIL_D_ACTION = "mcp__actions__creer_demande_intervention";

// ---------- La trace dans le terminal : un hook appelé avant chaque outil ----------

const journal: HookCallback = async (donnees) => {
  if (donnees.hook_event_name === "PreToolUse") {
    console.log(`  [outil] ${donnees.tool_name}(${JSON.stringify(donnees.tool_input)})`);
  }
  return {};
};

// ---------- Les permissions : l'accord d'une personne pour l'action ----------

export type DemanderAccord = (nomOutil: string, parametres: Record<string, unknown>) => Promise<boolean>;

/** Fabrique la fonction que le SDK appelle pour chaque outil qui n'est pas autorisé d'office. */
function creerPermission(demanderAccord?: DemanderAccord): CanUseTool {
  return async (nomOutil, parametres) => {
    if (nomOutil === OUTIL_D_ACTION) {
      if (demanderAccord && (await demanderAccord(nomOutil, parametres))) {
        return { behavior: "allow", updatedInput: parametres };
      }
      return { behavior: "deny", message: "La création a été refusée par l'utilisateur." };
    }
    return { behavior: "deny", message: "Outil non autorisé." };
  };
}

// ---------- Les options de l'agent ----------

export function creerOptions(sessionId?: string, demanderAccord?: DemanderAccord): Options {
  return {
    model: MODELE,
    systemPrompt: SYSTEME,
    mcpServers: { atelier: { ...SERVEUR_ATELIER }, actions: creerActions() },
    tools: ["Read", "Skill"], // les outils intégrés : lire un fichier, charger un skill
    settingSources: ["project"], // pour que le SDK lise .claude/skills/
    skills: ["diagnostic-arret"],
    cwd: TP,
    allowedTools: [...OUTILS_DE_LECTURE], // ce qui s'exécute sans rien demander
    canUseTool: creerPermission(demanderAccord), // l'action passe par l'accord d'une personne
    hooks: { PreToolUse: [{ hooks: [journal] }] }, // la trace
    maxTurns: 15,
    maxBudgetUsd: 0.5,
    resume: sessionId,
  };
}
