# Île aux Lettres — éditeur de dialogues

Éditeur web pour écrire les dialogues Yarn Spinner du jeu, sans toucher Unity.
Prototype sur **données locales** (Firebase viendra ensuite).

## Lancer en local

Les modules ES nécessitent un serveur (ouvrir le fichier en `file://` ne marche pas) :

```bash
cd dialog_app
python3 -m http.server 8123
# puis ouvrir http://localhost:8123
```

## Ce qu'on peut déjà faire

- Choisir un personnage (barre de gauche, groupés par hameau)
- Déplacer les nœuds sur le canevas (glisser par l'en-tête)
- Éditer un nœud : titre, conditions d'apparition, répliques, réponses du joueur
- Conditions/variables via **menus déroulants** (registre partagé, pas de texte libre)
- Validation en direct (bandeau du bas)
- **Exporter .yarn** du personnage sélectionné

## Tester le moteur seul

```bash
npm run example   # compile l'exemple Marie et l'affiche en .yarn
```

## Structure

| Fichier | Rôle |
|---|---|
| `src/dialogueModel.js` | Modèle + compilateur .yarn + validateur |
| `src/sampleData.js` | Projet de démo (Marie, Tom) |
| `src/app.js` | Logique de l'éditeur (UI) |
| `index.html`, `src/styles.css` | Interface |
| `docs/format-donnees.md` | Référence du format |

## Déployer sur GitHub Pages

Pousser le dossier sur un repo, puis Settings → Pages → source = branche `main`,
dossier `/ (root)`. L'app est 100% statique, rien d'autre à configurer.

## Prochaine étape

Brancher **Firebase Firestore** : le projet devient un document synchronisé en
temps réel ; le « code de salle » = l'id du document.
