---
name: diagnostic-arret
description: Méthode de diagnostic d'un arrêt machine de l'atelier. À utiliser dès qu'on demande d'analyser, d'expliquer ou de diagnostiquer un arrêt ou une panne sur une machine.
---

# Diagnostic d'un arrêt machine

Suis ces étapes dans l'ordre. Ne saute aucune étape, même si la cause semble évidente.

1. **L'arrêt.** Appelle `lister_arrets` pour la machine. Retiens l'arrêt concerné : heure, durée, cause, ordre de fabrication.
2. **La récurrence.** Appelle `historique_arrets` pour la même machine, sur les 30 jours précédents. Compte les arrêts qui ont la même cause.
3. **La procédure.** Lis la procédure qui correspond à la cause, dans le dossier `procedures/` de ce skill :
   - défaut d'éjection : `procedures/defaut_ejection.md`
   - dérive du temps de cycle : `procedures/derive_temps_de_cycle.md`
   - autre cause : dis qu'aucune procédure n'existe pour cette cause.

## Format de la réponse

Réponds avec ces quatre lignes, dans cet ordre, et rien d'autre :

- **Constat** : l'arrêt, en une phrase, avec l'ordre de fabrication concerné.
- **Récurrence** : le nombre d'arrêts de même cause sur 30 jours.
- **Procédure** : l'étape de la procédure où l'on en est.
- **Recommandation** : l'action suivante. Ne crée pas de demande d'intervention toi-même : propose-la.
