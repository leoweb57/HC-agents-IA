"""TP 12 : le prompt système de l'agent, géré dans Langfuse. Fourni : celui du TP 11, plus la mise en production.

Dans Langfuse, un prompt a un nom, des versions numérotées (1, 2, 3…) et des étiquettes.
Une étiquette désigne une version : « production » est celle que lit l'agent en service.
Changer le prompt de l'agent, c'est déplacer l'étiquette : pas de livraison de code.

Le dépôt garde une copie de chaque version dans prompts/ : elle sert à publier, et de secours sans Langfuse.
"""

import logging
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from langfuse import get_client

load_dotenv(find_dotenv())  # les clés Langfuse sont dans le fichier .env, à la racine du dépôt
NOM = "agent-atelier"
DOSSIER = Path(__file__).resolve().parent / "prompts"
langfuse = get_client()


def copie_locale(etiquette: str) -> str:
    """Le texte d'une version dans le dépôt. Sans Langfuse, la production reste la v1."""
    fichier = DOSSIER / f"{'v1' if etiquette == 'production' else etiquette}.md"
    return fichier.read_text(encoding="utf-8").strip()


def lire_prompt(etiquette: str = "production"):
    """Renvoie le prompt qui porte cette étiquette dans Langfuse. Le texte est dans .prompt, le numéro dans .version."""
    secours = copie_locale(etiquette)
    journal = logging.getLogger("langfuse")
    niveau = journal.level
    journal.setLevel(logging.CRITICAL)  # un prompt pas encore publié n'est pas une erreur ici : on fait taire le SDK
    try:
        # cache_ttl_seconds=0 : on relit Langfuse à chaque fois. En production, on garderait le cache d'une minute.
        return langfuse.get_prompt(NOM, label=etiquette, fallback=secours, cache_ttl_seconds=0, max_retries=0, fetch_timeout_seconds=3)
    except Exception:
        return None  # Langfuse n'est pas configuré : l'appelant prendra la copie locale
    finally:
        journal.setLevel(niveau)


def texte_du_prompt(etiquette: str = "production") -> tuple[str, object]:
    """Le texte à donner à l'agent, et le prompt Langfuse à relier aux traces (ou None)."""
    prompt = lire_prompt(etiquette)
    if prompt is None or prompt.is_fallback:
        return copie_locale(etiquette), None
    return prompt.prompt, prompt


def publier_prompt(etiquette: str, message: str, en_production: bool = False) -> None:
    """Crée une nouvelle version du prompt dans Langfuse à partir du fichier prompts/<etiquette>.md."""
    texte = copie_locale(etiquette)
    existant = lire_prompt(etiquette)
    if existant is not None and not existant.is_fallback and existant.prompt.strip() == texte:
        print(f"  prompt « {etiquette} » : déjà publié (version {existant.version})")
        return
    etiquettes = [etiquette] + (["production"] if en_production else [])
    cree = langfuse.create_prompt(name=NOM, type="text", prompt=texte, labels=etiquettes, commit_message=message)
    print(f"  prompt « {etiquette} » : publié, version {cree.version}, étiquettes {etiquettes}")


def promouvoir(etiquette: str) -> None:
    """Met une version en production : dans Langfuse, on déplace l'étiquette « production » sur elle."""
    prompt = lire_prompt(etiquette)
    if prompt is None or prompt.is_fallback:
        print(f"  « {etiquette} » n'est pas publié dans Langfuse : rien à déplacer.")
        return
    langfuse.update_prompt(name=NOM, version=prompt.version, new_labels=["production"])
    print(f"  la version {prompt.version} (« {etiquette} ») porte maintenant l'étiquette « production ».")
