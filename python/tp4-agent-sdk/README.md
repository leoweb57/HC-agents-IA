# TP 4 — L'agent d'atelier avec l'Agent SDK

**Durée : 1 h 35.** Jour 1, après le module 4.

## Objectif

- Refaire l'agent du TP 2 avec l'Agent SDK, sans écrire la boucle.
- Lui donner ce qui manque à un agent utilisable : un prompt système soigné, une session, une trace, un outil d'action validé par une personne.
- Lui parler dans une vraie interface de discussion.

## Installation

1. Vérifier que le fichier `.env` à la racine du dépôt contient votre clé API.
2. Dans ce dossier, installer les dépendances :

   ```bash
   pip install -r requirements.txt
   ```

Toutes les commandes se lancent depuis ce dossier.

## Les fichiers

Vous ne modifiez qu'un fichier : `exercice/agent.py`. Il décrit l'agent. Trois programmes déjà écrits s'en servent :

| Fichier | Ce qu'il fait |
|---|---|
| `exercice/agent.py` | **À compléter.** Les outils, le prompt système, les règles de l'agent. |
| `exercice/question.py` | Pose une seule question, comme au TP 2. |
| `exercice/terminal.py` | Une conversation dans le terminal. |
| `exercice/interface.py` | Une interface de discussion dans le navigateur, avec Chainlit. |
| `procedures/` | Deux procédures de maintenance, que l'agent pourra lire. |

Les étapes sont rappelées en commentaire dans `exercice/agent.py`.

## Partie 1 — Le même agent, sans la boucle (20 min)

1. Déclarer le second outil, `lire_ordre_fabrication`, avec `@tool`.
2. Regrouper les deux outils avec `create_sdk_mcp_server`.
3. Écrire `creer_options` : `model`, `system_prompt`, `mcp_servers`, `tools`, `allowed_tools`, `max_turns`, `setting_sources`.

```bash
python exercice/question.py
```

Résultat attendu : la même réponse qu'au TP 2 (7 h 42, défaut d'éjection, OF-2231 à 1 740 sur 3 000), avec le nombre de tours et le coût.

Comparez avec votre `agent.py` du TP 2 : où est passée la boucle ? Et que coûte une demande, par rapport au TP 2 ?

## Partie 2 — Un agent utilisable (45 min)

À chaque étape, relancez la conversation dans le terminal pour voir l'effet :

```bash
python exercice/terminal.py
```

4. **Le prompt système.** Réécrivez `SYSTEME` en quatre parties : rôle, contexte, règles, format.
5. **La session.** Ajoutez `resume=session_id` dans `creer_options`. Demandez « Pourquoi la presse 4 s'est-elle arrêtée ce matin ? », puis « Et combien de temps a-t-il duré ? ». Essayez avant et après.
6. **La trace.** Écrivez un hook `PreToolUse` qui affiche chaque appel d'outil.
7. **Un outil d'action.** Déclarez `creer_demande_intervention`, sans l'autoriser d'office, et écrivez la fonction de permission branchée sur `can_use_tool`. Demandez « Crée une demande d'intervention pour ce défaut, priorité haute. » : le terminal doit vous demander de valider. Refusez une fois, validez une fois, puis ouvrez `demandes_intervention.json`.
8. **Un outil intégré du SDK.** Autorisez `Read`, limité au dossier `procedures/`. Demandez « Que dit la procédure pour ce défaut ? ».

Pour le harnais, un outil est un outil : `Read` vient du SDK, `lister_arrets` vient de vous, et les deux passent par les mêmes règles.

## Partie 3 — L'interface de discussion (30 min)

```bash
chainlit run exercice/interface.py
```

Ouvrez http://localhost:8000 et refaites la même conversation. Lisez `exercice/interface.py` : c'est le même `query`, avec deux boutons à la place de la question du terminal.

Si vous avez fini, au choix :

- ajouter `max_budget_usd` dans `creer_options` et observer ce qui se passe avec un budget très bas ;
- écrire un hook `PostToolUse` qui signale un résultat d'outil de plus de 2 000 caractères ;
- ajouter un outil `lister_controles_qualite`, en reprenant celui du TP 3.

## Solution

```bash
python solution/question.py
python solution/terminal.py
chainlit run solution/interface.py
```
