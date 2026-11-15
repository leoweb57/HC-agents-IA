# TP en TypeScript

Prérequis : Node.js 20.12 ou plus récent (npm est fourni avec Node). Les TP 10 à 12 demandent Node.js 22.

Avant chaque TP, vérifiez que le fichier `.env` à la racine du dépôt contient votre clé API et le nom du modèle à utiliser. Si un TP demande de changer de modèle ou de fournisseur, c'est dans ce fichier que ça se passe.

## Les TP

| TP | Sujet | Jour | Durée |
|---|---|---|---|
| [TP 1](tp1-premiers-appels/README.md) | Premiers appels à l'API, constater la variabilité | 1 | 30 min |
| [TP 2](tp2-boucle-agentique/README.md) | La boucle agentique écrite à la main, trois énigmes | 1 | 35 min |
| [TP 3](tp3-patterns/README.md) | Trois patterns d'agents côte à côte (lecture libre) | 1 | libre |
| [TP 4](tp4-agent-sdk/README.md) | L'agent d'atelier avec l'Agent SDK, jusqu'à l'interface de discussion | 1 | 2 h |
| [TP 5](tp5-mcp/README.md) | Écrire un serveur MCP et le brancher sur l'agent | 2 | 40 min |
| [TP 6](tp6-skills/README.md) | Un skill, et trois outils à corriger | 2 | 30 min |
| [TP 7](tp7-multi-agents/README.md) | Agent v2 : un principal et trois spécialistes, comparés à l'agent seul | 2 | 1 h 55 |
| [TP 8](tp8-securite/README.md) | Sécurité : détourner l'agent par ses données, puis le défendre | 3 | 30 min |
| [TP 9](tp9-couts/README.md) | Coûts et contexte : cache, compaction, recherche d'outils, modèles | 3 | 30 min |
| [TP 10](tp10-observabilite/README.md) | Observabilité : les traces de l'agent dans Langfuse | 3 | 40 min |
| [TP 11](tp11-evaluation/README.md) | Évaluation : un jeu de questions, un juge, une référence | 3 | 30 min |
| [TP 12](tp12-amelioration-continue/README.md) | Amélioration continue : d'un avis négatif à une nouvelle version | 3 | 30 min |

Hors TP : [demo-managed-agents](demo-managed-agents/README.md), le code de la démonstration du module 4 (jour 2). L'agent d'atelier, hébergé par Claude Managed Agents.

Chaque dossier de TP contient son énoncé, ses dépendances, un dossier `exercice/` et un dossier `solution/`. Le TP 2 a en plus un dossier `enigmes/`. Le TP 3 fait exception : c'est du code complet, à lire et à lancer. Dans le TP 4, `solution/` ne contient que le fichier à compléter, corrigé.

Les TP 8 à 12, ceux du jour 3, sont aussi du code complet : on le lance, on le lit, on regarde ce qu'il mesure. Les TP 10 à 12 utilisent Langfuse en local (installation dans le README du TP 10) ; ils tournent aussi sans.
