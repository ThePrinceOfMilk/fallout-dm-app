"use strict";
function clone0(o) { return JSON.parse(JSON.stringify(o)); }
// The dashboard: one state object, one render, one undo stack. Game math lives in engine.js, numbers in rules.js.
const DATA = JSON.parse(document.getElementById("data").textContent);
const WORKBOOK = clone0(DATA);  // the untouched workbook, so an imported table can be put back
let db = E.makeDb(DATA);
let SKIPPED = [];
const SAVE_KEY = "fallout-dm-save-v1";
const PREF_KEY = "fallout-dm-prefs-v1";
const clone = (o) => JSON.parse(JSON.stringify(o));
const h = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
const freshScene = (r) => ({ theme: r.sceneDefaults.theme, time: r.sceneDefaults.time, weather: r.sceneDefaults.weather, env: r.sceneDefaults.env, effects: [], npcs: [], pos: {}, objects: [], map: null, checks: {} });
function initChar(x, c) {
  const o = Object.assign({ kind: "pc", statuses: [], effects: [], ov: {}, evolved: {}, activeW: 0, ptsBank: 0, timesRevived: 0, dbno: false, notes: "", perks: [], spent: {}, variants: [], inv: [], caps: 0, xp: 0, level: 1, tags: [], traits: ["", "", ""], background: "", spec: "", superCrit: null, weapons: [], gear: {} }, x);
  const g = o.gear; const clean = (n) => (/^\(no /i.test(n || "") ? "" : n || "");
  o.gear = { head: clean(g.head), armor: clean(g.armor), vanity: clean(g.vanity), acc: [0, 1, 2].map((i) => clean((g.acc || [])[i])) };
  for (const sl of o.weapons) { const w = E.get(c, sl.n); if (w && sl.mag == null) sl.mag = w.o.mag || 0; }
  const d = E.derive(o, c);
  if (o.hp == null) o.hp = d.hp;
  if (o.ap == null) o.ap = d.ap;
  return o;
}
function fresh() {
  const rules = mergeRules(DEFAULT_RULES, { lootTable: clone(DATA.loot) });
  const s = { v: 1, rules, chars: [], npcs: [], overrides: {}, scene: freshScene(rules), combat: null, log: [], seq: 1, notesList: [], rulesRev: 2, tables: {}, tableRev: 0, vendor: { tier: 1, barter: 50, stock: null } };
  s.chars = clone(DATA.party).map((x) => initChar(x, { db, rules, scene: s.scene, ov: s.overrides }));
  return s;
}
function normalize(p) {
  if (!p || !Array.isArray(p.chars)) throw new Error("That file is not a Fallout DM save.");
  p.rules = mergeRules(DEFAULT_RULES, p.rules);
  if (!p.rules.lootTable) p.rules.lootTable = clone(DATA.loot);
  p.npcs = p.npcs || []; p.overrides = p.overrides || {}; p.log = p.log || []; p.seq = p.seq || 1; p.notesList = p.notesList || [];
  p.tables = p.tables || {}; p.tableRev = p.tableRev || 0;
  if (p.notes) { p.notesList.push({ id: "nt" + p.seq++, subject: "", text: p.notes, at: Date.now() }); delete p.notes; }
  if ((p.rulesRev || 0) < 2) { p.rules.perPenalty = 0; p.rules.strGun = 0; p.rules.strMelee = 0; p.rulesRev = 2; }  // accuracy became skill and weapon only
  p.vendor = p.vendor || { tier: 1, barter: 50, stock: null };
  for (const c of p.chars) c.inv = (c.inv || []).filter((l) => !/^\(no /i.test(l.n));
  p.scene = Object.assign(freshScene(p.rules), p.scene || {});
  delete p.scene.picks;
  if (p.combat) for (const c of p.combat.cbs) if (c.x == null) { c.x = c.pos || 0; c.y = 0; }  // saves from before the map
  // shortcut: a fight saved on the old ring map opens on a plain 24m square with its old numbers as meters, so ranges shift until tokens are moved.
  if (!p.scene.map && (p.combat || Object.keys(p.scene.pos).length)) p.scene.map = { id: "custom", n: "Custom size", w: 24, h: 24 };
  return p;
}
function readJson(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
const prefs = Object.assign({ autosave: true, interval: 0, face: "term", scan: true, partyW: 270, enemyW: 230, mapW: null, bottomH: 190, bottomFight: 120, slot: null }, readJson(PREF_KEY) || {});
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* prefs are a convenience */ } }
// Rebuilds the game's data: workbook tables, then any table imported in this campaign, then effects as variables.
let dataRev = null;
function applyData() {
  dataRev = S.tableRev || 0;
  for (const k of Object.keys(WORKBOOK)) DATA[k] = clone0((S.tables && S.tables[k]) || WORKBOOK[k]);
  SKIPPED = E.standardize(DATA, S.rules);
  db = E.makeDb(DATA);
  if (document.getElementById("lists")) fillLists();
}
let S = (() => { try { const p = readJson(SAVE_KEY); return p ? normalize(p) : null; } catch (e) { return null; } })() || fresh();
let dirty = false, lastSaved = null, saveFailed = false, lastSaveTry = Date.now();
function saveStatus() { const el = document.getElementById("railSave"); if (el) el.classList.toggle("dirty", dirty); const st = document.getElementById("saveStat"); if (st) st.textContent = statusText(); }
const statusText = () => (saveFailed ? "SAVE FAILED: USE BACKUP FILE" : dirty ? "UNSAVED CHANGES" : lastSaved ? "SAVED " + lastSaved.toLocaleTimeString() : "NOTHING NEW TO SAVE");
function save() { lastSaveTry = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); saveFailed = false; dirty = false; lastSaved = new Date(); } catch (e) { saveFailed = true; } saveStatus(); }
function touched() { dirty = true; if (prefs.autosave && !prefs.interval) save(); else saveStatus(); }
setInterval(() => { if (prefs.autosave && prefs.interval && dirty && Date.now() - lastSaveTry >= prefs.interval * 1000) save(); }, 1000);
window.addEventListener("beforeunload", (e) => { if (!dirty) return; if (prefs.autosave) save(); else { e.preventDefault(); e.returnValue = ""; } });

