/**
 * Format de données de l'éditeur de dialogues "Île aux Lettres".
 *
 * Idée directrice : ce JSON est le SEUL format de travail. Le .yarn n'est
 * qu'une sortie générée à la demande (voir compileCharacterToYarn).
 * Tout est stocké dans Firestore et synchronisé en temps réel ; ce fichier
 * décrit la forme des objets et ne dépend ni de Firebase ni du DOM, pour
 * pouvoir être testé seul et réutilisé partout.
 *
 * Vocabulaire :
 *  - Project   : la salle partagée entière (un "code" = un Project).
 *  - settings  : le registre central commun (hameaux, personnages, variables).
 *  - Character : un PNJ. Ses dialogues = une liste de Node.
 *  - Node      : un nœud de dialogue. Soit un "hub" (aiguillage), soit du contenu.
 *  - Variable  : un drapeau d'état partagé ($marie_lettre_livree, etc.).
 */

export const SCHEMA_VERSION = 1;

/**
 * @typedef {Object} Project
 * @property {Object} meta              - { name, code, schemaVersion, updatedAt }
 * @property {Settings} settings        - registre central partagé
 * @property {Object<string, Character>} characters - indexés par characterId
 *
 * @typedef {Object} Settings
 * @property {Hameau[]} hameaux
 * @property {Variable[]} variables     - registre des drapeaux d'état
 *
 * @typedef {Object} Hameau
 * @property {string} id
 * @property {string} name
 *
 * @typedef {Object} Variable
 * @property {string} name              - identifiant Yarn SANS le $ (ex: "marie_lettre_livree")
 * @property {('bool'|'number'|'string')} type
 * @property {string} label             - libellé lisible affiché dans l'UI ("Marie a livré la lettre")
 * @property {*} default                - valeur initiale (false, 0, "")
 *
 * @typedef {Object} Character
 * @property {string} id
 * @property {string} name              - nom affiché et utilisé comme locuteur ("Marie")
 * @property {string} hameauId
 * @property {Node[]} nodes
 *
 * @typedef {Object} Node
 * @property {string} id                - identifiant interne stable (uuid)
 * @property {string} title             - titre lisible ("Attend la livraison")
 * @property {boolean} [isHub]          - true => nœud d'aiguillage (que des branches conditionnelles)
 * @property {{x:number,y:number}} [position]
 * @property {Condition[]} [conditions] - conditions d'apparition (jointes en ET) -> <<if>>
 * @property {Line[]} [lines]           - répliques + commandes, dans l'ordre
 * @property {Choice[]} [choices]       - réponses proposées au joueur (->)
 * @property {Branch[]} [branches]      - pour un hub : aiguillages conditionnels
 *
 * @typedef {Object} Condition
 * @property {string} variable          - name d'une Variable du registre
 * @property {('=='|'!='|'>'|'>='|'<'|'<=')} op
 * @property {*} value
 *
 * @typedef {Object} SetAction
 * @property {string} variable
 * @property {('set'|'add'|'sub')} op
 * @property {*} value
 *
 * @typedef {Object} Line
 * @property {('say'|'set'|'command')} kind
 * @property {string} [speaker]         - pour kind 'say' (défaut: nom du Character)
 * @property {string} [text]            - pour kind 'say'
 * @property {SetAction} [action]       - pour kind 'set'
 * @property {string} [command]         - pour kind 'command' (ex: "jouer_animation salut")
 *
 * @typedef {Object} Choice
 * @property {string} label             - texte du bouton
 * @property {string} [targetNodeId]    - nœud cible (-> <<jump>>)
 * @property {Condition[]} [conditions] - option affichée seulement si... (<<if>> imbriqué)
 * @property {SetAction[]} [setActions] - <<set>> appliqués quand l'option est choisie
 *
 * @typedef {Object} Branch
 * @property {Condition[]} conditions   - jointes en ET ; vide = branche "sinon" (else)
 * @property {string} targetNodeId      - vers quel nœud sauter
 */

/* ------------------------------------------------------------------ */
/* Fabriques                                                           */
/* ------------------------------------------------------------------ */

