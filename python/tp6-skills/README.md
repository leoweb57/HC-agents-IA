# TP 6 — Un skill, et trois outils à corriger

**Durée : 30 min.** Jour 2, après le module 2.

## Objectif

- Écrire un skill : la méthode de diagnostic d'un arrêt machine, dans un fichier Markdown.
- Repérer et corriger trois défauts de conception d'outils : un mauvais aiguillage, une erreur silencieuse, une sortie trop grosse.

Le skill et le serveur corrigé resserviront cet après-midi, avec plusieurs agents.

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
| `.claude/skills/diagnostic-arret/procedures/` | Les deux procédures de maintenance. Elles font partie du skill. |
| `exercice/agent.py` | **À compléter.** L'agent du TP 5, terminé. |
| `exercice/serveur_atelier.py` | **À corriger.** Le serveur MCP du TP 5, avec trois défauts. |
| `exercice/terminal.py` | Une conversation dans le terminal. Après chaque réponse, il affiche le nombre de tours et de tokens lus par le modèle. Fourni. |
| `exercice/decouvrir.py` | Le client MCP du TP 5, pour interroger le serveur sans agent. Fourni. |

Le dossier `.claude` est masqué par défaut dans certains explorateurs de fichiers : il commence par un point.

## Étape 1 — Écrire le skill (10 min)

Ouvrez `.claude/skills/diagnostic-arret/SKILL.md`. Il a deux parties :

1. **L'en-tête**, entre les deux lignes `---` : le nom du skill, et sa description. La description est la seule chose que le modèle voit en permanence. Elle doit dire ce que fait le skill, et quand s'en servir.
2. **Le corps** : la méthode, étape par étape, et le format de réponse attendu. Le modèle ne le lit que s'il décide de charger le skill.

Écrivez la méthode comme pour un nouveau collègue : quel outil appeler, dans quel ordre, quoi regarder, quelle procédure lire.

## Étape 2 — L'activer et le tester (5 min)

Dans `exercice/agent.py`, dans les options, cherchez « À ÉCRIRE » :

- ajouter l'outil intégré `Skill` à `tools` ;
- passer `setting_sources` à `["project"]` : le SDK lit alors le dossier `.claude/` du TP ;
- ajouter `skills` avec le nom du skill : `["diagnostic-arret"]`.

```bash
python exercice/terminal.py
```

- « Diagnostique l'arrêt de ce matin sur la presse 4. » Le journal montre `Skill`, puis les outils, dans l'ordre de votre méthode.
- `/diagnostic-arret presse 4, arrêt du 12 mars` : vous lancez le skill vous-même, comme une commande.

Notez le nombre de tokens lus pour le premier diagnostic : vous le comparerez à la fin.

## Étape 3 — Corriger trois outils (15 min)

Le serveur `exercice/serveur_atelier.py` a trois défauts. Posez chaque question dans une conversation neuve (relancez le terminal), et comparez avec ce qui est attendu.

| Question | Ce qui est attendu | Ce qu'il faut regarder |
|---|---|---|
| « Quels arrêts la presse 4 a-t-elle eus cette semaine ? » | Deux arrêts, le 12 et le 13 mars, avec **un seul** appel d'outil. | Quel outil est appelé, et le nombre de tokens. |
| « Où en est l'ordre de fabrication OF-2331 ? » | « Cet ordre de fabrication n'existe pas. » | Ce que l'agent affirme. Appelez l'outil avec `decouvrir` pour voir ce qu'il renvoie. |
| « La presse 4 a-t-elle déjà eu un défaut d'éjection depuis début mars, avant cette semaine ? » | Non, avec moins de 8 000 tokens lus. | Le nombre de tokens. |

Pour chaque défaut : trouvez la cause dans le serveur, corrigez, relancez la question.

Indices, à ne lire qu'en cas de blocage :

1. *Le mauvais aiguillage.* Comparez les descriptions de `lister_arrets` et de `historique_arrets`. Comment le modèle peut-il savoir lequel choisir ?
2. *L'erreur silencieuse.* Que renvoie `lire_ordre_fabrication` pour un identifiant inconnu ? Le protocole a un moyen de dire « erreur » : `raise ToolError("...")`.
3. *La sortie trop grosse.* `historique_arrets` renvoie tout, avec tous les champs. Ajoutez un paramètre `depuis`, et ne gardez que la date, la durée, la catégorie et la cause.

Pour finir, relancez le diagnostic de l'étape 2 et comparez le nombre de tokens.

## Solution

`solution/SKILL.md`, `solution/agent.py` et `solution/serveur_atelier.py` sont les trois fichiers une fois terminés. Les commentaires « Correction » du serveur expliquent chaque défaut. Pour les voir tourner, copiez-les à la place de `.claude/skills/diagnostic-arret/SKILL.md`, `exercice/agent.py` et `exercice/serveur_atelier.py`.
