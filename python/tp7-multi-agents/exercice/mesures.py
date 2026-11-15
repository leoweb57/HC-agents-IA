"""TP 7 : mesurer ce qu'une question a coûté. Fourni.

On donne à la mesure chaque message que le SDK envoie pendant une question. Elle compte,
agent par agent, les appels au modèle et les tokens lus, puis le nombre d'outils, la durée et le prix.
"""

import time

from claude_agent_sdk import AssistantMessage, ResultMessage, ToolUseBlock


class Mesure:
    def __init__(self):
        self.debut = time.monotonic()
        self.sous_agents = {}  # identifiant d'une délégation -> nom du sous-agent
        self.deja_vus = set()  # les réponses du modèle déjà comptées
        self.agents = {}  # nom de l'agent -> [appels au modèle, tokens lus]
        self.outils = 0  # appels d'outils, délégations non comprises
        self.duree = 0.0
        self.cout = 0.0
        self.reponse = ""

    def voir(self, message) -> None:
        if isinstance(message, AssistantMessage):
            # Un message qui vient d'un sous-agent porte l'identifiant de la délégation qui l'a lancé.
            if message.parent_tool_use_id:
                qui = self.sous_agents.get(message.parent_tool_use_id, "sous-agent")
            else:
                qui = "principal"
            # Le SDK envoie un message par bloc de la réponse : on ne compte l'appel au modèle qu'une fois.
            if message.message_id not in self.deja_vus:
                self.deja_vus.add(message.message_id)
                usage = message.usage or {}
                lus = sum(
                    usage.get(cle) or 0
                    for cle in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
                )
                compte = self.agents.setdefault(qui, [0, 0])
                compte[0] += 1
                compte[1] += lus
            for bloc in message.content:
                if isinstance(bloc, ToolUseBlock):
                    if bloc.name in ("Agent", "Task"):  # une délégation : on retient à qui
                        self.sous_agents[bloc.id] = bloc.input.get("subagent_type", "sous-agent")
                    else:
                        self.outils += 1
        elif isinstance(message, ResultMessage):
            self.duree = time.monotonic() - self.debut
            self.cout = message.total_cost_usd or 0.0
            self.reponse = message.result or ""

    @property
    def appels(self) -> int:
        return sum(compte[0] for compte in self.agents.values())

    @property
    def tokens_lus(self) -> int:
        return sum(compte[1] for compte in self.agents.values())

    def detail(self) -> str:
        """Le détail par agent : « principal 2 appels, 11 265 tokens · maintenance 3 appels, 17 000 tokens »."""
        return " · ".join(
            f"{nom} {pluriel(appels, 'appel')}, {milliers(tokens)} tokens" for nom, (appels, tokens) in self.agents.items()
        )

    def ligne(self) -> str:
        """Le résumé d'une question, sur une ligne."""
        texte = (
            f"{pluriel(self.appels, 'appel')} au modèle, {pluriel(self.outils, 'outil')}, "
            f"{milliers(self.tokens_lus)} tokens lus, {self.duree:.1f} s, {self.cout:.4f} $"
        )
        if len(self.agents) > 1:
            texte += f" ({self.detail()})"
        return texte


def pluriel(nombre: int, mot: str) -> str:
    """2, « appel » -> « 2 appels »."""
    return f"{nombre} {mot}{'s' if nombre > 1 else ''}"


def milliers(nombre: int) -> str:
    """12345 -> « 12 345 »."""
    return f"{nombre:,}".replace(",", " ")
