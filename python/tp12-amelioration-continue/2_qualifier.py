"""TP 12, étape 2 : transformer un retour en cas de test.

Lancement, depuis le dossier du TP :
    python 2_qualifier.py

Un retour négatif dit que quelque chose ne va pas. Il ne dit pas ce qu'il fallait répondre.
Quelqu'un du métier l'écrit : c'est la qualification. Ici, ce travail est déjà fait, dans cas_qualifies.json :
  - le cas « Où en est l'OF-2231 ? » existait : son attendu gagne un point (signaler l'arrêt du matin) ;
  - un cas voisin vérifie que la correction vaut pour un autre ordre de fabrication ;
  - un troisième vérifie le cas sans arrêt : l'agent doit dire qu'il n'y en a pas eu, sans en inventer.

Le programme ajoute ces cas au jeu de questions : dans jeu_enrichi.json, et dans le dataset Langfuse.
"""

import json

from jeu import ajouter_des_cas, cas_locaux, langfuse, publier_jeu
from retours import TP, lire_retours

retours = lire_retours()
qualifies = json.loads((TP / "cas_qualifies.json").read_text(encoding="utf-8"))

# On relie chaque cas au retour qui l'a fait naître : même question, avis négatif.
# (Les retours d'exemple n'ont pas de vraie trace : on ne garde que les identifiants de trace de Langfuse.)
for cas in qualifies:
    origine = next((r for r in retours if r["question"] == cas["question"] and not r["utile"]), None)
    if origine and not origine["trace_id"].startswith("exemple") and set(origine["trace_id"]) != {"0"}:
        cas["trace_id"] = origine["trace_id"]

ajouter_des_cas(qualifies)
print(f"Jeu de questions : {len(cas_locaux())} cas, dont {len(qualifies)} issus des retours.")
for cas in qualifies:
    print(f"  {cas['id']} : {cas['points_attendus'][-1]}")

try:
    publier_jeu()
    langfuse.flush()
except Exception:
    print("  (Langfuse n'est pas configuré : seul jeu_enrichi.json a été écrit.)")
