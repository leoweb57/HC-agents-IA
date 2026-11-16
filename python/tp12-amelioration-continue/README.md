# TP 12 — Amélioration continue : un retour utilisateur devient un test

**Code fourni.** Jour 3, après le module 5. On déroule la boucle complète, d'un avis négatif à une nouvelle version en production.

## Objectif

- Recueillir l'avis des utilisateurs sur les réponses de l'agent.
- Transformer un avis négatif en cas de test qualifié.
- Corriger le prompt, vérifier qu'il fait mieux sans rien casser, le mettre en production.

## Installation

1. Vérifier le fichier `.env` à la racine du dépôt : la clé API, et les trois lignes `LANGFUSE_…` si votre Langfuse tourne (voir le TP 10).
2. Dans ce dossier :

   ```bash
   pip install -r requirements.txt
   ```

Toutes les commandes se lancent depuis ce dossier. Sans Langfuse, tout fonctionne, sauf la mise en production (étape 6).

## La boucle, étape par étape

```bash
python publier.py                  # 0. les prompts v1, v2, v3 et le jeu de dix cas dans Langfuse
python terminal.py                 # 1. l'agent en production : demandez « Où en est l'OF-2231 ? », répondez n
python 1_retours.py                # 2. relire les avis négatifs
python 2_qualifier.py              # 3. trois cas de test de plus : le jeu passe à douze
python evaluer.py v1 --reference   # 4. la v1 échoue sur les nouveaux cas : c'est la nouvelle référence
python evaluer.py v3               # 5. la v3 corrige, sans rien casser
python 3_promouvoir.py v3          # 6. la v3 passe en production
python terminal.py                 # 7. la même question : l'agent signale l'arrêt
```

L'étape 1 est facultative : sans avis de votre part, les étapes suivantes lisent `retours_exemple.jsonl`.

## Les fichiers

| Fichier | Ce qu'il montre |
|---|---|
| `terminal.py` | L'agent « en production » : il lit son prompt dans Langfuse, par l'étiquette `production`, à chaque question. |
| `retours.py`, `1_retours.py` | Lire les avis, afficher les négatifs. |
| `cas_qualifies.json` | Le travail de quelqu'un du métier : ce qu'il fallait répondre. |
| `2_qualifier.py` | Ajoute ces cas au jeu, dans `jeu_enrichi.json` et dans le dataset Langfuse, reliés à la trace d'origine. |
| `prompts/v3.md` | La correction : une règle de plus. |
| `3_promouvoir.py` | Déplace l'étiquette `production` sur une version. |
| `evaluer.py`, `juge.py`, `jeu.py`, `prompts.py`, `agent.py`, `suivi.py` | Ceux du TP 11. |

## Le retour, et ce qu'on en fait

> **Question** : Où en est l'OF-2231 ?
> **Réponse** : L'OF-2231 est en cours, avec 1 740 pièces produites sur 3 000 prévues […]
> **Avis** : Il ne dit pas que la presse a été arrêtée plus d'une heure ce matin. C'est la première chose que je veux savoir.

Un avis dit que quelque chose ne va pas. Il ne dit pas ce qu'il fallait répondre : quelqu'un du métier l'écrit. Ici, trois cas :

- le cas existant gagne un point attendu : signaler l'arrêt de 74 minutes ;
- un cas voisin vérifie que la correction vaut pour un autre ordre de fabrication ;
- un troisième vérifie le cas sans arrêt : l'agent doit le dire, sans en inventer.

La correction tient en une ligne du prompt (`prompts/v3.md`) : « Quand on te demande où en est un ordre de fabrication, regarde aussi les arrêts de sa machine et signale ceux d'aujourd'hui. »

## Repartir de zéro

Supprimez `jeu_enrichi.json`, `reference.json` et `retours.jsonl` dans ce dossier. Dans Langfuse, rien à effacer : relancer `publier.py` remet le jeu de dix cas.

## À savoir

- Dans Langfuse, la même relecture se fait à l'écran : filtrer les traces sur le score `avis_utilisateur` à 0. Le fichier `retours.jsonl` permet de faire le TP sans Langfuse.
- Vérifié contre un serveur de test qui enregistre ce que le SDK Langfuse envoie. L'affichage se vérifie sur votre installation.
