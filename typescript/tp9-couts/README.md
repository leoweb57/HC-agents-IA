# TP 9 — Coûts et contexte : mesurer avant de régler

**Code fourni.** Jour 3, après le module 2. Il n'y a rien à écrire : chaque script change un seul réglage et affiche ce que ça coûte.

## Objectif

- Voir ce que le cache de prompt fait gagner, et ce qui l'annule.
- Mesurer ce que la compaction libère, et ce qu'elle coûte.
- Brancher 60 outils de plus sans les payer à chaque appel.
- Comparer les modèles et les niveaux d'effort sur la même question.

## Installation

1. Vérifier que le fichier `.env` à la racine du dépôt contient votre clé API.
2. Dans ce dossier :

   ```bash
   npm install
   ```

Toutes les commandes se lancent depuis ce dossier.

## Les fichiers

| Fichier | Ce qu'il montre |
|---|---|
| `agent.ts` | L'agent du TP 6, réuni dans un seul fichier. Fourni. |
| `mesures.ts` | Pose une question et renvoie ce qu'elle a coûté : appels, tokens lus, relus en cache, produits. |
| `1_cache.ts` | Quatre questions dans une session : la part relue en cache, le coût avec et sans. |
| `2_cache_prefixe.ts` | Sur l'API directe : l'heure placée après, puis avant un long contexte stable. |
| `3_compaction.ts` | Cinq questions, puis une sixième, avec ou sans compaction juste avant. |
| `4_recherche_outils.ts` | Un second serveur MCP de 60 outils, avec ou sans recherche d'outils. |
| `5_modeles.ts` | La même question avec un autre modèle ou un autre niveau d'effort. |
| `serveur_usine.ts` | Le serveur MCP de 60 outils. Fourni. |

```bash
npx tsx 1_cache.ts
npx tsx 2_cache_prefixe.ts
npx tsx 3_compaction.ts sans
npx tsx 3_compaction.ts avec
npx tsx 4_recherche_outils.ts sans
npx tsx 4_recherche_outils.ts avec
npx tsx 5_modeles.ts
npx tsx 5_modeles.ts claude-haiku-5-5 low
npx tsx 5_modeles.ts claude-sonnet-5-5      # attention au prix : voir plus bas
```

## À savoir

- Le coût total que donne le SDK (`total_cost_usd`) est cumulé sur toute la session reprise. Pour le coût d'une question, on lit l'usage de la question, ou on fait la différence avec le total précédent.
- Au premier tour d'une session, le SDK fait un appel de plus, invisible dans le flux de messages : environ 1 200 tokens, 0,0001 $ avec Haiku 5.5. Le total du SDK le compte.
