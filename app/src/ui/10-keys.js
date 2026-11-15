// ===== 10-keys.js: HOTKEYS (14 Nov). Every shortcut in one list: what it does, where it works, its default key. The DM can change
// any of them in the Keys window (?); changes live in S.hotkeys (only the ones that differ from the default) and are saved with the
// campaign. A key is "A", "Shift+Q", "Ctrl+Z", or two keys one after the other, "G S" (the menus: press G, then the letter).
// Esc, Enter, Tab and the digits for rolls are fixed: they are how every box and window works.

// Where a key works. Earlier scopes win when the same key is free in two of them (moving with the keys, then a held map object, ...).
const HK_SCOPES = {
  km: () => !!ui.keyMove && !ui.modal,
  obj: () => !ui.modal && (!!ui.mapSel || !!(drag && drag.kind === "map" && drag.obj)),
  atk: () => !ui.modal && !!ui.atk && !!K(),
  turn: () => !ui.modal && !!K() && !["end", "defeat"].includes(K().phase),
  idle: () => !ui.modal && !K(),
  all: () => !ui.modal,
  menu: () => true, // the menus open from anywhere, a window included
};
const selId = () => (K() ? ui.rowSel || actorId() : ui.rowSel && ent(ui.rowSel) ? ui.rowSel : ui.sel);
const openSel = (s) => () => {
  const id = selId();
  if (ent(id)) ACT.openChar(`${id}|${s}`);
};
const atkStep = (fn) => () => {
  fn(ui.atk, ent(ui.atk.att));
  ui.atk.err = "";
  ui.focus = "#roll";
  render();
};
const rotate = (dir) => (e) => {
  const step = dir * (e && e.shiftKey ? 5 : 15);
  if (drag && drag.kind === "map" && drag.obj) {
    const o = S.scene.objects.find((x) => x.id === drag.obj);
    if (!o) return;
    drag.angle = ((((drag.angle != null ? drag.angle : o.angle || 0) + step) % 360) + 360) % 360;
    const gly = drag.g.querySelector(".gly:not(.trunk)");
    if (gly && drag.base == null) drag.base = (gly.getAttribute("transform") || "").replace(/^rotate\([^)]*\)\s*/, "");
    if (gly) gly.setAttribute("transform", `rotate(${drag.angle}) ${drag.base}`);
  } else ACT.objRotate(step);
};
const kmStep = (fn) => () => {
  fn(ui.keyMove);
  keyMovePlan();
  render();
};
const menu = (v) => () => ACT.railGo(v);
// [id, group, what it does, default key, scope, run, shiftToo: Shift+key does it too (finer steps)]
const HOTKEYS = [
  ["kmLeft", "Moving with the keys (after M)", "Turn left 15°", "A", "km", kmStep((km) => (km.ang = (km.ang + 345) % 360))],
  ["kmRight", "Moving with the keys (after M)", "Turn right 15°", "D", "km", kmStep((km) => (km.ang = (km.ang + 15) % 360))],
  ["kmMore", "Moving with the keys (after M)", "1 AP farther", "W", "km", kmStep((km) => (km.steps = clamp(km.steps + 1, 0, Math.max(0, ent(km.id).ap || 0))))],
  ["kmLess", "Moving with the keys (after M)", "1 AP shorter", "S", "km", kmStep((km) => (km.steps = clamp(km.steps - 1, 0, Math.max(0, ent(km.id).ap || 0))))],
  ["rotL", "Selected map object", "Turn it counter-clockwise 15° (with Shift: 5°)", "Q", "obj", rotate(-1), true],
  ["rotR", "Selected map object", "Turn it clockwise 15° (with Shift: 5°)", "E", "obj", rotate(1), true],
  ["objDel", "Selected map object", "Remove it", "Delete", "obj", () => ui.mapSel && ACT.objDel(ui.mapSel)],
  ["nextW", "Attack menu", "Next weapon", "W", "atk", atkStep((a, A) => ((a.w = (a.w + 1) % A.weapons.length), (a.mode = "pr")))],
  [
    "nextT",
    "Attack menu",
    "Next target",
    "T",
    "atk",
    atkStep((a) => {
      const ts = targetsFor(a.att);
      if (ts.length) a.tgt = cycle(ts, a.tgt, 1);
    }),
  ],
  ["nextPart", "Attack menu", "Next body part: head, body, arms, legs, weapon", "P", "atk", atkStep((a) => setPart(a, cycle(Object.keys(PARTS), a.part, 1)))],
  ["ovr", "Attack menu", "Overrides: hit %, bullets, damage, cover", "O", "atk", () => ACT.atkOvToggle()],
  ["attack", "On a turn", "Attack: last target, weapon and body part", "A", "turn", () => ACT.attack()],
  ["move", "On a turn", "Move with the keys", "M", "turn", () => ACT.keyMoveStart()],
  ["reload", "On a turn", "Reload", "R", "turn", () => ACT.reload()],
  ["swap", "On a turn", "Swap weapons", "S", "turn", () => ACT.swap()],
  ["unjam", "On a turn", "Clear a jam, or pick up a dropped weapon", "J", "turn", () => ACT.clearJamBtn()],
  ["item", "On a turn", "Use an item", "I", "turn", () => ACT.itemModal()],
  ["status", "On a turn", "Statuses of whoever is acting", "X", "turn", () => ACT.statusModal()],
  ["revive", "On a turn", "Revive a downed character", "V", "turn", () => ACT.reviveChk()],
  ["next", "On a turn", "End turn", "N", "turn", () => ACT.next()],
  ["endFight", "On a turn", "End the fight (once every enemy is down)", "Q", "turn", () => !npcsAlive() && ACT.endCombat()],
  ["defeat", "On a turn", "Defeat (once the whole party is down)", "D", "turn", () => !partyUp() && ACT.defeat()],
  ["begin", "Out of combat", "Set up an encounter, then begin it", "B", "idle", () => ACT.beginC("")],
  ["inv", "Out of combat", "Inventory of the selected character", "I", "idle", openSel("inv")],
  ["prevChar", "Out of combat", "Previous character", "Left", "idle", () => pickCard(-1)],
  ["nextChar", "Out of combat", "Next character", "Right", "idle", () => pickCard(1)],
  ["undo", "Everywhere", "Undo", "Ctrl+Z", "all", () => undo()],
  ["redo", "Everywhere", "Redo", "Ctrl+Y", "all", () => redo()],
  ["save", "Everywhere", "Save", "Ctrl+S", "menu", () => ACT.saveNow()],
  ["search", "Everywhere", "Search everything", "/", "all", () => ACT.search()],
  ["keys", "Everywhere", "Keys: this list", "?", "all", () => ACT.help()],
  ["log", "Everywhere", "Open or close the log", "L", "all", () => ACT.toggleLog()],
  ["check", "Everywhere", "Skill check", "K", "all", () => ACT.check()],
  ["edit", "Everywhere", "Edit the selected character", "E", "all", () => ACT.edit()],
  ["sheet", "Everywhere", "Character sheet of the selected character", "C", "all", openSel("sheet")],
  ["health", "Everywhere", "Health of the selected character", "H", "all", openSel("health")],
  ["mSettings", "Menus (two keys: G, then the letter)", "Settings: game rules", "G S", "menu", menu("settings")],
  ["mItems", "Menus (two keys: G, then the letter)", "Item browser", "G I", "menu", menu("items")],
  ["mNotes", "Menus (two keys: G, then the letter)", "Notes", "G N", "menu", menu("notes")],
  ["mVendor", "Menus (two keys: G, then the letter)", "Vendor", "G V", "menu", menu("vendor")],
  ["mSkill", "Menus (two keys: G, then the letter)", "Skill tree", "G K", "menu", menu("skillTree")],
  ["mPerks", "Menus (two keys: G, then the letter)", "Level perks", "G P", "menu", menu("levelPerks")],
  ["mFactions", "Menus (two keys: G, then the letter)", "Factions", "G F", "menu", menu("factions")],
  ["mWiki", "Menus (two keys: G, then the letter)", "Wiki: the game bible", "G W", "menu", menu("wiki")],
  ["mLoad", "Menus (two keys: G, then the letter)", "Load a save", "G L", "menu", menu("loadWin")],
  ["mAuto", "Menus (two keys: G, then the letter)", "Autosave", "G A", "menu", menu("autoWin")],
  ["mSize", "Menus (two keys: G, then the letter)", "UI size", "G U", "menu", menu("uiScale")],
  ["mGuide", "Menus (two keys: G, then the letter)", "How to use this", "G H", "menu", menu("guide")],
  ["mChanges", "Menus (two keys: G, then the letter)", "Changelog", "G C", "menu", menu("changelog")],
  ["mMap", "Menus (two keys: G, then the letter)", "Map creator", "G M", "menu", () => ACT.mmOpen()],
  ["mSetup", "Menus (two keys: G, then the letter)", "Encounter setup (out of combat)", "G E", "menu", () => !K() && ACT.setupOpen("1")],
  ["mParty", "Menus (two keys: G, then the letter)", "Party-wide: act on the whole party", "G G", "menu", () => ACT.pwOpen("party")],
  ["mFoes", "Menus (two keys: G, then the letter)", "All enemies: act on every enemy", "G O", "menu", () => ACT.pwOpen("enemies")],
  ["mNew", "Menus (two keys: G, then the letter)", "New campaign", "G Shift+N", "menu", menu("newc")],
];
const HK_BY_ID = Object.fromEntries(HOTKEYS.map((x) => [x[0], x]));
// Shown, not changeable: how boxes and windows work, and the mouse.
const HK_FIXED = [
  ["Esc", "Close a window, leave a box, or stop moving"],
  ["Enter", "Confirm; in the attack menu, resolve the roll"],
  ["Tab", "Next field, kept inside an open window"],
  ["0-9", "Type the roll. In Move, the distance; in Use item, which item"],
  ["Up / Down", "In Search, go through the results"],
  ["Drag", "Move the acting character (costs AP)"],
  ["Shift+drag", "Reposition anyone for free"],
  ["Click", "Select. On a turn, clicking an enemy attacks it"],
  ["Right-click", "Remove cover or a marker"],
  ["Wheel / pinch", "Zoom the map"],
];
const keyOf = (id) => (S.hotkeys && S.hotkeys[id] != null ? S.hotkeys[id] : (HK_BY_ID[id] || [])[3] || "");
const hk = (id) => keyOf(id).replace(" ", " then ") || "none";
const HK_NAMES = {
  " ": "Space",
  arrowleft: "Left",
  arrowright: "Right",
  arrowup: "Up",
  arrowdown: "Down",
  escape: "Esc",
  enter: "Enter",
  delete: "Delete",
  backspace: "Backspace",
  tab: "Tab",
};
/** The key pressed, written the way bindings are: "A", "Shift+Q", "Ctrl+Z", "?". A typed symbol keeps its own shift. */
function comboOf(e) {
  const k = e.key || "";
  if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Dead"].includes(k)) return "";
  const name = HK_NAMES[k.toLowerCase()] || (k.length === 1 ? k.toUpperCase() : k);
  const sym = k.length === 1 && !/[a-z0-9 ]/i.test(k);
  return [(e.ctrlKey || e.metaKey) && "Ctrl", e.altKey && "Alt", e.shiftKey && !sym && "Shift", name].filter(Boolean).join("+");
}
let hkChord = null; // the first key of a two-key combo, waiting for the second
/** Runs the hotkey for this key press, if one is free here. scopes: only these (default: all). Returns true when it used the key. */
function runHotkey(e, scopes) {
  const c = comboOf(e);
  if (!c) return false;
  const live = (x) => (!scopes || scopes.includes(x[4])) && HK_SCOPES[x[4]]();
  if (hkChord && Date.now() - hkChord.t < 2000) {
    const full = hkChord.c + " " + c;
    const x = HOTKEYS.find((x) => keyOf(x[0]) === full && live(x));
    if (x) {
      hkChord = null;
      x[5](e);
      return true;
    }
    if (scopes && !scopes.includes("menu")) return false; // a narrower look (moving, a held object) leaves the combo for the full one
  }
  hkChord = null;
  const x = HOTKEYS.find((x) => live(x) && (keyOf(x[0]) === c || (x[6] && "Shift+" + keyOf(x[0]) === c)));
  if (x) {
    x[5](e);
    return true;
  }
  if (HOTKEYS.some((x) => live(x) && keyOf(x[0]).startsWith(c + " "))) {
    hkChord = { c, t: Date.now() };
    toast(`${c} … then a second key`);
    return true;
  }
  return false;
}
// Scopes that can be live at the same time, so one key in both is a clash (km and obj sit on top on purpose, so they never clash).
const HK_TOGETHER = {
  all: ["all", "menu", "atk", "turn", "idle"],
  menu: ["all", "menu", "atk", "turn", "idle"],
  atk: ["all", "menu", "atk", "turn"],
  turn: ["all", "menu", "atk", "turn"],
  idle: ["all", "menu", "idle"],
  km: ["km"],
  obj: ["obj"],
};
function hkClash(id) {
  const me = HK_BY_ID[id],
    k = keyOf(id);
  if (!k) return "";
  const other = HOTKEYS.find((x) => {
    if (x[0] === id || !HK_TOGETHER[me[4]].includes(x[4])) return false;
    const o = keyOf(x[0]);
    return o === k || o.startsWith(k + " ") || k.startsWith(o + " ");
  });
  return other ? other[2] : "";
}
/** The Keys window: every hotkey by group, each one changeable; the fixed keys and the mouse below. */
function helpModal() {
  const cap = ui.hkCapture;
  const groups = [...new Set(HOTKEYS.map((x) => x[1]))];
  const order = [
    "Everywhere",
    "Menus (two keys: G, then the letter)",
    "Out of combat",
    "On a turn",
    "Attack menu",
    "Moving with the keys (after M)",
    "Selected map object",
  ];
  groups.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const keyCell = (k) =>
    k
      ? k
          .split(" ")
          .map((p) => kbd(p))
          .join(`<span class="hkthen">then</span>`)
      : `<span class="dim">none</span>`;
  const row = ([id, , label, def]) => {
    const k = keyOf(id),
      clash = hkClash(id),
      on = cap && cap.id === id;
    return `<div class="hkrow ${on ? "on" : ""} ${clash ? "clash" : ""}"><span class="hkkey">${on ? (cap.first ? `${keyCell(cap.first)} <span class="hkthen">then…</span>` : `<span class="warn">press a key…</span>`) : keyCell(k)}</span><span class="hkl">${h(label)}${clash ? ` <span class="bad">same key as: ${h(clash)}</span>` : ""}</span><span class="hka">${on ? `<span class="s dim">${cap.first ? "Enter keeps one key; a second key makes a two-key combo" : "Backspace: no key; Esc: cancel"}</span>` : `${btn("hkEdit", id, "Change", "", "tiny")}${k !== def ? btn("hkReset", id, "Default", "", "tiny", `Back to ${def || "none"}`) : ""}`}</span></div>`;
  };
  const changed = Object.keys(S.hotkeys || {}).length;
  return `<div class="hkhead"><span class="s dim">Every shortcut. Click Change, then press the new key (or two keys one after the other). Saved with the campaign.</span>${changed ? btn("hkResetAll", "", `Reset all ${changed} changed`, "", "tiny") : ""}</div><div class="keys hkeys">${groups
    .map(
      (g) =>
        `<h3>${h(g)}</h3>${HOTKEYS.filter((x) => x[1] === g)
          .map(row)
          .join("")}`,
    )
    .join(
      "",
    )}<h3>Fixed keys and the mouse</h3>${HK_FIXED.map(([k, l]) => `<div class="hkrow fixed"><span class="hkkey">${kbd(k)}</span><span class="hkl">${h(l)}</span><span class="hka"></span></div>`).join("")}</div>`;
}
/** While the Keys window waits for a new key: Esc cancels, Backspace leaves it with no key, Enter keeps one key, a second key makes a combo. */
function hkCaptureKey(e) {
  const cap = ui.hkCapture;
  const c = comboOf(e);
  if (!c) return;
  e.preventDefault();
  const set = (k) => {
    ui.hkCapture = null;
    const [id, , label, def] = HK_BY_ID[cap.id];
    act(`Key for ${label}: ${k || "none"}`, () => {
      S.hotkeys = S.hotkeys || {};
      if (k === def) delete S.hotkeys[id];
      else S.hotkeys[id] = k;
    });
  };
  if (c === "Esc") {
    ui.hkCapture = null;
    return render();
  }
  if (!cap.first) {
    if (c === "Backspace" || c === "Delete") return set("");
    if (c === "Enter") return;
    cap.first = c;
    return render();
  }
  return set(c === "Enter" ? cap.first : cap.first + " " + c);
}
