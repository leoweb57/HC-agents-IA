# TP 11 — Évaluation : les tests de non-régression de l'agent

**Code fourni.** Jour 3, après le module 4. On rejoue un jeu de questions à chaque changement de l'agent, comme on relance des tests unitaires.

## Objectif

- Écrire un jeu de questions qualifié : la question, les points attendus, le trajet attendu.
- Noter chaque réponse : par le code quand c'est possible, par un modèle juge sinon.
- Comparer une nouvelle version du prompt à la référence, et refuser celle qui fait moins bien.
- Gérer les versions du prompt dans Langfuse, et y retrouver les scores de chaque évaluation.

## Installation

1. Vérifier le fichier `.env` à la racine du dépôt : la clé API, et les trois lignes `LANGFUSE_…` si votre Langfuse tourne (voir le TP 10).
2. Dans ce dossier :

   ```bash
   npm install
   ```

Toutes les commandes se lancent depuis ce dossier. Sans Langfuse, tout fonctionne : les prompts et le jeu sont lus dans le dépôt, les résultats s'affichent dans le terminal.

## Les fichiers

| Fichier | Ce qu'il montre |
|---|---|
| `jeu_de_questions.json` | Dix cas : la question, les points attendus, les outils attendus. |
| `prompts/v1.md`, `prompts/v2.md` | Deux versions du prompt système. La v2 demande « une seule phrase courte ». |
| `prompts.ts` | Lire un prompt dans Langfuse par son étiquette, le publier. Fourni. |
| `jeu.ts` | Lire le jeu dans Langfuse ou dans le fichier, le publier. Fourni. |
| `juge.ts` | Le modèle juge : un critère à la fois, un verdict structuré. |
| `evaluer.ts` | L'évaluation : la tâche, les contrôles par le code, les jugements, la comparaison. |
| `publier.ts` | Publie les prompts et le jeu dans Langfuse. |
| `agent.ts`, `suivi.ts`, `langfuse.ts` | L'agent (son prompt est maintenant un paramètre), le traceur et la connexion du TP 10. Fournis. |

```bash
npx tsx publier.ts                  # une fois, si Langfuse tourne
npx tsx evaluer.ts v1 --reference   # évalue la v1 et en fait la référence (une minute environ)
npx tsx evaluer.ts v2               # évalue la v2 : se termine en erreur
```

## Ce que mesure chaque note

| Note | La question posée | Jugée contre | Par |
|---|---|---|---|
| `exactitude` | Dit-il vrai ? | les points attendus | le juge |
| `completude` | Dit-il tout ? | les points attendus | le juge |
| `ancrage` | A-t-il inventé ? | ce que ses outils ont renvoyé | le juge |
| `pertinence` | Répond-il à la question ? | la question | le juge |
| `outils` | A-t-il appelé les outils attendus ? | le trajet attendu | le code |
| `consignes` | Action demandée à bon escient, format respecté ? | le trajet attendu | le code |
| `etapes`, `cout`, `duree` | Combien ça coûte ? | la référence | le code |

L'ancrage et la pertinence n'ont pas besoin de réponse attendue : on peut les mesurer sur des conversations réelles. L'exactitude et la complétude demandent un jeu qualifié.

## Ce qu'on a mesuré

Avec Claude Haiku 5.5 pour l'agent et pour le juge, le 15 novembre 2026. Une évaluation prend environ une minute. L'agent coûte 0,007 $ pour les dix cas ; les quarante appels du juge s'y ajoutent.

**La v1** : 1,00 partout sur la plupart des passes. D'une passe à l'autre, un cas sur dix peut basculer : c'est la tolérance retenue pour les notes du juge.

**La v2** (« une seule phrase courte ») :

```
moyenne               v2   référence     écart
exact.              1.00        1.00     +0.00
complét.            1.00        0.90     +0.10
ancrage             1.00        1.00     +0.00
pertin.             1.00        1.00     +0.00
outils              1.00        1.00     +0.00
consignes           0.90        1.00     -0.10   RÉGRESSION
étapes              2.10        2.10     +0.00
coût $            0.0007      0.0007   +0.0000
durée s             6.16        7.05     -0.89

Régression : le prompt v2 fait moins bien que la référence. On ne le met pas en production.
```

Le diagnostic a perdu ses quatre lignes (Constat, Récurrence, Procédure, Recommandation). Les quatre juges n'ont rien vu : la réponse reste exacte, complète, ancrée et pertinente. C'est le contrôle par le code qui l'attrape. Le programme sort avec le code 1 : branché sur l'intégration continue, il bloque la livraison.

## Un juge se met au point comme l'agent

Trois leçons de la mise au point, toutes mesurées :

- **Le juge ne voit que ce qu'on lui donne.** Au premier jet, l'ancrage était noté 4 sur 9. C'est le juge qui se trompait : il recevait les résultats des outils sans les paramètres des appels (« rien ne dit que cette liste concerne la presse 3 »). Avec les appels complets, la question et la liste des outils de l'agent : 9 ou 10 sur 10.
- **Chaque mot d'un point attendu devient une exigence.** « AR-510, à 7 h 42 » a fait échouer une réponse juste qui ne citait pas l'identifiant. On n'écrit que ce qui compte pour le métier.
- **Le juge se trompe aussi.** Il a trouvé une vraie erreur de l'agent (« les huit arrêts précédents, de 4 à 35 min », alors qu'un arrêt a duré 74 min). Il a aussi refusé à tort une somme juste (279 minutes) et compté dix arrêts au lieu de neuf. Un modèle juge compte mal sur une longue liste : les chiffres se vérifient par le code.

Pour prendre un juge plus fort que l'agent : `MODELE_JUGE=claude-sonnet-5-5` dans le fichier `.env`.

## Dans Langfuse

- **Prompts** : `agent-atelier`, ses versions et leurs étiquettes (`production`, `v1`, `v2`).
- **Datasets** : `atelier-questions`, ses dix cas. Chaque évaluation y est rattachée et se compare aux précédentes.
- **Traces** : une par cas, avec le détail de l'agent et les neuf scores. Chaque appel au modèle renvoie à la version du prompt.

Vérifié contre un serveur de test qui enregistre ce que le SDK Langfuse envoie. L'affichage se vérifie sur votre installation.
