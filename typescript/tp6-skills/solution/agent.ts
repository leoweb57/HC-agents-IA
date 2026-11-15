// TP 6 : donner un skill à l'agent d'atelier (solution).
//
// C'est le fichier exercice/agent.ts une fois terminé.
// Les commentaires « Pourquoi » de la section des options expliquent les choix du TP 6.
//
// Pour le voir tourner, copiez-le à la place de exercice/agent.ts, et copiez solution/SKILL.md
// à la place de .claude/skills/diagnostic-arret/SKILL.md.

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

// Pourquoi : le SDK avertit que les outils de allowedTools ne passeront pas par canUseTool.
// C'est exactement ce qu'on veut (les lectures passent d'office), donc on masque l'avertissement.
process.removeAllListeners("warning");

const MODELE = process.env.MODELE ?? "";
const TP = path.resolve(".");
const DEMANDES = path.resolve("demandes_intervention.json");
const SERVEUR_ATELIER = path.resolve("exercice/serveur_atelier.ts");

// ---------- 1. Le prompt système : rôle, contexte, règles, format (étape 4) ----------

// Pourquoi quatre parties : le modèle relit ce texte à chaque tour. On y met ce qui doit rester vrai
// tout au long de la conversation, et rien d'autre. La date est indispensable : sans elle,
// « ce matin » ne veut rien dire pour le modèle.
// Pourquoi la règle sur les demandes d'intervention est aussi ici : le prompt oriente le modèle,
// mais ce n'est pas lui qui protège. La vraie protection est la fonction de permission, plus bas.

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

// ---------- 2. L'outil d'action de l'agent (étape 7) ----------

type Enregistrement = Record<string, unknown>;

/** Met des données au format attendu par le SDK pour un résultat d'outil. */
function resultat(donnees: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(donnees) }] };
}

// Un outil d'action : il écrit. Il ne s'exécute qu'après l'accord d'une personne (voir plus bas).
// Pourquoi il est déclaré comme les autres : pour le SDK, lecture ou action, c'est le même objet.
// La différence se fait dans les permissions, pas dans la déclaration.
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

// Pourquoi un serveur interne reste : l'action est propre à cet agent, et elle passe par l'accord
// d'une personne. Elle reste donc dans son code. Pourquoi « actions » : le nom « atelier » est
// maintenant celui du serveur externe, et deux serveurs ne peuvent pas porter le même nom.
const actions = createSdkMcpServer({ name: "actions", version: "1.0.0", tools: [creerDemandeIntervention] });

// Pourquoi ces noms n'ont pas bougé : le préfixe est le nom du serveur, et il s'appelle toujours « atelier ».
// Le code a déménagé, le modèle ne voit aucune différence.
const OUTILS_DE_LECTURE = [
  "mcp__atelier__lister_arrets",
  "mcp__atelier__lire_ordre_fabrication",
  "mcp__atelier__lister_controles_qualite", // bonus
  "mcp__atelier__historique_arrets", // bonus
];
const OUTIL_D_ACTION = "mcp__actions__creer_demande_intervention";

// ---------- Le serveur MCP « atelier » (TP 5) ----------

// Pourquoi pas de tool() pour les lectures : elles vivent maintenant dans un programme à part,
// serveur_atelier.ts. On dit seulement au SDK comment le lancer ; c'est le serveur qui annonce
// ses outils, leurs descriptions et leurs schémas.
// Pourquoi une commande : en transport stdio, le SDK lance lui-même le programme au démarrage de l'agent,
// et lui parle par son entrée et sa sortie standard. Rien à lancer à la main.
// Pourquoi process.execPath et tsx : pour le lancer avec le même Node que l'agent, en TypeScript.
const SERVEUR_EXTERNE = { command: process.execPath, args: ["--import", "tsx", SERVEUR_ATELIER] };

// ---------- 3. La trace : un hook appelé avant chaque outil (étape 6) ----------

// Pourquoi un hook plutôt qu'un console.log dans chaque outil : le hook voit tous les outils,
// y compris Read, qui n'est pas notre code. Il renvoie {} : il observe, il ne bloque rien.

const journal: HookCallback = async (donnees) => {
  if (donnees.hook_event_name === "PreToolUse") {
    console.log(`  [journal] ${donnees.tool_name}(${JSON.stringify(donnees.tool_input)})`);
  }
  return {};
};

// ---------- 4. Les permissions : qui décide pour les outils qui ne sont pas autorisés d'office (étapes 7 et 8) ----------

// Pourquoi une fonction qui en fabrique une autre : la façon de demander l'accord dépend du programme
// (une question au clavier dans terminal.ts, deux boutons dans interface.ts). L'agent ne change pas.
// Pourquoi tout refuser à la fin : un outil qu'on n'a pas prévu ne doit jamais passer par défaut.

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

    // Read, l'outil intégré du SDK. Dans le dossier de travail (cwd, ici le dossier du TP), le SDK laisse
    // lire sans rien demander : c'est ce qui permet au modèle de lire les procédures du skill.
    // Pourquoi ce refus : hors de ce dossier, Read arrive ici, et rien ne justifie de l'ouvrir.
    if (nomOutil === "Read") {
      return { behavior: "deny", message: "Lecture limitée au dossier du TP." };
    }

    return { behavior: "deny", message: "Outil non autorisé." };
  };
}

// ---------- 5. Les options : tout ce qui décrit l'agent (étapes 3, 5, 6, 7 et 8) ----------

// Pourquoi tools et allowedTools sont deux listes : tools dit quels outils intégrés existent pour le modèle,
// allowedTools dit lesquels s'exécutent sans rien demander. L'outil d'action n'y est pas : il passe donc
// par canUseTool. Read n'y est pas non plus, mais le SDK laisse lire dans le dossier de travail.

export function creerOptions(sessionId?: string, demanderAccord?: DemanderAccord): Options {
  return {
    model: MODELE,
    systemPrompt: SYSTEME,
    mcpServers: { atelier: SERVEUR_EXTERNE, actions }, // le serveur externe, et notre action
    tools: ["Read", "Skill"], // les outils intégrés qu'on garde : lire un fichier, charger un skill
    // Pourquoi "project" : les skills sont des fichiers. Le SDK ne les cherche que si on lui dit
    // de lire les réglages du projet, c'est-à-dire le dossier .claude/ du dossier de travail.
    settingSources: ["project"],
    // Pourquoi une liste : on nomme les skills que le modèle a le droit de charger. Rien d'autre ne passe.
    skills: ["diagnostic-arret"],
    allowedTools: OUTILS_DE_LECTURE, // ce qui s'exécute sans rien demander
    canUseTool: creerPermission(demanderAccord), // tout le reste passe par cette fonction
    hooks: { PreToolUse: [{ hooks: [journal] }] }, // la trace
    maxTurns: 15, // la limite de tours : un diagnostic enchaîne plusieurs outils
    resume: sessionId, // reprendre une conversation, si on en a l'identifiant
    cwd: TP, // le dossier de travail : c'est là que le SDK cherche .claude/skills/
  };
}
