// ===== 02-game.js: GAME ACTIONS THAT CHANGE S. View helpers, editable data overrides, shared actions (inventory, statuses, XP),
// the combat flow (start, turns, rounds, end), attacks, and the automated enemy turn. Rules math belongs in engine.js, not here.
// ---------- small view helpers
const kbd = (k) => (k ? `<kbd>${h(k)}</kbd>` : "");
const SHOWN_KEYS = new Set(["A", "R", "M", "I", "N", "B", "Enter", "Esc", "/", "?"]); // only the keys for what happens all the time
const btn = (a, v, label, key = "", cls = "", title = "") =>
  `<button class="btn ${cls}" data-a="${a}" data-v="${h(v)}"${title ? ` title="${h(title)}"` : ""}>${SHOWN_KEYS.has(key) ? kbd(key) : ""}${label}</button>`;
const primary = (a, v, label, key = "") => `<button class="btn primary" data-primary="1" data-a="${a}" data-v="${h(v)}">${kbd(key)}${label}</button>`;
const small = () => matchMedia("(max-width: 1000px)").matches || document.documentElement.classList.contains("lt1000");
// A size the DM dragged a window to (bottom-right corner) sticks. Double-click the title bar to put it back.
const winSize = (cls) => {
  const z = (prefs.wsize || {})[cls];
  return z ? ` style="flex:none;width:${Math.round(z.w * kx())}px;height:${Math.round(z.h * ky())}px;max-width:none;max-height:none"` : "";
};
const win = (cls, title, key, body, opt = {}) =>
  `<section class="win ${cls} ${opt.act ? "act" : ""} ${(prefs.fold || {})[cls] ? "folded" : ""}" data-wcls="${cls}"${winSize(cls)}><header class="wt" data-fold="${cls}"><button type="button" class="foldbtn" data-a="fold" data-v="${cls}" aria-label="${(prefs.fold || {})[cls] ? "Open" : "Fold"} ${h(String(title).replace(/<[^>]*>/g, ""))}" aria-expanded="${!(prefs.fold || {})[cls]}">${(prefs.fold || {})[cls] ? "+" : "-"}</button>${kbd(key)}<span>${title}</span><span class="spacer"></span>${opt.tools || ""}</header><div class="wb" data-scroll="${cls}">${body}</div></section>`;
function fold(k, title, body, opt = {}) {
  const open = ui.open[k] != null ? ui.open[k] : !!opt.open;
  return `<details class="fold" data-k="${h(k)}"${open ? " open" : ""}><summary>${kbd(opt.key)}<span>${title}</span>${opt.badge != null && opt.badge !== "" ? `<span class="fb">${opt.badge}</span>` : ""}</summary><div class="fbody">${open ? body : ""}</div></details>`;
}
function hpBar(cur, max) {
  const p = max > 0 ? clamp(cur / max, 0, 1) : 0;
  return `<div class="bar ${p <= 0.25 ? "low" : p <= 0.55 ? "mid" : ""}"><i style="width:${p * 100}%"></i></div>`;
}
const field = (label, input) => `<label class="f">${label}${input}</label>`;
// A box with no title of its own is named from what it changes (data-c="setQty" reads "Qty"), so screen readers don't just say "edit text".
const boxName = (attrs) => {
  const m = attrs.match(/data-(?:c|bind)="(?:[^"]*:)?([^"]+)"/);
  return m
    ? m[1]
        .replace(/^set(?=[A-Z])/, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\./g, " ")
    : "Number";
};
const numBox = (attrs, val, cls = "") =>
  `<input type="text" inputmode="decimal" autocomplete="off" class="${cls}" ${attrs}${/title=|aria-label=/.test(attrs) ? "" : ` aria-label="${h(boxName(attrs))}"`} value="${h(val == null ? "" : val)}">`;
const bindNum = (id, path, val, attrs = "", cls = "") => numBox(`data-t="num" data-bind="${id}:${path}" ${attrs}`, val, cls);
const bindText = (id, path, val, list = "", attrs = "") =>
  `<input type="text" autocomplete="off" data-bind="${id}:${path}" value="${h(val == null ? "" : val)}"${list ? ` list="${list}"` : ""} ${attrs}>`;
const ovCell = (e, k, val, title) =>
  numBox(
    `data-c="setOv" data-id="${e.id}" data-k="${k}" id="ov-${e.id}-${k}" title="${h(title)}. Type to override, clear to go back to automatic."`,
    val,
    `cell ${(e.ov || {})[k] != null && (e.ov || {})[k] !== "" ? "ovr" : ""}`,
  );
const options = (list, cur) =>
  list
    .map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${h(v)}"${String(v) === String(cur) ? " selected" : ""}>${h(l)}</option>`;
    })
    .join("");
function chips(e, icons) {
  const out = [];
  for (const st of icons ? [] : e.statuses || []) {
    const i = E.statusInfo(ctx(), st);
    const tone = i.def && i.def.tone === "Positive" ? "pos" : i.def && i.def.tone === "Neutral" ? "neu" : "";
    out.push(
      `<span class="chip ${tone}" title="${h(i.text)}">${h(st.n)}${st.tier > 1 ? " " + st.tier : ""}${st.parts ? ": " + st.parts.map((p) => PARTS[p][0]).join(", ") : ""}${st.turns != null ? ` (${st.turns})` : ""}</span>`,
    );
  }
  for (const fx of e.effects || [])
    out.push(`<span class="chip neu" title="${h(fx.text || "")}">${h(fx.label)}${fx.turns != null ? ` (${fx.turns})` : ""}</span>`);
  return out.length ? `<div class="chips">${out.join("")}</div>` : "";
}

// ---------- data the DM can edit: workbook value + saved override
const traitV = (t) => (t ? { ...t, ...(S.overrides["trait:" + t.code] || {}) } : t);
const perkKey = (n) => "perk:" + E.low(n);
const perkInfo = (n) => {
  const p = DATA.levelPerks.find((x) => E.low(x.n) === E.low(n)) || DATA.skillPerks.find((x) => E.low(x.n) === E.low(n));
  return p ? { ...p, ...(S.overrides[perkKey(n)] || {}) } : null;
};
const enemyV = (t) => (t ? { ...t, ...(S.overrides["enemy:" + E.low(t.n)] || {}) } : t);
function setOverride(key, path, val, base) {
  const ov = (S.overrides[key] = S.overrides[key] || {});
  const root = path.split(".")[0];
  if (root !== path && ov[root] == null) ov[root] = clone((base || {})[root] != null ? base[root] : []);
  setPath(ov, path, val);
  if (base && base.tab) {
    // a filled-in weapon counts as having stats
    const w = { ...base, ...ov };
    const need =
      w.tab === "MW" ? ["dmg", "ap"] : w.tab === "EW" || w.tab === "EX" ? ["dmg", "pen", "ap", "crit", "jam", "req"] : ["ap", "crit", "jam", "req", "count"];
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
    const was = e.dbno;
    e.dbno = e.hp <= 0;
    if (e.dbno && !was) log("down", `${e.name} is down (DBNO).`);
  } else if (S.combat) {
    const cb = cbOf(e.id);
    if (!cb) return;
    if (e.hp <= 0 && !cb.dead) {
      cb.dead = true;
      cb.killer = killer || null;
      log("kill", `${e.name} is dead.`);
    } else if (e.hp > 0 && cb.dead) cb.dead = false;
  }
}
function addInv(e, name, q = 1, active = false) {
  const l = (e.inv = e.inv || []).find((x) => E.low(x.n) === E.low(name));
  if (l) l.q += q;
  else e.inv.push({ n: name, q, active });
}
// Applies a status from a drink or drug. The item's exact numbers ride along, and its after-effect waits for it to end.
function applySubstance(e, a, turns, after, itemName, text) {
  addStatus(e, a.n, a.tier, turns);
  const st = (e.statuses || []).find((x) => x.n === a.n);
  if (!st) return;
  if (a.fx) {
    st.fx = a.fx;
    st.text = text;
  } else {
    delete st.fx;
    delete st.text;
  }
  st.from = itemName;
  if (after) st.after = after;
  else delete st.after;
}
// A substance wore off: remove it and bring in its after-effect, like a hangover.
function endSubstance(e, st) {
  if (!st.after) return;
  addStatus(e, st.after.n, st.after.tier || 1, null);
  const next = e.statuses.find((x) => x.n === st.after.n);
  next.aftermath = true;
  if (st.after.fx) {
    next.fx = st.after.fx;
    next.text = st.after.text;
  }
  log("status", `${st.from || st.n} wears off ${e.name}: ${st.after.n}.`);
}
function addStatus(e, name, tier0 = 1, turns = null) {
  const def = db.status.get(E.low(name));
  const canon = def ? def.n : name;
  // Resistance: gas masks, Rad-X and so on make a status land one tier lower. At zero it doesn't land.
  const tier = tier0 - (der(e).m["resist:" + canon] || 0) + (/Injured Limb/.test(canon) ? der(e).m.crippleTaken || 0 : 0);
  if (tier < 1) {
    log("status", `${e.name} resists ${canon}.`);
    return;
  }
  e.statuses = e.statuses || [];
  const cur = e.statuses.find((s) => E.low(s.n) === E.low(canon));
  const info = E.statusInfo(ctx(), { n: canon, tier });
  const t = turns != null ? turns : info.mods.turns != null ? info.mods.turns : null;
  if (cur) {
    cur.tier = tier;
    cur.turns = t;
  } else e.statuses.push({ n: canon, tier, turns: t });
  const on = ((S.rules.statusTiers || {})[canon] || [])[tier - 1];
  if (on && on.heal) e.hp = Math.min(der(e).hp, (e.hp || 0) + on.heal);
  if (on && on.removes) e.statuses = e.statuses.filter((s) => !on.removes.includes(s.n));
}
function revive(e, how) {
  e.dbno = false;
  e.hp = Math.max(e.hp, S.rules.reviveHP);
  e.timesRevived = (e.timesRevived || 0) + 1;
  addStatus(e, "Shock", S.rules.reviveShockTier);
  log("check", `${e.name} is back up at ${e.hp} HP with Shock ${S.rules.reviveShockTier} (${how}). Times revived: ${e.timesRevived}.`);
}
function template(name) {
  const n = S.npcs.find((x) => E.low(x.n) === E.low(name));
  return n || enemyV(db.enemies.get(E.low(name))) || null;
}
const allTemplates = () => [...S.npcs.map((n) => ({ ...n, named: true })), ...DATA.enemies.filter((t) => !t.test).map(enemyV)];
/** Exact match first, then names that start with the text, then the rest. */
function rankByName(list, q, nameOf = (x) => x.n) {
  const s = E.low(q);
  if (!s) return list;
  const score = (x) => {
    const n = E.low(nameOf(x));
    return n === s ? 0 : n.startsWith(s) ? 1 : n.includes(s) ? 2 : 3;
  };
  return list.filter((x) => score(x) < 3).sort((a, b) => score(a) - score(b));
}
const CONSUMABLE_CATS = ["Healing", "Chem/Drug", "Alcohol", "Drink", "Food", "Tobacco", "Poison", "Resistance", "Counter"];
const usable = (item) => item && item.cat !== "Implant" && (item.effect || item.ap != null || CONSUMABLE_CATS.includes(item.cat)); // implants go in through Health

