# TP 7 — Agent v2 : diagnostiquer un incident à plusieurs

**Durée : 1 h 55.** Jour 2, après le module 3.

## Objectif

- Passer d'un agent seul à un principal qui délègue à trois spécialistes : qualité, production, maintenance.
- Donner à chaque spécialiste son prompt, ses outils et, pour la maintenance, son skill.
- Analyser un cas où le contexte ne passe pas du principal à un spécialiste, et le corriger.
- Mesurer les deux agents sur les mêmes questions : appels au modèle, tokens, durée, coût, qualité de la réponse.

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
| `exercice/agent_v2.py` | **À compléter.** Le principal, le spécialiste qualité (fourni comme modèle), la règle de délégation, les options. |
| `exercice/agent_v1.py` | L'agent seul : celui du TP 6, terminé. Fourni. |
| `exercice/commun.py` | Ce que les deux agents partagent : le serveur MCP, l'outil d'action, la trace, les permissions. Fourni. |
| `exercice/terminal.py` | Une conversation dans le terminal, avec `v1` ou `v2`. Après chaque réponse, une ligne de mesure. Fourni. |
| `exercice/comparer.py` | Pose trois questions aux deux agents et affiche un tableau. Fourni. |
| `exercice/mesures.py` | Le calcul des mesures. Fourni. |
| `serveur_atelier.py` | Le serveur MCP « atelier » du TP 6, corrigé. Fourni. |
| `.claude/skills/diagnostic-arret/` | Le skill de diagnostic et ses deux procédures. Fourni. |

Les deux agents ont les mêmes données, les mêmes outils, le même skill et le même modèle. Seule l'architecture change.

## Lire le journal et la ligne de mesure

```text
  [principal] délègue à « qualite » : Liste les contrôles qualité de l'ordre de fabrication OF-2231…
  [qualite] mcp__atelier__lister_controles_qualite({"of_id": "OF-2231"})
  [4 appels au modèle, 1 outil, 13 976 tokens lus, 7.5 s, 0.0011 $ (principal 2 appels, 9 778 tokens · qualite 2 appels, 4 198 tokens)]
```

- Entre crochets, au début de chaque ligne du journal : l'agent qui appelle l'outil.
- Après « délègue à » : le texte envoyé au spécialiste. C'est tout ce qu'il reçoit de la demande.
- La ligne de mesure : les appels au modèle (chacun est payé, et chacun prend du temps), les appels d'outils, les tokens lus par le modèle tous appels confondus, la durée, le coût. Entre parenthèses, le détail par agent.

Les chiffres bougent d'un essai à l'autre : le modèle ne fait pas deux fois exactement la même chose.

## Étape 1 — L'agent v1, la référence (10 min)

```bash
python exercice/terminal.py v1
```

- « Diagnostique l'arrêt de ce matin sur la presse 4. »

Un seul agent : il charge le skill, appelle ses outils, lit la procédure et répond. Notez sa ligne de mesure.

## Étape 2 — Lire l'agent v2, et le lancer (15 min)

Ouvrez `exercice/agent_v2.py`. Il a quatre parties :

1. **Le principal** : son prompt système. Il ne consulte aucune donnée, il délègue.
2. **Les spécialistes** : un seul pour l'instant, la qualité. Trois champs : `description`, `prompt`, `tools`.
3. **La règle** : un hook qui refuse au principal tout outil autre que la délégation et l'action.
4. **Les options** : `agents`, l'outil intégré `Agent`, et quelques réglages commentés.

```bash
python exercice/terminal.py v2
```

- « Quels contrôles qualité a-t-on sur l'OF-2231 ? » Dans le journal : qui délègue, à qui, avec quel texte ? Qui appelle l'outil ?
- « Où en est l'OF-2231 ? » Aucun spécialiste ne sait lire un ordre de fabrication. Que répond le principal ?

## Étape 3 — Le spécialiste production (15 min)

Dans `SPECIALISTES`, ajoutez `"production"` sur le modèle de `"qualite"` :

- `description` : ce qu'il sait faire, et quand faire appel à lui. C'est tout ce que le principal sait de lui.
- `prompt` : son rôle, puis `REGLES`.
- `tools` : `[LIRE_ORDRE_FABRICATION]`.

Relancez le terminal : « Où en est l'OF-2231 ? »

Attendu : Boîtier B14, presse P4, 1 740 pièces sur 3 000, en cours depuis le 12 mars à 6 h.

## Étape 4 — Le spécialiste maintenance (20 min)

Ajoutez `"maintenance"` :

- `tools` : `[LISTER_ARRETS, HISTORIQUE_ARRETS, "Read"]`. `Read` sert à lire les procédures du skill.
- `skills=["diagnostic-arret"]` : le SDK charge le skill dans le contexte de ce sous-agent, à son lancement. Le principal ne le voit pas.

