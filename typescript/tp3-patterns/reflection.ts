// TP 3, pattern 3 : Reflection. L'agent produit une réponse, la relit selon des critères, et la corrige si besoin.
//
// Lancement, depuis le dossier du TP :
//   npx tsx reflection.ts

import { QUESTION, Compteur, type Session, appeler, boucleReact, texte } from "./react.ts";

const PASSES_MAX = 2;

const CRITERES = `- Chaque chiffre cité vient des résultats des outils.
- La durée totale d'arrêt de la semaine est donnée, en minutes.
- Les contrôles qualité de l'ordre de fabrication sont cités, avec leur décision.
- La recommandation finale s'appuie sur une cause précise.
- La réponse fait moins de 150 mots.`;

const RELECTURE =
  "Relis ta dernière réponse comme un relecteur exigeant, critère par critère :\n" +
  `${CRITERES}\n\n` +
  "Si tous les critères sont respectés, réponds uniquement : OK. " +
  "Sinon, liste les corrections à faire, sans réécrire la réponse.";

export async function executer(bavard: boolean = true): Promise<[string, Compteur]> {
  const compteur = new Compteur();
  const session: Session = [{ role: "user", content: QUESTION }];

  // 1. Produire : un premier jet, avec la boucle ReAct.
  let reponse = await boucleReact(session, compteur, undefined, bavard);

  for (let passe = 1; passe <= PASSES_MAX; passe++) {
    // 2. Critiquer : la session contient déjà les résultats des outils, le modèle peut vérifier.
    session.push({ role: "user", content: RELECTURE });
    const critique = texte(await appeler(compteur, session));
    session.push({ role: "assistant", content: critique });
    if (bavard) console.log(`Relecture ${passe} : ${critique}`);
    if (critique.toUpperCase().startsWith("OK")) break;

    // 3. Corriger : on repasse par la boucle, au cas où il faille rappeler un outil.
    session.push({
      role: "user",
      content: "Réécris ta réponse en appliquant ces corrections. Donne uniquement la réponse finale.",
    });
    reponse = await boucleReact(session, compteur, undefined, bavard);
  }

  return [reponse, compteur];
}

if (process.argv[1] === import.meta.filename) {
  const [reponse, compteur] = await executer();
  console.log(`\n${reponse}\n`);
  console.log(`Reflection : ${compteur}`);
}
