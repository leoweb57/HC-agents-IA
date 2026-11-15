"""TP 7 : l'agent v2, un chef d'atelier et trois spécialistes (solution).

C'est le fichier exercice/agent_v2.py une fois terminé.
Les commentaires « Pourquoi » expliquent les choix, les commentaires « Correction » le défaut de l'étape 5.

Pour le voir tourner, copiez-le à la place de exercice/agent_v2.py.
"""

from claude_agent_sdk import AgentDefinition, ClaudeAgentOptions, HookMatcher

from commun import (
    HISTORIQUE_ARRETS,
    LIRE_ORDRE_FABRICATION,
    LISTER_ARRETS,
    LISTER_CONTROLES_QUALITE,
    MODELE,
    OUTIL_D_ACTION,
    OUTILS_DE_LECTURE,
    SERVEUR_ATELIER,
    TP,
    actions,
    creer_permission,
    journal,
)

# ---------- 1. Le contexte commun ----------

# Correction (étape 5) : un sous-agent ne reçoit ni la conversation, ni le prompt système du principal.
# Ce qui doit être vrai pour tous les agents est donc écrit une fois, ici, et repris dans chaque prompt.
# Avant la correction, cette phrase n'était que dans le prompt du principal : le sous-agent maintenance
# prenait la date de la machine, et croyait que les données s'arrêtaient il y a des mois.
CONTEXTE = "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. "


# ---------- 2. Le principal : il ne consulte rien, il délègue ----------

PRINCIPAL = (
    # Le rôle
    "Tu es le chef d'atelier de l'atelier d'injection. Tu réponds aux chefs d'équipe. "
    # Le contexte
    + CONTEXTE
    # La délégation
    + "Tu ne consultes aucune donnée toi-même : tu délègues à tes spécialistes avec l'outil Agent, "
    "et tu attends leurs rapports. "
    # Correction (étape 5) : le texte de la délégation est tout ce que le spécialiste reçoit de la demande.
    # Pourquoi « ni outil, ni période, ni étapes » : sans cette précision, le principal dicte la méthode,
    # et il écrase celle du skill, qu'il ne connaît pas.
    "Un spécialiste ne voit pas la conversation. Dans chaque délégation, transmets la demande "
    "et ce qu'il ne peut pas deviner : la machine, l'ordre de fabrication, la date. "
    "N'ajoute ni outil, ni période, ni étapes : la méthode est son métier. "
    # Les règles
    "Réponds uniquement à partir des rapports. Si une donnée manque, dis-le. "
    "Ne crée une demande d'intervention que si on te le demande explicitement. "
    # Le format
    # Pourquoi : par défaut, le principal réécrit le rapport qu'il reçoit, et il peut le déformer.
    "Réponds en français. Si un seul spécialiste a répondu, donne son rapport tel quel, sans introduction. "
    "Si plusieurs ont répondu, fais une synthèse courte."
)


# ---------- 3. Les spécialistes : un prompt, une description, des outils ----------

REGLES = (
    "Réponds uniquement à partir des résultats de tes outils. Si une donnée manque, dis-le. "
    "Réponds en français, en quelques lignes."
)

