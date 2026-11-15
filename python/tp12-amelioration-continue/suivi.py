"""TP 10 : construire la trace Langfuse d'une question. Fourni.

Avec l'Agent SDK, la boucle tourne dans un autre processus : on ne peut pas décorer ses appels au modèle.
Mais le SDK raconte tout dans son flux de messages. Ce fichier traduit ce flux en observations Langfuse :

    agent-atelier                 la racine (créée par le décorateur @observe) : la question, la réponse
    ├── démarrage du SDK          le temps que met le SDK à lancer son processus, à chaque question
    ├── appel au modèle           une « generation » : modèle, tokens, coût, ce que le modèle a répondu
    ├── mcp__atelier__…           un « tool » : ses paramètres, son résultat, sa durée
    └── appel au modèle           …

Ce qu'on lit dans le flux, dans l'ordre où ça arrive :

    SystemMessage « init »        le SDK est prêt                        → le premier appel au modèle part
    message_start                 le modèle commence à répondre          → on note le modèle et l'heure du premier token
    AssistantMessage              un bloc de sa réponse                  → du texte, ou une demande d'outil : l'outil part
    message_delta, message_stop   il a fini                              → l'usage exact en tokens ; on ferme l'appel
    UserMessage                   le résultat d'un outil                 → on ferme l'outil ; tous revenus : l'appel suivant part
    ResultMessage                 la fin du tour                         → la réponse et le coût
"""

import time
from datetime import datetime, timezone

from claude_agent_sdk import AssistantMessage, ResultMessage, SystemMessage, TextBlock, ToolResultBlock, ToolUseBlock, UserMessage
from claude_agent_sdk.types import StreamEvent
from langfuse import get_client

# Tarifs publics en dollars par million de tokens (novembre 2026) : lu, écrit en cache, relu en cache, produit.
# Langfuse calcule le coût tout seul pour les modèles qu'il connaît ; le lui donner évite d'en dépendre.
PRIX = {
    "claude-haiku-5-5": {"input": 0.10, "cache_creation_input_tokens": 0.125, "cache_read_input_tokens": 0.01, "output": 0.50},
    "claude-sonnet-5-5": {"input": 2.0, "cache_creation_input_tokens": 2.5, "cache_read_input_tokens": 0.2, "output": 10.0},
    "claude-opus-5-5": {"input": 4.0, "cache_creation_input_tokens": 5.0, "cache_read_input_tokens": 0.4, "output": 20.0},
}


def en_texte(contenu) -> str:
    """Le résultat d'un outil arrive en texte, ou en liste de blocs de texte."""
    if isinstance(contenu, list):
        return "\n".join(bloc.get("text", "") for bloc in contenu if isinstance(bloc, dict))
    return "" if contenu is None else str(contenu)


