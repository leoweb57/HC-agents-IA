"""TP 12 : l'évaluation du TP 11, inchangée. On la rejoue sur le jeu enrichi par les retours.

Lancement, depuis le dossier du TP :
    python evaluer.py v1 --reference  évalue la v1 sur le jeu enrichi et en fait la référence
    python evaluer.py v3              évalue la v3 et la compare à la référence

Le programme se termine en erreur si la version évaluée fait moins bien que la référence :
on peut le brancher sur l'intégration continue, comme des tests unitaires.
"""

import json
import sys
from datetime import datetime

from claude_agent_sdk import query

from agent import MODELE, OUTIL_D_ACTION, TP, creer_options  # agent.py lit le fichier .env : à importer avant Langfuse
from jeu import lire, lire_jeu
from juge import CRITERES, MODELE_DU_JUGE, juger
from langfuse import Evaluation, get_client, observe
from prompts import texte_du_prompt
from suivi import Suivi

langfuse = get_client()
REFERENCE = TP / "reference.json"
JUGEMENTS = list(CRITERES)  # exactitude, complétude, ancrage, pertinence : notés 1 ou 0 par le juge
CONTROLES = ["outils", "consignes"]  # notés 1 ou 0 par le code
EFFORT = ["etapes", "cout", "duree"]  # mesurés : plus bas, c'est mieux
QUALITE = JUGEMENTS + CONTROLES
# L'écart toléré avant de parler de régression. Le juge et l'agent ne répondent pas deux fois pareil :
# sur dix cas, on a vu un cas basculer d'une évaluation à l'autre. Un contrôle par le code, lui, ne varie pas.
TOLERANCE = {**{nom: 0.1 for nom in JUGEMENTS}, **{nom: 0.0 for nom in CONTROLES}}
TITRES = {"exactitude": "exact.", "completude": "complét.", "ancrage": "ancrage", "pertinence": "pertin.", "outils": "outils", "consignes": "consignes", "etapes": "étapes", "cout": "coût $", "duree": "durée s"}

VERSION = next((a for a in sys.argv[1:] if not a.startswith("--")), "v1")
SYSTEME, PROMPT = texte_du_prompt(VERSION)
BILANS = {}  # question -> bilan du tour (outils appelés, résultats, coût) : les contrôles en ont besoin


# ---------- La tâche : l'agent répond à une question du jeu ----------

async def refuser(nom_outil: str, parametres: dict) -> bool:
    """En évaluation, personne ne valide : l'action n'est jamais exécutée. On vérifie seulement qu'elle a été demandée."""
    return False


@observe(name="agent-atelier", as_type="agent", capture_input=False, capture_output=False)
async def repondre(question: str) -> dict:
    langfuse.update_current_span(input=question)
    suivi = Suivi(question, prompt=PROMPT)  # chaque appel au modèle sera relié à la version du prompt
    options = suivi.brancher(creer_options(SYSTEME, demander_accord=refuser, journal_des_outils=False))
    async for message in query(prompt=question, options=options):
        suivi.voir(message)
    return suivi.bilan


async def tache(*, item, **kwargs) -> str:
    question = lire(item, "input")
    BILANS[question] = await repondre(question)
    return BILANS[question]["reponse"]


# ---------- Les contrôles par le code : gratuits, immédiats, toujours le même verdict ----------

def controles(*, input, output, expected_output, metadata, **kwargs) -> list[Evaluation]:
    bilan = BILANS[input]
    appeles = [outil["nom"].split("__")[-1] for outil in bilan["outils"]]
    manquants = [nom for nom in metadata["outils"] if nom not in appeles]

    # Les consignes qu'un programme sait vérifier : l'action et le format.
    ecarts = []
    demandes = [outil["parametres"] for outil in bilan["outils"] if outil["nom"] == OUTIL_D_ACTION]
    attendue = metadata.get("action")
    if demandes and not attendue:
        ecarts.append("une action a été demandée sans qu'on la réclame")
    if attendue and not any(all(str(d.get(cle, "")).lower() == valeur.lower() for cle, valeur in attendue.items()) for d in demandes):
        ecarts.append(f"l'action attendue n'a pas été demandée avec {attendue}")
    if metadata.get("format") == "diagnostic":
        ecarts += [f"ligne « {ligne} » absente" for ligne in ("Constat", "Récurrence", "Procédure", "Recommandation") if ligne not in output]

    return [
        Evaluation(name="outils", value=0 if manquants else 1, comment=f"non appelés : {manquants}" if manquants else f"appelés : {appeles}"),
        Evaluation(name="consignes", value=0 if ecarts else 1, comment=" ; ".join(ecarts) or "action et format conformes"),
        Evaluation(name="etapes", value=bilan["appels"], comment="appels au modèle"),
        Evaluation(name="cout", value=round(bilan["cout_sdk"], 6), comment="dollars"),
        Evaluation(name="duree", value=round(bilan["duree"], 1), comment="secondes"),
    ]


# ---------- Les jugements : un appel au modèle juge par critère ----------

def jugement(critere: str):
    """Fabrique l'évaluateur d'un critère."""

    async def evaluateur(*, input, output, expected_output, metadata, **kwargs) -> Evaluation:
        verdict = await juger(
            critere,
            question=input,
            reponse=output,
            points="\n".join(f"- {point}" for point in expected_output["points"]),
            sources=sources(BILANS[input]),
        )
        return Evaluation(name=critere, value=1 if verdict["verdict"] else 0, comment=verdict["raisonnement"])

    evaluateur.__name__ = f"juge_{critere}"
    return evaluateur