# Pourquoi trois champs suffisent :
# - description : c'est ce que lit le principal pour choisir à qui déléguer. Elle joue le rôle
#   de la description d'un outil : ce que fait le spécialiste, et quand faire appel à lui.
# - prompt : le prompt système du sous-agent. Il remplace celui du principal, il ne s'y ajoute pas.
# - tools : les outils du sous-agent, pris parmi ceux de la session. Ce qui n'est pas dans la liste
#   n'existe pas pour lui : ni refus, ni erreur, l'outil n'est simplement pas là.
SPECIALISTES = {
    "qualite": AgentDefinition(
        description=(
            "Contrôles qualité d'un ordre de fabrication : échantillons, non-conformes, défauts, décisions. "
            "À utiliser pour toute question sur la qualité."
        ),
        prompt="Tu es le contrôleur qualité de l'atelier d'injection. " + CONTEXTE + REGLES,
        tools=[LISTER_CONTROLES_QUALITE],  # un seul des quatre outils du serveur « atelier »
    ),
    "production": AgentDefinition(
        description=(
            "Avancement d'un ordre de fabrication : article, machine, quantités, statut. "
            "À utiliser pour toute question sur un ordre de fabrication."
        ),
        prompt="Tu es le responsable de production de l'atelier d'injection. " + CONTEXTE + REGLES,
        tools=[LIRE_ORDRE_FABRICATION],
    ),
    "maintenance": AgentDefinition(
        description=(
            "Arrêts d'une machine : détail de la semaine, récurrence, procédure à suivre. "
            "À utiliser pour toute question sur un arrêt ou une panne."
        ),
        prompt="Tu es le technicien de maintenance de l'atelier d'injection. " + CONTEXTE + REGLES,
        # Pourquoi Read : le skill dit de lire une procédure, et lire un fichier est un outil.
        tools=[LISTER_ARRETS, HISTORIQUE_ARRETS, "Read"],
        # Pourquoi skills ici et pas dans les options : le skill est chargé dans le contexte
        # de ce sous-agent à son lancement. Le principal et les deux autres ne le voient pas.
        skills=["diagnostic-arret"],
    ),
}


# ---------- 4. La règle : le principal délègue ----------

# Pourquoi une règle dans le code : les outils de la session sont visibles du principal aussi,
# et un prompt ne garantit rien. Ce hook refuse au principal tout ce qui n'est ni une délégation,
# ni l'action. Il reconnaît le principal à l'absence de agent_id : le SDK n'ajoute cet identifiant que pour un sous-agent.

async def le_principal_delegue(donnees, tool_use_id, contexte):
    if not donnees.get("agent_id") and donnees["tool_name"] not in ("Agent", OUTIL_D_ACTION):
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Le chef d'atelier ne consulte rien lui-même : délègue à un spécialiste.",
            }
        }
    return {}


# ---------- 5. Les options ----------

def creer_options(session_id: str | None = None, demander_accord=None) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        model=MODELE,
        system_prompt=PRINCIPAL,
        # Pourquoi les serveurs restent ici : ils sont connectés une fois, pour toute la session.
        # Chaque sous-agent en reçoit la part que sa liste tools désigne.
        mcp_servers={"atelier": SERVEUR_ATELIER, "actions": actions},
        agents=SPECIALISTES,  # les sous-agents, par leur nom
        # Pourquoi Agent : c'est l'outil intégré de la délégation. Pourquoi Read : un sous-agent
        # ne peut recevoir que des outils qui existent dans la session.
        tools=["Agent", "Read"],
        setting_sources=["project"],  # pour que le SDK trouve .claude/skills/
        cwd=str(TP),
        allowed_tools=["Agent", *OUTILS_DE_LECTURE],  # ce qui s'exécute sans rien demander
        # Pourquoi : le SDK permet aussi au principal de se dédoubler : un « fork » est une copie de lui-même,
        # avec toute la conversation et tous les outils de la session. On l'interdit : sinon, faute de
        # spécialiste, le principal se délègue le travail à lui-même et contourne la règle.
        disallowed_tools=["Agent(fork)"],
        can_use_tool=creer_permission(demander_accord),  # l'action passe par l'accord d'une personne
        hooks={"PreToolUse": [HookMatcher(hooks=[journal, le_principal_delegue])]},
        env={
            # Pourquoi : par défaut, le SDK lance les sous-agents en arrière-plan, et le principal peut
            # répondre « je reviens vers vous » avant d'avoir leurs rapports. Ici, il attend toujours.
            "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS": "1",
            # Pourquoi : le SDK fournit des sous-agents tout faits (general-purpose, Explore, Plan).
            # On les retire : le principal ne peut déléguer qu'à nos trois spécialistes.
            "CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS": "1",
        },
        # Pourquoi : par défaut, le SDK ne transmet pas le texte que produisent les sous-agents.
        # On le demande, pour que les mesures comptent tous les appels au modèle.
        forward_subagent_text=True,
        max_turns=15,  # les tours du principal. Un sous-agent a sa propre boucle.
        max_budget_usd=0.50,  # le plafond de dépense compte aussi les sous-agents
        resume=session_id,
    )
