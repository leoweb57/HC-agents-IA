# TP 1 — Premiers appels à l'API

**Durée : 30 minutes.** Jour 1, après le module 1.

## Objectif

- Envoyer un premier message à l'API et lire la réponse.
- Constater deux choses vues en cours : deux essais ne donnent pas la même réponse, et le modèle ne sait rien de votre atelier.

Vous écrivez dans `exercice/`. Une solution est dans `solution/`.

## Installation

1. Mettre votre clé API dans le fichier `.env` à la racine du dépôt.
2. Dans ce dossier, installer les dépendances :

   ```bash
   pip install -r requirements.txt
   ```

   Si pip refuse d'installer hors d'un environnement virtuel, créez-en un d'abord :
   `python -m venv .venv` puis `source .venv/bin/activate` (Windows : `.venv\Scripts\activate`).

Toutes les commandes se lancent depuis ce dossier.

## Étape 1 — Un premier appel (15 min)

Complétez `exercice/appel.py` pour :

1. créer le client Anthropic ;
2. envoyer le prompt `PROMPT` au modèle ;
3. afficher le texte de la réponse ;
4. afficher le nombre de tokens en entrée et en sortie.

```bash
python exercice/appel.py
```

Repères :

- la méthode à appeler est `client.messages.create(...)` ;
- elle exige trois paramètres : `model`, `max_tokens`, `messages` ;
- la réponse contient une liste de blocs dans `content` ; le texte est dans les blocs dont le `type` vaut `"text"` ;
- la consommation est dans `usage.input_tokens` et `usage.output_tokens`.

Si l'appel répond, votre environnement est bon. Une erreur d'authentification signifie que la clé dans `.env` est absente ou incorrecte.

## Étape 2 — Comparer (15 min)

Complétez `exercice/variabilite.py` pour envoyer **cinq fois** le même prompt et afficher les cinq réponses l'une sous l'autre.

Faites-le avec les deux prompts fournis dans le fichier :

- `PROMPT_OUVERT` : une demande où plusieurs réponses sont valables ;
- `PROMPT_ATELIER` : une question dont la réponse est dans les données de l'atelier, que le modèle n'a pas.

```bash
python exercice/variabilite.py
```

Notez ce que vous observez :

- Les cinq réponses au prompt ouvert sont-elles identiques ?
- Que répond le modèle à la question sur l'atelier ? Invente-t-il, ou dit-il qu'il ne sait pas ? Est-ce pareil aux cinq essais ?

## Pour aller plus loin

- Relancez `variabilite` plusieurs fois. L'API Claude récente n'expose plus le réglage `temperature` vu en cours : ici, la variabilité se constate, elle ne se règle pas.
- Changez de modèle dans `.env` et comparez les réponses et la consommation.
- Ajoutez un paramètre `system` pour donner un rôle au modèle, et regardez ce que ça change.

## Solution

```bash
python solution/appel.py
python solution/variabilite.py
```
