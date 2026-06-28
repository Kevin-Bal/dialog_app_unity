/**
 * Prototype d'éditeur (données locales, sans Firebase pour l'instant).
 * Lit/écrit directement les objets du modèle ; l'export réutilise le compilateur.
 */
import { buildSampleProject } from "./sampleData.js";
import {
  createCharacter,
  createNode,
  compileCharacterToYarn,
  validateProject,
  yarnNodeTitle,
} from "./dialogueModel.js";

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
  root.append(el("div", { className: "side-label", textContent: "Personnages" }));

  const chars = Object.values(state.project.characters);
  for (const hameau of state.project.settings.hameaux) {
    const inHameau = chars.filter((c) => c.hameauId === hameau.id);
    if (!inHameau.length) continue;
    root.append(el("div", { className: "hameau-name", textContent: hameau.name }));
    for (const c of inHameau) {
      const item = el("div", {
        className: "char-item" + (c.id === state.charId ? " active" : ""),
        onclick: () => selectCharacter(c.id),
      });
      item.append(el("span", { textContent: c.name }));
      item.append(el("span", { className: "count", textContent: `${c.nodes.length}` }));
      root.append(item);
    }
  }

  const addBtn = el("button", {
    className: "ghost",
    textContent: "+ Personnage",
    style: "width:100%;margin-top:12px",
    onclick: addCharacter,
  });
  root.append(addBtn);

  root.append(el("hr", { className: "side-divider" }));
  const vars = el("div", {
    className: "side-link",
    textContent: `Variables partagées (${state.project.settings.variables.length})`,
    onclick: showVariables,
  });
  root.append(vars);
}

/* -------------------- canvas -------------------- */
function renderCanvas() {
  document.getElementById("canvas-title").textContent =
    currentChar() ? `Dialogue de ${currentChar().name}` : "—";

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
  lbl.oninput = () => { ch.label = lbl.value; renderCanvas(); };
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
  const hameauId = state.project.settings.hameaux[0]?.id;
  const c = createCharacter(name, hameauId);
  state.project.characters[c.id] = c;
  selectCharacter(c.id);
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
function showVariables() {
  const lines = state.project.settings.variables
    .map((v) => `• ${v.label}  ($${v.name}, ${v.type})`)
    .join("\n");
  alert("Variables partagées du projet :\n\n" + lines);
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
  renderSidebar();
  renderCanvas();
  renderInspector();
  renderValidation();
}

/* -------------------- init -------------------- */
document.getElementById("btn-export").onclick = exportYarn;
document.getElementById("btn-add-node").onclick = () => addNode(false);
document.getElementById("btn-add-hub").onclick = () => addNode(true);
refresh();
