"""TP 3 : lance les trois patterns sur la même demande et compare ce qu'ils consomment.

Lancement, depuis le dossier du TP :
    python comparer.py
"""

import plan_et_execution
import react
import reflection

print(f"Demande : {react.QUESTION}")
print()
resultats = []
for nom, module in (("ReAct", react), ("Plan-and-Execute", plan_et_execution), ("Reflection", reflection)):
    print(f"--- {nom} ---")
    reponse, compteur = module.executer(bavard=False)
    print(reponse)
    print()
    resultats.append((nom, compteur))

print(f"{'Pattern':<18}{'Appels':>8}{'Tokens entrée':>16}{'Tokens sortie':>16}")
for nom, compteur in resultats:
    print(f"{nom:<18}{compteur.appels:>8}{compteur.entree:>16}{compteur.sortie:>16}")
