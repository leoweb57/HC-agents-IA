"""Vérifie que le poste est prêt pour les TP : Python, clé API, appel minimal."""

import os
import sys

MODELE_PAR_DEFAUT = "claude-haiku-5-5"


def echec(message: str) -> None:
    print(f"ÉCHEC : {message}")
    sys.exit(1)


def main() -> None:
    # 1. Version de Python
    if sys.version_info < (3, 10):
        echec(f"Python 3.10 ou plus récent est requis (version trouvée : {sys.version.split()[0]}).")
    print(f"Python {sys.version.split()[0]} : OK")

    # 2. Dépendances
    try:
        import anthropic
        from dotenv import find_dotenv, load_dotenv
    except ImportError as erreur:
        echec(f"Dépendance manquante ({erreur.name}). Lancez : pip install -r requirements.txt")

    # 3. Fichier .env et clé API (la clé n'est jamais affichée)
    chemin_env = find_dotenv()
    if not chemin_env:
        echec("Fichier .env introuvable. À la racine du dépôt : cp .env.example .env")
    load_dotenv(chemin_env)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        echec("ANTHROPIC_API_KEY est vide dans .env.")
    print("Clé API trouvée dans .env : OK")

    # 4. Appel minimal
    modele = os.environ.get("MODELE") or MODELE_PAR_DEFAUT
    client = anthropic.Anthropic()
    try:
        reponse = client.messages.create(
            model=modele,
            max_tokens=50,
            messages=[{"role": "user", "content": "Réponds uniquement par le mot : prêt"}],
        )
    except anthropic.AuthenticationError:
        echec("La clé API est refusée. Vérifiez qu'elle est complète et active dans la Console Anthropic.")
    except anthropic.NotFoundError:
        echec(f"Le modèle « {modele} » est inconnu. Vérifiez la variable MODELE dans .env.")
    except anthropic.APIConnectionError:
        echec("Impossible de joindre l'API. Vérifiez le réseau, le VPN ou le proxy (variable HTTPS_PROXY).")
    except anthropic.APIStatusError as erreur:
        echec(f"L'API a répondu avec une erreur {erreur.status_code} : {erreur.message}")

    texte = "".join(bloc.text for bloc in reponse.content if bloc.type == "text")
    print(f"Appel à {modele} : OK (réponse : {texte.strip()!r})")
    print("Tout est en place.")


if __name__ == "__main__":
    main()