const ui = { setup: null, venTab: "buy", wiz: null, guide: 0, atkOv: false, noteId: null, sel: (S.chars[0] || {}).id, open: {}, modal: null, atk: null, focus: null, rowSel: null, end: null, def: null, enemyQ: "", enemyTier: "", fxLabel: "", fxWho: "enemies", fxHit: "", chk: { use: "SPE", target: 40, rolls: {}, res: {}, xp: "", revive: null }, brCat: "All", brQ: "", brTier: "", brSort: "n", brDir: 1, brOpen: null, logOpen: false, place: null, mapSel: null, dlg: {}, pw: { act: "addItem", name: "", val: 1, tier: 1, who: {} } };
const undoStack = [], redoStack = [];
let deferRender = false, pointerDown = false, pendingRender = false;
function scheduleRender() {
  if (pointerDown) { pendingRender = true; return; }
  if (deferRender) { setTimeout(render, 0); return; }
  render();
}
function act(label, fn) {
  undoStack.push({ label, snap: JSON.stringify(S) });
  if (undoStack.length > 300) undoStack.shift();
  redoStack.length = 0;
  fn();
  touched();
  scheduleRender();
}
function afterTimeTravel() {
  ui.modal = null; ui.end = null; ui.def = null; ui.pendingMove = null;
  if (!S.combat) ui.atk = null;
  if (ui.atk) { ui.atk.res = null; ui.atk.err = ""; if (!ent(ui.atk.att) || !ent(ui.atk.tgt)) ui.atk = null; }
  touched(); render();
}
function undo() { const u = undoStack.pop(); if (!u) return toast("Nothing to undo"); redoStack.push({ label: u.label, snap: JSON.stringify(S) }); S = JSON.parse(u.snap); afterTimeTravel(); toast("Undid: " + u.label); }
function redo() { const u = redoStack.pop(); if (!u) return toast("Nothing to redo"); undoStack.push({ label: u.label, snap: JSON.stringify(S) }); S = JSON.parse(u.snap); afterTimeTravel(); toast("Redid: " + u.label); }
function log(k, x) { S.log.push({ k, x, r: S.combat ? S.combat.round : 0 }); if (S.log.length > 3000) S.log.shift(); }
let toastTimer;
function toast(t) { const el = document.getElementById("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600); }

const ctx = () => ({ db, rules: S.rules, scene: S.scene, ov: S.overrides, combat: !!S.combat });
const der = (e) => E.derive(e, ctx());
const ent = (id) => S.chars.find((c) => c.id === id) || (S.combat && S.combat.npcs.find((n) => n.id === id)) || S.scene.npcs.find((n) => n.id === id) || null;
const foes = () => (S.combat ? S.combat.npcs : S.scene.npcs);
const K = () => S.combat;
const cbOf = (id) => (S.combat ? S.combat.cbs.find((c) => c.id === id) : null);
const setPath = (o, path, v) => { const p = path.split("."); let x = o; for (let i = 0; i < p.length - 1; i++) { if (x[p[i]] == null) x[p[i]] = {}; x = x[p[i]]; } x[p[p.length - 1]] = v; };
const getPath = (o, path) => path.split(".").reduce((x, k) => (x == null ? x : x[k]), o);

// ---------- small view helpers
const kbd = (k) => (k ? `<kbd>${h(k)}</kbd>` : "");
const SHOWN_KEYS = new Set(["A", "R", "M", "I", "N", "B", "Enter", "Esc", "/", "?"]);  // only the keys for what happens all the time
const btn = (a, v, label, key = "", cls = "", title = "") => `<button class="btn ${cls}" data-a="${a}" data-v="${h(v)}"${title ? ` title="${h(title)}"` : ""}>${SHOWN_KEYS.has(key) ? kbd(key) : ""}${label}</button>`;
const primary = (a, v, label, key = "") => `<button class="btn primary" data-primary="1" data-a="${a}" data-v="${h(v)}">${kbd(key)}${label}</button>`;
const small = () => matchMedia("(max-width: 1000px)").matches;
const win = (cls, title, key, body, opt = {}) => `<section class="win ${cls} ${opt.act ? "act" : ""} ${(prefs.fold || {})[cls] ? "folded" : ""}"><header class="wt" data-fold="${cls}"><button type="button" class="foldbtn" data-a="fold" data-v="${cls}" aria-label="${(prefs.fold || {})[cls] ? "Open" : "Fold"} ${h(String(title).replace(/<[^>]*>/g, ""))}" aria-expanded="${!(prefs.fold || {})[cls]}">${(prefs.fold || {})[cls] ? "+" : "-"}</button>${kbd(key)}<span>${title}</span><span class="spacer"></span>${opt.tools || ""}</header><div class="wb" data-scroll="${cls}">${body}</div></section>`;
function fold(k, title, body, opt = {}) {
  const open = ui.open[k] != null ? ui.open[k] : !!opt.open;
  return `<details class="fold" data-k="${h(k)}"${open ? " open" : ""}><summary>${kbd(opt.key)}<span>${title}</span>${opt.badge != null && opt.badge !== "" ? `<span class="fb">${opt.badge}</span>` : ""}</summary><div class="fbody">${open ? body : ""}</div></details>`;
}
function hpBar(cur, max) { const p = max > 0 ? clamp(cur / max, 0, 1) : 0; return `<div class="bar ${p <= 0.25 ? "low" : p <= 0.55 ? "mid" : ""}"><i style="width:${p * 100}%"></i></div>`; }
const field = (label, input) => `<label class="f">${label}${input}</label>`;
const numBox = (attrs, val, cls = "") => `<input type="text" inputmode="decimal" autocomplete="off" class="${cls}" ${attrs} value="${h(val == null ? "" : val)}">`;
const bindNum = (id, path, val, attrs = "", cls = "") => numBox(`data-t="num" data-bind="${id}:${path}" ${attrs}`, val, cls);
const bindText = (id, path, val, list = "", attrs = "") => `<input type="text" autocomplete="off" data-bind="${id}:${path}" value="${h(val == null ? "" : val)}"${list ? ` list="${list}"` : ""} ${attrs}>`;
const ovCell = (e, k, val, title) => numBox(`data-c="setOv" data-id="${e.id}" data-k="${k}" id="ov-${e.id}-${k}" title="${h(title)}. Type to override, clear to go back to automatic."`, val, `cell ${(e.ov || {})[k] != null && (e.ov || {})[k] !== "" ? "ovr" : ""}`);
const options = (list, cur) => list.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${h(v)}"${String(v) === String(cur) ? " selected" : ""}>${h(l)}</option>`; }).join("");
function chips(e) {
  const out = [];
  for (const st of e.statuses || []) { const i = E.statusInfo(ctx(), st); const tone = i.def && i.def.tone === "Positive" ? "pos" : i.def && i.def.tone === "Neutral" ? "neu" : ""; out.push(`<span class="chip ${tone}" title="${h(i.text)}">${h(st.n)}${st.tier > 1 ? " " + st.tier : ""}${st.parts ? ": " + st.parts.map((p) => PARTS[p][0]).join(", ") : ""}${st.turns != null ? ` (${st.turns})` : ""}</span>`); }
  for (const fx of e.effects || []) out.push(`<span class="chip neu" title="${h(fx.text || "")}">${h(fx.label)}${fx.turns != null ? ` (${fx.turns})` : ""}</span>`);
  return out.length ? `<div class="chips">${out.join("")}</div>` : "";
}

// ---------- data the DM can edit: workbook value + saved override
const traitV = (t) => (t ? { ...t, ...(S.overrides["trait:" + t.code] || {}) } : t);
const perkKey = (n) => "perk:" + E.low(n);
const perkInfo = (n) => { const p = DATA.levelPerks.find((x) => E.low(x.n) === E.low(n)) || DATA.skillPerks.find((x) => E.low(x.n) === E.low(n)); return p ? { ...p, ...(S.overrides[perkKey(n)] || {}) } : null; };
const enemyV = (t) => (t ? { ...t, ...(S.overrides["enemy:" + E.low(t.n)] || {}) } : t);
function setOverride(key, path, val, base) {
  const ov = (S.overrides[key] = S.overrides[key] || {});
  const root = path.split(".")[0];
  if (root !== path && ov[root] == null) ov[root] = clone((base || {})[root] != null ? base[root] : []);
  setPath(ov, path, val);
  if (base && base.tab) {  // a filled-in weapon counts as having stats
    const w = { ...base, ...ov };
    const need = w.tab === "MW" ? ["dmg", "ap"] : w.tab === "EW" || w.tab === "EX" ? ["dmg", "pen", "ap", "crit", "jam", "req"] : ["ap", "crit", "jam", "req", "count"];
    ov.ok = need.every((k) => w[k] != null) && (w.tab === "MW" || (w.hit && w.hit[0] != null));
  }
}

// ---------- shared game actions
function keepFull(e, fn) {
  const a = der(e);
  fn();
  const b = der(e);
  if (e.hp === a.hp || e.hp > b.hp) e.hp = b.hp;
  if (e.ap === a.ap || e.ap > b.ap) e.ap = b.ap;
}
function syncDown(e, killer) {
  if (e.kind === "pc") {
    const was = e.dbno; e.dbno = e.hp <= 0;
    if (e.dbno && !was) log("down", `${e.name} is down (DBNO).`);
  } else if (S.combat) {
    const cb = cbOf(e.id); if (!cb) return;
    if (e.hp <= 0 && !cb.dead) { cb.dead = true; cb.killer = killer || null; log("kill", `${e.name} is dead.`); }
    else if (e.hp > 0 && cb.dead) cb.dead = false;
  }
}
function addInv(e, name, q = 1, active = false) {
  const l = (e.inv = e.inv || []).find((x) => E.low(x.n) === E.low(name));
  if (l) l.q += q; else e.inv.push({ n: name, q, active });
}
// Applies a status from a drink or drug. The item's exact numbers ride along, and its after-effect waits for it to end.
function applySubstance(e, a, turns, after, itemName, text) {
  addStatus(e, a.n, a.tier, turns);
  const st = (e.statuses || []).find((x) => x.n === a.n); if (!st) return;
  if (a.fx) { st.fx = a.fx; st.text = text; } else { delete st.fx; delete st.text; }
  st.from = itemName; if (after) st.after = after; else delete st.after;
}
// A substance wore off: remove it and bring in its after-effect, like a hangover.
function endSubstance(e, st) {
  if (!st.after) return;
  addStatus(e, st.after.n, st.after.tier || 1, null);
  const next = e.statuses.find((x) => x.n === st.after.n);
  next.aftermath = true;
  if (st.after.fx) { next.fx = st.after.fx; next.text = st.after.text; }
  log("status", `${st.from || st.n} wears off ${e.name}: ${st.after.n}.`);
}
function addStatus(e, name, tier0 = 1, turns = null) {
  const def = db.status.get(E.low(name));
  const canon = def ? def.n : name;
  // Resistance: gas masks, Rad-X and so on make a status land one tier lower. At zero it doesn't land.
  const tier = tier0 - (der(e).m["resist:" + canon] || 0) + (/Injured Limb/.test(canon) ? der(e).m.crippleTaken || 0 : 0);
  if (tier < 1) { log("status", `${e.name} resists ${canon}.`); return; }
  e.statuses = e.statuses || [];
  const cur = e.statuses.find((s) => E.low(s.n) === E.low(canon));
  const info = E.statusInfo(ctx(), { n: canon, tier });
  const t = turns != null ? turns : info.mods.turns != null ? info.mods.turns : null;
  if (cur) { cur.tier = tier; cur.turns = t; } else e.statuses.push({ n: canon, tier, turns: t });
}
function revive(e, how) {
  e.dbno = false; e.hp = Math.max(e.hp, S.rules.reviveHP); e.timesRevived = (e.timesRevived || 0) + 1;
  addStatus(e, "Shock", S.rules.reviveShockTier);
  log("check", `${e.name} is back up at ${e.hp} HP with Shock ${S.rules.reviveShockTier} (${how}). Times revived: ${e.timesRevived}.`);
}
function template(name) { const n = S.npcs.find((x) => E.low(x.n) === E.low(name)); return n || enemyV(db.enemies.get(E.low(name))) || null; }
const allTemplates = () => [...S.npcs.map((n) => ({ ...n, named: true })), ...DATA.enemies.filter((t) => !t.test).map(enemyV)];
/** Exact match first, then names that start with the text, then the rest. */
function rankByName(list, q, nameOf = (x) => x.n) {
  const s = E.low(q); if (!s) return list;
  const score = (x) => { const n = E.low(nameOf(x)); return n === s ? 0 : n.startsWith(s) ? 1 : n.includes(s) ? 2 : 3; };
  return list.filter((x) => score(x) < 3).sort((a, b) => score(a) - score(b));
}
const usable = (item) => item && (item.effect || item.ap != null);

// ---------- combat flow
const order = () => [...K().cbs].sort((a, b) => (b.init == null ? -99 : b.init) - (a.init == null ? -99 : a.init) || (b.base || 0) - (a.base || 0));
const alive = (c) => !c.dead && !c.fled;
const canAct = (c) => { const e = ent(c.id); return e && alive(c) && !e.dbno; };
function actorId() { const k = K(); if (!k) return null; if (k.phase === "stealth") { const r = ui.rowSel && ent(ui.rowSel); return r && r.kind === "pc" ? r.id : (S.chars[0] || {}).id; } return k.turnId; }
const pairKey = (a, b) => [a, b].sort().join("|");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function bandFor(d) { const m = S.rules.bandMeters; for (let i = 0; i < 10; i++) if (d <= m[i] + 0.01) return i + 1; return 10; }
function posOf(id) { const c = cbOf(id); if (c && c.x != null) return c; return S.scene.pos[id] || { x: 0, y: 0 }; }
function rangeOf(a, b) { const k = K(); if (a === b) return 1; const o = k && k.ranges[pairKey(a, b)]; if (o != null) return o; return bandFor(dist(posOf(a), posOf(b))); }
const mapOf = () => S.scene.map || { id: "wild", n: "", w: 220, h: 160 };
const unit = () => { const M = mapOf(); return Math.max(M.w, M.h) / 16; };  // the size one token takes up, so a small room and a wasteland both read well
const inMap = (p) => { const M = mapOf(); return { x: clamp(p.x, -M.w / 2, M.w / 2), y: clamp(p.y, -M.h / 2, M.h / 2) }; };
// Injured legs make walking dearer, using the "-25% mvm" in the status text. Shattered means no walking at all.
function moveMult(e) {
  let m = 1;
  for (const st of (e && e.statuses) || []) {
    if (st.parts && !st.parts.some((p) => /Leg/.test(p))) continue;  // a hurt arm doesn't slow you down
    const x = E.statusInfo(ctx(), st).mods;
    if (x.immobile) return Infinity;
    if (x.mvm) m = Math.max(m, 1 / (1 + x.mvm));
  }
  return m;
}
// Draft rule: AP by how far you walk, from the Move AP table, so 150m is 15 AP and a step across a room is 1 or 2.
function moveCost(from, to, e) { const d = dist(from, to); if (d < 0.01) return 0; const lim = e && der(e).m.moveMaxM; if (lim && d > lim) return Infinity; const m = moveMult(e); return m === Infinity ? Infinity : Math.ceil(S.rules.moveAP[bandFor(d) - 1] * m) + ((e && der(e).m.moveAdd) || 0); }
function reachOf(e) { const m = moveMult(e); if (m === Infinity) return 0; const t = S.rules.moveAP; let r = 0; for (let i = 0; i < 10; i++) if (Math.ceil(t[i] * m) <= (e.ap || 0)) r = S.rules.bandMeters[i]; return r; }
const fightPhase = () => K() && ["turns", "stealth"].includes(K().phase);
// Rules that depend on the round, for actions other than attacks.
function turnMods(e) { const k = K(); return E.forShot(der(e), e, { round: k ? k.round : 1, range: 1 }, ctx()).m; }
function canPay(e, cost, what) { if (!fightPhase() || !cost || (e.ap || 0) >= cost) return true; toast(`${e.name} needs ${cost} AP to ${what}, has ${fmt(e.ap)}.`); return false; }
const SOLID = new Set(["wall", "hard", "tree"]);
const solidAt = (p) => S.scene.objects.some((o) => SOLID.has(o.kind) && o.w && E.inside(p, o));
function freeSpot() {
  const M = mapOf(), u = unit();
  const others = [...S.chars.map((c) => posOf(c.id)), ...foes().map((n) => posOf(n.id))];
  let best = null, bestGap = -1;
  for (let i = 0; i < 24; i++) {
    const p = { x: E.fix(-M.w / 2 + M.w * 0.38 + Math.random() * (M.w * 0.62 - u)), y: E.fix((Math.random() - 0.5) * (M.h - u * 1.6)) };
    if (solidAt(p)) continue;
    const gap = Math.min(1e6, ...others.map((o) => dist(o, p)));
    if (gap > bestGap) { best = p; bestGap = gap; }
    if (gap > u * 2.5) break;
  }
  return best || { x: E.fix(M.w * 0.25), y: 0 };
}
function partySpots() {
  const M = mapOf(), u = unit(), n = S.chars.length, rows = Math.ceil(n / 2);
  const gap = Math.max(1.2, u);  // at least a person's width apart, however small the room is
  S.chars.forEach((c, i) => { if (!S.scene.pos[c.id]) S.scene.pos[c.id] = { x: E.fix(-M.w / 2 + gap * (0.8 + (i % 2) * 1.2)), y: E.fix((Math.floor(i / 2) - (rows - 1) / 2) * gap * 1.15) }; });
}
function applyMap(id, w, h) {
  const p = S.rules.maps[id] || S.rules.maps.wild; const sc = S.scene; const g = S.rules.gridM || 2;
  const fit = (x) => Math.max(g, Math.ceil(x / g) * g);  // whole grid squares only
  sc.map = { id, n: p.n, w: fit(w || p.w), h: fit(h || p.h) }; sc.pos = {}; ui.zoom = null;
  partySpots();
  const u = unit(); const party = S.chars.map((c) => sc.pos[c.id]); const items = S.rules.mapItems;
  // Builds one object. Item names come from the catalog, older kinds like "wall" still work.
  const make = (kind, x, y, ow, oh, label) => { const c = items[kind]; const o = { id: "o" + S.seq++, kind: c ? (c.round ? "tree" : "cover") : kind, x, y, w: ow, h: oh, label: label || "" }; if (c) { o.item = kind; o.cover = c.cover; if (c.block) o.block = true; if (c.round) o.round = true; } return o; };
  sc.objects = (p.objs || []).map(([kind, x, y, ow, oh, label]) => make(kind, x, y, ow, oh, label));
  for (const [kind, count, lo, hi] of p.scatter || []) for (let i = 0; i < count; i++) {
    const size = E.fix(lo + Math.random() * (hi - lo)); const o = { x: E.fix((Math.random() - 0.5) * (sc.map.w - size)), y: E.fix((Math.random() - 0.5) * (sc.map.h - size)) };
    if (party.some((q) => dist(q, o) < Math.max(u, 2))) continue;
    sc.objects.push(make(kind, o.x, o.y, size, size));
  }
  for (const e of sc.npcs) sc.pos[e.id] = freeSpot();
}
function ensureMap() { if (!S.scene.map) applyMap(S.rules.sceneDefaults.map); }
function renumber(list, tmpl) {
  const same = list.filter((n) => n.tmpl === tmpl);
  same.forEach((n, i) => { if (!n.customName) n.name = same.length > 1 ? `${tmpl} ${i + 1}` : tmpl; });
}
function addEnemy(name) {
  const t = template(name); if (!t) return null;
  const k = K(); const id = "n" + S.seq++; const list = foes();
  ensureMap(); const p = freeSpot();
  const e = E.spawn(t, id, ctx(), Math.random);
  if (t.saved) e.customName = true;
  else { const n = E.npcName(t, S.rules, Math.random, new Set([...list, ...S.scene.npcs].map((x) => x.name))); if (n) { e.name = n; e.customName = true; } }
  list.push(e); renumber(list, t.n);
  if (k) { const d = der(e); const roll = 1 + Math.floor(Math.random() * 20); k.cbs.push({ id, x: p.x, y: p.y, base: d.pri, roll, init: E.fix(d.pri + roll) }); log("turn", `${e.name} joins the fight, initiative ${E.fix(d.pri + roll)}.`); } else S.scene.pos[id] = p;
  return e;
}
const sideOf = (id) => { const e = ent(id); return e && (e.kind === "pc" || e.ally) ? "pc" : "npc"; };
function targetsFor(id) { const list = order().filter((c) => c.id !== id && alive(c)); const live = (c) => !ent(c.id).dbno; return [...list.filter((c) => sideOf(c.id) !== sideOf(id) && live(c)), ...list.filter((c) => sideOf(c.id) !== sideOf(id) && !live(c)), ...list.filter((c) => sideOf(c.id) === sideOf(id))].map((c) => c.id); }
function beginCombat(stealth) {
  if (!S.scene.npcs.length && !confirm("No enemies on the map. Start a fight anyway?")) return;
  act("Begin combat", () => {
    ensureMap(); partySpots();
    const npcs = S.scene.npcs; const cbs = [];
    for (const e of [...S.chars, ...npcs]) { const p = S.scene.pos[e.id] || { x: 0, y: 0 }; cbs.push({ id: e.id, x: p.x, y: p.y }); }
    S.chars.forEach((c) => { c.ap = der(c).ap; const fear = der(c).m.startAfraid; if (fear) addStatus(c, "Afraid", fear); });  // Paranoid
    S.combat = { phase: stealth ? "stealth" : "init", round: 1, npcs, cbs, ranges: {}, acted: {}, last: {}, used: [], turnId: null, stealthDue: null };
    S.scene.npcs = [];
    log("turn", `Combat: ${npcs.map((n) => n.name).join(", ") || "no enemies"}. ${S.scene.time}, ${S.scene.weather}, ${S.scene.env}.`);
    if (!stealth) prepInit();
    ui.rowSel = (S.chars[0] || {}).id; ui.atk = null; ui.end = null; ui.def = null; ui.place = null;
  });
}
function prepInit() {
  const k = K(); k.phase = "init"; k.stealthDue = null;
  for (const c of k.cbs) {
    const e = ent(c.id);
    c.base = der(e).pri + (c.caught ? S.rules.caughtInit : 0) + (e.kind === "npc" && !e.ally ? S.chars.reduce((t, pc) => t + (der(pc).m.enemyInit || 0), 0) : 0);  // Instinct
    c.roll = e.kind === "npc" ? 1 + Math.floor(Math.random() * 20) : null;
  }
  const first = k.cbs.find((c) => c.roll == null);
  if (first) ui.focus = `#init-${first.id}`;
}
function beginRounds() {
  const k = K();
  const missing = k.cbs.find((c) => c.roll == null || c.roll === "");
  act("Begin round 1", () => {
    for (const c of k.cbs) c.init = E.fix((c.base || 0) + (num(c.roll, 0)));
    k.phase = "turns"; k.round = 1;
    log("turn", "Initiative: " + order().map((c) => `${ent(c.id).name} ${c.init}`).join(", ") + (missing ? " (blank rolls counted as 0)" : ""));
    startFirstTurn();
  });
}
function startFirstTurn() { const k = K(); k.acted = {}; const f = order().find(canAct); if (f) startTurn(f.id); else enterRoundEnd(); }
function startTurn(id) {
  const k = K(), e = ent(id);
  const me = cbOf(id); if (me) { me.still = me.moved ? 0 : (me.still || 0) + (k.round > 1 ? 1 : 0); me.moved = false; }  // Turtle counts rounds spent still
  k.turnId = id; k.acted[id] = true; e.ap = der(e).ap; ui.rowSel = id; ui.atk = null; ui.pendingMove = null; ui.focus = "#roll"; if (e.kind === "pc") ui.sel = id;
  log("turn", `Round ${k.round}: ${e.name}'s turn, ${e.ap} AP.`);
}
function nextTurn() { act("End turn", () => { const k = K(); const nx = order().find((c) => canAct(c) && !k.acted[c.id]); if (nx) startTurn(nx.id); else enterRoundEnd(); }); }
const setTimeout0 = [];  // after-effects to add once a status list has finished updating
function tickRound() {
  for (const c of K().cbs) {
    if (!alive(c)) continue;
    const e = ent(c.id);
    e.statuses = (e.statuses || []).filter((st) => {
      const i = E.statusInfo(ctx(), st);
      if (i.mods.dot) { e.hp = Math.max(0, e.hp - i.mods.dot); log("status", `${e.name} takes ${i.mods.dot} from ${st.n}. HP ${e.hp}/${der(e).hp}.`); syncDown(e); }
      if (i.mods.regen) { e.hp = Math.min(der(e).hp, e.hp + i.mods.regen); log("status", `${e.name} gains ${i.mods.regen} HP from ${st.n}.`); syncDown(e); }
      if (st.turns != null) { st.turns--; if (st.turns <= 0) { log("status", `${st.n} ends on ${e.name}.`); setTimeout0.push(() => endSubstance(e, st)); return false; } }
      return true;
    });
    while (setTimeout0.length) setTimeout0.shift()();
    if (e.numbed > 0) e.numbed--;
    e.effects = (e.effects || []).filter((fx) => { if (fx.turns != null) { fx.turns--; if (fx.turns <= 0) { log("status", `${fx.label} wears off ${e.name}.`); return false; } } return true; });
  }
}
function enterRoundEnd() {
  const k = K(); k.phase = "roundEnd"; k.turnId = null; k.saves = {}; ui.atk = null;
  tickRound();
  log("turn", `End of round ${k.round}.`);
  const firstDown = S.chars.find((c) => c.dbno);
  if (firstDown) ui.focus = `#save-${firstDown.id}`;
}
function nextRound() { act("Next round", () => { const k = K(); k.round++; k.phase = "turns"; startFirstTurn(); }); }
const npcsAlive = () => K().cbs.filter((c) => sideOf(c.id) === "npc" && alive(c)).length;
const pcsUp = () => S.chars.filter((c) => !c.dbno).length;

// ---------- attack
const PARTS = { Head: ["Head", "Head"], Body: ["Body", "Body"], LArm: ["Left arm", "Limb"], RArm: ["Right arm", "Limb"], LLeg: ["Left leg", "Limb"], RLeg: ["Right leg", "Limb"] };
function setPart(a, id) { a.part = id; a.loc = PARTS[id][1]; }
// Sets up the attack menu without drawing. On a turn it's always up, so this also runs when a turn starts.
function makeAttack(att, want) {
  const k = K(); const id = att || actorId(); const A = ent(id); if (!k || !A || !(A.weapons || []).length) return false;
  const last = k.last[id] || {};
  const ts = targetsFor(id);
  const tgt = want && ts.includes(want) ? want : last.tgt && ts.includes(last.tgt) && !(ent(last.tgt).dbno && ts[0] !== last.tgt) ? last.tgt : ts[0];
  ui.atk = { att: id, tgt: tgt || null, w: A.activeW || 0, mode: last.mode || "pr", roll: "", ov: {}, res: null, err: "" };
  setPart(ui.atk, last.part || "Body");
  return true;
}
function openAttack(att, want) {
  const id = att || actorId(); const A = ent(id); if (!K()) return; if (!A) return toast("Nobody is acting right now");
  if (!makeAttack(id, want)) return toast(`${A.name} has no weapon. Press E to edit.`);
  ui.focus = "#roll"; render();
}
function atkView() {
  const a = ui.atk; const A = ent(a.att), T = a.tgt ? ent(a.tgt) : null;
  if (!A) return null;
  const c = ctx(); const dA0 = der(A); const slot = A.weapons[a.w] || A.weapons[0];
  const range = T ? rangeOf(A.id, T.id) : 1; const k = K(); const round = k ? k.round : 1;
  const myO = (E.get(c, slot && slot.n) || { o: {} }).o; const dT0 = T ? der(T) : dA0;
  const tSlot = T && (T.weapons || [])[T.activeW || 0]; const tO = tSlot ? (E.get(c, tSlot.n) || { o: {} }).o : {};
  // Everything a condition can ask about this shot. Each side's rules are checked here, so "vs robots" and "first turn" just work.
  const inCover = (S.scene.objects || []).some((o) => { const t = E.coverTier(o, S.rules); const p = posOf(A.id); return t !== "open" && Math.abs(p.x - o.x) <= (o.w || 1) / 2 + 2 && Math.abs(p.y - o.y) <= (o.h || 1) / 2 + 2; });
  // What the app has been counting this fight: moves, hits taken, kills, hits in a row. Rules read these so nobody has to track them.
  const cbA = cbOf(A.id) || {}; const tier = (e, n) => ((e && e.statuses) || []).filter((x) => x.n === n).reduce((t, x) => t + (x.tier || 1), 0);
  const streak = k && k.streak && k.streak[A.id] && k.streak[A.id].tgt === a.tgt ? k.streak[A.id].n : 0;
  const dA = E.forShot(dA0, A, { o: myO, vs: E.enemyType(T, S.rules), targetMob: !!(T && T.mob), round, sneak: !!k && k.phase === "stealth", mode: a.mode, magFull: !!slot && !!myO.mag && slot.mag >= myO.mag, inCover, targetMelee: tO.tab === "MW", sameTarget: !!k && (k.last[A.id] || {}).tgt === a.tgt, range, part: a.loc, moved: !!cbA.moved, still: cbA.still || 0, afterCrit: !!cbA.critThisFight, hitsTaken: cbA.hitsTaken || 0, killsHuman: cbA.killsHuman || 0, afraid: tier(A, "Afraid"), targetBleed: tier(T, "Bleeding"), targetDebuffs: ["Bleeding", "Afraid"].reduce((t, n) => t + tier(T, n), 0) + tier(T, "Injured Limb (Leg/Arm)"), streak, hpHigher: !!T && (A.hp || 0) > (T.hp || 0) }, c);
  dA.m.luckyDigit = A.luckyDigit != null ? A.luckyDigit : 7; dA.m.vengeNow = !!(dA.m.vengeful && cbA.gotCrit);
  const dT = T ? E.forShot(dT0, T, { o: tO, round, attackerO: myO, attackerMob: !!A.mob, range, part: a.loc }, c) : dA;
  // Pack Animals: allies close to someone with the perk are harder to hit.
  if (T && sideOf(T.id) === "pc" && sideOf(A.id) !== "pc") for (const pc of S.chars) if (pc.id !== T.id && der(pc).m.auraEnemyAcc && dist(posOf(pc.id), posOf(T.id)) <= S.rules.bandMeters[0] * 2) { dT.m = { ...dT.m, enemyAcc: (dT.m.enemyAcc || 0) + der(pc).m.auraEnemyAcc }; break; }
  const v = E.weaponView(slot, A, dA, c, a.mode);
  if (dA.m.critPerRange) v.crit = E.fix(v.crit * range);  // Sharpshooter
  // Cover is a flag on every shot, from the line between the two of them. OVR can set it by hand.
  const lc = T ? E.lineCover(posOf(A.id), posOf(T.id), S.scene.objects, S.rules) : { tier: "open", n: "Open", hit: 0, dam: 0, by: "" };
  const cov = a.ov.cover ? { ...S.rules.cover[a.ov.cover], tier: a.ov.cover, by: "DM set" } : lc;
  const hc = E.hitChance(A, dA, T || A, dT, v, range, c, cov);
  const hit = num(a.ov.hit) != null ? num(a.ov.hit) / 100 : hc.hit * (1 + (dA.m.accMul || 0));
  const b = E.bands(hit, v.jam, v.crit, dA.superCrit, { rules: S.rules, lck: dA.sp.L == null ? 5 : dA.sp.L, cond: slot && slot.cond != null ? slot.cond : 10 });
  // Super Crit Roll and Super Fail Roll widen those bands by that many numbers on the dice.
  if (dA.m.superRoll) b.superAt = E.fix(b.superAt - dA.m.superRoll); if (dA.m.failRoll) b.jamAt = E.fix(b.jamAt + dA.m.failRoll);
  const swap = a.w !== (A.activeW || 0) ? S.rules.swapAP : 0;
  const extra = dA.m.targetFree ? 0 : S.rules.targetAP[a.loc] || 0;
  const cost = v.ap + extra + swap;
  const warn = [];
  if (slot && slot.jammed) warn.push(`Jammed. Press J to clear for ${v.clearJam} AP.`);
  if (v.missing) warn.push("This weapon is not in the item data.");
  else if (!v.ok) warn.push("Blank stats in the workbook. Fill them in from the WEAPONS list up top.");
  if (v.noLoad) warn.push("No ammo type chosen, so damage is 0.");
  if (v.usesAmmo && (slot.mag || 0) <= 0) warn.push("Magazine empty. Press R to reload.");
  if (cost > (A.ap || 0) && !a.ov.free) warn.push(`Costs ${cost} AP but only ${A.ap} left. Move on, or tick Free under OVR.`);
  if (hit <= 0 && !hc.noData) warn.push("0% or less to hit.");
  if (v.melee && range > 1 && !dA.m.lunge) warn.push(`Melee at R${range}: only reaches R1 unless a perk says otherwise.`);
  if (v.pellets) warn.push(`Pellet ammo (${fmt(v.base)}x${v.pellets}) counts as ${S.rules.pelletMode === "each" ? "one roll per pellet" : "one combined hit"}. Change in Settings.`);
  return { a, A, T, dA, dT, slot, v, range, hc, hit, b, cost, swap, extra, warn, cov, spans: E.bandSpans(b) };
}
function fire() {
  const a = ui.atk; if (!a) return;
  const raw = String(a.roll).trim();
  if (!/^\d{1,2}$/.test(raw)) { a.err = "Type the two-dice roll, 00 to 99."; ui.focus = "#roll"; return render(); }
  const p = atkView();
  if (!p.T) { a.err = "Pick a target first (T)."; return render(); }
  if (p.slot.jammed) { a.err = `Jammed. Press J to clear for ${p.v.clearJam} AP first.`; return render(); }
  if (p.v.usesAmmo && (p.slot.mag || 0) <= 0) { a.err = "Empty magazine. Press R to reload."; return render(); }
  if (p.hc.noData && num(a.ov.hit) == null) { a.err = "No hit data at this range. Enter a Hit % under Overrides or fill in the weapon in the WEAPONS list."; return render(); }
  if (p.dA.m.noEW && p.v.tab === "EW") { a.err = `${p.A.name} can't use energy weapons.`; ui.focus = "#roll"; return render(); }
  if (p.cost > (p.A.ap || 0) && !a.ov.free && fightPhase()) { a.err = `Not enough AP: this costs ${p.cost}, ${p.A.name} has ${fmt(p.A.ap)}.`; ui.focus = "#roll"; return render(); }
  if (p.v.thrown && p.A.kind === "pc" && !(p.A.inv || []).some((x) => E.low(x.n) === E.low(p.v.n))) { a.err = `${p.A.name} has no ${p.v.n} left to throw.`; ui.focus = "#roll"; return render(); }
  const roll = Number(raw);
  act(`Attack: ${p.A.name} → ${p.T.name}`, () => {
    const { A, T, v, slot, b, dT } = p;
    const res = E.resolve({ v, b, roll, dt: dT.dt, loc: a.loc, rules: S.rules, available: v.usesAmmo ? Math.floor((slot.mag || 0) / (v.perShot || 1)) : null, bulletsOv: num(a.ov.bullets), damageOv: num(a.ov.dmg), mult: Math.max(0, (1 + (p.cov.dam || 0)) * (1 + (dT.m.dmgTaken || 0))), shot: p.dA.m, taken: dT.m });
    const jammed = res.outcome === "jam";
    if (!a.ov.free) A.ap = Math.max(0, (A.ap || 0) - (jammed && !S.rules.jamSpendsAP ? p.swap : p.cost));
    A.activeW = a.w;
    let ammoText = "";
    if (jammed) slot.jammed = true;
    else if (v.usesAmmo && !(p.dA.m.critNoAmmo && (res.outcome === "crit" || res.outcome === "super"))) { slot.mag = (slot.mag || 0) - Math.min(slot.mag || 0, v.count * (v.perShot || 1)); ammoText = `${slot.mag}/${v.cap} left`; }
    if (v.thrown) { const l = (A.inv || []).find((x) => E.low(x.n) === E.low(v.n)); if (l) { l.q--; if (l.q <= 0) A.inv = A.inv.filter((x) => x !== l); } }
    const wasUp = T.hp > 0; const cbT = cbOf(T.id) || {}; const cbAtk = cbOf(A.id) || {}; const k2 = K();
    // Keep the counts rules read: hits in a row on one target, hits taken, crits, kills.
    k2.streak = k2.streak || {}; k2.streak[A.id] = res.total ? { tgt: T.id, n: k2.streak[A.id] && k2.streak[A.id].tgt === T.id ? k2.streak[A.id].n + 1 : 1 } : null;
    if (res.outcome === "crit" || res.outcome === "super") { cbAtk.critThisFight = true; cbT.gotCrit = true; } if (p.dA.m.vengeNow) cbAtk.gotCrit = false;
    if (res.total) {
      cbT.hitsTaken = (cbT.hitsTaken || 0) + 1;
      T.hp = Math.max(0, T.hp - res.total); syncDown(T, A.id);
      if (dT.m.apOnHit) T.ap = (T.ap || 0) + dT.m.apOnHit;  // Masochist
      if (wasUp && T.hp <= 0 && E.enemyType(T, S.rules) === "human") cbAtk.killsHuman = (cbAtk.killsHuman || 0) + 1;
      if (wasUp && T.hp <= 0 && p.dA.m.killAP) { const back = Math.floor(p.dA.ap * p.dA.m.killAP); A.ap = (A.ap || 0) + back; log("status", `${A.name} regains ${back} AP from the kill.`); }  // Grim Reaper's Sprint
    }
    const NAME = { jam: "JAM", miss: "MISS", hit: "HIT", crit: "CRIT", super: "SUPER CRIT" }[res.outcome];
    const head = `${A.name} → ${T.name} · ${v.n}${v.modeName ? " " + v.modeName : ""} · R${p.range} ${PARTS[a.part][0]}${p.cov.tier !== "open" ? ` · ${p.cov.n}` : ""} · ${fmt(E.pct(p.hit))}% · rolled ${E.two(roll)}`;
    const line = `${head}: ${NAME}` + (res.total ? ` · ${res.math} · ${T.name} ${T.hp}/${dT.hp}` : jammed ? ` · clear costs ${v.clearJam} AP` : "") + (ammoText ? ` · ${ammoText}` : "");
    log(res.total ? "hit" : jammed ? "jam" : "miss", line);
    const fx = hitStatuses(res, T, v, a.part, p.dA.m);
    K().last[A.id] = { tgt: T.id, mode: a.mode, part: a.part };
    if (K().phase === "stealth" && A.kind === "pc") { K().stealthDue = A.id; ui.focus = "#stealthRoll"; }
    a.res = { outcome: res.outcome, name: NAME, head, math: res.math, total: res.total, auto: fx.auto, status: fx.manual, tgt: T.id, tName: T.name, hp: T.hp, max: dT.hp, ammoText, radius: v.radius };
    a.roll = ""; a.ov = {}; a.err = "";
    if (cbOf(T.id) && !alive(cbOf(T.id))) { const nx = targetsFor(A.id).find((id) => sideOf(id) !== sideOf(A.id) && !ent(id).dbno); if (nx) a.tgt = nx; }
    if (K().phase !== "stealth") ui.focus = "#roll";
  });
  const shown = document.querySelector(".result");
  if (shown) shown.scrollIntoView({ block: "nearest" });
}
// Applies status effects from a hit: crits by body part, and whatever the weapon's Status column says. Undo takes them back with the attack.
function hitStatuses(res, T, v, part, shot = {}) {
  const out = { auto: [], manual: null }; const r = S.rules;
  if (!res.total || T.hp <= 0) return out;
  const give = (name, tier, why, limb) => {
    const canon = db.status.get(E.low(name)).n; const cur = (T.statuses || []).find((x) => x.n === canon);
    keepFull(T, () => addStatus(T, canon, Math.max(tier, cur ? cur.tier : 0)));
    const st = (T.statuses || []).find((x) => x.n === canon); if (!st) return;
    if (limb) st.parts = [...new Set([...(st.parts || []), limb])];
    const text = `${canon} ${st.tier}${limb ? " (" + PARTS[limb][0].toLowerCase() + ")" : ""}`;
    out.auto.push(text); log("status", `${T.name} gains ${text}: ${why}.`);
  };
  if (r.autoStatus && (res.outcome === "crit" || res.outcome === "super")) {
    const limb = PARTS[part][1] === "Limb" ? part : null;
    const name = r.critStatus[limb ? (/Leg/.test(part) ? "Leg" : "Arm") : part];
    if (name && db.status.has(E.low(name))) give(name, r.critTier[res.outcome === "super" ? "Super" : "Crit"], `${res.outcome === "super" ? "super crit" : "crit"} to the ${PARTS[part][0].toLowerCase()}`, limb);
  }
  const crit = res.outcome === "crit" || res.outcome === "super";
  if (crit && shot.critKnock && db.status.has("knocked out")) give("Knocked Out", 1, "crit with a perk");  // Hammertime
  if (shot.hitBleed && db.status.has("bleeding")) give("Bleeding", shot.hitBleed, "perk");  // Close n Personal
  if (crit && shot.critDisorient && db.status.has("disoriented")) give("Disoriented", shot.critDisorient, "perk");  // Forced Slumber
  if (crit && shot.critLimb) give("Injured Limb (Leg/Arm)", 1, "perk", ["LArm", "RArm", "LLeg", "RLeg"][Math.floor(Math.random() * 4)]);
  if (crit && shot.critBleed && db.status.has("bleeding")) give("Bleeding", shot.critBleed, "crit with a perk");  // Shrapnel
  if (shot.knockChance && db.status.has("knocked out") && Math.random() < shot.knockChance) give("Knocked Out", 1, `${E.pct(shot.knockChance)}% knockdown chance`);  // Super Slam
  if (r.autoWeaponStatus && v.status) {
    const w = (E.get(ctx(), v.n) || { o: {} }).o; const chances = String(w.dotCh || "").split(",");
    String(v.status).split(",").forEach((raw, i) => {
      const m = /^\s*(crit;\s*)?([^()+]+?)\s*(?:\((\d+)%\))?\s*(?:\+(\d+))?\s*$/i.exec(raw); if (!m) return;
      if (m[1] && res.outcome !== "crit" && res.outcome !== "super") return;
      const col = /(\d+)%\s*\/\s*(\d+)/.exec(chances[i] || "");
      const name = db.status.has(E.low(m[2])) ? m[2] : (DATA.statuses.find((x) => E.low(x.n).startsWith(E.low(m[2]).slice(0, 5))) || {}).n;
      if (!name) { out.manual = m[2]; return; }
      const chance = Number(m[3] || (col && col[1]) || 100) * (1 + (shot.debuffCh || 0)) + (shot.debuffAdd || 0), tier = Number(m[4] || (col && col[2]) || 1);
      const roll = Math.floor(Math.random() * 100);
      if (roll < chance) give(name, tier, `${v.n}${chance < 100 ? `, ${chance}% chance, rolled ${roll}` : ""}`);
      else log("status", `${T.name} avoids ${name} from ${v.n} (${chance}% chance, rolled ${roll}).`);
    });
  } else if (v.status) out.manual = v.status;
  return out;
}
const cycle = (list, cur, dir = 1) => list[(list.indexOf(cur) + dir + list.length) % list.length];
// Only ammo the character is carrying, plus whatever is already loaded.
function loadsHeld(e, v, slot) { const inv = (e.inv || []).map((l) => E.low(l.n)); return (v.caliber ? E.loadsFor(ctx(), v.caliber) : []).filter((a) => inv.includes(E.low(a.n)) || (slot && a.n === slot.ammo)); }
// Launchers list a family ("Rocket") and the pack holds a load ("Rocket - Junk").
const ammoLine = (e, name) => { const n = E.low(name); return (e.inv || []).find((l) => E.low(l.n) === n) || (e.inv || []).find((l) => n && E.low(l.n).startsWith(n + " - ")); };
const ammoHeld = (e, name) => (ammoLine(e, name) || { q: 0 }).q;
function reloadWeapon(id, idx) {
  const e = ent(id); const i = idx != null ? idx : (e.activeW || 0); const slot = e.weapons[i];
  const v = E.weaponView(slot, e, der(e), ctx());
  if (!v.usesAmmo) return toast(`${v.n} doesn't reload.`);
  if ((slot.mag || 0) >= v.cap) return toast("Magazine is already full.");
  if (!canPay(e, v.reload, "reload")) return;
  const line = ammoLine(e, v.reserve);
  if (!line) return toast(`No ${v.reserve || "ammo"} in ${e.name}'s inventory.`);
  act(`Reload: ${e.name}`, () => {
    const need = v.cap - (slot.mag || 0);
    const took = Math.min(need, line.q);
    line.q -= took; if (line.q <= 0) e.inv = e.inv.filter((x) => x !== line);
    slot.mag = (slot.mag || 0) + took;
    if (S.combat) e.ap = Math.max(0, (e.ap || 0) - v.reload);
    log("status", `${e.name} reloads ${v.n}: ${slot.mag}/${v.cap}${S.combat ? `, ${v.reload} AP` : ""}.`);
    if (S.combat && K().phase === "stealth") K().stealthDue = e.id;
  });
}
function clearJam(id, idx) {
  const e = ent(id); const i = idx != null ? idx : ui.atk && ui.atk.att === id ? ui.atk.w : (e.activeW || 0); const slot = e.weapons[i];
  if (!slot || !slot.jammed) { const any = e.weapons.findIndex((s) => s.jammed); if (any < 0) return toast("No jammed weapon."); return clearJam(id, any); }
  const v = E.weaponView(slot, e, der(e), ctx());
  if (!canPay(e, v.clearJam, "clear the jam")) return;
  act(`Clear jam: ${e.name}`, () => { slot.jammed = false; if (S.combat) e.ap = Math.max(0, (e.ap || 0) - v.clearJam); log("status", `${e.name} clears ${v.n}${S.combat ? `, ${v.clearJam} AP. ${e.ap} left.` : "."}`); });
}
function reqMet(req, d) {
  if (!req) return true;
  const key = { STR: "S", PER: "P", END: "E", CHA: "C", INT: "I", AGL: "A", AGI: "A", LCK: "L" };
  const skillBy = Object.fromEntries(E.SKILLS.map(([k, n]) => [n.toLowerCase(), k]));
  for (const m of String(req).matchAll(/(\d+)\+?\s*([A-Za-z][A-Za-z ]*?)(?=,|\s+\d|$)/g)) {
    const need = Number(m[1]), w = m[2].trim();
    const val = key[w.toUpperCase()] ? d.sp[key[w.toUpperCase()]] : skillBy[w.toLowerCase()] ? d.skills[skillBy[w.toLowerCase()]] : null;
    if (val != null && val < need) return false;
  }
  return true;
}
const ABBR = { BAR: "BA", EW: "EW", EXP: "EX", SG: "SG", BG: "BG", LPK: "LP", MED: "ME", MW: "MW", REP: "RE", SCI: "SC", SNK: "SN", SPE: "SP", SUR: "SU" };
const canLevel = (e) => !S.combat && E.levelForXp(e.xp || 0, S.rules) > (e.level || 1);

// ---------- pixel icons, 8x8
const ICONS = {
  gear: "..#..#.. .######. .#....#. ##.##.## ##.##.## .#....#. .######. ..#..#..", floppy: "#######. #.#..#.# #.#..#.# #.####.# #......# #.####.# #.#..#.# ########", folder: ".###.... #...#### #......# ######## #......# #......# #......# ########",
  clock: "..####.. .#.##.#. #..##..# #..###.# #......# #......# .#....#. ..####..", book: "######.. #.#...#. #.#.#.#. #.#...#. #.#.#.#. #.#...#. #.#####. ########", log: "######## #......# #.####.# #......# #.####.# #......# #.##...# ########",
  box: "######## #..##..# ######## #......# #.####.# #......# #......# ########", pencil: "......## .....### ....###. ...###.. ..###... .###.... ##...... #.......", gun: "........ ######## ######## ..###... ..##.#.. ..####.. ..##.... ..##....",
  sword: "......## .....### ....###. #..###.. ####.... .##..... #.##.... #...#...", bolt: "....##.. ...##... ..##.... .#####.. ...##... ..##.... .##..... .#......", bomb: ".....#.# ....#... ..###... .#####.. #######. #######. .#####.. ..###...",
  ammo: ".#...#.. ###.###. ###.###. ###.###. ###.###. ###.###. ###.###. ###.###.", vest: "##....## ######## .######. .##..##. .######. .##..##. .######. .######.", ring: "..####.. .#....#. #......# #......# #......# #......# .#....#. ..####..",
  cross: "..####.. ..#..#.. ###..### #......# #......# ###..### ..#..#.. ..####..", syringe: ".....##. ....#.## ...#..#. ..#..#.. .#..#... #..#.... #.#..... .#......", bottle: "...##... ...##... ...##... ..####.. .######. .#.##.#. .######. .######.",
  cup: "........ #######. #.....## #.....#. #.....## #.....#. .#####.. ........", apple: "....#... ...#.... .##.##.. #######. #######. #######. .#####.. ..#.#...", smoke: ".....#.# ......#. .....#.. ........ #######. #######. ........ ........",
  shield: "######## #..##..# #..##..# ######## #..##..# .#.##.#. ..####.. ...##...", skull: ".######. ######## #..##..# #..##..# ######## .##..##. .######. .#.##.#.", wrench: "......## .....#.# ....##.. ...##... ..##.... .##..... ##...... #.......",
  nut: "...##... .######. .##..##. ##....## ##....## .##..##. .######. ...##...", scope: "...##... ...##... .#.##.#. ###..### ###..### .#.##.#. ...##... ...##...", dot: "........ ..####.. .#....#. .#.##.#. .#.##.#. .#....#. ..####.. ........",
  star: "...##... ...##... ######## .######. ..####.. .##..##. .#....#. ........", dna: "##....## .##..##. ..####.. ...##... ...##... ..####.. .##..##. ##....##", heart: ".##..##. ######## ######## ######## .######. ..####.. ...##... ........",
  sliders: "..#..... ######## ..#..... .....#.. ######## .....#.. ..#..... ########", bars: "........ ......## ......## ...##.## ...##.## ##.##.## ##.##.## ##.##.##",
};
const pixCache = {};
function pix(name) {
  if (pixCache[name]) return pixCache[name];
  let r = "";
  (ICONS[name] || ICONS.dot).split(" ").forEach((row, y) => { for (let x = 0; x < 8; x++) if (row[x] === "#") r += `M${x} ${y}h1v1h-1z`; });
  return (pixCache[name] = `<svg class="pix" viewBox="0 0 8 8" aria-hidden="true"><path d="${r}"/></svg>`);
}

// ---------- the dashboard
function view() {
  ensureMap(); partySpots();
  const k = K(); const st = document.documentElement.style;
  st.setProperty("--left", prefs.partyW + "px"); st.setProperty("--right", prefs.enemyW + "px"); st.setProperty("--bottomh", (k ? prefs.bottomFight : prefs.bottomH) + "px"); st.setProperty("--mapw", prefs.mapW ? prefs.mapW + "px" : "46%");
  const mode = k ? "fight" : setupOpen() ? "setup" : "calm";
  const center = mode === "fight"
    ? (["end", "defeat"].includes(k.phase) ? `<div class="arena solo">${consoleWin()}</div>` : `<div class="arena">${fightMap()}<div class="gut" data-gut="map" title="Drag to resize"></div>${consoleWin()}</div>`)
    : mode === "setup" ? `<div class="setupgrid">${encounterWin(true)}${skillWin()}</div>`
    : `<div class="calm"><div class="calmcol">${encounterWin(false)}${skillWin()}</div>${recentWin()}${combatLogWin()}</div>`;
  const top = `<div class="top">${partyWin()}<div class="gut" data-gut="left" title="Drag to resize"></div>${center}${mode === "calm" ? "" : `<div class="gut" data-gut="right" title="Drag to resize"></div>${enemyWin()}`}</div>`;
  const bottom = `<div class="bottom">${notesWin()}${mode === "calm" ? vendorWin() : combatLogWin()}</div>`;
  return `<div class="dash">${devBar()}<div class="board ${mode}"><div class="stage">${top}<div class="gut h" data-gut="bottom" title="Drag to resize"></div>${bottom}</div>${rail()}</div><footer class="foot">${hints().map(([a, b]) => `<span>${kbd(a)}${h(b)}</span>`).join("")}</footer>${ui.logOpen ? logFloat() : ""}${ui.modal ? renderModal() : ""}</div>`;
}
const setupOpen = () => (ui.setup != null ? ui.setup : S.scene.npcs.length > 0);
const logLines = (list, n) => list.slice(-n).reverse().map((l) => `<div class="log-${h(l.k)}">${h(l.x)}</div>`).join("") || `<div class="dim">Nothing yet.</div>`;
const combatLogWin = () => win("w-clog", "Combat log", "", `<div class="loglist">${logLines(S.log.filter((l) => l.r > 0), 40)}</div>`);
const skillWin = () => win("w-check", "Skill check", "", checkBody(), { tools: btn("chkGen", "", "Random", "", "tiny", "Generate a random skill and difficulty") });
function recentWin() { return win("w-recent", "Recent events", "", `<div class="loglist">${logLines(S.log.filter((l) => !l.r), 30)}</div>`); }
function notesWin() {
  const cur = S.notesList.find((n) => n.id === ui.noteId);
  return win("w-notes", "Notes", "", `<input id="qnSubj" autocomplete="off" placeholder="Subject (optional)" data-note="subject" value="${h(cur ? cur.subject : "")}"><textarea id="qnText" spellcheck="false" placeholder="Type a note. Old notes are in the column on the right." data-note="text">${h(cur ? cur.text : "")}</textarea>`, { tools: btn("noteNew", "", "New", "", "tiny") });
}
const DEV = [["loot", "Loot tables"], ["items", "Items"], ["weapons", "Weapons"], ["armor", "Armor"], ["ammo", "Ammo"], ["mods", "Mods"], ["materials", "Materials"], ["recipes", "Recipes"], ["enemies", "Enemies"], ["traits", "Traits"], ["perks", "Perks"], ["statuses", "Statuses"], ["variables", "Variables"], ["report", "Data report"], ["state", "Raw state"]];
function devBar() {
  return `<header class="devbar"><span class="brand">Fallout DM</span><button class="btn tiny devtoggle ${ui.devOpen ? "on" : ""}" data-a="devToggle" data-v="">Dev ${ui.devOpen ? "-" : "+"}</button><span class="devlabel">Dev:</span><span class="devlist ${ui.devOpen ? "open" : ""}">${DEV.map(([id, n]) => btn("dev", id, n, "", "tiny")).join("")}</span><span class="spacer"></span>${btn("refresh", "", "Refresh", "", "tiny", "Reload every list and table into the menus after you edit them")}${btn("undo", "", "Undo", "U", "tiny", undoStack.length ? "Undo: " + undoStack[undoStack.length - 1].label : "Nothing to undo")}${btn("redo", "", "Redo", "Y", "tiny")}${btn("search", "", "Search", "/", "tiny")}${btn("help", "", "Keys", "?", "tiny")}</header>`;
}
function hints() {
  if (ui.modal) return [["Esc", "Close"], ["Enter", "Confirm"]];
  if (K()) {
    if (ui.atk) return [["0-9", "Roll"], ["Enter", "Resolve"], ["N", "End turn"], ["W", "Weapon"], ["T", "Target"], ["M", "Move"], ["R", "Reload"], ["I", "Item"], ["Ctrl+Z", "Undo"]];
    return [["Enter", "Continue"], ["Ctrl+Z", "Undo"]];
  }
  return [["B", "Encounter"], ["I", "Inventory"], ["←→", "Pick character"], ["/", "Search"], ["Ctrl+Z", "Undo"], ["?", "Keys"]];
}
function logFloat() {
  const rows = S.log.slice(-300).reverse().map((l) => `<div class="log-${h(l.k)}">${h(l.x)}</div>`).join("") || `<div class="dim">Nothing yet.</div>`;
  return `<section class="win float floatlog" data-dlg="log" style="${dlgStyle("log")}"><header class="wt">${pix("log")}<span>Log</span><span class="spacer"></span><button class="btn tiny" data-a="toggleLog" data-v="">${kbd("F4")}Close</button></header><div class="wb loglist" data-scroll="floatlog">${rows}</div></section>`;
}

// ----- party
const CARD_MENUS = [["inv", "Inventory", "box"], ["sheet", "Character", "star"], ["health", "Health", "heart"]];
function partyWin() {
  const tools = `${btn("pwOpen", "party", "All", "O", "tiny", "Party-wide changes")}${K() ? "" : btn("newChar", "", "New", "N", "tiny")}${btn("rest", "", "Rest", "Z", "tiny", "Passive heal, clears Shock and item effects")}`;
  return win("w-party", `Party ${S.chars.length}`, "", `<div class="cards">${S.chars.map(charCard).join("") || `<div class="empty">No characters yet. Click New.</div>`}</div>`, { tools });
}
function enemyWin() {
  const k = K(); const n = k ? k.cbs.filter((c) => sideOf(c.id) === "npc" && alive(c)).length : foes().length;
  const allies = foes().filter((e) => e.ally).length;
  return win("w-enemies", `Enemies ${n - allies < 0 ? 0 : k ? n : n - allies}${allies ? ` · Allies ${allies}` : ""}`, "", enemyTab(), { tools: btn("pwOpen", "enemies", "All", "", "tiny", "Change every enemy at once") });
}
function charCard(c) {
  const d = der(c); const sel = c.id === ui.sel; const cb = cbOf(c.id); const me = K() ? actorId() : null;
  const sp = E.SPECIAL.map((k, i) => `<label title="${E.SPECIAL_NAMES[k]}. Base ${c.special[i]}"><span>${k}</span>${numBox(`data-c="setSpecial" data-id="${c.id}" data-i="${i}" id="sp-${c.id}-${i}"`, d.sp[k], "cell")}</label>`).join("");
  const sk = E.SKILLS.map(([k, n]) => { const tagged = (c.tags || []).includes(k); const ovr = c.skills && c.skills[k] != null; return `<label class="${tagged ? "tagged" : ""}" title="${n}${tagged ? " (tagged)" : ""}. Type to override, clear to go back to the formula."><span>${ABBR[k]}</span>${numBox(`data-c="setSkill" data-id="${c.id}" data-k="${k}" id="sk-${c.id}-${k}"`, d.skills[k], `cell ${ovr ? "ovr" : ""}`)}</label>`; }).join("");
  const count = { inv: (c.inv || []).length, sheet: (c.perks || []).length, health: (c.statuses || []).length + (c.effects || []).length };
  const menus = CARD_MENUS.map(([id, n, ic]) => `<button class="icb" data-a="openChar" data-v="${c.id}|${id}" title="${n}">${pix(ic)}<span>${n}</span>${count[id] ? `<b>${count[id]}</b>` : ""}</button>`).join("");
  const due = (c.ptsBank || 0) > 0 || (c.perkDue || 0) > 0;
  const enc = [d.enc.activeTier, d.enc.totalTier].filter(Boolean);
  return `<article class="card ${sel ? "sel" : ""} ${c.dbno ? "down" : ""} ${K() && K().turnId === c.id ? "cur" : ""} ${ui.atk && ui.atk.tgt === c.id ? "tgt" : ""}" data-a="pick" data-v="${c.id}" data-card="${c.id}">
    <header class="chead">${cb && cb.init != null ? numBox(`data-c="setInit" data-id="${c.id}" id="in-${c.id}" title="Initiative"`, fmt(cb.init), "cell init") : ""}<span class="nm grow" title="${h(c.background)} ${h(c.spec)}">${h(c.name)}</span><span class="tag">LV${c.level}</span>${c.dbno ? `<span class="tag bad">DBNO</span>` : ""}${cb && cb.caught ? `<span class="tag bad">CAUGHT</span>` : ""}${btn("edit", c.id, "E", "", "tiny", "Edit")}</header>
    <div class="hpline"><span>HP</span>${bindNum(c.id, "hp", c.hp, `id="rh-${c.id}" title="Current HP"`, "cell")}<span>/</span>${ovCell(c, "hp", d.hp, "Max HP")}<span class="grow">${hpBar(c.hp, d.hp)}</span><span>AP</span>${bindNum(c.id, "ap", c.ap, `id="ra-${c.id}" title="AP now"`, "cell")}<span>/</span>${ovCell(c, "ap", d.ap, "Action Points after modifiers")}${me && me !== c.id ? `<span>R</span>${numBox(`data-c="setRange" data-id="${c.id}" id="rr-${c.id}" title="Range from ${h((ent(me) || {}).name)}"`, rangeOf(me, c.id), "cell")}` : ""}</div>
    <div class="stats7 spc">${sp}</div><div class="stats7">${sk}</div>
    ${canLevel(c) ? `<div class="banner s">${btn("levelUp", c.id, `Level up to ${c.level + 1}`, "", "primary tiny")}</div>` : ""}
    ${due ? `<div class="banner s">${btn("spendPts", c.id, `Assign: ${c.ptsBank ? `${c.ptsBank} skill points` : ""}${c.ptsBank && c.perkDue ? " + " : ""}${c.perkDue ? `${c.perkDue} perk` : ""}`, "", "primary tiny")}</div>` : ""}
    ${c.dbno ? `<div class="banner s">${btn("reviveChk", c.id, "Revive: Medicine check", "", "primary tiny")}</div>` : ""}
    ${enc.length ? `<div class="chips">${enc.map((x) => `<span class="chip">${x}</span>`).join("")}</div>` : ""}${chips(c)}
    <div class="icons">${menus}</div></article>`;
}
// ----- the inventory window: gear on a rough body, then what's carried
const GEAR_SLOTS = {
  head: ["Helmet", (a) => /head/i.test(a.loc)], vanity: ["Clothing", (a) => a.loc === "Vanity"], armor: ["Armor", (a) => ["Body", "Whole Body", "Power"].includes(a.loc)],
  acc0: ["Vanity 1", (a) => a.loc === "Accessory"], acc1: ["Vanity 2", (a) => a.loc === "Accessory"], acc2: ["Vanity 3", (a) => a.loc === "Accessory"],
};
const slotName = (c, s) => (s.startsWith("acc") ? c.gear.acc[Number(s[3])] : c.gear[s]) || "";
function setSlot(c, s, name) { if (s.startsWith("acc")) c.gear.acc[Number(s[3])] = name; else c.gear[s] = name; }
function gearBox(c, s) {
  const name = slotName(c, s); const it = name && E.get(ctx(), name); const o = it ? it.o : {};
  const tip = [o.buffs && `+ ${o.buffs}`, o.nerfs && `- ${o.nerfs}`, o.mech, o.note, o.type].filter(Boolean).map((x) => `<div>${h(x)}</div>`).join("");
  return `<button class="gbox gb-${s} ${ui.modal.pick === s ? "on" : ""}" data-a="gearSlot" data-v="${s}"><span class="gl">${GEAR_SLOTS[s][0]}</span><span class="gn">${h(name || "Empty")}</span>${name ? `<span class="gdt">DT ${fmt(o.dt || 0)}</span>` : ""}${tip ? `<span class="gtip">${tip}</span>` : ""}</button>`;
}
function weaponBox(c, d, i) {
  const slot = c.weapons[i];
  if (!slot) return `<button class="wbox empty ${ui.modal.pick === "w" + i ? "on" : ""}" data-a="gearSlot" data-v="w${i}"><span class="gl">Weapon ${i + 1}</span><span class="gn">Empty</span></button>`;
  const v = E.weaponView(slot, c, d, ctx()); const o = (E.get(ctx(), slot.n) || { o: {} }).o; const loads = loadsHeld(c, v, slot);
  const ammo = v.usesAmmo ? `<div class="wrow"><span>Mag <b>${slot.mag || 0}/${v.cap}</b></span><span>In pack <b>${v.reserve ? ammoHeld(c, v.reserve) : 0}</b></span>${btn("reloadSlot", `${c.id}|${i}`, "Reload", "", "tiny")}</div>${v.caliber ? `<select id="gl-${c.id}-${i}" class="wsel" data-c="setLoad" data-id="${c.id}" data-i="${i}" title="Loaded ammo">${loads.length ? `<option value="">No ammo loaded</option>${options(loads.map((a) => [a.n, `${a.n} (Dam ${a.pellets ? a.dam + "x" + a.pellets : a.dam ?? "?"} Pen ${a.pen ?? 0})`]), slot.ammo)}` : `<option value="">No ${h(v.caliber)} in inventory</option>`}</select>` : `<div class="s dim">Uses ${h(v.reserve)}</div>`}` : `<div class="s dim">${v.melee ? "Melee" : "No ammo"}</div>`;
  return `<div class="wbox ${(c.activeW || 0) === i ? "act" : ""}"><button class="whead ${ui.modal.pick === "w" + i ? "on" : ""}" data-a="gearSlot" data-v="w${i}"><span class="gl">Weapon ${i + 1}${(c.activeW || 0) === i ? " · in hand" : ""}</span><span class="gn">${h(slot.n)}</span></button>
    <div class="wrow"><span>AP <b>${fmt(v.ap)}</b></span><span>Best <b>R${E.optimalRange(o)}</b></span><span>Value <b>${o.val != null ? fmt(o.val) : "-"}</b></span><span>Skill <b>${fmt(v.req)}</b></span><span>Crit <b>${fmt(E.pct(v.crit))}%</b></span>${slot.jammed ? `<span class="bad">JAMMED</span>${btn("clearSlot", `${c.id}|${i}`, "Clear", "", "tiny")}` : ""}</div>${ammo}</div>`;
}
function gearPicker(c, s) {
  const m = ui.modal; const isW = s[0] === "w"; const fits = isW ? (it) => it.cat === "weapon" : (it) => it.cat === "armor" && GEAR_SLOTS[s][1](it.o);
  const q = E.low(m.pq || "");
  const held = (c.inv || []).map((l) => ({ l, it: E.get(ctx(), l.n) })).filter((x) => x.it && fits(x.it) && (!q || E.low(x.l.n).includes(q)));
  const stats = (o) => (isW ? `${fmt(o.ap || 0)} AP${o.ammo && o.ammo !== "N/A" ? " · " + o.ammo : ""}` : `DT ${fmt(o.dt || 0)}${o.buffs ? " · " + o.buffs : ""}`);
  const row = (o, tag) => `<button class="rowbtn" data-a="gearEquip" data-v="${h(o.n)}" title="${h([o.buffs, o.nerfs, o.note].filter(Boolean).join(" · "))}">${pix(itemKind(o.n)[1])}<span class="grow">${h(o.n)}</span><span class="s dim">${h(stats(o))}</span>${tag}</button>`;
  const all = q ? (isW ? DATA.weapons.filter((w) => w.tier) : DATA.armor.filter((a) => GEAR_SLOTS[s][1](a))).filter((o) => E.low(o.n).includes(q)).slice(0, 30) : [];
  return `<h3>Equip: ${isW ? `Weapon ${Number(s[1]) + 1}` : GEAR_SLOTS[s][0]}</h3><div class="row"><input id="gearQ" class="grow" autocomplete="off" placeholder="Search everything to hand one out" data-u="modal.pq" value="${h(m.pq || "")}">${btn("gearEquip", "", "Unequip", "", "tiny")}${btn("gearSlot", s, "Cancel", "", "tiny")}</div>${held.map((x) => row(x.it.o, `<span class="tag">HAS ${fmt(x.l.q)}</span>`)).join("") || (q ? "" : `<div class="s dim">Nothing that fits in this inventory. Search to hand one out.</div>`)}${all.filter((o) => !held.some((x) => x.it.o.n === o.n)).map((o) => row(o, `<span class="tag warn">NEW</span>`)).join("")}`;
}
function gearMenu(c, d) {
  const sum = {}; const rows = d.sources.filter((r) => ["Gear", "Accessory"].includes(r.cat) && r.mods);
  for (const r of rows) for (const k in r.mods) sum[k] = E.fix((sum[k] || 0) + r.mods[k]);
  const bands = Object.keys(sum).filter((k) => /^r\d+$/.test(k)); const bandVals = bands.map((k) => E.pct(sum[k])); for (const k of bands) delete sum[k];
  const list = [...modLine({ mods: sum }).split(", ").filter(Boolean), ...(bandVals.length ? [`Hit by range ${Math.max(...bandVals) > 0 ? "+" : ""}${Math.max(...bandVals)} to ${Math.min(...bandVals)}%`] : [])];
  const mods = list.map((x) => `<span class="chip ${/ -|to -/.test(x) ? "" : "pos"}">${h(x)}</span>`).join("");
  const accs = c.gear.acc[2] ? ["acc0", "acc1", "acc2"] : ["acc0", "acc1"];
  const fig = `<svg class="figsvg" viewBox="0 0 100 200" aria-hidden="true"><circle cx="50" cy="24" r="20"/><path d="M26 54h48l6 62h-14l-2 80h-12l-2-60h-4l-2 60h-12l-2-80h-14z"/></svg>`;
  return `<div class="geartop"><div class="bigdt"><b>${fmt(d.dt)}</b><span>TOTAL DT</span></div><div class="grow"><div class="s dim">FROM GEAR</div><div class="chips">${mods || `<span class="s dim">No modifiers.</span>`}</div></div><div class="s dim" style="text-align:right">Caps ${fmt(c.caps)}<br>Total ${fmt(d.enc.total)}/${fmt(d.carry)} lb<br>Active ${fmt(d.enc.active)}/${fmt(d.enc.capActive)} lb</div></div>
   <div class="gearmenu"><div class="gcol">${weaponBox(c, d, 0)}${weaponBox(c, d, 1)}${c.weapons.slice(2).map((_, i) => weaponBox(c, d, i + 2)).join("")}</div><div class="gfig">${fig}${gearBox(c, "head")}${gearBox(c, "vanity")}${gearBox(c, "armor")}</div><div class="gcol">${accs.map((s) => gearBox(c, s)).join("")}</div></div>
   ${ui.modal.pick ? `<div class="gpick">${gearPicker(c, ui.modal.pick)}</div>` : ""}`;
}
// ----- character and health menus
function sheetBody() {
  const m = ui.modal; const c = ent(m.id); if (!c) return ""; const d = der(c);
  const tabs = [["stats", "Stats"], ["perks", "Perks"], ["traits", "Traits"]].map(([id, n]) => `<button class="opt ${m.tab === id ? "on" : ""}" data-a="sheetTab" data-v="${id}">${n}</button>`).join("");
  const body = m.tab === "perks" ? perksSect(c) : m.tab === "traits" ? traitsSect(c) : `${d.m.lucky ? `<label class="rr" style="max-width:220px"><span>Lucky Number digit</span>${bindNum(c.id, "luckyDigit", c.luckyDigit != null ? c.luckyDigit : 7)}</label>` : ""}<div class="hpline" style="margin-bottom:3px"><span>DT</span>${ovCell(c, "dt", fmt(d.dt), "Damage Threshold")}<span>INIT</span>${ovCell(c, "pri", fmt(d.pri), "Initiative base")}<span>SAVE</span>${ovCell(c, "save", d.save, "Saving throw: roll at or under on a d20")}</div>${statsSect(c, d)}<h3>What's changing this character's numbers</h3>${modsSect(c, d)}`;
  return `<div class="opts" style="margin-bottom:4px">${tabs}</div>${body}`;
}
function healthBody() {
  const c = ent(ui.modal.id); if (!c) return ""; const d = der(c);
  const line = (st, i) => { const inf = E.statusInfo(ctx(), st); return `<div class="line t"><div class="grow"><span class="bright">${h(st.n)}${st.tier > 1 ? " " + st.tier : ""}</span>${st.parts ? ` <span class="s dim">${h(st.parts.map((p) => PARTS[p][0]).join(", "))}</span>` : ""}<div class="s dim">${h(inf.text || (inf.def && inf.def.desc) || "")}</div></div><label class="f" style="width:42px">Turns${bindNum(c.id, `statuses.${i}.turns`, st.turns)}</label><button class="btn tiny" data-a="delStatus" data-v="${c.id}|${i}" title="Remove">X</button></div>`; };
  const all = (c.statuses || []).map((st, i) => [st, i, (E.statusInfo(ctx(), st).def || {}).tone]);
  const good = all.filter((x) => x[2] === "Positive"), bad = all.filter((x) => x[2] !== "Positive");
  const fx = (c.effects || []).map((f, i) => `<div class="line t"><div class="grow"><span class="bright">${h(f.label)}</span><div class="s dim">${h(f.text || "")}</div></div><label class="f" style="width:42px">Turns${bindNum(c.id, `effects.${i}.turns`, f.turns)}</label><button class="btn tiny" data-a="delEffect" data-v="${c.id}|${i}" title="Remove">X</button></div>`).join("");
  const base = E.derive({ ...c, statuses: [], effects: [] }, ctx());
  const diffs = [...E.SPECIAL.map((k) => [E.SPECIAL_NAMES[k], base.sp[k], d.sp[k]]), ...E.SKILLS.map(([k, n]) => [n, base.skills[k], d.skills[k]]), ["Max HP", base.hp, d.hp], ["AP", base.ap, d.ap], ["DT", base.dt, d.dt]].filter(([, a, b]) => a !== b);
  const other = []; const acc = (d.m.acc || 0) - (base.m.acc || 0), dam = (d.m.dam || 0) - (base.m.dam || 0);
  if (acc) other.push(`Hit chance ${acc > 0 ? "+" : ""}${fmt(E.pct(acc))}%`); if (dam) other.push(`Damage ${dam > 0 ? "+" : ""}${fmt(E.pct(dam))}%`);
  return `<div class="geartop"><div class="bigdt"><b>${fmt(c.hp)}/${d.hp}</b><span>HEALTH</span></div><div class="grow">${hpBar(c.hp, d.hp)}<div class="s dim" style="margin-top:2px">AP ${fmt(c.ap)}/${d.ap} · DT ${fmt(d.dt)} · Save ${d.save}${c.dbno ? ' · <span class="bad">DOWN (DBNO)</span>' : ""}${c.timesRevived ? ` · Revived ${c.timesRevived}x` : ""}</div></div></div>
   <div class="hcols"><div><h3>Harmful</h3>${bad.map(([st, i]) => line(st, i)).join("") || `<div class="s dim">None.</div>`}<h3>Beneficial</h3>${good.map(([st, i]) => line(st, i)).join("") || `<div class="s dim">None.</div>`}${fx ? `<h3>From items</h3>${fx}` : ""}<div class="line"><input class="grow" id="addSt-${c.id}" list="dl-status" placeholder="Add status: type, Enter" data-enter="addStatusFromInput" data-id="${c.id}"></div></div>
   <div><h3>Effect on skills and stats</h3>${diffs.length ? `<table class="t"><tr><th>What</th><th>Without</th><th>Now</th></tr>${diffs.map(([n, a, b]) => `<tr><td>${h(n)}</td><td class="dim">${fmt(a)}</td><td class="${b < a ? "warn" : "bright"}">${fmt(b)}</td></tr>`).join("")}</table>` : `<div class="s dim">Nothing is changing them right now.</div>`}${other.length ? `<div class="s warn" style="margin-top:3px">${h(other.join(" · "))}</div>` : ""}</div></div>`;
}
// ----- vendor
// Barter sets the base. Perks with buy or sell variables move it from there.
function priceFactors(e, vendor) { const d = e ? der(e) : null; const f = E.barterFactors(d ? d.skills.BAR : 0, vendor); return { buy: f.buy * (1 + ((d && d.m.buy) || 0)), sell: f.sell * (1 + ((d && d.m.sell) || 0)) }; }
function vendorWin() {
  const v = S.vendor; if (!v.stock) v.stock = E.vendorStock(ctx(), v.tier);
  const c = ent(ui.sel); const bar = c ? der(c).skills.BAR : 0; const f = priceFactors(c, v.barter);
  const chipsRow = (act_, list, cur, pre = "") => list.map((x) => `<button class="opt ${x === cur ? "on" : ""}" data-a="${act_}" data-v="${x}">${pre}${x}</button>`).join("");
  const line = (name, q, price, est, a, val, label) => `<tr><td style="width:18px">${pix(itemKind(name)[1])}</td><td class="bright" title="${h((E.get(ctx(), name) || { o: {} }).o.effect || (E.get(ctx(), name) || { o: {} }).o.buffs || "")}">${h(name)}</td><td>${fmt(q)}</td><td title="${est ? "The workbook has no price for this. Placeholder from Settings." : ""}">${fmt(price)}${est ? "~" : ""}</td><td><button class="btn tiny" data-a="${a}" data-v="${h(val)}">${label}</button></td></tr>`;
  const body = !c ? `<div class="dim">Pick a character.</div>` : ui.venTab === "buy"
    ? v.stock.map((l, i) => { const p = E.valueOf(ctx(), l.n); return line(l.n, l.q, Math.max(1, Math.ceil(p.val * f.buy)), p.est, "venBuy", i, "Buy"); }).join("")
    : (c.inv || []).map((l, i) => { const p = E.valueOf(ctx(), l.n); return line(l.n, l.q, Math.floor(p.val * f.sell), p.est, "venSell", i, "Sell"); }).join("");
  return win("w-vendor", "Vendor", "", `<div class="row wrap"><span class="s dim">TIER</span>${chipsRow("venTier", [1, 2, 3, 4, 5, 6], v.tier)}<span class="s dim" style="margin-left:6px">BARTER</span>${chipsRow("venBarter", S.rules.vendorBarter, v.barter)}</div>
    <div class="row wrap" style="margin:3px 0"><button class="opt ${ui.venTab === "buy" ? "on" : ""}" data-a="venTab" data-v="buy">Buy</button><button class="opt ${ui.venTab === "sell" ? "on" : ""}" data-a="venTab" data-v="sell">Sell</button><select id="venWho" data-u="sel" title="Who is trading">${options(S.chars.map((x) => [x.id, x.name]), ui.sel)}</select><span class="bright">${c ? fmt(c.caps) : 0} caps</span><span class="s dim">Barter ${fmt(bar)} · Buy x${fmt(Math.round(f.buy * 100) / 100)} · Sell x${fmt(Math.round(f.sell * 100) / 100)}</span></div>
    <table class="t"><tr><th></th><th>Item</th><th>Qty</th><th>Caps</th><th></th></tr>${body || `<tr><td colspan="5" class="dim">Nothing here.</td></tr>`}</table>`, { tools: btn("venRoll", "", "Restock", "", "tiny", "New stock at this tier") });
}
function statsSect(c, d) {
  return `<div class="grid">${field("AP now", bindNum(c.id, "ap", c.ap))}${field("Caps", bindNum(c.id, "caps", c.caps))}${field(`XP (next ${E.xpFor(c.level + 1, S.rules)})`, bindNum(c.id, "xp", c.xp))}${field("Level", bindNum(c.id, "level", c.level))}${field("Revived", bindNum(c.id, "timesRevived", c.timesRevived))}${field("Super crit %", numBox(`data-c="setSuper" data-id="${c.id}" id="sc-${c.id}" placeholder="${fmt(E.pct(d.superCrit))}"`, c.superCrit == null ? "" : E.pct(c.superCrit)))}</div>
    <div class="s dim">Carry ${fmt(d.carry)} lb · Active ${fmt(d.enc.active)}/${fmt(d.enc.capActive)} lb · Total ${fmt(d.enc.total)} lb · Skill pts/level ${d.pts}${c.ptsBank ? ` · Unspent ${c.ptsBank}` : ""} · Buy ×${fmt(d.buy)} · Sell ×${fmt(d.sell)}</div>
    ${c.ptsBank ? btn("spendPts", c.id, "Spend skill points", "", "tiny") : ""}
    ${field("Notes", `<textarea rows="2" data-bind="${c.id}:notes" spellcheck="false">${h(c.notes)}</textarea>`)}`;
}
function traitsSect(c) {
  return (c.traits || []).filter(Boolean).map((code) => {
    const t = traitV(db.traitByCode.get(code)); if (!t) return `<div class="txt bad">Unknown trait ${h(code)}</div>`;
    const variants = DATA.sc.filter((r) => E.low(r.n).startsWith(E.low(t.n) + " ("));
    return `<div class="txt"><span class="bright">${h(code)} ${h(t.n)}</span> <span class="s dim">${h(t.cat)}</span><br>+ ${h(t.ben)}<br>- ${h(t.draw)}
      ${t.evo || t.rep ? `<div class="s dim">${t.evo ? `Evolves: ${h(t.evo)}${t.evoBonus ? `: ${h(t.evoBonus)}` : ""}${t.evoTrig ? ` (when: ${h(t.evoTrig)})` : ""}` : ""}${t.rep ? ` · Represses: ${h(t.rep)}${t.repBonus ? `: ${h(t.repBonus)}` : ""}` : ""}${t.fail ? ` (fail: ${h(t.fail)})` : ""}</div>` : ""}
      <div class="row wrap"><select data-bind="${c.id}:evolved.${code}" title="Trait state">${options([["", "Base"], ...(t.evo ? [["E", "Evolved"]] : []), ...(t.rep ? [["R", "Repressed"]] : [])], (c.evolved || {})[code] || "")}</select>
      ${variants.map((r) => `<label class="chk s"><input type="checkbox" data-a="toggleVariant" data-v="${c.id}|${h(r.n)}"${(c.variants || []).includes(r.n) ? " checked" : ""}>${h(r.n.replace(t.n, "").trim())}</label>`).join(" ")}</div></div>`;
  }).join("") || `<div class="dim">No traits. Press E to pick them.</div>`;
}
function perksSect(c) {
  const rows = (c.perks || []).map((p) => { const i = perkInfo(p); const auto = (db.sc.get(E.low(p)) || []).some((r) => r.mods); return `<div class="line t"><div class="grow"><span class="bright">${h(p)}</span> <span class="tag">${auto ? "AUTO" : "REMINDER"}</span><div class="s dim">${h(i ? i.effect : "")}</div></div>${btn("delPerk", `${c.id}|${p}`, "X", "", "tiny", "Remove")}</div>`; }).join("");
  return `${rows}<div class="line"><input class="grow" id="addPerk-${c.id}" list="dl-perks" placeholder="Add perk: type, Enter" data-enter="addPerk" data-id="${c.id}"></div>`;
}
const ITEM_ICON = { Healing: "cross", "Chem/Drug": "syringe", Alcohol: "bottle", Drink: "cup", Food: "apple", Counter: "shield", Literature: "book", Tobacco: "smoke", Resistance: "shield", Poison: "skull", Tool: "wrench" };
function itemKind(name) {
  const it = E.get(ctx(), name); if (!it) return ["Other", "dot"];
  const o = it.o;
  if (it.cat === "weapon") return o.tab === "MW" ? ["Melee", "sword"] : o.tab === "EW" ? ["Energy weapons", "bolt"] : o.tab === "EX" ? ["Explosives", "bomb"] : ["Guns", "gun"];
  if (it.cat === "ammo") return ["Ammo", "ammo"];
  if (it.cat === "armor") return o.loc === "Accessory" ? ["Accessories", "ring"] : ["Armor", "vest"];
  if (it.cat === "material") return ["Materials", "nut"];
  if (it.cat === "mod") return ["Mods", "scope"];
  if (it.cat === "item") return [o.cat || "Items", ITEM_ICON[o.cat] || "dot"];
  return ["Other", "dot"];
}
function invSect(c, d) {
  const q = E.low(ui.modal.q || "");
  const groups = new Map();
  (c.inv || []).forEach((l, i) => { if (q && !E.low(l.n).includes(q)) return; const [g, ic] = itemKind(l.n); if (!groups.has(g)) groups.set(g, { ic, rows: [] }); groups.get(g).rows.push([l, i]); });
  const body = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, x]) => `<h3 class="igroup">${pix(x.ic)}${h(g)}</h3>${x.rows.map(([l, i]) => { const it = E.get(ctx(), l.n); const canUse = it && it.cat === "item" && usable(it.o); return `<div class="irow"><span class="iq">${numBox(`data-c="setQty" data-id="${c.id}" data-i="${i}" id="q-${c.id}-${i}" title="How many"`, fmt(l.q), "cell")}</span><span class="grow" title="${h(it && it.o.effect ? it.o.effect : "")}">${h(l.n)}${it && it.o.effect ? ` <span class="s dim">${h(it.o.effect)}</span>` : ""}</span><span class="s faint">${fmt(E.weightOf(ctx(), l.n) * l.q)}lb</span><label class="chk s" title="Active: on hand during combat"><input type="checkbox" data-a="invActive" data-v="${c.id}|${i}"${l.active ? " checked" : ""}>ACTIVE</label>${canUse ? `<button class="btn tiny" data-a="useItemFrom" data-v="${c.id}|${i}">Use</button>` : ""}<button class="btn tiny" data-a="invDel" data-v="${c.id}|${i}" title="Remove">X</button></div>`; }).join("")}`).join("");
  return `${gearMenu(c, d)}<div class="row wrap" style="margin:4px 0"><input id="addItem-${c.id}" class="grow" autocomplete="off" list="dl-all" placeholder="Add item: type, Enter" data-enter="addItem" data-id="${c.id}"><input id="invQ" autocomplete="off" style="width:110px" placeholder="Filter" data-u="modal.q" value="${h(ui.modal.q || "")}"></div>${body || `<div class="dim">Nothing here.</div>`}`;
}
function weaponRows(e, d) {
  return (e.weapons || []).map((s, i) => {
    const v = E.weaponView(s, e, d, ctx());
    const loads = v.caliber ? E.loadsFor(ctx(), v.caliber) : [];
    return `<div class="line t"><div class="grow"><input style="width:100%" autocomplete="off" data-c="setWeapon" data-id="${e.id}" data-i="${i}" id="w-${e.id}-${i}" list="dl-weapons" value="${h(s.n)}">
      <div class="s dim">${v.missing ? "unknown weapon" : `${v.melee ? "melee" : h(v.type)} · ${fmt(v.ap)} AP · ${v.count > 1 ? `burst ${v.count} · ` : ""}Dam ${fmt(v.base)} Pen ${fmt(v.pen)}${v.ok ? "" : ` · <span class="warn">blank stats</span>`}${s.jammed ? ` · <span class="bad">JAMMED</span>` : ""}`}</div>
      ${loads.length ? `<select style="width:100%" data-c="setLoad" data-id="${e.id}" data-i="${i}" id="l-${e.id}-${i}"><option value="">Choose ammo</option>${options(loads.map((a) => [a.n, `${a.load}: Dam ${a.pellets ? a.dam + "x" + a.pellets : a.dam ?? "?"} Pen ${a.pen ?? 0}`]), s.ammo)}</select>` : ""}</div>
      ${v.usesAmmo ? `<label class="f" style="width:48px">Mag/${v.cap}${bindNum(e.id, `weapons.${i}.mag`, s.mag)}</label>${btn("reloadSlot", `${e.id}|${i}`, "Reload", "", "tiny")}` : ""}${s.jammed ? btn("clearSlot", `${e.id}|${i}`, "Clear", "", "tiny") : ""}<button class="btn tiny" data-a="delWeapon" data-v="${e.id}|${i}" title="Remove">X</button></div>`;
  }).join("") + `<div class="line"><input class="grow" id="addW-${e.id}" list="dl-weapons" placeholder="Add weapon: type, Enter" data-enter="addWeapon" data-id="${e.id}"></div>`;
}
function statusSect(e) {
  const rows = (e.statuses || []).map((st, i) => { const inf = E.statusInfo(ctx(), st); const tiers = (inf.def && inf.def.tiers) || []; return `<div class="line t"><div class="grow"><span class="bright">${h(st.n)}</span><div class="s dim">${h(inf.text)}</div></div>${tiers.filter(Boolean).length > 1 ? `<label class="f" style="width:42px">Tier<select data-bind="${e.id}:statuses.${i}.tier" data-t="num">${options([1, 2, 3, 4, 5], st.tier)}</select></label>` : ""}<label class="f" style="width:42px">Turns${bindNum(e.id, `statuses.${i}.turns`, st.turns)}</label><button class="btn tiny" data-a="delStatus" data-v="${e.id}|${i}" title="Remove">X</button></div>`; }).join("");
  const fx = (e.effects || []).map((f, i) => `<div class="line t"><div class="grow"><span class="bright">${h(f.label)}</span><div class="s dim">${h(f.text || "")}</div></div><label class="f" style="width:42px">Turns${bindNum(e.id, `effects.${i}.turns`, f.turns)}</label><button class="btn tiny" data-a="delEffect" data-v="${e.id}|${i}" title="Remove">X</button></div>`).join("");
  return `${rows}${fx}<div class="line"><input class="grow" id="addSt-${e.id}" list="dl-status" placeholder="Add status: type, Enter" data-enter="addStatusFromInput" data-id="${e.id}"></div>`;
}
function modLine(row) {
  const L = { hpMul: "Max HP x", hp: "HP", dt: "DT", ap: "AP", apMul: "AP %", carry: "Carry", carryMul: "Carry %", pri: "Init", save: "Save", pts: "Skill pts", acc: "Hit %", enemyAcc: "Enemy hit %", dam: "Damage %", crit: "Crit %", apCost: "Attack AP", reload: "Reload AP", pen: "Pen" };
  const pctKeys = new Set(["acc", "enemyAcc", "dam", "crit", "apMul", "carryMul", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"]);
  return Object.entries(row.mods || {}).map(([k, v]) => { const label = SP_LABEL[k] || SKILL_NAME[k] || L[k] || (/^r\d+$/.test(k) ? `Hit R${k.slice(1)} %` : k); const val = pctKeys.has(k) ? E.pct(v) : v; return `${label} ${k === "hpMul" ? val : (val > 0 ? "+" : "") + val}`; }).join(", ");
}
function modsSect(c, d) {
  return d.sources.map((r) => `<div class="txt"><span class="bright">${h(r.n)}</span> <span class="s dim">${h(r.cat || "")}</span>${r.mods ? `<div class="s">${h(modLine(r))}</div>` : ""}${r.note ? `<div class="s dim">${h(r.note)}</div>` : ""}</div>`).join("") || `<div class="dim">Nothing is changing this character's numbers.</div>`;
}

// ----- situation windows
function consoleWin() {
  const k = K();
  if (k.phase === "end") return win("w-action", "After action", "", endStage());
  if (k.phase === "defeat") return win("w-action", "Defeat", "", defeatStage());
  const stage = { stealth: stealthStage, init: initStage, turns: turnStage, roundEnd: roundEndStage }[k.phase]();
  const title = k.phase === "turns" ? `Round ${k.round}: ${h((ent(k.turnId) || {}).name || "")}` : k.phase === "roundEnd" ? `End of round ${k.round}` : k.phase === "init" ? "Roll initiative" : "Stealth phase";
  return win("w-action", title, "", stage, { tools: k.phase === "turns" || k.phase === "roundEnd" ? `${btn("endCombat", "", "End", "Q", "tiny")}${btn("defeat", "", "Defeat", "D", "tiny")}` : "" });
}
function mapOptions() {
  return Object.entries(S.rules.maps).map(([id, m]) => [id, id === "custom" ? m.n : `${m.n} ${m.w}x${m.h}m`]);
}
function encounterWin(open) {
  if (!open) return `<section class="win w-enc closed"><header class="wt"><span>Encounter</span></header><div class="wb"><div class="row"><span class="s dim grow">No fight running.</span><button class="btn primary" data-primary="1" data-a="setupOpen" data-v="1">${kbd("B")}Set up encounter</button></div></div></section>`;
  const sc = S.scene; const M = mapOf();
  const fx = sc.effects.map((f, i) => `<span class="chip neu">${h(f.label)}${f.hit ? ` ${f.who === "enemies" ? "enemy" : f.who === "party" ? "party" : "all"} ${E.pct(f.hit) > 0 ? "+" : ""}${E.pct(f.hit)}%` : ""}<button class="xb" data-a="delEffectScene" data-v="${i}" title="Remove">x</button></span>`).join("");
  const tools = `${btn("beginC", "1", "Sneak", "H", "tiny")}<button class="btn primary tiny" data-a="beginC" data-v="">${kbd("B")}Begin</button>${btn("setupOpen", "", "Close", "", "tiny", "Hide the map. Enemies you added stay in the list.")}`;
  return `<section class="win w-enc"><header class="wt"><span>Encounter setup</span><span class="spacer"></span>${tools}</header><div class="wb" style="padding:0"><div class="enctop">
    <div class="row"><label class="f" style="flex:1.7 1 0">Location<select id="mapId" data-c="setMapId">${options(mapOptions(), M.id)}</select></label>${M.id === "custom" ? `<label class="f" style="width:44px">W m${numBox(`id="mapW" data-c="setMapSize" data-k="w"`, M.w)}</label><label class="f" style="width:44px">H m${numBox(`id="mapH" data-c="setMapSize" data-k="h"`, M.h)}</label>` : ""}<label class="f">Time<select data-scene="time" id="scT">${options(SITES("Time/Light"), sc.time)}</select></label><label class="f">Weather<select data-scene="weather" id="scW">${options(SITES("Weather"), sc.weather)}</select></label><label class="f">Terrain<select data-scene="env" id="scE">${options(SITES("Environment"), sc.env)}</select></label></div>
    <div class="row wrap">${fx}<input class="grow" id="fxLabel" autocomplete="off" placeholder="Effect from a check" data-u="fxLabel" value="${h(ui.fxLabel)}" data-enter="addFx"><select data-u="fxWho" id="fxWho" title="Whose attacks change">${options([["enemies", "Enemy hit"], ["party", "Party hit"], ["all", "All hit"]], ui.fxWho)}</select><input type="text" inputmode="decimal" id="fxHit" style="width:34px" placeholder="%" data-u="fxHit" value="${h(ui.fxHit)}" data-enter="addFx">${btn("addFx", "", "Add", "", "tiny")}${btn("fxDark", "", "Dark -10", "", "tiny", "Darkness: enemies -10 to hit")}</div>
    <div class="row wrap"><label class="s dim">Setting <select id="themeId" data-c="setTheme">${options(Object.entries(S.rules.roomThemes).map(([id, t]) => [id, t.n]), sc.theme)}</select></label><button class="btn tiny primary" data-a="randomRoom" data-v="" title="New furniture for this location and setting">Randomize room</button>${btn("clearRoom", "", "Clear", "", "tiny", "Remove all objects")}<span class="spacer"></span>${btn("scatter", "", "Random", "", "tiny", "Random spots for every enemy")}${btn("surround", "", "Surround", "", "tiny", "Space enemies evenly around the party")}<span class="spacer"></span>${mapTools()}</div></div>${mapExtras()}${mapSvg()}</div></section>`;
}
function fightMap() {
  const k = K(); const M = mapOf();
  const strip = k.phase === "init" || k.phase === "stealth" ? "" : `<div class="strip">${order().filter(alive).map((c) => { const e = ent(c.id); return `<button class="chipb ${c.id === k.turnId ? "on" : ""} ${e.kind === "pc" ? "" : e.ally ? "ally" : "foe"} ${k.acted[c.id] && c.id !== k.turnId ? "done" : ""}" data-a="select" data-v="${c.id}" title="${h(e.name)}: initiative ${fmt(c.init)}">${fmt(c.init)} ${h(tokenLabel(e))}</button>`; }).join("")}</div>`;
  return `<section class="win w-map"><header class="wt"><span>${h(M.n)} <span class="dim">${M.w}x${M.h}m</span></span><span class="spacer"></span>${mapTools()}</header><div class="wb" style="padding:0">${strip}${mapExtras()}${mapSvg()}</div></section>`;
}
const mapTools = () => Object.entries(MAP_OBJ).filter(([, x]) => x[1]).map(([id, [n]]) => `<button class="btn tiny ${ui.place === id ? "on" : ""}" data-a="mapPlace" data-v="${id}" title="Then click the map to place ${h(n.toLowerCase())}">+${h(n.split(" ")[0])}</button>`).join("");
function mapExtras() {
  const pm = ui.pendingMove && ent(ui.pendingMove.id);
  if (pm) { const m = ui.pendingMove; const left = (pm.ap || 0) - m.cost; const tgt = ui.atk && ui.atk.tgt && ui.atk.att === m.id && ent(ui.atk.tgt); const newR = tgt ? bandFor(dist(m, posOf(tgt.id))) : null; return `<div class="moveconfirm"><span class="bright">Move ${h(pm.name)}?</span><span><b>${fmt(m.cost)}</b> AP</span><span><b>${fmt(left)}</b> left</span>${tgt ? `<span>${h(tgt.name)}: <b>R${rangeOf(m.id, tgt.id)} to R${newR}</b></span>` : ""}<span class="spacer"></span><button class="btn primary tiny" data-primary="1" data-a="moveConfirm" data-v="">${kbd("Enter")}Confirm</button><button class="btn tiny" data-a="moveCancel" data-v="">${kbd("Esc")}Cancel</button></div>`; }
  const sel = ui.mapSel && S.scene.objects.find((o) => o.id === ui.mapSel);
  return `${sel ? `<div class="maptools"><span class="s dim">${h(((S.rules.mapItems[sel.item] || {}).n || MAP_OBJ[sel.kind][0]).toUpperCase())}</span><span class="rotbar"><button class="btn tiny" data-a="objRotate" data-v="-15" title="Turn left 15 degrees (or Shift+scroll)">&#8634;</button><span style="width:30px">${numBox(`id="objAngle" data-c="setObjAngle" title="Angle in degrees"`, sel.angle || 0, "cell")}</span><button class="btn tiny" data-a="objRotate" data-v="15" title="Turn right 15 degrees (or Shift+scroll)">&#8635;</button><button class="btn tiny" data-a="objRotate" data-v="90" title="Turn a quarter">90</button></span><select id="objCover" data-c="setObjCover" title="Cover tier">${options(Object.entries(S.rules.cover).map(([id, t]) => [id, t.n]), E.coverTier(sel, S.rules))}</select><label class="chk s"><input type="checkbox" data-a="objBlock" data-v="${sel.id}"${sel.block ? " checked" : ""}>Blocks walking</label><input id="objLabel" autocomplete="off" class="grow" placeholder="Label" data-c="setObjLabel" value="${h(sel.label || "")}">${btn("objDel", sel.id, "Remove", "", "tiny")}</div>` : ""}${!sel && !ui.place ? `<div class="maptools s dim maphint">Click an object to select it, then drag its round handle to turn it.</div>` : ""}${ui.place ? `<div class="maptools warn s">Click the map to place ${h(MAP_OBJ[ui.place][0].toLowerCase())}. Esc to stop.</div>` : ""}`;
}
const SITES = (sub) => db.situations.filter((r) => r.sub === sub).map((r) => [r.n, r.n === "Grassland" ? "Grassland (Plains)" : r.n]);
function enemyTab() {
  const k = K(); const list = foes();
  const showList = ui.enemyQ || (!k && !list.length && setupOpen());
  const sort = ui.enemySort || "faction";
  const fac = (t) => (t.named ? " Named" : t.faction || "Unaligned");  // the space puts saved NPCs first
  const byName = (a, b) => a.n.localeCompare(b.n, undefined, { numeric: true });
  const cmp = { faction: (a, b) => fac(a).localeCompare(fac(b)) || (a.tier || 0) - (b.tier || 0) || byName(a, b), tier: (a, b) => (a.tier || 0) - (b.tier || 0) || byName(a, b), az: byName }[sort];
  // typing ranks by the name, so the closest match stays on top; with no text the sort decides
  const found = showList ? (ui.enemyQ ? rankByName(allTemplates(), ui.enemyQ) : allTemplates().sort(cmp)).filter((t) => !ui.enemyTier || String(t.tier) === String(ui.enemyTier)) : [];
  const head = (t, i) => (sort === "faction" && !ui.enemyQ && (i === 0 || fac(found[i - 1]) !== fac(t)) ? `<div class="grouphead">${h(fac(t).trim())}</div>` : "");
  const rows = found.map((t, i) => `${head(t, i)}<button class="rowbtn" data-a="addPick" data-v="${h(t.n)}" title="${h(t.faction || "Unaligned")} · ${t.mob ? `HP ${t.hp ?? "?"} DT ${t.dt ?? 0}` : "Human"} · XP ${t.xp || 0}"><span class="tag">T${t.tier}</span><span class="grow">${h(t.n)}${t.named ? ` <span class="tag hi">NAMED</span>` : ""}</span>${sort !== "faction" || ui.enemyQ ? `<span class="s dim">${h(fac(t).trim())}</span>` : ""}</button>`).join("");
  const counts = new Map(); for (const n of list) counts.set(n.tmpl, (counts.get(n.tmpl) || 0) + 1);
  const groups = k ? "" : [...counts.entries()].map(([t, c]) => `<div class="line"><button class="btn tiny" data-a="pickQty" data-v="${h(t)}|-1" title="One fewer">-</button><span class="bright" style="width:16px;text-align:center">${c}</span><button class="btn tiny" data-a="pickQty" data-v="${h(t)}|1" title="One more">+</button><span class="grow nm">${h(t)}</span></div>`).join("");
  return `<div class="row" style="margin-bottom:3px"><input class="grow" id="enemyQ" autocomplete="off" style="min-width:0" placeholder="Add: type, Enter" data-u="enemyQ" data-enter="addFirstEnemy" value="${h(ui.enemyQ)}"><select data-u="enemyTier" title="Tier" id="enemyTier" style="width:50px">${options([["", "All"], ...[1, 2, 3, 4, 5, 6].map((t) => [t, "T" + t])], ui.enemyTier)}</select><select data-u="enemySort" title="Sort the list" id="enemySort" style="width:84px">${options([["faction", "Faction"], ["tier", "Tier"], ["az", "A-Z"]], sort)}</select></div>
    ${showList ? `<div class="s dim">${found.length} enemies</div>` : ""}
    ${found.length ? `<div class="results" data-scroll="enemyres">${rows}</div>` : ""}${groups ? `<div style="margin-bottom:3px">${groups}</div>` : ""}<div class="cards one">${(k ? order().map((c) => ent(c.id)).filter((e) => e && e.kind === "npc") : list).map(enemyCard).join("")}</div>`;
}
function enemyCard(e) {
  const k = K(); const d = der(e); const cb = cbOf(e.id); const me = k ? actorId() : null; const slot = (e.weapons || [])[e.activeW || 0];
  const gone = cb && !alive(cb);
  const rangeBox = me && me !== e.id ? numBox(`data-c="setRange" data-id="${e.id}" id="rr-${e.id}" title="Range from ${h((ent(me) || {}).name)}"`, rangeOf(me, e.id), "cell") : !k && ui.sel ? numBox(`data-c="setBand" data-id="${e.id}" id="rr-${e.id}" title="Range from ${h((ent(ui.sel) || {}).name)}. Type a band to move this enemy."`, rangeOf(ui.sel, e.id), "cell") : "";
  return `<article class="card foe ${e.ally ? "ally" : ""} ${ui.rowSel === e.id ? "sel" : ""} ${gone ? "dead" : ""} ${k && k.turnId === e.id ? "cur" : ""} ${ui.atk && ui.atk.tgt === e.id ? "tgt" : ""}" data-a="pick" data-v="${e.id}">
    <header class="chead">${cb && cb.init != null ? numBox(`data-c="setInit" data-id="${e.id}" id="in-${e.id}" title="Initiative"`, fmt(cb.init), "cell init") : ""}<span class="nm grow" title="${h(slot ? slot.n : "No weapon")}">${h(e.name)}</span><span class="tag">T${e.tier}</span>${e.boss ? `<span class="tag hi">BOSS</span>` : ""}${cb && cb.dead ? `<span class="tag bad">DEAD</span>` : ""}${cb && cb.fled ? `<span class="tag">FLED</span>` : ""}<button class="btn tiny ${e.ally ? "on" : ""}" data-a="toggleAlly" data-v="${e.id}" title="Blue tokens fight on the party's side">Ally</button>${btn("edit", e.id, "E", "", "tiny", "Edit this copy")}</header>
    <div class="hpline"><span>HP</span>${bindNum(e.id, "hp", e.hp, `id="rh-${e.id}"`, "cell")}<span>/${d.hp}</span><span class="grow">${hpBar(e.hp, d.hp)}</span></div>
    <div class="hpline"><span>AP</span>${bindNum(e.id, "ap", e.ap, `id="ra-${e.id}"`, "cell")}<span>/${d.ap}</span><span>DT ${fmt(d.dt)}</span><span class="grow"></span>${rangeBox ? `<span class="bright">R</span>${rangeBox}` : ""}</div>${chips(e)}</article>`;
}
function tokenLabel(e) {
  const w = String(e.name).split(/\s+/); const num_ = /^\d+$/.test(w[w.length - 1]) ? w.pop() : "";
  return (w.length > 1 && !num_ ? w[0][0] + w[1][0] : w[0].slice(0, num_ ? 1 : 2)).toUpperCase() + num_;
}
// PEOPLE ON THE MAP. Zoomed out they keep a steady size on screen, about 2% of the view, so you can always find them.
// As you zoom in they stop shrinking at real life size, so up close they look like a person next to a real-size table.
const TOKEN_VIEW = 0.021, TOKEN_REAL = 0.62;
const tokenScale = (viewW) => Math.max(TOKEN_REAL, viewW * TOKEN_VIEW);
const ZOOM_MIN_VIEW = 5;  // the closest zoom: 5 meters across
// What part of the map is on screen. No zoom means the whole map with a small margin.
function mapView() {
  const M = mapOf(); const pad = Math.max(M.w, M.h) * 0.03; const W = M.w + 2 * pad, H = M.h + 2 * pad; const z = ui.zoom;
  if (!z) return { x: -W / 2, y: -H / 2, w: W, h: H, W, H };
  const w = W / z.k, h = H / z.k;
  return { x: clamp(z.x - w / 2, -W / 2, W / 2 - w), y: clamp(z.y - h / 2, -H / 2, H / 2 - h), w, h, W, H };
}
function setZoom(k, cx, cy) {
  const v = mapView(); const maxK = Math.max(1, v.W / ZOOM_MIN_VIEW); const nk = clamp(k, 1, maxK);
  ui.zoom = nk <= 1.001 ? null : { k: nk, x: cx != null ? cx : v.x + v.w / 2, y: cy != null ? cy : v.y + v.h / 2 };
}
// ----- top-down drawings, in a 1 by 1 box that gets stretched to the object's real size in meters. "d" lines are details.
const lobes = (r, n, cx = 0, cy = 0) => { let p = ""; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const x = (cx + r * Math.cos(a)).toFixed(3), y = (cy + r * Math.sin(a)).toFixed(3); p += i ? `A${(r * 0.42).toFixed(3)} ${(r * 0.42).toFixed(3)} 0 0 1 ${x} ${y}` : `M${x} ${y}`; } return p + "Z"; };
const box = (x, y, w, h, c = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${c ? ` class="${c}"` : ""}/>`;
const dline = (d) => `<path class="d" d="${d}"/>`;
const CIRC = (r, x = 0, y = 0, c = "") => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r}"${c ? ` class="${c}"` : ""}/>`;
const GLYPH = {
  tree: `<path d="${lobes(0.4, 9)}"/>${dline(lobes(0.22, 7))}`,
  bush: `<path d="${lobes(0.3, 6, -0.12, -0.08)}"/><path d="${lobes(0.26, 6, 0.16, 0.12)}"/>`,
  rock: `<path d="M-.46 -.1L-.2 -.46L.26 -.42L.48 -.04L.3 .42L-.24 .46Z"/>${dline("M-.2 -.2L.05 .05L.28 -.1M.05 .05L-.05 .3")}`,
  dune: `<ellipse rx=".5" ry=".46"/>${dline("M-.36 .12Q0 -.22 .36 .12M-.24 .28Q0 .04 .24 .28")}`,
  cactus: `${box(-0.1, -0.46, 0.2, 0.92)}${box(-0.4, -0.12, 0.8, 0.18)}`,
  log: `${box(-0.5, -0.4, 1, 0.8)}${dline("M-.5 0H.5")}<ellipse class="d" cx=".42" cy="0" rx=".06" ry=".28"/>`,
  stump: `${CIRC(0.45)}${CIRC(0.3, 0, 0, "d")}${CIRC(0.12, 0, 0, "d")}`,
  desk: `${box(-0.5, -0.5, 1, 1)}${box(-0.42, -0.42, 0.28, 0.5, "d")}`,
  lDesk: `<path d="M-.5 -.5H.5V-.12H-.12V.5H-.5Z"/>${dline("M-.38 -.38H-.12V-.12H-.38Z")}`,
  table: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 0H.5")}`,
  kitchenTable: `${box(-0.34, -0.3, 0.68, 0.6)}${box(-0.26, -0.48, 0.16, 0.14)}${box(0.1, -0.48, 0.16, 0.14)}${box(-0.26, 0.34, 0.16, 0.14)}${box(0.1, 0.34, 0.16, 0.14)}`,
  chair: `${box(-0.38, -0.3, 0.76, 0.7)}${box(-0.42, -0.48, 0.84, 0.16)}`,
  bed: `${box(-0.5, -0.5, 1, 1)}${box(-0.46, -0.42, 0.26, 0.84, "pale")}${dline("M-.14 -.5V.5")}`,
  toilet: `${box(-0.46, -0.5, 0.92, 0.32)}<ellipse cx="0" cy=".14" rx=".42" ry=".36"/><ellipse class="d" cx="0" cy=".16" rx=".24" ry=".2"/>`,
  bathtub: `<rect x="-.5" y="-.5" width="1" height="1" rx=".14" ry=".3"/><rect class="d" x="-.4" y="-.32" width=".8" height=".64" rx=".12" ry=".3"/>${CIRC(0.03, -0.3, 0, "dot")}`,
  sink: `${box(-0.5, -0.5, 1, 1)}<ellipse class="d" rx=".3" ry=".28"/>${CIRC(0.05, 0, -0.34, "dot")}`,
  stove: `${box(-0.5, -0.5, 1, 1)}${CIRC(0.15, -0.22, -0.22, "d")}${CIRC(0.15, 0.22, -0.22, "d")}${CIRC(0.15, -0.22, 0.22, "d")}${CIRC(0.15, 0.22, 0.22, "d")}`,
  fridge: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 .2H.5M.3 .28V.42")}`,
  couch: `${box(-0.5, -0.5, 1, 1)}${box(-0.5, -0.5, 1, 0.3, "d")}${dline("M0 -.2V.5M-.38 -.2V.5M.38 -.2V.5")}`,
  shelves: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 0H.5M-.25 -.5V.5M0 -.5V.5M.25 -.5V.5")}`,
  crate: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.5L.5 .5M.5 -.5L-.5 .5")}${box(-0.38, -0.38, 0.76, 0.76, "d")}`,
  pallet: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.3H.5M-.5 -.1H.5M-.5 .1H.5M-.5 .3H.5")}`,
  barrel: `${CIRC(0.46)}${CIRC(0.3, 0, 0, "d")}`,
  barrels: `${CIRC(0.24, -0.25, 0)}${CIRC(0.24, 0.25, 0)}${CIRC(0.12, -0.25, 0, "d")}${CIRC(0.12, 0.25, 0, "d")}`,
  machine: `${box(-0.5, -0.5, 1, 1)}${CIRC(0.28, 0, 0, "d")}${dline("M-.5 -.5L-.2 -.2M.5 -.5L.2 -.2M-.5 .5L-.2 .2M.5 .5L.2 .2")}`,
  conveyor: `${box(-0.5, -0.5, 1, 1)}${dline("M-.4 -.5V.5M-.2 -.5V.5M0 -.5V.5M.2 -.5V.5M.4 -.5V.5")}`,
  bars: `${box(-0.5, -0.5, 1, 1)}${dline("M-.4 -.5V.5M-.3 -.5V.5M-.2 -.5V.5M-.1 -.5V.5M0 -.5V.5M.1 -.5V.5M.2 -.5V.5M.3 -.5V.5M.4 -.5V.5")}`,
  sandbags: `<ellipse cx="-.34" cy="0" rx=".18" ry=".46"/><ellipse cx="0" cy="0" rx=".18" ry=".46"/><ellipse cx=".34" cy="0" rx=".18" ry=".46"/>`,
  stoneWall: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 0H.5M-.33 -.5V0M-.08 -.5V0M.17 -.5V0M.42 -.5V0M-.2 0V.5M.05 0V.5M.3 0V.5")}`,
  plainWall: `${box(-0.5, -0.5, 1, 1)}`,
  building: `${box(-0.5, -0.5, 1, 1)}${box(-0.42, -0.42, 0.84, 0.84, "d")}${box(-0.12, -0.12, 0.24, 0.24, "d")}${dline("M-.42 -.42L-.12 -.12M.42 -.42L.12 -.12M-.42 .42L-.12 .12M.42 .42L.12 .12")}`,
  car: `<rect x="-.5" y="-.46" width="1" height=".92" rx=".14" ry=".2"/>${box(-0.14, -0.36, 0.14, 0.72, "pale")}${box(0.2, -0.32, 0.1, 0.64, "pale")}`,
  bus: `<rect x="-.5" y="-.46" width="1" height=".92" rx=".04" ry=".2"/>${box(0.36, -0.36, 0.08, 0.72, "pale")}${dline("M-.4 0H.3")}`,
  rubble: `<path d="M-.5 .1L-.2 -.4L.05 -.1L-.1 .3Z"/><path d="M.05 .4L.15 -.2L.5 0L.4 .45Z"/><path d="M-.45 .45L-.3 .2L-.1 .46Z"/>`,
  fire: `${CIRC(0.46, 0, 0, "d")}<path d="M0 -.3L.1 -.08L.3 0L.1 .08L0 .3L-.1 .08L-.3 0L-.1 -.08Z"/>`,
  dot: `${CIRC(0.4)}`,
  bedroll: `<rect x="-.5" y="-.46" width="1" height=".92" rx=".2" ry=".4"/>${dline("M-.2 -.46V.46")}`,
  sheet: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 0H.5")}`,
  forklift: `${box(-0.2, -0.5, 0.7, 1)}${box(-0.5, -0.36, 0.3, 0.14)}${box(-0.5, 0.22, 0.3, 0.14)}${box(0, -0.3, 0.26, 0.6, "pale")}`,
};
const ITEM_GLYPH = { desk: "desk", officeChair: "chair", cabinet: "crate", bookshelf: "shelves", copier: "machine", cooler: "barrel", pottedPlant: "bush", partition: "plainWall", couch: "couch", officeSafe: "machine", conveyor: "conveyor", pressMachine: "machine", boiler: "barrel", workbench: "table", oilDrum: "barrel", pipeRack: "bars", generator: "machine", toolCart: "table", shelves: "shelves", crate: "crate", crateStack: "crate", pallet: "pallet", forklift: "forklift", barrels: "barrels", cellBars: "bars", lockers: "shelves", sandbags: "sandbags", bench: "table", frontCounter: "table", armoryCage: "bars", bedroll: "bedroll", cot: "bed", footlocker: "crate", campfire: "fire", tarpWall: "sheet", tentPole: "dot", smallRock: "rock", rock: "rock", boulder: "rock", dune: "dune", cactus: "cactus", deadTree: "tree", wreck: "car", ruinWall: "stoneWall", bush: "bush", tree: "tree", bigTree: "tree", log: "log", thicket: "bush", stump: "stump", car: "car", bus: "bus", dumpster: "crate", mailbox: "plainWall", hydrant: "dot", lamppost: "dot", barricade: "plainWall", rubble: "rubble", building: "building", concreteWall: "plainWall", lDesk: "lDesk", kitchenTable: "kitchenTable", bed: "bed", toilet: "toilet", bathtub: "bathtub", sink: "sink", stove: "stove", fridge: "fridge", dresser: "shelves", stoneWall: "stoneWall", pillar: "plainWall" };
const KIND_GLYPH = { cover: "crate", hard: "plainWall", wall: "plainWall", tree: "tree", hazard: null, note: "dot" };
const MAP_OBJ = { cover: ["Cover", 1], hard: ["Hard cover", 1], hazard: ["Hazard", 1], note: ["Marker", 1], wall: ["Wall", 0], tree: ["Tree", 0] };
// The aiming line is colored by the selected weapon's accuracy at each range band. Red is its worst band, green its best.
function aimLine(a, b) {
  const p = atkView(); const d = dist(a, b) || 0.01; const m = S.rules.bandMeters;
  const hits = m.map((_, i) => { const x = p.v.melee ? (i === 0 ? 1 : 0) : p.v.hitBase(i + 1); return x == null ? -1 : x; });
  const lo = Math.min(...hits), hi = Math.max(...hits);
  // Full-brightness ramp: red, orange, yellow, lime, green. Each color sits mid-band, so it blends across the band instead of bunching at its edge.
  const RAMP = [0, 28, 58, 90, 135];
  const color = (x) => { const t = hi > lo ? (x - lo) / (hi - lo) : 1; const at = t * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(at)); return `hsl(${Math.round(RAMP[i] + (RAMP[i + 1] - RAMP[i]) * (at - i))},100%,58%)`; };
  let stops = `<stop offset="0" stop-color="${color(hits[0])}"/>`;
  for (let i = 0; i < 10; i++) { const mid = ((i ? m[i - 1] : 0) + m[i]) / 2; if (mid < d) stops += `<stop offset="${(mid / d).toFixed(4)}" stop-color="${color(hits[i])}"/>`; }
  stops += `<stop offset="1" stop-color="${color(hits[bandFor(d) - 1])}"/>`;
  return `<defs><linearGradient id="aimg" gradientUnits="userSpaceOnUse" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}">${stops}</linearGradient></defs><line class="aimbg" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="aim" style="stroke:url(#aimg)" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
}
function mapSvg() {
  const k = K(); const M = mapOf(); const v = mapView(); ui.viewW = v.w;
  const label = v.w * 0.0125;  // text stays the same size on screen at any zoom
  const step = S.rules.gridM || 2;
  // The grid counts out from the top-left corner, so every square is the same size and the map ends on a whole square.
  let grid = "";
  for (let x = -M.w / 2 + step; x < M.w / 2 - 0.01; x += step) grid += `M${x} ${-M.h / 2}V${M.h / 2}`;
  for (let y = -M.h / 2 + step; y < M.h / 2 - 0.01; y += step) grid += `M${-M.w / 2} ${y}H${M.w / 2}`;
  const objs = S.scene.objects.map((o) => {
    const w = o.w || 1, ht = o.h || 1; const tier = E.coverTier(o, S.rules); const cv = S.rules.cover[tier] || {};
    const name = o.label || (S.rules.mapItems[o.item] || {}).n || MAP_OBJ[o.kind][0];
    const gl = o.kind === "hazard" ? `<path d="M0 -.5L.5 .5H-.5Z"/>` : GLYPH[ITEM_GLYPH[o.item] || KIND_GLYPH[o.kind] || "crate"];
    // Drawn at real size in meters, so a tree is tiny on a 220m map and full size when you zoom in. Harder cover looks more solid.
    const turn = o.angle ? `rotate(${o.angle}) ` : "";
    const draw = turn + (o.rot ? `rotate(90) scale(${ht} ${w})` : `scale(${w} ${ht})`);
    const showName = o.label || v.w <= 30;
    // Trees: a faint circle for the trunk, which is what stops shots, under a fainter picture of the leaves.
    const trunk = E.trunkOf(o, S.rules);
    const art = trunk ? `<g class="gly trunk" style="opacity:${S.rules.trunkOpacity}" transform="scale(${w * trunk} ${ht * trunk})"><ellipse rx=".5" ry=".5"/></g><g class="gly canopy" style="opacity:${S.rules.canopyOpacity}" transform="${draw}">${gl}</g>` : `<g class="gly" style="opacity:${cv.opacity != null ? cv.opacity : 1}" transform="${draw}">${gl}</g>`;
    return `<g class="obj ${o.kind} tier-${tier} ${ui.mapSel === o.id ? "sel" : ""}" data-obj="${o.id}" transform="translate(${o.x} ${o.y})"><title>${h(name)}: ${h(cv.n || "")}${trunk ? ", only the trunk stops shots" : ""}${o.block ? ", blocks movement" : ""}. Drag to move, right-click to remove.</title>${art}${ui.mapSel === o.id ? `<g transform="${o.angle ? `rotate(${o.angle})` : ""}"><line class="rotline" x1="0" y1="0" x2="0" y2="${-(ht / 2 + v.w * 0.04)}"/><circle class="rothandle" data-rot="${o.id}" cy="${-(ht / 2 + v.w * 0.04)}" r="${v.w * 0.014}"><title>Drag to turn</title></circle></g>` : ""}${showName ? `<text style="font-size:${label}px" y="${ht / 2 + label}">${h(name)}</text>` : ""}</g>`;
  }).join("");
  const me = k ? (fightPhase() ? actorId() : null) : ui.sel;
  const k2 = tokenScale(v.w); ui.tokK = k2; const labU = label / k2;
  const people = [...S.chars, ...foes()].map((e) => {
    const c = cbOf(e.id); const p = posOf(e.id); const d = der(e); const pct = d.hp > 0 ? clamp(e.hp / d.hp, 0, 1) : 0;
    const gone = c && (c.dead || c.fled);
    const cls = [e.kind === "pc" ? "pc" : e.ally ? "ally" : "npc", k && k.turnId === e.id ? "cur" : "", ui.rowSel === e.id || (!k && ui.sel === e.id) ? "sel" : "", ui.atk && ui.atk.tgt === e.id ? "tgt" : "", gone ? "gone" : "", e.dbno ? "dbno" : ""].join(" ");
    const showR = me && me !== e.id && !gone && (k ? true : e.kind === "npc");
    return `<g class="tok ${cls}" data-tok="${e.id}" transform="translate(${p.x} ${p.y}) scale(${k2})"><title>${h(e.name)}: ${fmt(e.hp)}/${d.hp} HP</title><circle class="hit" r="${Math.max(1.3, (v.w * 0.02) / k2)}"/><circle class="b" cy="-.42" r=".27"/><path class="b" d="M-.46 .4 A.46 .62 0 0 1 .46 .4 Z"/>${gone ? `<path class="x" d="M-.4 -.4 L.4 .4 M.4 -.4 L-.4 .4"/>` : `<rect class="hpb" x="-.46" y=".46" width="${(0.92 * pct).toFixed(2)}" height=".14"/>`}<text class="lab" style="font-size:${labU}px" y="${0.65 + labU}">${h(tokenLabel(e))}${showR ? ` R${rangeOf(me, e.id)}` : ""}</text><text class="drg" style="font-size:${labU * 1.2}px" y="-.85"></text></g>`;
  }).join("");
  let extra = "";
  // The move you're previewing: a dashed path and a ghost at the far end, with the price on it.
  if (ui.pendingMove && ent(ui.pendingMove.id)) { const m = ui.pendingMove, a = posOf(m.id); extra += `<line class="movepath" x1="${a.x}" y1="${a.y}" x2="${m.x}" y2="${m.y}"/><g class="ghost" transform="translate(${m.x} ${m.y}) scale(${k2})"><circle cy="-.42" r=".27"/><path d="M-.46 .4 A.46 .62 0 0 1 .46 .4 Z"/><text style="font-size:${labU * 1.2}px" y="-.85">${fmt(m.cost)} AP</text></g>`; }
  if (k && fightPhase() && actorId()) { const a = posOf(actorId()); const r = reachOf(ent(actorId())); if (r) extra += `<circle class="reach" cx="${a.x}" cy="${a.y}" r="${r}"/>`; }
  if (ui.atk && ui.atk.tgt && ent(ui.atk.tgt)) { const a = posOf(ui.atk.att), b = posOf(ui.atk.tgt); extra += aimLine(a, b); }
  const zoomed = ui.zoom ? ui.zoom.k : 1;
  return `<div class="mapwrap"><svg id="map" class="${ui.place ? "placing" : ""}" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of ${h(M.n)}, ${M.w} by ${M.h} meters"><rect class="floor" x="${-M.w / 2}" y="${-M.h / 2}" width="${M.w}" height="${M.h}"/><path class="grid" d="${grid}" style="stroke-opacity:${v.w > 120 ? 0.35 : v.w > 60 ? 0.6 : 1}"/>${objs}${extra}${people}</svg><div class="zoombar"><span class="scale s">${step}m grid · ${Math.round(v.w)}m across</span><button class="btn tiny" data-a="mapZoom" data-v="1.5" title="Zoom in (or scroll)">+</button><button class="btn tiny" data-a="mapZoom" data-v="0.667" title="Zoom out (or scroll)">-</button><button class="btn tiny ${zoomed > 1 ? "on" : ""}" data-a="mapZoom" data-v="0" title="Show the whole map">Fit</button></div></div>`;
}
function checkValue(e, use) { const d = der(e); return E.SPECIAL.includes(use) ? { v: (d.sp[use] || 0) * S.rules.specialAsSkill, label: `${SP_LABEL[use]} ${d.sp[use]} x ${S.rules.specialAsSkill}` } : { v: d.skills[use] || 0, label: `${SKILL_NAME[use]} ${d.skills[use] || 0}` }; }
function checkBody() {
  const m = ui.chk; const k = K();
  const uses = [...E.SKILLS.map(([c, n]) => [c, n]), ...E.SPECIAL.map((c) => [c, E.SPECIAL_NAMES[c]])];
  const actor = k && k.turnId ? ent(k.turnId) : null;
  const who = actor && actor.kind === "npc" ? [actor, ...S.chars] : S.chars;
  const rows = who.map((e) => {
    const { v } = checkValue(e, m.use); const need = E.checkNeeded(v, num(m.target, 0), S.rules); const r = m.res[e.id];
    const used = S.scene.checks[e.id] || 0;
    return `<tr class="${e.dbno ? "faint" : ""}"><td class="${r ? "" : "bright"}">${h(e.name)}${!k && used >= S.rules.checksPerPlayer ? ` <span class="tag warn" title="Pre-combat checks used">${used}/${S.rules.checksPerPlayer}</span>` : ""}</td><td>${fmt(v)}</td><td class="bright">${need}+</td><td class="faint">${E.checkOdds(need)}%</td><td style="width:40px">${r ? `<span class="${r.pass ? "bright" : "warn"}">${r.roll}</span>` : numBox(`id="chk-${e.id}" maxlength="2" data-enter="chkRoll" data-id="${e.id}" placeholder="d20" aria-label="d20 for ${h(e.name)}"`, "", "cell")}</td><td style="width:48px">${r ? `<span class="${r.pass ? "bright" : "warn"}">${r.pass ? "PASS" : "FAIL"}</span>` : ""}</td></tr>`;
  }).join("");
  const any = Object.keys(m.res).length;
  return `${m.revive && ent(m.revive) ? `<div class="banner s">Reviving ${h(ent(m.revive).name)}: type the medic's roll</div>` : ""}<div class="row wrap" style="margin-bottom:2px"><select id="chkUse" data-u="chk.use" title="Skill or SPECIAL">${options(uses, m.use)}</select><span class="s dim">VS</span><span style="width:34px">${numBox(`id="chkTarget" data-u="chk.target" title="NPC skill or difficulty"`, m.target, "cell")}</span>${Object.entries(S.rules.difficulty).map(([n, x]) => `<button class="opt ${num(m.target) === x ? "on" : ""}" data-a="chkPreset" data-v="${x}" title="${h(n)}">${h(n[0] === "V" ? "VH" : n[0] === "E" && n[1] === "x" ? "X" : n[0])}${x}</button>`).join("")}</div>
   <table class="t"><tr><th>Who</th><th>Has</th><th>Roll</th><th>Odds</th><th>d20</th><th></th></tr>${rows}</table>
   ${any ? `<div class="row s dim" style="margin-top:2px">${btn("chkClear", "", "New check", "", "tiny")}<span class="spacer"></span>XP to passers ${numBox(`id="chkXp" style="width:36px" data-u="chk.xp" data-enter="chkXp"`, m.xp)}${btn("chkXp", "", "Add", "", "tiny")}</div>` : ""}`;
}
function stealthStage() {
  const id = actorId(); const A = ent(id); const d = der(A); const c = cbOf(id);
  const n = Math.max(1, Math.floor(d.skills.SNK / S.rules.sneakDiv - S.rules.sneakSub));
  return `<div class="s dim" style="margin-bottom:3px">Pick a player on the left. Each action gets a d20 stealth roll. Caught means ${S.rules.caughtInit} initiative.</div>${ui.atk ? attackPanel() : ""}
   <div class="bright">${h(A.name)} <span class="tag">${c.caught ? "CAUGHT" : "HIDDEN"}</span> <span class="s dim">AP ${fmt(A.ap)}/${d.ap} · Sneak ${d.skills.SNK}</span></div>
   ${ui.atk ? "" : `<div class="acts">${btn("attack", "", "Attack", "A")}${btn("moveModal", "", "Move", "M")}${btn("itemModal", "", "Item", "I")}${btn("reload", "", "Reload", "R")}</div>`}
   ${!c.caught ? `<div class="rollrow"><span>Stealth: at or under <span class="bright">${n}</span> stays hidden <span class="tag warn" title="The Gameplay Loop says Sneak/5-5 without saying how to read it. Change it in Settings.">PROVISIONAL</span></span><input class="rollbox" id="stealthRoll" inputmode="numeric" maxlength="2" autocomplete="off" data-enter="stealthRoll" placeholder="d20" aria-label="Stealth d20 roll">${btn("stealthRoll", "", "Roll", "", "tiny")}</div>` : ""}
   <div class="acts" style="margin-top:6px">${ui.atk ? "" : primary("toInit", "", "Roll initiative", "Enter")}${btn("endCombat", "", "Cancel fight")}</div>`;
}
function initStage() {
  const k = K();
  const rows = k.cbs.map((c) => { const e = ent(c.id); return `<tr><td>${h(e.name)}${c.caught ? ` <span class="tag bad">CAUGHT ${S.rules.caughtInit}</span>` : ""}</td><td>${fmt(c.base)}</td><td style="width:60px">${numBox(`id="init-${c.id}" data-initroll="${c.id}" data-enter="initNext" aria-label="d20 for ${h(e.name)}"`, c.roll, "cell")}</td><td class="bright">${c.roll == null || c.roll === "" ? "-" : fmt(c.base + num(c.roll, 0))}</td></tr>`; }).join("");
  return `<div class="s dim" style="margin-bottom:3px">d20 + (AGL + PER) / 2. Type each player's roll. Enemy rolls are filled in, and you can change them.</div><table class="t"><tr><th>Who</th><th>Base</th><th>d20</th><th>Total</th></tr>${rows}</table><div class="acts" style="margin-top:6px">${primary("beginRounds", "", "Start round 1", "Enter")}${btn("rerollNpcInit", "", "Reroll enemies")}</div>`;
}
function apPips(cur, max) { const n = Math.min(Math.max(max, cur), 30); let r = ""; for (let i = 0; i < n; i++) r += `<i class="${i < cur ? "on" : ""}"></i>`; return `<span class="pips" title="${fmt(cur)} of ${fmt(max)} AP">${r}</span>`; }
function apPips(cur, max) { const n = Math.min(Math.max(max, cur), 30); let r = ""; for (let i = 0; i < n; i++) r += `<i class="${i < cur ? "on" : ""}"></i>`; return `<span class="pips" title="${fmt(cur)} of ${fmt(max)} AP">${r}</span>`; }
function apPips(cur, max) { const n = Math.min(Math.max(max, cur), 30); let r = ""; for (let i = 0; i < n; i++) r += `<i class="${i < cur ? "on" : ""}"></i>`; return `<span class="pips" title="${fmt(cur)} of ${fmt(max)} AP">${r}</span>`; }
const seg = (title, body, cls = "") => `<section class="seg ${cls}"><h4 class="segh">${title}</h4><div class="segb">${body}</div></section>`;
function turnStage() {
  const k = K(); const A = ent(k.turnId);
  if (!A) return `<div class="empty">Nobody can act.</div>`;
  if (!ui.atk) makeAttack(k.turnId);  // the attack menu is always up on a turn
  const d = der(A);
  const slot = (A.weapons || [])[A.activeW || 0];
  const v = slot ? E.weaponView(slot, A, d, ctx()) : null;
  const banners = [];
  if (!npcsAlive()) banners.push(`<div class="banner">All enemies are down. ${btn("endCombat", "", "End combat", "", "tiny")}</div>`);
  if (!pcsUp()) banners.push(`<div class="banner">The whole party is down. ${btn("defeat", "", "Defeat", "", "tiny")}</div>`);
  const na = (cost) => (cost > (A.ap || 0) ? "na" : "");
  const free = S.rules.moveAP[1] > (A.ap || 0) ? "na" : "";
  const cons = (A.inv || []).map((l, i) => ({ l, i, it: E.get(ctx(), l.n) })).filter((x) => x.it && x.it.cat === "item" && usable(x.it.o));
  const head = `<div class="turnhead ${A.kind === "pc" ? "" : A.ally ? "ally" : "foe"}"><div class="turnwho"><span class="turnlabel">ROUND ${k.round} // ACTING</span><span class="actname">${h(A.name)}</span></div><div class="turnap"><span class="turnlabel">ACTION POINTS</span><span class="apbig">${fmt(A.ap)}<small>/${d.ap}</small></span>${apPips(A.ap || 0, d.ap)}</div><button class="btn primary endturn" data-a="next" data-v="">${kbd("N")}End turn</button></div>`;
  const actions = `<div class="acts">${btn("reload", "", `Reload${v && v.usesAmmo ? ` ${fmt(v.reload)}` : ""}`, "R", v && v.usesAmmo ? na(v.reload) : "na")}${btn("swap", "", `Swap ${S.rules.swapAP}`, "", na(S.rules.swapAP))}${btn("moveModal", "", "Move", "M", free)}${slot && slot.jammed ? btn("clearJamBtn", "", `Clear jam ${v.clearJam}`, "", `primary ${na(v.clearJam)}`) : ""}${btn("check", "", "Skill check")}${btn("reviveChk", "", "Revive", "", S.chars.some((x) => x.dbno) ? "" : "na")}${btn("statusModal", "", "Status")}${d.m.inspire ? btn("inspire", "", "Inspire 2", "", na(2)) : ""}</div>`;
  const consBody = cons.map((x) => `<button class="opt" data-a="useItemFrom" data-v="${A.id}|${x.i}" title="${h(x.it.o.effect || "")}">${pix(itemKind(x.l.n)[1])} ${h(x.l.n)} x${fmt(x.l.q)}${x.it.o.ap ? ` <small>${x.it.o.ap}AP</small>` : ""}</button>`).join("") || `<span class="s dim">None carried.</span>`;
  return `${head}${banners.join("")}<div class="segs">${ui.atk ? attackPanel() : seg("Attack", `<span class="s dim">${h(A.name)} has no weapon.</span>`)}${seg("Actions", actions, "half")}${seg("Consumables", `<div class="row wrap">${consBody}</div>`, "half")}${d.notes.length ? seg(`For the DM <small>${d.notes.length}</small>`, fold(`rem:${A.id}`, "Reminders", d.notes.map((n) => `<div class="txt s">${h(n)}</div>`).join("")), "half") : ""}${(S.scene.effects || []).length ? seg("Carried over", S.scene.effects.map((f) => `<div class="txt s">${h(f.label)}${f.hit ? `: ${f.who} ${E.pct(f.hit)}% to hit` : ""}</div>`).join(""), "half") : ""}</div>`;
}
function lastResult() { const l = [...S.log].reverse().find((x) => ["hit", "miss", "jam"].includes(x.k)); return l ? `<div class="s dim" style="margin-bottom:4px">LAST: ${h(l.x)}</div>` : ""; }
function bodyFig(a, T) {
  const hurt = new Set(); for (const st of (T && T.statuses) || []) for (const p of st.parts || []) hurt.add(p);
  const b = (id, lab) => { const [name, loc] = PARTS[id]; const x = S.rules.targetAP[loc]; return `<button class="bp bp-${id} ${a.part === id ? "on" : ""} ${hurt.has(id) ? "hurt" : ""}" data-a="atkPart" data-v="${id}" aria-label="${name}" title="${name}: damage x${S.rules.loc[loc]}${x ? `, +${x} AP` : ""}">${lab}</button>`; };
  const friendly = T && sideOf(a.att) === sideOf(T.id);  // bright green for your own side, bright red for the other side
  return `<div class="body ${friendly ? "friendly" : "hostile"}">${b("Head", "H")}${b("LArm", "")}${b("Body", "B")}${b("RArm", "")}${b("LLeg", "")}${b("RLeg", "")}</div>`;
}
function attackPanel() {
  const p = atkView(); if (!p) return "";
  const { a, A, T, v, range, hc, spans, warn } = p; const k = K();
  const live = /^\d{1,2}$/.test(String(a.roll).trim()) ? E.classify(Number(a.roll), p.b) : "";
  const weapons = A.weapons.map((s, i) => { const w = E.weaponView(s, A, p.dA, ctx()); return `<button class="wcard ${a.w === i ? "on" : ""}" data-a="atkW" data-v="${i}" title="${h(s.n)}">${pix(itemKind(s.n)[1])}<span class="nm">${h(s.n)}</span><small>${fmt(w.ap)}AP${w.usesAmmo ? ` ${s.mag || 0}/${w.cap} +${ammoHeld(A, w.reserve)}` : ""}${s.jammed ? " JAM" : ""}</small></button>`; }).join("");
  const loads = loadsHeld(A, v, p.slot);
  const bars = spans.map((s) => `<div class="${s.id} ${live === s.id ? "lit" : ""}" style="flex:${Math.max(s.to - s.from + 1, 1)} 0 0" title="${s.label} ${E.two(s.from)}-${E.two(s.to)}">${s.to - s.from >= 7 ? s.label : ""}</div>`).join("");
  const w = E.get(ctx(), v.n);
  const r = a.res;
  const hitPct = Math.round(E.pct(p.hit));
  const tgt = T ? `<div class="tgtcard"><span class="nm grow">${h(T.name)}</span><span class="s">${fmt(T.hp)}/${p.dT.hp} HP · DT ${fmt(p.dT.dt)}</span></div>${hpBar(T.hp, p.dT.hp)}${chips(T)}` : `<div class="warnline">Click an enemy on the map or in the list.</div>`;
  const ovr = ui.atkOv ? `<div class="ovrow s">Hit%${numBox(`id="ovHit" data-u="atk.ov.hit"`, a.ov.hit)} Bullets${numBox(`id="ovB" data-u="atk.ov.bullets"`, a.ov.bullets)} Dmg${numBox(`id="ovD" data-u="atk.ov.dmg"`, a.ov.dmg)}<label class="chk"><input type="checkbox" id="ovFree" data-u="atk.ov.free"${a.ov.free ? " checked" : ""}>Free</label><select id="ovCover" data-u="atk.ov.cover" title="Cover on this shot"><option value="">Cover: from map</option>${options(Object.entries(S.rules.cover).map(([id, t]) => [id, t.n]), a.ov.cover || "")}</select><select data-c="atkAs" id="atkAs" title="Acting as">${options(k.cbs.filter(alive).map((c) => [c.id, ent(c.id).name]), a.att)}</select></div>` : "";
  const loadout = `<div class="wcards">${kbd("W")}${weapons}</div>
   ${v.hasSecondary ? `<div class="opts"><button class="opt ${a.mode !== "se" ? "on" : ""}" data-a="atkMode" data-v="pr">1st ${h(w.o.prName || "")}</button><button class="opt ${a.mode === "se" ? "on" : ""}" data-a="atkMode" data-v="se">2nd ${h(w.o.seName || "")}</button></div>` : ""}
   ${loads.length ? `<select id="atkLoad" style="width:100%" data-c="setLoad" data-id="${A.id}" data-i="${a.w}"><option value="">Choose ammo</option>${options(loads.map((x) => [x.n, `${x.load} (${x.n === p.slot.ammo ? `${p.slot.mag || 0} loaded, ` : ""}${ammoHeld(A, x.n)} held): Dam ${x.pellets ? x.dam + "x" + x.pellets : x.dam ?? "?"} Pen ${x.pen ?? 0}`]), p.slot.ammo)}</select>` : v.caliber ? `<div class="warnline">No ${h(v.caliber)} ammo in inventory.</div>` : ""}`;
  const targeting = `<div class="atkmid">${T ? bodyFig(a, T) : ""}<div class="atkinfo">${tgt}
     <div class="stats3"><div><b>${hitPct}%</b><span>HIT</span></div><div><b>x${S.rules.loc[a.loc]}</b><span>${h(PARTS[a.part][0])}</span></div><div><b>${fmt(p.cost)}</b><span>AP COST</span></div><div class="covflag tier-${p.cov.tier}" title="${h(p.cov.by ? "Blocked by: " + p.cov.by : "Nothing in the way")}"><b>${h(p.cov.n)}</b><span>${p.cov.hit ? `${fmt(E.pct(p.cov.hit))}% hit` : "NO PENALTY"}${p.cov.dam ? ` ${fmt(E.pct(p.cov.dam))}% dmg` : ""}</span></div><div class="rng"><b><button class="xb" data-a="atkRange" data-v="-1" title="Closer">-</button>R${range}<button class="xb" data-a="atkRange" data-v="1" title="Farther">+</button> <small class="rngm">${T ? `${dist(posOf(A.id), posOf(T.id)).toFixed(1)}m` : ""}</small></b><span>${k.ranges[pairKey(a.att, a.tgt)] != null ? "DM SET" : "FROM MAP"}</span></div></div>
     <div class="math">HIT ${h(E.hitLine(hc))}${num(a.ov.hit) != null ? ` <span class="warn">DM SET ${h(a.ov.hit)}%</span>` : ""}</div>
     <div class="s dim">Dam ${v.pellets ? `${fmt(v.base)}x${v.pellets}` : fmt(v.base)} Pen ${fmt(v.pen)}${v.count > 1 ? ` · burst ${v.count}` : ""}${p.extra || p.swap ? ` · ${fmt(v.ap)}${p.extra ? ` +${p.extra} aimed` : ""}${p.swap ? ` +${p.swap} swap` : ""} AP` : ""}</div></div></div>`;
  const rolling = `<div class="bands">${bars}</div><div class="bright bandtext">${h(E.bandText(p.b))}</div>
   <div class="rollrow"><input class="rollbox" id="roll" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="00" value="${h(a.roll)}" data-u="atk.roll" data-enter="fire" aria-label="Two-dice roll, 00 to 99">${btn("fire", "", "Resolve", "Enter", `primary ${p.cost > (A.ap || 0) && !a.ov.free ? "na" : ""}`)}<span class="spacer"></span><button class="btn tiny ${ui.atkOv ? "on" : ""}" data-a="atkOvToggle" data-v="" title="Overrides">OVR</button>${K().phase === "stealth" ? btn("closeAtk", "", "Close", "Esc", "tiny") : ""}</div>${ovr}
   ${a.err ? `<div class="errline">${h(a.err)}</div>` : ""}${warn.map((x) => `<div class="warnline">${h(x)}</div>`).join("")}
   ${r ? `<div class="result ${r.outcome}">${r.name}: ${h(r.head)}${r.math ? `<br>${h(r.math)}<br>${h(r.tName)} ${r.hp}/${r.max} HP${r.hp <= 0 ? " DOWN" : ""}` : ""}${r.ammoText ? ` · ${h(r.ammoText)}` : ""}${r.outcome === "jam" ? `<br>Weapon jammed. Press J to clear.` : ""}${(r.auto || []).length ? `<br><span class="warn">Applied: ${h(r.auto.join(", "))}</span>` : ""}${r.status ? `<br>${btn("applyHitStatus", r.status, `Apply ${h(r.status)} to ${h(r.tName)}`, "", "tiny")}` : ""}${r.radius ? `<br><span class="warn">Blast radius ${r.radius}: apply damage to anyone else in it by typing their HP.</span>` : ""}</div>` : ""}`;
  return `${seg("Loadout", loadout, "full")}${seg("Target", targeting, "full")}${seg("Roll", rolling, "full hot")}`;
}
function roundEndStage() {
  const k = K(); const down = S.chars.filter((c) => c.dbno);
  const rows = down.map((c) => { const d = der(c); const sv = (k.saves || {})[c.id]; return `<div class="line"><span class="grow"><span class="bright">${h(c.name)}</span> <span class="s dim">save at or under ${d.save}${c.timesRevived ? `, revived ${c.timesRevived}x` : ""}</span></span>${sv ? `<span class="${sv.pass ? "bright" : "warn"}">${sv.pass ? "PASS" : "FAIL"} rolled ${sv.roll}</span>${btn("saveUp", c.id, `Up at ${S.rules.reviveHP} HP with Shock`, "", sv.pass ? "tiny primary" : "tiny")}` : `<input class="rollbox" style="width:44px;height:22px;font-size:var(--fs)" id="save-${c.id}" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="d20" data-enter="saveRoll" data-id="${c.id}" aria-label="Saving throw for ${h(c.name)}">${btn("saveRollBtn", c.id, "Roll", "", "tiny")}`}</div>`; }).join("");
  const npcs = k.cbs.filter((c) => sideOf(c.id) === "npc" && alive(c));
  return `${down.length ? `<h3>Saving throws <span class="tag warn" title="What a passed save does is not decided yet, so you choose.">YOUR CALL</span></h3>${rows}<div class="s dim">Roll a d20 at or under the number. What a pass does isn't decided yet, so you choose.</div>` : ""}
   ${npcs.length ? fold("flee", "Enemies fleeing", npcs.map((c) => `<div class="line"><span class="grow">${h(ent(c.id).name)}</span>${btn("flee", c.id, "Fled", "", "tiny")}</div>`).join(""), { badge: npcs.length }) : ""}
   <div class="acts" style="margin-top:6px">${primary("nextRound", "", `Start round ${k.round + 1}`, "Enter")}</div>`;
}
function xpFor(pc) {
  const k = K(); const dead = k.cbs.filter((c) => c.dead).map((c) => ({ c, e: ent(c.id) })).filter((x) => x.e && x.e.kind === "npc" && !x.e.ally);
  const total = dead.reduce((t, x) => t + (x.e.xp || 0), 0);
  const base = S.rules.xpAward === "each" ? total : S.rules.xpAward === "split" ? total / Math.max(1, S.chars.length) : dead.filter((x) => x.c.killer === pc.id).reduce((t, x) => t + (x.e.xp || 0), 0);
  return E.fix(E.xpGain(base, der(pc).sp.I, S.rules) * (1 + (der(pc).m.xpMul || 0)));
}
function lootRows() {
  const rows = [];
  for (const c of K().cbs.filter((x) => x.dead)) {
    const e = ent(c.id); if (!e || e.kind !== "npc" || e.mob || e.ally) continue;
    (e.weapons || []).forEach((s, i) => rows.push({ key: `${e.id}:w${i}`, n: s.n, q: 1, from: e.name }));
    for (const g of ["head", "armor", "vanity"]) if (e.gear && e.gear[g]) rows.push({ key: `${e.id}:${g}`, n: e.gear[g], q: 1, from: e.name });
    (e.inv || []).forEach((l, i) => rows.push({ key: `${e.id}:i${i}`, n: l.n, q: l.q, from: e.name }));
    if (e.caps) rows.push({ key: `${e.id}:caps`, n: "Caps", q: Math.round(e.caps * (1 + Math.max(0, ...S.chars.map((c) => der(c).m.capsMul || 0)))), from: e.name, caps: true });
  }
  return rows;
}
function endStage() {
  const k = K(); const u = (ui.end = ui.end || { xp: {}, heal: {}, loot: {}, add: {}, lootRoll: "", extra: [], exN: "", exQ: 1, exTo: (S.chars[0] || {}).id }); u.extra = u.extra || [];
  const pcs = S.chars.map((c) => { const d = der(c); const x = u.xp[c.id] != null ? u.xp[c.id] : xpFor(c); const heal = u.heal[c.id] != null ? u.heal[c.id] : c.dbno ? 0 : Math.round(d.hp * S.rules.passiveHealPct); return `<tr><td class="bright">${h(c.name)}${c.dbno ? ` <span class="tag bad">DBNO</span>` : ""}</td><td>${fmt(c.hp)}/${d.hp}</td><td style="width:70px">${numBox(`id="heal-${c.id}" data-u="end.heal.${c.id}" aria-label="Heal for ${h(c.name)}"`, heal, "cell")}</td><td style="width:70px">${numBox(`id="xp-${c.id}" data-u="end.xp.${c.id}" aria-label="XP for ${h(c.name)}"`, x, "cell")}</td></tr>`; }).join("");
  const loot = lootRows();
  const shift = num(u.lootRoll) != null ? (S.rules.lootTable.find((r) => r[0] === num(u.lootRoll)) || [0, 0])[1] : null;
  const who = S.chars.map((c) => [c.id, c.name]);
  const extras = u.extra.map((l, i) => `<tr><td class="bright">${pix(itemKind(l.n)[1])} ${h(l.n)}</td><td>${fmt(l.q)}</td><td class="dim">Added by DM</td><td><select id="exTo-${i}" data-u="end.extra.${i}.to">${options([["", "Leave"], ...who], l.to || "")}</select> <button class="btn tiny" data-a="endExDel" data-v="${i}" title="Remove">X</button></td></tr>`).join("");
  const dropRows = loot.map((l) => `<tr><td class="bright">${pix(l.caps ? "dot" : itemKind(l.n)[1])} ${h(l.n)}</td><td>${l.q}</td><td class="dim">${h(l.from)}</td><td><select id="loot-${h(l.key.replace(":", "-"))}" data-u="end.loot.${h(l.key)}">${options([["", "Leave"], ...who], u.loot[l.key] || "")}</select></td></tr>`).join("");
  const lootBody = `<div class="row wrap" style="margin-bottom:3px"><label class="chk s">Give all to <select data-c="lootAll" id="lootAll" style="margin-left:4px"><option value="">Choose</option>${options(who, "")}</select></label><span class="spacer"></span><span class="s dim">Loot roll d20</span><span style="width:40px">${numBox(`id="lootRoll" data-u="end.lootRoll"`, u.lootRoll, "cell")}</span>${shift != null ? `<span class="bright s">average tier ${shift >= 0 ? "+" : ""}${shift}</span>` : ""}</div>${dropRows || extras ? `<table class="t"><tr><th>Item</th><th>Qty</th><th>From</th><th>Goes to</th></tr>${dropRows}${extras}</table>` : `<div class="s dim">Nothing dropped.</div>`}
    <div class="row wrap lootadd"><input id="exN" class="grow" autocomplete="off" list="dl-all" placeholder="Add an item to the loot: type a name" data-u="end.exN" value="${h(u.exN)}" data-enter="endExAdd"><span style="width:40px">${numBox(`id="exQ" data-u="end.exQ" title="How many"`, u.exQ, "cell")}</span><select id="exTo" data-u="end.exTo" title="Goes to">${options(who, u.exTo)}</select>${btn("endExAdd", "", "Add", "", "tiny")}</div>`;
  const banner = `<div class="turnhead"><div class="turnwho"><span class="turnlabel">COMBAT OVER // ${k.round} ROUND${k.round === 1 ? "" : "S"}</span><span class="actname">After Action</span></div><span></span><button class="btn primary endturn" data-a="finishCombat" data-v="">Finish and apply</button></div>`;
  return `${banner}<div class="segs">${seg("XP and healing", `<table class="t"><tr><th>Who</th><th>HP</th><th title="Passive heal has no number in the sheet. Set it in Settings.">Heal</th><th title="Who earns enemy XP is not decided. Change it in Settings.">XP: ${h(S.rules.xpAward)}</th></tr>${pcs}</table>`)}${seg("Loot", lootBody)}${k.used.length ? seg("Addiction rolls", k.used.map((x, i) => `<div class="line"><span class="grow">${h(ent(x.who) ? ent(x.who).name : "")} used ${h(x.n)}: d100 at or under ${E.pct(x.addict)} = addicted</span><span style="width:44px">${numBox(`id="add-${i}" data-u="end.add.${i}" aria-label="d100"`, u.add[i], "cell")}</span></div>`).join("")) : ""}</div>`;
}
function defeatStage() {
  const u = (ui.def = ui.def || { lose: {}, caps: {}, xp: {} });
  const blocks = S.chars.map((c) => { const lose = u.lose[c.id] || {}; const count = Object.values(lose).filter(Boolean).length; return fold(`def:${c.id}`, h(c.name), `<div class="opts" style="margin-bottom:3px">${btn("defMark", `${c.id}|all`, "Mark all", "", "tiny")}${btn("defMark", `${c.id}|stowed`, "Mark stowed", "", "tiny")}${btn("defMark", `${c.id}|materials`, "Mark materials", "", "tiny")}${btn("defMark", `${c.id}|none`, "Clear", "", "tiny")}</div>${(c.inv || []).map((l, i) => `<label class="chk" style="display:flex"><input type="checkbox" data-u="def.lose.${c.id}.${i}"${lose[i] ? " checked" : ""} id="dl-${c.id}-${i}">${fmt(l.q)} x ${h(l.n)}</label>`).join("") || `<div class="dim">Empty.</div>`}<div class="grid" style="margin-top:3px">${field(`Caps lost (has ${fmt(c.caps)})`, numBox(`id="dc-${c.id}" data-u="def.caps.${c.id}"`, u.caps[c.id]))}${field("XP kept", numBox(`id="dx-${c.id}" data-u="def.xp.${c.id}"`, u.xp[c.id] != null ? u.xp[c.id] : E.fix(xpFor(c) * S.rules.defeatXpPct)))}</div>`, { badge: count ? `${count} lost` : "", open: true }); }).join("");
  return `<div class="s dim" style="margin-bottom:3px">The party lost. Nobody dies: choose what it costs them. Everyone comes back up at ${S.rules.reviveHP} HP.</div><div class="acts">${btn("finishDefeat", "", "Apply defeat", "F", "primary")}${btn("backToFight", "", "Back to the fight")}</div>${blocks}`;
}

// ----- item browser
const BR_CATS = { All: null, Items: "item", Weapons: "weapon", Armor: "armor", Ammo: "ammo", Materials: "material", Mods: "mod" };
const BR_LIST = () => [...DATA.items.map((o) => ["item", o]), ...DATA.weapons.filter((w) => w.tier).map((o) => ["weapon", o]), ...DATA.armor.filter((a) => a.tier && a.tier < 100).map((o) => ["armor", o]), ...DATA.ammo.map((o) => ["ammo", o]), ...DATA.materials.map((o) => ["material", o]), ...DATA.mods.map((o) => ["mod", o])];
function statText(c, o) {
  if (c === "weapon") return o.ok === false || !o.ok ? "blank stats" : o.tab === "MW" ? `Dam ${fmt(o.dmg)} Pen ${fmt(o.pen)} ${fmt(o.ap)}AP` : `${o.ammo || ""}${o.dmg != null ? ` Dam ${fmt(o.dmg)} Pen ${fmt(o.pen)}` : ""} ${fmt(o.ap)}AP${o.count > 1 ? ` x${o.count}` : ""}`;
  if (c === "ammo") return `Dam ${o.pellets ? o.dam + "x" + o.pellets : o.dam ?? "?"} Pen ${o.pen ?? 0}`;
  if (c === "armor") return `${o.loc} DT ${o.dt || 0}${o.buffs ? " " + o.buffs : ""}`;
  if (c === "item") return o.effect || "no effect written";
  if (c === "mod") return `${o.loc || ""} ${o.effect || "no effect written"}`;
  return o.note || o.cat || "";
}
function itemsBody() {
  const cat = BR_CATS[ui.brCat]; const merged = (o) => ({ ...o, ...(S.overrides[E.low(o.n)] || {}) });
  let rows = BR_LIST().filter(([c]) => !cat || c === cat).map(([c, o]) => [c, merged(o)]).filter(([, o]) => !ui.brTier || String(o.tier) === String(ui.brTier));
  const q = E.low(ui.brQ);
  if (q) { rows = rankByName(rows, q, (x) => x[1].n); }
  else { const key = ui.brSort; const dir = ui.brDir; rows = [...rows].sort((a, b) => { const x = key === "c" ? a[0] : a[1][key], y = key === "c" ? b[0] : b[1][key]; return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""))) * dir; }); }
  const shown = rows.slice(0, 60);
  const body = shown.map(([c, o], i) => {
    const open = ui.brOpen === o.n;
    return `<tr class="click" data-a="brToggle" data-v="${h(o.n)}"><td title="${h(c)}" style="width:20px">${pix(itemKind(o.n)[1])}</td><td class="bright" title="${h(o.n)}">${h(o.n)}</td><td>${o.tier != null && o.tier !== "" ? h(o.tier) : "-"}</td><td title="${h(statText(c, o))}">${h(statText(c, o))}</td><td title="${fmt(o.lb)}">${Number((o.lb || 0).toFixed(2))}</td><td>${o.val != null ? fmt(o.val) : "-"}</td><td style="overflow:visible"><button class="btn tiny" data-a="brGive" data-v="${h(o.n)}" title="Give one">+</button></td></tr>${open ? `<tr><td class="open" colspan="7"><div style="padding:3px 0">${detailFields(o, E.low(o.n), BR_LIST().find(([, x]) => x.n === o.n)[1], `br${i}`)}</div></td></tr>` : ""}`;
  }).join("");
  const th = (k, l, w) => `<th style="width:${w}" data-a="brSortBy" data-v="${k}">${l}${ui.brSort === k && !q ? (ui.brDir > 0 ? " ^" : " v") : ""}</th>`;
  return `<div class="row wrap" style="margin-bottom:3px"><input id="brQ" class="grow" autocomplete="off" placeholder="Search items" data-u="brQ" value="${h(ui.brQ)}" data-enter="brEnter"><select id="brCat" data-u="brCat" title="Type">${options(Object.keys(BR_CATS), ui.brCat)}</select><select id="brTier" data-u="brTier" title="Tier">${options([["", "All T"], ...[1, 2, 3, 4, 5, 6].map((t) => [t, "T" + t])], ui.brTier)}</select><label class="chk s">+ GIVES TO <select id="brWho" data-u="sel" style="margin-left:4px">${options(S.chars.map((c) => [c.id, c.name]), ui.sel)}</select></label></div>
    <div class="itab"><table class="t"><tr><th style="width:20px" data-a="brSortBy" data-v="c"></th>${th("n", "Name", "30%")}${th("tier", "T", "4%")}<th>Stats</th>${th("lb", "Lb", "7%")}${th("val", "Cap", "7%")}<th style="width:24px"></th></tr>${body}</table></div>${rows.length > shown.length ? `<div class="s dim">Showing ${shown.length} of ${rows.length}. Search to narrow it down.</div>` : ""}`;
}
const PCT_FIELDS = new Set(["crit", "jam", "base", "addict"]);
function detailFields(o, key, base, idp) {
  const rows = Object.entries(o).filter(([k]) => k !== "n" && k !== "tab" && k !== "skill").map(([k, v], i) => {
    if (Array.isArray(v) && k === "hit") return `<div class="full"><div class="s dim">BASE HIT % R1 TO R10</div><div class="hitgrid">${v.map((x, j) => numBox(`data-ov="${h(key)}|hit.${j}|pct" id="${idp}-h${j}" title="R${j + 1}"`, x == null ? "" : E.pct(x), "cell")).join("")}</div></div>`;
    if (Array.isArray(v)) return `<div class="full s dim">${h(k)}: ${h(JSON.stringify(v))}</div>`;
    if (typeof v === "boolean") return `<label class="chk s"><input type="checkbox" data-ov="${h(key)}|${k}|bool" id="${idp}-${i}"${v ? " checked" : ""}>${h(k)}</label>`;
    const isPct = PCT_FIELDS.has(k);
    return `<label class="f ${String(v).length > 28 ? "full" : ""}">${h(k)}${isPct ? " %" : ""}<input type="text" autocomplete="off" data-ov="${h(key)}|${k}|${isPct ? "pct" : typeof v === "number" ? "num" : "text"}" id="${idp}-${i}" value="${h(isPct ? E.pct(v) : v)}"></label>`;
  }).join("");
  return `<div class="kv">${rows}</div>${S.overrides[key] ? `<div class="s warn" style="margin-top:3px">Edited by you. ${btn("ovReset", key, "Back to workbook value", "", "tiny")}</div>` : ""}`;
}

