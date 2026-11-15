// TP 7 : l'agent v1, un seul agent. Fourni : c'est l'agent du TP 6, terminé.
//
// Il sert de point de comparaison. Un seul modèle, un seul contexte, les quatre outils de lecture,
// le skill de diagnostic et l'outil d'action.

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import {
  type DemanderAccord,
  MODELE,
  OUTILS_DE_LECTURE,
  SERVEUR_ATELIER,
  TP,
  actions,
  creerPermission,
  journal,
} from "./commun.ts";

const SYSTEME =
  // Le rôle
  "Tu es l'assistant de l'atelier d'injection. Tu aides les chefs d'équipe. " +
  // Le contexte
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. " +
  // Les règles
  "Réponds uniquement à partir des résultats des outils. Si une donnée manque, dis-le. " +
  "Ne crée une demande d'intervention que si on te le demande explicitement. " +
  // Le format
  "Réponds en français, en trois phrases au plus, sauf si un skill impose un autre format.";

export function creerOptions(sessionId?: string, demanderAccord?: DemanderAccord): Options {
  return {
    model: MODELE,
    systemPrompt: SYSTEME,
    mcpServers: { atelier: SERVEUR_ATELIER, actions },
    tools: ["Read", "Skill"], // les outils intégrés : lire un fichier, charger un skill
    settingSources: ["project"], // pour que le SDK lise .claude/skills/
    skills: ["diagnostic-arret"],
    cwd: TP,
    allowedTools: OUTILS_DE_LECTURE, // ce qui s'exécute sans rien demander
    canUseTool: creerPermission(demanderAccord), // l'action passe par l'accord d'une personne
    hooks: { PreToolUse: [{ hooks: [journal] }] }, // la trace
    maxTurns: 15,
    resume: sessionId,
  };
}
