"""Fourni. Lance un agent, affiche ce qu'il fait, renvoie son dernier message.

Les quatre scripts du TP s'en servent. Rien à modifier ici.
"""

import os

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, ToolResultBlock, ToolUseBlock, UserMessage, query
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt
MODELE = os.environ["MODELE"]


def options(**reglages) -> ClaudeAgentOptions:
    """Les options communes à tous les essais. Chaque script y ajoute ce qu'il veut montrer."""
    return ClaudeAgentOptions(model=MODELE, setting_sources=[], max_turns=10, **reglages)


async def lancer(demande: str, opts: ClaudeAgentOptions) -> ResultMessage:
    """Envoie la demande, affiche chaque appel d'outil et son résultat, puis la réponse."""
    print(f"Demande : {demande}\n")
    fin = None
    async for message in query(prompt=demande, options=opts):
        if isinstance(message, AssistantMessage):
            for bloc in message.content:
                if isinstance(bloc, ToolUseBlock):
                    print(f"  [outil]    {bloc.name}({bloc.input})")
        elif isinstance(message, UserMessage) and isinstance(message.content, list):
            for bloc in message.content:
                if isinstance(bloc, ToolResultBlock):
                    texte = bloc.content if isinstance(bloc.content, str) else " ".join(b.get("text", "") for b in bloc.content or [])
                    print(f"  [résultat] {'REFUSÉ ou en erreur' if bloc.is_error else 'exécuté'} : {texte.strip()[:120]!r}")
        elif isinstance(message, ResultMessage):
            fin = message
    return fin
