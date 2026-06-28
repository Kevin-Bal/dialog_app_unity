/**
 * Éditeur de dialogues. Lit/écrit directement les objets du modèle ;
 * l'export réutilise le compilateur.
 *
 * Persistance : si Firebase est configuré (src/firebaseConfig.js), l'app
 * rejoint une « salle » (document Firestore) et synchronise en temps réel.
 * Sinon, elle tourne en LOCAL sur la démo (aucune sauvegarde).
 */
import { buildSampleProject } from "./sampleData.js";
import {
  createCharacter,
  createGroup,
  createNode,
  createVariable,
  compileCharacterToYarn,
  validateProject,
  yarnNodeTitle,
  normalizeProject,
} from "./dialogueModel.js";
import { isConfigured, saveProject, subscribeProject } from "./firebase.js";

const OPS = ["==", "!=", ">", ">=", "<", "<="];

const state = {
  project: buildSampleProject(),
  charId: null,
  nodeId: null,
};
// Sélection initiale : premier personnage, son premier nœud.
state.charId = Object.keys(state.project.characters)[0];
state.nodeId = currentChar().nodes[0]?.id ?? null;

/* -------------------- helpers -------------------- */
function currentChar() {
  return state.project.characters[state.charId];
}
function currentNode() {
  return currentChar()?.nodes.find((n) => n.id === state.nodeId) ?? null;
}
function varByName(name) {
  return state.project.settings.variables.find((v) => v.name === name);
}
const el = (tag, props = {}, children = []) => {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of [].concat(children)) {
    if (c == null) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
};

/* -------------------- sidebar -------------------- */
function renderSidebar() {
  const root = document.getElementById("sidebar");
  root.innerHTML = "";
  root.append(el("div", { className: "side-label", textContent: "Groupes" }));

  const chars = Object.values(state.project.characters);
  const groups = state.project.settings.groups;

  for (const group of groups) {
    const inGroup = chars.filter((c) => c.groupId === group.id);
    root.append(groupHeader(group, inGroup.length));
    for (const c of inGroup) root.append(charItem(c));
  }

  // Personnages sans groupe (ex. après suppression d'un groupe).
  const orphans = chars.filter((c) => !groups.some((g) => g.id === c.groupId));
  if (orphans.length) {
    root.append(el("div", { className: "hameau-name muted", textContent: "Sans groupe" }));
    for (const c of orphans) root.append(charItem(c));
  }

  root.append(
    el("button", {
      className: "ghost",
      textContent: "+ Groupe",
      style: "width:100%;margin-top:12px",
      onclick: addGroup,
    })
  );
  root.append(
    el("button", {
      className: "ghost",
      textContent: "+ Personnage",
      style: "width:100%;margin-top:6px",
      onclick: addCharacter,
    })
  );

  root.append(el("hr", { className: "side-divider" }));
  const vars = el("div", {
    className: "side-link",
    textContent: `Variables partagées (${state.project.settings.variables.length})`,
    onclick: showVariables,
  });
  root.append(vars);
}

function groupHeader(group, count) {
  const head = el("div", { className: "hameau-name group-head" });
  head.append(el("span", { className: "group-name", textContent: group.name }));
  const tools = el("span", { className: "group-tools" });
  tools.append(
    el("button", { className: "mini ghost", title: "Renommer", textContent: "✎", onclick: () => renameGroup(group) })
  );
  tools.append(
    el("button", { className: "mini ghost", title: "Supprimer le groupe", textContent: "✕", onclick: () => deleteGroup(group) })
  );
  head.append(tools);
  return head;
}

function charItem(c) {
  const item = el("div", {
    className: "char-item" + (c.id === state.charId ? " active" : ""),
    onclick: () => selectCharacter(c.id),
  });
  item.append(el("span", { textContent: c.name }));
  item.append(el("span", { className: "count", textContent: `${c.nodes.length}` }));
  return item;
}

/* Barre du canevas : titre du dialogue + groupe du personnage courant. */
function renderCharBar() {
  const title = document.getElementById("canvas-title");
  title.textContent = "";
  const char = currentChar();
  if (!char) {
    title.textContent = "—";
    return;
  }
  title.append(el("span", { textContent: `Dialogue de ${char.name}` }));

  const wrap = el("label", { className: "char-group" });
  wrap.append(el("span", { textContent: "Groupe :" }));
  const sel = el("select");
  sel.append(el("option", { value: "", textContent: "— Sans groupe —", selected: !char.groupId }));
  for (const g of state.project.settings.groups) {
    sel.append(el("option", { value: g.id, textContent: g.name, selected: g.id === char.groupId }));
  }
  sel.onchange = () => setCharacterGroup(sel.value);
  wrap.append(sel);
  title.append(wrap);
}

