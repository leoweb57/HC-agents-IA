"""TP 9 : mesurer ce qu'une question a coûté. Fourni.

Le SDK donne l'usage de chaque appel au modèle : ce qui a été lu sans cache, écrit en cache, relu en cache, et produit.
"""

import time

from claude_agent_sdk import AssistantMessage, ResultMessage, ToolUseBlock, query

# Tarif public de Claude Haiku 5.5, en dollars par million de tokens (novembre 2026).
# Relire un token en cache coûte dix fois moins cher que le lire ; l'écrire en cache coûte 25 % de plus.
PRIX = {"entree": 0.10, "ecriture_cache": 0.125, "lecture_cache": 0.01, "sortie": 0.50}


async def poser(question: str, options) -> dict:
    """Pose une question et renvoie les mesures du tour."""
    debut = time.monotonic()
    deja_vus, par_appel, outils = set(), [], []
    m = {"entree": 0, "ecriture_cache": 0, "lecture_cache": 0, "sortie": 0}
    resultat = None
    async for message in query(prompt=question, options=options):
        if isinstance(message, AssistantMessage):
            # Le SDK envoie un message par bloc de la réponse : on ne compte chaque appel au modèle qu'une fois.
            if message.message_id not in deja_vus:
                deja_vus.add(message.message_id)
                usage = message.usage or {}
                lus = (usage.get("input_tokens") or 0) + (usage.get("cache_creation_input_tokens") or 0) + (usage.get("cache_read_input_tokens") or 0)
                par_appel.append(lus)
            outils += [bloc.name for bloc in message.content if isinstance(bloc, ToolUseBlock)]
        elif isinstance(message, ResultMessage):
            resultat = message
    usage = resultat.usage or {}
    m["entree"] = usage.get("input_tokens") or 0
    m["ecriture_cache"] = usage.get("cache_creation_input_tokens") or 0
    m["lecture_cache"] = usage.get("cache_read_input_tokens") or 0
    m["sortie"] = usage.get("output_tokens") or 0
    lus = m["entree"] + m["ecriture_cache"] + m["lecture_cache"]
    return {
        "session": resultat.session_id,
        "reponse": resultat.result or "",
        "appels": len(par_appel),
        "tokens_par_appel": par_appel,
        "outils": outils,
        "lus": lus,
        "relus_en_cache": m["lecture_cache"],
        "sortie": m["sortie"],
        "duree": time.monotonic() - debut,
        "cout": sum(m[cle] * PRIX[cle] for cle in PRIX) / 1e6,  # ce que le tour a coûté, cache compris
        "cout_sans_cache": (lus * PRIX["entree"] + m["sortie"] * PRIX["sortie"]) / 1e6,  # ce qu'il aurait coûté sans cache
        "cout_session": resultat.total_cost_usd or 0.0,  # le total du SDK, cumulé depuis le début de la session
    }


def milliers(nombre: int) -> str:
    """12345 -> « 12 345 »."""
    return f"{nombre:,}".replace(",", " ")


def pluriel(nombre: int, mot: str) -> str:
    """2, « appel » -> « 2 appels »."""
    return f"{nombre} {mot}{'s' if nombre > 1 else ''}"
