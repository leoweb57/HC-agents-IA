"""TP 3, pattern 3 : Reflection. L'agent produit une réponse, la relit selon des critères, et la corrige si besoin.

Lancement, depuis le dossier du TP :
    python reflection.py
"""

from react import QUESTION, Compteur, appeler, boucle_react, texte

PASSES_MAX = 2

CRITERES = """- Chaque chiffre cité vient des résultats des outils.
- La durée totale d'arrêt de la semaine est donnée, en minutes.
- Les contrôles qualité de l'ordre de fabrication sont cités, avec leur décision.
- La recommandation finale s'appuie sur une cause précise.
- La réponse fait moins de 150 mots."""

RELECTURE = (
    "Relis ta dernière réponse comme un relecteur exigeant, critère par critère :\n"
    f"{CRITERES}\n\n"
    "Si tous les critères sont respectés, réponds uniquement : OK. "
    "Sinon, liste les corrections à faire, sans réécrire la réponse."
)


def executer(bavard: bool = True) -> tuple[str, Compteur]:
    compteur = Compteur()
    session = [{"role": "user", "content": QUESTION}]

    # 1. Produire : un premier jet, avec la boucle ReAct.
    reponse = boucle_react(session, compteur, bavard=bavard)

    for passe in range(1, PASSES_MAX + 1):
        # 2. Critiquer : la session contient déjà les résultats des outils, le modèle peut vérifier.
        session.append({"role": "user", "content": RELECTURE})
        critique = texte(appeler(compteur, session))
        session.append({"role": "assistant", "content": critique})
        if bavard:
            print(f"Relecture {passe} : {critique}")
        if critique.upper().startswith("OK"):
            break

        # 3. Corriger : on repasse par la boucle, au cas où il faille rappeler un outil.
        session.append({"role": "user", "content": "Réécris ta réponse en appliquant ces corrections. Donne uniquement la réponse finale."})
        reponse = boucle_react(session, compteur, bavard=bavard)

    return reponse, compteur


if __name__ == "__main__":
    reponse, compteur = executer()
    print()
    print(reponse)
    print()
    print(f"Reflection : {compteur}")
