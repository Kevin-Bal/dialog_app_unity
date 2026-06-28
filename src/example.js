/**
 * Exemple "Marie et la lettre à Jeanne", construit avec le modèle.
 * Lancer :  node src/example.js
 * Montre le scénario à visites répétées de ton jeu de postier.
 */
import {
  createProject,
  createCharacter,
  createNode,
  compileCharacterToYarn,
  validateProject,
} from "./dialogueModel.js";

const project = createProject("Île aux Lettres", "POSTE-42");

// --- Registre central partagé (le "settings" que tout le monde voit) ---
project.settings.hameaux = [{ id: "port", name: "Hameau du Port" }];
project.settings.variables = [
  { name: "marie_etape", type: "number", label: "Avancement de Marie", default: 0 },
  { name: "marie_lettre_a_livrer", type: "bool", label: "Marie a une lettre à livrer", default: false },
  { name: "marie_lettre_livree", type: "bool", label: "Lettre à Jeanne livrée", default: false },
];

// --- Personnage ---
const marie = createCharacter("Marie", "port");

// Nœud d'aiguillage : point d'entrée unique, démarré depuis Unity via "Marie".
const hub = createNode("Aiguillage", true);

const rencontre = createNode("Première rencontre");
rencontre.lines = [
  { kind: "say", text: "Bonjour facteur ! Tu pourrais porter une lettre à Jeanne, dans les collines ?" },
];
rencontre.choices = [
  {
    label: "Avec plaisir.",
    setActions: [
      { variable: "marie_etape", op: "set", value: 1 },
      { variable: "marie_lettre_a_livrer", op: "set", value: true },
    ],
  },
];

const attend = createNode("Attend la livraison");
attend.conditions = [
  { variable: "marie_lettre_a_livrer", op: "==", value: true },
  { variable: "marie_lettre_livree", op: "==", value: false },
];
attend.lines = [{ kind: "say", text: "Tu as pu remettre ma lettre à Jeanne ?" }];
attend.choices = [
  {
    label: "Oui, c'est fait !",
    conditions: [{ variable: "marie_lettre_livree", op: "==", value: true }],
    setActions: [{ variable: "marie_etape", op: "set", value: 2 }],
  },
  { label: "Pas encore, j'y vais." },
];

const merci = createNode("Remerciements");
merci.conditions = [{ variable: "marie_etape", op: ">=", value: 2 }];
merci.lines = [{ kind: "say", text: "Merci infiniment ! Tu es le meilleur facteur de l'île." }];

// Le hub redirige selon l'état (du plus avancé au plus neutre).
hub.branches = [
  { conditions: [{ variable: "marie_etape", op: ">=", value: 2 }], targetNodeId: merci.id },
  { conditions: [{ variable: "marie_lettre_a_livrer", op: "==", value: true }], targetNodeId: attend.id },
  { conditions: [], targetNodeId: rencontre.id }, // sinon : première rencontre
];

marie.nodes = [hub, rencontre, attend, merci];
project.characters[marie.id] = marie;

// --- Sortie ---
console.log("===== EXPORT .yarn (personnage Marie) =====\n");
console.log(compileCharacterToYarn(marie));

console.log("\n===== VALIDATION =====");
const issues = validateProject(project);
if (!issues.length) {
  console.log("Aucun problème détecté.");
} else {
  for (const i of issues) {
    console.log(`[${i.level}] ${i.where} — ${i.message}`);
  }
}
