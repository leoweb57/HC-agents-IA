"""TP 3, pattern 4 : le raisonnement intégré au modèle. Même boucle ReAct, deux niveaux d'effort.

Les modèles récents réfléchissent avant de répondre. On ne l'écrit plus dans le prompt : on règle un niveau.

Lancement, depuis le dossier du TP :
    python raisonnement.py
"""

from react import QUESTION, Compteur, boucle_react

for effort in ("low", "high"):
    compteur = Compteur()
    print(f"=== Effort : {effort} ===")
    reponse = boucle_react([{"role": "user", "content": QUESTION}], compteur, effort=effort)
    print()
    print(reponse)
    print()
    print(f"Effort {effort} : {compteur}")
    print()