// ----- settings column
function settingsBody() {
  const r = S.rules;
  const input = ([path, label, type, flag]) => {
    const val = getPath(r, path);
    const star = flag ? ` <span class="warn" title="Picked for this draft because the sheet and the brief leave it open.">*</span>` : "";
    if (type === "bool") return `<label class="rr"><span>${h(label)}${star}</span><input type="checkbox" data-rule="${path}" id="r-${path}"${val ? " checked" : ""}></label>`;
    if (Array.isArray(type)) return `<label class="rr"><span>${h(label)}${star}</span><select data-rule="${path}" id="r-${path}">${options(type, val)}</select></label>`;
    if (type === "text") return `<label class="rr"><span>${h(label)}${star}</span><input type="text" autocomplete="off" list="dl-status" data-rule="${path}" id="r-${path}" value="${h(val)}"></label>`;
    return `<label class="rr"><span>${h(label)}${type === "pct" ? " %" : ""}${star}</span>${numBox(`data-rule="${path}" data-rt="${type}" id="r-${path}"`, type === "pct" ? E.pct(val) : val)}</label>`;
  };
  const groups = RULE_SCHEMA.map(([g, items], i) => fold(`rule:${g}`, h(g), items.map(input).join(""), { open: i === 0 })).join("");
  const types = [...new Set(DATA.weapons.map((w) => w.type).filter(Boolean))].sort();
  const jam = fold("rule:jam", "Jam clear AP *", `<div class="cols2">${types.map((t) => `<label class="rr"><span>${h(t)}</span>${numBox(`data-rule="clearJam.${h(t)}" data-rt="num" id="r-cj-${h(t)}"`, r.clearJam[t] != null ? r.clearJam[t] : r.clearJamDefault)}</label>`).join("")}</div>`);
  const move = fold("rule:move", "Range bands: meters and walking AP *", r.moveAP.map((v, i) => `<div class="rr"><span>R${i + 1}</span>${numBox(`data-rule="bandMeters.${i}" data-rt="num" id="r-bm-${i}" title="Band reaches this many meters" style="width:50px"`, r.bandMeters[i])}<span class="s dim">m</span>${numBox(`data-rule="moveAP.${i}" data-rt="num" id="r-mv-${i}" title="AP to walk this far" style="width:50px"`, v)}<span class="s dim">AP</span></div>`).join(""));
  const diff = fold("rule:diff", "Difficulty presets *", Object.keys(r.difficulty).map((k) => `<label class="rr"><span>${h(k)}</span>${numBox(`data-rule="difficulty.${h(k)}" data-rt="num" id="r-df-${h(k)}"`, r.difficulty[k])}</label>`).join(""));
  const disp = fold("rule:display", "Display", `<label class="rr"><span>Font</span><select id="pFont" data-pref="face">${options([["term", "Terminal (readable)"], ["pixel", "Pixel (VT323)"], ["code", "Code (Consolas)"]], prefs.face)}</select></label><label class="rr"><span>CRT shimmer and scanlines</span><input type="checkbox" id="pScan" data-pref="scan"${prefs.scan ? " checked" : ""}></label>`);
  return `${groups}${jam}${move}${diff}${disp}<div class="row wrap" style="margin-top:4px">${btn("resetRules", "", "Reset rules", "", "tiny")}</div><div class="s dim" style="margin-top:3px"><span class="warn">*</span> placeholder picked for the draft. Data: ${h(DATA.builtFrom)}, ${h(DATA.builtAt)}.</div>`;
}
const RAIL = [["newc", "New", "dot"], ["settings", "Set", "gear"], ["saveNow", "Save", "floppy"], ["loadWin", "Load", "folder"], ["autoWin", "Auto", "clock"], ["wiki", "Wiki", "book"], ["log", "Log", "log"], ["items", "Item", "box"], ["notes", "Note", "pencil"], ["guide", "Help", "star"]];
function rail() {
  return `<nav class="rail">${RAIL.map(([id, n, ic]) => `<button class="railb ${id === "saveNow" && dirty ? "dirty" : ""} ${id === "autoWin" && !prefs.autosave ? "off" : ""} ${(ui.modal && ui.modal.type === id) || (id === "log" && ui.logOpen) ? "on" : ""}" ${id === "saveNow" ? 'id="railSave"' : ""} data-a="railGo" data-v="${id}" title="${h(RAIL_TITLE[id])}">${pix(ic)}<span>${id === "autoWin" ? (prefs.autosave ? "ON" : "OFF") : n}</span></button>`).join("")}</nav>`;
}
const RAIL_TITLE = { newc: "New campaign", guide: "How to use this: tutorial", settings: "Settings: game rules", saveNow: "Save", loadWin: "Load save", autoWin: "Autosave", wiki: "Wiki: the game bible", log: "Log", items: "Item browser", notes: "Old notes" };
function autoBody() {
  const iv = prefs.interval;
  const presets = [[0, "Every change"], [15, "15 sec"], [30, "30 sec"], [60, "1 min"], [120, "2 min"], [300, "5 min"], [600, "10 min"]];
  return `<div class="row"><span class="grow">AUTOSAVE</span><button class="btn tiny ${prefs.autosave ? "on" : ""}" data-a="autoToggle" data-v="1">ON</button><button class="btn tiny ${prefs.autosave ? "" : "on"}" data-a="autoToggle" data-v="">OFF</button></div><label class="rr"><span>Interval</span><select id="pInt" data-pref="interval">${options(presets.some(([v]) => v === iv) ? presets : [...presets, [iv, iv + " sec"]], iv)}</select></label><label class="rr"><span>Or seconds</span>${numBox(`id="pSec" data-pref="seconds"`, iv || "")}</label><div class="stat" id="saveStat">${h(statusText())}</div>`;
}
const SLOTS_KEY = "fallout-dm-slots-v1";
const slots = () => readJson(SLOTS_KEY) || [];
function writeSlot(id, name) {
  try {
    localStorage.setItem("fallout-dm-slot-" + id, JSON.stringify(S));
    const list = slots().filter((x) => x.id !== id);
    list.unshift({ id, name, at: new Date().toISOString(), info: S.combat ? `In a fight, round ${S.combat.round}` : `${S.chars.length} characters` });
    localStorage.setItem(SLOTS_KEY, JSON.stringify(list));
    return true;
  } catch (e) { return false; }
}
function loadBody() {
  const list = slots();
  const auto = readJson(SAVE_KEY);
  const when = (t) => new Date(t).toLocaleString();
  return `<div class="stat" id="saveStat" style="text-align:left;margin-bottom:3px">${h(statusText())}</div><div class="acts">${btn("slotNew", "", "Save as new", "", "primary")}${btn("exportSave", "", "Save pack (.zip)")}${btn("importSave", "", "Load pack")}</div>
   <table class="t"><tr><th>Save</th><th>When</th><th>State</th><th></th></tr>${list.map((x, i) => `<tr class="${prefs.slot === x.id ? "cursl" : ""}"><td><input type="text" autocomplete="off" class="cell left" id="sl-${i}" data-c="slotRename" data-v="${x.id}" value="${h(x.name)}"></td><td class="dim">${h(when(x.at))}</td><td class="dim">${h(x.info)}</td><td style="white-space:nowrap">${btn("slotLoad", x.id, "Load", "", "tiny")} ${btn("slotDel", x.id, "X", "", "tiny danger", "Delete this save")}</td></tr>`).join("")}${auto ? `<tr><td class="bright">Autosave</td><td class="dim">${lastSaved ? h(lastSaved.toLocaleString()) : "this browser"}</td><td class="dim">${auto.combat ? `In a fight, round ${auto.combat.round}` : `${(auto.chars || []).length} characters`}</td><td>${btn("slotLoad", "auto", "Load", "", "tiny")}</td></tr>` : ""}</table>${list.length ? "" : `<div class="s dim" style="margin-top:4px">No saves yet. The Save button makes the first one, and keeps updating it until you load or start another.</div>`}<div class="s dim" style="margin-top:4px">Saves live in this browser. A pack is a .zip with your campaign, rules and every table: edit it, share it, load it back.</div>`;
}
function pwBody() {
  const m = ui.pw; const list = m.side === "enemies" ? foes() : S.chars;
  const ACTS = [["addItem", "Add item"], ["removeItem", "Remove item"], ["addStatus", "Add status"], ["removeStatus", "Remove status"], ["hp", "Change HP by"], ["ap", "Change AP by"], ["caps", "Change caps by"], ["xp", "Change XP by"], ["heal", "Full heal"], ["clear", "Clear all statuses"]];
  const needsName = ["addItem", "removeItem", "addStatus", "removeStatus"].includes(m.act);
  const isStatus = m.act === "addStatus" || m.act === "removeStatus";
  const needsVal = !["heal", "clear", "addStatus", "removeStatus"].includes(m.act);
  return `<div class="grid" style="grid-template-columns:1.2fr 1.6fr .6fr">${field("Do this", `<select id="pwAct" data-u="pw.act">${options(ACTS, m.act)}</select>`)}${needsName ? field(isStatus ? "Status" : "Item", `<input id="pwName" autocomplete="off" list="${isStatus ? "dl-status" : "dl-all"}" data-u="pw.name" value="${h(m.name)}">`) : "<span></span>"}${needsVal ? field(needsName ? "How many" : "Amount (+ or -)", numBox(`id="pwVal" data-u="pw.val"`, m.val)) : m.act === "addStatus" ? field("Tier", `<select id="pwTier" data-u="pw.tier">${options([1, 2, 3, 4, 5], m.tier)}</select>`) : "<span></span>"}</div>
   <h3>To <button class="opt" data-a="pwWho" data-v="1">All</button> <button class="opt" data-a="pwWho" data-v="">None</button></h3><div class="row wrap">${list.map((e) => `<label class="chk"><input type="checkbox" id="pw-${e.id}" data-u="pw.who.${e.id}"${m.who[e.id] !== false ? " checked" : ""}>${h(e.name)}</label>`).join(" ") || `<span class="dim">Nobody here.</span>`}</div><div class="acts" style="margin-top:6px">${primary("pwApply", "", "Apply", "Enter")}</div>`;
}

