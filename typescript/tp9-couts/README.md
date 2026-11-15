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

## Ce qu'on a mesuré

Avec Claude Haiku 5.5, le 15 novembre 2026. Vos chiffres varieront d'un essai à l'autre, pas les ordres de grandeur.

**Le cache.** Quatre questions dans une session : environ 32 000 tokens lus, dont 92 % relus en cache. Coût : 0,0012 à 0,0014 $, contre 0,0038 à 0,0042 $ sans cache. Trois fois moins.

**Le cache est un préfixe.** Un contexte stable de 11 852 tokens, envoyé trois fois. L'heure placée après lui : 11 852 tokens relus en cache aux appels 2 et 3. L'heure placée avant : 0 token relu, tout est réécrit à chaque appel.

**La compaction.** La conversation passe d'environ 16 000 à 2 200 tokens, en 19 secondes. La question suivante reste juste, mais l'agent doit rappeler un outil. Sur cette session courte, compacter coûte : 0,0086 $ contre 0,0045 $ sans. Elle sert quand le contexte déborde ou que la session dure, pas pour économiser sur six questions.

**La recherche d'outils.** Avec 60 outils de plus : environ 16 800 tokens par appel sans la recherche (3 750 avec nos cinq outils), 4 100 à 4 900 avec. Sur la question : 34 000 tokens contre 13 500, pour un appel au modèle de plus. Ce qui l'active : `"ToolSearch"` dans la liste `tools`.

**Les modèles**, un essai par question, coût calculé par le SDK :

| Question | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Où en est l'OF-2231 ? | 0,0005 $ · 8,4 s | 0,0135 $ · 7,3 s | 0,0238 $ · 5,5 s |
| Diagnostic de l'arrêt | 0,0018 $ · 19,5 s | 0,0204 $ · 11,4 s | 0,0455 $ · 13,4 s |
| Le point sur l'OF-2231 : avancement, arrêts, qualité | 0,0008 $ · 8,8 s | 0,0097 $ · 7,5 s | 0,0215 $ · 9,9 s |

Les trois modèles donnent les mêmes chiffres sur ces questions. Ils diffèrent sur l'interprétation : pour le diagnostic, Opus va chercher le contrôle qualité et situe l'étape 6 de la procédure, Sonnet s'arrête à l'étape 4. Pour lire des données et les restituer, le plus petit suffit.

**L'effort**, sur le diagnostic avec Haiku 5.5 : `low` 3 appels et 0,0014 $, par défaut 4 appels et 0,0018 $, `high` 5 appels et 0,0022 $.

## À savoir

- Le coût total que donne le SDK (`total_cost_usd`) est cumulé sur toute la session reprise. Pour le coût d'une question, on lit l'usage de la question, ou on fait la différence avec le total précédent.
- Au premier tour d'une session, le SDK fait un appel de plus, invisible dans le flux de messages : environ 1 200 tokens, 0,0001 $ avec Haiku 5.5. Le total du SDK le compte.
