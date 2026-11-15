"""TP 12 : l'agent « en production ». C'est le terminal du TP 10, avec une différence.

Lancement, depuis le dossier du TP :
    python terminal.py

La différence : le prompt système n'est plus dans le code. À chaque question, l'agent lit dans Langfuse
la version qui porte l'étiquette « production ». Déplacer l'étiquette change son comportement à la question suivante.
Sans Langfuse, il lit la copie du dépôt (prompts/v1.md).

Comme au TP 10 : une trace par question, une session par conversation, et votre avis en score et dans retours.jsonl.
"""

import asyncio
import json
import sys
import uuid

from claude_agent_sdk import query

from agent import TP, creer_options  # agent.py lit le fichier .env : à importer avant Langfuse
from langfuse import get_client, observe, propagate_attributes
from prompts import texte_du_prompt
from suivi import Suivi, resume

langfuse = get_client()  # lit LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY et LANGFUSE_BASE_URL
RETOURS = TP / "retours.jsonl"


async def demander_accord(nom_outil: str, parametres: dict) -> bool:
    print(f"  L'agent veut créer une demande d'intervention : {parametres}")
    reponse = await asyncio.to_thread(input, "  Valider ? (o/n) ")
    return reponse.strip().lower().startswith("o")


# Le décorateur : chaque appel de cette fonction devient une trace, et la fonction en est la racine.
# On ne garde pas ses paramètres comme entrée de la trace : l'entrée, c'est la question.
@observe(name="agent-atelier", as_type="agent", capture_input=False, capture_output=False)
async def poser(question: str, session_claude: str | None):
    """Pose une question. Renvoie le bilan du tour, la session du SDK et l'identifiant de la trace."""
    systeme, prompt = texte_du_prompt("production")  # relu à chaque question : la version en production peut avoir changé
    langfuse.update_current_span(input=question, metadata={"prompt": f"version {prompt.version}" if prompt else "copie du dépôt"})
    suivi = Suivi(question, prompt=prompt)  # chaque appel au modèle est relié à la version du prompt
    options = suivi.brancher(creer_options(systeme, session_claude, demander_accord))
    session = session_claude
    async for message in query(prompt=question, options=options):
        suivi.voir(message)  # chaque message du SDK devient une observation, ou en complète une
        session = getattr(message, "session_id", None) or session
    return suivi.bilan, session, langfuse.get_current_trace_id()


def adresse(trace_id: str) -> str:
    """L'adresse de la trace dans Langfuse, ou son identifiant si le serveur ne répond pas."""
    try:
        return langfuse.get_trace_url(trace_id=trace_id) or trace_id
    except Exception:
        return trace_id


def noter(trace_id: str, question: str, reponse: str) -> None:
    """Le retour de l'utilisateur : un score sur la trace, et une ligne dans un fichier local."""
    avis = input("  Cette réponse vous a-t-elle aidé ? (o/n, Entrée pour passer) ").strip().lower()
    if not avis:
        return
    utile = avis.startswith("o")
    commentaire = "" if utile else input("  Qu'est-ce qui n'allait pas ? ").strip()
    langfuse.create_score(trace_id=trace_id, name="avis_utilisateur", value=1 if utile else 0, data_type="BOOLEAN", comment=commentaire or None)
    # La même information en local : le TP 12 s'en sert, même sans Langfuse.
    with RETOURS.open("a", encoding="utf-8") as fichier:
        fichier.write(json.dumps({"trace_id": trace_id, "question": question, "reponse": reponse, "utile": utile, "commentaire": commentaire}, ensure_ascii=False) + "\n")


async def main():
    utilisateur = sys.argv[1] if len(sys.argv) > 1 else "chef-equipe-1"
    conversation = f"conversation-{uuid.uuid4().hex[:8]}"  # la session Langfuse : une par conversation
    session_claude = None  # la session du SDK : la mémoire de la conversation
    print(f"Session Langfuse : {conversation}. Posez vos questions. Ligne vide pour quitter.")
    while True:
        question = await asyncio.to_thread(input, "\nVous : ")
        if not question.strip():
            break
        # Ce qui vaut pour toute la trace : la session, l'utilisateur, des étiquettes pour filtrer.
        with propagate_attributes(session_id=conversation, user_id=utilisateur, tags=["atelier", "production"]):
            bilan, session_claude, trace_id = await poser(question, session_claude)
        print(f"\nAgent : {bilan['reponse']}")
        print(f"  [bilan] {resume(bilan)}")
        print(f"  [trace] {adresse(trace_id)}")
        await asyncio.to_thread(noter, trace_id, question, bilan["reponse"])
    langfuse.flush()  # on attend que tout soit parti avant de quitter


asyncio.run(main())
