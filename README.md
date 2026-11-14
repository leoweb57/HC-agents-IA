# Formation Agents IA — travaux pratiques

Dépôt des exercices de la formation « Agents IA » (3 jours).
Chaque TP existe en **Python** et en **TypeScript** : choisissez votre langage.

## Organisation

```
.env           Votre clé API et le nom du modèle, lus par tous les TP
data/          Données fictives de l'atelier, communes aux deux langages
python/        Les TP en Python
typescript/    Les TP en TypeScript
```

Chaque TP a son dossier numéroté, avec :

- `README.md` : l'énoncé, l'installation et les commandes
- `exercice/` : là où vous écrivez votre code
- `solution/` : une solution possible, à ouvrir quand vous le décidez

Chaque TP repart d'une page blanche. Pour réutiliser votre code d'un TP précédent, copiez-le depuis son dossier.

Le dépôt est en lecture seule : clonez-le et travaillez en local.

## Avant de commencer

1. Cloner le dépôt

   ```bash
   git clone https://github.com/leoweb57/HC-agents-IA.git
   cd HC-agents-IA
   ```

2. Ouvrir le fichier `.env` à la racine et y mettre votre clé API Anthropic. Le nom du modèle s'y trouve aussi.

3. Aller dans le dossier de votre langage : [python/](python/README.md) ou [typescript/](typescript/README.md).

## Le fil rouge

Tous les TP portent sur le même cas : un atelier de production fictif, avec ses machines, ses ordres de fabrication, ses arrêts et ses contrôles qualité. Les données sont dans [data/](data/README.md). Elles sont inventées.

---

© 2026 Raphaël Léo — support de formation Human Coders.
