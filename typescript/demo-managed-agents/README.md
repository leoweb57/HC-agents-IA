# Démonstration — Claude Managed Agents

**Jour 2, module 4.** Ce n'est pas un TP : c'est le code des slides, à lire, et à lancer si vous voulez voir tourner l'agent d'atelier chez Anthropic.

## Ce que ça montre

Le même agent d'atelier que dans les TP 4 à 7, mais hébergé : la boucle, la session et les outils intégrés tournent chez Anthropic. Il ne reste ici que trois petits programmes, qui parlent à la plateforme par son API.

| Chez nous, avec l'Agent SDK | Ici, avec Managed Agents |
|---|---|
| Le prompt système, le modèle | Recopiés tels quels dans la définition de l'agent |
| Quatre outils de lecture, servis par un serveur MCP local | Les quatre fichiers de `data/`, envoyés à la plateforme et montés dans la session |
| L'outil d'action, et l'accord par `canUseTool` | Un « outil maison » : la plateforme nous le demande, `parler.ts` l'exécute après accord |
| La boucle `query()` et ses messages | Un flux d'événements |
| La reprise par `resume: sessionId` | Plus rien à faire : la session vit côté serveur |
| Le hook de trace | Le flux d'événements lui-même |

Ce qui ne se transpose pas : le serveur MCP lancé sur notre machine (il faudrait l'exposer par une URL), et les hooks.

## Installation

1. Vérifier que le fichier `.env` à la racine du dépôt contient votre clé API.
2. Dans ce dossier, installer les dépendances :

   ```bash
   npm install
   ```

Toutes les commandes se lancent depuis ce dossier.

## Les trois étapes

| Fichier | Ce qu'il fait |
|---|---|
| `creer.ts` | Crée l'environnement, envoie les fichiers de données, crée l'agent. Écrit leurs identifiants dans `identifiants.json`. |
| `parler.ts` | Ouvre une session et converse avec l'agent. Affiche les événements reçus, puis une ligne de mesure. |
| `nettoyer.ts` | Supprime les sessions, les fichiers et l'environnement, et archive l'agent. |

```bash
npx tsx creer.ts
npx tsx parler.ts
npx tsx nettoyer.ts
```

`creer` ne se lance qu'une fois. `parler` ouvre une nouvelle session à chaque lancement.

## Questions à essayer

- « Où en est l'OF-2231 ? »
- « La presse 4 a-t-elle souvent des défauts d'éjection ? » Regardez comment l'agent lit l'historique : un `grep`, ou un bout de Python qu'il écrit lui-même dans le bac à sable.
- « Crée une demande d'intervention pour la presse 4, priorité haute : éjecteur grippé ce matin. » Répondez `o`. Recommencez, et répondez `n`.

## Ce qu'il faut regarder

- `[agent.tool_use]` : un outil intégré (`bash`, `read`, `grep`) qui s'exécute dans le bac à sable d'Anthropic, sur les fichiers montés dans `/mnt/session/uploads/`.
- `[agent.custom_tool_use]`, puis `[session.status_idle] requires_action` : l'agent demande notre outil, et la session s'arrête pour nous attendre. C'est `parler.ts` qui crée la demande d'intervention, dans `demandes_intervention.json`, puis renvoie le résultat.
- `[session.status_idle] end_turn` : l'agent a fini de répondre.
- La ligne de mesure : la même que celle du TP 7, reconstruite à partir des événements. Comparez-la à celle de l'agent du TP 6 sur la même question.

## À savoir

- Claude Managed Agents est en bêta : les noms et les comportements peuvent changer.
- Le prix : les tokens, au tarif du modèle, plus 0,08 $ par heure de session, compté seulement quand l'agent travaille. Une conversation de quelques questions avec le modèle des TP coûte moins d'un centime.
- Rien ne disparaît tout seul : les sessions et leur historique, les fichiers et l'agent restent chez Anthropic jusqu'à ce que vous lanciez `nettoyer`. Un agent ne se supprime pas : il s'archive.
- Dans la Console (platform.claude.com), vous retrouvez l'agent, l'environnement et les sessions, avec tous leurs événements.

Documentation : https://platform.claude.com/docs/en/managed-agents/overview
