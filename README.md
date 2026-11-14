# Formation Agents IA — travaux pratiques

Dépôt des exercices de la formation « Agents IA » (3 jours).
Chaque TP existe en **Python** et en **TypeScript** : choisissez votre langage et restez-y.

## Organisation

```
data/          Données fictives de l'atelier, communes aux deux langages
python/        Les TP en Python
typescript/    Les TP en TypeScript
```

Chaque TP a son dossier numéroté, avec trois éléments :

- `README.md` : l'énoncé
- `depart/` : le point de départ, presque vide, là où vous écrivez votre code
- `solution/` : une solution possible, à ouvrir quand vous le décidez

Chaque TP repart d'une page blanche. Si vous voulez réutiliser votre code d'un TP précédent, copiez-le depuis son dossier.

Le dépôt est en lecture seule : clonez-le et travaillez en local.

## Mise en route (10 minutes)

1. Cloner le dépôt

   ```bash
   git clone https://github.com/leoweb57/HC-agents-IA.git
   cd HC-agents-IA
   ```

2. Créer le fichier `.env` à la racine, à partir du modèle

   ```bash
   cp .env.example .env
   ```

   Puis coller votre clé API Anthropic dans `.env`. Ce fichier n'est jamais versionné.

3. Installer les dépendances de votre langage : voir [python/README.md](python/README.md) ou [typescript/README.md](typescript/README.md).

4. Lancer le script de vérification indiqué dans ce README. Il doit afficher `Tout est en place.`

## Les TP

| TP | Sujet | Jour | Durée |
|---|---|---|---|
| TP 1 | Premiers appels à l'API, constater la variabilité | 1 | 30 min |

Les TP suivants sont ajoutés au fil de la formation.

## Le fil rouge

Tous les TP portent sur le même cas : un atelier de production fictif, avec ses machines, ses ordres de fabrication, ses arrêts et ses contrôles qualité. Les données sont dans [data/](data/README.md). Elles sont inventées.

---

© 2026 Raphaël Léo — support de formation Human Coders.
