// TP 9, étape 5 : le modèle et le niveau d'effort. Même agent, même question, autre réglage.
//
//   npx tsx 5_modeles.ts                         le modèle du fichier .env, effort par défaut
//   npx tsx 5_modeles.ts claude-sonnet-5-5       un autre modèle
//   npx tsx 5_modeles.ts claude-haiku-5-5 low    un niveau d'effort : low, medium, high
//
// Attention au prix : un modèle plus grand coûte de vingt à cinquante fois plus cher sur cette question.
// Le coût affiché est celui que calcule le SDK, avec le tarif du modèle choisi.

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { MODELE, creerOptions } from "./agent.ts";
import { milliers, pluriel, poser } from "./mesures.ts";

const QUESTION = "Diagnostique l'arrêt de ce matin sur la presse 4.";

const options: Options = { ...creerOptions(), hooks: {}, model: process.argv[2] ?? MODELE };
if (process.argv[3]) options.effort = process.argv[3] as Options["effort"];
const m = await poser(QUESTION, options);
console.log(`${options.model}, effort ${options.effort ?? "par défaut"}\n\n${m.reponse}\n`);
console.log(`${pluriel(m.appels, "appel")} au modèle · ${milliers(m.lus)} tokens lus · ${milliers(m.sortie)} tokens produits · ${m.duree.toFixed(1)} s · ${m.coutSession.toFixed(4)} $`);
