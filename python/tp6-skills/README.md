# TP 6 — Donner un skill à l'agent

**Durée : 30 min.** Jour 2, après le module 2.

## Objectif

- Écrire un skill : la méthode de diagnostic d'un arrêt machine, dans un fichier Markdown.
- L'activer dans l'agent, et voir qu'il n'est chargé que quand la demande s'y prête.

Ce skill resservira cet après-midi : l'agent chargé de la maintenance l'utilisera.

## Installation

1. Vérifier que le fichier `.env` à la racine du dépôt contient votre clé API.
2. Dans ce dossier, installer les dépendances :

   ```bash
   pip install -r requirements.txt
   ```

Toutes les commandes se lancent depuis ce dossier.

## Les fichiers

| Fichier | Ce qu'il fait |
|---|---|
| `.claude/skills/diagnostic-arret/SKILL.md` | **À écrire.** Le skill : sa description, puis la méthode. |
| `.claude/skills/diagnostic-arret/procedures/` | Les deux procédures de maintenance. Elles font maintenant partie du skill. |
| `exercice/agent.py` | **À compléter.** L'agent du TP 5, terminé. Vous pouvez y mettre le vôtre. |
| `exercice/terminal.py` | Une conversation dans le terminal. Fourni. |
| `serveur_atelier.py` | Le serveur MCP du TP 5, avec ses quatre outils. Fourni. |

Le dossier `.claude` est masqué par défaut dans certains explorateurs de fichiers : il commence par un point.

## Étape 1 — Écrire le skill (15 min)

Ouvrez `.claude/skills/diagnostic-arret/SKILL.md`. Il a deux parties :

1. **L'en-tête**, entre les deux lignes `---` : le nom du skill, et sa description. La description est la seule chose que le modèle voit en permanence. Elle doit dire ce que fait le skill, et quand s'en servir.
2. **Le corps** : la méthode, étape par étape, et le format de réponse attendu. Le modèle ne le lit que s'il décide de charger le skill.

Écrivez la méthode comme pour un nouveau collègue : quel outil appeler, dans quel ordre, quoi regarder, quelle procédure lire.

## Étape 2 — L'activer dans l'agent (5 min)

Dans `exercice/agent.py`, dans les options, cherchez « À ÉCRIRE » :

- ajouter l'outil intégré `Skill` à `tools` ;
- passer `setting_sources` à `["project"]` : le SDK lit alors le dossier `.claude/` du TP ;
- ajouter `skills` avec le nom du skill : `["diagnostic-arret"]`.

## Étape 3 — Tester (10 min)

```bash
python exercice/terminal.py
```

- « Où en est l'ordre de fabrication OF-2231 ? » Regardez le journal : le skill n'est pas chargé.
- « Diagnostique l'arrêt de ce matin sur la presse 4. » Le journal montre `Skill`, puis les outils, dans l'ordre de votre méthode.
- `/diagnostic-arret presse 4, arrêt du 12 mars` : vous lancez le skill vous-même, comme une commande.

Posez deux fois la question du diagnostic, dans deux conversations : obtenez-vous le même format ? Si le skill n'est pas chargé quand il devrait l'être, c'est sa description qu'il faut reprendre.

## Solution

`solution/SKILL.md` et `solution/agent.py` sont les deux fichiers une fois terminés. Pour les voir tourner, copiez le premier à la place de `.claude/skills/diagnostic-arret/SKILL.md`, et le second à la place de `exercice/agent.py`.
