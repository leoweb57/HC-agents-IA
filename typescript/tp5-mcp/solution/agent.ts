// TP 5 : brancher des serveurs MCP sur l'agent d'atelier (solution).
//
// C'est le fichier exercice/agent.ts une fois les parties 2 et 3 terminées.
// Les commentaires « Pourquoi » de la section TP 5 expliquent les choix.
//
// Pour le voir tourner, copiez-le à la place de exercice/agent.ts, puis lancez exercice/terminal.ts.

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
const DATA = "../../data";
const PROCEDURES = path.resolve("procedures");
const DEMANDES = path.resolve("demandes_intervention.json");
const SERVEUR_MEMOIRE = path.resolve("serveur/memoire.ts");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

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
  "Les procédures de maintenance sont deux fichiers : defaut_ejection.md et derive_temps_de_cycle.md. " +
  // Les règles
  "Réponds uniquement à partir des résultats des outils. Si une donnée manque, dis-le. " +
  "Ne crée une demande d'intervention que si on te le demande explicitement. " +
  // La mémoire commune (TP 5). Pourquoi le dire ici : le modèle voit les outils du serveur,
  // mais c'est le prompt système qui lui dit quand s'en servir.
  "Tu as une mémoire commune à toutes les conversations. Consulte-la avec lire_memoire avant de répondre " +
  "à une question sur une consigne ou une habitude de l'atelier. Quand on te demande de retenir quelque chose, " +
  "enregistre-le avec memoriser, avec le prénom de l'utilisateur comme auteur. " +
  // Le format
  "Réponds en français, en trois phrases au plus.";

// ---------- 2. Les outils de l'atelier (étapes 1, 2 et 7) ----------

// Pourquoi les descriptions sont aussi détaillées : c'est tout ce que le modèle voit d'un outil.
// La correspondance « presse 4 = P4 » est écrite dans la description du paramètre (énigme 1 du TP 2).

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

// Les outils sont regroupés dans un serveur interne au programme.
// Leur nom complet devient : mcp__atelier__lister_arrets, etc.
const atelier = createSdkMcpServer({
  name: "atelier",
  version: "1.0.0",
  tools: [listerArrets, lireOrdreFabrication, creerDemandeIntervention],
});

const OUTILS_DE_LECTURE = ["mcp__atelier__lister_arrets", "mcp__atelier__lire_ordre_fabrication"];
const OUTIL_D_ACTION = "mcp__atelier__creer_demande_intervention";

// ---------- TP 5 : les serveurs MCP externes (parties 2 et 3) ----------

// Pourquoi pas de tool() ici : un serveur MCP externe est un programme à part. On dit seulement au SDK
// comment le joindre ; c'est le serveur qui annonce ses outils, leurs descriptions et leurs schémas.

// Notre serveur « memoire », en transport stdio.
// Pourquoi une commande : le SDK lance lui-même le programme et lui parle par son entrée et sa sortie standard.
// Pourquoi process.execPath et --import tsx : pour lancer le fichier TypeScript avec le même Node que l'agent.
const SERVEURS_EXTERNES: NonNullable<Options["mcpServers"]> = {
  memoire: { command: process.execPath, args: ["--import", "tsx", SERVEUR_MEMOIRE] },
};
// Pourquoi memoriser est autorisé d'office alors qu'il écrit : c'est notre code, on sait ce qu'il fait,
// et une note en trop se supprime. Pour un serveur écrit par un tiers, on aurait demandé un accord.
const OUTILS_MCP = ["mcp__memoire__lire_memoire", "mcp__memoire__memoriser"];

// Le serveur officiel de GitHub, en transport HTTP : il tourne chez GitHub, rien n'est lancé sur ce poste.
// Pourquoi un jeton : le serveur agit en votre nom sur GitHub. Le jeton reste dans .env, jamais dans le code.
// Pourquoi les deux en-têtes X-MCP : sans eux, le serveur annonce tous ses outils, écriture comprise.
// On ne garde que les outils sur les dépôts, en lecture seule : moins de contexte, et aucun risque d'écriture.
if (GITHUB_TOKEN && !GITHUB_TOKEN.includes("mettre-votre")) {
  SERVEURS_EXTERNES.github = {
    type: "http",
    url: "https://api.githubcopilot.com/mcp/",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "X-MCP-Toolsets": "repos",
      "X-MCP-Readonly": "true",
    },
  };
  OUTILS_MCP.push("mcp__github__*"); // tous ses outils : le serveur ne propose plus que de la lecture
}

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

    // Read, l'outil intégré du SDK : seulement dans le dossier des procédures.
    if (nomOutil === "Read") {
      // Pourquoi path.resolve : pour qu'un chemin comme ../../.env soit ramené à son vrai dossier avant le test.
      const chemin = path.resolve(PROCEDURES, String(parametres.file_path ?? ""));
      if (path.dirname(chemin) === PROCEDURES) {
        return { behavior: "allow", updatedInput: parametres };
      }
      return { behavior: "deny", message: "Lecture limitée au dossier des procédures." };
    }

    return { behavior: "deny", message: "Outil non autorisé." };
  };
}

// ---------- 5. Les options : tout ce qui décrit l'agent (étapes 3, 5, 6, 7 et 8) ----------

// Pourquoi tools et allowedTools sont deux listes : tools dit quels outils intégrés existent pour le modèle,
// allowedTools dit lesquels s'exécutent sans rien demander. L'outil d'action et Read n'y sont pas :
// ils passent donc par canUseTool.
// Pourquoi settingSources: [] : sans cela, le SDK charge les réglages de Claude Code s'il est installé
// sur la machine, et l'agent ne se comporte plus de la même façon d'un poste à l'autre.

export function creerOptions(sessionId?: string, demanderAccord?: DemanderAccord, utilisateur?: string): Options {
  return {
    model: MODELE,
    systemPrompt: `${SYSTEME} Tu parles avec ${utilisateur || "un utilisateur inconnu"}.`,
    mcpServers: { atelier, ...SERVEURS_EXTERNES }, // nos outils, et les serveurs externes
    tools: ["Read"], // le seul outil intégré du SDK qu'on garde : lire un fichier
    allowedTools: [...OUTILS_DE_LECTURE, ...OUTILS_MCP], // ce qui s'exécute sans rien demander
    canUseTool: creerPermission(demanderAccord), // tout le reste passe par cette fonction
    hooks: { PreToolUse: [{ hooks: [journal] }] }, // la trace
    maxTurns: 10, // la limite de tours
    resume: sessionId, // reprendre une conversation, si on en a l'identifiant
    cwd: PROCEDURES, // le dossier de travail de l'agent
    settingSources: [], // ne charge aucun réglage de Claude Code présent sur la machine
  };
}
