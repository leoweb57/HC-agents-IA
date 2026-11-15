"""TP 8, étape 4 : une sortie structurée, validée par un schéma.

Un texte libre se lit. Une fiche se contrôle : chaque champ a un type, votre code peut la vérifier,
la ranger en base, ou décider à partir d'elle. Le SDK valide la sortie contre le schéma et relance
le modèle si elle n'est pas conforme.

Lancement, depuis le dossier du TP :
    python 4_sortie_structuree.py
"""

import asyncio
from typing import Literal

from claude_agent_sdk import ResultMessage, query
from pydantic import BaseModel, Field

from agent import creer_options


class FicheDiagnostic(BaseModel):
    """Ce qu'on attend d'un diagnostic. Pydantic en tire le schéma JSON, puis vérifie la réponse."""

    machine_id: str = Field(description="P1 à P4, A1 ou C1")
    arret_id: str
    ordre_fabrication: str
    cause: str
    recurrence_30_jours: int = Field(description="Nombre d'arrêts de même cause sur 30 jours, celui-ci compris")
    etape_procedure: str
    recommandation: str
    proposer_demande_intervention: bool
    priorite: Literal["normale", "haute"]


async def main():
    options = creer_options()
    options.output_format = {"type": "json_schema", "schema": FicheDiagnostic.model_json_schema()}
    try:
        async for message in query(prompt="Diagnostique l'arrêt de ce matin sur la presse 4.", options=options):
            if isinstance(message, ResultMessage):
                if message.is_error or not message.structured_output:
                    print(f"Pas de fiche valide : {message.subtype}")
                    return
                # La fiche est déjà conforme au schéma. On la charge dans un objet typé.
                fiche = FicheDiagnostic.model_validate(message.structured_output)
                print(f"\n{fiche.model_dump_json(indent=2)}\n")
                # À partir d'ici, c'est du code ordinaire : une règle métier, sans modèle.
                if fiche.recurrence_30_jours >= 3 and not fiche.proposer_demande_intervention:
                    print("Contrôle : trois arrêts en trente jours sans proposition d'intervention. À relire par une personne.")
                else:
                    print("Contrôle : la fiche respecte la règle « trois arrêts en trente jours → proposer une intervention ».")
    except Exception as erreur:  # le SDK lève une erreur après un résultat en échec
        print(f"La session s'est terminée sur une erreur : {erreur}")


asyncio.run(main())