// ---------- combat flow
const order = () => [...K().cbs].sort((a, b) => (b.init == null ? -99 : b.init) - (a.init == null ? -99 : a.init) || (b.base || 0) - (a.base || 0));
const alive = (c) => !c.dead && !c.fled;
const canAct = (c) => {
  const e = ent(c.id);
  return e && alive(c) && !e.dbno;
};
function actorId() {
  const k = K();
  if (!k) return null;
  if (k.phase === "stealth") {
    const r = ui.rowSel && ent(ui.rowSel);
    return r && r.kind === "pc" ? r.id : (S.chars[0] || {}).id;
  }
  return k.turnId;
}
const pairKey = (a, b) => [a, b].sort().join("|");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function bandFor(d) {
  const m = S.rules.bandMeters;
  for (let i = 0; i < 10; i++) if (d <= m[i] + 0.01) return i + 1;
  return 10;
}
function posOf(id) {
  const c = cbOf(id);
  if (c && c.x != null) return c;
  return S.scene.pos[id] || { x: 0, y: 0 };
}
function rangeOf(a, b) {
  const k = K();
  if (a === b) return 1;
  const o = k && k.ranges[pairKey(a, b)];
  if (o != null) return o;
  return bandFor(dist(posOf(a), posOf(b)));
}
const mapOf = () => S.scene.map || { id: "wild", n: "", w: 220, h: 160 };
const unit = () => {
  const M = mapOf();
  return Math.max(M.w, M.h) / 16;
}; // the size one token takes up, so a small room and a wasteland both read well
const inMap = (p) => {
  const M = mapOf();
  return { x: clamp(p.x, -M.w / 2, M.w / 2), y: clamp(p.y, -M.h / 2, M.h / 2) };
};
// Injured legs make walking dearer, using the "-25% mvm" in the status text. Shattered means no walking at all.
function moveMult(e) {
  let m = 1;
  for (const st of (e && e.statuses) || []) {
    if (st.parts && !st.parts.some((p) => /Leg/.test(p))) continue; // a hurt arm doesn't slow you down
    const x = E.statusInfo(ctx(), st).mods;
    if (x.immobile) return Infinity;
    if (x.mvm) m = Math.max(m, 1 / (1 + x.mvm));
  }
  return m;
}
// Draft rule: AP by how far you walk, from the Move AP table, so 150m is 15 AP and a step across a room is 1 or 2.
function moveCost(from, to, e) {
  const d = dist(from, to);
  if (d < 0.01) return 0;
  const lim = e && der(e).m.moveMaxM;
  if (lim && d > lim) return Infinity;
  const m = moveMult(e);
  return m === Infinity ? Infinity : Math.max(1, Math.ceil((d / speedOf(e)) * m - 1e-9)) + ((e && der(e).m.moveAdd) || 0);
}
// The keyboard move: where 'steps' AP of walking along the arrow ends up, as the pending move Enter confirms
function keyMovePlan() {
  const km = ui.keyMove;
  const e = km && ent(km.id);
  if (!e) return (ui.keyMove = null);
  const p = posOf(km.id),
    r = (km.ang * Math.PI) / 180;
  const len = km.steps * (speedOf(e) / (moveMult(e) || 1));
  const to = inMap({ x: E.fix(p.x + Math.cos(r) * len), y: E.fix(p.y + Math.sin(r) * len) });
  ui.pendingMove = km.steps > 0 ? { id: km.id, x: to.x, y: to.y, cost: moveCost(p, to, e) } : null;
}
// meters per AP: Agility on a line (AGI 1 = 5 m, 10 = 8 m)
const speedOf = (e) => E.moveSpeed(e ? der(e).sp.A || 5 : 5, S.rules);
function reachOf(e) {
  const m = moveMult(e);
  if (m === Infinity) return 0;
  const ap = (e.ap || 0) - (der(e).m.moveAdd || 0);
  return ap > 0 ? E.fix((ap / m) * speedOf(e)) : 0;
}
const fightPhase = () => K() && ["turns", "stealth"].includes(K().phase);
// Rules that depend on the round, for actions other than attacks.
function turnMods(e) {
  const k = K();
  return E.forShot(der(e), e, { round: k ? k.round : 1, range: 1 }, ctx()).m;
}
function canPay(e, cost, what) {
  if (!fightPhase() || !cost || (e.ap || 0) >= cost) return true;
  toast(`${e.name} needs ${cost} AP to ${what}, has ${fmt(e.ap)}.`);
  return false;
}
const WALKABLE = new Set(["bedroll", "pallet"]);
/** Can someone stand here? Not inside walls, furniture, rocks or tree trunks. Rugs and bedrolls are fine, and hazards and markers are areas, not things. */
function standBlocked(p) {
  return S.scene.objects.some((o) => {
    if (o.kind === "hazard" || o.kind === "note" || WALKABLE.has(o.item)) return false;
    if (o.kind === "tree") {
      const tr = E.trunkOf(o, S.rules);
      return Math.hypot(p.x - o.x, p.y - o.y) <= (tr ? ((o.w || 1) * tr) / 2 : (o.w || 1) / 2) + 0.25;
    }
    return E.inside(p, { ...o, w: (o.w || 1) + 0.4, h: (o.h || 1) + 0.4 });
  });
}
// Where enemies appear: a share of the map's longer side, measured from the middle of the party.
const SPAWN = { close: [0.08, 0.2], mid: [0.25, 0.45], far: [0.55, 0.9] };
function freeSpot() {
  const M = mapOf(),
    u = unit();
  const others = [...S.chars.map((c) => posOf(c.id)), ...foes().map((n) => posOf(n.id))];
  let best = null,
    bestGap = -1;
  const band = SPAWN[S.scene.spawn],
    L = Math.max(M.w, M.h);
  const party = S.chars.map((c) => posOf(c.id));
  const mid = { x: party.reduce((t, q) => t + q.x, 0) / (party.length || 1), y: party.reduce((t, q) => t + q.y, 0) / (party.length || 1) };
  for (let i = 0; i < (band ? 80 : 24); i++) {
    let p = { x: E.fix(-M.w / 2 + M.w * 0.38 + Math.random() * (M.w * 0.62 - u)), y: E.fix((Math.random() - 0.5) * (M.h - u * 1.6)) };
    if (band) {
      const a = Math.random() * Math.PI * 2,
        r = L * (band[0] + Math.random() * (band[1] - band[0]));
      p = inMap({ x: E.fix(mid.x + r * Math.cos(a)), y: E.fix(mid.y + r * Math.sin(a)) });
      const d = dist(p, mid);
      if (d < L * band[0] * 0.9 || d > L * band[1]) continue; // the map's edge pulled it out of the band
    }
    if (standBlocked(p)) continue;
    const gap = Math.min(1e6, ...others.map((o) => dist(o, p)));
    if (gap > bestGap) {
      best = p;
      bestGap = gap;
    }
    if (gap > u * 2.5) break;
  }
  return best || { x: E.fix(M.w * 0.25), y: 0 };
}
function partySpots() {
  const M = mapOf(),
    u = unit(),
    n = S.chars.length,
    rows = Math.ceil(n / 2);
  const gap = Math.max(2, u); // 2 m apart at least, so names don't run into each other in small rooms
  S.chars.forEach((c, i) => {
    if (!S.scene.pos[c.id])
      S.scene.pos[c.id] = { x: E.fix(-M.w / 2 + gap * (0.8 + (i % 2) * 1.2)), y: E.fix((Math.floor(i / 2) - (rows - 1) / 2) * gap * 1.15) };
  });
}
const customMap = (id) => (String(id).startsWith("cm:") && (S.customMaps || {})[String(id).slice(3)]) || null;
const builtObjects = (cm) => cm.objs.map((o) => ({ ...clone(o), id: "o" + S.seq++ }));
function applyMap(id, w, h) {
  const cm = customMap(id);
  const p = cm ? { n: cm.n, w: cm.w, h: cm.h } : S.rules.maps[id] || S.rules.maps.wild;
  const sc = S.scene;
  const g = S.rules.gridM || 2;
  const fit = (x) => Math.max(g, Math.ceil(x / g) * g); // whole grid squares only
  sc.map = { id, n: p.n, w: fit(w || p.w), h: fit(h || p.h) };
  sc.pos = {};
  ui.zoom = null;
  partySpots();
  const u = unit();
  const party = S.chars.map((c) => sc.pos[c.id]);
  const items = S.rules.mapItems;
  // Builds one object. Item names come from the catalog, older kinds like "wall" still work.
  const make = (kind, x, y, ow, oh, label) => {
    const c = items[kind];
    const o = { id: "o" + S.seq++, kind: c ? (c.round ? "tree" : "cover") : kind, x, y, w: ow, h: oh, label: label || "" };
    if (c) {
      o.item = kind;
      o.cover = c.cover;
      if (c.block) o.block = true;
      if (c.round) o.round = true;
    }
    return o;
  };
  sc.objects = cm ? builtObjects(cm) : (p.objs || []).map(([kind, x, y, ow, oh, label]) => make(kind, x, y, ow, oh, label));
  if (cm) sc.theme = "asBuilt";
  else if (sc.theme === "asBuilt") sc.theme = S.rules.sceneDefaults.theme;
  for (const [kind, count, lo, hi] of p.scatter || [])
    for (let i = 0; i < count; i++) {
      const size = E.fix(lo + Math.random() * (hi - lo));
      const o = { x: E.fix((Math.random() - 0.5) * (sc.map.w - size)), y: E.fix((Math.random() - 0.5) * (sc.map.h - size)) };
      if (party.some((q) => dist(q, o) < Math.max(u, 2))) continue;
      sc.objects.push(make(kind, o.x, o.y, size, size));
    }
  for (const e of sc.npcs) sc.pos[e.id] = freeSpot();
}
function ensureMap() {
  if (!S.scene.map) applyMap(S.rules.sceneDefaults.map);
}
function renumber(list, tmpl) {
  const same = list.filter((n) => n.tmpl === tmpl);
  same.forEach((n, i) => {
    if (!n.customName) n.name = same.length > 1 ? `${tmpl} ${i + 1}` : tmpl;
  });
}
function addEnemy(name) {
  const t = template(name);
  if (!t) return null;
  const k = K();
  const id = "n" + S.seq++;
  const list = foes();
  ensureMap();
  const p = freeSpot();
  const e = E.spawn(t, id, ctx(), Math.random);
  if (t.saved) e.customName = true;
  else {
    const n = E.npcName(t, S.rules, Math.random, new Set([...list, ...S.scene.npcs].map((x) => x.name)));
    if (n) {
      e.name = n;
      e.customName = true;
    }
  }
  list.push(e);
  renumber(list, t.n);
  if (k) {
    const d = der(e);
    const roll = 1 + Math.floor(Math.random() * 20);
    k.cbs.push({ id, x: p.x, y: p.y, base: d.pri, roll, init: E.fix(d.pri + roll) });
    log("turn", `${e.name} joins the fight, initiative ${E.fix(d.pri + roll)}.`);
  } else S.scene.pos[id] = p;
  return e;
}
const sideOf = (id) => {
  const e = ent(id);
  return e && (e.kind === "pc" || e.ally) ? "pc" : "npc";
};
function targetsFor(id) {
  const list = order().filter((c) => c.id !== id && alive(c));
  const live = (c) => !ent(c.id).dbno;
  return [
    ...list.filter((c) => sideOf(c.id) !== sideOf(id) && live(c)),
    ...list.filter((c) => sideOf(c.id) !== sideOf(id) && !live(c)),
    ...list.filter((c) => sideOf(c.id) === sideOf(id)),
  ].map((c) => c.id);
}
function beginCombat(stealth) {
  if (!S.scene.npcs.length && !confirm("No enemies on the map. Start a fight anyway?")) return;
  act("Begin combat", () => {
    ensureMap();
    partySpots();
    const npcs = S.scene.npcs;
    const cbs = [];
    for (const e of [...S.chars, ...npcs]) {
      const p = S.scene.pos[e.id] || { x: 0, y: 0 };
      cbs.push({ id: e.id, x: p.x, y: p.y });
    }
    S.chars.forEach((c) => {
      c.ap = der(c).ap;
      const fear = der(c).m.startAfraid;
      if (fear) addStatus(c, "Afraid", fear);
    }); // Paranoid
    S.combat = { phase: stealth ? "stealth" : "init", round: 1, npcs, cbs, ranges: {}, acted: {}, last: {}, used: [], turnId: null, stealthDue: null };
    S.scene.npcs = [];
    log("turn", `Combat: ${npcs.map((n) => n.name).join(", ") || "no enemies"}. ${S.scene.time}, ${S.scene.weather}, ${S.scene.env}.`);
    if (!stealth) prepInit();
    ui.rowSel = (S.chars[0] || {}).id;
    ui.atk = null;
    ui.end = null;
    ui.def = null;
    ui.place = null;
  });
}
function prepInit() {
  const k = K();
  k.phase = "init";
  k.stealthDue = null;
  for (const c of k.cbs) {
    const e = ent(c.id);
    c.base =
      der(e).pri + (c.caught ? S.rules.caughtInit : 0) + (e.kind === "npc" && !e.ally ? S.chars.reduce((t, pc) => t + (der(pc).m.enemyInit || 0), 0) : 0); // Instinct
    c.roll = e.kind === "npc" ? 1 + Math.floor(Math.random() * 20) : null;
  }
  const first = k.cbs.find((c) => c.roll == null);
  if (first) ui.focus = `#init-${first.id}`;
}
function beginRounds() {
  const k = K();
  const missing = k.cbs.find((c) => c.roll == null || c.roll === "");
  act("Begin round 1", () => {
    for (const c of k.cbs) c.init = E.fix((c.base || 0) + num(c.roll, 0));
    k.phase = "turns";
    k.round = 1;
    log(
      "turn",
      "Initiative: " +
        order()
          .map((c) => `${ent(c.id).name} ${c.init}`)
          .join(", ") +
        (missing ? " (blank rolls counted as 0)" : ""),
    );
    startFirstTurn();
  });
}
function startFirstTurn() {
  const k = K();
  k.acted = {};
  const f = order().find(canAct);
  if (f) startTurn(f.id);
  else enterRoundEnd();
}
function startTurn(id) {
  ui.autoPlan = null;
  const k = K(),
    e = ent(id);
  const me = cbOf(id);
  if (me) {
    me.still = me.moved ? 0 : (me.still || 0) + (k.round > 1 ? 1 : 0);
    me.moved = false;
  } // Turtle counts rounds spent still
  k.turnId = id;
  k.acted[id] = true;
  e.ap = der(e).ap;
  e.punches = 0;
  ui.rowSel = id;
  ui.atk = null;
  ui.pendingMove = null;
  ui.focus = "#roll";
  if (e.kind === "pc") ui.sel = id;
  log("turn", `Round ${k.round}: ${e.name}'s turn, ${e.ap} AP.`);
  touchObjects(id);
}
function nextTurn() {
  act("End turn", () => {
    const k = K();
    const nx = order().find((c) => canAct(c) && !k.acted[c.id]);
    if (nx) startTurn(nx.id);
    else enterRoundEnd();
  });
}
const setTimeout0 = []; // after-effects to add once a status list has finished updating
function tickRound() {
  for (const c of K().cbs) {
    if (!alive(c)) continue;
    const e = ent(c.id);
    const ir = E.implantsOf(e, S.rules).reduce((t, im) => t + (im.fx.regen || 0), 0); // Monocyte Breeder
    if (ir && e.hp < der(e).hp) {
      e.hp = Math.min(der(e).hp, e.hp + ir);
      log("status", `${e.name} heals ${ir} HP (implant).`);
    }
    e.statuses = (e.statuses || []).filter((st) => {
      const i = E.statusInfo(ctx(), st);
      if (i.mods.dot) {
        e.hp = Math.max(0, e.hp - i.mods.dot);
        log("status", `${e.name} takes ${i.mods.dot} from ${st.n}. HP ${e.hp}/${der(e).hp}.`);
        syncDown(e);
      }
      if (i.mods.regen) {
        e.hp = Math.min(der(e).hp, e.hp + i.mods.regen);
        log("status", `${e.name} gains ${i.mods.regen} HP from ${st.n}.`);
        syncDown(e);
      }
      // 12 Nov: bleeding clots. Each round it drops a tier; at tier 1 it bleeds bleedT1Rounds more rounds, then stops. Treatment still lowers it.
      if (st.n === "Bleeding" && S.rules.bleedDecay) {
        if (st.tier > 1) {
          st.tier--;
          st.turns = st.tier === 1 ? S.rules.bleedT1Rounds || 5 : null;
          log("status", `${e.name}'s bleeding slows to Bleeding ${st.tier}.`);
          return true;
        }
        if (st.turns == null) st.turns = S.rules.bleedT1Rounds || 5;
      }
      if (st.turns != null) {
        st.turns--;
        if (st.turns <= 0) {
          log("status", `${st.n} ends on ${e.name}.`);
          setTimeout0.push(() => endSubstance(e, st));
          return false;
        }
      }
      return true;
    });
    while (setTimeout0.length) setTimeout0.shift()();
    if (e.numbed > 0) e.numbed--;
    e.effects = (e.effects || []).filter((fx) => {
      if (fx.turns != null) {
        fx.turns--;
        if (fx.turns <= 0) {
          log("status", `${fx.label} wears off ${e.name}.`);
          return false;
        }
      }
      return true;
    });
  }
}
function enterRoundEnd() {
  const k = K();
  k.phase = "roundEnd";
  k.turnId = null;
  k.saves = {};
  ui.atk = null;
  tickRound();
  log("turn", `End of round ${k.round}.`);
  // a side with nobody left to shoot at ends the fight here, so nobody has to press End
  if (!npcsAlive()) {
    k.phase = "end";
    log("turn", "No enemies left standing. The fight is over.");
    return;
  }
  if (!partyUp()) {
    k.phase = "defeat";
    ui.def = null;
    log("turn", "Nobody in the party is left standing.");
    return;
  }
  const firstDown = S.chars.find((c) => c.dbno);
  if (firstDown) {
    ui.focus = `#save-${firstDown.id}`;
    return;
  } // saving throws to roll: stop here
  if (!order().some(canAct)) return; // nobody left who can act (an empty party, say): stop here instead of starting rounds forever
  k.round++;
  k.phase = "turns";
  startFirstTurn(); // nothing to decide between rounds, so the next one starts by itself
}
function nextRound() {
  act("Next round", () => {
    const k = K();
    k.round++;
    k.phase = "turns";
    startFirstTurn();
  });
}
// Prayer is only for characters with the religious trait (Strict Religious Rites, or its evolved Devout)
const canPray = (e) => e && e.kind === "pc" && ((S.rules.prayer || {}).traits || []).some((t) => (e.traits || []).includes(t));
// One line on what a consumable does: its effect text, then what it applies or removes, then addiction risk
function consText(o) {
  const u = o.use || {};
  const bits = [
    o.effect,
    (u.applies || []).length ? `gives ${u.applies.map((x) => `${x.n} ${x.tier}`).join(", ")}${o.dur ? ` for ${o.dur} turns` : ""}` : "",
    (u.removes || []).length ? `removes ${u.removes.join(", ")}` : "",
    Object.keys(u.reduces || {}).length ? `lowers ${Object.keys(u.reduces).join(", ")}` : "",
    o.addict ? `addiction ${E.pct(o.addict)}%` : "",
  ].filter(Boolean);
  return bits.join(" · ") || "No effect written yet";
}
// Saves are rolled high: the old "at or under X" becomes "21 - X or more", the same odds, and a 20 is always the best roll
const saveNeed = (save) => clamp(21 - save, 2, 20);
const npcsAlive = () => K().cbs.filter((c) => sideOf(c.id) === "npc" && alive(c)).length;
const pcsUp = () => S.chars.filter((c) => !c.dbno).length;
// the party side is out when no player is up and no ally is still standing
const partyUp = () => pcsUp() || K().cbs.some((c) => sideOf(c.id) === "pc" && ent(c.id).kind !== "pc" && alive(c));