// ----- dev windows: full, editable tables
const R_COLS = Array.from({ length: 10 }, (_, i) => [`hit.${i}`, `R${i + 1}`, "pct"]);
const WEAPON_COLS = {
  SG: [["tier", "T"], ["type", "Type", "text"], ["ammo", "Ammo", "text"], ["auto", "Auto", "bool"], ["mag", "Mag"], ["reload", "Rld"], ["ap", "AP"], ["count", "Cnt"], ["crit", "Crit", "pct"], ["jam", "Jam", "pct"], ["str", "STR"], ["req", "Skill"], ...R_COLS, ["lb", "Lb"], ["val", "Cap"], ["note", "Notes", "text"]],
  EW: [["tier", "T"], ["type", "Type", "text"], ["ammo", "Ammo", "text"], ["status", "Status", "text"], ["dmg", "Dam"], ["pen", "Pen"], ["perShot", "/Sh"], ["mag", "Mag"], ["reload", "Rld"], ["ap", "AP"], ["count", "Cnt"], ["crit", "Crit", "pct"], ["jam", "Jam", "pct"], ["str", "STR"], ["req", "Skill"], ...R_COLS, ["lb", "Lb"], ["val", "Cap"], ["note", "Notes", "text"]],
  EX: [["tier", "T"], ["type", "Type", "text"], ["ammo", "Ammo", "text"], ["dmg", "Dam"], ["pen", "Pen"], ["radius", "Rad"], ["fuze", "Fuze"], ["mag", "Mag"], ["reload", "Rld"], ["ap", "AP"], ["count", "Cnt"], ["crit", "Crit", "pct"], ["jam", "Jam", "pct"], ["str", "STR"], ["req", "Skill"], ...R_COLS, ["lb", "Lb"], ["note", "Notes", "text"]],
  MW: [["tier", "T"], ["type", "Type", "text"], ["prName", "1st", "text"], ["dmg", "Dam"], ["ap", "AP"], ["base", "Hit", "pct"], ["pen", "Pen"], ["seName", "2nd", "text"], ["dmg2", "Dam"], ["ap2", "AP"], ["pen2", "Pen"], ["crit", "Crit", "pct"], ["jam", "Fail", "pct"], ["str", "STR"], ["req", "Skill"], ["status", "DOT", "text"], ["dotCh", "DOT%", "text"], ["lb", "Lb"], ["val", "Cap"], ["note", "Notes", "text"]],
};
WEAPON_COLS.BG = WEAPON_COLS.SG;
const itemKey = (o) => E.low(o.n);
const TABLES = {
  items: () => ({ title: "Items", rows: DATA.items, key: itemKey, cols: [["cat", "Cat", "text"], ["tier", "T", "text"], ["effect", "Effect", "text", 260], ["ap", "AP"], ["uses", "Uses"], ["dur", "Dur"], ["after", "After effect", "text", 150], ["trigger", "Trigger", "text"], ["addict", "Add", "pct"], ["withdrawal", "Withdrawal", "text", 130], ["req", "Requires", "text"], ["lb", "Lb"], ["val", "Cap"]] }),
  weapons: (cls) => ({ title: "Weapons", classes: { SG: "Small Guns", BG: "Big Guns", EW: "Energy", EX: "Explosives", MW: "Melee" }, rows: DATA.weapons.filter((w) => w.tab === cls), key: itemKey, cols: WEAPON_COLS[cls] }),
  armor: () => ({ title: "Armor", rows: DATA.armor, key: itemKey, cols: [["tier", "T"], ["type", "Type", "text"], ["loc", "Slot", "text"], ["dt", "DT"], ["buffs", "Buffs", "text", 170], ["nerfs", "Nerfs", "text", 170], ["mech", "Mechanic", "text", 120], ["faction", "Faction", "text"], ["formal", "Formal"], ["note", "Notes", "text", 120], ["lb", "Lb"], ["val", "Cap"]] }),
  ammo: () => ({ title: "Ammo", rows: DATA.ammo, key: itemKey, cols: [["cal", "Caliber", "text"], ["load", "Load", "text"], ["dam", "Dam"], ["pellets", "Pellets"], ["pen", "Pen"], ["tier", "T"], ["lb", "Lb"], ["cls", "Class", "text"], ["note", "Note", "text", 180]] }),
  mods: () => ({ title: "Weapon mods", rows: DATA.mods, key: itemKey, cols: [["tier", "T"], ["skill", "Skill", "text"], ["group", "Group", "text"], ["loc", "Slot", "text"], ["effect", "Effect", "text", 280], ["applies", "Applies to", "text", 140], ["lb", "Lb"]] }),
  materials: () => ({ title: "Materials", rows: DATA.materials, key: itemKey, cols: [["cat", "Cat", "text"], ["tier", "T", "text"], ["lb", "Lb"], ["val", "Cap"], ["note", "Notes", "text", 200]] }),
  recipes: () => ({ title: "Crafting recipes (reference: crafting comes in a later stage)", rows: DATA.recipes, key: (o) => "recipe:" + E.low(o.n), cols: [["type", "Type", "text"], ["station", "Station", "text"], ["req", "Requires", "text"], ["matsText", "Materials", "text", 420]], view: (o) => ({ ...o, matsText: (o.mats || []).map(([m, q]) => (q != null ? `${q} x ${m}` : m)).join(", ") }) }),
  enemies: () => ({ title: "Enemy templates", rows: DATA.enemies, key: (o) => "enemy:" + E.low(o.n), cols: [["tier", "T"], ["xp", "XP"], ["caps", "Caps", "text"], ["faction", "Faction", "text"], ...E.SPECIAL.map((k, i) => [`special.${i}`, k]), ["hp", "HP"], ["dt", "DT"], ["ap", "AP"], ["pri", "Init"], ["w1", "Weapon 1", "text", 130], ["w2", "Weapon 2", "text", 130], ["armor", "Armor", "text", 110]] }),
  traits: () => ({ title: "Traits", rows: DATA.traits, key: (o) => "trait:" + o.code, cols: [["code", "Roll", "text"], ["cat", "Cat", "text"], ["ben", "Benefit", "text", 260], ["draw", "Drawback", "text", 260], ["evo", "Evolution", "text", 120], ["evoBonus", "Evo bonus", "text", 220], ["evoTrig", "Trigger", "text", 140], ["fail", "Fail", "text", 140], ["rep", "Repression", "text", 110], ["repBonus", "Rep bonus", "text", 180]] }),
  perks: () => ({ title: "Perks", rows: [...DATA.levelPerks.map((p) => ({ ...p, kind: "Level" })), ...DATA.skillPerks.map((p) => ({ ...p, kind: "Skill", level: p.rank, req: `${p.need}+ ${p.group}` }))], key: (o) => perkKey(o.n), cols: [["kind", "Kind", "text"], ["level", "Level", "text"], ["req", "Requires", "text", 120], ["effect", "Effect", "text", 520]] }),
  statuses: () => ({ title: "Status effects", rows: DATA.statuses, key: (o) => "status:" + E.low(o.n), cols: [["mp", "M/P", "text"], ["tone", "Tone", "text"], ...[0, 1, 2, 3, 4].map((i) => [`tiers.${i}`, `Tier ${i + 1}`, "text", 170]), ["counters", "Counters", "text", 120]] }),
};
// ----- every table can leave the app for a spreadsheet and come back, as long as the columns match
// Each entry says where a table's rows live. perks are two workbook tables shown as one, so a kind column keeps them apart.
const TABLE_IO = {
  items: "items", armor: "armor", weapons: "weapons", ammo: "ammo", mods: "mods", materials: "materials", recipes: "recipes", enemies: "enemies", traits: "traits", statuses: "statuses", effects: "sc", perks: "perks", loot: "loot",
};
function tableRows(id) {
  if (id === "perks") return [...DATA.levelPerks.map((p) => ({ kind: "Level", ...p })), ...DATA.skillPerks.map((p) => ({ kind: "Skill", ...p }))];
  if (id === "loot") return S.rules.lootTable.map(([roll, shift]) => ({ roll, shift }));
  return DATA[TABLE_IO[id]];
}
const toCsv = (rows) => {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => { const t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
};
function fromCsv(text) {
  // Reads spreadsheet text one character at a time, because quoted cells can hold commas and line breaks.
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x !== "")) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x !== "")) rows.push(row);
  const head = rows.shift() || [];
  // Turns cell text back into numbers, true or false, and lists, so a spreadsheet round trip changes nothing.
  const val = (t) => { if (t === "") return undefined; if (t === "true") return true; if (t === "false") return false; if (/^[[{]/.test(t)) { try { return JSON.parse(t); } catch (e) { return t; } } return /^-?\d*\.?\d+(e-?\d+)?$/i.test(t) ? Number(t) : t; };
  return rows.map((r) => { const o = {}; head.forEach((k, i) => { const v = val(r[i] == null ? "" : r[i]); if (v !== undefined) o[k.replace(/^﻿/, "")] = v; }); return o; });
}
// ----- packs. A .zip holds: campaign.json, rules.json, tables/*.csv, readme.txt.
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** Writes a zip with no compression. It's the simplest form every tool can open, and packs are small enough. */
function makeZip(files) {
  const enc = new TextEncoder(); const parts = [], central = []; let offset = 0;
  const le = (n, size) => { const out = new Uint8Array(size); for (let i = 0; i < size; i++) out[i] = (n >>> (8 * i)) & 255; return out; };
  const join = (...a) => { const out = new Uint8Array(a.reduce((t, x) => t + x.length, 0)); let p = 0; for (const x of a) { out.set(x, p); p += x.length; } return out; };
  for (const [name, text] of files) {
    const nm = enc.encode(name), data = enc.encode(text), crc = le(crc32(data), 4), size = le(data.length, 4);
    const common = join(le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), crc, size, size, le(nm.length, 2), le(0, 2));  // 0x0800: names are UTF-8
    const head = join(le(0x04034b50, 4), common, nm);
    parts.push(head, data);
    central.push(join(le(0x02014b50, 4), le(20, 2), common, le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(offset, 4), nm));
    offset += head.length + data.length;
  }
  const cd = join(...central);
  return join(...parts, cd, le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(cd.length, 4), le(offset, 4), le(0, 2));
}
/** Reads a zip, including one re-saved by WinRAR, 7-Zip or Windows, which compress with "deflate". */
async function readZip(buf) {
  const b = new Uint8Array(buf), v = new DataView(buf); let e = b.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("That isn't a zip file.");
  const count = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = {};
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("That zip is damaged.");
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true); const raw = b.subarray(start, start + csize);
    if (!name.endsWith("/")) {
      if (method === 0) out[name] = new TextDecoder().decode(raw);
      else if (method === 8) out[name] = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      else throw new Error(`Can't read ${name}: unsupported compression.`);
    }
    p += 46 + nl + xl + cl;
  }
  return out;
}
const PACK_TABLES = ["items", "armor", "weapons", "ammo", "mods", "materials", "recipes", "enemies", "traits", "statuses", "effects", "perks", "loot"];
function packFiles() {
  const { tables, tableRev, rules, ...campaign } = S;
  const readme = "FALLOUT DM PACK\n\ncampaign.json: party, notes, log, the current scene and any fight.\nrules.json: every rule number, room setting, archetype and furniture item.\ntables/*.csv: every table. Open in Excel or Sheets. Keep the column names.\n\nThe fx and use columns are what the game applies. Change a written effect and the app reads it again on load. Change fx or use instead to set the variables yourself.\nThe Variables window in the app lists what each variable means.\n\nTo load: keep it a .zip (WinRAR can save as zip), then use Load pack in the app.\n";
  return [["readme.txt", readme], ["campaign.json", JSON.stringify(campaign, null, 1)], ["rules.json", JSON.stringify(rules, null, 1)], ...PACK_TABLES.map((id) => [`tables/${id}.csv`, toCsv(tableRows(id))])];
}
// What each table looks like with no edits, so a pack only stores the ones someone really changed.
let packBase = null;
function baseCsv(id, rules) {
  if (!packBase) { const d = clone0(WORKBOOK); E.standardize(d, rules); packBase = d; }
  const rows = id === "perks" ? [...packBase.levelPerks.map((p) => ({ kind: "Level", ...p })), ...packBase.skillPerks.map((p) => ({ kind: "Skill", ...p }))] : packBase[TABLE_IO[id]];
  return toCsv(rows).trim().replace(/\r\n/g, "\n");
}
async function loadPack(buf) {
  const files = await readZip(buf);
  const pick = (name) => Object.keys(files).find((k) => k.replace(/^.*?(campaign\.json|rules\.json|tables\/)/i, "$1").toLowerCase() === name || k.toLowerCase().endsWith("/" + name) || k.toLowerCase() === name);
  const cname = pick("campaign.json"); if (!cname) throw new Error("That zip has no campaign.json, so it isn't a pack.");
  const campaign = JSON.parse(files[cname]); const rn = pick("rules.json");
  campaign.rules = rn ? JSON.parse(files[rn]) : S.rules;
  const p = normalize({ ...campaign, tables: {}, tableRev: (S.tableRev || 0) + 1 });
  let edited = 0;
  for (const id of PACK_TABLES) {
    const name = pick(`${id}.csv`); if (!name) continue;
    const text = files[name].replace(/^﻿/, "");
    if (id === "loot") { p.rules.lootTable = fromCsv(text).map((r) => [r.roll, r.shift]); continue; }
    if (text.trim().replace(/\r\n/g, "\n") === baseCsv(id, DEFAULT_RULES)) continue;
    const rows = fromCsv(text);
    if (rows.some((r) => !r.n)) throw new Error(`${id}.csv: every row needs a name in the n column.`);
    edited++;
    if (id === "perks") { p.tables.levelPerks = rows.filter((r) => r.kind !== "Skill").map(({ kind, ...r }) => r); p.tables.skillPerks = rows.filter((r) => r.kind === "Skill").map(({ kind, ...r }) => r); }
    else p.tables[TABLE_IO[id]] = rows;
  }
  act("Load pack", () => { S = p; ui.sel = (S.chars[0] || {}).id; ui.atk = null; ui.modal = null; ui.end = null; ui.def = null; ui.pendingMove = null; });
  return edited;
}
function importTable(id, rows) {
  if (id === "enemies" && rows && !Array.isArray(rows) && Array.isArray(rows.enemies)) {
    const { namePools, nameStyles } = rows; rows = rows.enemies;
    if (namePools || nameStyles) act("Import enemy names", () => { if (namePools) S.rules.namePools = namePools; if (nameStyles) S.rules.nameStyles = nameStyles; });
  }
  if (!Array.isArray(rows) || !rows.length) return "That file has no rows.";
  const known = new Set(tableRows(id).flatMap((r) => Object.keys(r))); for (const k of ["fx", "use", "when", "rows", "useFrom", "fxFrom", "noteFrom", "parsed", "mods", "note", "sheetMods", "faction", "caps", "vanity", "head", "armor"]) known.add(k);
  const extra = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !known.has(k));
  if (extra.length) return `Wrong format: this table has no column called ${extra.slice(0, 4).join(", ")}.`;
  if (id !== "loot" && rows.some((r) => !r.n)) return "Wrong format: every row needs a name in the n column.";
  act(`Import ${id}`, () => {
    if (id === "loot") { S.rules.lootTable = rows.map((r) => [r.roll, r.shift]); return; }
    S.tables = S.tables || {};
    if (id === "perks") { S.tables.levelPerks = rows.filter((r) => r.kind !== "Skill").map(({ kind, ...r }) => r); S.tables.skillPerks = rows.filter((r) => r.kind === "Skill").map(({ kind, ...r }) => r); }
    else S.tables[TABLE_IO[id]] = rows;
    S.tableRev = (S.tableRev || 0) + 1;
    log("status", `Table replaced from a file: ${id}, ${rows.length} rows.`);
  });
  return "";
}
const tableTools = (id) => (TABLE_IO[id] ? `<span class="iobar">${btn("tableExport", `${id}|csv`, "Export CSV", "", "tiny")}${btn("tableExport", `${id}|json`, "Export JSON", "", "tiny")}<label class="btn tiny">Import<input type="file" id="tableFile" data-table="${id}" accept=".csv,.json" style="display:none"></label>${(S.tables && (S.tables[TABLE_IO[id]] || (id === "perks" && S.tables.levelPerks))) ? btn("tableReset", id, "Back to workbook", "", "tiny danger") : ""}</span>` : "");
function devWin() { return devTable() + (ui.modal.cat === "enemies" ? nameLists() : ""); }
function devTable() {
  const m = ui.modal;
  if (m.cat === "variables") return `${tableTools("effects")}<div class="s dim" style="margin:3px 0">Every effect the rules apply by themselves. Items, statuses, perks, traits and armor store these names in their fx column. Export a table to edit them in a spreadsheet.</div><table class="t"><tr><th>Variable</th><th>What it changes</th></tr>${Object.entries(E.VARS).map(([k, v]) => `<tr><td class="bright">${h(k)}</td><td>${h(v)}</td></tr>`).join("")}</table><h3>Not converted (${SKIPPED.length})</h3><table class="t"><tr><th>Type</th><th>Name</th><th>Why</th></tr>${SKIPPED.slice(0, 400).map(([t, n, w]) => `<tr><td class="dim">${h(t)}</td><td>${h(n)}</td><td class="s">${h(w)}</td></tr>`).join("")}</table>`;
  if (m.cat === "loot") return `${tableTools("loot")}${lootTables()}`;
  if (m.cat === "report") return `<pre class="rep">${h(DATA.report || "Rebuild to include the report.")}</pre>`;
  if (m.cat === "state") return `<div class="s dim" style="margin-bottom:3px">The whole campaign as JSON. Edit it and apply; Undo brings the old version back.</div><div class="acts">${btn("rawApply", "", "Apply", "", "primary")}${btn("rawReload", "", "Reload from current")}</div><textarea id="rawState" spellcheck="false" style="height:calc(100% - 52px)" data-u="modal.raw">${h(m.raw)}</textarea>`;
  const def = TABLES[m.cat](m.cls);
  const q = E.low(m.q);
  let rows = def.rows.map((o) => { const key = def.key(o); const v = { ...(def.view ? def.view(o) : o), ...(S.overrides[key] || {}) }; return { o, key, v }; }).filter((r) => !q || E.low(r.v.n).includes(q) || JSON.stringify(r.v).toLowerCase().includes(q));
  if (m.sort) { const dir = m.dir || 1; rows = [...rows].sort((a, b) => { const x = m.sort === "n" ? a.v.n : getPath(a.v, m.sort), y = m.sort === "n" ? b.v.n : getPath(b.v, m.sort); return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true })) * dir; }); }
  const size = m.cat === "enemies" ? Math.max(1, rows.length) : 60; /* every enemy on one page */ const pages = Math.max(1, Math.ceil(rows.length / size)); const page = clamp(m.page || 0, 0, pages - 1);
  const shown = rows.slice(page * size, page * size + size);
  const head = def.cols.map(([k, l]) => `<th data-a="devSort" data-v="${h(k)}">${h(l)}${m.sort === k ? (m.dir > 0 ? " ^" : " v") : ""}</th>`).join("");
  const body = shown.map((r, ri) => `<tr class="${r.v.ok === undefined && r.o.tab ? "gap" : ""}"><td class="stick" title="${h(r.v.n)}">${h(r.v.n)}</td>${def.cols.map(([k, , kind, w], ci) => { const val = getPath(r.v, k); const edited = S.overrides[r.key] && getPath(S.overrides[r.key], k) !== undefined; if (kind === "bool") return `<td><input type="checkbox" data-ov="${h(r.key)}|${k}|bool" id="dc-${ri}-${ci}"${val ? " checked" : ""}></td>`; const text = kind === "pct" ? (val == null ? "" : E.pct(val)) : val == null ? "" : val; return `<td style="min-width:${w || (kind === "text" ? 92 : 34)}px"><input type="text" autocomplete="off" class="cell left ${edited ? "ovr" : ""}" style="width:100%" title="${h(text)}" data-ov="${h(r.key)}|${k}|${kind || "num"}" id="dc-${ri}-${ci}" value="${h(text)}"></td>`; }).join("")}<td>${S.overrides[r.key] ? btn("ovReset", r.key, "Reset", "", "tiny") : ""}</td></tr>`).join("");
  return `<div class="row wrap" style="margin-bottom:3px">${tableTools(m.cat)}${def.classes ? Object.entries(def.classes).map(([c, n]) => `<button class="opt ${m.cls === c ? "on" : ""}" data-a="devClass" data-v="${c}">${n}</button>`).join("") : ""}<input id="devQ" autocomplete="off" placeholder="Filter" data-u="modal.q" value="${h(m.q)}" style="width:180px"><span class="s dim">${rows.length} rows. Every box is editable. Yellow means edited by you. Click a heading to sort.</span><span class="spacer"></span>${pages > 1 ? `${btn("devPage", "-1", "Prev", "", "tiny")}<span class="s">${page + 1}/${pages}</span>${btn("devPage", "1", "Next", "", "tiny")}` : ""}</div><table class="t"><tr><th class="stick" data-a="devSort" data-v="n">Name</th>${head}<th></th></tr>${body}</table>`;
}
function nameLists() {
  const pools = S.rules.namePools || {};
  const used = (k) => Object.entries(S.rules.nameStyles || {}).filter(([, st]) => [st.first, st.last, st.nick].includes(k)).map(([f]) => f).join(", ") || "no faction yet";
  return `<h3 style="margin-top:8px">Enemy names</h3><div class="s dim">Generic enemies pick from these when they join: "Legion Soldier - Vulpa". Separate names with commas. Export JSON above saves these with the enemies; Refresh at the top loads edits into the menus.</div>
  <div class="namegrid">${Object.keys(pools).map((k) => `<label><span>${h(k)} <span class="dim">(${String(pools[k]).split(",").filter(Boolean).length}, used by ${h(used(k))})</span></span><textarea id="np-${h(k)}" rows="4" data-c="setNamePool" data-k="${h(k)}">${h(String(pools[k]).split(",").join(", "))}</textarea></label>`).join("")}</div>`;
}
function lootTables() {
  const t = S.rules.lootTable;
  const caps = DATA.enemies.filter((e) => !e.test && e.caps).map(enemyV);
  const tiers = [1, 2, 3, 4, 5, 6].map((tier) => { const it = DATA.items.filter((i) => i.effect && Number(i.tier) === tier && ["Healing", "Chem/Drug", "Drink", "Food", "Alcohol"].includes(i.cat)); return `<tr><td>T${tier}</td><td>${E.poolFor(ctx(), ["SG", "BG", "EW"], tier).filter((w) => w.tier === tier).length}</td><td>${E.poolFor(ctx(), ["MW"], tier).filter((w) => w.tier === tier).length}</td><td class="s">${h(it.map((i) => i.n).join(", ") || "none")}</td></tr>`; }).join("");
  return `<div class="ops" style="grid-template-columns:200px minmax(0,1fr) minmax(0,1.6fr);height:100%"><div style="overflow:auto"><h3>d20: average tier</h3><table class="t"><tr><th>Roll</th><th>Tier shift</th></tr>${t.map((r, i) => `<tr><td>${h(r[0])}</td><td>${numBox(`data-rule="lootTable.${i}.1" data-rt="num" id="lt-${i}"`, r[1], "cell")}</td></tr>`).join("")}</table></div>
    <div style="overflow:auto"><h3>Enemy caps</h3><table class="t"><tr><th>Enemy</th><th>T</th><th>Caps</th></tr>${caps.map((e, i) => `<tr><td>${h(e.n)}</td><td>${h(e.tier)}</td><td><input type="text" autocomplete="off" class="cell" data-ov="enemy:${h(E.low(e.n))}|caps|text" id="lc-${i}" value="${h(e.caps)}"></td></tr>`).join("")}</table></div>
    <div style="overflow:auto"><h3>What generated enemies can carry</h3><table class="t"><tr><th>Tier</th><th>Guns</th><th>Melee</th><th>Consumables</th></tr>${tiers}</table><div class="s dim" style="margin-top:4px">The workbook's faction loot columns (Raider, NCR, Legion and so on) are empty, so faction doesn't change loot yet. Looting stays manual: the after-action screen lets you hand things out.</div></div></div>`;
}

