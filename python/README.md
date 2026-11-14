# TP en Python

Prérequis : Python 3.10 ou plus récent.

## Installation

Depuis le dossier `python/` :

```bash
python -m venv .venv
source .venv/bin/activate        # Windows : .venv\Scripts\activate
pip install -r requirements.txt
```

## Vérifier l'environnement

```bash
python verifier_env.py
```

Le script contrôle la version de Python, la présence de la clé dans `.env` (à la racine du dépôt) et fait un appel minimal à l'API. Il doit se terminer par `Tout est en place.`

En cas d'échec, il indique la cause la plus probable : clé absente ou invalide, modèle inconnu, proxy ou réseau.

## Lancer un TP

Chaque TP se lance depuis le dossier `python/`, par exemple :

```bash
python tp1-premiers-appels/depart/appel.py
```
