/**
 * Projet de démonstration chargé au lancement du prototype.
 * Reprend le scénario "Marie et la lettre à Jeanne" + un PNJ vide (Tom)
 * pour montrer la liste par hameau. Plus tard, ces données viendront de Firebase.
 */
import { createProject, createCharacter, createNode } from "./dialogueModel.js";

export function buildSampleProject() {
  const project = createProject("Île aux Lettres", "POSTE-42");

  project.settings.hameaux = [
    { id: "port", name: "Hameau du Port" },
    { id: "collines", name: "Les Collines" },
  ];
  project.settings.variables = [
    { name: "marie_etape", type: "number", label: "Avancement de Marie", default: 0 },
    { name: "marie_lettre_a_livrer", type: "bool", label: "Marie a une lettre à livrer", default: false },
    { name: "marie_lettre_livree", type: "bool", label: "Lettre à Jeanne livrée", default: false },
  ];

  // --- Marie ---
  const marie = createCharacter("Marie", "port");

  const hub = createNode("Aiguillage", true);
  const rencontre = createNode("Première rencontre");
  rencontre.position = { x: 40, y: 160 };
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
  attend.position = { x: 260, y: 160 };
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
  merci.position = { x: 480, y: 160 };
  merci.conditions = [{ variable: "marie_etape", op: ">=", value: 2 }];
  merci.lines = [{ kind: "say", text: "Merci infiniment ! Tu es le meilleur facteur de l'île." }];

  hub.position = { x: 260, y: 20 };
  hub.branches = [
    { conditions: [{ variable: "marie_etape", op: ">=", value: 2 }], targetNodeId: merci.id },
    { conditions: [{ variable: "marie_lettre_a_livrer", op: "==", value: true }], targetNodeId: attend.id },
    { conditions: [], targetNodeId: rencontre.id },
  ];

  marie.nodes = [hub, rencontre, attend, merci];
  project.characters[marie.id] = marie;

  // --- Tom (vide, pour la démo de la liste) ---
  const tom = createCharacter("Tom", "port");
  project.characters[tom.id] = tom;

  return project;
}
