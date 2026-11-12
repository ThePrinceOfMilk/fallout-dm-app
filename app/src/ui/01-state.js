// ===== 01-state.js: THE APP'S STATE. The workbook data, saving and loading, prefs, the ui object (what is open and selected),
// undo and redo (act), and the spectator screen's limits. Add new saved state here, and a default for old saves in normalize().
"use strict";
function clone0(o) {
  return JSON.parse(JSON.stringify(o));
}
// The dashboard: one state object, one render, one undo stack. Game math lives in engine.js, numbers in rules.js.
const DATA = JSON.parse(document.getElementById("data").textContent);
const WORKBOOK = clone0(DATA); // the untouched workbook, so an imported table can be put back
let db = E.makeDb(DATA);
let SKIPPED = [];
const SAVE_KEY = "fallout-dm-save-v1";
const PREF_KEY = "fallout-dm-prefs-v1";
const clone = (o) => JSON.parse(JSON.stringify(o));
const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v, d = null) => (v === "" || v == null || isNaN(Number(v)) ? d : Number(v));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = (x) => String(E.fix(Number(x) || 0));
const SKILL_NAME = Object.fromEntries(E.SKILLS.map(([k, n]) => [k, n]));
const SP_LABEL = { S: "STR", P: "PER", E: "END", C: "CHA", I: "INT", A: "AGL", L: "LCK" };

