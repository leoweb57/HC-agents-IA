# TP 8 — Sécurité : détourner notre agent, puis le défendre

**Code fourni.** Jour 3, après le module 1. Il n'y a rien à écrire : on lance, on lit le code, on regarde ce qui passe et ce qui ne passe pas.

## Objectif

- Jouer de vraies attaques contre l'agent d'atelier : par les données qu'il lit, puis contre son prompt système.
- Voir laquelle passe, et comparer quatre parades face à elle.
- Obtenir une sortie que votre code peut contrôler, et mesurer ce que vaut une liste de commandes autorisées.

## Le scénario

Dans un MES, le commentaire d'un arrêt est un texte libre, saisi par un opérateur. L'agent le lit par l'outil `lister_arrets`. On piège un seul champ : le commentaire de l'arrêt AR-510, celui de ce matin sur la presse 4. Les données piégées sont une copie, dans un dossier temporaire : rien ne change dans `data/`.

## Installation

1. Vérifier que le fichier `.env` à la racine du dépôt contient votre clé API.
2. Dans ce dossier :

   ```bash
   npm install
   ```

Toutes les commandes se lancent depuis ce dossier.

## Les fichiers

| Fichier | Ce qu'il montre |
|---|---|
| `agent.ts` | L'agent du TP 6, réuni dans un seul fichier. Fourni, rien de nouveau. |
| `attaques.ts` | Les huit attaques et la copie piégée des données. |
| `1_injection.ts` | Une attaque glissée dans un commentaire d'arrêt. |
| `2_fuite.ts` | Neuf demandes pour faire sortir le prompt système, où l'on a caché un secret. |
| `3_parades.ts` | Quatre parades face à la même attaque. |
| `4_sortie_structuree.ts` | Une fiche de diagnostic validée par un schéma Zod, puis par une règle écrite en code. |
| `5_bash.ts` | L'outil Bash sous trois réglages : ouvert, limité, remplacé par un outil fermé. |

```bash
npx tsx 1_injection.ts                           # la liste des attaques
npx tsx 1_injection.ts instruction               # une instruction cachée, sur la question simple
npx tsx 1_injection.ts fausse_donnee diagnostic  # une fausse donnée, sur le diagnostic complet
npx tsx 2_fuite.ts
npx tsx 3_parades.ts fausse_donnee champ
npx tsx 3_parades.ts fausse_donnee regle
npx tsx 3_parades.ts instruction filtre
npx tsx 3_parades.ts autre_alphabet filtre   # le même ordre en russe : le filtre ne voit rien
npx tsx 3_parades.ts base64 juge
npx tsx 3_parades.ts fausse_donnee juge
npx tsx 4_sortie_structuree.ts
npx tsx 5_bash.ts ouvert        # puis : limite, ferme
```

## À savoir

Le hook du juge ferme par défaut : sans verdict, il retire le texte libre. Constat de mise au point : avec 1 000 tokens, le juge était coupé avant son verdict sur le texte en base64, le hook plantait, et le résultat de l'outil passait tel quel. Un garde-fou qui plante laisse passer.

Le juge de `3_parades.ts` obtient son verdict par une sortie structurée (`output_config`, un schéma JSON). L'ancienne astuce, imposer l'appel d'un outil avec `tool_choice`, est refusée par Claude Sonnet 5.5 et Claude Opus 5.5.