/* -------------------- canvas -------------------- */
function renderCanvas() {
  renderCharBar();

  const canvas = document.getElementById("canvas");
  // on retire les anciennes cartes (garde le <svg>)
  [...canvas.querySelectorAll(".node")].forEach((n) => n.remove());

  const char = currentChar();
  if (!char) return;

  for (const node of char.nodes) {
    canvas.append(buildNodeCard(char, node));
  }
  drawConnectors(char);
}

function buildNodeCard(char, node) {
  const card = el("div", {
    className:
      "node" + (node.isHub ? " hub" : "") + (node.id === state.nodeId ? " selected" : ""),
  });
  card.style.left = (node.position?.x ?? 20) + "px";
  card.style.top = (node.position?.y ?? 20) + "px";
  card.dataset.id = node.id;

  const head = el("div", { className: "node-head" });
  head.append(el("span", { textContent: node.title }));
  if (node.isHub) head.append(el("span", { className: "badge", textContent: "aiguillage" }));
  card.append(head);

  if (node.conditions?.length) {
    card.append(
      el("div", {
        className: "node-cond",
        textContent: "si " + node.conditions.map(condLabel).join(" et "),
      })
    );
  }

  if (node.isHub) {
    card.append(
      el("div", { className: "node-body", textContent: `${node.branches?.length || 0} aiguillage(s)` })
    );
  } else {
    const firstSay = (node.lines || []).find((l) => l.kind === "say");
    card.append(
      el("div", {
        className: "node-body",
        textContent: firstSay ? `« ${truncate(firstSay.text, 60)} »` : "(pas de réplique)",
      })
    );
    for (const ch of node.choices || []) {
      const row = el("div", { className: "node-choice" });
      row.append(el("span", { className: "arr", textContent: "→" }));
      row.append(el("span", { textContent: ch.label }));
      card.append(row);
    }
  }

  head.addEventListener("mousedown", (e) => startDrag(e, node, card));
  card.addEventListener("mousedown", () => selectNode(node.id));
  return card;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* connecteurs : lignes entre nœuds (branches de hub + choix) */
function drawConnectors(char) {
  const svg = document.getElementById("connectors");
  svg.innerHTML = "";
  const pos = (id) => char.nodes.find((n) => n.id === id)?.position;
  const link = (from, to) => {
    if (!from || !to) return;
    const x1 = from.x + 94, y1 = from.y + 70;
    const x2 = to.x + 94, y2 = to.y;
    const mid = (y1 + y2) / 2;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "var(--border-strong)");
    path.setAttribute("stroke-width", "1.5");
    svg.append(path);
  };
  for (const node of char.nodes) {
    for (const b of node.branches || []) link(node.position, pos(b.targetNodeId));
    for (const c of node.choices || []) if (c.targetNodeId) link(node.position, pos(c.targetNodeId));
  }
}

