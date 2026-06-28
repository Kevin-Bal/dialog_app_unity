# Format de données — Île aux Lettres

La fondation du projet. À lire avant de toucher à l'UI ou à Firebase.

## Principe central

Le **JSON est le seul format de travail**. Le `.yarn` n'est qu'une **sortie**
générée à la demande pour Unity. On ne reparse jamais du `.yarn` : « repartir
d'un fichier existant » = recharger ce JSON (depuis Firebase).

```
Firebase (JSON temps réel)  →  éditeur  →  bouton "Exporter .yarn"  →  Unity
        ↑__________ rechargement = ce même JSON, jamais le .yarn _________|
```

## Les objets (voir src/dialogueModel.js pour le détail)

| Objet | Rôle |
|---|---|
| `Project` | La salle partagée entière. Un **code** = un Project. |
| `Settings` | Le **registre central** que tout le monde voit : hameaux + variables. |
| `Character` | Un PNJ et sa liste de `Node`. |
| `Node` | Un nœud de dialogue : soit un **hub** (aiguillage), soit du contenu. |
| `Variable` | Un drapeau d'état partagé (ex : `marie_lettre_livree`). |

## Les deux types de nœud

**Hub** (`isHub: true`) — point d'entrée unique d'un PNJ. Que des `branches`
conditionnelles qui sautent vers le bon dialogue selon l'état. C'est lui qu'on
démarre depuis Unity : `StartDialogue("Marie")`.

**Contenu** — des `lines` (répliques `say`, `set` de variable, `command`
custom) puis des `choices` (réponses du joueur, avec conditions et `setActions`).

## Les conventions que l'outil garantit

C'est tout l'intérêt vs écrire du Yarn à la main à plusieurs :

1. **Variables = registre partagé.** On ne tape jamais `$marie_lettre` à la
   main ; on choisit dans la liste `settings.variables`. Plus de doublons
   `marie_lettre` / `lettreMarie` qui cassent le jeu.
2. **Titres Yarn uniques.** Générés en `Personnage_Titre` (`yarnNodeTitle`)
   pour éviter les collisions entre écrivains.
3. **Validation avant export** (`validateProject`) : variable inconnue, saut
   vers un nœud inexistant, nœud vide, titre en double.

## Visites répétées (le cœur du jeu de postier)

Géré par le hub + les variables d'état. Le postier revient voir Marie :
le hub regarde `marie_etape` et choisit la conversation. Voir l'exemple
complet dans `src/example.js` (`npm run example`).

## Reste à brancher

- **Firebase** : ce `Project` devient un document Firestore ; chaque écriture
  est synchronisée en temps réel. Le « code de salle » = l'id du document.
- **UI** : l'éditeur de graphe + le panneau « conditions d'apparition » lit et
  écrit ces mêmes objets.
