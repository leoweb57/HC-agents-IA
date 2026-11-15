# TP 5 — Écrire un serveur MCP et le brancher

**Durée : 40 min.** Jour 2, après le module 1.

## Objectif

- Lire un serveur MCP, *Mémoire*, et voir ce qu'il annonce à un client.
- Écrire le vôtre : le serveur « atelier », avec les outils de lecture de l'agent d'hier.
- Le brancher sur l'agent, à la place de ses outils internes.

Ce serveur resservira cet après-midi : plusieurs agents s'y brancheront.

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
| `exemple/memoire.py` | *Mémoire*, le serveur MCP du cours. À lire : c'est le modèle à suivre. |
| `exercice/decouvrir.py` | Un client MCP minimal : il interroge un serveur, sans agent ni modèle. Fourni. |
| `exercice/serveur_atelier.py` | **À écrire.** Votre serveur MCP. |
| `exercice/agent.py` | **À compléter.** L'agent du TP 4, terminé. Vous pouvez y mettre le vôtre. |
| `exercice/terminal.py` | Une conversation dans le terminal. Fourni. |

## Partie 1 — Un serveur MCP, vu de près (5 min)

1. Ouvrez `exemple/memoire.py`. Trois choses à repérer : la création du serveur, la déclaration des deux outils, le lancement.
2. Interrogez-le, puis appelez un de ses outils :

   ```bash
   python exercice/decouvrir.py exemple/memoire.py
   python exercice/decouvrir.py exemple/memoire.py memoriser auteur=Moi "note=Premier essai."
   ```

   Le client lance le serveur, fait la poignée de main, demande la liste des outils, puis en appelle un. Ce sont les trois demandes du protocole : `initialize`, `tools/list`, `tools/call`.

## Partie 2 — Écrire le serveur « atelier » (20 min)

Dans `exercice/serveur_atelier.py`, suivez les étapes 1 à 3 :

1. Créer le serveur, nommé `atelier`.
2. Y déclarer `lister_arrets` et `lire_ordre_fabrication`. Leur code est dans `exercice/agent.py` : reprenez-le, avec les mêmes noms et les mêmes descriptions.
3. Lancer le serveur.

Testez-le sans agent, autant de fois que nécessaire :

```bash
python exercice/decouvrir.py exercice/serveur_atelier.py
python exercice/decouvrir.py exercice/serveur_atelier.py lister_arrets machine_id=P4
python exercice/decouvrir.py exercice/serveur_atelier.py lire_ordre_fabrication of_id=OF-9999
```

Le dernier appel doit revenir marqué « ERREUR », avec un message lisible.

## Partie 3 — Le brancher sur l'agent (15 min)

Dans `exercice/agent.py`, section « TP 5 » :

4. Retirez de l'agent les deux outils qui ont déménagé. Le serveur interne ne garde que l'action : renommez-le `actions`.
5. Ajoutez votre serveur à `mcp_servers` : la commande qui le lance.

```bash
python exercice/terminal.py
```

- « Que s'est-il passé sur la presse 4 ce matin, et où en est l'ordre de fabrication concerné ? »
- « Crée une demande d'intervention pour l'éjecteur de la presse 4. »

Regardez le journal : les outils de lecture portent le même nom qu'hier. Qu'est-ce qui a changé, et pour qui ?

## Bonus

Ajoutez au serveur `lister_controles_qualite` et `historique_arrets` (les consignes sont dans le fichier), autorisez-les dans l'agent, puis demandez : « Cet arrêt est-il déjà arrivé depuis début mars, et les contrôles qualité de l'ordre de fabrication sont-ils bons ? »

## Solution

`solution/serveur_atelier.py` et `solution/agent.py` sont les deux fichiers de l'exercice une fois terminés, bonus compris. Leurs commentaires « Pourquoi » expliquent les choix. Pour les voir tourner, copiez-les à la place de ceux du dossier `exercice/`.
