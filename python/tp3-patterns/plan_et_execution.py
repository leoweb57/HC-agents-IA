"""TP 3, pattern 2 : Plan-and-Execute. Un premier appel écrit le plan, puis chaque étape est exécutée, puis on synthétise.

Lancement, depuis le dossier du TP :
    python plan_et_execution.py
"""

import json

from react import QUESTION, Compteur, appeler, boucle_react, texte

PLANIFICATEUR = (
    "Tu prépares le travail d'un agent d'atelier. Nous sommes le vendredi 13 mars 2026. "
    "Découpe la demande en 3 à 5 étapes courtes, dans l'ordre. "
    "Chaque étape doit pouvoir se faire avec les outils disponibles. "
    "N'appelle aucun outil maintenant. Réponds uniquement par une liste JSON de chaînes de caractères."
)


def planifier(compteur: Compteur) -> list[str]:
    """1. Planifier : un seul appel, sans exécuter d'outil."""
    reponse = appeler(compteur, [{"role": "user", "content": QUESTION}], systeme=PLANIFICATEUR)
    brut = texte(reponse)
    # Le modèle entoure parfois le JSON de texte : on garde ce qui est entre les crochets.
    return json.loads(brut[brut.index("[") : brut.rindex("]") + 1])


def executer_etape(etape: str, notes: list[str], compteur: Compteur, bavard: bool) -> str:
    """2. Exécuter : une petite boucle ReAct par étape, avec les résultats des étapes précédentes."""
    consigne = (
        f"Demande d'origine : {QUESTION}\n\n"
        f"Résultats déjà obtenus :\n{chr(10).join(notes) or 'aucun'}\n\n"
        f"Étape à réaliser maintenant : {etape}\n"
        "Donne uniquement les faits utiles pour cette étape, sans conclure."
    )
    return boucle_react([{"role": "user", "content": consigne}], compteur, bavard=bavard)


def synthetiser(notes: list[str], compteur: Compteur) -> str:
    """3. Synthétiser : un dernier appel, à partir des résultats de toutes les étapes."""
    consigne = f"Demande : {QUESTION}\n\nRésultats des étapes :\n{chr(10).join(notes)}\n\nRédige la réponse finale."
    return texte(appeler(compteur, [{"role": "user", "content": consigne}]))


def executer(bavard: bool = True) -> tuple[str, Compteur]:
    compteur = Compteur()
    plan = planifier(compteur)
    notes = []
    for numero, etape in enumerate(plan, start=1):
        if bavard:
            print(f"Étape {numero} : {etape}")
        notes.append(f"Étape {numero} ({etape}) : {executer_etape(etape, notes, compteur, bavard)}")
    return synthetiser(notes, compteur), compteur


if __name__ == "__main__":
    reponse, compteur = executer()
    print()
    print(reponse)
    print()
    print(f"Plan-and-Execute : {compteur}")
