"""TP 12, étape 3 : mettre en production la version qui a passé l'évaluation.

Lancement, depuis le dossier du TP :
    python 3_promouvoir.py v3

Dans Langfuse, on déplace l'étiquette « production ». L'agent lit son prompt par cette étiquette :
sa prochaine réponse utilise la nouvelle version, sans livraison de code ni redémarrage.
Revenir en arrière, c'est remettre l'étiquette sur l'ancienne version : python 3_promouvoir.py v1
"""

import sys

from prompts import promouvoir

promouvoir(sys.argv[1] if len(sys.argv) > 1 else "v3")