OUTILS_DE_L_AGENT = (
    "Outils dont dispose l'assistant : les arrêts d'une machine sur la semaine en cours, l'historique des arrêts d'une machine, "
    "les contrôles qualité et le détail d'un ordre de fabrication, la création d'une demande d'intervention. Il n'en a pas d'autre."
)


def sources(bilan: dict) -> str:
    """Ce que l'agent avait le droit de savoir : son prompt système, ses outils, et ses appels avec leurs résultats."""
    appels = [f"Appel : {r['outil']}({json.dumps(r['parametres'], ensure_ascii=False)})\nRésultat : {r['resultat']}" for r in bilan["resultats"]]
    return "\n\n".join([f"Contexte donné à l'assistant : {SYSTEME}", OUTILS_DE_L_AGENT, *appels])


def moyennes(*, item_results, **kwargs) -> list[Evaluation]:
    """Les moyennes du jeu entier : c'est elles qu'on compare d'une version à l'autre."""
    return [Evaluation(name=f"moyenne_{nom}", value=valeur) for nom, valeur in calculer_moyennes(item_results).items()]


def calculer_moyennes(resultats) -> dict:
    notes = {}
    for resultat in resultats:
        for evaluation in resultat.evaluations:
            notes.setdefault(evaluation.name, []).append(evaluation.value)
    return {nom: round(sum(valeurs) / len(valeurs), 4) for nom, valeurs in notes.items()}


# ---------- L'affichage et la comparaison ----------

def afficher(resultats) -> None:
    colonnes = QUALITE + EFFORT
    print(f"\n{'cas':24}" + "".join(f"{TITRES[c]:>10}" for c in colonnes))
    for resultat in sorted(resultats, key=lambda r: lire(r.item, "metadata")["id"]):
        notes = {e.name: e.value for e in resultat.evaluations}
        cellules = [{1: "oui", 0: "NON"}.get(notes.get(c), "?") for c in QUALITE]  # « ? » : l'évaluateur a échoué
        cellules += [f"{notes.get('etapes', 0):.0f}", f"{notes.get('cout', 0):.4f}", f"{notes.get('duree', 0):.1f}"]
        print(f"{lire(resultat.item, 'metadata')['id']:24}" + "".join(f"{c:>10}" for c in cellules))
        for evaluation in resultat.evaluations:
            if evaluation.name in QUALITE and evaluation.value != 1:
                print(f"    {evaluation.name} : {evaluation.comment}")


def comparer(moyennes_actuelles: dict) -> bool:
    """Affiche les moyennes face à la référence. Renvoie True s'il y a une régression."""
    reference = json.loads(REFERENCE.read_text(encoding="utf-8")) if REFERENCE.exists() else None
    print(f"\n{'moyenne':14}{VERSION:>10}" + (f"{'référence':>12}{'écart':>10}" if reference else ""))
    regression = False
    for nom in QUALITE + EFFORT:
        valeur = moyennes_actuelles.get(nom, 0)
        ligne = f"{TITRES[nom]:14}{valeur:>10.4f}" if nom == "cout" else f"{TITRES[nom]:14}{valeur:>10.2f}"
        if reference:
            avant = reference["moyennes"].get(nom, 0)
            ligne += f"{avant:>12.4f}{valeur - avant:>+10.4f}" if nom == "cout" else f"{avant:>12.2f}{valeur - avant:>+10.2f}"
            if nom in QUALITE and valeur < avant - TOLERANCE[nom] - 1e-9:
                ligne += "   RÉGRESSION"
                regression = True
        print(ligne)
    if reference:
        print(f"(référence : {reference['version']}, {reference['modele']}, le {reference['date']})")
    return regression


def main() -> None:
    cas = lire_jeu()
    print(f"Évaluation du prompt {VERSION} ({'version ' + str(PROMPT.version) + ' dans Langfuse' if PROMPT else 'copie du dépôt'}) : {len(cas)} cas, agent {MODELE}, juge {MODELE_DU_JUGE}.")
    resultat = langfuse.run_experiment(
        name="agent-atelier",
        run_name=f"{VERSION} · {MODELE} · {datetime.now():%d/%m %H:%M:%S}",
        data=cas,
        task=tache,
        evaluators=[controles, *[jugement(critere) for critere in CRITERES]],
        run_evaluators=[moyennes],
        max_concurrency=3,  # trois questions à la fois : chacune lance un processus du SDK
        metadata={"prompt": VERSION, "modele": MODELE, "juge": MODELE_DU_JUGE},
    )
    langfuse.flush()

    afficher(resultat.item_results)
    notes_attendues = len(cas) * len(QUALITE)
    notes_recues = sum(1 for r in resultat.item_results for e in r.evaluations if e.name in QUALITE)
    if notes_recues < notes_attendues:  # une question ou un juge en échec : on ne conclut pas sur une évaluation à trous
        print(f"\nÉvaluation incomplète : {notes_recues} notes sur {notes_attendues}. Voir les erreurs plus haut, puis relancer.")
        sys.exit(2)
    actuelles = calculer_moyennes(resultat.item_results)
    regression = comparer(actuelles)

    if "--reference" in sys.argv:
        REFERENCE.write_text(json.dumps({"version": VERSION, "modele": MODELE, "date": f"{datetime.now():%d/%m/%Y}", "moyennes": actuelles}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nRéférence enregistrée dans {REFERENCE.name}.")
    elif regression:
        print(f"\nRégression : le prompt {VERSION} fait moins bien que la référence. On ne le met pas en production.")
        sys.exit(1)


if __name__ == "__main__":
    main()