// ---------- state
function mergeRules(def, saved) {
  const out = clone(def);
  for (const k in saved || {}) {
    if (out[k] && typeof out[k] === "object" && !Array.isArray(out[k]) && saved[k] && typeof saved[k] === "object") out[k] = mergeRules(out[k], saved[k]);
    else out[k] = saved[k];
  }
  return out;
}
const freshScene = (r) => ({
  theme: r.sceneDefaults.theme,
  time: r.sceneDefaults.time,
  weather: r.sceneDefaults.weather,
  env: r.sceneDefaults.env,
  effects: [],
  npcs: [],
  pos: {},
  objects: [],
  map: null,
  checks: {},
  spawn: "",
});
function initChar(x, c) {
  const o = Object.assign(
    {
      kind: "pc",
      statuses: [],
      effects: [],
      ov: {},
      evolved: {},
      activeW: 0,
      ptsBank: 0,
      timesRevived: 0,
      dbno: false,
      notes: "",
      perks: [],
      spent: {},
      variants: [],
      inv: [],
      caps: 0,
      xp: 0,
      level: 1,
      tags: [],
      traits: ["", "", ""],
      background: "",
      spec: "",
      superCrit: null,
      weapons: [],
      gear: {},
    },
    x,
  );
  const g = o.gear;
  const clean = (n) => (/^\(no /i.test(n || "") ? "" : n || "");
  o.gear = { head: clean(g.head), armor: clean(g.armor), vanity: clean(g.vanity), acc: [0, 1, 2].map((i) => clean((g.acc || [])[i])) };
  for (const sl of o.weapons) {
    const w = E.get(c, sl.n);
    if (w && sl.mag == null) sl.mag = w.o.mag || 0;
  }
  const d = E.derive(o, c);
  if (o.hp == null) o.hp = d.hp;
  if (o.ap == null) o.ap = d.ap;
  return o;
}
function fresh() {
  const rules = mergeRules(DEFAULT_RULES, { lootTable: clone(DATA.loot) });
  const s = {
    v: 1,
    rules,
    chars: [],
    npcs: [],
    overrides: {},
    scene: freshScene(rules),
    combat: null,
    log: [],
    seq: 1,
    notesList: [],
    rulesRev: 3,
    tables: {},
    tableRev: 0,
    vendor: { tier: 1, barter: 50, stock: null },
    customMaps: {},
  };
  s.chars = clone(DATA.party).map((x) => initChar(x, { db, rules, scene: s.scene, ov: s.overrides }));
  return s;
}
// The log keeps its last LOG_KEEP lines, and only the newest LOG_DETAIL keep their fold-out detail (no window shows older ones).
const LOG_KEEP = 2000,
  LOG_DETAIL = 100;
function trimLog(s) {
  const L = s.log;
  if (L.length > LOG_KEEP) L.splice(0, L.length - LOG_KEEP);
  for (let i = 0; i < L.length - LOG_DETAIL; i++)
    if (L[i].more || L[i].id != null) {
      delete L[i].more;
      delete L[i].id;
    }
}
function normalize(p) {
  if (!p || !Array.isArray(p.chars)) throw new Error("That file is not a Fallout DM save.");
  p.rules = mergeRules(DEFAULT_RULES, p.rules);
  if (!p.rules.lootTable) p.rules.lootTable = clone(DATA.loot);
  p.npcs = p.npcs || [];
  p.overrides = p.overrides || {};
  p.log = p.log || [];
  p.seq = p.seq || 1;
  p.notesList = p.notesList || [];
  p.tables = p.tables || {};
  p.customMaps = p.customMaps || {};
  for (const k of Object.keys(p.tables)) if (Array.isArray(WORKBOOK[k]) && Array.isArray(p.tables[k])) p.tables[k] = shrinkTable(k, p.tables[k]); // older saves held every row
  p.tableRev = p.tableRev || 0;
  if (p.notes) {
    p.notesList.push({ id: "nt" + p.seq++, subject: "", text: p.notes, at: Date.now() });
    delete p.notes;
  }
  if ((p.rulesRev || 0) < 2) {
    p.rules.perPenalty = 0;
    p.rules.strGun = 0;
    p.rules.strMelee = 0;
    p.rulesRev = 2;
  } // accuracy became skill and weapon only
  if (p.rulesRev < 3) {
    // 12 Nov: aiming costs no AP (the part changes the odds and the damage), and familiarity bands carry their bonuses
    p.rules.loc = clone(DEFAULT_RULES.loc);
    delete p.rules.targetAP;
    p.rules.famBands = clone(DEFAULT_RULES.famBands);
    p.rules.checkTiers = clone(DEFAULT_RULES.checkTiers);
    p.rules.checkFailCut = clone(DEFAULT_RULES.checkFailCut);
    p.rules.checkPassCut = clone(DEFAULT_RULES.checkPassCut);
    p.rules.creatureIcons = clone(DEFAULT_RULES.creatureIcons); // the new creature and robot icons
    p.rulesRev = 3;
  }
  p.vendor = p.vendor || { tier: 1, barter: 50, stock: null };
  for (const c of p.chars) c.inv = (c.inv || []).filter((l) => !/^\(no /i.test(l.n));
  trimLog(p); // shrinks saves made before the log had a working cap
  p.scene = Object.assign(freshScene(p.rules), p.scene || {});
  delete p.scene.picks;
  if (p.combat)
    for (const c of p.combat.cbs)
      if (c.x == null) {
        c.x = c.pos || 0;
        c.y = 0;
      } // saves from before the map
  // shortcut: a fight saved on the old ring map opens on a plain 24m square with its old numbers as meters, so ranges shift until tokens are moved.
  if (!p.scene.map && (p.combat || Object.keys(p.scene.pos).length)) p.scene.map = { id: "custom", n: "Custom size", w: 24, h: 24 };
  // A hand-edited or cut-down save can leave fields off a character. Fill them in, or the first screen that reads one fails.
  p.chars = p.chars.map((c) =>
    initChar({ name: "Unnamed", special: Array(7).fill(5), ...c, id: c.id || "c" + p.seq++ }, { db, rules: p.rules, scene: p.scene, ov: p.overrides }),
  );
  return p;
}
function readJson(k) {
  try {
    return JSON.parse(localStorage.getItem(k));
  } catch (e) {
    return null;
  }
}
const prefs = Object.assign(
  { autosave: true, interval: 0, face: "term", scan: true, partyW: 270, enemyW: 230, mapW: null, bottomH: 190, bottomFight: 120, slot: null },
  readJson(PREF_KEY) || {},
);
function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch (e) {
    /* prefs are a convenience */
  }
}
// Rebuilds the game's data: workbook tables, then any table imported in this campaign, then effects as variables.
let dataRev = null;
// The workbook's own tables after standardizing: what a table looks like with no edits.
let packBase = null;
function baseTable(k) {
  if (!packBase) {
    packBase = clone0(WORKBOOK);
    E.standardize(packBase, DEFAULT_RULES);
  }
  return packBase[k];
}
// An imported table is saved as its differences: a row the workbook already has is kept as just its name, anything else in full.
// Names that appear twice in the workbook are always kept in full, so a name never points at the wrong row.
const rowSig = (r) =>
  JSON.stringify(
    Object.keys(r)
      .filter((k) => r[k] != null && r[k] !== "")
      .sort()
      .map((k) => [k, r[k]]),
  );
function shrinkTable(k, rows) {
  const sig = new Map(),
    twice = new Set();
  for (const r of baseTable(k) || []) {
    const n = E.low(r.n);
    if (sig.has(n)) twice.add(n);
    sig.set(n, rowSig(r));
  }
  return rows.map((r) => (typeof r === "string" || twice.has(E.low(r.n)) || sig.get(E.low(r.n)) !== rowSig(r) ? r : r.n));
}
function growTable(k, rows) {
  const by = new Map((baseTable(k) || []).map((r) => [E.low(r.n), r]));
  return rows.map((r) => (typeof r === "string" ? by.get(E.low(r)) : r)).filter(Boolean);
}
function applyData() {
  dataRev = S.tableRev || 0;
  for (const k of Object.keys(WORKBOOK)) DATA[k] = clone0(S.tables && S.tables[k] ? growTable(k, S.tables[k]) : WORKBOOK[k]);
  for (const t of DATA.traits) t.code = String(t.code).padStart(3, "0"); // a spreadsheet turns "007" into 7
  SKIPPED = E.standardize(DATA, S.rules);
  db = E.makeDb(DATA);
  if (document.getElementById("lists")) fillLists();
}
let S =
  (() => {
    try {
      const p = readJson(SAVE_KEY);
      return p ? normalize(p) : null;
    } catch (e) {
      return null;
    }
  })() || fresh();
let dirty = false,
  lastSaved = null,
  saveFailed = false,
  lastSaveTry = Date.now();
function saveStatus() {
  const el = document.getElementById("railSave");
  if (el) el.classList.toggle("dirty", dirty);
  const st = document.getElementById("saveStat");
  if (st) st.textContent = statusText();
}
const statusText = () =>
  (table.on ? (table.up ? `TABLE: ${table.n} CONNECTED / ` : "TABLE: RECONNECTING / ") : "") +
  (saveFailed ? "SAVE FAILED: USE BACKUP FILE" : dirty ? "UNSAVED CHANGES" : lastSaved ? "SAVED " + lastSaved.toLocaleTimeString() : "NOTHING NEW TO SAVE");
function save() {
  if (isSpec()) return; // a spectator's own campaign on this device stays as it was
  if (tut) return; // the tour plays on a practice campaign; the real one is never overwritten by it
  lastSaveTry = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    saveFailed = false;
    dirty = false;
    lastSaved = new Date();
  } catch (e) {
    saveFailed = true;
  }
  saveStatus();
}
// Shared table (app/table_server.js): on only when the page is served by it. Everything else is at the end of this file.
const table = {
  on: false,
  up: false,
  n: 0,
  rev: 0,
  id: Math.random().toString(36).slice(2),
  t: "",
  links: [],
  base: "",
  timer: null,
  busy: false,
  again: false,
  pending: null,
  quiet: false,
  // "dm" or "spec". A spectator link carries v=s, so the right screen shows before the server answers; hello confirms it.
  role: new URLSearchParams(location.search).get("v") === "s" ? "spec" : "dm",
  specLinks: [],
  gotState: false,
};
const isSpec = () => table.role === "spec";