let _counter = 0;
const uid = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${(_counter++).toString(36)}`;

export function createProject(name, code) {
  return {
    meta: { name, code, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() },
    settings: { hameaux: [], variables: [] },
    characters: {},
  };
}

export function createCharacter(name, hameauId) {
  return { id: uid("chr"), name, hameauId, nodes: [] };
}

export function createNode(title, isHub = false) {
  return {
    id: uid("node"),
    title,
    isHub,
    position: { x: 0, y: 0 },
    conditions: [],
    lines: [],
    choices: [],
    branches: [],
  };
}

/* ------------------------------------------------------------------ */
/* Titres Yarn : uniques sur tout le projet                            */
/* ------------------------------------------------------------------ */

/**
 * Yarn Spinner exige des titres de nœuds uniques dans tout le YarnProject.
 * On préfixe par le personnage pour éviter les collisions entre écrivains :
 *   "Marie" + "Attend la livraison" -> "Marie_AttendLivraison"
 */
export function yarnNodeTitle(character, node) {
  const clean = (s) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // enlève les accents
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  return `${clean(character.name)}_${clean(node.title)}`;
}

/* ------------------------------------------------------------------ */
/* Compilation vers .yarn                                              */
/* ------------------------------------------------------------------ */

const yarnValue = (v) =>
  typeof v === "string" ? JSON.stringify(v) : String(v);

const condExpr = (c) => `$${c.variable} ${c.op} ${yarnValue(c.value)}`;
const andExpr = (conds) => conds.map(condExpr).join(" and ");

function setCommand(a) {
  const v = `$${a.variable}`;
  if (a.op === "add") return `<<set ${v} = ${v} + ${yarnValue(a.value)}>>`;
  if (a.op === "sub") return `<<set ${v} = ${v} - ${yarnValue(a.value)}>>`;
  return `<<set ${v} = ${yarnValue(a.value)}>>`;
}

/**
 * Compile TOUS les nœuds d'un personnage en un fichier .yarn (string).
 * @param {Character} character
 * @returns {string}
 */
export function compileCharacterToYarn(character) {
  return character.nodes
    .map((node) => compileNode(character, node))
    .join("\n");
}

function compileNode(character, node) {
  const lines = [];
  lines.push(`title: ${yarnNodeTitle(character, node)}`);
  lines.push("---");

  const body = node.isHub
    ? compileHubBody(character, node)
    : compileContentBody(character, node);

  // Conditions d'apparition : on enrobe tout le corps dans un <<if>>.
  if (node.conditions && node.conditions.length) {
    lines.push(`<<if ${andExpr(node.conditions)}>>`);
    body.forEach((l) => lines.push("    " + l));
    lines.push("<<endif>>");
  } else {
    body.forEach((l) => lines.push(l));
  }

  lines.push("===");
  return lines.join("\n");
}

function nodeTitleById(character, id) {
  const target = character.nodes.find((n) => n.id === id);
  return target ? yarnNodeTitle(character, target) : null;
}

/** Hub = chaîne <<if>>/<<elseif>>/<<else>> de sauts. */
function compileHubBody(character, node) {
  const out = [];
  const branches = node.branches || [];
  branches.forEach((b, i) => {
    const jump = nodeTitleById(character, b.targetNodeId);
    const jumpLine = jump
      ? `<<jump ${jump}>>`
      : `// TODO: branche sans cible`;
    if (!b.conditions || b.conditions.length === 0) {
      out.push(i === 0 ? jumpLine : "<<else>>", ...(i === 0 ? [] : [`    ${jumpLine}`]));
    } else if (i === 0) {
      out.push(`<<if ${andExpr(b.conditions)}>>`, `    ${jumpLine}`);
    } else {
      out.push(`<<elseif ${andExpr(b.conditions)}>>`, `    ${jumpLine}`);
    }
  });
  if (branches.some((b) => b.conditions && b.conditions.length)) {
    out.push("<<endif>>");
  }
  return out;
}

/** Nœud de contenu : répliques, set, commandes, puis choix. */
function compileContentBody(character, node) {
  const out = [];

  for (const line of node.lines || []) {
    if (line.kind === "say") {
      const who = line.speaker || character.name;
      out.push(`${who}: ${line.text}`);
    } else if (line.kind === "set") {
      out.push(setCommand(line.action));
    } else if (line.kind === "command") {
      out.push(`<<${line.command}>>`);
    }
  }

  for (const choice of node.choices || []) {
    if (choice.conditions && choice.conditions.length) {
      out.push(`-> ${choice.label} <<if ${andExpr(choice.conditions)}>>`);
    } else {
      out.push(`-> ${choice.label}`);
    }
    for (const a of choice.setActions || []) out.push("    " + setCommand(a));
    const jump = choice.targetNodeId
      ? nodeTitleById(character, choice.targetNodeId)
      : null;
    if (jump) out.push("    " + `<<jump ${jump}>>`);
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Validation (à lancer avant l'export)                                */
/* ------------------------------------------------------------------ */

/**
 * Renvoie une liste de problèmes lisibles. Vide = tout va bien.
 * @returns {{level:('error'|'warning'), where:string, message:string}[]}
 */
export function validateProject(project) {
  const issues = [];
  const knownVars = new Set(project.settings.variables.map((v) => v.name));

  for (const character of Object.values(project.characters)) {
    const ids = new Set(character.nodes.map((n) => n.id));
    const titles = new Map();

    for (const node of character.nodes) {
      const where = `${character.name} › ${node.title}`;

      // Titres Yarn uniques
      const yt = yarnNodeTitle(character, node);
      if (titles.has(yt)) {
        issues.push({ level: "error", where, message: `Titre en double : ${yt}` });
      }
      titles.set(yt, true);

      // Variables connues dans les conditions
      const allConds = [
        ...(node.conditions || []),
        ...(node.branches || []).flatMap((b) => b.conditions || []),
        ...(node.choices || []).flatMap((c) => c.conditions || []),
      ];
      for (const c of allConds) {
        if (!knownVars.has(c.variable)) {
          issues.push({
            level: "error",
            where,
            message: `Variable inconnue : $${c.variable}`,
          });
        }
      }

      // Cibles de saut existantes
      const targets = [
        ...(node.branches || []).map((b) => b.targetNodeId),
        ...(node.choices || []).map((c) => c.targetNodeId),
      ].filter(Boolean);
      for (const t of targets) {
        if (!ids.has(t)) {
          issues.push({
            level: "error",
            where,
            message: `Saut vers un nœud inexistant`,
          });
        }
      }

      // Nœud vide
      const empty =
        !node.isHub &&
        !(node.lines || []).length &&
        !(node.choices || []).length;
      if (empty) {
        issues.push({ level: "warning", where, message: `Nœud sans contenu` });
      }
    }
  }
  return issues;
}
