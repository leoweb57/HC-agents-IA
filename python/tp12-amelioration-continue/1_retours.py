"""TP 12, étape 1 : relire les retours des utilisateurs.

Lancement, depuis le dossier du TP :
    python 1_retours.py

Un retour négatif est un cas de test en puissance : une vraie question, posée par un vrai utilisateur,
à laquelle l'agent a mal répondu.

Dans Langfuse, la même relecture se fait à l'écran : filtrer les traces sur le score avis_utilisateur = 0.
"""

from retours import FICHIER, lire_retours

retours = lire_retours()
positifs = sum(1 for retour in retours if retour["utile"])
print(f"{FICHIER.name} : {len(retours)} retour(s), dont {positifs} positif(s) et {len(retours) - positifs} négatif(s).")
for retour in retours:
    if not retour["utile"]:
        print(f"\n  Question    : {retour['question']}")
        print(f"  Réponse     : {retour['reponse']}")
        print(f"  Commentaire : {retour['commentaire'] or '(aucun)'}")
        print(f"  Trace       : {retour['trace_id']}")
