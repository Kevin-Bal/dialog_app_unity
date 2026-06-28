/**
 * Couche d'accès Firebase (Firestore) — la SEULE partie de l'app qui connaît
 * Firebase. Le modèle (dialogueModel.js) et la logique d'édition n'en dépendent
 * pas : ils manipulent du JSON, ce module se charge de le lire/écrire/écouter.
 *
 * Une « salle » partagée = un document `projects/{code}` qui contient le Project
 * entier (meta, settings, characters). Le « code de salle » est l'id du document.
 *
 * Le SDK Firebase est importé en modules ES depuis le CDN gstatic : aucune
 * dépendance npm, aucun build → compatible GitHub Pages. L'import est dynamique
 * pour qu'en mode local (config absente) on ne télécharge même pas le SDK.
 */
import { getFirebaseConfig } from "./firebaseConfig.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

let _db = null; // instance Firestore (initialisée à la 1re utilisation)
let _fs = null; // fonctions du module firestore (doc, setDoc, onSnapshot…)

/** True si une vraie config a été fournie (sinon : mode local, démo sans sauvegarde). */
export function isConfigured() {
  const c = getFirebaseConfig();
  return !!(c && c.apiKey && !c.apiKey.startsWith("REMPLACE"));
}

/** Initialise Firebase à la demande et renvoie l'instance Firestore. */
async function db() {
  if (_db) return _db;
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  _fs = await import(`${SDK}/firebase-firestore.js`);
  const app = initializeApp(getFirebaseConfig());
  _db = _fs.getFirestore(app);
  return _db;
}

/**
 * Écrit (ou remplace) le projet de la salle `code`.
 * On nettoie via un aller-retour JSON : Firestore refuse les `undefined`
 * (champs optionnels comme isHub/position) — JSON.stringify les supprime.
 */
export async function saveProject(code, project) {
  const d = await db();
  const ref = _fs.doc(d, "projects", code);
  await _fs.setDoc(ref, JSON.parse(JSON.stringify(project)));
}

/**
 * Écoute en temps réel la salle `code`. Appelle `cb` à chaque changement avec :
 *   { exists, data, hasPendingWrites }
 * - exists           : le document existe-t-il ?
 * - data             : le Project (ou null)
 * - hasPendingWrites : true si ce snapshot reflète NOTRE écriture pas encore
 *                      confirmée par le serveur (sert à ignorer l'écho local).
 * Renvoie la fonction de désabonnement.
 */
export async function subscribeProject(code, cb) {
  const d = await db();
  const ref = _fs.doc(d, "projects", code);
  return _fs.onSnapshot(ref, (snap) => {
    cb({
      exists: snap.exists(),
      data: snap.exists() ? snap.data() : null,
      hasPendingWrites: snap.metadata.hasPendingWrites,
    });
  });
}
