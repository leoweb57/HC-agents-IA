"""Démonstration Managed Agents, étape 1 : créer l'agent d'atelier sur la plateforme.

Ce n'est pas un TP : c'est le code des slides du module 4, à lire et à lancer.
On crée, une fois pour toutes :
  - un environnement : le bac à sable où tourneront les outils de l'agent ;
  - les fichiers de données de l'atelier, envoyés à la plateforme ;
  - un agent : un modèle, un prompt système, des outils.
Les identifiants sont écrits dans identifiants.json, que parler.py et nettoyer.py relisent.

Lancement, depuis le dossier de la démonstration :
    python creer.py
"""

import json
import os
from pathlib import Path

import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())  # lit le fichier .env à la racine du dépôt

MODELE = os.environ["MODELE"]
DEMO = Path(__file__).resolve().parent
DATA = DEMO.parents[1] / "data"
IDENTIFIANTS = DEMO / "identifiants.json"
FICHIERS = ["arrets_machine.json", "historique_arrets.json", "ordres_fabrication.json", "controles_qualite.json"]

# Le prompt système de l'agent v1 (TP 6 et 7), à une phrase près : celle qui dit où sont les données.
# Chez nous, l'agent les lisait avec les outils du serveur MCP. Ici, ce sont des fichiers.
SYSTEME = (
    # Le rôle
    "Tu es l'assistant de l'atelier d'injection. Tu aides les chefs d'équipe. "
    # Le contexte
    "Nous sommes le vendredi 13 mars 2026, il est 11 h. Les presses s'appellent P1 à P4. "
    # Les données
    "Les données de l'atelier sont des fichiers JSON, dans /mnt/session/uploads/ : "
    "arrets_machine.json (les arrêts de la semaine en cours), historique_arrets.json (tous les arrêts depuis janvier), "
    "ordres_fabrication.json et controles_qualite.json. "
    # Les règles
    "Réponds uniquement à partir de ces fichiers. Si une donnée manque, dis-le. "
    "Ne crée une demande d'intervention que si on te le demande explicitement. "
    # Le format
    "Réponds en français, en trois phrases au plus."
)

# L'outil d'action du TP 4, déclaré comme un « outil maison » (custom).
# La plateforme ne l'exécute pas : elle nous demandera de le faire. Voir parler.py.
CREER_DEMANDE_INTERVENTION = {
    "type": "custom",
    "name": "creer_demande_intervention",
    "description": "Crée une demande d'intervention de maintenance pour une machine. À n'utiliser que si l'utilisateur le demande.",
    "input_schema": {
        "type": "object",
        "properties": {
            "machine_id": {"type": "string", "description": "Identifiant de la machine, P1 à P4, A1 ou C1."},
            "motif": {"type": "string", "description": "Motif de la demande, en une phrase."},
            "priorite": {"type": "string", "description": "Priorité : normale ou haute."},
        },
        "required": ["machine_id", "motif", "priorite"],
    },
}

# Les outils intégrés de la plateforme. Ils s'exécutent dans le bac à sable, pas chez nous.
# On n'active que ceux qui servent à lire les fichiers : pas d'écriture, pas de web.
OUTILS_INTEGRES = {
    "type": "agent_toolset_20260401",
    "default_config": {"enabled": False},
    "configs": [{"name": nom, "enabled": True} for nom in ("bash", "read", "glob", "grep")],
}

# Le client lit ANTHROPIC_API_KEY dans l'environnement.
client = anthropic.Anthropic()

# 1. L'environnement : un conteneur chez Anthropic, sans accès à Internet.
environnement = client.beta.environments.create(
    name="atelier-formation",
    config={"type": "cloud", "networking": {"type": "limited"}},
)
print(f"Environnement créé : {environnement.id}")

# 2. Les fichiers de données. On les envoie une fois ; chaque session les montera en lecture seule.
fichiers = {}
for nom in FICHIERS:
    fichier = client.beta.files.upload(file=DATA / nom)
    fichiers[nom] = fichier.id
    print(f"Fichier envoyé : {nom} ({fichier.id})")

# 3. L'agent : la définition. Elle est versionnée : chaque modification crée une nouvelle version.
agent = client.beta.agents.create(
    name="Agent d'atelier (formation)",
    model=MODELE,
    system=SYSTEME,
    tools=[OUTILS_INTEGRES, CREER_DEMANDE_INTERVENTION],
)
print(f"Agent créé : {agent.id}, version {agent.version}")

IDENTIFIANTS.write_text(
    json.dumps({"environment_id": environnement.id, "agent_id": agent.id, "fichiers": fichiers, "sessions": []}, indent=2),
    encoding="utf-8",
)
print("Identifiants écrits dans identifiants.json. Suite : python parler.py")