// ---------- spectator screen: the map, the party (look, use consumables, equip and unequip) and the combat log. Nothing else.
// A spectator never writes the game: use and equip go to the DM's screens as asks (tableAsk), and a DM screen applies them once.
const SPEC_UI = new Set([
  "openChar",
  "sheetTab",
  "invTab",
  "invSort",
  "invDir",
  "gearSlot",
  "useItemFrom",
  "itemPick",
  "closeModal",
  "noop",
  "treeTab",
  "treeZoom",
  "treeSkill",
  "railGo",
  "railMore",
  "mapZoom",
  "legendToggle",
  "fold",
  "toggleLog",
  "setScale",
  "guideGo",
  "setSpStyle",
  "setRingOp",
  "spendPts",
  "venTab",
]);
// A player's own things, done on their screen at once: use, equip, ammo, drop, reload, level up, skill points, perks, and the vendor when it's public.
const SPEC_ASK = new Set(["useSelf", "itemUse", "gearEquip", "invActive", "invDel", "reloadSlot", "levelUp", "spend", "levelPerk", "venBuy", "venSell"]);
const SPEC_ASK_C = new Set(["setLoad"]); // the same, for a drop-down
const SPEC_RAIL = ["log", "skillTree", "wiki", "uiScale", "guide"];
const SPEC_MODALS = new Set(["char", "sheet", "health", "item", "skillTree", "uiScale", "guide", "level", "vendor"]);
const specRail = () => [...SPEC_RAIL, ...(S.vendor && S.vendor.public ? ["vendor"] : [])];
// The Inventory, Character and Health buttons, and the level-up banner, shared by the small card and the big party board.
const specMenus = (c) =>
  CARD_MENUS.map(([id, n, ic]) => `<button class="icb" data-a="openChar" data-v="${c.id}|${id}" title="${n}">${pix(ic)}<span>${n}</span></button>`).join("");
