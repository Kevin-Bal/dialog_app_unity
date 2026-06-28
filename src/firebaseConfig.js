/**
 * Configuration CLIENT de Firebase.
 *
 * ⚠️ CE N'EST PAS UN SECRET. Ces clés sont publiques par nature : elles partent
 * de toute façon dans le JavaScript du navigateur (et donc sur GitHub Pages).
 * La sécurité ne vient PAS de cacher cette config, mais des RÈGLES Firestore
 * (voir le bas de ce fichier). Tu peux donc committer ce fichier sans crainte.
 *
 * Où trouver ces valeurs :
 *   console.firebase.google.com → ton projet → ⚙ Paramètres du projet
 *   → onglet « Général » → section « Tes applications » → appli Web (</>) → SDK.
 * Copie/colle simplement l'objet firebaseConfig que Firebase te montre.
 *
 * Tant que les valeurs commencent par "REMPLACE", l'app tourne en mode LOCAL
 * (démo, sans sauvegarde ni temps réel).
 */
export function getFirebaseConfig() {
  return {
    apiKey: "AIzaSyBK1cPHlzhuPnjSMzDfu3ZlSCXcvNRGstc",
    authDomain: "dialog-app-unity.firebaseapp.com",
    projectId: "dialog-app-unity",
    storageBucket: "dialog-app-unity.firebasestorage.app",
    messagingSenderId: "831992405198",
    appId: "1:831992405198:web:e76b1452c79f5500fa449f",
  };
}

/*
 * RÈGLES FIRESTORE à coller dans la console (Firestore Database → Règles).
 * Choix retenu : accès OUVERT par code de salle (pas de connexion). N'importe
 * qui connaissant le code d'un document peut le lire/écrire. Adapté à un cercle
 * d'amis ; à durcir si le projet devient public.
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /projects/{code} {
 *         allow read, write: if true;
 *       }
 *     }
 *   }
 */
