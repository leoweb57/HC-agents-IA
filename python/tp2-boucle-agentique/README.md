# TP 2 — La boucle agentique écrite à la main

**Durée : 35 minutes.** Jour 1, après le module 2.

## Objectif

- Écrire vous-même la boucle d'un agent : appeler le modèle, exécuter l'outil qu'il demande, lui renvoyer le résultat, recommencer.
- Obtenir enfin la réponse à la question de la presse 4, à partir des données de l'atelier.
- Reconnaître trois pannes classiques sur du code déjà écrit.

## Installation

1. Vérifier que le fichier `.env` à la racine du dépôt contient votre clé API.
2. Dans ce dossier, installer les dépendances :

   ```bash
   pip install -r requirements.txt
   ```

   Si pip refuse d'installer hors d'un environnement virtuel : `python -m venv .venv` puis `source .venv/bin/activate` (Windows : `.venv\Scripts\activate`).

Toutes les commandes se lancent depuis ce dossier.

## Partie 1 — Écrire la boucle (20 min)

Ouvrez `exercice/agent.py`. Le fichier contient déjà :

- les deux outils, `lister_arrets` et `lire_ordre_fabrication` : la fonction que votre code exécute, et la description que le modèle lit ;
- le prompt système et la question à poser ;
- la session, qui commence avec la question.

Il manque la boucle. À chaque tour :

1. appeler le modèle avec `client.messages.create(...)`, en lui passant le prompt système, les outils et la session ;
2. ajouter sa réponse à la session ;
3. s'il ne demande aucun outil (`stop_reason` différent de `"tool_use"`), afficher le texte et s'arrêter ;
4. sinon, exécuter chaque outil demandé et ajouter les résultats à la session ;
5. s'arrêter si la limite de tours est atteinte.

```bash
python exercice/agent.py
```

Résultat attendu : l'agent appelle `lister_arrets`, puis `lire_ordre_fabrication`, et répond que la presse 4 s'est arrêtée à 7 h 42 pour un défaut d'éjection pendant l'OF-2231, avec l'avancement de cet ordre.

Repères :

- la session est le paramètre `messages` de l'API ;
- une demande d'outil est un bloc de type `"tool_use"` dans la réponse, avec `name`, `input` et `id` ;
- un résultat d'outil est un bloc `"tool_result"`, qui reprend cet `id` dans `tool_use_id` ;
- tous les résultats d'un tour vont dans un seul message de rôle `"user"`.

## Partie 2 — Trois énigmes (15 min, ensemble)

Trois agents déjà écrits, dans `enigmes/`. Chacun tourne, et chacun a un défaut. Posez-leur la même question :

> Quels arrêts a eus la presse 4 cette semaine ?

```bash
python enigmes/enigme1.py
python enigmes/enigme2.py
python enigmes/enigme3.py
```

| Énigme | Ce que vous observez |
|---|---|
| 1 | L'agent ne trouve aucun arrêt, alors que la presse 4 en a eu deux |
| 2 | La réponse est juste, mais regardez le nombre de tokens |
| 3 | L'agent redemande sans fin le même outil |

Pour chacune : lisez le code, trouvez la cause, proposez la correction. On en discute ensemble.

La question peut aussi se passer sur la ligne de commande, entre guillemets, après le nom du fichier.

## Solution

```bash
python solution/agent.py
```

Les causes et les corrections des trois énigmes sont dans [solution/enigmes.md](solution/enigmes.md).
