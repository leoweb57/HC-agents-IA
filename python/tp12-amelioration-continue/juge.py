"""TP 11 : le juge. Un modèle qui note une réponse sur UN critère, par oui ou par non. Fourni.

Trois choix qui rendent un juge fiable :
  - un critère à la fois, formulé comme une question fermée ;
  - le raisonnement d'abord, le verdict ensuite (le modèle s'engage sur ses raisons avant de trancher) ;
  - un verdict structuré, contraint par un schéma JSON : pas de texte à interpréter.

Chaque critère ne reçoit que ce dont il a besoin. L'ancrage ne voit pas les points attendus :
il compare la réponse à ce que les outils ont renvoyé, et à rien d'autre.
"""

import json
import os

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # la clé API et le nom du modèle sont dans le fichier .env, à la racine du dépôt
MODELE_DU_JUGE = os.environ.get("MODELE_JUGE") or os.environ["MODELE"]
client = anthropic.AsyncAnthropic()

CONSIGNE = (
    "Tu évalues la réponse d'un assistant d'atelier à un chef d'équipe. Tu notes un seul critère, par oui ou par non. "
    "Tu ne juges ni le style ni la longueur. Tu t'en tiens strictement aux éléments fournis. Ton raisonnement tient en deux phrases."
)

CRITERES = {
    # A-t-il dit vrai ? Se juge contre la réponse attendue.
    "exactitude": {
        "question": (
            "Tout ce que dit la RÉPONSE est-il compatible avec les POINTS ATTENDUS ? Réponds non si un chiffre, une date, "
            "un identifiant ou une conclusion contredit un point attendu. Une information en plus, qui ne contredit rien, n'est pas une erreur."
        ),
        "elements": ["question", "points", "reponse"],
    },
    # A-t-il tout dit ? Se juge aussi contre la réponse attendue.
    "completude": {
        "question": "Chacun des POINTS ATTENDUS se retrouve-t-il dans la RÉPONSE, même formulé autrement ? Réponds non s'il en manque un seul, et dis lequel.",
        "elements": ["question", "points", "reponse"],
    },
    # A-t-il inventé ? Se juge contre les sources, sans réponse attendue : on peut le mesurer en production.
    "ancrage": {
        "question": (
            "Chaque fait d'atelier de la RÉPONSE (chiffre, date, heure, identifiant, cause, étape de procédure) vient-il des SOURCES ou de la QUESTION ? "
            "Les SOURCES sont le contexte donné à l'assistant et ses appels d'outils, avec leurs paramètres et leurs résultats. "
            "Un calcul simple fait à partir des sources (somme, pourcentage, comptage) est accepté. "
            "Une proposition d'aide, une question posée à l'utilisateur ou une remarque sur ce qui manque ne sont pas des faits. "
            "Réponds non seulement si un fait d'atelier ne figure nulle part : c'est une invention."
        ),
        "elements": ["question", "sources", "reponse"],
    },
    # A-t-il répondu à la question ? Se juge sans rien d'autre que la question.
    "pertinence": {
        "question": "La RÉPONSE répond-elle à la QUESTION posée, sans partir sur un autre sujet ? Dire qu'une donnée manque est une réponse pertinente.",
        "elements": ["question", "reponse"],
    },
}

BALISES = {"question": "QUESTION", "points": "POINTS ATTENDUS", "sources": "SOURCES", "reponse": "RÉPONSE"}

# Le schéma de la réponse du juge. L'ordre des champs compte : le raisonnement vient avant le verdict.
VERDICT = {
    "type": "object",
    "properties": {
        "raisonnement": {"type": "string", "description": "Une ou deux phrases : ce qui justifie le verdict."},
        "verdict": {"type": "boolean", "description": "Vrai pour oui, faux pour non."},
    },
    "required": ["raisonnement", "verdict"],
    "additionalProperties": False,
}


async def juger(critere: str, **elements: str) -> dict:
    """Note une réponse sur un critère. Renvoie {"raisonnement": …, "verdict": True ou False}."""
    definition = CRITERES[critere]
    contenu = "\n\n".join(f"<{BALISES[e]}>\n{elements[e]}\n</{BALISES[e]}>" for e in definition["elements"])
    reponse = await client.messages.create(
        model=MODELE_DU_JUGE,
        max_tokens=2000,  # le raisonnement interne du modèle compte dans cette limite
        system=CONSIGNE,
        output_config={"format": {"type": "json_schema", "schema": VERDICT}},  # la sortie structurée : du JSON conforme au schéma
        messages=[{"role": "user", "content": f"{contenu}\n\n{definition['question']}"}],
    )
    if reponse.stop_reason != "end_turn":  # réponse coupée avant la fin : mieux vaut une erreur visible qu'une note fausse
        raise ValueError(f"Le juge n'a pas fini sa réponse sur « {critere} » ({reponse.stop_reason}).")
    return json.loads(next(bloc.text for bloc in reponse.content if bloc.type == "text"))
