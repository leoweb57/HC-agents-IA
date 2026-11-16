# TP 3 — Trois patterns d'agents, côte à côte

**Lecture libre.** Jour 1, après le module 3. Il n'y a rien à écrire : le code est complet, il sert à voir comment chaque pattern se traduit en code et ce qu'il consomme.

## Objectif

- Lire une implémentation simple de ReAct, de Plan-and-Execute (avec et sans replanification) et de Reflection.
- Comparer ce que chacun coûte, sur la même demande et avec les mêmes outils.
- Voir ce que change le niveau de raisonnement du modèle.

## La demande

> Fais le bilan de la semaine pour la presse 4 : arrêts, ordres de fabrication et contrôles qualité. Termine par une recommandation.

Trois outils sont disponibles : `lister_arrets`, `lister_ordres_fabrication` et `lister_controles_qualite`.

## Installation

1. Vérifier que le fichier `.env` à la racine du dépôt contient votre clé API.
2. Dans ce dossier, installer les dépendances :

   ```bash
   npm install
   ```

Toutes les commandes se lancent depuis ce dossier.

## Les fichiers

| Fichier | Ce qu'il montre |
|---|---|
| `react.ts` | La boucle du TP 2, rangée dans une fonction. Les autres fichiers la réutilisent. |
| `plan_et_execution.ts` | Un appel pour écrire le plan, une boucle par étape, un appel pour la synthèse. |
| `replanification.ts` | La variante : après chaque étape, un appel révise la suite du plan. |
| `reflection.ts` | Un premier jet, une relecture sur des critères écrits, une correction si besoin. |
| `raisonnement.ts` | La même boucle ReAct avec deux niveaux d'effort de raisonnement. |
| `comparer.ts` | Lance les trois patterns et affiche un tableau : appels au modèle et tokens. |

```bash
npx tsx react.ts
npx tsx plan_et_execution.ts
npx tsx replanification.ts
npx tsx reflection.ts
npx tsx raisonnement.ts
npx tsx comparer.ts
```

## À essayer

- Remplacer la demande, dans `react.ts`, par une demande plus large (toutes les presses, par exemple) et relancer `comparer.ts`.
- Retirer un critère de `reflection.ts`, ou en ajouter un impossible à tenir, et observer les relectures.
- Changer de modèle dans le fichier `.env` et comparer.