// ----- context windows
function dlgStyle(type) { const d = ui.dlg[type]; if (!d) return ""; return `position:fixed;left:${d.x}px;top:${d.y}px;width:${d.w}px;height:${d.h}px;max-height:none;margin:0;`; }
function renderModal() {
  const m = ui.modal; const ce = ent(m.id);
  const defs = {
    move: [`Move: ${h((ent(m.att) || {}).name)}`, moveModal], item: [`Use item: ${h((ent(m.who) || {}).name)}`, itemModal], status: [`Status: ${h((ce || {}).name)}`, statusModal], edit: [`Edit: ${h((ce || {}).name)}`, editModal], level: [`${h((ce || {}).name)}: now level ${(ce || {}).level}`, levelModal], help: ["Keys", helpModal], search: ["Search", searchModal], detail: [m.hit ? `${h(m.hit[1].n)} [${h(m.hit[0])}]` : "", detailModal], dev: [m.cat ? h((DEV.find(([id]) => id === m.cat) || [])[1]) : "", devWin],
    settings: ["Settings: game rules", settingsBody], items: ["Item browser", itemsBody], loadWin: ["Load save", loadBody], autoWin: ["Autosave", autoBody], notes: ["Old notes", notesBody], check: ["Skill check", checkBody], sheet: [`${h((ce || {}).name)}: Character`, sheetBody], health: [`${h((ce || {}).name)}: Health`, healthBody], guide: ["How to use this", guideBody], wizard: ["New character", wizardBody], newc: ["New campaign", newcBody], pwide: [m.side === "enemies" ? "All enemies" : "Party-wide", pwBody],
    char: [`${h((ce || {}).name)}: Inventory`, () => (ce ? invSect(ce, der(ce)) : "")],
  };
  const [title, body] = defs[m.type];
  const key = m.type === "dev" ? "dev" : m.type;
  const size = m.type === "dev" ? "full" : ["edit", "help", "char", "items", "notes", "sheet", "health", "guide", "wizard"].includes(m.type) ? "big" : ["autoWin", "move"].includes(m.type) ? "tiny" : "";
  return `<div class="scrim" data-a="closeModal"><div class="dialog float ${size}" data-a="noop" data-dlg="${key}" style="${dlgStyle(key)}" role="dialog" aria-modal="true"><header class="wt"><span>${title}</span><span class="spacer"></span><button class="btn tiny" data-a="closeModal" data-v="">${kbd("Esc")}Close</button></header><div class="wb" data-scroll="modal-${key}">${body()}</div></div></div>`;
}
function moveSpot(att, tgt, r) {
  const a = posOf(att), t = posOf(tgt); const d = dist(a, t); const m = S.rules.bandMeters[r - 1];
  if (!d) return inMap({ x: t.x + m, y: t.y });
  return inMap({ x: t.x + ((a.x - t.x) / d) * m, y: t.y + ((a.y - t.y) / d) * m });
}
function moveModal() {
  const m = ui.modal; const A = ent(m.att), T = ent(m.tgt); const cur = rangeOf(m.att, m.tgt);
  const opts = S.rules.moveAP.map((c, i) => { const r = i + 1; const spot = moveSpot(m.att, m.tgt, r); if (r !== cur && bandFor(dist(spot, posOf(m.tgt))) !== r) return ""; const cost = r === cur ? 0 : moveCost(posOf(m.att), spot, A); return `<button class="opt ${r === cur ? "on" : ""} ${cost > A.ap ? "na" : ""}" data-a="moveTo" data-v="${r}">${kbd(r === 10 ? "0" : String(r))}R${r} <small>${cost === Infinity ? "can't" : cost + "AP"}</small></button>`; }).join("");
  return `${field("Relative to", `<select id="mvT" data-u="modal.tgt">${options(targetsFor(m.att).map((id) => [id, ent(id).name]), m.tgt)}</select>`)}<div class="s dim" style="margin:3px 0">${h(T.name)} is at R${cur}. ${h(A.name)} has ${fmt(A.ap)} AP. Press a number for the new range (0 is R10), or drag the token on the map. Bands that don't fit this location aren't listed.</div><div class="opts">${opts}</div>`;
}
function itemModal() {
  const m = ui.modal; const A = ent(m.who);
  const lines = (A.inv || []).map((l, i) => ({ l, i, it: E.get(ctx(), l.n) })).filter((x) => x.it && x.it.cat === "item" && usable(x.it.o));
  const sel = m.sel != null ? (A.inv || [])[m.sel] : null; const it = sel && E.get(ctx(), sel.n);
  const list = lines.map((x, n) => `<button class="rowbtn ${m.sel === x.i ? "on" : ""}" data-a="itemPick" data-v="${x.i}">${n < 9 ? kbd(String(n + 1)) : ""}<span class="grow">${h(x.l.n)} <span class="dim">x ${fmt(x.l.q)}</span>${x.l.active ? "" : ` <span class="tag">STOWED</span>`}</span><span class="s dim">${x.it.o.ap != null ? x.it.o.ap + " AP" : ""}</span></button>`).join("");
  let detail = "";
  if (it) {
    const tgtE = ent(m.tgt) || A;
    const healDefault = E.healAmount(it.o.effect, der(A), der(tgtE));
    const who = [...S.chars, ...((K() && K().npcs) || [])].map((x) => [x.id, x.name]);
    const u = it.o.use || {}; const mods = u.fx || {};
    detail = `<div class="result"><span class="bright">${h(sel.n)}</span>: ${h(it.o.effect || "No effect written.")}${it.o.after ? `<br>After: ${h(it.o.after)}` : ""}${it.o.addict ? `<br>Addiction ${E.pct(it.o.addict)}%${it.o.withdrawal ? `, withdrawal: ${h(it.o.withdrawal)}` : ""}` : ""}</div>
     <div class="grid wide">${field("On", `<select id="itemTgt" data-u="modal.tgt">${options(who, m.tgt || A.id)}</select>`)}${field("Heal HP", numBox(`id="itemHeal" data-u="modal.heal"`, m.heal != null ? m.heal : healDefault))}</div>
     ${tgtE.dbno ? `<div class="warnline">${h(tgtE.name)} is down. Healing items won't stand them up: use Revive.</div>` : ""}<div class="s dim" style="margin-bottom:3px">${[(u.applies || []).length ? `Applies ${(u.applies).map((x) => `${x.n} ${x.tier}`).join(", ")}${it.o.dur ? ` for ${it.o.dur} turns` : ""}` : "", Object.keys(u.reduces || {}).length ? `Lowers ${Object.entries(u.reduces).map(([n, x]) => `${n} by ${x}`).join(", ")}` : "", (u.removes || []).length ? `Removes ${u.removes.join(", ")}` : "", Object.keys(mods).length ? `Effect: ${h(modLine({ mods }))}` : "", u.after ? `Afterward: ${u.after.n}` : ""].filter(Boolean).join(" · ") || "Nothing automatic. Apply anything else by hand."}</div>${primary("itemUse", "", "Use", "Enter")}`;
  }
  return `<div class="results" style="max-height:230px">${list || `<div class="dim">Nothing usable in this inventory.</div>`}</div>${detail}`;
}
function statusModal() {
  const m = ui.modal; const e = ent(m.id); const def = db.status.get(E.low(m.name)); const inf = def ? E.statusInfo(ctx(), { n: def.n, tier: num(m.tier, 1) }) : null;
  return `${statusSect(e)}<h3>Quick add</h3><div class="grid wide">${field("Status", `<input id="stName" autocomplete="off" list="dl-status" data-u="modal.name" value="${h(m.name)}" data-enter="stAdd">`)}${field("Tier", `<select id="stTier" data-u="modal.tier">${options([1, 2, 3, 4, 5], m.tier)}</select>`)}${field("Turns (blank: until removed)", numBox(`id="stTurns" data-u="modal.turns" data-enter="stAdd"`, m.turns))}</div>${inf && inf.text ? `<div class="s dim" style="margin-bottom:3px">${h(inf.text)}</div>` : ""}${primary("stAdd", "", "Add", "Enter")}`;
}
function editModal() {
  const e = ent(ui.modal.id); if (!e) return "Gone.";
  const d = der(e); const isPc = e.kind === "pc";
  const pool = S.rules.startPool - e.special.reduce((t, x) => t + (x || 0), 0);
  const sp = E.SPECIAL.map((k, i) => field(`${SP_LABEL[k]}${d.sp[k] != null && d.sp[k] !== e.special[i] ? ` (${d.sp[k]})` : ""}`, bindNum(e.id, `special.${i}`, e.special[i]))).join("");
  const common = `<div class="grid">${field("Current HP", bindNum(e.id, "hp", e.hp))}${field(`Max HP (${d.hp})`, bindNum(e.id, "ov.hp", (e.ov || {}).hp, 'placeholder="auto"'))}${field("AP now", bindNum(e.id, "ap", e.ap))}${field(`Max AP (${d.ap})`, bindNum(e.id, "ov.ap", (e.ov || {}).ap, 'placeholder="auto"'))}${field(`DT (${fmt(d.dt)})`, bindNum(e.id, "ov.dt", (e.ov || {}).dt, 'placeholder="auto"'))}${field(`Init (${fmt(d.pri)})`, bindNum(e.id, "ov.pri", (e.ov || {}).pri, 'placeholder="auto"'))}</div>`;
  if (isPc) {
    const skills = E.SKILLS.map(([k, n]) => `<button class="opt ${(e.tags || []).includes(k) ? "on" : ""}" data-a="toggleTag" data-v="${e.id}|${k}" title="${n}">${k} <small>${d.skills[k]}</small></button>`).join("");
    const traitInput = (i) => { const code = (e.traits || [])[i] || ""; const t = db.traitByCode.get(code); return field(i === 2 ? "Trait 3 (rolled 000-099)" : `Trait ${i + 1}`, `<input autocomplete="off" data-c="setTrait" data-id="${e.id}" data-i="${i}" id="tr-${e.id}-${i}" list="dl-traits" value="${h(t ? `${code} ${t.n}` : code)}">`); };
    return `<div class="grid wide">${field("Name", bindText(e.id, "name", e.name))}${field("Background", bindText(e.id, "background", e.background))}${field("Specialization", bindText(e.id, "spec", e.spec))}</div>
     <h3>Base SPECIAL <span class="tag ${pool < 0 ? "bad" : ""}">${pool < 0 ? `${-pool} OVER` : `${pool} LEFT`} OF ${S.rules.startPool}</span></h3><div class="grid tight">${sp}</div>
     <h3>Tagged skills <span class="tag ${(e.tags || []).length === 3 ? "" : "warn"}">${(e.tags || []).length} OF 3</span></h3><div class="opts" style="margin-bottom:4px">${skills}</div>
     <h3>Traits</h3><div class="grid wide">${[0, 1, 2].map(traitInput).join("")}</div>${common}
     <div class="acts"><span class="spacer"></span>${btn("delChar", e.id, "Delete character", "", "danger")}</div>`;
  }
  return `<div class="s dim" style="margin-bottom:3px">Changes only this one enemy, never the template (${h(e.tmpl)}).</div>
    <div class="grid wide">${field("Name", bindText(e.id, "name", e.name))}${field("Tier", `<select data-bind="${e.id}:tier" data-t="num" id="npcTier">${options([1, 2, 3, 4, 5, 6], e.tier)}</select>`)}${field("XP", bindNum(e.id, "xp", e.xp))}</div>
    <div class="acts">${btn("reroll", e.id, "Reroll weapons and loot", "", "", e.mob ? "Mobs use natural attacks" : "")}${btn("makeBoss", e.id, "Make Boss", "", "on")}${btn("saveNamed", e.id, "Save as named NPC")}${btn("removeNpc", e.id, "Remove", "", "danger")}</div>
    <h3>SPECIAL</h3><div class="grid tight">${sp}</div><h3>Skills</h3><div class="grid tight">${E.SKILLS.map(([k]) => field(k, bindNum(e.id, `skills.${k}`, (e.skills || {})[k], `placeholder="${d.skills[k]}"`))).join("")}</div>${common}
    <div class="grid wide">${field("Head", bindText(e.id, "gear.head", e.gear.head, "dl-armor"))}${field("Armor", bindText(e.id, "gear.armor", e.gear.armor, "dl-armor"))}${field("Vanity", bindText(e.id, "gear.vanity", e.gear.vanity, "dl-armor"))}${field("Caps carried", bindNum(e.id, "caps", e.caps))}</div>
    <h3>Weapons</h3>${weaponRows(e, d)}<h3>Statuses</h3>${statusSect(e)}`;
}
function levelModal() {
  const e = ent(ui.modal.id); const d = der(e); const due = e.perkDue || 0;
  const owned = new Set((e.perks || []).map(E.low));
  const levelOpts = DATA.levelPerks.map((p) => perkInfo(p.n) || p).filter((p) => !owned.has(E.low(p.n)) && num(p.level) != null && num(p.level) <= e.level && reqMet(p.req, d));
  const skillOpts = DATA.skillPerks.filter((p) => !owned.has(E.low(p.n)) && (d.skills[(E.SKILLS.find(([, n]) => n === p.group) || [])[0]] || 0) > p.need);
  const row = (p, sub, kind) => `<div class="line t"><div class="grow"><span class="bright">${h(p.n)}</span> <span class="s dim">${h(sub)}</span><div class="s dim">${h(p.effect || "No effect written.")}</div></div>${btn("levelPerk", `${e.id}|${p.n}|${kind}`, "Take", "", "tiny")}</div>`;
  return `<div class="lvlhead"><div><b>${e.ptsBank || 0}</b><span>SKILL POINTS TO ASSIGN</span></div><div class="${due ? "warn" : ""}"><b>${due}</b><span>PERK${due === 1 ? "" : "S"} TO PICK</span></div><div class="s dim grow">Level ${e.level}. ${d.pts} points a level (10 + INT/2). Tagged skills gain 2 per point. A level perk comes every ${S.rules.perkEvery} levels. Anything you leave stays banked on the card.</div></div>
    <div style="columns:2">${E.SKILLS.map(([k, n]) => `<div class="line" style="break-inside:avoid"><span class="grow">${n}${(e.tags || []).includes(k) ? ` <span class="tag warn">TAG</span>` : ""}</span><span class="bright">${d.skills[k]}</span><button class="btn tiny" data-a="spend" data-v="${e.id}|${k}|-1" title="Take a point back">-</button><button class="btn tiny" data-a="spend" data-v="${e.id}|${k}|1" title="Spend a point">+</button><button class="btn tiny" data-a="spend" data-v="${e.id}|${k}|5" title="Spend five points">+5</button></div>`).join("")}</div>
    ${fold("lvlperks", due ? `Pick a level perk (${due})` : "Level perks you qualify for", levelOpts.map((p) => row(p, `Lv ${p.level}${p.req ? " · " + p.req : ""}`, "level")).join("") || `<div class="dim">None in the sheet for this level. Add any perk by name below.</div>`, { open: due > 0, badge: levelOpts.length })}
    ${fold("skillperks", "Skill perks you qualify for", skillOpts.map((p) => row(p, `${p.group} ${p.rank}`, "skill")).join("") || `<div class="dim">None yet. They open up at over 60, 80 and 100 in a skill.</div>`, { badge: skillOpts.length })}
    <div class="line"><input class="grow" id="lvlPerkAny" autocomplete="off" list="dl-perks" placeholder="Or add any perk by name, Enter" data-enter="addPerk" data-id="${e.id}"></div>
    <div class="acts" style="margin-top:4px">${canLevel(e) ? btn("levelUp", e.id, `Next level (${e.level + 1})`) : ""}${primary("closeModal", "", "Done", "Enter")}</div>`;
}
const noteTitle = (n) => { const t = String(n.text || "").trim(); return String(n.subject || "").trim() || (t.length > 15 ? t.slice(0, 15) + "..." : t) || "Empty note"; };
function notesBody() {
  const list = [...S.notesList].sort((a, b) => b.at - a.at); const cur = S.notesList.find((n) => n.id === ui.noteId);
  return `<div class="notes"><div class="nlist" data-scroll="nlist">${btn("noteNew", "", "New note", "", "tiny")}<h3>Recent</h3>${list.map((n) => `<button class="rowbtn ${n === cur ? "on" : ""}" data-a="noteOpen" data-v="${n.id}" title="${h(noteTitle(n))}"><span class="grow nm">${h(noteTitle(n))}</span><span class="s faint">${h(new Date(n.at).toLocaleDateString())}</span></button>`).join("") || `<div class="s dim">Nothing yet.</div>`}</div>
    <div class="nedit"><input id="noteSubj" autocomplete="off" placeholder="Subject (optional: otherwise the first 15 characters)" data-note="subject" value="${h(cur ? cur.subject : "")}"><textarea id="noteText" spellcheck="false" data-scroll="notetext" placeholder="Anything you want to remember. Saved with the campaign." data-note="text">${h(cur ? cur.text : "")}</textarea>${cur ? `<div class="acts">${btn("noteDel", cur.id, "Delete", "", "tiny danger")}</div>` : ""}</div></div>`;
}
const GUIDE = [
  ["Your screen", "Party cards are on the left. Notes run along the bottom, with the vendor in the bottom right corner when nobody is fighting. The middle shows what's going on: encounter setup, skill checks, recent events and the combat log out of combat, and the map and turn panel in a fight. The thin column on the right holds new campaign, settings, save, load, autosave, the Wiki, the log, the item browser, old notes and this guide. You can drag the bars between panels to resize them, and drag a window's title to move it. Undo (Ctrl+Z) reverses anything."],
  ["Party cards", "Each card shows HP, AP, SPECIAL and skills as boxes you can type in. Type over a number to override it. Three buttons open menus. Inventory shows gear on a body with everything carried below. Character holds stats, perks and traits. Health shows statuses and what they do to skills. When a character has points or a perk waiting, a bright button appears on the card."],
  ["Gear", "In Inventory, click a box on the body, or a weapon box on the left, to pick what goes there. It lists what the character carries. Search to hand out something new. Equipping swaps the old piece back into the pack. Hover armor to read its effects. Total DT and bonuses show at the top. Weapons only load ammo that's in the pack."],
  ["Out of combat", "Skill check: pick a skill and difficulty, or press Random, then type each player's d20. It tells you pass or fail and logs it. Vendor: pick a tier and barter level. Prices depend on the selected character's Barter against the vendor's. Buy and Sell move caps and items. A ~ on a price means the workbook has no price, so it's a placeholder from Settings. Use Rest on the party window after a fight, and All to change everyone at once."],
  ["Setting up a fight", "Press Set up encounter or B. Pick a location, which sets the map's size and so which ranges are possible. Add enemies from the list on the right. Random and Surround place them, or drag them. Click Ally on a card to turn someone blue and on the party's side. Place cover and markers with the buttons above the map. Press Begin, or Sneak to start with a stealth phase. Then type initiative rolls."],
  ["Taking a turn", "The acting character's name is at the top of the action column, and they blink green on the map and in the lists. The attack menu is already up. Pick a weapon, click a target on the map or in a list, click a body part, type the two-dice roll, press Enter. The body is bright red for an enemy and bright green for your own side. Your consumables are listed below it. Drag your token inside the dashed circle to preview a move: you see the AP cost, what's left and the new range, then Confirm or Cancel. Everything costs AP and stops when you can't afford it. Tick Free under OVR, or hold Shift while dragging, to overrule that. Press N to end the turn."],
  ["Cover and the aim line", "The line to your target is colored by the selected weapon's accuracy at each range band: red is its worst, green its best. Every shot has a cover flag from whatever the line crosses, and the worst thing wins. Open has no penalty. Concealment is -10% to hit. Soft cover is -25% to hit and -10% damage. Hard cover is -50% and -50%. Impenetrable is -100% and -100%. You can change any object's tier by clicking it, and set a shot's cover by hand under OVR. Buildings also stop walking."],
  ["Rooms", "In encounter setup, pick a Location for the size and a Setting for what fills it, then press Randomize room as often as you like. Each setting has its own furniture, and bigger maps get more of it. City streets lays out concrete blocks when the map is large enough. Every map uses a 2 meter grid of whole squares. Scroll over the map, or use + and -, to zoom, drag empty ground to slide around, and Fit to see it all. Objects are drawn at real size, and people keep a readable size zoomed out and become life-size up close. Solid-looking objects stop more: concealment is faint, impenetrable is solid. On trees, only the small trunk circle stops shots: the leaves are just a picture. Click an object to select it, then use the turn buttons or Shift+scroll to rotate it. Shots and walking follow its turned shape. Add your own pieces with the buttons above the map, drag them around, and right-click to remove."],
  ["Packs", "Save pack, in the Load window, makes a .zip with your campaign, rules and every table as a spreadsheet. Open it, edit what you want, zip it back and use Load pack. It only keeps tables you actually changed, and Undo reverses a load. Keep it a .zip: WinRAR can save as zip, but browsers can't open .rar files."],
  ["Effects and data", "Items, statuses, perks and armor store their effects as named variables, listed in the Variables window up top with everything that still needs a DM. Rules can have conditions, like vs robots, first turn, only with pistols, or below 25% health, and they turn on by themselves for the shot in question. Drugs and drinks apply a real status with the workbook's numbers. When they wear off, a hangover or comedown can follow. Rest clears them. Each table up top has Export CSV, Export JSON and Import, so you can edit it in a spreadsheet and bring it back. The columns must match. Back to workbook undoes a replaced table."],
  ["After a fight", "Press End when it's over. The after-action screen gives XP and healing, and you hand out loot. If someone earned a level, a button appears on their card: it gives skill points to assign, and a perk every two levels. If the party lost, the Defeat button lets you choose what it costs them."],
  ["Saving", "Autosave keeps your place in this browser. Save writes to a named save you can reload from Load. Use Backup file there to keep a copy somewhere safe, because browser data can be cleared. New campaign asks whether to save first."],
  ["New campaign", "New campaign wipes everything back to the workbook: party, edited rules and items, notes and log. Then you build each character in five steps. Name and archetype, which sets the small starting kit. SPECIAL, which starts at 5 each and can't total more than 40. Traits: one rolled for you with a single reroll, then two you pick. Three tag skills. Then review, and add another or start."],
];
function guideBody() {
  const i = clamp(ui.guide, 0, GUIDE.length - 1);
  return `<div class="opts" style="margin-bottom:6px">${GUIDE.map(([t], n) => `<button class="opt ${n === i ? "on" : ""}" data-a="guideGo" data-v="${n}">${n + 1}. ${h(t)}</button>`).join("")}</div><h3>${h(GUIDE[i][0])}</h3><div class="txt guide">${h(GUIDE[i][1])}</div><div class="acts" style="margin-top:8px">${i > 0 ? btn("guideGo", i - 1, "Back") : ""}${i < GUIDE.length - 1 ? primary("guideGo", i + 1, "Next", "Enter") : primary("closeModal", "", "Done", "Enter")}</div>`;
}
// ----- step-by-step character creation
const rollTrait = (not = []) => { const pool = DATA.traits.filter((t) => !not.includes(t.code)); return pool[Math.floor(Math.random() * pool.length)].code; };
const newWiz = () => ({ step: 0, name: "", arch: null, special: Array(7).fill(S.rules.startSpecial), rolled: rollTrait(), rerolled: false, pick: ["", ""], tags: [] });
const WIZ_STEPS = ["Who", "SPECIAL", "Traits", "Tag skills", "Review"];
function kitText(a) {
  return [a.w, a.ammo ? `${a.ammo[1]} x ${a.ammo[0]}` : "", ...(a.wear || []), ...(a.items || []).map(([n, q]) => (q > 1 ? `${q} x ${n}` : n)), a.caps ? `${a.caps} caps` : ""].filter(Boolean).join(", ");
}
function buildChar(w) {
  const a = S.rules.archetypes[w.arch];
  const c = { id: "c" + Date.now().toString(36) + S.seq++, name: w.name.trim() || a.n, background: a.n, spec: "", special: [...w.special], traits: [w.rolled, ...w.pick], tags: [...w.tags], inv: [], caps: a.caps || 0, weapons: [], gear: {} };
  for (const n of a.wear || []) { const it = E.get(ctx(), n); if (!it) continue; const slot = /head/i.test(it.o.loc) ? "head" : it.o.loc === "Vanity" ? "vanity" : "armor"; c.gear[slot] = it.o.n; }
  for (const [n, q] of a.items || []) addInv(c, n, q, true);
  const wp = E.get(ctx(), a.w);
  if (wp) {
    const slot = { n: wp.o.n, mag: 0 };
    if (a.ammo) { if (["SG", "BG"].includes(wp.o.tab)) slot.ammo = a.ammo[0]; slot.mag = Math.min(wp.o.mag || 0, a.ammo[1]); if (a.ammo[1] > slot.mag) addInv(c, a.ammo[0], a.ammo[1] - slot.mag, true); }
    c.weapons.push(slot);
  }
  c.weapons.push({ n: "Basic Fighting" });
  return initChar(c, ctx());
}
function wizardBody() {
  const w = ui.wiz; const pool = S.rules.startPool; const used = w.special.reduce((t, x) => t + x, 0);
  const steps = `<div class="wizsteps">${WIZ_STEPS.map((n, i) => `<span class="${i === w.step ? "on" : i < w.step ? "done" : ""}">${i + 1} ${n}</span>`).join("")}</div>`;
  const nav = (next, label = "Next") => `<div class="acts wiznav">${w.step > 0 ? btn("wizGo", w.step - 1, "Back") : ""}<span class="spacer"></span>${primary(next, next === "wizGo" ? w.step + 1 : "", label, "Enter")}</div>`;
  const trait = (code) => { const t = db.traitByCode.get(code); return t ? `<div class="txt"><span class="bright">${h(t.code)} ${h(t.n)}</span> <span class="s dim">${h(t.cat)}</span><br>+ ${h(t.ben)}<br>- ${h(t.draw)}</div>` : ""; };
  if (w.step === 5) return `<div class="wizsteps"><span class="on">Party so far: ${S.chars.length}</span></div>${S.chars.map((c) => `<div class="line"><span class="bright grow">${h(c.name)}</span><span class="s dim">${h(c.background)}</span></div>`).join("")}<div class="acts wiznav">${btn("wizAnother", "", "Create another character")}<span class="spacer"></span>${primary("closeModal", "", "Start the campaign", "Enter")}</div>`;
  if (w.step === 0) return `${steps}<div class="row" style="margin-bottom:4px"><label class="f grow">Name<input id="wizName" autocomplete="off" data-u="wiz.name" value="${h(w.name)}" placeholder="Character name"></label></div><h3>Archetype <span class="s dim">your starting kit, and little else</span></h3><div class="archgrid">${S.rules.archetypes.map((a, i) => `<button class="arch ${w.arch === i ? "on" : ""}" data-a="wizArch" data-v="${i}"><span class="bright">${h(a.n)}</span><span class="s dim">${h(a.d)}</span><span class="s">${h(kitText(a))}</span></button>`).join("")}</div>${nav("wizGo")}${S.chars.length ? "" : `<div class="s dim" style="margin-top:6px">Testing? ${btn("wizSample", "", "Load the workbook's sample party", "", "tiny")}</div>`}`;
  if (w.step === 1) return `${steps}<div class="geartop"><div class="bigdt"><b>${pool - used}</b><span>POINTS LEFT</span></div><div class="s dim">Everyone starts at ${S.rules.startSpecial} in each. The total can't go over ${pool}. Lower one to raise another. Each stat is 1 to 10.</div></div>${E.SPECIAL.map((k, i) => `<div class="line wizstat"><span class="grow">${E.SPECIAL_NAMES[k]}</span><button class="btn" data-a="wizStat" data-v="${i}|-1" aria-label="Lower ${E.SPECIAL_NAMES[k]}">-</button><b>${w.special[i]}</b><button class="btn" data-a="wizStat" data-v="${i}|1" aria-label="Raise ${E.SPECIAL_NAMES[k]}">+</button></div>`).join("")}${nav("wizGo")}`;
  if (w.step === 2) { const opts = (cur, other) => `<option value="">Choose a trait</option>${options(DATA.traits.filter((t) => t.code !== w.rolled && t.code !== other).map((t) => [t.code, `${t.code} ${t.n}`]), cur)}`; return `${steps}<h3>Rolled for you</h3>${trait(w.rolled)}<div style="margin:3px 0 6px">${w.rerolled ? `<span class="s dim">Reroll used.</span>` : btn("wizReroll", "", "Reroll (once only)", "", "tiny")}</div><h3>Pick two</h3><div class="grid wide"><label class="f">First<select id="wizP0" data-u="wiz.pick.0">${opts(w.pick[0], w.pick[1])}</select></label><label class="f">Second<select id="wizP1" data-u="wiz.pick.1">${opts(w.pick[1], w.pick[0])}</select></label></div>${trait(w.pick[0])}${trait(w.pick[1])}${nav("wizGo")}`; }
  const preview = E.derive({ kind: "pc", special: w.special, traits: [w.rolled, ...w.pick], tags: w.tags, gear: {}, inv: [], weapons: [], statuses: [], effects: [], level: 1 }, ctx());
  if (w.step === 3) return `${steps}<h3>Tag three skills <span class="tag ${w.tags.length === 3 ? "" : "warn"}">${w.tags.length} OF 3</span></h3><div class="s dim" style="margin-bottom:4px">Tagged skills gain 2 per point you spend on them.</div><div class="archgrid tags">${E.SKILLS.map(([k, n]) => `<button class="arch ${w.tags.includes(k) ? "on" : ""}" data-a="wizTag" data-v="${k}"><span class="bright">${n}</span><span class="s dim">${preview.skills[k]}</span></button>`).join("")}</div>${nav("wizGo")}`;
  const a = S.rules.archetypes[w.arch];
  return `${steps}<h3>${h(w.name.trim() || a.n)} <span class="s dim">${h(a.n)}</span></h3><div class="geartop"><div class="bigdt"><b>${preview.hp}</b><span>HP</span></div><div class="bigdt"><b>${preview.ap}</b><span>AP</span></div><div class="grow s">${E.SPECIAL.map((k, i) => `${k} ${preview.sp[k]}`).join("  ")}<br><span class="dim">Tags: ${h(w.tags.map((k) => SKILL_NAME[k]).join(", "))}</span></div></div><h3>Starting kit</h3><div class="txt">${h(kitText(a))}</div><h3>Traits</h3>${trait(w.rolled)}${trait(w.pick[0])}${trait(w.pick[1])}${nav("wizAdd", "Add to party")}`;
}
function newcBody() {
  return `<div class="txt" style="margin-bottom:6px">This clears everything: the party, rules you changed, item edits, notes, the log and any fight. Then you build new characters. Do you want to save the current campaign first?</div><div class="acts">${primary("newStart", "save", "Save, then start new", "Enter")}${btn("newStart", "", "Start without saving", "", "danger")}${btn("closeModal", "", "Cancel")}</div>`;
}
function helpModal() {
  const g = [["Everywhere", [["Ctrl+Z / Ctrl+Y", "Undo, redo"], ["Ctrl+S", "Save"], ["/", "Search everything"], ["?", "This list"], ["Esc", "Close, or leave a field"], ["Enter", "Confirm"]]],
    ["Out of combat", [["B", "Open encounter setup, then begin"], ["I", "Inventory of the selected character"], ["← →", "Pick a character"]]],
    ["On a turn", [["A", "Attack: your last target, weapon and body part"], ["0-9, Enter", "Type the roll and resolve"], ["W", "Next weapon"], ["T", "Next target"], ["M", "Move"], ["R", "Reload"], ["I", "Use item"], ["N", "End turn"]]],
    ["Mouse on the map", [["Drag", "Move the acting character. Costs AP"], ["Shift+drag", "Reposition anyone for free"], ["Click", "Select. On a turn, clicking an enemy attacks it"], ["Right-click", "Remove cover or a marker"]]]];
  return `<div class="keys">${g.map(([t, rows]) => `<h3>${t}</h3>${rows.map(([k, l]) => `<div>${kbd(k)}${h(l)}</div>`).join("")}`).join("")}</div>`;
}
const SEARCH_LIST = () => [...DATA.weapons.filter((o) => o.tier).map((o) => ["Weapon", o]), ...DATA.ammo.map((o) => ["Ammo", o]), ...DATA.armor.map((o) => ["Armor", o]), ...DATA.items.map((o) => ["Item", o]), ...DATA.materials.map((o) => ["Material", o]), ...DATA.mods.map((o) => ["Mod", o]), ...DATA.enemies.filter((o) => !o.test).map((o) => ["Enemy", o]), ...DATA.levelPerks.map((o) => ["Level perk", o]), ...DATA.skillPerks.map((o) => ["Skill perk", o]), ...DATA.traits.map((o) => ["Trait", o]), ...DATA.statuses.map((o) => ["Status", o])];
const searchHits = (q) => (E.low(q) ? rankByName(SEARCH_LIST(), q, (x) => x[1].n).slice(0, 30) : []);
function searchModal() {
  const m = ui.modal; const hits = searchHits(m.q);
  return `<input id="searchQ" autocomplete="off" style="width:100%" placeholder="Items, enemies, perks, traits, statuses" data-u="modal.q" value="${h(m.q)}" data-enter="searchOpen"><div class="results" style="max-height:60vh">${hits.map(([c, o], i) => `<button class="rowbtn ${i === (m.i || 0) ? "on" : ""}" data-a="searchPick" data-v="${i}"><span class="tag">${c.toUpperCase()}</span><span class="grow">${h(o.n)}</span></button>`).join("") || `<div class="dim" style="padding:4px">${m.q ? "No matches." : "Start typing. Up and down to move, Enter to open."}</div>`}</div>`;
}
function detailModal() {
  const m = ui.modal; const [c, o] = m.hit; const sel = ent(K() && ui.rowSel ? ui.rowSel : ui.sel);
  const acts = [];
  if (sel && sel.inv && ["Weapon", "Ammo", "Armor", "Item", "Material", "Mod"].includes(c)) acts.push(primary("detailAdd", "inv", `Add to ${h(sel.name)}`, "Enter"));
  if (sel && sel.kind === "pc" && ["Level perk", "Skill perk"].includes(c)) acts.push(primary("detailAdd", "perk", `Give to ${h(sel.name)}`, "Enter"));
  if (sel && c === "Status") acts.push(primary("detailAdd", "status", `Give to ${h(sel.name)}`, "Enter"));
  if (c === "Enemy") acts.push(primary("detailAdd", K() ? "enemyNow" : "enemy", K() ? "Add to this fight" : "Add to encounter", "Enter"));
  const lines = Object.entries(o).filter(([k]) => !["n", "ok"].includes(k)).map(([k, v]) => `<div class="s"><span class="dim">${h(k)}:</span> ${h(Array.isArray(v) ? v.filter((x) => x != null && x !== "").map((x) => (typeof x === "number" && k === "hit" ? E.pct(x) : Array.isArray(x) ? x.join(" x ") : x)).join(" | ") : typeof v === "object" ? JSON.stringify(v) : v)}</div>`).join("");
  return `${lines}<div class="acts" style="margin-top:6px">${acts.join("")}${btn("search", m.q || "", "Back to search")}</div>`;
}

