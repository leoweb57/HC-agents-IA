# Données de l'atelier (fictives)

Un petit atelier de production inventé pour la formation. Aucune donnée réelle.

| Fichier | Contenu |
|---|---|
| `machines.json` | Les 6 machines de l'atelier |
| `ordres_fabrication.json` | Les ordres de fabrication (OF) de la semaine |
| `arrets_machine.json` | Les arrêts machine, avec cause et durée |
| `controles_qualite.json` | Les contrôles qualité par OF |

La semaine couverte va du lundi 9 au vendredi 13 mars 2026.
Les identifiants se recoupent : un arrêt ou un contrôle renvoie à une machine (`machine_id`) et, quand c'est pertinent, à un OF (`of_id`).

Ces fichiers ne servent pas au TP 1. Ils deviennent la source des outils à partir du TP 2.
