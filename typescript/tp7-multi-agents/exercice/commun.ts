// TP 7 : ce que l'agent v1 et l'agent v2 ont en commun. Fourni.
//
// Le serveur MCP « atelier », l'outil d'action, la trace et les permissions.
// Rien n'est à modifier ici : les deux agents s'en servent tels quels. C'est ce qui rend
// la comparaison honnête : mêmes données, mêmes outils, même skill, même modèle.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type CanUseTool, type HookCallback, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

process.loadEnvFile("../../.env"); // lit le fichier .env à la racine du dépôt

// Le SDK avertit que les outils de allowedTools ne passeront pas par canUseTool.
// C'est voulu (les lectures passent d'office), donc on masque l'avertissement.
process.removeAllListeners("warning");

export const MODELE = process.env.MODELE ?? "";
export const TP = path.resolve(".");
const DEMANDES = path.resolve("demandes_intervention.json");

// ---------- Le serveur MCP « atelier » : les quatre lectures (TP 5 et 6) ----------

// Transport stdio : le SDK lance lui-même le programme au démarrage de l'agent.
export const SERVEUR_ATELIER = {
  command: process.execPath,
  args: ["--import", "tsx", path.resolve("serveur_atelier.ts")],
};

// Le nom complet d'un outil MCP : mcp__<serveur>__<outil>. C'est sous ce nom qu'on l'autorise,
// et c'est sous ce nom qu'on le donne, ou pas, à un sous-agent.
export const LISTER_ARRETS = "mcp__atelier__lister_arrets";
export const HISTORIQUE_ARRETS = "mcp__atelier__historique_arrets";
export const LISTER_CONTROLES_QUALITE = "mcp__atelier__lister_controles_qualite";
export const LIRE_ORDRE_FABRICATION = "mcp__atelier__lire_ordre_fabrication";
export const OUTILS_DE_LECTURE = [LISTER_ARRETS, HISTORIQUE_ARRETS, LISTER_CONTROLES_QUALITE, LIRE_ORDRE_FABRICATION];

// ---------- L'outil d'action : créer une demande d'intervention (TP 4) ----------

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

export const actions = createSdkMcpServer({ name: "actions", version: "1.0.0", tools: [creerDemandeIntervention] });
export const OUTIL_D_ACTION = "mcp__actions__creer_demande_intervention";

// ---------- La trace : un hook appelé avant chaque outil (TP 4) ----------

// Nouveau par rapport au jour 1 : quand l'appel vient d'un sous-agent, le SDK ajoute son nom
// dans agent_type. Le même hook voit donc les outils de tous les agents, et sait qui appelle.
// Pour une délégation, on affiche le texte envoyé au sous-agent : c'est tout ce qu'il recevra.

export const journal: HookCallback = async (donnees) => {
  if (donnees.hook_event_name === "PreToolUse") {
    const qui = donnees.agent_type ?? "principal";
    const parametres = donnees.tool_input as Record<string, unknown>;
    if (donnees.tool_name === "Agent") {
      console.log(`  [${qui}] délègue à « ${parametres.subagent_type} » : ${parametres.prompt}`);
    } else {
      console.log(`  [${qui}] ${donnees.tool_name}(${JSON.stringify(parametres)})`);
    }
  }
  return {};
};

// ---------- Les permissions : l'accord d'une personne pour l'action (TP 4) ----------

// Ce qui ne passe pas par cette fonction :
// - les outils de allowedTools, autorisés d'office ;
// - Read dans le dossier de travail (cwd, ici le dossier du TP) : le SDK y laisse lire sans rien demander.
//   C'est ce qui permet au skill de lire ses procédures. Hors de ce dossier, Read arrive ici, et il est refusé.

export type DemanderAccord = (nomOutil: string, parametres: Record<string, unknown>) => Promise<boolean>;

/** Fabrique la fonction que le SDK appelle pour chaque outil qui n'est pas autorisé d'office. */
export function creerPermission(demanderAccord?: DemanderAccord): CanUseTool {
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
