"""Démonstration Managed Agents, étape 2 : une conversation avec l'agent hébergé.

On ouvre une session : un agent, dans un environnement, avec les fichiers de données.
Ensuite on n'appelle plus de boucle : on échange des événements avec la plateforme.
  - on envoie :  user.message
  - on reçoit :  agent.tool_use, agent.message, session.status_idle…
L'outil d'action est un outil maison : la plateforme ne l'exécute pas. Elle se met en attente
(requires_action), on l'exécute ici, après accord, et on renvoie le résultat.

Lancement, depuis le dossier de la démonstration :
    python parler.py                          une conversation au clavier
    python parler.py "Où en est l'OF-2231 ?"    une ou plusieurs questions, puis on quitte
"""

import json
import sys
import time
from pathlib import Path

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

DEMO = Path(__file__).resolve().parent
IDENTIFIANTS = DEMO / "identifiants.json"
DEMANDES = DEMO / "demandes_intervention.json"

if not IDENTIFIANTS.exists():
    sys.exit("Lancez d'abord : python creer.py")
ids = json.loads(IDENTIFIANTS.read_text(encoding="utf-8"))

client = anthropic.Anthropic()


def pluriel(nombre: int, mot: str) -> str:
    return f"{nombre} {mot}{'s' if nombre > 1 else ''}"


def creer_demande_intervention(parametres: dict) -> str:
    """L'outil d'action. Le même code qu'au TP 4 : il tourne ici, sur notre machine."""
    demandes = json.loads(DEMANDES.read_text(encoding="utf-8")) if DEMANDES.exists() else []
    demande = {"id": f"DI-{len(demandes) + 1:04d}", **parametres}
    demandes.append(demande)
    DEMANDES.write_text(json.dumps(demandes, ensure_ascii=False, indent=2), encoding="utf-8")
    return json.dumps(demande, ensure_ascii=False)


def repondre_a_l_outil_maison(session_id: str, demande_d_outil) -> None:
    """La plateforme attend : on demande l'accord, on exécute, on renvoie le résultat."""
    print(f"  L'agent veut créer une demande d'intervention : {demande_d_outil.input}")
    if input("  Valider ? (o/n) ").strip().lower().startswith("o"):
        resultat, erreur = creer_demande_intervention(demande_d_outil.input), False
    else:
        resultat, erreur = "La création a été refusée par l'utilisateur.", True
    client.beta.sessions.events.send(
        session_id,
        events=[{
            "type": "user.custom_tool_result",
            "custom_tool_use_id": demande_d_outil.id,
            "content": [{"type": "text", "text": resultat}],
            "is_error": erreur,
        }],
    )


def poser(session_id: str, question: str) -> None:
    """Un tour de conversation : on envoie un message, on lit les événements jusqu'à la fin du tour."""
    debut = time.monotonic()
    appels = outils = tokens_lus = 0
    outils_maison = {}  # les demandes d'outil maison en attente, par identifiant d'événement

    # On ouvre le flux avant d'envoyer le message, pour ne manquer aucun événement.
    with client.beta.sessions.events.stream(session_id) as flux:
        client.beta.sessions.events.send(
            session_id,
            events=[{"type": "user.message", "content": [{"type": "text", "text": question}]}],
        )
        for evenement in flux:
            type_ = evenement.type

            if type_ == "agent.tool_use":  # un outil intégré, exécuté dans le bac à sable
                outils += 1
                print(f"  [agent.tool_use] {evenement.name}({json.dumps(evenement.input, ensure_ascii=False)[:150]})")

            elif type_ == "agent.custom_tool_use":  # notre outil : la plateforme ne l'exécute pas
                outils += 1
                outils_maison[evenement.id] = evenement
                print(f"  [agent.custom_tool_use] {evenement.name}")

            elif type_ == "agent.message":
                texte = "".join(bloc.text for bloc in evenement.content if bloc.type == "text")
                print(f"\nAgent : {texte}")

            elif type_ == "span.model_request_end":  # la fin d'un appel au modèle, avec son usage
                appels += 1
                usage = evenement.model_usage
                tokens_lus += usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens

            elif type_ == "session.status_idle":  # la session s'arrête : pourquoi ?
                raison = evenement.stop_reason
                print(f"  [session.status_idle] {raison.type}")
                if raison.type == "requires_action":  # elle nous attend
                    for identifiant in raison.event_ids:
                        repondre_a_l_outil_maison(session_id, outils_maison.pop(identifiant))
                else:  # end_turn : l'agent a fini de répondre
                    break

            elif type_ in ("session.error", "session.status_terminated"):
                print(f"  [{type_}] {getattr(evenement, 'error', '')}")
                break

    duree = time.monotonic() - debut
    tokens = f"{tokens_lus:,}".replace(",", " ")  # 15 336 plutôt que 15336
    print(f"  [{pluriel(appels, 'appel')} au modèle, {pluriel(outils, 'outil')}, {tokens} tokens lus, {duree:.1f} s]")


# Une session : un agent, dans un environnement, avec ses fichiers montés en lecture seule.
session = client.beta.sessions.create(
    agent=ids["agent_id"],
    environment_id=ids["environment_id"],
    title="Démonstration formation",
    resources=[
        {"type": "file", "file_id": identifiant, "mount_path": "/" + nom}
        for nom, identifiant in ids["fichiers"].items()
    ],
)
ids["sessions"].append(session.id)
IDENTIFIANTS.write_text(json.dumps(ids, indent=2), encoding="utf-8")
print(f"Session ouverte : {session.id}")

questions = sys.argv[1:]
if questions:
    for question in questions:
        print(f"\nVous : {question}")
        poser(session.id, question)
else:
    print("Posez vos questions. Ligne vide pour quitter.")
    while True:
        question = input("\nVous : ")
        if not question.strip():
            break
        poser(session.id, question)
