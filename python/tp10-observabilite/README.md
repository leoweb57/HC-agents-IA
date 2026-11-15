# TP 10 — Observabilité : voir ce que fait l'agent dans Langfuse

**Code fourni.** Jour 3, après le module 3. On installe Langfuse en local, on lance l'agent, on regarde ses traces.

## Objectif

- Avoir une trace par question, avec chaque appel au modèle et chaque outil, leur durée, leurs tokens et leur coût.
- Regrouper les traces d'une conversation dans une session, et les rattacher à un utilisateur.
- Poser un score sur une trace depuis l'agent : l'avis de l'utilisateur.
- Comparer trois façons de tracer l'Agent SDK, et voir pourquoi un appel direct à l'API n'en a pas besoin.

## Installer Langfuse en local

Il faut Docker, Git, et quelques gigaoctets de mémoire libres. Langfuse lance sept conteneurs.

```bash
git clone https://github.com/langfuse/langfuse.git
cd langfuse
docker compose --env-file /chemin/vers/HC-agents-IA/langfuse.env up -d
```

Le fichier `langfuse.env` est à la racine de notre dépôt. Il demande à Langfuse de créer, au premier démarrage, un projet, ses deux clés et un compte. Comptez deux à trois minutes, puis ouvrez <http://localhost:3000> :

- adresse : `stagiaire@example.com`
- mot de passe : `formation-agents-ia`

Dernière étape : dans le fichier `.env` à la racine de notre dépôt, décommentez les trois lignes `LANGFUSE_…`. Ce sont les clés du projet créé.

Pour arrêter Langfuse : `docker compose down` dans le dossier `langfuse`. Ajoutez `-v` pour effacer aussi les données.

**Pas de Docker sur votre poste ?** Deux possibilités. Mettre dans `LANGFUSE_BASE_URL` l'adresse d'un Langfuse qui tourne sur un autre poste du réseau (`http://<adresse>:3000`). Ou ne rien installer : sans les trois lignes, le programme affiche un avertissement, tourne normalement et n'envoie rien.

**Versions.** Le SDK Langfuse de ce TP (Python 5) demande Python 3.11 ou plus récent et un Langfuse 4.59 ou plus récent. Le `docker-compose.yml` du dépôt officiel installe la version 4.

## Installation du TP

```bash
pip install -r requirements.txt
```

Toutes les commandes se lancent depuis ce dossier.

## Les fichiers

| Fichier | Ce qu'il montre |
|---|---|
| `agent.py` | L'agent du TP 6, réuni dans un seul fichier. Fourni. |
| `suivi.py` | La traduction du flux de messages du SDK en observations Langfuse. Fourni : une centaine de lignes à lire. |
| `terminal.py` | Une conversation tracée : le décorateur `@observe`, la session, l'utilisateur, l'avis en score. |
| `variante_api_directe.py` | Un appel direct à l'API : le SDK Anthropic le trace tout seul. |
| `variante_openinference.py` | La même question, tracée par une instrumentation automatique : deux lignes. |
| `variante_otel_natif.py` | La même question, tracée par l'export OpenTelemetry du SDK : aucune ligne, des variables d'environnement. |

```bash
python terminal.py                 # posez deux ou trois questions, donnez votre avis
python terminal.py chef-equipe-2   # la même chose, au nom d'un autre utilisateur
python variante_api_directe.py
python variante_otel_natif.py
python variante_openinference.py
```

## Ce qu'il faut regarder dans Langfuse

1. **Traces.** Une trace `agent-atelier` par question. Dedans : `démarrage du SDK`, puis les `appel au modèle` et les outils, dans l'ordre.
2. **Un appel au modèle.** Le modèle, les tokens lus, relus en cache et produits, le coût, le temps avant le premier token.
3. **Un outil.** Ses paramètres, son résultat, sa durée. Une action refusée apparaît en erreur.
4. **Sessions.** La conversation regroupe ses traces, dans l'ordre des questions.
5. **Users.** `chef-equipe-1`, et ses conversations.
6. **Scores.** `avis_utilisateur` sur la trace, avec le commentaire.

## Pourquoi un fichier `suivi.py`

Avec un appel direct à l'API, il n'y a rien à faire : le SDK Anthropic émet lui-même une trace OpenTelemetry par appel (modèle, tokens, durée), et Langfuse la reçoit. C'est `variante_api_directe.py` : un décorateur sur notre fonction, et l'appel se range dessous.

Avec l'Agent SDK, la boucle tourne dans un autre processus : ses appels au modèle ne passent pas par notre code. On décore donc notre fonction (`@observe` : c'est la racine de la trace), et on reconstruit le reste à partir de ce que le SDK raconte dans son flux de messages.

Deux pièges, rencontrés en écrivant ce fichier :

- Les hooks arrivent au milieu de la réponse du modèle (les outils partent pendant qu'il écrit encore). Un découpage fondé sur les hooks coupe mal les appels. On lit tout dans le flux de messages.
- L'usage porté par les messages de l'assistant est pris en début de réponse : les tokens produits y sont faux (3 au lieu de 304). L'usage exact arrive en fin de réponse, dans l'événement `message_delta` : il faut demander les messages partiels (`include_partial_messages`).

## Trois façons de tracer, comparées

Essais du 15 novembre 2026, sur la même question.

| | À la main (`terminal.py`) | OpenInference | Export OTel du SDK |
|---|---|---|---|
| Code à écrire | `suivi.py`, une centaine de lignes | deux lignes | aucune |
| Détail appel par appel | oui | non : une observation pour tout l'agent | oui |
| Texte des échanges | oui | question, réponse, outils | non |
| Tokens | exacts, par appel | cumulés ; produits sous-estimés (11 relevés pour une réponse de plusieurs phrases) | exacts, par appel |
| Durée de chaque outil | oui, attente de l'accord comprise | non | oui, attente de l'accord à part |
| Session et utilisateur | les nôtres | les nôtres | ceux du SDK, différents des nôtres |

Notre choix pour la formation : à la main. C'est la seule voie qui donne à la fois le contenu et les mesures exactes, dans les termes de Langfuse. L'export du SDK est le plus simple pour suivre la consommation et les durées. Il est en bêta.

Piège de la variante OpenInference : l'instrumentation remplace la fonction `query` du module. Un `from claude_agent_sdk import query` fait avant `instrument()` garde l'ancienne fonction, non tracée.

## À savoir

- Le démarrage du SDK prend 1,6 à 1,9 seconde à chaque question : la trace le montre.
- Les avis sont aussi écrits dans `retours.jsonl`. Le TP 12 les relit.
- Vérifié contre un serveur de test qui enregistre ce que le SDK Langfuse envoie. L'affichage dans Langfuse se vérifie sur votre installation.