let drag = null;
function startDrag(e, node, card) {
  e.preventDefault();
  const rect = card.getBoundingClientRect();
  drag = { node, card, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", endDrag);
}
function onDrag(e) {
  if (!drag) return;
  const canvas = document.getElementById("canvas");
  const cr = canvas.getBoundingClientRect();
  const x = Math.max(0, e.clientX - cr.left - drag.dx + canvas.scrollLeft);
  const y = Math.max(0, e.clientY - cr.top - drag.dy + canvas.scrollTop);
  drag.node.position = { x, y };
  drag.card.style.left = x + "px";
  drag.card.style.top = y + "px";
  drawConnectors(currentChar());
}
function endDrag() {
  drag = null;
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", endDrag);
  scheduleSave(); // la position du nœud a changé
}

/* -------------------- inspector -------------------- */
function condLabel(c) {
  const v = varByName(c.variable);
  const label = v ? v.label : `$${c.variable}`;
  return `${label} ${c.op} ${c.value}`;
}

function renderInspector() {
  const root = document.getElementById("inspector");
  root.innerHTML = "";
  const node = currentNode();
  if (!node) {
    root.append(el("div", { className: "empty", textContent: "Sélectionne un nœud." }));
    return;
  }

  // Titre du nœud
  root.append(el("div", { className: "insp-title", textContent: node.title }));
  root.append(
    el("div", {
      className: "insp-sub",
      textContent: node.isHub ? "Aiguillage" : "Nœud de dialogue",
    })
  );

  const titleField = labeledInput("Titre", node.title, (v) => {
    node.title = v;
    document.querySelector(`.node[data-id="${node.id}"] .node-head span`).textContent = v;
    renderValidation();
  });
  root.append(titleField);

  if (node.isHub) {
    renderHubInspector(root, node);
  } else {
    renderContentInspector(root, node);
  }

  // Suppression
  root.append(
    el("button", {
      className: "danger",
      textContent: "Supprimer ce nœud",
      style: "margin-top:8px",
      onclick: () => deleteNode(node),
    })
  );
}

function renderContentInspector(root, node) {
  // Conditions d'apparition
  const condSec = section("Conditions d'apparition");
  for (const [i, c] of (node.conditions || []).entries()) {
    condSec.append(conditionRow(c, node.conditions, i));
  }
  condSec.append(
    addButton("+ Condition", () => {
      node.conditions.push(defaultCondition());
      refresh();
    })
  );
  root.append(condSec);

  // Répliques
  const linesSec = section("Répliques");
  for (const [i, line] of (node.lines || []).entries()) {
    linesSec.append(lineCard(node, line, i));
  }
  const addLineRow = el("div", { className: "row" });
  addLineRow.append(
    addButton("+ Réplique", () => {
      node.lines.push({ kind: "say", speaker: "", text: "" });
      refresh();
    })
  );
  addLineRow.append(
    addButton("+ Changer une variable", () => {
      node.lines.push({ kind: "set", action: defaultSetAction() });
      refresh();
    })
  );
  linesSec.append(addLineRow);
  root.append(linesSec);

  // Choix
  const choiceSec = section("Réponses du joueur");
  for (const [i, ch] of (node.choices || []).entries()) {
    choiceSec.append(choiceCard(node, ch, i));
  }
  choiceSec.append(
    addButton("+ Réponse", () => {
      node.choices.push({ label: "Nouvelle réponse", targetNodeId: "", conditions: [], setActions: [] });
      refresh();
    })
  );
  root.append(choiceSec);
}

function renderHubInspector(root, node) {
  const sec = section("Aiguillages (du plus prioritaire au dernier)");
  for (const [i, b] of (node.branches || []).entries()) {
    const card = el("div", { className: "cond-card" });
    const head = el("div", { className: "card-head" });
    head.append(el("small", { textContent: `Branche ${i + 1}` }));
    head.append(
      el("button", { className: "danger mini", textContent: "✕", onclick: () => { node.branches.splice(i, 1); refresh(); } })
    );
    card.append(head);

    card.append(el("div", { className: "insp-sub", textContent: b.conditions.length ? "si" : "sinon (par défaut)" }));
    for (const [j, c] of b.conditions.entries()) card.append(conditionRow(c, b.conditions, j));
    card.append(
      addButton("+ Condition", () => { b.conditions.push(defaultCondition()); refresh(); })
    );

    card.append(el("div", { className: "insp-sub", style: "margin-top:8px", textContent: "aller vers" }));
    card.append(nodeSelect(b.targetNodeId, (id) => { b.targetNodeId = id; renderCanvas(); renderValidation(); }));
    sec.append(card);
  }
  sec.append(
    addButton("+ Aiguillage", () => {
      node.branches.push({ conditions: [], targetNodeId: "" });
      refresh();
    })
  );
  root.append(sec);
}

/* widgets d'édition */
function conditionRow(c, list, i) {
  const row = el("div", { className: "row" });
  const varSel = el("select");
  for (const v of state.project.settings.variables) {
    varSel.append(el("option", { value: v.name, textContent: v.label, selected: v.name === c.variable }));
  }
  varSel.onchange = () => { c.variable = varSel.value; refresh(); };

  const opSel = el("select", { style: "flex:0 0 56px" });
  for (const op of OPS) opSel.append(el("option", { value: op, textContent: op, selected: op === c.op }));
  opSel.onchange = () => { c.op = opSel.value; renderCanvasNodeCond(); renderValidation(); };

  const valInput = valueInput(c, () => { renderCanvasNodeCond(); renderValidation(); });

  const del = el("button", { className: "danger mini", textContent: "✕", onclick: () => { list.splice(i, 1); refresh(); } });
  row.append(varSel, opSel, valInput, del);
  return row;
}

function valueInput(cond, onChange) {
  const v = varByName(cond.variable);
  if (v && v.type === "bool") {
    const sel = el("select", { style: "flex:0 0 70px" });
    sel.append(el("option", { value: "true", textContent: "vrai", selected: cond.value === true }));
    sel.append(el("option", { value: "false", textContent: "faux", selected: cond.value === false }));
    sel.onchange = () => { cond.value = sel.value === "true"; onChange(); };
    return sel;
  }
  if (v && v.type === "number") {
    const inp = el("input", { type: "number", value: cond.value, style: "flex:0 0 64px" });
    inp.oninput = () => { cond.value = Number(inp.value); onChange(); };
    return inp;
  }
  const inp = el("input", { type: "text", value: cond.value });
  inp.oninput = () => { cond.value = inp.value; onChange(); };
  return inp;
}

function lineCard(node, line, i) {
  const card = el("div", { className: "line-card" });
  const head = el("div", { className: "card-head" });
  head.append(el("small", { textContent: line.kind === "say" ? "réplique" : "changer une variable" }));
  head.append(el("button", { className: "danger mini", textContent: "✕", onclick: () => { node.lines.splice(i, 1); refresh(); } }));
  card.append(head);

  if (line.kind === "say") {
    const ta = el("textarea", { rows: 2, value: line.text });
    ta.oninput = () => { line.text = ta.value; renderCanvasNodeBody(node); renderValidation(); };
    card.append(ta);
  } else {
    card.append(setActionRow(line.action, () => renderValidation()));
  }
  return card;
}

function choiceCard(node, ch, i) {
  const card = el("div", { className: "choice-card" });
  const head = el("div", { className: "card-head" });
  head.append(el("small", { textContent: `Réponse ${i + 1}` }));
  head.append(el("button", { className: "danger mini", textContent: "✕", onclick: () => { node.choices.splice(i, 1); refresh(); } }));
  card.append(head);

  const lbl = el("input", { type: "text", value: ch.label });
  lbl.oninput = () => { ch.label = lbl.value; renderCanvas(); scheduleSave(); };
  card.append(lbl);

  card.append(el("div", { className: "insp-sub", style: "margin-top:8px", textContent: "mène vers" }));
  card.append(nodeSelect(ch.targetNodeId, (id) => { ch.targetNodeId = id; renderCanvas(); renderValidation(); }));
  return card;
}

function setActionRow(action, onChange) {
  const row = el("div", { className: "row" });
  const varSel = el("select");
  for (const v of state.project.settings.variables) {
    varSel.append(el("option", { value: v.name, textContent: v.label, selected: v.name === action.variable }));
  }
  varSel.onchange = () => { action.variable = varSel.value; onChange(); };
  const opSel = el("select", { style: "flex:0 0 64px" });
  for (const op of [["set", "="], ["add", "+"], ["sub", "−"]]) {
    opSel.append(el("option", { value: op[0], textContent: op[1], selected: op[0] === action.op }));
  }
  opSel.onchange = () => { action.op = opSel.value; onChange(); };
  const val = el("input", { type: "text", value: String(action.value), style: "flex:0 0 70px" });
  val.oninput = () => { action.value = coerce(val.value); onChange(); };
  row.append(varSel, opSel, val);
  return row;
}

function nodeSelect(currentId, onChange) {
  const sel = el("select");
  sel.append(el("option", { value: "", textContent: "— (rien) —", selected: !currentId }));
  for (const n of currentChar().nodes) {
    sel.append(el("option", { value: n.id, textContent: n.title, selected: n.id === currentId }));
  }
  sel.onchange = () => onChange(sel.value);
  return sel;
}

/* -------------------- validation -------------------- */
function renderValidation() {
  scheduleSave(); // appelée par presque toutes les éditions de contenu
  const root = document.getElementById("validation");
  root.innerHTML = "";
  const issues = validateProject(state.project);
  if (!issues.length) {
    root.append(el("span", { className: "v-ok v-item", textContent: "✓ Aucun problème — prêt à exporter" }));
    return;
  }
  const errors = issues.filter((i) => i.level === "error").length;
  const warns = issues.length - errors;
  root.append(
    el("span", {
      className: "v-item " + (errors ? "v-error" : "v-warn"),
      textContent: `${errors} erreur(s), ${warns} avertissement(s) :`,
    })
  );
  for (const i of issues.slice(0, 6)) {
    root.append(el("span", { className: "v-item " + (i.level === "error" ? "v-error" : "v-warn"), textContent: `• ${i.where} — ${i.message}` }));
  }
}

/* mises à jour ciblées (évitent de perdre le focus en tapant) */
function renderCanvasNodeBody(node) {
  const body = document.querySelector(`.node[data-id="${node.id}"] .node-body`);
  if (!body) return;
  const firstSay = (node.lines || []).find((l) => l.kind === "say");
  body.textContent = firstSay ? `« ${truncate(firstSay.text, 60)} »` : "(pas de réplique)";
}
function renderCanvasNodeCond() {
  renderCanvas();
}

/* -------------------- actions -------------------- */
function selectCharacter(id) {
  state.charId = id;
  state.nodeId = currentChar().nodes[0]?.id ?? null;
  refresh();
}
function selectNode(id) {
  if (state.nodeId === id) return;
  state.nodeId = id;
  // mise à jour légère : on ne reconstruit pas les cartes (sinon le drag casse),
  // on déplace juste la classe .selected.
  for (const card of document.querySelectorAll(".node")) {
    card.classList.toggle("selected", card.dataset.id === id);
  }
  renderInspector();
}
function addCharacter() {
  const name = prompt("Nom du personnage ?");
  if (!name) return;
  const groupId = state.project.settings.groups[0]?.id ?? null;
  const c = createCharacter(name.trim(), groupId);
  state.project.characters[c.id] = c;
  selectCharacter(c.id);
}

/* --- groupes --- */
function addGroup() {
  const name = prompt("Nom du nouveau groupe ?");
  if (!name) return;
  state.project.settings.groups.push(createGroup(name.trim()));
  refresh();
}
function renameGroup(group) {
  const name = prompt("Renommer le groupe :", group.name);
  if (!name) return;
  group.name = name.trim();
  refresh();
}
function deleteGroup(group) {
  const inGroup = Object.values(state.project.characters).filter((c) => c.groupId === group.id);
  const msg = inGroup.length
    ? `Supprimer le groupe « ${group.name} » ?\nSes ${inGroup.length} personnage(s) deviendront « Sans groupe » (ils ne sont PAS supprimés).`
    : `Supprimer le groupe « ${group.name} » ?`;
  if (!confirm(msg)) return;
  for (const c of inGroup) c.groupId = null;
  state.project.settings.groups = state.project.settings.groups.filter((g) => g.id !== group.id);
  refresh();
}
/** Change le groupe du personnage courant (depuis la barre du canevas). */
function setCharacterGroup(groupId) {
  const char = currentChar();
  if (char) char.groupId = groupId || null;
  refresh();
}
function addNode(isHub) {
  const node = createNode(isHub ? "Aiguillage" : "Nouveau nœud", isHub);
  node.position = { x: 40 + Math.random() * 60, y: 260 + Math.random() * 60 };
  currentChar().nodes.push(node);
  state.nodeId = node.id;
  refresh();
}
function deleteNode(node) {
  const char = currentChar();
  char.nodes = char.nodes.filter((n) => n.id !== node.id);
  state.nodeId = char.nodes[0]?.id ?? null;
  refresh();
}
/* -------------------- gestionnaire de variables -------------------- */
const VAR_TYPES = [
  ["bool", "Oui / Non"],
  ["number", "Nombre"],
  ["string", "Texte"],
];

/** Compte combien de fois une variable est utilisée (conditions / set) dans tout le projet. */
function countVariableUsage(name) {
  let n = 0;
  const inConds = (conds) => (conds || []).filter((c) => c.variable === name).length;
  for (const char of Object.values(state.project.characters)) {
    for (const node of char.nodes) {
      n += inConds(node.conditions);
      for (const line of node.lines || []) if (line.kind === "set" && line.action?.variable === name) n++;
      for (const ch of node.choices || []) {
        n += inConds(ch.conditions);
        n += (ch.setActions || []).filter((a) => a.variable === name).length;
      }
      for (const b of node.branches || []) n += inConds(b.conditions);
    }
  }
  return n;
}

function showVariables() {
  const overlay = el("div", {
    className: "modal-overlay",
    onclick: (e) => { if (e.target === overlay) overlay.remove(); },
  });
  const card = el("div", { className: "modal-card" });

  const head = el("div", { className: "modal-head" });
  head.append(el("strong", { textContent: "Variables partagées" }));
  head.append(el("button", { className: "mini ghost", textContent: "✕", onclick: () => overlay.remove() }));
  card.append(head);

  card.append(
    el("p", {
      className: "modal-sub",
      textContent:
        "Les variables mémorisent l'état du jeu (ex. « la lettre est livrée »). " +
        "Tout le monde les partage : on les choisit ensuite dans les menus déroulants.",
    })
  );

  const list = el("div", { className: "var-list" });
  card.append(list);
  card.append(
    el("button", { className: "ghost", textContent: "+ Variable", style: "margin-top:10px", onclick: () => addVariable(list) })
  );

  renderVarList(list);
  overlay.append(card);
  document.body.append(overlay);
}

function renderVarList(list) {
  list.innerHTML = "";
  const vars = state.project.settings.variables;
  if (!vars.length) {
    list.append(el("div", { className: "empty", textContent: "Aucune variable. Crée-en une avec « + Variable »." }));
    return;
  }
  for (const v of vars) list.append(varRow(v, list));
}

function varRow(v, list) {
  const row = el("div", { className: "var-row" });

  // Libellé lisible (modifiable). L'identifiant Yarn reste figé pour ne pas
  // casser les références existantes.
  const lbl = el("input", { type: "text", value: v.label, className: "var-label" });
  lbl.onchange = () => { v.label = lbl.value.trim() || v.name; refresh(); renderVarList(list); };

  // Type
  const typeSel = el("select", { className: "var-type" });
  for (const [val, txt] of VAR_TYPES) {
    typeSel.append(el("option", { value: val, textContent: txt, selected: val === v.type }));
  }
  typeSel.onchange = () => {
    v.type = typeSel.value;
    v.default = v.type === "bool" ? false : v.type === "number" ? 0 : "";
    refresh();
    renderVarList(list);
  };

  // Valeur par défaut
  const defWrap = el("label", { className: "var-default" });
  defWrap.append(el("span", { textContent: "défaut :" }));
  defWrap.append(varDefaultInput(v));

  // Suppression (avec avertissement si utilisée)
  const del = el("button", {
    className: "danger mini",
    textContent: "✕",
    title: "Supprimer la variable",
    onclick: () => deleteVariable(v, list),
  });

  const top = el("div", { className: "var-top" });
  top.append(lbl, typeSel, del);
  row.append(top);

  const meta = el("div", { className: "var-meta" });
  meta.append(defWrap);
  const used = countVariableUsage(v.name);
  meta.append(el("span", { className: "var-id", textContent: `id: $${v.name}${used ? ` · utilisée ${used}×` : ""}` }));
  row.append(meta);
  return row;
}

function varDefaultInput(v) {
  if (v.type === "bool") {
    const sel = el("select");
    sel.append(el("option", { value: "false", textContent: "Non", selected: v.default !== true }));
    sel.append(el("option", { value: "true", textContent: "Oui", selected: v.default === true }));
    sel.onchange = () => { v.default = sel.value === "true"; scheduleSave(); };
    return sel;
  }
  if (v.type === "number") {
    const inp = el("input", { type: "number", value: v.default ?? 0, style: "width:70px" });
    inp.oninput = () => { v.default = Number(inp.value); scheduleSave(); };
    return inp;
  }
  const inp = el("input", { type: "text", value: v.default ?? "" });
  inp.oninput = () => { v.default = inp.value; scheduleSave(); };
  return inp;
}

function addVariable(list) {
  const label = prompt("Nom de la variable (ex. « Lettre livrée ») :");
  if (!label) return;
  const existing = state.project.settings.variables.map((v) => v.name);
  state.project.settings.variables.push(createVariable(label.trim(), "bool", existing));
  refresh();
  renderVarList(list);
}

function deleteVariable(v, list) {
  const used = countVariableUsage(v.name);
  const msg = used
    ? `Supprimer « ${v.label} » ?\nElle est utilisée ${used} fois (conditions / changements). ` +
      `Ces usages garderont un menu déroulant vide à corriger.`
    : `Supprimer « ${v.label} » ?`;
  if (!confirm(msg)) return;
  state.project.settings.variables = state.project.settings.variables.filter((x) => x.name !== v.name);
  refresh();
  renderVarList(list);
}
function exportYarn() {
  const char = currentChar();
  const yarn = compileCharacterToYarn(char);
  const blob = new Blob([yarn], { type: "text/plain;charset=utf-8" });
  const a = el("a", {
    href: URL.createObjectURL(blob),
    download: `${char.name}.yarn`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

/* helpers UI */
function section(title) {
  const sec = el("div", { className: "insp-section" });
  sec.append(el("div", { className: "insp-sub", textContent: title }));
  return sec;
}
function labeledInput(label, value, onInput) {
  const wrap = el("label", { className: "field" });
  wrap.append(el("span", { textContent: label }));
  const inp = el("input", { type: "text", value });
  inp.oninput = () => onInput(inp.value);
  wrap.append(inp);
  return wrap;
}
function addButton(text, onclick) {
  return el("button", { className: "ghost mini", textContent: text, onclick });
}
function defaultCondition() {
  const v = state.project.settings.variables[0];
  return { variable: v?.name, op: "==", value: v?.type === "bool" ? true : v?.type === "number" ? 0 : "" };
}
function defaultSetAction() {
  const v = state.project.settings.variables[0];
  return { variable: v?.name, op: "set", value: v?.type === "bool" ? true : 0 };
}
function coerce(s) {
  if (s === "true") return true;
  if (s === "false") return false;
  if (s !== "" && !isNaN(Number(s))) return Number(s);
  return s;
}

function refresh() {
  renderProjectName();
  renderSidebar();
  renderCanvas();
  renderInspector();
  renderValidation();
  scheduleSave();
}

function renderProjectName() {
  document.getElementById("project-name").textContent =
    state.project.meta?.name || "Projet sans nom";
}
function renameProject() {
  if (!room.connected) return; // on ne renomme qu'une salle ouverte
  const name = prompt("Nom du projet :", state.project.meta?.name || "");
  if (!name) return;
  state.project.meta.name = name.trim();
  refresh();
}

/* -------------------- salle Firebase (persistance + temps réel) -------------------- */
const room = { code: null, connected: false, unsub: null, intent: null };
let applyingRemote = false; // true pendant qu'on applique un changement distant
let firstSnapshot = false;  // 1er snapshot après connexion (décide rejoindre/créer)
let saveTimer = null;

/** Programme une sauvegarde (débouncée) du projet vers Firestore. */
function scheduleSave() {
  if (applyingRemote || !room.connected) return; // ni en mode local, ni en écho distant
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    state.project.meta.updatedAt = Date.now();
    saveProject(room.code, state.project).catch((e) => console.error("Sauvegarde échouée :", e));
  }, 600);
}

function updateRoomChip() {
  const chip = document.getElementById("room-code");
  if (room.connected) {
    chip.textContent = room.code;
    chip.title = "Salle partagée — clique pour en changer";
    chip.classList.remove("offline");
  } else {
    chip.textContent = "—";
    chip.classList.add("offline");
  }
}

/* --- écran d'entrée (gate) --- */
function showGate(message) {
  document.getElementById("app").classList.add("is-hidden");
  document.getElementById("gate").classList.remove("is-hidden");
  gateError(message || "");
  const input = document.getElementById("gate-code");
  if (!input.value) input.value = localStorage.getItem("roomCode") || "";
  input.focus();
}
function hideGate() {
  document.getElementById("gate").classList.add("is-hidden");
  document.getElementById("app").classList.remove("is-hidden");
}
function gateError(msg) {
  document.getElementById("gate-error").textContent = msg || "";
}

/** Code lisible, sans caractères ambigus (I, L, O, 0, 1). */
function randomCode() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return "POSTE-" + s;
}

async function initRoom() {
  updateRoomChip();
  if (!isConfigured()) {
    document.getElementById("gate-join").disabled = true;
    document.getElementById("gate-create").disabled = true;
    showGate("Firebase n'est pas configuré (voir src/firebaseConfig.js).");
    return;
  }
  const urlCode = new URLSearchParams(location.search).get("code");
  if (urlCode) {
    connectRoom(urlCode.trim(), "join"); // lien partagé : on rejoint directement
  } else {
    showGate();
  }
}

/** Rouvre l'écran d'entrée pour changer de salle (clic sur le chip). */
function changeRoom() {
  if (!isConfigured()) return;
  showGate();
}

async function connectRoom(code, intent, newName) {
  code = (code || "").trim().replace(/\//g, "-"); // "/" interdit dans un id Firestore
  if (!code) {
    gateError("Entre un code de salle.");
    return;
  }
  if (room.unsub) room.unsub();
  room.code = code;
  room.intent = intent;
  room.newName = newName; // nom voulu si on crée la salle
  room.connected = false;
  firstSnapshot = true;
  try {
    room.unsub = await subscribeProject(code, onRemote);
  } catch (e) {
    showGate("Connexion impossible : " + e.message);
  }
}

/** Finalise l'entrée dans une salle : URL, mémorisation, affichage de l'éditeur. */
function finalizeJoin() {
  room.connected = true;
  localStorage.setItem("roomCode", room.code);
  const url = new URL(location);
  url.searchParams.set("code", room.code);
  history.replaceState(null, "", url);
  updateRoomChip();
  hideGate();
}

function onRemote({ exists, data, hasPendingWrites }) {
  if (firstSnapshot) {
    firstSnapshot = false;

    if (exists) {
      // La salle existe : on charge son contenu (peu importe l'intention).
      applyRemote(data);
      finalizeJoin();
      return;
    }
    if (room.intent === "create") {
      // Salle neuve : on y dépose un projet de départ (la démo) puis on entre.
      seedNewRoom();
      finalizeJoin();
      refresh(); // déclenche la 1re sauvegarde (room.connected est maintenant true)
      return;
    }
    // On voulait rejoindre une salle qui n'existe pas → on reste sur l'écran d'entrée.
    if (room.unsub) { room.unsub(); room.unsub = null; }
    const tried = room.code;
    room.code = null;
    showGate(`Aucune salle « ${tried} ». Vérifie le code ou crée-en une nouvelle.`);
    return;
  }

  // Snapshots suivants (temps réel)
  if (!exists || hasPendingWrites) return; // ignore l'écho de nos propres écritures
  // Last-write-wins : on n'applique que ce qui est plus récent que notre état.
  if ((data.meta?.updatedAt ?? 0) <= (state.project.meta?.updatedAt ?? 0)) return;
  applyRemote(data);
}

/** Prépare un projet de départ pour une salle neuve. */
function seedNewRoom() {
  state.project = buildSampleProject();
  state.project.meta.code = room.code;
  state.project.meta.name = room.newName || "Nouveau projet";
  state.charId = Object.keys(state.project.characters)[0] ?? null;
  state.nodeId = state.charId ? currentChar().nodes[0]?.id ?? null : null;
}

/** Remplace l'état local par la version distante et re-rend, sans re-sauvegarder. */
function applyRemote(project) {
  applyingRemote = true;
  state.project = normalizeProject(project); // migration douce des anciennes salles
  // On garde une sélection valide (le personnage/nœud courant peut avoir disparu).
  if (!state.project.characters[state.charId]) {
    state.charId = Object.keys(state.project.characters)[0] ?? null;
  }
  if (state.charId && !currentChar().nodes.find((n) => n.id === state.nodeId)) {
    state.nodeId = currentChar().nodes[0]?.id ?? null;
  }
  refresh();
  applyingRemote = false;
}

/* -------------------- init -------------------- */
document.getElementById("btn-export").onclick = exportYarn;
document.getElementById("btn-add-node").onclick = () => addNode(false);
document.getElementById("btn-add-hub").onclick = () => addNode(true);
document.getElementById("room-code").onclick = changeRoom;
document.getElementById("project-name").onclick = renameProject;

// Écran d'entrée
document.getElementById("gate-join").onclick = () =>
  connectRoom(document.getElementById("gate-code").value, "join");
document.getElementById("gate-create").onclick = () =>
  connectRoom(randomCode(), "create", document.getElementById("gate-project").value.trim());
document.getElementById("gate-code").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("gate-join").click();
});

refresh();
initRoom();