class Suivi:
    """Suit une question. À créer dans la fonction décorée par @observe : ses observations s'accrochent dessous."""

    def __init__(self, question: str, prompt=None):
        self.langfuse = get_client()
        self.prompt = prompt  # le prompt géré dans Langfuse, s'il y en a un (TP 11) : chaque appel y sera relié
        self.question = question
        self.demarrage = self.langfuse.start_observation(name="démarrage du SDK", as_type="span")
        self.appel = None  # l'appel au modèle en cours
        self.modele = None
        self.contenu = []  # ce que le modèle a produit pendant cet appel
        self.outils = {}  # les outils en cours : identifiant de l'appel -> (observation, nom, paramètres)
        self.attend_des_outils = False
        self.debut = time.perf_counter()
        # Le bilan du tour, pour l'afficher ou l'évaluer sans passer par Langfuse.
        self.bilan = {"reponse": "", "outils": [], "resultats": [], "appels": 0, "tokens": 0, "cout": 0.0, "cout_sdk": 0.0, "duree": 0.0}

    def brancher(self, options):
        """Demande au SDK de signaler aussi le début et la fin de chaque réponse du modèle."""
        options.include_partial_messages = True
        return options

    def voir(self, message) -> None:
        """À appeler pour chaque message que renvoie query()."""
        if isinstance(message, SystemMessage) and message.subtype == "init" and self.demarrage is not None:
            self.demarrage.end()
            self.demarrage = None
            self._ouvrir_appel(self.question)  # le SDK est prêt : le premier appel au modèle part avec la question
        elif isinstance(message, StreamEvent):
            self._evenement(message.event)
        elif isinstance(message, AssistantMessage):
            for bloc in message.content:
                if isinstance(bloc, TextBlock):
                    self.contenu.append(bloc.text)
                elif isinstance(bloc, ToolUseBlock):  # le modèle demande un outil : le SDK le lance aussitôt
                    self.contenu.append({"outil": bloc.name, "parametres": bloc.input})
                    observation = self.langfuse.start_observation(name=bloc.name, as_type="tool", input=bloc.input)
                    self.outils[bloc.id] = (observation, bloc.name, bloc.input)
                    self.bilan["outils"].append({"nom": bloc.name, "parametres": bloc.input})
        elif isinstance(message, UserMessage) and isinstance(message.content, list):
            for bloc in message.content:
                if isinstance(bloc, ToolResultBlock) and bloc.tool_use_id in self.outils:
                    self._fermer_outil(bloc)
            self._appel_suivant()
        elif isinstance(message, ResultMessage):
            self._fermer_appel()
            self.bilan.update(reponse=message.result or "", cout_sdk=message.total_cost_usd or 0.0, duree=time.perf_counter() - self.debut)
            self.langfuse.update_current_span(
                output=message.result,
                metadata={"appels_au_modele": self.bilan["appels"], "cout_cumule_sdk_usd": message.total_cost_usd, "session_claude": message.session_id},
            )

    # ---------- les appels au modèle ----------

    def _ouvrir_appel(self, entree) -> None:
        self.appel = self.langfuse.start_observation(name="appel au modèle", as_type="generation", input=entree, prompt=self.prompt)
        self.contenu = []

    def _fermer_appel(self) -> None:
        if self.appel is not None:
            self.appel.update(output=self.contenu)
            self.appel.end()
            self.appel = None

    def _appel_suivant(self) -> None:
        """Le modèle est rappelé quand sa réponse est finie et que tous les outils qu'il a demandés ont répondu."""
        if self.appel is None and not self.outils and self.attend_des_outils:
            self.attend_des_outils = False
            self._ouvrir_appel("(les résultats des outils)")

    def _evenement(self, evenement: dict) -> None:
        if evenement["type"] == "message_start":  # le premier token arrive
            if self.appel is None:
                self._ouvrir_appel("(suite)")
            self.modele = evenement["message"]["model"]
            self.appel.update(model=self.modele, completion_start_time=datetime.now(timezone.utc))
        elif evenement["type"] == "message_delta" and self.appel is not None:  # la réponse est complète : l'usage aussi
            u = evenement["usage"]
            usage = {
                "input": u.get("input_tokens") or 0,
                "cache_creation_input_tokens": u.get("cache_creation_input_tokens") or 0,
                "cache_read_input_tokens": u.get("cache_read_input_tokens") or 0,
                "output": u.get("output_tokens") or 0,
            }
            self.appel.update(usage_details=usage)
            if self.modele in PRIX:
                couts = {cle: usage[cle] * PRIX[self.modele][cle] / 1e6 for cle in usage}
                self.appel.update(cost_details={**couts, "total": sum(couts.values())})
                self.bilan["cout"] += sum(couts.values())
            self.bilan["appels"] += 1
            self.bilan["tokens"] += sum(usage.values())
            self.attend_des_outils = evenement["delta"].get("stop_reason") == "tool_use"
        elif evenement["type"] == "message_stop":
            self._fermer_appel()
            self._appel_suivant()

    # ---------- les outils ----------

    def _fermer_outil(self, bloc: ToolResultBlock) -> None:
        outil, nom, parametres = self.outils.pop(bloc.tool_use_id)
        resultat = en_texte(bloc.content)
        if bloc.is_error:  # l'outil a échoué, ou la permission a été refusée
            outil.update(output=resultat, level="ERROR", status_message=resultat[:200])
        else:
            outil.update(output=resultat)
        outil.end()
        self.bilan["resultats"].append({"outil": nom, "parametres": parametres, "resultat": resultat})


def resume(bilan: dict) -> str:
    """Le bilan d'un tour, en une ligne."""
    tokens = f"{bilan['tokens']:,}".replace(",", " ")
    cout = f"{bilan['cout']:.4f}".replace(".", ",")
    duree = f"{bilan['duree']:.1f}".replace(".", ",")
    appels, outils = bilan["appels"], len(bilan["outils"])
    return f"{appels} appel{'s' if appels > 1 else ''} au modèle · {outils} outil{'s' if outils > 1 else ''} · {tokens} tokens · {cout} $ · {duree} s"