// ---------- actions
const splitV = (v) => String(v).split("|");
const ACT = {
  noop() {},
  undo, redo,
  help() { ui.modal = { type: "help" }; render(); },
  search(v) { ui.modal = { type: "search", q: v || "", i: 0 }; ui.focus = "#searchQ"; render(); },
  dev(v) {
    ui.modal = { type: "dev", cat: v, q: "", page: 0, sort: null, dir: 1, cls: "SG", raw: v === "state" ? JSON.stringify(S, null, 1) : "" };
    ui.focus = v === "state" ? "#rawState" : v === "variables" ? null : "#devQ"; render();
  },
  devClass(v) { Object.assign(ui.modal, { cls: v, page: 0, sort: null }); render(); },
  devPage(v) { ui.modal.page = (ui.modal.page || 0) + Number(v); render(); },
  devSort(v) { const m = ui.modal; if (m.sort === v) m.dir = -(m.dir || 1); else { m.sort = v; m.dir = 1; } render(); },
  rawReload() { ui.modal.raw = JSON.stringify(S, null, 1); render(); },
  rawApply() { let p; try { p = normalize(JSON.parse(ui.modal.raw)); } catch (e) { return toast(e.message || "That isn't valid JSON."); } act("Edit raw state", () => { S = p; ui.modal = null; }); toast("Raw state applied"); },
  closeModal() { const hadAtk = ui.atk; ui.modal = null; if (hadAtk && K()) ui.focus = "#roll"; render(); },
  saveNow() {
    let list = slots(); let cur = list.find((x) => x.id === prefs.slot);
    if (!cur) { cur = { id: "s" + Date.now().toString(36), name: `Save ${list.length + 1}` }; prefs.slot = cur.id; savePrefs(); }
    const ok = writeSlot(cur.id, cur.name); save();
    toast(ok && !saveFailed ? `Saved: ${cur.name}` : "Save failed. Browser storage may be full. Save a pack.");
    // a browser on a phone can lose its storage, so offer a real file too
    if (matchMedia("(pointer: coarse)").matches && confirm(`Saved in this browser as ${cur.name}.\n\nAlso save a copy to your device (Files on iPhone or iPad, Downloads on Android)?`)) ACT.exportSave();
    if (ui.modal && ui.modal.type === "loadWin") render();
  },
  autoToggle(v) { prefs.autosave = !!v; savePrefs(); if (prefs.autosave && dirty && !prefs.interval) save(); render(); },
  wiki() {
    const b = document.getElementById("wiki").textContent.trim();
    if (!b || b.startsWith("/*")) return void window.open("Fallout TTRPG Game Bible.pdf", "_blank");
    const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
    window.open(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), "_blank");
  },
  exportSave() {
    // A pack: a normal .zip you can open, edit and pass around. Campaign and rules as JSON, every table as a spreadsheet.
    const blob = new Blob([makeZip(packFiles())], { type: "application/zip" });
    const name = `fallout-pack-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.zip`;
    const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); toast("Pack saved"); };
    // the share sheet is how iOS and Android offer "Save to Files"; desktops just download
    const file = typeof File === "function" ? new File([blob], name, { type: "application/zip" }) : null;
    if (file && matchMedia("(pointer: coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).then(() => toast("Pack saved"), (err) => { if (err && err.name !== "AbortError") download(); });
      return;
    }
    download();
  },
  importSave() { document.getElementById("importFile").click(); },
  pick(v) {
    const e = ent(v); if (!e) return;
    const cb = cbOf(v);
    if (ui.atk) { if (v !== ui.atk.att && (!cb || alive(cb))) { ui.atk.tgt = v; ui.atk.err = ""; ui.atk.res = null; ui.focus = "#roll"; return render(); } }
    else if (fightPhase() && actorId() && actorId() !== v && sideOf(v) !== sideOf(actorId()) && cb && alive(cb)) return openAttack(actorId(), v);
    ACT.select(v);
  },
  select(v) { const e = ent(v); if (!e) return; ui.rowSel = v; if (e.kind === "pc") ui.sel = v; ui.mapSel = null; render(); },
  setupOpen(v) { ui.setup = !!v; if (v) ensureMap(); render(); },
  setMapId(val) { act("Change location", () => applyMap(val)); },
  setMapSize(val, el) { const t = num(val); if (t == null || t <= 0) return render(); const M = mapOf(); act("Map size", () => { applyMap("custom", el.dataset.k === "w" ? t : M.w, el.dataset.k === "h" ? t : M.h); }); },
  noteNew() { ui.noteId = null; ui.focus = ui.modal ? "#noteText" : "#qnText"; render(); },
  refresh() { applyData(); render(); toast("Lists refreshed"); },
  devToggle() { ui.devOpen = !ui.devOpen; render(); },
  fold(v) { prefs.fold = { ...(prefs.fold || {}), [v]: !(prefs.fold || {})[v] }; savePrefs(); render(); },
  setNamePool(v, el) { const k = el.dataset.k, next = v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).join(","); if (next === S.rules.namePools[k]) return; act(`Edit ${k} names`, () => { S.rules.namePools[k] = next; }); },
  tableExport(v) {
    const [id, kind] = splitV(v); const rows = tableRows(id);
    // the enemies JSON carries the name lists too, so one file holds everything about enemies
    const json = id === "enemies" ? { enemies: rows, namePools: S.rules.namePools, nameStyles: S.rules.nameStyles } : rows;
    const blob = new Blob([kind === "csv" ? toCsv(rows) : JSON.stringify(json, null, 1)], { type: kind === "csv" ? "text/csv" : "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `fallout-${id}.${kind}`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    toast(`Exported ${rows.length} rows`);
  },
  tableReset(v) { act(`Reset ${v}`, () => { if (v === "perks") { delete S.tables.levelPerks; delete S.tables.skillPerks; } else delete S.tables[TABLE_IO[v]]; S.tableRev = (S.tableRev || 0) + 1; }); toast("Back to the workbook's table"); },
  sheetTab(v) { ui.modal.tab = v; render(); },
  guideGo(v) { ui.guide = Number(v); render(); },
  newStart(v) {
    if (v) ACT.saveNow();
    act("New campaign", () => { S = fresh(); S.chars = []; ui.sel = null; ui.rowSel = null; ui.atk = null; ui.end = null; ui.def = null; ui.setup = null; ui.noteId = null; ui.wiz = newWiz(); ui.modal = { type: "wizard" }; ui.focus = "#wizName"; });
    prefs.slot = null; savePrefs();
    toast("New campaign started. Undo goes back.");
  },
  wizGo(v) {
    const w = ui.wiz; const to = Number(v);
    if (to > w.step) {
      if (w.step === 0 && w.arch == null) return toast("Pick an archetype.");
      if (w.step === 1 && w.special.reduce((t, x) => t + x, 0) > S.rules.startPool) return toast(`SPECIAL can't total more than ${S.rules.startPool}.`);
      if (w.step === 2 && (!w.pick[0] || !w.pick[1])) return toast("Pick two traits.");
      if (w.step === 3 && w.tags.length !== 3) return toast("Tag exactly three skills.");
    }
    w.step = to; ui.focus = to === 0 ? "#wizName" : null; render();
  },
  wizArch(v) { ui.wiz.arch = Number(v); render(); },
  wizStat(v) {
    const [i, d] = splitV(v); const w = ui.wiz; const next = w.special[i] + Number(d);
    if (next < 1 || next > 10) return;
    if (Number(d) > 0 && w.special.reduce((t, x) => t + x, 0) >= S.rules.startPool) return toast(`All ${S.rules.startPool} points are spent. Lower another stat first.`);
    w.special[i] = next; render();
  },
  wizReroll() { const w = ui.wiz; if (w.rerolled) return; w.rolled = rollTrait([w.rolled, ...w.pick]); w.rerolled = true; log("status", `Trait reroll: ${db.traitByCode.get(w.rolled).n}.`); render(); },
  wizTag(v) { const w = ui.wiz; if (w.tags.includes(v)) w.tags = w.tags.filter((x) => x !== v); else if (w.tags.length < 3) w.tags.push(v); else return toast("Three tags. Untag one first."); render(); },
  wizAdd() { const w = ui.wiz; act(`Create ${w.name || "character"}`, () => { const c = buildChar(w); S.chars.push(c); ui.sel = c.id; log("status", `${c.name} joins the party: ${c.background}. Traits ${c.traits.map((x) => db.traitByCode.get(x).n).join(", ")}.`); w.step = 5; }); },
  wizAnother() { ui.wiz = newWiz(); ui.focus = "#wizName"; render(); },
  wizSample() { act("Sample party", () => { S.chars = fresh().chars; ui.sel = (S.chars[0] || {}).id; ui.wiz = null; ui.modal = null; }); },
  toggleAlly(v) { const e = ent(v); act(`Ally: ${e.name}`, () => { e.ally = !e.ally; log("status", `${e.name} is now ${e.ally ? "an ally" : "an enemy"}.`); if (ui.atk && ui.atk.tgt === v) ui.atk.tgt = targetsFor(ui.atk.att)[0] || null; }); },
  gearSlot(v) { const m = ui.modal; m.pick = m.pick === v ? null : v; m.pq = ""; if (m.pick) ui.focus = "#gearQ"; render(); },
  gearEquip(name) {
    const m = ui.modal; const e = ent(m.id); const s = m.pick; if (!e || !s) return;
    act(name ? `Equip ${name}` : "Unequip", () => {
      keepFull(e, () => {
        const take = () => { const l = (e.inv || []).find((x) => E.low(x.n) === E.low(name)); if (l) { l.q--; if (l.q <= 0) e.inv = e.inv.filter((x) => x !== l); } };
        if (s[0] === "w") {
          const i = Number(s[1]); const old = e.weapons[i];
          if (old) { const w = E.get(ctx(), old.n); const res = old.ammo || (w && w.o.ammo); if (old.mag && res && res !== "N/A") addInv(e, res, old.mag, true); if (old.n !== "Basic Fighting") addInv(e, old.n, 1); }
          if (name) { take(); const w = E.get(ctx(), name); const next = { n: w.o.n, mag: 0 }; if (old) e.weapons[i] = next; else e.weapons.push(next); } else if (old) e.weapons.splice(i, 1);
          if ((e.activeW || 0) >= e.weapons.length) e.activeW = 0;
        } else {
          if (name && s.startsWith("acc") && der(e).m.noAccessories) { log("status", `${e.name}'s armor can't take accessories.`); return; }
          const cur = slotName(e, s); if (cur) addInv(e, cur, 1);
          if (name) take();
          setSlot(e, s, name);
        }
      });
      log("status", name ? `${e.name} equips ${name}.` : `${e.name} takes off a piece of gear.`);
      m.pick = null;
    });
  },
  venTier(v) { act("Vendor tier", () => { S.vendor.tier = Number(v); S.vendor.stock = E.vendorStock(ctx(), S.vendor.tier); }); },
  venBarter(v) { act("Vendor barter", () => { S.vendor.barter = Number(v); }); },
  venRoll() { act("Restock vendor", () => { S.vendor.stock = E.vendorStock(ctx(), S.vendor.tier); }); },
  venTab(v) { ui.venTab = v; render(); },
  venBuy(v) {
    const e = ent(ui.sel); const l = S.vendor.stock[Number(v)]; if (!e || !l) return;
    const f = priceFactors(e, S.vendor.barter); const price = Math.max(1, Math.ceil(E.valueOf(ctx(), l.n).val * f.buy));
    if ((e.caps || 0) < price) return toast(`${e.name} needs ${price} caps, has ${fmt(e.caps)}.`);
    act(`Buy ${l.n}`, () => { e.caps = E.fix(e.caps - price); keepFull(e, () => addInv(e, l.n, 1)); l.q--; if (l.q <= 0) S.vendor.stock.splice(Number(v), 1); log("status", `${e.name} buys ${l.n} for ${price} caps.`); });
  },
  venSell(v) {
    const e = ent(ui.sel); const l = e && (e.inv || [])[Number(v)]; if (!l) return;
    const f = priceFactors(e, S.vendor.barter); const price = Math.floor(E.valueOf(ctx(), l.n).val * f.sell);
    act(`Sell ${l.n}`, () => { const name = l.n; keepFull(e, () => { l.q--; if (l.q <= 0) e.inv.splice(Number(v), 1); }); e.caps = E.fix((e.caps || 0) + price); const st = S.vendor.stock.find((x) => x.n === name); if (st) st.q++; else S.vendor.stock.push({ n: name, q: 1 }); log("status", `${e.name} sells ${name} for ${price} caps.`); });
  },
  noteOpen(v) { ui.noteId = v; ui.focus = "#noteText"; render(); },
  noteDel(v) { act("Delete note", () => { S.notesList = S.notesList.filter((n) => n.id !== v); ui.noteId = null; }); },
  railGo(v) {
    if (v === "wiki") return ACT.wiki();
    if (v === "saveNow") return ACT.saveNow();
    if (v === "log") return ACT.toggleLog();
    if (ui.modal && ui.modal.type === v) return ACT.closeModal();
    ui.modal = { type: v };
    ui.focus = v === "items" ? "#brQ" : v === "notes" ? "#noteText" : null;
    render();
  },
  toggleLog() { ui.logOpen = !ui.logOpen; render(); },
  openChar(v) {
    const [id, s] = splitV(v); ui.sel = id; ui.rowSel = id;
    ui.modal = s === "inv" ? { type: "char", id, sect: s, q: "", pick: null } : s === "sheet" ? { type: "sheet", id, tab: "stats" } : { type: "health", id };
    render();
  },
  pwOpen(v) { ui.pw.side = v || "party"; ui.pw.who = {}; ui.modal = { type: "pwide", side: ui.pw.side }; ui.focus = "#pwAct"; render(); },
  pwWho(v) { for (const e of ui.pw.side === "enemies" ? foes() : S.chars) ui.pw.who[e.id] = !!v; render(); },
  pwApply() {
    const m = ui.pw; const list = (m.side === "enemies" ? foes() : S.chars).filter((e) => m.who[e.id] !== false);
    const needsName = ["addItem", "removeItem", "addStatus", "removeStatus"].includes(m.act); const n = String(m.name).trim();
    if (needsName && !n) return toast("Name it first.");
    if (!list.length) return toast("Nobody is ticked.");
    const val = num(m.val, 0);
    if (m.act === "addStatus" && !db.status.has(E.low(n))) return toast("No status by that name.");
    act("Party-wide change", () => {
      for (const e of list) keepFull(e, () => {
        if (m.act === "addItem") { const it = E.get(ctx(), n); addInv(e, it ? it.o.n : n, val || 1, true); }
        if (m.act === "removeItem") { const l = (e.inv || []).find((x) => E.low(x.n) === E.low(n)); if (l) { l.q -= val || 1; if (l.q <= 0) e.inv = e.inv.filter((x) => x !== l); } }
        if (m.act === "addStatus") addStatus(e, n, num(m.tier, 1));
        if (m.act === "removeStatus") e.statuses = (e.statuses || []).filter((s) => E.low(s.n) !== E.low(n));
        if (m.act === "caps") e.caps = Math.max(0, (e.caps || 0) + val);
        if (m.act === "xp") e.xp = Math.max(0, E.fix((e.xp || 0) + val));
        if (m.act === "clear") { e.statuses = []; e.effects = []; }
      });
      for (const e of list) {
        if (m.act === "hp") { e.hp = clamp(e.hp + val, 0, der(e).hp); syncDown(e); }
        if (m.act === "ap") e.ap = Math.max(0, (e.ap || 0) + val);
        if (m.act === "heal") { e.hp = der(e).hp; syncDown(e); }
      }
      log("status", `All (${list.map((e) => e.name).join(", ")}): ${m.act}${n ? " " + n : ""}${val && m.act !== "addStatus" && m.act !== "removeStatus" ? " " + val : ""}.`);
      ui.modal = null;
    });
  },
  mapPlace(v) { ui.place = ui.place === v ? null : v; ui.mapSel = null; render(); },
  moveConfirm() {
    const m = ui.pendingMove; const k = K(); if (!m || !k) return; const c = cbOf(m.id), e = ent(m.id);
    ui.pendingMove = null;
    if (!canPay(e, m.cost, "move there")) return render();
    act("Move token", () => {
      c.x = m.x; c.y = m.y;
      for (const key of Object.keys(k.ranges)) if (key.split("|").includes(m.id)) delete k.ranges[key];
      e.ap = Math.max(0, (e.ap || 0) - m.cost); c.moved = true; if (k.phase === "stealth") k.stealthDue = e.id;
      log("status", `${e.name} moves ${fmt(m.cost)} AP. ${e.ap} left.`);
      ui.focus = "#roll";
    });
  },
  inspire() { const id = actorId(); const e = ent(id); if (!e || !canPay(e, 2, "inspire")) return; act("Inspire", () => { e.ap -= 2; for (const c of S.chars) { c.effects = c.effects || []; c.effects.push({ label: "Inspired", mods: { acc: 0.1 }, turns: 1, text: "+10 to hit" }); } log("status", `${e.name} inspires the party: +10 to hit next turn.`); }); },
  moveCancel() { ui.pendingMove = null; ui.focus = "#roll"; render(); },
  mapZoom(v) { const f = Number(v); if (!f) ui.zoom = null; else setZoom((ui.zoom ? ui.zoom.k : 1) * f); render(); },
  setTheme(val) { act("Room setting", () => { S.scene.theme = val; }); },
  randomRoom() {
    act("Randomize room", () => {
      const party = S.chars.map((c) => posOf(c.id)); const foesAt = foes().map((e) => posOf(e.id));
      S.scene.objects = E.generateRoom(mapOf(), S.scene.theme, S.rules, Math.random, [...party, ...foesAt], () => "o" + S.seq++);
      log("status", `Room: ${mapOf().n}, ${S.rules.roomThemes[S.scene.theme].n}, ${S.scene.objects.length} objects.`);
    });
  },
  clearRoom() { act("Clear room", () => { S.scene.objects = []; ui.mapSel = null; }); },
  objRotate(v) { const o = S.scene.objects.find((x) => x.id === ui.mapSel); if (o) act("Rotate", () => { o.angle = (((o.angle || 0) + Number(v)) % 360 + 360) % 360; }); },
  setObjAngle(val) { const t = num(val); const o = S.scene.objects.find((x) => x.id === ui.mapSel); if (o && t != null) act("Rotate", () => { o.angle = ((t % 360) + 360) % 360; }); else render(); },
  setObjCover(val) { const o = S.scene.objects.find((x) => x.id === ui.mapSel); if (o) act("Cover tier", () => { o.cover = val; }); },
  objBlock(v, el) { const o = S.scene.objects.find((x) => x.id === v); const on = el.checked; if (o) act("Blocks walking", () => { o.block = on; }); },
  setObjLabel(val) { const o = S.scene.objects.find((x) => x.id === ui.mapSel); if (o) act("Label", () => { o.label = val; }); },
  objDel(v) { act("Remove from map", () => { S.scene.objects = S.scene.objects.filter((o) => o.id !== v); ui.mapSel = null; }); },
  scatter() { act("Scatter enemies", () => { for (const e of S.scene.npcs) delete S.scene.pos[e.id]; for (const e of S.scene.npcs) S.scene.pos[e.id] = freeSpot(); }); },
  surround() {
    act("Surround", () => {
      const M = mapOf(); const ps = S.chars.map((c) => posOf(c.id)); const cx = ps.reduce((t, p) => t + p.x, 0) / (ps.length || 1), cy = ps.reduce((t, p) => t + p.y, 0) / (ps.length || 1);
      const r = Math.min(M.w, M.h) * 0.35; const n = S.scene.npcs.length;
      S.scene.npcs.forEach((e, i) => { const t = (i / Math.max(n, 1)) * Math.PI * 2; const p = inMap({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }); S.scene.pos[e.id] = { x: E.fix(p.x), y: E.fix(p.y) }; });
    });
  },
  setBand(val, el) {
    const t = num(val); if (t == null) return render();
    act("Move enemy", () => { const c = posOf(ui.sel), p = posOf(el.dataset.id); const d = dist(c, p) || 1; const m = S.rules.bandMeters[clamp(t, 1, 10) - 1]; const q = inMap({ x: c.x + ((p.x - c.x) / d) * m, y: c.y + ((p.y - c.y) / d) * m }); S.scene.pos[el.dataset.id] = { x: E.fix(q.x), y: E.fix(q.y) }; });
  },
  slotNew() { const id = "s" + Date.now().toString(36); const name = `Save ${slots().length + 1}`; if (!writeSlot(id, name)) return toast("Browser storage is full. Save a pack."); prefs.slot = id; savePrefs(); save(); render(); toast(`${name} saved`); },
  slotRename(val, el) { const list = slots(); const x = list.find((y) => y.id === el.dataset.v); if (x) { x.name = val; try { localStorage.setItem(SLOTS_KEY, JSON.stringify(list)); } catch (e) { /* the name just won't stick */ } } },
  slotLoad(v) {
    let p; try { p = normalize(readJson(v === "auto" ? SAVE_KEY : "fallout-dm-slot-" + v)); } catch (e) { return toast("That save can't be read."); }
    act("Load save", () => { S = p; ui.sel = (S.chars[0] || {}).id; ui.rowSel = null; ui.atk = null; ui.modal = null; ui.end = null; ui.def = null; });
    if (v !== "auto") { prefs.slot = v; savePrefs(); }
    toast("Save loaded. Undo goes back.");
  },
  slotDel(v) { if (!confirm("Delete this save? This can't be undone.")) return; try { localStorage.removeItem("fallout-dm-slot-" + v); localStorage.setItem(SLOTS_KEY, JSON.stringify(slots().filter((x) => x.id !== v))); } catch (e) { /* nothing to clean up */ } if (prefs.slot === v) { prefs.slot = null; savePrefs(); } render(); },
  newChar() { ui.wiz = ui.wiz && ui.wiz.step < 5 ? ui.wiz : newWiz(); ui.modal = { type: "wizard" }; ui.focus = "#wizName"; render(); },
  edit(v) { const id = v || (K() ? ui.rowSel || actorId() : ui.rowSel && ent(ui.rowSel) ? ui.rowSel : ui.sel); if (!ent(id)) return; ui.modal = { type: "edit", id }; render(); },
  delChar(v) { const e = ent(v); if (!confirm(`Delete ${e.name}?`)) return; act(`Delete ${e.name}`, () => { S.chars = S.chars.filter((c) => c.id !== v); if (S.combat) S.combat.cbs = S.combat.cbs.filter((c) => c.id !== v); ui.modal = null; ui.sel = (S.chars[0] || {}).id; }); },
  toggleTag(v) { const [id, k] = splitV(v); const e = ent(id); act("Change tags", () => { keepFull(e, () => { e.tags = e.tags.includes(k) ? e.tags.filter((x) => x !== k) : [...e.tags, k]; }); }); },
  setOv(val, el) { const e = ent(el.dataset.id); const k = el.dataset.k; act(`Override ${k}: ${e.name}`, () => { keepFull(e, () => { e.ov = e.ov || {}; e.ov[k] = num(val); }); }); },
  setSpecial(val, el) { const e = ent(el.dataset.id); const i = Number(el.dataset.i); const k = E.SPECIAL[i]; const t = num(val); if (t == null) return render(); act(`${SP_LABEL[k]}: ${e.name}`, () => { keepFull(e, () => { e.special[i] = t - (der(e).m[k] || 0); }); }); },
  setSkill(val, el) {
    const e = ent(el.dataset.id); const k = el.dataset.k; const t = num(val);
    act(`${k}: ${e.name}`, () => { keepFull(e, () => { e.skills = e.skills || {}; if (t == null) delete e.skills[k]; else e.skills[k] = t - (der(e).m[k] || 0) - ((e.spent || {})[k] || 0) * ((e.tags || []).includes(k) ? 2 : 1); }); });
  },
  setSuper(val, el) { const e = ent(el.dataset.id); const t = num(val); act(`Super crit: ${e.name}`, () => { e.superCrit = t == null ? null : t / 100; }); },
  setQty(val, el) { const e = ent(el.dataset.id); const i = Number(el.dataset.i); const t = num(val, 0); act("Inventory", () => { keepFull(e, () => { e.inv[i].q = Math.max(0, t); if (!e.inv[i].q) e.inv.splice(i, 1); }); }); },
  setInit(val, el) { const c = cbOf(el.dataset.id); const t = num(val); if (t == null) return render(); act("Change initiative", () => { c.init = t; log("turn", `${ent(c.id).name}'s initiative set to ${t}.`); }); },
  setRange(val, el) { const a = actorId(); const t = num(val); if (!a || t == null) return render(); act("Change range", () => { K().ranges[pairKey(a, el.dataset.id)] = clamp(t, 1, 10); }); },
  toggleVariant(v, el) { const [id, n] = splitV(v); const e = ent(id); const on = el.checked; act(`${e.name}: ${n}`, () => { keepFull(e, () => { e.variants = (e.variants || []).filter((x) => x !== n); if (on) e.variants.push(n); }); }); },
  delPerk(v) { const [id, p] = splitV(v); const e = ent(id); act(`Remove perk: ${p}`, () => { keepFull(e, () => { e.perks = e.perks.filter((x) => x !== p); }); }); },
  addPerk(v, el) { const n = el.value.trim(); if (!n) return; const e = ent(el.dataset.id); const i = perkInfo(n); if (!i) return toast("No perk by that name."); ui.focus = `#${el.id}`; act(`Perk: ${n}`, () => { keepFull(e, () => { e.perks = [...(e.perks || []), i.n]; }); if (el.id === "lvlPerkAny" && e.perkDue) e.perkDue--; log("status", `${e.name} takes the perk ${i.n}.`); }); },
  addItem(v, el) { const n = el.value.trim(); if (!n) return; const e = ent(el.dataset.id); ui.focus = `#${el.id}`; act(`Add item: ${n}`, () => { const it = E.get(ctx(), n); keepFull(e, () => addInv(e, it ? it.o.n : n, 1, true)); }); },
  invActive(v, el) { const [id, i] = splitV(v); const e = ent(id); const on = el.checked; act("Inventory", () => { keepFull(e, () => { e.inv[i].active = on; }); }); },
  invDel(v) { const [id, i] = splitV(v); const e = ent(id); act("Inventory", () => { keepFull(e, () => { e.inv.splice(i, 1); }); }); },
  useItemFrom(v) { const [id, i] = splitV(v); ui.modal = { type: "item", who: id, tgt: id, sel: Number(i) }; render(); },
  setWeapon(val, el) { const e = ent(el.dataset.id); const i = Number(el.dataset.i); const n = String(val).trim(); if (!n) return; act(`Weapon: ${n}`, () => { keepFull(e, () => { const w = E.get(ctx(), n); e.weapons[i] = { n: w ? w.o.n : n, mag: w ? w.o.mag || 0 : 0 }; }); }); },
  setLoad(val, el) { const e = ent(el.dataset.id); const i = Number(el.dataset.i); act("Change ammo", () => { const s = e.weapons[i]; if (s.mag && s.ammo) addInv(e, s.ammo, s.mag, true); s.ammo = val; s.mag = 0; log("status", `${e.name} unloads ${s.n} and picks ${val || "no ammo"}. Reload to fill it.`); }); },
  addWeapon(v, el) { const n = el.value.trim(); if (!n) return; const e = ent(el.dataset.id); const w = E.get(ctx(), n); if (!w || w.cat !== "weapon") return toast("No weapon by that name."); act(`Add weapon: ${n}`, () => { keepFull(e, () => { e.weapons.push({ n: w.o.n, mag: w.o.mag || 0 }); }); }); },
  delWeapon(v) { const [id, i] = splitV(v); const e = ent(id); act("Remove weapon", () => { keepFull(e, () => { e.weapons.splice(i, 1); e.activeW = 0; }); }); },
  reloadSlot(v) { const [id, i] = splitV(v); reloadWeapon(id, Number(i)); },
  clearSlot(v) { const [id, i] = splitV(v); clearJam(id, Number(i)); },
  setTrait(val, el) { const e = ent(el.dataset.id); const i = Number(el.dataset.i); const code = String(val).trim().slice(0, 3); if (val && !db.traitByCode.has(code)) return toast("Trait not found. Use its three-digit code or pick from the list."); act("Change trait", () => { keepFull(e, () => { e.traits = e.traits || ["", "", ""]; e.traits[i] = val ? code : ""; }); }); },
  addStatusFromInput(v, el) { const n = el.value.trim(); if (!n) return; const e = ent(el.dataset.id); ui.focus = `#${el.id}`; act(`Status: ${n}`, () => { keepFull(e, () => addStatus(e, n, 1)); log("status", `${e.name} gains ${n}.`); }); },
  delStatus(v) { const [id, i] = splitV(v); const e = ent(id); act("Remove status", () => { keepFull(e, () => { const st = e.statuses.splice(i, 1)[0]; log("status", `${st.n} removed from ${e.name}.`); }); }); },
  delEffect(v) { const [id, i] = splitV(v); const e = ent(id); act("Remove effect", () => { keepFull(e, () => { e.effects.splice(i, 1); }); }); },
  rest() { act("Rest", () => { for (const c of S.chars) { const d = der(c); if (!c.dbno) c.hp = Math.min(d.hp, c.hp + Math.round(d.hp * S.rules.passiveHealPct)); c.statuses = (c.statuses || []).filter((s) => s.n !== "Shock"); keepFull(c, () => { c.effects = (c.effects || []).filter((f) => /^Addicted/.test(f.label)); const ended = (c.statuses || []).filter((q) => q.from); c.statuses = (c.statuses || []).filter((q) => !q.from && !q.aftermath); for (const q of ended) endSubstance(c, q); }); c.ap = der(c).ap; } log("status", `The party rests: +${E.pct(S.rules.passiveHealPct)}% HP, Shock and item effects cleared.`); }); },
  levelUp(v) { const e = ent(v); act(`${e.name} levels up`, () => { keepFull(e, () => { e.level++; }); const gain = der(e).pts; e.ptsBank = (e.ptsBank || 0) + gain; const perk = S.rules.perkEvery > 0 && e.level % S.rules.perkEvery === 0; if (perk) e.perkDue = (e.perkDue || 0) + 1; log("status", `${e.name} reaches level ${e.level}: ${gain} skill points${perk ? " and a level perk" : ""}.`); ui.modal = { type: "level", id: e.id }; }); },
  spendPts(v) { ui.modal = { type: "level", id: v }; render(); },
  spend(v) { const [id, k, d] = splitV(v); const e = ent(id); const delta = Number(d) > 0 ? Math.min(Number(d), e.ptsBank || 0) : Number(d); if (Number(d) > 0 && !delta) return toast("No points left."); if (delta < 0 && !(e.spent || {})[k]) return; act("Spend point", () => { keepFull(e, () => { e.spent = e.spent || {}; e.spent[k] = (e.spent[k] || 0) + delta; e.ptsBank -= delta; }); }); },
  levelPerk(v) { const [id, n, kind] = splitV(v); const e = ent(id); act(`Perk: ${n}`, () => { keepFull(e, () => { e.perks = [...(e.perks || []), n]; }); if (kind === "level" && e.perkDue) e.perkDue--; log("status", `${e.name} takes the perk ${n}.`); }); },
  check() {
    const k = K(); const id = k && k.turnId ? k.turnId : ui.sel;
    if (k) ui.modal = { type: "check" };
    ui.focus = `#chk-${id}`; render();
    if (!document.activeElement || document.activeElement.id !== `chk-${id}`) { const el = document.getElementById("chkTarget"); if (el) el.focus(); }
  },
  chkPreset(v) { Object.assign(ui.chk, { target: Number(v), res: {} }); render(); },
  chkClear() { Object.assign(ui.chk, { res: {}, xp: "", revive: null }); render(); },
  chkGen() {
    const pick = (l) => l[Math.floor(Math.random() * l.length)];
    Object.assign(ui.chk, { use: pick(E.SKILLS)[0], target: pick(Object.values(S.rules.difficulty)), res: {}, xp: "", revive: null });
    log("check", `Generated check: ${SKILL_NAME[ui.chk.use]} vs ${ui.chk.target}.`);
    render();
  },
  chkRoll(val, el) {
    const m = ui.chk; const id = el.dataset.id; const r = num(val);
    if (r == null || r < 1 || r > 20) return toast("Type the d20 roll, 1 to 20.");
    const e = ent(id);
    if (m.revive && S.combat && K().turnId === e.id && !canPay(e, S.rules.reviveAP, "revive")) return;
    const { v, label } = checkValue(e, m.use); const need = E.checkNeeded(v, num(m.target, 0), S.rules); const res = E.checkResult(r, need);
    const next = S.chars.find((c) => c.id !== id && !m.res[c.id]);
    ui.focus = next ? `#chk-${next.id}` : null;
    act(`Check: ${e.name}`, () => {
      log("check", `${e.name}: ${label} vs ${m.target} needs ${need}+, rolled ${r}${res.why ? ` (${res.why})` : ""}: ${res.pass ? "SUCCESS" : "FAILURE"}.`);
      m.res[id] = { ...res, roll: r };
      if (!S.combat && e.kind === "pc") S.scene.checks[e.id] = (S.scene.checks[e.id] || 0) + 1;
      if (m.revive) {
        if (S.combat && K().turnId === e.id) e.ap = Math.max(0, (e.ap || 0) - S.rules.reviveAP);
        if (res.pass) revive(ent(m.revive), `${e.name}'s Medicine`);
        m.revive = null;
      }
    });
  },
  chkXp() {
    const m = ui.chk; const x = num(m.xp); if (x == null) return;
    const list = Object.entries(m.res).filter(([, r]) => r.pass).map(([id]) => ent(id)).filter((e) => e && e.kind === "pc");
    if (!list.length) return toast("Nobody passed.");
    act("Check XP", () => { for (const e of list) { const g = E.xpGain(x, der(e).sp.I, S.rules); e.xp = E.fix((e.xp || 0) + g); log("check", `${e.name} gains ${g} XP for the check (${x} with INT bonus).`); } m.xp = ""; });
  },
  reviveChk(v) {
    const down = S.chars.filter((c) => c.dbno);
    if (v && ent(v)) {
      const medic = K() && K().turnId && sideOf(K().turnId) === "pc" ? K().turnId : (S.chars.find((c) => !c.dbno && c.id !== v) || ent(v)).id;
      Object.assign(ui.chk, { use: "MED", target: S.rules.difficulty.Average, res: {}, revive: v });
      if (K()) ui.modal = { type: "check" };
      ui.focus = `#chk-${medic}`; return render();
    }
    if (!down.length) return toast("Nobody is down.");
    ACT.reviveChk(ui.rowSel && ent(ui.rowSel) && ent(ui.rowSel).dbno ? ui.rowSel : down[0].id);
  },
  // encounter
  addPick(v) { ui.enemyQ = ""; if (!K()) ui.setup = true; act(`Add ${v}`, () => { addEnemy(v); }); },
  addFirstEnemy() { const t = rankByName(allTemplates(), ui.enemyQ).find((x) => !ui.enemyTier || String(x.tier) === String(ui.enemyTier)); if (t) { ui.focus = "#enemyQ"; ACT.addPick(t.n); } },
  pickQty(v) {
    const [t, d] = splitV(v);
    act("Enemy count", () => {
      if (Number(d) > 0) { addEnemy(t); return; }
      const same = S.scene.npcs.filter((n) => n.tmpl === t); const last = same[same.length - 1];
      S.scene.npcs = S.scene.npcs.filter((n) => n !== last); delete S.scene.pos[last.id]; renumber(S.scene.npcs, t);
    });
  },
  beginC(v) { if (!setupOpen()) return ACT.setupOpen("1"); beginCombat(!!v); },
  fxDark() { act("Effect: Darkness", () => { S.scene.effects.push({ label: "Darkness", who: "enemies", hit: -0.1 }); log("check", "Carries into combat: Darkness, enemies -10% to hit."); }); },
  addFx() { if (!ui.fxLabel.trim()) { ui.focus = "#fxLabel"; render(); return toast("Name the effect first."); } act("Add effect", () => { S.scene.effects.push({ label: ui.fxLabel.trim(), who: ui.fxWho, hit: num(ui.fxHit, 0) / 100 }); log("check", `Carries into combat: ${ui.fxLabel.trim()}.`); ui.fxLabel = ""; ui.fxHit = ""; }); },
  delEffectScene(v) { act("Remove effect", () => { S.scene.effects.splice(Number(v), 1); }); },
  // fight
  attack() { if (!K() || !["turns", "stealth"].includes(K().phase)) return; if (ui.atk) { ui.focus = "#roll"; return render(); } openAttack(); },
  closeAtk() { ui.atk = null; render(); },
  fire,
  atkW(v) { ui.atk.w = Number(v); ui.atk.mode = "pr"; ui.atk.err = ""; ui.focus = "#roll"; render(); },
  atkPart(v) { setPart(ui.atk, v); ui.focus = "#roll"; render(); },
  atkOvToggle() { ui.atkOv = !ui.atkOv; render(); },
  atkMode(v) { ui.atk.mode = v; ui.focus = "#roll"; render(); },
  atkRange(v) { const a = ui.atk; if (!a.tgt) return; ui.focus = "#roll"; act("Change range", () => { K().ranges[pairKey(a.att, a.tgt)] = clamp(rangeOf(a.att, a.tgt) + Number(v), 1, 10); }); },
  atkAs(val) { const last = K().last[val] || {}; const A = ent(val); ui.atk = { ...ui.atk, att: val, w: A.activeW || 0, mode: last.mode || "pr", tgt: targetsFor(val)[0], res: null, err: "" }; ui.focus = "#roll"; render(); },
  applyHitStatus(v) { const r = ui.atk && ui.atk.res; if (!r) return; ui.modal = { type: "status", id: r.tgt, name: v, tier: 1, turns: "" }; ui.focus = "#stTier"; render(); },
  next() { if (!K() || K().phase !== "turns") return; nextTurn(); },
  reload() { const id = actorId(); if (id) reloadWeapon(id, ui.atk ? ui.atk.w : null); },
  swap() {
    const id = actorId(); const e = ent(id); if (!e || !(e.weapons || []).length) return;
    if (e.weapons.length < 2) return toast(`${e.name} only has one weapon.`);
    const nextW = E.get(ctx(), (e.weapons[((e.activeW || 0) + 1) % e.weapons.length] || {}).n); const tmv = turnMods(e);
    const swapCost = tmv.swapFree || (tmv.swapFreeMelee && nextW && nextW.o.tab === "MW") || (tmv.swapFreePistol && nextW && /pistol|revolver/i.test(nextW.o.type || "")) ? 0 : S.rules.swapAP;
    if (!canPay(e, swapCost, "swap")) return;
    act(`Swap: ${e.name}`, () => { e.activeW = ((e.activeW || 0) + 1) % e.weapons.length; e.ap = Math.max(0, (e.ap || 0) - swapCost); log("status", `${e.name} swaps to ${e.weapons[e.activeW].n}, ${swapCost} AP. ${e.ap} left.`); if (ui.atk) ui.atk.w = e.activeW; });
  },
  clearJamBtn() { const id = actorId(); if (id) clearJam(id); },
  moveModal() { const id = actorId(); if (!id) return; const a = ui.atk; const ts = targetsFor(id); const tgt = (a && a.tgt) || (K().last[id] || {}).tgt || ts[0]; if (!tgt) return toast("Nobody to move relative to."); ui.modal = { type: "move", att: id, tgt: ts.includes(tgt) ? tgt : ts[0] }; render(); },
  moveTo(v) {
    const m = ui.modal; const r = Number(v); const cur = rangeOf(m.att, m.tgt); const A = ent(m.att); const to = moveSpot(m.att, m.tgt, r);
    if (r !== cur && bandFor(dist(to, posOf(m.tgt))) !== r) return toast(`R${r} doesn't fit this location.`);
    const cost = r === cur ? 0 : moveCost(posOf(m.att), to, A);
    if (cost === Infinity) return toast(`${A.name} can't walk: a shattered leg.`);
    if (!canPay(A, cost, "move there")) return;
    if (E.pathBlocked(posOf(m.att), to, S.scene.objects)) return toast("Something solid is in the way. Drag around it on the map.");
    act(`Move: ${A.name}`, () => {
      const a = cbOf(m.att); a.x = E.fix(to.x); a.y = E.fix(to.y); a.moved = true;
      for (const k of Object.keys(K().ranges)) if (k.split("|").includes(m.att)) delete K().ranges[k];
      A.ap = Math.max(0, (A.ap || 0) - cost);
      log("status", `${A.name} moves to R${r} of ${ent(m.tgt).name}, ${cost} AP. ${A.ap} left.`);
      if (K().phase === "stealth") K().stealthDue = A.id;
      ui.modal = null; if (ui.atk) ui.focus = "#roll";
    });
  },
  itemModal() { const id = actorId() || ui.sel; if (!id) return; ui.modal = { type: "item", who: id, tgt: id, sel: null }; render(); },
  itemPick(v) { ui.modal.sel = Number(v); ui.modal.heal = null; render(); },
  itemUse() {
    const m = ui.modal; const A = ent(m.who); const l = A.inv[m.sel]; if (!l) return;
    const it = E.get(ctx(), l.n).o; const T = ent(m.tgt) || A;
    const healDefault = E.healAmount(it.effect, der(A), der(T));
    const healBoost = E.forShot(der(A), A, { round: K() ? K().round : 1, range: 1, item: it.n, itemCat: it.cat }, ctx()).m.healOut || 0;  // New World Methods and similar
    const healVal = T.dbno ? 0 : num(m.heal, Math.round(healDefault * (1 + (healDefault > 0 ? healBoost : 0))));  // only a revive stands someone up
    if (S.combat && der(A).m.noItems) return toast(`${A.name} can't use items in a fight.`);
    const tm = E.forShot(der(A), A, { round: K() ? K().round : 1, range: 1, item: it.n, itemCat: it.cat }, ctx()).m;
    const itemCost = tm.itemFree ? 0 : Math.max(0, (it.ap || 0) + (tm.itemAP || 0) + (it.cat === "Counter" ? tm.counterAP || 0 : 0) + (it.cat === "Drink" ? tm.drinkAP || 0 : 0));
    if (itemCost && !canPay(A, itemCost, `use ${it.n}`)) return;
    act(`Use ${l.n}`, () => {
      l.q--; if (l.q <= 0) A.inv.splice(m.sel, 1);
      if (S.combat && itemCost) A.ap = Math.max(0, (A.ap || 0) - itemCost);
      // Standardized use: the item says which statuses to apply, which to lower or remove, and any numbers of its own.
      const u = it.use || { applies: [], reduces: {}, removes: [], fx: {} }; const my = der(A).m; const chem = ["Chem/Drug", "Alcohol"].includes(it.cat);
      // Chemist makes chems last longer, and Chem Eff makes their numbers stronger or weaker.
      const turns = it.dur != null ? Math.round(it.dur * (chem ? 1 + (my.chemDur || 0) : 1)) : null; const eff = chem ? 1 + (my.chemEff || 0) : 1;
      const strength = (fx) => (fx && eff !== 1 ? Object.fromEntries(Object.entries(fx).map(([k, v]) => [k, E.fix(v * eff)])) : fx);
      if (u.gives) addInv(A, u.gives[0], u.gives[1], true);
      if (u.revive && T.dbno) revive(T, it.n);
      if (u.numb) T.numbed = turns || 1;  // Numbing Salve
      if (u.repairDiv) { const slot = (A.weapons || [])[A.activeW || 0]; if (slot) { slot.cond = Math.min(10, (slot.cond != null ? slot.cond : 10) + Math.floor((der(A).skills.REP || 0) / u.repairDiv)); log("status", `${A.name} repairs ${slot.n}: condition ${slot.cond}.`); } }
      keepFull(T, () => {
        for (const a of u.applies) applySubstance(T, a.fx ? { ...a, fx: strength(a.fx) } : a, turns, u.after, it.n, it.effect);
        for (const [n, x] of Object.entries(u.reduces)) { const st = (T.statuses || []).find((q) => q.n === n); if (st) { st.tier -= x; if (st.tier < 1) T.statuses = T.statuses.filter((q) => q !== st); } }
        T.statuses = (T.statuses || []).filter((q) => !u.removes.includes(q.n));
        if (Object.keys(u.fx).length) { T.effects = T.effects || []; T.effects.push({ label: it.n, mods: strength(u.fx), turns, text: it.effect }); }
      });
      if (healVal) { T.hp = Math.max(0, Math.min(der(T).hp, T.hp + healVal)); syncDown(T); }
      if (S.combat && it.addict) K().used.push({ who: A.id, n: it.n, addict: Math.max(0, it.addict * (1 + (my.addict || 0))) });
      log("status", `${A.name} uses ${it.n}${T !== A ? ` on ${T.name}` : ""}: ${it.effect || "no effect written"}${healVal ? `. ${healVal > 0 ? "+" : ""}${healVal} HP, now ${T.hp}/${der(T).hp}` : ""}.${it.addict && !S.combat ? ` Roll addiction: d100 at or under ${E.pct(it.addict)}.` : ""}`);
      if (S.combat && K().phase === "stealth") K().stealthDue = A.id;
      ui.modal = null; if (ui.atk) ui.focus = "#roll";
    });
  },
  statusModal() { const id = ui.rowSel || actorId(); if (!id || !ent(id)) return; ui.modal = { type: "status", id, name: "", tier: 1, turns: "" }; ui.focus = "#stName"; render(); },
  stAdd() { const m = ui.modal; const n = String(m.name).trim(); if (!n) return toast("Name a status."); const e = ent(m.id); act(`Status: ${n}`, () => { keepFull(e, () => addStatus(e, n, num(m.tier, 1), num(m.turns))); log("status", `${e.name} gains ${n} ${m.tier}.`); ui.modal = null; if (ui.atk) ui.focus = "#roll"; }); },
  stealthRoll() {
    const k = K(); const el = document.getElementById("stealthRoll"); const r = num(el && el.value); const id = actorId(); const e = ent(id);
    if (r == null || r < 1 || r > 20) return toast("Type the d20 roll, 1 to 20.");
    const n = Math.max(1, Math.floor(der(e).skills.SNK / S.rules.sneakDiv - S.rules.sneakSub)); const pass = r <= n;
    act(`Stealth: ${e.name}`, () => { if (!pass) cbOf(id).caught = true; k.stealthDue = null; log("check", `${e.name} stealth roll: ${r} vs at or under ${n}: ${pass ? "still hidden" : `CAUGHT, ${S.rules.caughtInit} initiative`}.`); });
  },
  toInit() { act("Roll initiative", () => { prepInit(); ui.atk = null; }); },
  initNext(v, el) { const k = K(); if (el.value !== "") { const c = cbOf(el.dataset.initroll); if (c) c.roll = num(el.value); } const blank = k.cbs.find((c) => (c.roll == null || c.roll === "") && `init-${c.id}` !== el.id); if (blank) { ui.focus = `#init-${blank.id}`; render(); } else beginRounds(); },
  beginRounds,
  rerollNpcInit() { act("Reroll enemy initiative", () => { for (const c of K().cbs) if (ent(c.id).kind === "npc") c.roll = 1 + Math.floor(Math.random() * 20); }); },
  saveRoll(v, el) { const id = el.dataset.id; const r = num(el.value); if (r == null || r < 1 || r > 20) return toast("Type the d20 roll, 1 to 20."); const e = ent(id); const n = der(e).save; const pass = r <= n; act(`Save: ${e.name}`, () => { K().saves[id] = { roll: r, pass }; log("check", `${e.name} saving throw: ${r} vs at or under ${n}: ${pass ? "PASS" : "FAIL"}.`); const nx = S.chars.find((c) => c.dbno && !K().saves[c.id]); ui.focus = nx ? `#save-${nx.id}` : null; }); },
  saveRollBtn(v) { const el = document.getElementById(`save-${v}`); if (el) ACT.saveRoll("", el); },
  saveUp(v) { const e = ent(v); act(`${e.name} gets up`, () => revive(e, "saving throw")); },
  flee(v) { const e = ent(v); act(`${e.name} flees`, () => { cbOf(v).fled = true; log("status", `${e.name} flees.`); }); },
  nextRound,
  endCombat() { if (!K()) return; act("End combat", () => { const k = K(); ui.atk = null; ui.end = null; if (k.phase === "init" || k.phase === "stealth") { S.scene.npcs = k.npcs; for (const c of k.cbs) S.scene.pos[c.id] = { x: c.x, y: c.y }; S.combat = null; log("turn", "The fight never started."); return; } k.phase = "end"; k.turnId = null; }); },
  endExAdd() {
    const u = ui.end; const n = String(u.exN || "").trim(); if (!n) return toast("Type an item name.");
    const it = E.get(ctx(), n); if (!it) return toast("No item by that name. Pick one from the list.");
    u.extra.push({ n: it.o.n, q: Math.max(1, num(u.exQ, 1)), to: u.exTo }); u.exN = ""; u.exQ = 1; ui.focus = "#exN"; render();
  },
  endExDel(v) { ui.end.extra.splice(Number(v), 1); render(); },
  lootAll(val) { const u = ui.end; for (const l of lootRows()) u.loot[l.key] = val; render(); },
  finishCombat() {
    const u = ui.end || { xp: {}, heal: {}, loot: {}, add: {}, extra: [] };
    act("Finish combat", () => {
      const k = K(); const rows = lootRows(); const gained = [];
      for (const c of S.chars) {
        const x = num(u.xp[c.id], xpFor(c)); const d = der(c); const heal = num(u.heal[c.id], c.dbno ? 0 : Math.round(d.hp * S.rules.passiveHealPct));
        c.xp = E.fix((c.xp || 0) + x); if (!c.dbno) c.hp = Math.min(d.hp, c.hp + heal + Math.floor(d.hp * (d.m.endHeal || 0)));  /* Bounceback */ c.effects = c.effects || [];
        gained.push(`${c.name} +${x} XP, +${heal} HP`);
      }
      for (const l of u.extra || []) { const c = ent(l.to); if (c) { keepFull(c, () => addInv(c, l.n, l.q)); log("status", `${c.name} takes ${l.q} x ${l.n}.`); } }
      for (const l of rows) { const to = u.loot[l.key]; if (!to) continue; const c = ent(to); if (l.caps) c.caps = (c.caps || 0) + l.q; else keepFull(c, () => addInv(c, l.n, l.q)); log("status", `${c.name} takes ${l.q} x ${l.n}.`); }
      k.used.forEach((x, i) => { const r = num(u.add[i]); const c = ent(x.who); if (r != null && r <= E.pct(x.addict) && c) { c.effects.push({ label: `Addicted: ${x.n}`, mods: {}, turns: null, text: (E.get(ctx(), x.n) || { o: {} }).o.withdrawal || "" }); log("status", `${c.name} is now addicted to ${x.n}.`); } });
      log("turn", `Combat over after ${k.round} round${k.round === 1 ? "" : "s"}. ${gained.join("; ")}.`);
      for (const c of S.chars) c.ap = der(c).ap;
      S.combat = null; S.scene = freshScene(S.rules); ui.setup = null; ui.end = null; ui.atk = null;
    });
  },
  defeat() { if (!K()) return; act("Defeat", () => { K().phase = "defeat"; K().turnId = null; ui.atk = null; ui.def = null; }); },
  backToFight() { act("Back to the fight", () => { const k = K(); k.phase = "roundEnd"; k.saves = k.saves || {}; ui.def = null; }); },
  defMark(v) {
    const [id, how] = splitV(v); const c = ent(id); ui.def = ui.def || { lose: {}, caps: {}, xp: {} }; const lose = (ui.def.lose[id] = {});
    (c.inv || []).forEach((l, i) => { const it = E.get(ctx(), l.n); if (how === "all" || (how === "stowed" && !l.active) || (how === "materials" && it && it.cat === "material")) lose[i] = true; });
    render();
  },
  finishDefeat() {
    const u = ui.def || { lose: {}, caps: {}, xp: {} };
    act("Apply defeat", () => {
      const k = K(); const notes = [];
      for (const c of S.chars) {
        const lose = u.lose[c.id] || {}; const gone = (c.inv || []).filter((_, i) => lose[i]);
        keepFull(c, () => { c.inv = (c.inv || []).filter((_, i) => !lose[i]); });
        const caps = num(u.caps[c.id], 0); c.caps = Math.max(0, (c.caps || 0) - caps);
        const x = num(u.xp[c.id], E.fix(xpFor(c) * S.rules.defeatXpPct)); c.xp = E.fix((c.xp || 0) + x);
        if (c.dbno) { c.dbno = false; c.hp = S.rules.reviveHP; }
        notes.push(`${c.name} loses ${gone.map((l) => `${fmt(l.q)} x ${l.n}`).join(", ") || "no items"}${caps ? ` and ${caps} caps` : ""}${x ? `, keeps ${x} XP` : ""}`);
      }
      log("down", `Defeat after ${k.round} round${k.round === 1 ? "" : "s"}. ${notes.join("; ")}.`);
      S.combat = null; S.scene = freshScene(S.rules); ui.setup = null; ui.def = null; ui.atk = null;
    });
  },
  reroll(v) { const e = ent(v); if (e.mob) return toast("Mobs use their natural attacks."); act(`Reroll: ${e.name}`, () => { e.keepTemplateGear = false; E.gearUp(e, ctx(), Math.random); log("status", `${e.name} rerolled at tier ${e.tier}: ${e.weapons.map((w) => w.n).join(", ")}.`); }); },
  makeBoss(v) { const e = ent(v); act(`Make Boss: ${e.name}`, () => { const r = E.makeBoss(e, ctx(), Math.random); log("status", `${e.name} is now a boss: HP +${Math.round(r.hp * 100)}%, damage +${Math.round(r.dm * 100)}%, weapons up a tier, XP ${e.xp}. Weapons: ${e.weapons.map((w) => w.n).join(", ")}.`); }); },
  saveNamed(v) { const e = ent(v); act(`Save named NPC: ${e.name}`, () => { const saved = clone(e); delete saved.id; S.npcs = S.npcs.filter((n) => E.low(n.n) !== E.low(e.name)); S.npcs.push({ n: e.name, tier: e.tier, mob: e.mob, xp: e.xp, saved }); log("status", `${e.name} saved as a named NPC. Find them in the Enemies list.`); }); toast(`${e.name} saved`); },
  removeNpc(v) { const e = ent(v); act(`Remove ${e.name}`, () => { const k = K(); if (!k) { S.scene.npcs = S.scene.npcs.filter((n) => n.id !== v); delete S.scene.pos[v]; ui.modal = null; return; } k.npcs = k.npcs.filter((n) => n.id !== v); k.cbs = k.cbs.filter((c) => c.id !== v); ui.modal = null; if (ui.atk && (ui.atk.tgt === v || ui.atk.att === v)) ui.atk = null; if (k.turnId === v) { const nx = order().find((c) => canAct(c) && !k.acted[c.id]); if (nx) startTurn(nx.id); else enterRoundEnd(); } }); },
  // browser
  brToggle(v) { ui.brOpen = ui.brOpen === v ? null : v; render(); },
  brSortBy(v) { if (ui.brSort === v) ui.brDir = -ui.brDir; else { ui.brSort = v; ui.brDir = 1; } render(); },
  brGive(v) { const e = ent(ui.sel); if (!e) return toast("Pick a character first."); act(`Give ${v}`, () => { keepFull(e, () => addInv(e, v, 1, true)); log("status", `${e.name} gets ${v}.`); }); toast(`${v} given to ${e.name}`); },
  brEnter() { const list = BR_LIST().filter(([c]) => !BR_CATS[ui.brCat] || c === BR_CATS[ui.brCat]); const top = rankByName(list, ui.brQ, (x) => x[1].n)[0]; if (top) { ui.brOpen = top[1].n; render(); } },
  ovReset(v) { act("Back to workbook value", () => { delete S.overrides[v]; }); },
  searchPick(v) { const hits = searchHits(ui.modal.q); if (!hits[Number(v)]) return; ui.modal = { type: "detail", hit: hits[Number(v)], q: ui.modal.q }; render(); },
  searchOpen() { const m = ui.modal; if (searchHits(m.q).length) ACT.searchPick(m.i || 0); },
  detailAdd(v) {
    const [, o] = ui.modal.hit; const sel = ent(K() && ui.rowSel ? ui.rowSel : ui.sel);
    if (v === "inv") act(`Add ${o.n}`, () => { keepFull(sel, () => addInv(sel, o.n, 1, true)); log("status", `${sel.name} gets ${o.n}.`); ui.modal = null; });
    if (v === "perk") act(`Perk: ${o.n}`, () => { keepFull(sel, () => { sel.perks = [...(sel.perks || []), o.n]; }); log("status", `${sel.name} takes the perk ${o.n}.`); ui.modal = null; });
    if (v === "status") act(`Status: ${o.n}`, () => { keepFull(sel, () => addStatus(sel, o.n, 1)); log("status", `${sel.name} gains ${o.n}.`); ui.modal = null; });
    if (v === "enemy" || v === "enemyNow") { ui.modal = null; ACT.addPick(o.n); }
  },
  // settings
  resetRules() { if (!confirm("Put every rule back to its default?")) return; act("Reset rules", () => { S.rules = mergeRules(DEFAULT_RULES, { lootTable: clone(DATA.loot) }); }); },
};

// ---------- rendering
const app = document.getElementById("app");
function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return "#" + CSS.escape(el.id);
  if (el.dataset && el.dataset.bind) return `[data-bind="${CSS.escape(el.dataset.bind)}"]`;
  if (el.dataset && el.dataset.a) return `[data-a="${CSS.escape(el.dataset.a)}"][data-v="${CSS.escape(el.dataset.v || "")}"]`;
  return null;
}
function render() {
  pendingRender = false;
  if (dataRev !== (S.tableRev || 0)) applyData();  // Undo or loading a save can change imported tables
  document.body.className = `${prefs.face} ${prefs.scan ? "scan" : ""}`;
  if (ui.atk && !ent(ui.atk.att)) ui.atk = null;
  const a = document.activeElement; const key = focusKey(a);
  let sel = null; try { if (a && a.selectionStart != null) sel = [a.selectionStart, a.selectionEnd]; } catch (e) { /* not a text field */ }
  const scrolls = {}; document.querySelectorAll("[data-scroll]").forEach((el) => { scrolls[el.dataset.scroll] = el.scrollTop; });
  const keepX = {}; document.querySelectorAll("[data-scroll]").forEach((el) => { keepX[el.dataset.scroll] = el.scrollLeft; });
  app.innerHTML = view();
  document.querySelectorAll("[data-scroll]").forEach((el) => { if (scrolls[el.dataset.scroll]) el.scrollTop = scrolls[el.dataset.scroll]; if (keepX[el.dataset.scroll]) el.scrollLeft = keepX[el.dataset.scroll]; });
  if (ui.focus) {
    const el = document.querySelector(ui.focus); ui.focus = null;
    if (el) el.focus();
  } else if (key) {
    const el = document.querySelector(key);
    if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text field */ } }
  }
  const dlg = document.querySelector(".dialog");
  if (dlg && !dlg.contains(document.activeElement)) { const f = dlg.querySelector(".wb input, .wb select, .wb textarea, .wb button"); (f || dlg.querySelector("button")).focus(); }
}

