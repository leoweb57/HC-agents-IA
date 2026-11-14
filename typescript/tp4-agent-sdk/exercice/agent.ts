// TP 4 : l'agent d'atelier avec l'Agent SDK (à compléter).
//
// Ce fichier décrit l'agent : ses outils, son prompt système, ses règles.
// Il ne se lance pas seul. Trois programmes s'en servent, depuis le dossier du TP :
//   npx tsx exercice/question.ts     une seule question, comme au TP 2
//   npx tsx exercice/terminal.ts     une conversation dans le terminal
//   npx tsx exercice/interface.ts    une interface de discussion dans le navigateur

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

// ---------- Le prompt système (partie 2, étape 4) ----------

// Pour l'instant, celui du TP 2. À réécrire en quatre parties : rôle, contexte, règles, format.
const SYSTEME =
  "Tu es l'assistant d'un atelier de production. " +
  "Nous sommes le vendredi 13 mars 2026, il est 11 h. " +
  "Réponds en français, en deux ou trois phrases, uniquement à partir des résultats des outils.";

// ---------- Fourni : l'accès aux données de l'atelier ----------

type Enregistrement = Record<string, unknown>;

function charger(fichier: string): Enregistrement[] {
  return JSON.parse(readFileSync(`${DATA}/${fichier}`, "utf-8"));
}

/** Met des données au format attendu par le SDK pour un résultat d'outil. */
function resultat(donnees: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(donnees) }] };
}

function arretsDe(machineId: string): Enregistrement[] {
  return charger("arrets_machine.json").filter((arret) => arret.machine_id === machineId);
}

function ordreDeFabrication(ofId: string): Enregistrement {
  return charger("ordres_fabrication.json").find((o) => o.id === ofId) ?? { erreur: `Aucun ordre de fabrication ${ofId}.` };
}

function enregistrerDemande(machineId: string, motif: string, priorite: string): Enregistrement {
  const demandes: Enregistrement[] = existsSync(DEMANDES) ? JSON.parse(readFileSync(DEMANDES, "utf-8")) : [];
  const demande = { id: `DI-${String(demandes.length + 1).padStart(4, "0")}`, machine_id: machineId, motif, priorite };
  demandes.push(demande);
  writeFileSync(DEMANDES, JSON.stringify(demandes, null, 2));
  return demande;
}

// ---------- PARTIE 1 ----------

// Étape 1. Déclarer les deux outils de lecture avec tool() : un nom, une description, un schéma, une fonction.
// Le premier est écrit. Écrivez le second, lire_ordre_fabrication, sur le même modèle :
// il reçoit of_id et renvoie resultat(ordreDeFabrication(...)).

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
  async (args) => resultat(arretsDe(args.machine_id)),
);

// À ÉCRIRE : l'outil lire_ordre_fabrication

// Étape 2. Regrouper les outils dans un serveur interne, avec createSdkMcpServer.
// Leur nom complet devient : mcp__atelier__lister_arrets, etc.

// À ÉCRIRE : const atelier = createSdkMcpServer({ name: "atelier", version: "1.0.0", tools: [...] });

// Étape 3. Décrire l'agent dans creerOptions.

export type DemanderAccord = (nomOutil: string, parametres: Record<string, unknown>) => Promise<boolean>;

export function creerOptions(sessionId?: string, demanderAccord?: DemanderAccord): Options {
  // À ÉCRIRE : renvoyer un objet avec
  //   model           le modèle (MODELE)
  //   systemPrompt    le prompt système (SYSTEME)
  //   mcpServers      { atelier }
  //   tools           [] : aucun outil intégré du SDK pour l'instant
  //   allowedTools    les noms complets des deux outils de lecture
  //   maxTurns        la limite de tours, 10
  //   settingSources  [] : ne charge aucun réglage de Claude Code présent sur la machine
  throw new Error("Partie 1 : écrivez creerOptions dans exercice/agent.ts");
}

// ---------- PARTIE 2 ----------

// Étape 4. Réécrire SYSTEME, en haut du fichier, en quatre parties : rôle, contexte, règles, format.

// Étape 5. La session : ajouter resume: sessionId dans creerOptions.

// Étape 6. La trace : écrire un hook appelé avant chaque outil, et le brancher dans creerOptions.
//   const journal: HookCallback = async (donnees) => {
//     si donnees.hook_event_name === "PreToolUse" : afficher donnees.tool_name et donnees.tool_input
//     return {};
//   };
//   hooks: { PreToolUse: [{ hooks: [journal] }] }

// Étape 7. Un outil d'action : creer_demande_intervention(machine_id, motif, priorite).
//   - le déclarer avec tool() (il appelle enregistrerDemande) et l'ajouter au serveur ;
//   - ne PAS le mettre dans allowedTools ;
//   - écrire la fonction de permission et la brancher : canUseTool: creerPermission(demanderAccord).

/** Fabrique la fonction que le SDK appelle pour chaque outil absent de allowedTools. */
function creerPermission(demanderAccord?: DemanderAccord): CanUseTool {
  return async (nomOutil, parametres) => {
    // À ÉCRIRE :
    //   si nomOutil est l'outil d'action : appeler await demanderAccord(nomOutil, parametres)
    //     accord  -> return { behavior: "allow", updatedInput: parametres };
    //     refus   -> return { behavior: "deny", message: "..." };
    return { behavior: "deny", message: "Outil non autorisé." };
  };
}

// Étape 8. Un outil intégré du SDK : Read, pour lire les procédures du dossier procedures/.
//   - tools: ["Read"] et cwd: PROCEDURES dans creerOptions ;
//   - indiquer les deux fichiers de procédures dans le prompt système ;
//   - dans la fonction de permission : n'accepter Read que pour un fichier du dossier PROCEDURES.