function specLevel(c) {
  const due = (c.ptsBank || 0) > 0 || (c.perkDue || 0) > 0;
  return canLevel(c)
    ? `<div class="banner s">${btn("levelUp", c.id, `Level up to ${c.level + 1}`, "", "primary tiny")}</div>`
    : due
      ? `<div class="banner s">${btn("spendPts", c.id, `Assign: ${c.ptsBank ? `${c.ptsBank} skill points` : ""}${c.ptsBank && c.perkDue ? " + " : ""}${c.perkDue ? `${c.perkDue} perk` : ""}`, "", "primary tiny")}</div>`
      : "";
}
function specCard(c) {
  const d = der(c);
  const k = K();
  const menus = specMenus(c);
  const lvl = specLevel(c);
  return `<article class="card spcard ${c.dbno ? "down" : ""} ${k && k.turnId === c.id ? "cur" : ""}"><header class="chead">${iconSvg(c.icon)}<span class="nm grow">${h(c.name)}</span><span class="s dim">LV${c.level}</span></header><div class="hpline"><span>HP</span><b>${fmt(c.hp)}/${fmt(d.hp)}</b><span class="grow">${hpBar(c.hp, d.hp)}</span><span>AP</span><b>${fmt(c.ap)}/${fmt(d.ap)}</b></div>${chips(c, true)}${lvl}<div class="icons">${menus}</div></article>`;
}
// THE SPECTATOR'S PARTY BOARD. The map stays hidden until the DM reaches the initiative screen, so the setup and the
// sneaking phase give nothing away. Its space shows each member large enough to read and tap on a tablet: health, level
// and XP, SPECIAL, what they have equipped, and their active items (at most SPEC_BOARD_ITEMS, then "+N more").
const SPEC_BOARD_ITEMS = 6;
const specMapShown = () => !!K() && K().phase !== "stealth";
function specMember(c) {
  const d = der(c);
  const L = c.level || 1,
    step = S.rules.levelXpStep,
    from = step * L * (L - 1),
    to = step * (L + 1) * L;
  const xpP = L >= S.rules.maxLevel ? 1 : clamp(((c.xp || 0) - from) / (to - from), 0, 1);
  const special = Object.entries(SP_LABEL)
    .map(([k, n]) => `<span class="spsp"><small>${n}</small><b>${fmt(d.sp[k])}</b></span>`)
    .join("");
  const g = c.gear || {};
  const worn = [
    ...(c.weapons || []).filter((w) => w && w.n).map((w) => ["W", w.n]),
    ...[g.head, g.armor, g.vanity, ...(g.acc || [])].filter(Boolean).map((n) => ["A", n]),
  ];
  const active = (c.inv || []).filter((l) => l.active && l.q > 0);
  const chip = ([kind, n]) => `<span class="spitem ${kind === "W" ? "w" : ""}">${h(n)}</span>`;
  const items = active
    .slice(0, SPEC_BOARD_ITEMS)
    .map((l) => `<span class="spitem">${h(l.n)}${l.q > 1 ? ` <small>x${l.q}</small>` : ""}</span>`)
    .join("");
  const more =
    active.length > SPEC_BOARD_ITEMS ? btn("openChar", `${c.id}|inv`, `+${active.length - SPEC_BOARD_ITEMS} more`, "See the whole inventory", "tiny") : "";
  return `<article class="spmember ${c.dbno ? "down" : ""}"><header class="spmhead">${iconSvg(c.icon)}<span class="nm grow">${h(c.name)}</span><span class="splv">LV ${L}</span></header>
    <div class="spmhp"><span class="lab">HP</span><b>${fmt(c.hp)}<small>/${fmt(d.hp)}</small></b><span class="grow">${hpBar(c.hp, d.hp)}</span></div>
    <div class="spline s"><span>AP <b>${fmt(c.ap)}/${fmt(d.ap)}</b></span><span>DT <b>${fmt(d.dt)}</b></span><span>Caps <b>${fmt(c.caps || 0)}</b></span></div>
    <div class="spxp s"><span>XP <b>${fmt(c.xp || 0)}</b>${L < S.rules.maxLevel ? ` <span class="dim">/ ${fmt(to)} for LV ${L + 1}</span>` : ""}</span><div class="bar xp"><i style="width:${xpP * 100}%"></i></div></div>
    <div class="spspecial">${special}</div>
    ${statusIcons(c)}${specLevel(c)}
    <div class="spsect"><span class="tl">Equipped</span><div class="spitems">${worn.map(chip).join("") || `<span class="s dim">Nothing equipped.</span>`}</div></div>
    <div class="spsect"><span class="tl">Active items</span><div class="spitems">${items || `<span class="s dim">None marked active.</span>`}${more}</div></div>
    <div class="icons">${specMenus(c)}</div></article>`;
}
function specBoard() {
  const wiki = `<button class="btn tiny" data-a="railGo" data-v="wiki" title="Open the game bible">Wiki</button>`;
  return `<section class="win w-map spmap spboardwin"><header class="wt"><span>Party<span class="dim"> · the map shows when the fight starts</span></span><span class="spacer"></span>${wiki}<span class="s ${table.up ? "dim" : "warn"}">${table.up ? "Spectating" : "Reconnecting..."}</span></header><div class="wb" data-scroll="spboard"><div class="spmembers">${S.chars.map(specMember).join("") || `<div class="empty">No characters yet.</div>`}</div></div></section>`;
}
function specView() {
  if (ui.modal && !SPEC_MODALS.has(ui.modal.type)) ui.modal = null;
  ui.atk = null; // no targeting of their own; the DM's aim and queued move come in S.live and are drawn by mapSvg
  ui.pendingMove = S.live && S.live.move && ent(S.live.move.id) ? S.live.move : null;
  if (!table.gotState)
    return `<div class="dash spec"><div class="spwait"><b>Spectating</b><span>${table.up ? "Waiting for the DM's game..." : "Connecting to the game..."}</span></div></div>`;
  ensureMap();
  partySpots();
  applySizes();
  const k = K();
  const M = mapOf();
  const turn = k && k.turnId && ent(k.turnId) ? ` · Round ${k.round} · ${h(ent(k.turnId).name)}'s turn` : k ? ` · Round ${k.round}` : "";
  const map = !specMapShown()
    ? specBoard()
    : `<section class="win w-map spmap"><header class="wt"><span>${h(M.n)}<span class="dim">${turn}</span></span><span class="spacer"></span><span class="s ${table.up ? "dim" : "warn"}">${table.up ? "Spectating" : "Reconnecting..."}</span></header><div class="wb" style="padding:0">${mapSvg()}</div></section>`;
  const party = win(
    "w-party",
    `Party ${S.chars.length}`,
    "",
    `<div class="cards">${S.chars.map(specCard).join("") || `<div class="empty">No characters yet.</div>`}</div>`,
  );
  const log = win(
    "w-clog",
    "Combat log",
    "",
    `<div class="loglist">${logLines(
      S.log.filter((l) => l.r > 0),
      40,
    )}</div>`,
  );
  const board = !specMapShown();
  const foesNow = board
    ? []
    : (k ? k.cbs.filter((c) => sideOf(c.id) === "npc" && alive(c)).map((c) => ent(c.id)) : foes().filter((e) => !e.ally)).filter(Boolean);
  const enemies = foesNow.length
    ? win(
        "w-spfoes",
        `Enemies ${foesNow.length}`,
        "",
        `<div class="spfoes">${foesNow.map((e) => `<div class="spfoe">${iconSvg(iconOf(e))}<span class="grow">${h(e.name)}</span><span class="spfhp">${hpBar(e.hp, der(e).hp)}</span></div>${statusIcons(e)}`).join("")}</div>`,
      )
    : "";
  const rail = `<nav class="sprail">${specRail()
    .map((id) => {
      const r = RAIL.find((x) => x[0] === id);
      return `<button class="railb ${(ui.modal && ui.modal.type === id) || (id === "log" && ui.logOpen) ? "on" : ""}" data-a="railGo" data-v="${id}" title="${h(RAIL_TITLE[id] || r[1])}">${pix(r[2])}<span>${r[1]}</span></button>`;
    })
    .join("")}</nav>`;
  return `<div class="dash spec"><div class="spboard ${board ? "noside" : ""}">${board ? "" : `<aside class="spcol">${party}${enemies}${log}</aside>`}${map}${rail}</div>${ui.logOpen ? logFloat() : ""}${ui.modal ? renderModal() : ""}</div>`;
}
// After drawing: boxes a spectator can't change are read-only, and buttons it can't use are hidden.
const SPEC_HIDE = [
  ".isort",
  ".geartop > .s.dim",
  'input[placeholder^="Add item"]',
  '.line:has(input[placeholder^="Add status"])',
  ".famedit",
  ".irow .grow > .s.dim",
  ".geartop > .grow",
  ".hpline .ovr",
];
function specLock() {
  for (const el of document.querySelectorAll(SPEC_HIDE.map((s) => ".dash.spec " + s).join(","))) el.remove();
  for (const el of document.querySelectorAll(".dash.spec input, .dash.spec select, .dash.spec textarea")) {
    if (el.dataset.u || el.dataset.a === "invActive" || SPEC_UI.has(el.dataset.c) || SPEC_ASK_C.has(el.dataset.c)) continue;
    if (el.tagName === "INPUT" && el.type !== "checkbox") el.readOnly = true;
    else el.disabled = true;
  }
  for (const el of document.querySelectorAll(".dash.spec [data-a]"))
    if (!SPEC_UI.has(el.dataset.a) && !SPEC_ASK.has(el.dataset.a) && !el.classList.contains("scrim") && !el.classList.contains("dialog"))
      el.classList.add("specoff");
}
// A player's action on a spectator screen. It is done on this screen at once (applyAsk, locally), and the same action goes to the
// DM's screens, which make it with the same checks and send the game back. The DM doesn't have to do anything.
async function tableAsk(a, el) {
  const m = ui.modal || {};
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ask = { a, v: el.dataset.v };
  const invName = (who, i) => (((ent(who) || {}).inv || [])[i] || {}).n;
  if (["useSelf", "invActive", "invDel"].includes(a)) {
    const [who, i] = splitV(el.dataset.v);
    ask.n = invName(who, i);
    if (!ask.n) return;
    if (a === "invActive") ask.on = !!el.checked;
  } else if (a === "reloadSlot") {
    const [who, i] = splitV(el.dataset.v);
    ask.n = (((ent(who) || {}).weapons || [])[i] || {}).n;
  } else if (a === "itemUse") {
    Object.assign(ask, { who: m.who, tgt: m.tgt, sel: m.sel, n: invName(m.who, m.sel) });
    if (!ask.n) return;
  } else if (a === "gearEquip") {
    if (!m.id || !m.pick) return;
    Object.assign(ask, { id: m.id, slot: m.pick, name: el.dataset.v || "" });
  } else if (a === "setLoad") {
    Object.assign(ask, { who: el.dataset.id, i: el.dataset.i, val: el.value });
  } else if (a === "venBuy") {
    Object.assign(ask, { who: ui.sel, n: ((S.vendor.stock || [])[Number(el.dataset.v)] || {}).n });
  } else if (a === "venSell") {
    Object.assign(ask, { who: ui.sel, n: invName(ui.sel, Number(el.dataset.v)) });
  }
  applyAsk({ ...ask, id: "here-" + id }, true); // at once, on this screen
  render();
  try {
    const r = await fetch(tableUrl("ask"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ask, id, from: table.id }),
    });
    if (!r.ok) toast("The DM's game didn't take that. It goes back when the game updates.");
  } catch (e) {
    toast("Not connected. That goes back when the game updates; try again in a moment.");
  }
}
// Apply a player's action once, with the checks a player's screen can't skip: only party members, only what they carry or qualify for,
// and the vendor only while the DM has it open to players. On a DM screen the ask's id goes into the game, so a repeat is skipped.
function applyAsk(q, here) {
  if (!q || !q.id || (S.asksDone || []).includes(q.id)) return;
  const pc = (id) => {
    const e = ent(id);
    return e && e.kind === "pc" ? e : null;
  };
  const at = (e, i, n) => (e.inv[i] && E.low(e.inv[i].n) === E.low(n) ? i : (e.inv || []).findIndex((x) => E.low(x.n) === E.low(n))); // the list may have moved
  const keep = ui.modal,
    keepSel = ui.sel;
  if (!here) S.asksDone = [...(S.asksDone || []).slice(-49), q.id];
  try {
    if (["useSelf", "invActive", "invDel"].includes(q.a)) {
      const [who, i0] = splitV(q.v);
      const e = pc(who);
      const i = e ? at(e, Number(i0), q.n) : -1;
      if (i < 0) return;
      if (q.a === "useSelf") ACT.useSelf(`${who}|${i}`);
      else if (q.a === "invDel") ACT.invDel(`${who}|${i}`);
      else ACT.invActive(`${who}|${i}`, { checked: !!q.on });
    } else if (q.a === "reloadSlot") {
      const [who, i] = splitV(q.v);
      const e = pc(who);
      if (e && e.weapons[i] && e.weapons[i].n === q.n) ACT.reloadSlot(q.v);
    } else if (q.a === "itemUse") {
      const A = pc(q.who);
      const i = A ? at(A, Number(q.sel), q.n) : -1;
      if (i < 0) return;
      ui.modal = { type: "item", who: q.who, tgt: ent(q.tgt) ? q.tgt : q.who, sel: i, back: here && keep ? keep.back : null };
      ACT.itemUse();
    } else if (q.a === "gearEquip") {
      const e = pc(q.id);
      if (!e || !GEAR_ASK_SLOT.test(String(q.slot))) return;
      if (q.name && !(e.inv || []).some((x) => E.low(x.n) === E.low(q.name))) return; // only what they carry
      ui.modal = here && keep && keep.type === "char" ? keep : { type: "char", id: q.id, pick: q.slot };
      ui.modal.pick = q.slot;
      ACT.gearEquip(q.name);
    } else if (q.a === "setLoad") {
      const e = pc(q.who);
      const s = e && e.weapons[Number(q.i)];
      if (!s) return;
      if (q.val && !loadsHeld(e, E.weaponView(s, e, der(e), ctx()), s).some((x) => x.n === q.val)) return; // only ammo they carry
      ACT.setLoad(q.val, { dataset: { id: q.who, i: q.i } });
    } else if (q.a === "levelUp") {
      const e = pc(q.v);
      if (e && canLevel(e)) ACT.levelUp(q.v);
    } else if (q.a === "spend") {
      if (pc(splitV(q.v)[0])) ACT.spend(q.v);
    } else if (q.a === "levelPerk") {
      const [id, n, kind] = splitV(q.v);
      const e = pc(id);
      if (!e || (e.perks || []).some((p) => E.low(p) === E.low(n))) return;
      const d = der(e);
      const ok =
        kind === "level"
          ? (e.perkDue || 0) > 0 && DATA.levelPerks.some((p) => E.low(p.n) === E.low(n) && num(p.level) <= e.level && reqMet((perkInfo(p.n) || p).req, d))
          : DATA.skillPerks.some((p) => E.low(p.n) === E.low(n) && (d.skills[(E.SKILLS.find(([, g]) => g === p.group) || [])[0]] || 0) > p.need);
      if (ok) ACT.levelPerk(q.v);
    } else if (q.a === "venBuy" || q.a === "venSell") {
      if (!S.vendor.public || !pc(q.who)) return;
      ui.sel = q.who;
      const list = q.a === "venBuy" ? S.vendor.stock || [] : ent(q.who).inv || [];
      const i = list[Number(q.v)] && E.low(list[Number(q.v)].n) === E.low(q.n) ? Number(q.v) : list.findIndex((x) => E.low(x.n) === E.low(q.n));
      if (i >= 0) ACT[q.a](String(i));
    }
  } finally {
    if (!here) ui.modal = keep; // on the player's own screen the action leaves its window where it should be (the level window, say)
    if (!here || q.a.startsWith("ven")) ui.sel = keepSel;
    if (!here) touched();
    scheduleRender();
  }
}
const GEAR_ASK_SLOT = /^(w\d+|head|vanity|armor|acc[0-2])$/;
function touched() {
  dirty = true;
  if (table.on && !table.quiet && !isSpec()) tableSend();
  if (prefs.autosave && !prefs.interval) save();
  else saveStatus();
}
setInterval(() => {
  if (prefs.autosave && prefs.interval && dirty && Date.now() - lastSaveTry >= prefs.interval * 1000) save();
}, 1000);
window.addEventListener("beforeunload", (e) => {
  if (!dirty) return;
  if (prefs.autosave) save();
  else {
    e.preventDefault();
    e.returnValue = "";
  }
});

