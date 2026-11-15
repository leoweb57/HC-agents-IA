// TP 7 : l'agent v2, un chef d'atelier et trois spécialistes (à compléter).
//
// Le principal ne consulte aucune donnée : il délègue à des sous-agents, puis il répond à partir
// de leurs rapports. Le spécialiste qualité est fourni : c'est le modèle. Cherchez « À ÉCRIRE ».
//
// Pour parler à l'agent, depuis le dossier du TP :
//   npx tsx exercice/terminal.ts v2

import type { AgentDefinition, HookCallback, Options } from "@anthropic-ai/claude-agent-sdk";
import {
  type DemanderAccord,
  HISTORIQUE_ARRETS,
  LIRE_ORDRE_FABRICATION,
  LISTER_ARRETS,
  LISTER_CONTROLES_QUALITE,
  MODELE,
  OUTIL_D_ACTION,
  OUTILS_DE_LECTURE,
  SERVEUR_ATELIER,
  TP,
  actions,
  creerPermission,
  journal,
} from "./commun.ts";

// ---------- 1. Le principal : il ne consulte rien, il délègue ----------

const PRINCIPAL =
  // Le rôle
  "Tu es le chef d'atelier de l'atelier d'injection. Tu réponds aux chefs d'équipe. " +
  // Le contexte
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. " +
  // La délégation
  "Tu ne consultes aucune donnée toi-même : tu délègues à tes spécialistes avec l'outil Agent, " +
  "et tu attends leurs rapports. " +
  // Les règles
  "Réponds uniquement à partir des rapports. Si une donnée manque, dis-le. " +
  "Ne crée une demande d'intervention que si on te le demande explicitement. " +
  // Le format
  "Réponds en français, de façon courte.";

// ---------- 2. Les spécialistes : un prompt, une description, des outils ----------

const REGLES =
  "Réponds uniquement à partir des résultats de tes outils. Si une donnée manque, dis-le. " +
  "Réponds en français, en quelques lignes.";

// Un sous-agent se définit avec trois champs :
// - description : c'est ce que lit le principal pour choisir à qui déléguer. Elle joue le rôle
//   de la description d'un outil : ce que fait le spécialiste, et quand faire appel à lui.
// - prompt : le prompt système du sous-agent. Il remplace celui du principal, il ne s'y ajoute pas.
// - tools : les outils du sous-agent, pris parmi ceux de la session. Ce qui n'est pas dans la liste
//   n'existe pas pour lui.
const SPECIALISTES: Record<string, AgentDefinition> = {
  // Fourni : le modèle à suivre.
  qualite: {
    description:
      "Contrôles qualité d'un ordre de fabrication : échantillons, non-conformes, défauts, décisions. " +
      "À utiliser pour toute question sur la qualité.",
    prompt: "Tu es le contrôleur qualité de l'atelier d'injection. " + REGLES,
    tools: [LISTER_CONTROLES_QUALITE], // un seul des quatre outils du serveur « atelier »
  },
  // À ÉCRIRE (étape 3) : production, le responsable de production.
  //   Son outil : LIRE_ORDRE_FABRICATION.
  // À ÉCRIRE (étape 4) : maintenance, le technicien de maintenance.
  //   Ses outils : LISTER_ARRETS, HISTORIQUE_ARRETS, et "Read" pour lire les procédures.
  //   Son skill : ajouter le champ skills: ["diagnostic-arret"]. Le SDK charge alors le skill
  //   dans le contexte de ce sous-agent, à son lancement.
};

// ---------- 3. La règle : le principal délègue ----------

// Les outils de la session sont visibles du principal aussi, et un prompt ne garantit rien.
// Ce hook refuse au principal tout ce qui n'est ni une délégation, ni l'action.
// Il reconnaît le principal à l'absence de agent_id : le SDK n'ajoute cet identifiant que pour un sous-agent.

const lePrincipalDelegue: HookCallback = async (donnees) => {
  if (
    donnees.hook_event_name === "PreToolUse" &&
    !donnees.agent_id &&
    !["Agent", OUTIL_D_ACTION].includes(donnees.tool_name)
  ) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Le chef d'atelier ne consulte rien lui-même : délègue à un spécialiste.",
      },
    };
  }
  return {};
};

// ---------- 4. Les options ----------

export function creerOptions(sessionId?: string, demanderAccord?: DemanderAccord): Options {
  return {
    model: MODELE,
    systemPrompt: PRINCIPAL,
    // Les serveurs sont connectés une fois, pour toute la session.
    // Chaque sous-agent en reçoit la part que sa liste tools désigne.
    mcpServers: { atelier: SERVEUR_ATELIER, actions },
    agents: SPECIALISTES, // les sous-agents, par leur nom
    // Agent : l'outil intégré de la délégation. Read : un sous-agent ne peut recevoir
    // que des outils qui existent dans la session.
    tools: ["Agent", "Read"],
    settingSources: ["project"], // pour que le SDK trouve .claude/skills/
    cwd: TP,
    allowedTools: ["Agent", ...OUTILS_DE_LECTURE], // ce qui s'exécute sans rien demander
    // Le SDK permet aussi au principal de se dédoubler : un « fork » est une copie de lui-même,
    // avec toute la conversation et tous les outils de la session. On l'interdit : sinon, faute de
    // spécialiste, le principal se délègue le travail à lui-même et contourne la règle.
    disallowedTools: ["Agent(fork)"],
    canUseTool: creerPermission(demanderAccord), // l'action passe par l'accord d'une personne
    hooks: { PreToolUse: [{ hooks: [journal, lePrincipalDelegue] }] },
    // ...process.env : en TypeScript, env remplace l'environnement du SDK. On garde donc l'existant.
    env: {
      ...process.env,
      // Par défaut, le SDK lance les sous-agents en arrière-plan, et le principal peut répondre
      // « je reviens vers vous » avant d'avoir leurs rapports. Ici, il attend toujours.
      CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
      // Le SDK fournit des sous-agents tout faits (general-purpose, Explore, Plan).
      // On les retire : le principal ne peut déléguer qu'à nos spécialistes.
      CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "1",
    },
    // Par défaut, le SDK ne transmet pas le texte que produisent les sous-agents.
    // On le demande, pour que les mesures comptent tous les appels au modèle.
    forwardSubagentText: true,
    maxTurns: 15, // les tours du principal. Un sous-agent a sa propre boucle.
    maxBudgetUsd: 0.5, // le plafond de dépense compte aussi les sous-agents
    resume: sessionId,
  };
}