// ---------- events
document.addEventListener("pointerdown", () => { pointerDown = true; }, true);
document.addEventListener("pointerup", () => { pointerDown = false; setTimeout(() => { if (pendingRender) render(); }, 0); }, true);
document.addEventListener("click", (e) => {
  const head = small() && e.target.closest("[data-fold]");
  if (head && !e.target.closest("button,input,select,textarea,label,a,[data-a]")) { ACT.fold(head.dataset.fold); return; }
  const sum = e.target.closest("summary");
  if (sum) { e.preventDefault(); const d = sum.parentElement; ui.open[d.dataset.k] = !d.open; render(); return; }
  const el = e.target.closest("[data-a]");
  if (!el) { return; }
  const inField = e.target.matches("input,select,textarea,label") || !!e.target.closest("label");
  if (inField && el !== e.target) {  // typing in a box inside a card must not trigger the card
    if (el.dataset.a === "pick" && !ui.atk && el.dataset.card && ui.sel !== el.dataset.v) { ui.sel = el.dataset.v; document.querySelectorAll(".card").forEach((c) => c.classList.toggle("sel", c.dataset.card === ui.sel)); }
    return;
  }
  if (el.classList.contains("scrim") && (e.target !== el || !downOnScrim)) return;
  if (el.dataset.a === "noop") return;
  const fn = ACT[el.dataset.a];
  if (fn) fn(el.dataset.v, el, e);
});
const valueOf = (el) => (el.type === "checkbox" ? el.checked : el.dataset.t === "num" ? num(el.value) : el.value);
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.note) {
    let n = S.notesList.find((x) => x.id === ui.noteId);
    if (!n) { n = { id: "nt" + S.seq++, subject: "", text: "", at: Date.now() }; S.notesList.push(n); ui.noteId = n.id; }
    n[el.dataset.note] = el.value; n.at = Date.now(); touched(); render();
    return;
  }
  if (el.dataset.u) {
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.id === "roll") { v = String(v).replace(/\D/g, "").slice(0, 2); el.value = v; }
    setPath(ui, el.dataset.u, v);
    if (el.dataset.u.startsWith("atk.")) ui.atk.err = "";
    if (el.dataset.u.startsWith("modal.q") && ui.modal) ui.modal.i = 0;
    if (el.dataset.u === "chk.use" || el.dataset.u === "chk.target") ui.chk.res = {};
    if (el.id === "rawState") return;
    render();
  }
  if (el.dataset.initroll) { const c = cbOf(el.dataset.initroll); if (c) { c.roll = num(el.value); touched(); const row = el.closest("tr"); if (row && row.lastElementChild) row.lastElementChild.textContent = c.roll == null ? "-" : fmt(c.base + c.roll); } }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.u || el.dataset.initroll || el.dataset.note) return;
  deferRender = true;
  try {
    if (el.dataset.bind) {
      const i = el.dataset.bind.indexOf(":"); const id = el.dataset.bind.slice(0, i), path = el.dataset.bind.slice(i + 1);
      const who = ent(id); if (!who) return;
      const v = valueOf(el);
      act(`Edit ${who.name}`, () => {
        if (path === "name") who.customName = true;
        if (path === "hp" || path === "ap") setPath(who, path, v == null ? 0 : v);
        else keepFull(who, () => setPath(who, path, v));
        if (path === "hp") syncDown(who);
      });
    } else if (el.dataset.c && ACT[el.dataset.c]) ACT[el.dataset.c](el.value, el);
    else if (el.dataset.scene) act("Change setting", () => { S.scene[el.dataset.scene] = el.value; if (!S.combat) for (const c of S.chars) c.ap = der(c).ap; });
    else if (el.dataset.rule) {
      const v = el.type === "checkbox" ? el.checked : el.dataset.rt === "pct" ? num(el.value, 0) / 100 : el.dataset.rt === "num" ? num(el.value, 0) : el.value;
      act("Change rule", () => setPath(S.rules, el.dataset.rule, v));
    } else if (el.dataset.pref) {
      const k = el.dataset.pref;
      if (k === "seconds") prefs.interval = Math.max(0, num(el.value, 0)); else if (k === "interval") prefs.interval = Number(el.value); else if (k === "scan") prefs.scan = el.checked; else prefs[k] = el.value;
      savePrefs(); scheduleRender();
    } else if (el.dataset.ov) {
      const [key, field, kind] = el.dataset.ov.split("|");
      const base = key.startsWith("enemy:") ? db.enemies.get(key.slice(6)) : key.startsWith("status:") ? db.status.get(key.slice(7)) : key.startsWith("perk:") ? DATA.levelPerks.find((p) => E.low(p.n) === key.slice(5)) || DATA.skillPerks.find((p) => E.low(p.n) === key.slice(5)) : key.startsWith("trait:") ? db.traitByCode.get(key.slice(6)) : (db.idx.get(key) || {}).o;
      const raw = kind === "bool" ? el.checked : kind === "text" ? el.value : num(el.value);
      act("Edit data", () => setOverride(key, field, kind === "pct" && raw != null ? E.fix(raw / 100) : raw, base));
    }
  } finally { deferRender = false; }
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "tableFile") return;
  const f = e.target.files[0]; if (!f) return;
  try {
    const text = await f.text();
    const rows = /\.csv$/i.test(f.name) ? fromCsv(text) : JSON.parse(text);
    const err = importTable(e.target.dataset.table, rows);
    toast(err || `Replaced with ${rows.length} rows. Undo goes back.`);
  } catch (err) { toast("Could not read that file."); }
});
document.getElementById("importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    if (/\.(rar|7z)$/i.test(f.name)) throw new Error("Browsers can't open that. Re-pack it as a .zip: WinRAR can save as zip.");
    const buf = await f.arrayBuffer(); const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
    if (head[0] === 0x50 && head[1] === 0x4b) { const n = await loadPack(buf);  /* zip files start with the letters PK, whatever they're named */ toast(`Pack loaded: ${n} edited table${n === 1 ? "" : "s"}. Undo goes back.`); }
    else { const p = normalize(JSON.parse(await f.text())); act("Restore backup", () => { S = p; ui.sel = (S.chars[0] || {}).id; ui.atk = null; ui.modal = null; }); toast("Backup restored"); }
  }
  catch (err) { toast(err.message || "Could not read that file."); }
  e.target.value = "";
});

