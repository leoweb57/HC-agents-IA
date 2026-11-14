# TP en TypeScript

Prérequis : Node.js 20.12 ou plus récent (22 LTS conseillé).

## Installation

Depuis le dossier `typescript/` :

```bash
npm install
```

## Vérifier l'environnement

```bash
npm run verifier
```

Le script contrôle la version de Node, la présence de la clé dans `.env` (à la racine du dépôt) et fait un appel minimal à l'API. Il doit se terminer par `Tout est en place.`

En cas d'échec, il indique la cause la plus probable : clé absente ou invalide, modèle inconnu, proxy ou réseau.

## Lancer un TP

Chaque TP se lance depuis le dossier `typescript/`, par exemple :

```bash
npx tsx tp1-premiers-appels/depart/appel.ts
```

Les fichiers sont exécutés directement avec `tsx`, sans étape de compilation.
Le fichier `env.ts` charge le `.env` de la racine et expose le modèle à utiliser : chaque TP l'importe en première ligne.
