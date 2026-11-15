"""TP 7 : l'agent v1, un seul agent. Fourni : c'est l'agent du TP 6, terminé.

Il sert de point de comparaison. Un seul modèle, un seul contexte, les quatre outils de lecture,
le skill de diagnostic et l'outil d'action.
"""

from claude_agent_sdk import ClaudeAgentOptions, HookMatcher

from commun import MODELE, OUTILS_DE_LECTURE, SERVEUR_ATELIER, TP, actions, creer_permission, journal

SYSTEME = (
    # Le rôle
    "Tu es l'assistant de l'atelier d'injection. Tu aides les chefs d'équipe. "
    # Le contexte
    "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. "
    # Les règles
    "Réponds uniquement à partir des résultats des outils. Si une donnée manque, dis-le. "
    "Ne crée une demande d'intervention que si on te le demande explicitement. "
    # Le format
    "Réponds en français, en trois phrases au plus, sauf si un skill impose un autre format."
)


def creer_options(session_id: str | None = None, demander_accord=None) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        model=MODELE,
        system_prompt=SYSTEME,
        mcp_servers={"atelier": SERVEUR_ATELIER, "actions": actions},
        tools=["Read", "Skill"],  # les outils intégrés : lire un fichier, charger un skill
        setting_sources=["project"],  # pour que le SDK lise .claude/skills/
        skills=["diagnostic-arret"],
        cwd=str(TP),
        allowed_tools=OUTILS_DE_LECTURE,  # ce qui s'exécute sans rien demander
        can_use_tool=creer_permission(demander_accord),  # l'action passe par l'accord d'une personne
        hooks={"PreToolUse": [HookMatcher(hooks=[journal])]},  # la trace
        max_turns=15,
        resume=session_id,
    )
