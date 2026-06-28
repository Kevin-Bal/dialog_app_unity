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
- Prototype d'éditeur web fonctionnel sur **données locales** → `index.html`,
  `src/app.js`, `src/styles.css`, données de démo `src/sampleData.js`
  (sidebar par hameau, canevas avec nœuds déplaçables, panneau d'édition,
  conditions via menus déroulants, validation live, export `.yarn`).

Pas encore fait :
- **Branchement Firebase** (persistance + temps réel + code de salle) ← prochaine grande étape
- Écrans de gestion des hameaux et des variables (actuellement en dur dans `sampleData.js`)
- Export du projet entier (aujourd'hui : export par personnage)
- Pas de sauvegarde : recharger la page repart de la démo (c'est le rôle de Firebase)

## Lancer en local

Les modules ES exigent un serveur (pas d'ouverture en `file://`) :

```bash
python3 -m http.server 8123   # puis http://localhost:8123
```

Tester le moteur seul : `npm run example`

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/dialogueModel.js` | Cœur : schéma, fabriques, `compileCharacterToYarn`, `validateProject` |
| `src/sampleData.js` | Projet de démo (Marie, Tom) |
| `src/app.js` | Logique de l'éditeur (rendu + interactions, vanilla JS) |
| `index.html`, `src/styles.css` | Interface |
| `src/example.js` | Démo console du compilateur |
| `docs/format-donnees.md` | Référence détaillée du format de données |
| `README.md` | Lancer / déployer (pour les amis) |

## Conventions de code

- JavaScript **vanilla**, modules ES, aucune lib front. Garder ça léger (GitHub Pages).
- Le modèle (`dialogueModel.js`) ne dépend ni du DOM ni de Firebase → testable seul.
- Commentaires et UI en **français** (l'équipe est francophone).

## Repo

https://github.com/Kevin-Bal/dialog_app_unity — branche `main`.