Relancez le terminal :

- « Diagnostique l'arrêt de ce matin sur la presse 4. »

  Attendu, comme avec la v1 : l'arrêt AR-510 (7 h 42, 74 min, défaut d'éjection, OF-2231), 3 arrêts de même cause sur 30 jours (18 février, 25 février, 13 mars), la procédure `defaut_ejection.md`, une demande d'intervention proposée mais pas créée. Dans le journal, le spécialiste appelle `lister_arrets`, `historique_arrets`, puis `Read`.

- « Crée la demande d'intervention. » C'est le principal qui agit, après votre accord.

## Étape 5 — Un cas d'échec : le contexte qui ne passe pas (25 min)

Dans une conversation neuve (relancez le terminal) :

- « La presse 4 a-t-elle souvent des défauts d'éjection ? »

Attendu : oui, 9 arrêts depuis janvier, dont 3 sur les 30 derniers jours. Le dernier date de ce matin.

Lisez la réponse jusqu'au bout. Que dit-elle des données, ou de la date ? Le principal ne rédige pas deux fois la même délégation : si la réponse vous semble juste, reposez la question dans une conversation neuve.

Cherchez la cause :

1. Dans le journal, relisez le texte de la délégation. La date du jour y figure-t-elle ?
2. Posez : « Demande au spécialiste maintenance quel jour nous sommes d'après lui, sans le lui dire. » Que répond-il ? D'où vient cette date ?
3. Dans `agent_v2.py`, où la date est-elle écrite ? Quel agent lit ce texte ?

Corrigez, en deux temps :

1. **Ce qui est vrai pour tous les agents** va dans une constante, reprise dans le prompt du principal et dans celui de chaque spécialiste.
2. **Ce qui dépend de la demande** passe par la délégation. Ajoutez une consigne au prompt du principal : un spécialiste ne voit pas la conversation ; la délégation contient la demande et ce qu'il ne peut pas deviner ; elle ne lui dicte pas sa méthode.

Reposez les deux questions.

## Étape 6 — Comparer v1 et v2 (20 min)

```bash
python exercice/comparer.py
```

Trois questions, posées à chaque agent dans une conversation neuve. Comptez deux à trois minutes.

1. « Où en est l'OF-2231 ? »
2. « Diagnostique l'arrêt de ce matin sur la presse 4. »
3. « Fais le point sur l'OF-2231 : avancement, arrêts, qualité, et ce que tu recommandes. »

Remplissez la grille à partir du récapitulatif, puis relisez les réponses.

| Question | Tokens lus, v1 puis v2 | Durée, v1 puis v2 | Coût, v1 puis v2 | La meilleure réponse |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

Ce qui est attendu pour la question 3 :

- **Avancement** : 1 740 pièces sur 3 000, en cours sur la presse P4 depuis le 12 mars à 6 h.
- **Arrêts** : deux cette semaine, le 12 mars (28 min, dérive du temps de cycle) et le 13 mars (74 min, défaut d'éjection). Le défaut d'éjection revient : 3 fois en 30 jours.
- **Qualité** : deux contrôles. Le second, le 13 mars à 9 h 30, relève 4 non-conformes sur 50 pour trace d'éjecteur, accepté sous réserve.
- **Recommandation** : faire le lien entre l'éjecteur et les traces, proposer une intervention.

Pour la discussion :

- Sur quelle question l'écart est-il le plus grand ? Dans le détail par agent, qui consomme ?
- Combien de tokens le principal lit-il par appel, même quand il ne fait que transmettre ?
- Sur quelle question la réponse de la v2 est-elle meilleure, et pourquoi ?
- Quatre outils et un skill : pour cet atelier, un seul agent suffit-il ?

## Pour aller plus loin

- **L'arrière-plan.** Dans les options, retirez `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` et redemandez le diagnostic, deux ou trois fois. Le principal répond-il avant d'avoir le rapport ?
- **Une limite par spécialiste.** Ajoutez `maxTurns=2` au spécialiste maintenance (ce champ garde cette écriture en Python) et redemandez le diagnostic. Que reçoit le principal ? Que fait-il ?
- **Un mauvais aiguillage.** « Combien de défauts d'éjection sur la presse 4 ces 30 derniers jours ? » À qui le principal délègue-t-il ? La v1 répond 3. Reprenez les descriptions des spécialistes.
- **Sans la règle.** Retirez un spécialiste, le hook `le_principal_delegue` et la ligne `disallowed_tools`. Que fait le principal quand personne ne peut répondre ?

## Solution

`solution/agent_v2.py` est le fichier terminé. Les commentaires « Pourquoi » expliquent les choix, les commentaires « Correction » le défaut de l'étape 5. Pour le voir tourner, copiez-le à la place de `exercice/agent_v2.py`.