const ui = {
  setup: null,
  venTab: "buy",
  wiz: null,
  guide: 0,
  atkOv: false,
  noteId: null,
  sel: (S.chars[0] || {}).id,
  open: {},
  modal: null,
  atk: null,
  focus: null,
  rowSel: null,
  end: null,
  def: null,
  enemyQ: "",
  enemyTier: "",
  fxLabel: "",
  fxWho: "enemies",
  fxHit: "",
  chk: { use: "SPE", target: 40, rolls: {}, res: {}, xp: "", revive: null },
  brCat: "All",
  brSub: "",
  brQ: "",
  brTier: "",
  brSort: "n",
  brDir: 1,
  brOpen: null,
  logOpen: false,
  place: null,
  mapSel: null,
  dlg: {},
  pw: { act: "addItem", name: "", val: 1, tier: 1, who: {} },
};
const undoStack = [],
  redoStack = [];
let deferRender = false,
  pointerDown = false,
  pendingRender = false;
function scheduleRender() {
  if (pointerDown) {
    pendingRender = true;
    return;
  }
  if (deferRender) {
    setTimeout(render, 0);
    return;
  }
  render();
}
// Undo keeps whole-campaign snapshots, so it is capped by size as well as count: a long campaign was reaching ~580 MB.
const UNDO_MAX = 300,
  UNDO_CHARS = 25e6;