function pickCard(dir) { const l = S.chars.map((c) => c.id); if (l.length) { ui.sel = cycle(l, ui.sel, dir); ui.rowSel = ui.sel; render(); } }
const KEYS = {
  idle: { b: () => ACT.beginC(""), i: () => { if (ui.sel) ACT.openChar(`${ui.sel}|inv`); }, arrowright: () => pickCard(1), arrowleft: () => pickCard(-1) },
  fight: { a: ACT.attack, r: ACT.reload, m: ACT.moveModal, i: ACT.itemModal, n: ACT.next },
};
document.addEventListener("keydown", (e) => {
  const t = e.target; const k = e.key.toLowerCase();
  const typing = t.matches && t.matches("input,select,textarea");
  if (ui.modal && ui.modal.type === "move" && t.tagName === "SELECT" && /^[0-9]$/.test(k)) { e.preventDefault(); return ACT.moveTo(k === "0" ? 10 : Number(k)); }
  if (e.ctrlKey || e.metaKey) {
    if (k === "s") { e.preventDefault(); ACT.saveNow(); return; }
    if (typing && t.id !== "roll") return;  // the browser's own undo while typing in a box
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    return;
  }
  if (e.altKey) return;
  if (k === "escape") {
    e.preventDefault();
    if (ui.modal) return ACT.closeModal();
    if (typing && t.id !== "roll") { t.blur(); render(); return; }
    if (ui.pendingMove) return ACT.moveCancel();
    if (ui.place) { ui.place = null; return render(); }
    if (ui.atk && K() && K().phase !== "turns") return ACT.closeAtk();
    if (ui.logOpen) return ACT.toggleLog();
    return;
  }
  if (ui.modal && k === "tab") {  // keep Tab inside the context window
    const f = [...document.querySelectorAll(".dialog input, .dialog select, .dialog textarea, .dialog button, .dialog summary")];
    if (f.length) { const i = f.indexOf(t); if ((e.shiftKey && i <= 0) || (!e.shiftKey && i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); } }
    return;
  }
  if (ui.modal && ui.modal.type === "search" && (k === "arrowdown" || k === "arrowup")) {
    e.preventDefault(); const n = searchHits(ui.modal.q).length; if (n) { ui.modal.i = ((ui.modal.i || 0) + (k === "arrowdown" ? 1 : -1) + n) % n; render(); }
    return;
  }
  if (k === "enter") {
    if (ui.pendingMove && !ui.modal) { e.preventDefault(); return ACT.moveConfirm(); }
    if (t.dataset && t.dataset.enter) { e.preventDefault(); if (t.dataset.c || t.dataset.bind) t.blur(); const fn = ACT[t.dataset.enter]; if (fn) fn(t.value, t); return; }
    if (t.tagName === "BUTTON" || t.tagName === "SUMMARY" || t.tagName === "TEXTAREA") return;
    if (typing) { t.blur(); }
    const scope = ui.modal ? document.querySelector(".dialog") : document;
    const p = scope.querySelector("[data-primary]");
    if (p) { e.preventDefault(); p.click(); }
    return;
  }
  const isRoll = t.id === "roll";
  if (typing && !isRoll) return;
  if (isRoll && (/^[0-9]$/.test(k) || ["backspace", "delete", "arrowleft", "arrowright", "tab", "home", "end"].includes(k))) return;
  if (ui.modal) {
    const m = ui.modal;
    if (m.type === "move" && /^[0-9]$/.test(k)) { e.preventDefault(); ACT.moveTo(k === "0" ? 10 : Number(k)); return; }
    if (m.type === "item" && /^[1-9]$/.test(k)) { e.preventDefault(); const lines = (ent(m.who).inv || []).map((l, i) => ({ l, i, it: E.get(ctx(), l.n) })).filter((x) => x.it && x.it.cat === "item" && usable(x.it.o)); const pick = lines[Number(k) - 1]; if (pick) ACT.itemPick(pick.i); return; }
    if (m.type === "help") { e.preventDefault(); ACT.closeModal(); }
    return;
  }
  if (ui.atk && K()) {
    const a = ui.atk; const A = ent(a.att);
    const atkKeys = {
      w: () => { a.w = (a.w + 1) % A.weapons.length; a.mode = "pr"; a.err = ""; },
      t: () => { const ts = targetsFor(a.att); if (ts.length) a.tgt = cycle(ts, a.tgt, 1); a.err = ""; },
    };
    if (!e.shiftKey && atkKeys[k]) { e.preventDefault(); atkKeys[k](); ui.focus = "#roll"; render(); return; }
    if (/^[0-9]$/.test(k)) { const r = document.getElementById("roll"); if (r) r.focus(); return; }
  }
  const glob = { "/": () => ACT.search(), "?": ACT.help };
  if (glob[e.key]) { e.preventDefault(); glob[e.key](); return; }
  if (k === "delete" && ui.mapSel) { e.preventDefault(); ACT.objDel(ui.mapSel); return; }
  const map = !K() ? KEYS.idle : ["end", "defeat"].includes(K().phase) ? {} : KEYS.fight;
  const fn = map[k];
  if (fn) { e.preventDefault(); fn(); return; }
  if (isRoll && k.length === 1) e.preventDefault();
});

// ---------- mouse: map tokens, resize bars, and moving and sizing context windows
let drag = null, downOnScrim = false;
function svgPoint(svg, ev) { const m = svg.getScreenCTM(); return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
document.addEventListener("pointerdown", (ev) => {
  downOnScrim = ev.target.classList && ev.target.classList.contains("scrim");
  const gut = ev.target.closest("[data-gut]");
  if (gut) { ev.preventDefault(); const box = (q) => { const el = document.querySelector(q); return el ? el.getBoundingClientRect() : null; }; drag = { kind: "gut", which: gut.dataset.gut, box: box(".board"), stage: box(".stage"), arena: box(".arena") }; document.body.classList.add("dragging"); return; }
  const title = ev.target.closest(".float > .wt");
  if (title && !ev.target.closest("button,input,select")) { const w = title.parentElement; const r = w.getBoundingClientRect(); drag = { kind: "win", w, dx: ev.clientX - r.left, dy: ev.clientY - r.top }; ev.preventDefault(); return; }
  const fl = ev.target.closest(".float");
  if (fl) { const r = fl.getBoundingClientRect(); drag = { kind: "size", w: fl, w0: r.width, h0: r.height }; return; }
  const svg = ev.target.closest && ev.target.closest("#map");
  if (svg && ev.button === 0) {
    const rh = ev.target.closest("[data-rot]");
    if (rh) { const o = S.scene.objects.find((x) => x.id === rh.dataset.rot); drag = { kind: "rot", svg, o, group: rh.closest("[data-obj]") }; ev.preventDefault(); return; }
    const g = ui.place ? null : ev.target.closest("[data-tok],[data-obj]");  // while placing, any click places, even on top of a rock
    if (g) { const p = svgPoint(svg, ev); drag = { kind: "map", svg, g, tok: g.dataset.tok, obj: g.dataset.obj, x0: p.x, y0: p.y, moved: false, p: null }; ev.preventDefault(); } else drag = { kind: "mapbg", svg };
  }
});
document.addEventListener("pointermove", (ev) => {
  if (!drag) return;
  if (drag.kind === "gut") {
    const right = drag.box.right - 47; // the rail
    if (drag.which === "left") prefs.partyW = clamp(ev.clientX - drag.box.left, 210, drag.box.width - 500);
    if (drag.which === "right") prefs.enemyW = clamp(right - ev.clientX, 160, 500);
    if (drag.which === "bottom") { const v = clamp(drag.stage.bottom - ev.clientY, 70, drag.stage.height - 200); if (K()) prefs.bottomFight = v; else prefs.bottomH = v; }
    if (drag.which === "map") prefs.mapW = clamp(ev.clientX - drag.arena.left, 200, drag.arena.width - 260);
    const st = document.documentElement.style; st.setProperty("--left", prefs.partyW + "px"); st.setProperty("--right", prefs.enemyW + "px"); st.setProperty("--bottomh", (K() ? prefs.bottomFight : prefs.bottomH) + "px"); if (prefs.mapW) st.setProperty("--mapw", prefs.mapW + "px");
  } else if (drag.kind === "win") {
    const w = drag.w; const r = w.getBoundingClientRect();
    w.style.cssText += `;position:fixed;margin:0;max-height:none;width:${r.width}px;height:${r.height}px;left:${clamp(ev.clientX - drag.dx, 0, innerWidth - 60)}px;top:${clamp(ev.clientY - drag.dy, 0, innerHeight - 30)}px`;
  } else if (drag.kind === "rot") {
    // The handle points where the top of the object should face. Snaps to 5 degrees, Shift for exact.
    const p = svgPoint(drag.svg, ev); let a = (Math.atan2(p.y - drag.o.y, p.x - drag.o.x) * 180) / Math.PI + 90;
    a = ((a % 360) + 360) % 360; if (!ev.shiftKey) a = Math.round(a / 5) * 5 % 360; drag.angle = Math.round(a);
    const gly = drag.group.querySelector(".gly:not(.trunk)"); if (gly && drag.base == null) drag.base = (gly.getAttribute("transform") || "").replace(/^rotate\([^)]*\)\s*/, "");
    if (gly) gly.setAttribute("transform", `rotate(${drag.angle}) ${drag.base}`);
    const hd = drag.group.querySelector(".rothandle"); if (hd) hd.parentNode.setAttribute("transform", `rotate(${drag.angle})`);
  } else if (drag.kind === "mapbg" && ui.zoom && !ui.place) {
    // Dragging empty ground slides the map around while zoomed in.
    const r = drag.svg.getBoundingClientRect(); const v = mapView(); const scale = Math.max(v.w / r.width, v.h / r.height);
    const dx = ev.clientX - (drag.lx != null ? drag.lx : ev.clientX), dy = ev.clientY - (drag.ly != null ? drag.ly : ev.clientY); drag.lx = ev.clientX; drag.ly = ev.clientY;
    if (dx || dy) { drag.panned = true; ui.zoom.x = v.x + v.w / 2 - dx * scale; ui.zoom.y = v.y + v.h / 2 - dy * scale; const nv = mapView(); drag.svg.setAttribute("viewBox", `${nv.x} ${nv.y} ${nv.w} ${nv.h}`); }
  } else if (drag.kind === "map") {
    const p = svgPoint(drag.svg, ev);
    if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > (ui.viewW || 20) * 0.012) drag.moved = true;
    if (drag.moved) {
      drag.p = inMap(p); drag.g.setAttribute("transform", `translate(${drag.p.x} ${drag.p.y})${drag.tok ? ` scale(${ui.tokK || 1})` : ""}`); drag.g.classList.add("lift");
      if (drag.tok && K() && fightPhase() && drag.tok === actorId() && !ev.shiftKey) {
        const e = ent(drag.tok); const cost = moveCost(posOf(drag.tok), drag.p, e); const tip = drag.g.querySelector(".drg");
        if (tip) { tip.textContent = cost === Infinity ? "CAN'T" : `${cost} AP`; tip.classList.toggle("bad", cost > (e.ap || 0)); }
      }
    }
  }
});
function keepDialog(w) { const r = w.getBoundingClientRect(); ui.dlg[w.dataset.dlg] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }
document.addEventListener("pointerup", (ev) => {
  const d = drag; drag = null; if (!d) return;
  document.body.classList.remove("dragging");
  if (d.kind === "gut") { savePrefs(); return; }
  if (d.kind === "win") return keepDialog(d.w);
  if (d.kind === "size") { const r = d.w.getBoundingClientRect(); if (Math.abs(r.width - d.w0) > 2 || Math.abs(r.height - d.h0) > 2) keepDialog(d.w); return; }
  if (d.kind === "rot") { if (d.angle != null) act("Rotate", () => { d.o.angle = d.angle; }); return; }
  if (d.kind === "mapbg") {
    if (d.panned) return;
    if (ui.place) { const p = inMap(svgPoint(d.svg, ev)); const kind = ui.place; const id = "o" + S.seq++; act(`Place ${MAP_OBJ[kind][0]}`, () => { const size = { cover: [1, 1], hard: [1.2, 1.2], hazard: [2, 2], note: [0.5, 0.5] }[kind]; const big = Math.max(1, (ui.viewW || 20) / 40);  /* a little larger when zoomed far out, so it can be seen and grabbed */ S.scene.objects.push({ id, kind, x: E.fix(p.x), y: E.fix(p.y), w: E.fix(size[0] * big), h: E.fix(size[1] * big), label: "" }); ui.mapSel = kind === "note" ? id : null; if (kind === "note") ui.focus = "#objLabel"; }); }
    else if (ui.mapSel) { ui.mapSel = null; render(); }
    return;
  }
  if (d.kind === "map") {
    if (!d.moved) {
      if (d.tok) ACT.pick(d.tok); else { ui.mapSel = d.obj; render(); }
      return;
    }
    const x = E.fix(d.p.x), y = E.fix(d.p.y);
    if (d.obj) return act("Move on map", () => { const o = S.scene.objects.find((q) => q.id === d.obj); if (o) { o.x = x; o.y = y; } });
    const k = K();
    if (!k) return act("Move token", () => { S.scene.pos[d.tok] = { x, y }; });
    const c = cbOf(d.tok); const e = ent(d.tok); const free = ev.shiftKey || !fightPhase();
    if (!free && E.pathBlocked({ x: c.x, y: c.y }, { x, y }, S.scene.objects)) { toast(`Something solid is in the way. Go around, or hold Shift.`); return render(); }
    if (!free && d.tok !== actorId()) { toast(`It isn't ${e.name}'s turn. Hold Shift to reposition for free.`); return render(); }
    const cost = free ? 0 : moveCost({ x: c.x, y: c.y }, { x, y }, e);
    if (cost > (e.ap || 0)) { toast(cost === Infinity ? `${e.name} can't walk: a shattered leg.` : `${e.name} needs ${cost} AP to walk that far, has ${fmt(e.ap)}.`); return render(); }
    // On your turn a drag is only a preview. Nothing changes until you confirm it, so you can see the cost first.
    if (!free) { ui.pendingMove = { id: d.tok, x, y, cost }; ui.focus = null; return render(); }
    act("Move token", () => {
      c.x = x; c.y = y;
      for (const key of Object.keys(k.ranges)) if (key.split("|").includes(d.tok)) delete k.ranges[key];
      log("status", `DM moves ${e.name}.`);
    });
  }
});
// Scroll over the map to zoom in on what's under the pointer.
let wheelQueued = false;
document.addEventListener("wheel", (ev) => {
  const svg = ev.target.closest && ev.target.closest("#map"); if (!svg) return;
  ev.preventDefault();
  if (ev.shiftKey && ui.mapSel) return ACT.objRotate((ev.deltaY || ev.deltaX) < 0 ? -15 : 15);  // Shift+scroll turns the selected object
  const p = svgPoint(svg, ev); const v0 = mapView(); const k0 = ui.zoom ? ui.zoom.k : 1;
  setZoom(k0 * (ev.deltaY < 0 ? 1.2 : 1 / 1.2), p.x, p.y);
  if (ui.zoom) { const v1 = mapView(); ui.zoom.x = p.x + (v1.w / 2) - ((p.x - v0.x) / v0.w) * v1.w; ui.zoom.y = p.y + (v1.h / 2) - ((p.y - v0.y) / v0.h) * v1.h; }  // keep the same spot under the pointer
  if (!wheelQueued) { wheelQueued = true; requestAnimationFrame(() => { wheelQueued = false; render(); }); }
}, { passive: false });
document.addEventListener("contextmenu", (ev) => { const g = ev.target.closest && ev.target.closest("[data-obj]"); if (g) { ev.preventDefault(); ACT.objDel(g.dataset.obj); } });

// ---------- boot
function fillLists() {
  const dl = (id, arr) => `<datalist id="${id}">${arr.map((x) => `<option value="${h(x)}"></option>`).join("")}</datalist>`;
  document.getElementById("lists").innerHTML = dl("dl-all", [...DATA.items, ...DATA.materials, ...DATA.ammo, ...DATA.armor, ...DATA.weapons, ...DATA.mods].map((o) => o.n)) + dl("dl-weapons", DATA.weapons.filter((w) => w.tier).map((o) => o.n)) + dl("dl-armor", DATA.armor.map((o) => o.n)) + dl("dl-perks", [...new Set([...DATA.levelPerks, ...DATA.skillPerks].map((o) => o.n))]) + dl("dl-status", DATA.statuses.map((o) => o.n)) + dl("dl-traits", DATA.traits.map((t) => `${t.code} ${t.n}`));
}
applyData();
// The hosted copy (index.html) opens on a brand new campaign. The build switches this on for that file only.
const FRESH_START = /*FRESH*/false;
if (FRESH_START && !readJson(SAVE_KEY)) { S = fresh(); S.chars = []; ui.sel = null; ui.wiz = newWiz(); ui.modal = { type: "wizard" }; ui.focus = "#wizName"; applyData(); }
if (!readJson(SAVE_KEY)) save();
render();
