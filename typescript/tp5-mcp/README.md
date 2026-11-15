# TP 5 — Brancher des serveurs MCP

**Durée : 40 min.** Jour 2, après le module 1.

## Objectif

- Lire un serveur MCP écrit à la main, et voir ce qu'il annonce à un client.
- Le brancher sur l'agent d'hier : une mémoire commune à toutes les conversations.
- Brancher un serveur MCP officiel, à distance, avec une authentification : celui de GitHub.

## Installation

1. Vérifier que le fichier `.env` à la racine du dépôt contient votre clé API.
2. Dans ce dossier, installer les dépendances :

   ```bash
   npm install
   ```

Toutes les commandes se lancent depuis ce dossier.

## Les fichiers

| Fichier | Ce qu'il fait |
|---|---|
| `serveur/memoire.ts` | Un serveur MCP écrit par nous : la mémoire commune de l'atelier. À lire, pas à modifier. |
| `exercice/decouvrir.ts` | Un client MCP minimal : il demande à un serveur la liste de ses outils. Fourni. |
| `exercice/agent.ts` | **À compléter.** L'agent du TP 4, terminé. Vous pouvez y mettre le vôtre. |
| `exercice/terminal.ts` | Une conversation dans le terminal. Fourni. |

## Partie 1 — Un serveur MCP, vu de près (10 min)

1. Ouvrez `serveur/memoire.ts`. Trois choses à repérer : la création du serveur, la déclaration des deux outils, le lancement.
2. Interrogez-le, sans agent ni modèle :

   ```bash
   npx tsx exercice/decouvrir.ts memoire
   ```

   Le client lance le serveur, ouvre une session et lui demande ses outils. Ce que vous voyez est exactement ce qu'un agent recevra.

Comparez avec la déclaration d'un outil dans `exercice/agent.ts` : qu'est-ce qui est pareil, qu'est-ce qui change ?

## Partie 2 — Brancher notre serveur sur l'agent (15 min)

Dans `exercice/agent.ts`, section « TP 5 » :

1. Ajoutez le serveur `memoire` à `mcpServers` : une commande et ses arguments.
2. Autorisez ses deux outils dans `allowedTools` : `mcp__memoire__lire_memoire` et `mcp__memoire__memoriser`.
3. Dites à l'agent, dans le prompt système, quand consulter la mémoire et quand y écrire.

Testez sur **deux conversations séparées** : chaque lancement du terminal en démarre une neuve.

```bash
npx tsx exercice/terminal.ts
```

- Première conversation : « Retiens que la presse 4 doit être graissée tous les lundis matin avant le démarrage. » Puis quittez.
- Seconde conversation : « Y a-t-il une consigne particulière pour la presse 4 ? »

Ouvrez ensuite `memoire.json` : c'est tout ce que le serveur a gardé. Quelle différence avec `resume`, vu hier ?

## Partie 3 — Brancher un serveur officiel : GitHub (15 min)

Le serveur MCP de GitHub tourne chez GitHub. Il agit en votre nom : il lui faut un jeton.

1. Créez un jeton sur GitHub : *Settings › Developer settings › Personal access tokens › Fine-grained tokens › Generate new token*. Accès aux dépôts : **Public repositories (read-only)**. Aucune autre permission.
2. Collez-le dans le fichier `.env`, à la racine du dépôt, sur la ligne `GITHUB_TOKEN=`.
3. Regardez ce que le serveur annonce, d'abord sans filtre, puis limité aux dépôts en lecture seule :

   ```bash
   npx tsx exercice/decouvrir.ts github
   npx tsx exercice/decouvrir.ts github repos
   ```

   Comparez le nombre d'outils et le nombre de tokens. Tout cela serait renvoyé au modèle à chaque tour.
4. Dans `exercice/agent.ts`, ajoutez le serveur `github` à `mcpServers` (type `http`, l'adresse, les trois en-têtes) et autorisez `mcp__github__*`.
5. Demandez à l'agent : « Quels dossiers contient le dépôt leoweb57/HC-agents-IA sur GitHub ? »

Un jeton est un secret : il reste dans `.env`, jamais dans le code, et vous pouvez le supprimer sur GitHub à la fin de la formation.

## Solution

`solution/agent.ts` est le fichier `exercice/agent.ts` une fois les parties 2 et 3 terminées. Ses commentaires « Pourquoi » expliquent les choix. Pour le voir tourner, copiez-le à la place de `exercice/agent.ts`.