let undoChars = 0;
function pushUndo(label) {
  const snap = JSON.stringify(S);
  undoStack.push({ label, snap });
  undoChars += snap.length;
  while (undoStack.length > 1 && (undoStack.length > UNDO_MAX || undoChars > UNDO_CHARS)) undoChars -= undoStack.shift().snap.length;
}
function act(label, fn) {
  if (actBatch) return fn(); // inside an automated turn: one undo step for all of it
  pushUndo(label);
  redoStack.length = 0;
  fn();
  trimLog(S);
  touched();
  scheduleRender();
}
function afterTimeTravel() {
  ui.autoPlan = null;
  ui.modal = null;
  ui.end = null;
  ui.def = null;
  ui.pendingMove = null;
  if (!S.combat) ui.atk = null;
  if (ui.atk) {
    ui.atk.res = null;
    ui.atk.err = "";
    if (!ent(ui.atk.att) || !ent(ui.atk.tgt)) ui.atk = null;
  }
  touched();
  render();
}
function undo() {
  const u = undoStack.pop();
  if (!u) return toast("Nothing to undo");
  undoChars -= u.snap.length;
  redoStack.push({ label: u.label, snap: JSON.stringify(S) });
  S = JSON.parse(u.snap);
  afterTimeTravel();
  toast("Undid: " + u.label);
}
function redo() {
  const u = redoStack.pop();
  if (!u) return toast("Nothing to redo");
  pushUndo(u.label);
  S = JSON.parse(u.snap);
  afterTimeTravel();
  toast("Redid: " + u.label);
}
function log(k, x) {
  S.log.push({ k, x, r: S.combat ? S.combat.round : 0 });
}
let toastTimer;
function toast(t) {
  const el = document.getElementById("toast");
  el.textContent = t;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

const ctx = () => ({ db, rules: S.rules, scene: S.scene, ov: S.overrides, combat: !!S.combat });
const der = (e) => E.derive(e, ctx());
const ent = (id) => S.chars.find((c) => c.id === id) || (S.combat && S.combat.npcs.find((n) => n.id === id)) || S.scene.npcs.find((n) => n.id === id) || null;
const foes = () => (S.combat ? S.combat.npcs : S.scene.npcs);
const K = () => S.combat;
const cbOf = (id) => (S.combat ? S.combat.cbs.find((c) => c.id === id) : null);
const setPath = (o, path, v) => {
  const p = path.split(".");
  let x = o;
  for (let i = 0; i < p.length - 1; i++) {
    if (x[p[i]] == null) x[p[i]] = {};
    x = x[p[i]];
  }
  x[p[p.length - 1]] = v;
};
const getPath = (o, path) => path.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
