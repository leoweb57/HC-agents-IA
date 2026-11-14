# Les trois énigmes : causes et corrections

## Énigme 1 — L'agent ne trouve aucun arrêt

**Ce qu'on voit.** Le modèle appelle `lister_arrets` avec `"presse 4"`. L'outil renvoie une liste vide, et l'agent conclut qu'il n'y a eu aucun arrêt.

**La cause.** La description de l'outil : `"Arrêts."` et, pour le paramètre, `"La machine."`. Le modèle ne peut pas deviner que l'identifiant attendu est `P4`. La fonction, elle, est correcte.

**La correction.**

- Décrire l'outil : ce qu'il renvoie, sur quelle période.
- Décrire le paramètre avec son format et un exemple : « Identifiant de la machine : P1 à P4 pour les presses 1 à 4… ».
- Mieux encore : quand l'identifiant est inconnu, renvoyer une erreur explicite avec les identifiants valides, plutôt qu'une liste vide. Le modèle peut alors se corriger seul.

**À retenir.** Le modèle ne lit jamais votre fonction. Il ne connaît de l'outil que sa description.

## Énigme 2 — La réponse est juste, mais la facture ne l'est pas

**Ce qu'on voit.** Le premier tour consomme quelques centaines de tokens, le second près de 50 000. La réponse est correcte.

**La cause.** La fonction `lister_arrets` ignore son paramètre et renvoie tout l'historique : 512 arrêts, toutes machines confondues, depuis janvier. Le modèle fait le tri lui-même, et vous payez la lecture de tout le fichier.

**La correction.**

- Filtrer dans le code : par machine, et par période.
- Ne renvoyer que les champs utiles.
- Si la liste peut être longue, la limiter et indiquer combien d'éléments ont été laissés de côté.

**À retenir.** Un résultat d'outil reste dans la session : il est relu, et facturé, à chaque tour suivant. Le tri se fait dans l'outil, pas dans le modèle.

## Énigme 3 — L'agent tourne en rond

**Ce qu'on voit.** Le modèle demande `lister_arrets("P4")`, encore et encore, jusqu'à l'arrêt de sécurité.

**La cause.** La boucle exécute bien l'outil, mais elle n'ajoute rien à la session : ni la réponse du modèle, ni le résultat de l'outil. À chaque tour, le modèle reçoit exactement la même question, sans aucune trace de ce qui s'est passé, et fait donc la même demande.

**La correction.**

- Ajouter la réponse du modèle à la session.
- Ajouter le résultat de chaque outil à la session, dans un bloc `tool_result`.
- Garder une limite de tours : c'est elle qui a évité ici une boucle sans fin.

**À retenir.** Le modèle n'a aucune mémoire entre deux appels. Ce qui n'est pas dans la session n'a jamais eu lieu.
