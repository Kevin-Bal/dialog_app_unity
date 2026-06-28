# CLAUDE.md — contexte projet

Ce fichier est chargé automatiquement par Claude Code. Il résume le projet pour
reprendre le travail sans contexte perdu (changement de PC).

## Le projet en une phrase

Éditeur web collaboratif qui permet à des **amis non-développeurs** d'écrire les
dialogues d'un jeu Unity, puis d'exporter des fichiers **Yarn Spinner** (`.yarn`)
prêts à insérer dans le projet Unity.

## Le jeu (contexte)

On incarne un **postier** sur une île à plusieurs hameaux. Le rôle : reconnecter
les habitants via des livraisons et des conseils. Le joueur **revient plusieurs
fois** auprès des mêmes PNJ, entre deux livraisons. Cette mécanique de visites
répétées est gérée en Yarn Spinner par un **nœud d'aiguillage (hub)** + des
**variables d'état** (voir `docs/format-donnees.md`).

## Décisions d'architecture (à respecter)

1. **Hébergement GitHub Pages** → l'app est 100% statique (HTML/CSS/JS modules ES,
   aucun build, aucune dépendance npm pour tourner).
2. **Le JSON est le seul format de travail**, le `.yarn` est une **sortie** générée
   à la demande. On ne reparse JAMAIS du `.yarn`. « Repartir d'un fichier » =
   recharger le JSON (plus tard depuis Firebase).
3. **Backend prévu : Firebase (Firestore)** pour le temps réel + le « code de salle »
   (= id du document projet). PAS encore branché.
4. **Registre central de variables partagé** : les écrivains choisissent les
   variables dans des menus déroulants, jamais en tapant `$marie_lettre` à la main.
   C'est ce qui évite les doublons qui cassent le jeu quand on est plusieurs.
5. **Titres de nœuds Yarn uniques** sur tout le projet, générés en `Personnage_Titre`
   (fonction `yarnNodeTitle`), car Yarn Spinner l'exige.

## État actuel (fait / à faire)

Fait :
- Modèle de données + compilateur `.yarn` + validateur → `src/dialogueModel.js`
- Exemple jouable « Marie et la lettre à Jeanne » → `src/example.js` (`npm run example`)
- Prototype d'éditeur web fonctionnel → `index.html`, `src/app.js`, `src/styles.css`,
  données de démo `src/sampleData.js` (sidebar par groupe, canevas avec nœuds
  déplaçables, panneau d'édition, conditions via menus déroulants, validation
  live, export `.yarn`).
- **Branchement Firebase (Firestore)** → `src/firebase.js` + `src/firebaseConfig.js` :
  persistance + temps réel + code de salle. **Config branchée et fonctionnelle.**
- **Écran d'entrée (gate)** : impossible d'atteindre l'éditeur sans rejoindre ou
  créer une salle. Création = choix du **nom de projet** + code généré (`POSTE-XXXXX`).
  Lien `?code=...` rejoint directement (partage).
- **Groupes de personnages** (ex-« hameaux ») : créer / renommer / supprimer un
  groupe, et affecter chaque personnage à un groupe (sélecteur dans la barre du
  canevas). Renommer le projet = clic sur son nom dans le bandeau.
- **Éditeur de variables** (autonomie des écrivains) : fenêtre « Variables
  partagées » pour créer / renommer / typer / supprimer les variables. Le libellé
  est lisible ; l'identifiant Yarn est généré auto (`createVariable`/`slugifyName`)
  et figé pour ne pas casser les références. Suppression avec avertissement si la
  variable est utilisée (`countVariableUsage`).

Pas encore fait :
- Export du projet entier (aujourd'hui : export par personnage)
- Gestion fine des conflits temps réel (v1 = last-write-wins ; cf. limites ci-dessous)
- Démarrer une salle neuve **vide** plutôt que sur la démo (bloqué tant qu'il n'y a
  pas d'éditeur de variables : sans variables, pas de conditions possibles)

## Firebase (où on en est)

L'architecture est branchée et suit la décision n°3 (Firestore, code de salle =
id du document). Découpage :
- `src/firebaseConfig.js` : la config CLIENT (clés publiques, PAS un secret →
  committable) + les règles Firestore à coller. Tant que les valeurs commencent
  par `REMPLACE`, l'app tourne en **mode local** (démo, sans sauvegarde).
- `src/firebase.js` : seule partie qui connaît Firebase. SDK importé en modules
  ES depuis le CDN gstatic (aucun npm, compatible GitHub Pages). Expose
  `isConfigured()`, `saveProject(code, project)`, `subscribeProject(code, cb)`.
- `src/app.js` : une « salle » = document `projects/{code}`. Écran d'entrée
  obligatoire (rejoindre/créer) ; `?code=` dans l'URL rejoint directement.
  Sauvegarde débouncée (~600 ms) sur chaque édition ; écoute temps réel via
  `onSnapshot`. `normalizeProject()` migre les vieilles salles (`hameaux`→`groups`).

Projet Firebase utilisé : **`dialog-app-unity`** (forfait Spark gratuit), base
Firestore en région EU, règles « accès ouvert par code de salle ». La config
client est déjà dans `src/firebaseConfig.js`.

### Limites connues (v1, à améliorer plus tard)
- **Last-write-wins** : si deux personnes éditent le même projet en même temps,
  la dernière sauvegarde gagne (comparaison `meta.updatedAt`). Pas de fusion fine.
- Un changement distant reçu pendant qu'on tape **reconstruit l'inspecteur** →
  peut faire perdre le focus. Acceptable entre amis ; à raffiner si gênant.
- Tout le projet tient dans **un seul document** Firestore (limite 1 Mo). Large
  pour du texte de dialogue, mais à surveiller si le projet grossit beaucoup.

## Lancer en local

Les modules ES exigent un serveur (pas d'ouverture en `file://`) :

```bash
npm run serve     # serveur Node sans dépendance → http://localhost:4321
```

(Sur cette machine, le port 8123 est pris par le proxy SOCKS du VPN ; on utilise
4321. Python n'est pas installé, d'où le petit serveur Node `scripts/serve.mjs`.)

Tester le moteur seul : `npm run example`

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/dialogueModel.js` | Cœur : schéma, fabriques, `compileCharacterToYarn`, `validateProject` |
| `src/sampleData.js` | Projet de démo (Marie, Tom) |
| `src/app.js` | Logique de l'éditeur (rendu + interactions + salle Firebase, vanilla JS) |
| `src/firebase.js` | Accès Firestore (load/save/subscribe) — seule partie liée à Firebase |
| `src/firebaseConfig.js` | Config client Firebase (à remplir) + règles Firestore |
| `index.html`, `src/styles.css` | Interface |
| `src/example.js` | Démo console du compilateur |
| `scripts/serve.mjs` | Serveur statique local sans dépendance (`npm run serve`) |
| `docs/format-donnees.md` | Référence détaillée du format de données |
| `README.md` | Lancer / déployer (pour les amis) |

## Conventions de code

- JavaScript **vanilla**, modules ES, aucune lib front. Garder ça léger (GitHub Pages).
- Le modèle (`dialogueModel.js`) ne dépend ni du DOM ni de Firebase → testable seul.
- Commentaires et UI en **français** (l'équipe est francophone).

## Repo

https://github.com/Kevin-Bal/dialog_app_unity — branche `main`.