// ---------- attack
const PARTS = {
  Head: ["Head", "Head"],
  Body: ["Body", "Body"],
  LArm: ["Left arm", "Limb"],
  RArm: ["Right arm", "Limb"],
  LLeg: ["Left leg", "Limb"],
  RLeg: ["Right leg", "Limb"],
};
function setPart(a, id) {
  a.part = id;
  a.loc = PARTS[id][1];
}
// Sets up the attack menu without drawing. On a turn it's always up, so this also runs when a turn starts.
function makeAttack(att, want) {
  const k = K();
  const id = att || actorId();
  const A = ent(id);
  if (!k || !A || !(A.weapons || []).length) return false;
  const last = k.last[id] || {};
  const ts = targetsFor(id);
  const tgt = want && ts.includes(want) ? want : last.tgt && ts.includes(last.tgt) && !(ent(last.tgt).dbno && ts[0] !== last.tgt) ? last.tgt : ts[0];
  ui.atk = { att: id, tgt: tgt || null, w: A.activeW || 0, mode: last.mode || "pr", roll: "", ov: {}, res: null, err: "" };
  setPart(ui.atk, last.part || "Body");
  return true;
}
function openAttack(att, want) {
  const id = att || actorId();
  const A = ent(id);
  if (!K()) return;
  if (!A) return toast("Nobody is acting right now");
  if (!makeAttack(id, want)) return toast(`${A.name} has no weapon. Press E to edit.`);
  ui.focus = "#roll";
  render();
}
function atkView() {
  const a = ui.atk;
  const A = ent(a.att),
    T = a.tgt ? ent(a.tgt) : null;
  if (!A) return null;
  const c = ctx();
  const dA0 = der(A);
  const slot = A.weapons[a.w] || A.weapons[0];
  const range = T ? rangeOf(A.id, T.id) : 1;
  const k = K();
  const round = k ? k.round : 1;
  const myO = (E.get(c, slot && slot.n) || { o: {} }).o;
  const dT0 = T ? der(T) : dA0;
  const tSlot = T && (T.weapons || [])[T.activeW || 0];
  const tO = tSlot ? (E.get(c, tSlot.n) || { o: {} }).o : {};
  // Everything a condition can ask about this shot. Each side's rules are checked here, so "vs robots" and "first turn" just work.
  const inCover = (S.scene.objects || []).some((o) => {
    const t = E.coverTier(o, S.rules);
    const p = posOf(A.id);
    return t !== "open" && Math.abs(p.x - o.x) <= (o.w || 1) / 2 + 2 && Math.abs(p.y - o.y) <= (o.h || 1) / 2 + 2;
  });
  // What the app has been counting this fight: moves, hits taken, kills, hits in a row. Rules read these so nobody has to track them.
  const cbA = cbOf(A.id) || {};
  const tier = (e, n) => ((e && e.statuses) || []).filter((x) => x.n === n).reduce((t, x) => t + (x.tier || 1), 0);
  const streak = k && k.streak && k.streak[A.id] && k.streak[A.id].tgt === a.tgt ? k.streak[A.id].n : 0;
  const dA = E.forShot(
    dA0,
    A,
    {
      o: myO,
      vs: E.enemyType(T, S.rules),
      targetMob: !!(T && T.mob),
      round,
      sneak: !!k && k.phase === "stealth",
      mode: a.mode,
      magFull: !!slot && !!myO.mag && slot.mag >= myO.mag,
      inCover,
      targetMelee: tO.tab === "MW",
      sameTarget: !!k && (k.last[A.id] || {}).tgt === a.tgt,
      range,
      part: a.loc,
      moved: !!cbA.moved,
      still: cbA.still || 0,
      afterCrit: !!cbA.critThisFight,
      hitsTaken: cbA.hitsTaken || 0,
      killsHuman: cbA.killsHuman || 0,
      afraid: tier(A, "Afraid"),
      targetBleed: tier(T, "Bleeding"),
      targetDebuffs: ["Bleeding", "Afraid"].reduce((t, n) => t + tier(T, n), 0) + tier(T, "Injured Limb (Leg/Arm)"),
      streak,
      hpHigher: !!T && (A.hp || 0) > (T.hp || 0),
    },
    c,
  );
  dA.m.luckyDigit = A.luckyDigit != null ? A.luckyDigit : 7;
  dA.m.vengeNow = !!(dA.m.vengeful && cbA.gotCrit);
  const dT = T ? E.forShot(dT0, T, { o: tO, round, attackerO: myO, attackerMob: !!A.mob, range, part: a.loc }, c) : dA;
  // Pack Animals: allies close to someone with the perk are harder to hit.
  if (T && sideOf(T.id) === "pc" && sideOf(A.id) !== "pc")
    for (const pc of S.chars)
      if (pc.id !== T.id && der(pc).m.auraEnemyAcc && dist(posOf(pc.id), posOf(T.id)) <= S.rules.bandMeters[0] * 2) {
        dT.m = { ...dT.m, enemyAcc: (dT.m.enemyAcc || 0) + der(pc).m.auraEnemyAcc };
        break;
      }
  const v = E.weaponView(slot, A, dA, c, a.mode);
  if (dA.m.critPerRange) v.crit = E.fix(v.crit * range); // Sharpshooter
  // Cover is a flag on every shot, from the line between the two of them. OVR can set it by hand.
  const lc = T ? lineCoverNow(posOf(A.id), posOf(T.id)) : { tier: "open", n: "Open", hit: 0, dam: 0, by: "" };
  const cov = a.ov.cover ? { ...S.rules.cover[a.ov.cover], tier: a.ov.cover, by: "DM set" } : lc;
  const hc = E.hitChance(A, dA, T || A, dT, v, range, c, cov, a.loc);
  const hit = num(a.ov.hit) != null ? num(a.ov.hit) / 100 : hc.hit * (1 + (dA.m.accMul || 0));
  const b = E.bands(hit, v.jam, v.crit, dA.superCrit, { rules: S.rules, lck: dA.sp.L == null ? 5 : dA.sp.L, cond: slot && slot.cond != null ? slot.cond : 10 });
  // Super Crit Roll and Super Fail Roll widen those bands by that many numbers on the dice.
  if (dA.m.superRoll) b.superAt = E.fix(b.superAt - dA.m.superRoll);
  if (dA.m.failRoll) b.jamAt = E.fix(b.jamAt + dA.m.failRoll);
  const swap = a.w !== (A.activeW || 0) && !v.punch ? S.rules.swapAP : 0; // fists are always ready, so punching never pays to swap
  const cost = v.ap + swap; // aiming at a part costs no AP (12 Nov)
  const warn = [];
  if (slot && slot.jammed) warn.push(`Jammed. Press J to clear for ${v.clearJam} AP.`);
  if (v.missing) warn.push("This weapon is not in the item data.");
  else if (!v.ok) warn.push("Blank stats in the workbook. Fill them in from the WEAPONS list up top.");
  if (v.noLoad) warn.push("No ammo type chosen, so damage is 0.");
  if (v.usesAmmo && (slot.mag || 0) <= 0) warn.push("Magazine empty. Press R to reload.");
  if (cost > (A.ap || 0) && !a.ov.free) warn.push(`Costs ${cost} AP but only ${A.ap} left. Move on, or tick Free under OVR.`);
  if (hit <= 0 && !hc.noData) warn.push("0% or less to hit.");
  if (v.melee && range > 1 && !dA.m.lunge) warn.push(`Melee at R${range}: only reaches R1 unless a perk says otherwise.`);
  if (v.pellets)
    warn.push(
      `Pellet ammo (${fmt(v.base)}x${v.pellets}) counts as ${S.rules.pelletMode === "each" ? "one roll per pellet" : S.rules.pelletMode === "spread" ? `one hit; up to ${Math.max(1, Math.ceil(v.pellets * E.pelletShare(v, range) * (1 + (S.rules.pelletShareMin ?? 0.5)) - 1e-9))} of ${v.pellets} land at R${range}, more on a better roll` : "one combined hit"}. Change in Settings.`,
    );
  return { a, A, T, dA, dT, slot, v, range, hc, hit, b, cost, swap, warn, cov, spans: E.bandSpans(b) };
}
function fire() {
  const a = ui.atk;
  if (!a) return;
  const raw = String(a.roll).trim();
  if (!/^\d{1,2}$/.test(raw)) {
    a.err = "Type the two-dice roll, 00 to 99.";
    ui.focus = "#roll";
    return render();
  }
  const p = atkView();
  if (!p.T) {
    a.err = "Pick a target first (T).";
    return render();
  }
  if (!p.slot) {
    a.err = `${p.A.name} has no weapon to attack with.`;
    return render();
  }
  if (p.slot.jammed) {
    a.err = `Jammed. Press J to clear for ${p.v.clearJam} AP first.`;
    return render();
  }
  if (p.v.usesAmmo && (p.slot.mag || 0) <= 0) {
    a.err = "Empty magazine. Press R to reload.";
    return render();
  }
  if (p.hc.noData && num(a.ov.hit) == null) {
    a.err = "No hit data at this range. Enter a Hit % under Overrides or fill in the weapon in the WEAPONS list.";
    return render();
  }
  if (p.dA.m.noEW && p.v.tab === "EW") {
    a.err = `${p.A.name} can't use energy weapons.`;
    ui.focus = "#roll";
    return render();
  }
  if (p.cost > (p.A.ap || 0) && !a.ov.free && fightPhase()) {
    a.err = `Not enough AP: this costs ${p.cost}, ${p.A.name} has ${fmt(p.A.ap)}.`;
    ui.focus = "#roll";
    return render();
  }
  if (p.v.thrown && p.A.kind === "pc" && !(p.A.inv || []).some((x) => E.low(x.n) === E.low(p.v.n))) {
    a.err = `${p.A.name} has no ${p.v.n} left to throw.`;
    ui.focus = "#roll";
    return render();
  }
  const roll = Number(raw);
  act(`Attack: ${p.A.name} → ${p.T.name}`, () => {
    const { A, T, v, slot, b, dT } = p;
    const args = {
      v,
      b,
      roll,
      dt: dT.dt,
      floor: E.floorOf(T, ctx()),
      loc: a.loc,
      range: p.range,
      rules: S.rules,
      available: v.usesAmmo ? Math.floor((slot.mag || 0) / (v.perShot || 1)) : null,
      bulletsOv: num(a.ov.bullets),
      damageOv: num(a.ov.dmg),
      mult: Math.max(0, (1 + (p.cov.dam || 0)) * (1 + (dT.m.dmgTaken || 0))),
      shot: p.dA.m,
      taken: dT.m,
    };
    const res = E.resolve(args);
    const jammed = res.outcome === "jam";
    const crit = res.outcome === "crit" || res.outcome === "super";
    // Familiarity: rounds fired with this weapon (a swing is 1), a crit counts famCritMul times.
    const fired = jammed ? 0 : v.usesAmmo ? Math.min(slot.mag || 0, v.count * (v.perShot || 1)) : 1; // a short magazine fires what it has
    if (fired) {
      A.fam = A.fam || {};
      const fk = E.low(v.n);
      A.fam[fk] = (A.fam[fk] || 0) + fired * (crit ? S.rules.famCritMul || 1 : 1);
    }
    // A hit through cover wears it down: the shot's damage before cover, times that tier's share.
    if (p.cov.id && res.total != null && !jammed && !["miss", "jam"].includes(res.outcome)) {
      const o = S.scene.objects.find((x) => x.id === p.cov.id);
      const open = E.resolve({ ...args, mult: Math.max(0, 1 + (dT.m.dmgTaken || 0)) });
      hurtObj(o, E.fix((open.total || 0) * coverTake(o)), `${A.name}'s shot`);
    }
    if (!a.ov.free) A.ap = Math.max(0, (A.ap || 0) - (jammed && !S.rules.jamSpendsAP ? p.swap : p.cost));
    A.activeW = a.w;
    if (v.punch) A.punches = (A.punches || 0) + 1; // each punch this turn costs more
    let ammoText = "";
    if (jammed) slot.jammed = true;
    else if (v.usesAmmo && !(p.dA.m.critNoAmmo && (res.outcome === "crit" || res.outcome === "super"))) {
      slot.mag = (slot.mag || 0) - Math.min(slot.mag || 0, v.count * (v.perShot || 1));
      ammoText = `${slot.mag}/${v.cap} left`;
    }
    if (v.thrown) {
      const l = (A.inv || []).find((x) => E.low(x.n) === E.low(v.n));
      if (l) {
        l.q--;
        if (l.q <= 0) A.inv = A.inv.filter((x) => x !== l);
      }
    }
    const logStart = S.log.length;
    const wasUp = T.hp > 0;
    const cbT = cbOf(T.id) || {};
    const cbAtk = cbOf(A.id) || {};
    const k2 = K();
    // Keep the counts rules read: hits in a row on one target, hits taken, crits, kills.
    k2.streak = k2.streak || {};
    k2.streak[A.id] = res.total ? { tgt: T.id, n: k2.streak[A.id] && k2.streak[A.id].tgt === T.id ? k2.streak[A.id].n + 1 : 1 } : null;
    if (res.outcome === "crit" || res.outcome === "super") {
      cbAtk.critThisFight = true;
      cbT.gotCrit = true;
    }
    if (p.dA.m.vengeNow) cbAtk.gotCrit = false;
    if (res.total) {
      cbT.hitsTaken = (cbT.hitsTaken || 0) + 1;
      T.hp = Math.max(0, T.hp - res.total);
      syncDown(T, A.id);
      if (dT.m.apOnHit) T.ap = (T.ap || 0) + dT.m.apOnHit; // Masochist
      if (wasUp && T.hp <= 0 && E.enemyType(T, S.rules) === "human") cbAtk.killsHuman = (cbAtk.killsHuman || 0) + 1;
      if (wasUp && T.hp <= 0 && p.dA.m.killAP) {
        const back = Math.floor(p.dA.ap * p.dA.m.killAP);
        A.ap = (A.ap || 0) + back;
        log("status", `${A.name} regains ${back} AP from the kill.`);
      } // Grim Reaper's Sprint
    }
    const NAME = { jam: "JAM", miss: "MISS", hit: "HIT", crit: "CRIT", super: "SUPER CRIT" }[res.outcome];
    const head = `${A.name} → ${T.name} · ${v.n}${v.modeName ? " " + v.modeName : ""} · R${p.range} ${PARTS[a.part][0]}${p.cov.tier !== "open" ? ` · ${p.cov.n}` : ""} · ${fmt(E.pct(p.hit))}% · rolled ${E.two(roll)}`;
    const line =
      `${head}: ${NAME}` +
      (res.total ? ` · ${res.math} · ${T.name} ${T.hp}/${dT.hp}` : jammed ? ` · clear costs ${v.clearJam} AP` : "") +
      (ammoText ? ` · ${ammoText}` : "");
    log(`${res.total ? "hit" : jammed ? "jam" : "miss"} o-${res.outcome}`, line);
    const fx = hitStatuses(res, T, v, a.part, p.dA.m);
    let story = "";
    if (S.rules.storyLog) {
      const ty = E.enemyType(T, S.rules);
      const nm = (e) => (e.kind !== "pc" && / - /.test(e.name) ? e.name.split(" - ").slice(1).join(" - ") : e.name);
      story = E.story(
        {
          a: nm(A),
          t: nm(T),
          w: v,
          ammo: slot.ammo || "",
          d: fmt(res.total),
          n: res.hits || res.bullets || 1,
          part: a.part,
          outcome: res.outcome,
          kind: T.kind === "pc" ? "flesh" : ty === "robot" ? "robot" : ty === "insect" ? "insect" : "flesh",
          statuses: fx.auto.map((x) => x.replace(/\s+\d.*$/, "")),
          killed: wasUp && T.hp <= 0 && T.kind !== "pc",
          downed: wasUp && T.hp <= 0 && T.kind === "pc",
        },
        COMBAT_TEXT,
      );
      // one line in the log: the story, with the numbers, kill and statuses one click away
      const more = S.log.splice(logStart).map((l) => l.x);
      S.log.push({ k: `story o-${res.outcome}`, x: story, r: K().round, id: S.seq++, more });
    }
    K().last[A.id] = { tgt: T.id, mode: a.mode, part: a.part };
    if (K().phase === "stealth" && A.kind === "pc") {
      K().stealthDue = A.id;
      ui.focus = "#stealthRoll";
    }
    {
      const from = { ...posOf(A.id) },
        to = { ...posOf(T.id) };
      const n = jammed || v.melee ? 0 : Math.max(1, Math.min(v.count || 1, fired || v.count || 1));
      const land = Math.min(n, res.bullets || 0);
      const d = dist(from, to) || 0.01,
        aim = Math.atan2(to.y - from.y, to.x - from.x);
      const shots = Array.from({ length: n }, (_, i) => {
        if (i < land) return { x: to.x + (Math.random() - 0.5) * 0.3, y: to.y - 0.25 + (Math.random() - 0.5) * 0.3, hit: true };
        // a miss flies past at an angle that clears the target, and carries on a little beyond it
        const turn = aim + (Math.random() < 0.5 ? -1 : 1) * (Math.atan(1.1 / d) + Math.random() * 0.18),
          len = d * 1.3 + 2;
        return { x: from.x + Math.cos(turn) * len, y: from.y + Math.sin(turn) * len, hit: false };
      });
      for (let i = shots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shots[i], shots[j]] = [shots[j], shots[i]];
      }
      const first = shots.findIndex((x) => x.hit);
      const firstHit = v.melee ? (res.total ? 0 : null) : first < 0 ? null : first * TRACER_GAP + TRACER_MS;
      if (n || firstHit != null) addFx({ type: "shot", a: from, tgt: T.id, shots, firstHit, dur: n * TRACER_GAP + TRACER_MS + 600 });
    }
    a.res = {
      story,
      outcome: res.outcome,
      name: NAME,
      head,
      math: res.math,
      total: res.total,
      auto: fx.auto,
      status: fx.manual,
      tgt: T.id,
      tName: T.name,
      hp: T.hp,
      max: dT.hp,
      ammoText,
      radius: v.radius,
    };
    a.roll = "";
    a.ov = {};
    a.err = "";
    if (cbOf(T.id) && !alive(cbOf(T.id))) {
      const nx = targetsFor(A.id).find((id) => sideOf(id) !== sideOf(A.id) && !ent(id).dbno);
      if (nx) a.tgt = nx;
    }
    if (K().phase !== "stealth") ui.focus = "#roll";
  });
  const shown = document.querySelector(".result");
  if (shown) shown.scrollIntoView({ block: "nearest" });
}
// ---------- automated turn (12 Nov). One standard way of playing for every enemy and ally; dispositions can come later.
// Auto plans the turn without changing anything, shows it on the map and in the turn panel, and Confirm plays it with real dice
// as one undo step and one combat log entry, then ends the turn. Thresholds are in rules.autoTurn.
var actBatch = 0; // while above 0, act() runs its change inside the surrounding one: a whole automated turn is one undo step
const autoRules = () => ({ healBelow: 0.4, bleedAt: 2, shootAt: 0.25, minShot: 0.1, maxAttacks: 3, ...(S.rules.autoTurn || {}) });
// The attack panel's own numbers for this shooter, target and weapon, as if the shooter stood at `at`. Nothing is changed.
function autoEval(id, tgt, w, at) {
  const k = K(),
    c = cbOf(id),
    keep = { x: c.x, y: c.y },
    atk = ui.atk,
    ranges = k.ranges;
  try {
    if (at) {
      c.x = at.x;
      c.y = at.y;
      k.ranges = Object.fromEntries(Object.entries(ranges).filter(([key]) => !key.split("|").includes(id))); // a DM-set range no longer applies once they move
    }
    ui.atk = { att: id, tgt, w, mode: "pr", roll: "", ov: {}, res: null, err: "" };
    setPart(ui.atk, "Body");
    const p = atkView();
    if (!p || p.hc.noData || (p.v.melee && p.range > 1 && !p.dA.m.lunge) || !p.v.ok || p.v.noLoad) return null;
    const per = (p.v.base || 0) * (p.v.pellets || 1) * Math.max(1, p.v.count || 1);
    return { hit: Math.max(0, p.hit), cost: p.cost, value: Math.max(0, p.hit) * per, v: p.v, slot: p.slot, range: p.range };
  } finally {
    c.x = keep.x;
    c.y = keep.y;
    k.ranges = ranges;
    ui.atk = atk;
  }
}
// Where to stand: on the line to the target, at the middle of the weapon's best range band (melee: next to them), as far as AP allows.
function autoSpot(e, tgt, v, budget) {
  const A = posOf(e.id),
    T = posOf(tgt);
  const d = dist(A, T);
  const bm = S.rules.bandMeters;
  let best = 1,
    bh = -Infinity;
  if (!v.melee)
    for (let r = 1; r <= bm.length; r++) {
      const x = v.hitBase(r);
      if (typeof x === "number" && x > bh) (bh = x), (best = r);
    }
  const want = v.melee ? Math.min(bm[0] * 0.6, 1.2) : best === 1 ? bm[0] * 0.6 : (bm[best - 2] + bm[best - 1]) / 2;
  if (d <= want + 0.3) return null; // close enough already: no backing off
  const goal = { x: T.x + ((A.x - T.x) / d) * want, y: T.y + ((A.y - T.y) / d) * want };
  const side = { x: -(goal.y - A.y) / d, y: (goal.x - A.x) / d }; // a step to either side, when the straight line is blocked
  for (const f of [1, 0.85, 0.7, 0.55, 0.4, 0.25, 0.12])
    for (const off of [0, 1.5, -1.5, 3, -3]) {
      const p = inMap({ x: E.fix(A.x + (goal.x - A.x) * f + side.x * off), y: E.fix(A.y + (goal.y - A.y) * f + side.y * off) });
      const cost = moveCost(A, p, e);
      if (cost > budget || cost === Infinity) continue;
      if (E.pathBlocked(A, p, S.scene.objects) || standBlocked(p)) continue;
      return { x: p.x, y: p.y, cost, m: E.fix(dist(A, p)) };
    }
  return null;
}
function planTurn(id) {
  const e = ent(id);
  const k = K();
  if (!e || !k || e.dbno) return null;
  const R = autoRules();
  const d = der(e);
  let ap = e.ap || 0;
  const steps = [],
    say = [];
  // 1. patch up: a healing item when badly hurt, something for bleeding when it's bad
  const bleed = (e.statuses || []).find((s) => s.n === "Bleeding");
  const useable = (pred) =>
    (e.inv || [])
      .map((l, i) => ({ l, i, it: E.get(ctx(), l.n) }))
      .find((x) => x.it && x.it.cat === "item" && usable(x.it.o) && pred(x.it.o) && (x.it.o.ap || 0) <= ap);
  const need = [];
  if (bleed && bleed.tier >= R.bleedAt) need.push((o) => o.cat === "Counter" && /bleed/i.test(o.effect || ""));
  if (e.hp < d.hp * R.healBelow) need.push((o) => o.cat === "Healing");
  for (const pred of need) {
    const x = useable(pred);
    if (x && !steps.some((s) => s.t === "use" && s.i === x.i)) {
      steps.push({ t: "use", i: x.i, n: x.l.n });
      ap -= x.it.o.ap || 0;
      say.push(`use ${x.l.n}`);
    }
  }
  // 2. the best shot from here: every weapon against every target still standing on the other side
  const foesOf = targetsFor(id).filter((t) => sideOf(t) !== sideOf(id) && !ent(t).dbno);
  const options = [];
  for (const t of foesOf)
    (e.weapons || []).forEach((s, w) => {
      if (s.jammed) return;
      const here = autoEval(id, t, w);
      const vv = here ? here.v : E.weaponView(s, e, d, ctx());
      options.push({ t, w, here, v: vv });
    });
  if (!options.length) return { id, steps, say: say.length ? say : ["nothing to shoot at"], tgt: null };
  options.sort((a, b) => (b.here ? b.here.value : 0) - (a.here ? a.here.value : 0) || dist(posOf(id), posOf(a.t)) - dist(posOf(id), posOf(b.t)));
  let pick = options[0];
  let at = null,
    shot = pick.here;
  // 3. too far for a decent shot: walk toward the weapon's best range, keeping enough AP for one attack
  if (!shot || shot.hit < R.shootAt) {
    const nearest = [...options].sort((a, b) => dist(posOf(id), posOf(a.t)) - dist(posOf(id), posOf(b.t)))[0];
    const cand = shot ? pick : nearest;
    const cost1 = shot ? shot.cost : Math.max(1, cand.v.ap || 1);
    let spot = autoSpot(e, cand.t, cand.v, Math.max(0, ap - cost1)),
      there = spot && autoEval(id, cand.t, cand.w, spot);
    // still no usable shot from there: spend the whole turn walking in instead of saving AP for a shot that can't land
    if (!there || there.hit < R.minShot) {
      const far = autoSpot(e, cand.t, cand.v, ap);
      if (far) (spot = far), (there = autoEval(id, cand.t, cand.w, far));
    }
    if (spot) {
      if (!shot || shot.hit < R.minShot || (there && there.hit > shot.hit + 0.05)) {
        at = spot;
        pick = cand;
        shot = there;
        ap -= spot.cost;
        steps.push({ t: "move", x: spot.x, y: spot.y, cost: spot.cost, m: Math.round(spot.m), to: ent(cand.t).name });
        say.push(`move ${Math.round(spot.m)} m toward ${ent(cand.t).name}`);
      }
    }
  }
  // 4. reload an empty gun if there's ammo and AP for it, then attack while it's worth it
  if (shot && shot.hit >= R.minShot) {
    const slot = e.weapons[pick.w];
    const v = shot.v;
    let mag = slot.mag || 0;
    if (v.usesAmmo && mag < (v.perShot || 1) && ammoHeld(e, v.reserve) > 0 && ap >= v.reload + shot.cost) {
      steps.push({ t: "reload", w: pick.w });
      ap -= v.reload;
      mag = Math.min(v.cap, ammoHeld(e, v.reserve));
      say.push(`reload`);
    }
    let n = 0;
    while (n < R.maxAttacks && ap >= shot.cost && (!v.usesAmmo || mag >= (v.perShot || 1) * (v.count || 1) || (mag > 0 && n === 0))) {
      n++;
      ap -= shot.cost;
      if (v.usesAmmo) mag -= (v.perShot || 1) * (v.count || 1);
    }
    if (n) {
      steps.push({ t: "attack", tgt: pick.t, w: pick.w, n });
      say.push(
        `${v.melee ? "attack" : "shoot"} ${ent(pick.t).name} ${n === 1 ? "once" : n === 2 ? "twice" : n + " times"} with ${v.n} (${Math.round(shot.hit * 100)}%)`,
      );
    }
  }
  if (!steps.length) say.push("hold: no worthwhile shot or move");
  return { id, steps, say, tgt: pick.t, at, k: k.round };
}
function autoBox(A) {
  const p = ui.autoPlan;
  if (!p || p.id !== A.id) return "";
  return `<div class="autoplan"><div class="s"><b>AUTO TURN</b> ${h(A.name)} will ${h(p.say.join(", then "))}.</div><div class="acts">${btn("autoConfirm", "", "Confirm", "Enter", "primary tiny")}${btn("autoCancel", "", "Cancel", "Esc", "tiny")}<span class="s dim">Dice are rolled when you confirm. The turn then ends.</span></div></div>`;
}
const AUTO_ACT = {
  autoPlan() {
    const id = actorId();
    if (!id || ent(id).kind === "pc") return;
    ui.autoPlan = planTurn(id);
    ui.pendingMove = null;
    ui.autoScroll = true; // the plan sits at the top of the turn panel: bring it into view
    ui.focus = null; // and don't jump down to the roll box, or back to it
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    render();
  },
  autoCancel() {
    ui.autoPlan = null;
    render();
  },
  autoConfirm() {
    const p = ui.autoPlan;
    ui.autoPlan = null;
    if (!p || p.id !== actorId()) return render();
    const e = ent(p.id),
      c = cbOf(p.id),
      k = K();
    act(`Auto turn: ${e.name}`, () => {
      actBatch++;
      const start = S.log.length;
      const did = [];
      try {
        for (const s of p.steps) {
          if (s.t === "use") {
            const l = (e.inv || [])[s.i];
            const i = l && E.low(l.n) === E.low(s.n) ? s.i : (e.inv || []).findIndex((x) => E.low(x.n) === E.low(s.n));
            if (i < 0) continue;
            const keep = ui.modal;
            ACT.useSelf(`${e.id}|${i}`);
            ui.modal = keep;
            did.push(`uses ${s.n}`);
          } else if (s.t === "move") {
            c.x = s.x;
            c.y = s.y;
            for (const key of Object.keys(k.ranges)) if (key.split("|").includes(e.id)) delete k.ranges[key];
            e.ap = Math.max(0, (e.ap || 0) - s.cost);
            c.moved = true;
            touchObjects(e.id);
            did.push(`moves ${s.m} m toward ${s.to}`);
          } else if (s.t === "reload") {
            reloadWeapon(e.id, s.w);
            did.push("reloads");
          } else if (s.t === "attack") {
            for (let i = 0; i < s.n; i++) {
              const T = ent(s.tgt);
              if (!T || T.hp <= 0 || T.dbno || !alive(cbOf(s.tgt))) break;
              makeAttack(e.id, s.tgt);
              ui.atk.w = s.w;
              setPart(ui.atk, "Body");
              ui.atk.roll = String(Math.floor(Math.random() * 100)).padStart(2, "0");
              const before = S.log.length;
              fire();
              if (S.log.length === before) break; // the attack was refused (no AP, no ammo): stop there
            }
          }
        }
        // the whole turn as one combat log line; every detail one click away
        const lines = S.log.splice(start);
        const stories = lines.filter((l) => /^story/.test(l.k)).map((l) => l.x);
        const more = lines.flatMap((l) => [l.x, ...(l.more || [])]);
        const opener = did;
        const text =
          `${e.name} ${opener.length ? opener.join(", ") + (stories.length ? ". " : ".") : ""}${stories.join(" ") || (opener.length ? "" : "holds position.")}`.trim();
        S.log.push({ k: `story auto`, x: text, r: k.round, id: S.seq++, more });
        ui.atk = null;
        nextTurn();
      } finally {
        actBatch--;
      }
    });
  },
};
// Applies status effects from a hit: crits by body part, and whatever the weapon's Status column says. Undo takes them back with the attack.
function hitStatuses(res, T, v, part, shot = {}) {
  const out = { auto: [], manual: null };
  const r = S.rules;
  if (!res.total || T.hp <= 0) return out;
  const give = (name, tier, why, limb) => {
    const canon = db.status.get(E.low(name)).n;
    const cur = (T.statuses || []).find((x) => x.n === canon);
    keepFull(T, () => addStatus(T, canon, Math.max(tier, cur ? cur.tier : 0)));
    const st = (T.statuses || []).find((x) => x.n === canon);
    if (!st) return;
    if (limb) st.parts = [...new Set([...(st.parts || []), limb])];
    const text = `${canon} ${st.tier}${limb ? " (" + PARTS[limb][0].toLowerCase() + ")" : ""}`;
    out.auto.push(text);
    log("status", `${T.name} gains ${text}: ${why}.`);
  };
  if (r.autoStatus && (res.outcome === "crit" || res.outcome === "super")) {
    const limb = PARTS[part][1] === "Limb" ? part : null;
    const name = r.critStatus[limb ? (/Leg/.test(part) ? "Leg" : "Arm") : part];
    if (name && db.status.has(E.low(name)))
      give(
        name,
        r.critTier[res.outcome === "super" ? "Super" : "Crit"],
        `${res.outcome === "super" ? "super crit" : "crit"} to the ${PARTS[part][0].toLowerCase()}`,
        limb,
      );
  }
  const crit = res.outcome === "crit" || res.outcome === "super";
  if (crit && shot.critKnock && db.status.has("knocked out")) give("Knocked Out", 1, "crit with a perk"); // Hammertime
  if (shot.hitBleed && db.status.has("bleeding")) give("Bleeding", shot.hitBleed, "perk"); // Close n Personal
  if (crit && shot.critDisorient && db.status.has("disoriented")) give("Disoriented", shot.critDisorient, "perk"); // Forced Slumber
  if (crit && shot.critLimb) give("Injured Limb (Leg/Arm)", 1, "perk", ["LArm", "RArm", "LLeg", "RLeg"][Math.floor(Math.random() * 4)]);
  if (crit && shot.critBleed && db.status.has("bleeding")) give("Bleeding", shot.critBleed, "crit with a perk"); // Shrapnel
  const kb = r.knifeBleed;
  if (crit && kb && kb.match && db.status.has("bleeding") && new RegExp(kb.match, "i").test(v.n))
    give("Bleeding", res.outcome === "super" ? kb.super : kb.crit, `${res.outcome === "super" ? "super crit" : "crit"} with a ${v.n}`);
  if (shot.knockChance && db.status.has("knocked out") && Math.random() < shot.knockChance)
    give("Knocked Out", 1, `${E.pct(shot.knockChance)}% knockdown chance`); // Super Slam
  if (r.autoWeaponStatus && v.status) {
    const w = (E.get(ctx(), v.n) || { o: {} }).o;
    const chances = String(w.dotCh || "").split(",");
    String(v.status)
      .split(",")
      .forEach((raw, i) => {
        const m = /^\s*(crit;\s*)?([^()+]+?)\s*(?:\((\d+)%\))?\s*(?:\+(\d+))?\s*$/i.exec(raw);
        if (!m) return;
        if (m[1] && res.outcome !== "crit" && res.outcome !== "super") return;
        const col = /(\d+)%\s*\/\s*(\d+)/.exec(chances[i] || "");
        const name = db.status.has(E.low(m[2])) ? m[2] : (DATA.statuses.find((x) => E.low(x.n).startsWith(E.low(m[2]).slice(0, 5))) || {}).n;
        if (!name) {
          out.manual = m[2];
          return;
        }
        const chance = Number(m[3] || (col && col[1]) || 100) * (1 + (shot.debuffCh || 0)) + (shot.debuffAdd || 0),
          tier = Number(m[4] || (col && col[2]) || 1);
        const roll = Math.floor(Math.random() * 100);
        if (roll < chance) give(name, tier, `${v.n}${chance < 100 ? `, ${chance}% chance, rolled ${roll}` : ""}`);
        else log("status", `${T.name} avoids ${name} from ${v.n} (${chance}% chance, rolled ${roll}).`);
      });
  } else if (v.status) out.manual = v.status;
  return out;
}
const cycle = (list, cur, dir = 1) => list[(list.indexOf(cur) + dir + list.length) % list.length];
// Only ammo the character is carrying, plus whatever is already loaded.
function loadsHeld(e, v, slot) {
  const inv = (e.inv || []).map((l) => E.low(l.n));
  return (v.caliber ? E.loadsFor(ctx(), v.caliber) : []).filter((a) => inv.includes(E.low(a.n)) || (slot && a.n === slot.ammo));
}
// Launchers list a family ("Rocket") and the pack holds a load ("Rocket - Junk").
const ammoLine = (e, name) => {
  const n = E.low(name);
  return (e.inv || []).find((l) => E.low(l.n) === n) || (e.inv || []).find((l) => n && E.low(l.n).startsWith(n + " - "));
};
const ammoHeld = (e, name) => (ammoLine(e, name) || { q: 0 }).q;
function reloadWeapon(id, idx) {
  const e = ent(id);
  const i = idx != null ? idx : e.activeW || 0;
  const slot = e.weapons[i];
  const v = E.weaponView(slot, e, der(e), ctx());
  if (!v.usesAmmo) return toast(`${v.n} doesn't reload.`);
  if ((slot.mag || 0) >= v.cap) return toast("Magazine is already full.");
  if (!canPay(e, v.reload, "reload")) return;
  const line = ammoLine(e, v.reserve);
  if (!line) return toast(`No ${v.reserve || "ammo"} in ${e.name}'s inventory.`);
  act(`Reload: ${e.name}`, () => {
    const need = v.cap - (slot.mag || 0);
    const took = Math.min(need, line.q);
    line.q -= took;
    if (line.q <= 0) e.inv = e.inv.filter((x) => x !== line);
    slot.mag = (slot.mag || 0) + took;
    if (S.combat) e.ap = Math.max(0, (e.ap || 0) - v.reload);
    log("status", `${e.name} reloads ${v.n}: ${slot.mag}/${v.cap}${S.combat ? `, ${v.reload} AP` : ""}.`);
    if (S.combat && K().phase === "stealth") K().stealthDue = e.id;
  });
}
function clearJam(id, idx) {
  const e = ent(id);
  const i = idx != null ? idx : ui.atk && ui.atk.att === id ? ui.atk.w : e.activeW || 0;
  const slot = e.weapons[i];
  if (!slot || !slot.jammed) {
    const any = e.weapons.findIndex((s) => s.jammed);
    if (any < 0) return toast("No jammed weapon.");
    return clearJam(id, any);
  }
  const v = E.weaponView(slot, e, der(e), ctx());
  if (!canPay(e, v.clearJam, "clear the jam")) return;
  act(`Clear jam: ${e.name}`, () => {
    slot.jammed = false;
    if (S.combat) e.ap = Math.max(0, (e.ap || 0) - v.clearJam);
    log("status", `${e.name} clears ${v.n}${S.combat ? `, ${v.clearJam} AP. ${e.ap} left.` : "."}`);
  });
}
function reqMet(req, d) {
  if (!req) return true;
  const key = { STR: "S", PER: "P", END: "E", CHA: "C", INT: "I", AGL: "A", AGI: "A", LCK: "L" };
  const skillBy = Object.fromEntries(E.SKILLS.map(([k, n]) => [n.toLowerCase(), k]));
  for (const m of String(req).matchAll(/(\d+)\+?\s*([A-Za-z][A-Za-z ]*?)(?=,|\s+\d|$)/g)) {
    const need = Number(m[1]),
      w = m[2].trim();
    const val = key[w.toUpperCase()] ? d.sp[key[w.toUpperCase()]] : skillBy[w.toLowerCase()] ? d.skills[skillBy[w.toLowerCase()]] : null;
    if (val != null && val < need) return false;
  }
  return true;
}
const ABBR = { BAR: "BA", EW: "EW", EXP: "EX", SG: "SG", BG: "BG", LPK: "LP", MED: "ME", MW: "MW", REP: "RE", SCI: "SC", SNK: "SN", SPE: "SP", SUR: "SU" };
const canLevel = (e) => !S.combat && E.levelForXp(e.xp || 0, S.rules) > (e.level || 1);
