"""TP 3, variante du pattern 2 : Plan-and-Execute avec replanification. Après chaque étape, le plan est révisé.

Lancement, depuis le dossier du TP :
    python replanification.py
"""

import json

from plan_et_execution import executer_etape, planifier, synthetiser
from react import QUESTION, Compteur, appeler, texte

LIMITE_ETAPES = 6

REPLANIFICATEUR = (
    "Tu révises le plan d'un agent d'atelier en cours de route. Nous sommes le vendredi 13 mars 2026. "
    "On te donne la demande, les résultats déjà obtenus et les étapes qui restent. "
    "Garde, modifie, supprime ou ajoute des étapes selon ce que les résultats ont révélé. "
    "Ne garde pas d'étape de rédaction : la réponse finale sera rédigée à part. "
    "N'appelle aucun outil. Réponds uniquement par une liste JSON de chaînes de caractères (les étapes restantes), vide s'il n'y a plus rien à chercher."
)


def replanifier(notes: list[str], plan: list[str], compteur: Compteur) -> list[str]:
    """Un appel au modèle : il relit les résultats et renvoie la suite du plan, révisée."""
    consigne = (
        f"Demande : {QUESTION}\n\n"
        f"Résultats déjà obtenus :\n{chr(10).join(notes)}\n\n"
        f"Étapes restantes : {json.dumps(plan, ensure_ascii=False)}"
    )
    brut = texte(appeler(compteur, [{"role": "user", "content": consigne}], systeme=REPLANIFICATEUR))
    return json.loads(brut[brut.index("[") : brut.rindex("]") + 1])


def executer(bavard: bool = True) -> tuple[str, Compteur]:
    compteur = Compteur()
    plan = planifier(compteur)
    notes = []
    while plan and len(notes) < LIMITE_ETAPES:
        etape = plan.pop(0)
        if bavard:
            print(f"Étape {len(notes) + 1} : {etape}")
        notes.append(f"Étape {len(notes) + 1} ({etape}) : {executer_etape(etape, notes, compteur, bavard)}")
        plan = replanifier(notes, plan, compteur)
        if bavard:
            print(f"  plan révisé : {plan}")
    return synthetiser(notes, compteur), compteur


if __name__ == "__main__":
    reponse, compteur = executer()
    print()
    print(reponse)
    print()
    print(f"Plan-and-Execute avec replanification : {compteur}")
