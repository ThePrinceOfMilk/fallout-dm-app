// ===== 12-boot.js: START-UP AND THE SHARED TABLE. Fills the lists, loads the save and draws the first screen; then Open session
// (RELAY, the Cloudflare relay address) and the same-Wi-Fi table server.
// ---------- boot
function fillLists() {
  const dl = (id, arr) => `<datalist id="${id}">${arr.map((x) => `<option value="${h(x)}"></option>`).join("")}</datalist>`;
  document.getElementById("lists").innerHTML =
    dl(
      "dl-all",
      [...DATA.items, ...DATA.materials, ...DATA.ammo, ...DATA.armor, ...DATA.weapons, ...DATA.mods].map((o) => o.n),
    ) +
    dl(
      "dl-weapons",
      DATA.weapons.filter((w) => w.tier).map((o) => o.n),
    ) +
    dl(
      "dl-armor",
      DATA.armor.map((o) => o.n),
    ) +
    dl("dl-perks", [...new Set([...DATA.levelPerks, ...DATA.skillPerks].map((o) => o.n))]) +
    dl(
      "dl-status",
      DATA.statuses.map((o) => o.n),
    ) +
    dl(
      "dl-traits",
      DATA.traits.map((t) => `${t.code} ${t.n}`),
    );
}
applyData();
applyScale();
// The hosted copy (index.html) opens on a brand new campaign. The build switches this on for that file only.
// prettier-ignore
const FRESH_START = /*FRESH*/false;
if (FRESH_START && !readJson(SAVE_KEY)) {
  S = fresh();
  S.chars = [];
  ui.sel = null;
  ui.wiz = newWiz();
  ui.modal = { type: "wizard" };
  ui.focus = "#wizName";
  applyData();
}
if (!readJson(SAVE_KEY)) save();
try {
  render();
} catch (err) {
  // The stored campaign can't be drawn by this build. Keep it aside and open a fresh one, rather than a blank page nobody can get out of.
  try {
    localStorage.setItem(SAVE_KEY + "-unreadable", JSON.stringify(S));
  } catch (e2) {
    /* storage full: the slots are still there */
  }
  S = fresh();
  Object.assign(ui, { sel: (S.chars[0] || {}).id, rowSel: null, modal: null, atk: null, end: null, def: null });
  applyData();
  render();
  toast("The last autosave could not be opened and was set aside. Your named saves are under Load.");
}

// ---------- shared table
// Open session goes through the cloud relay (app/relay); a link with only ?t= is the Wi-Fi server (app/table_server.js).
const RELAY = "https://fallout-table.wasteland-relay.workers.dev";
const APP_URL = "https://theprinceofmilk.github.io/fallout-dm-app/";
const tableUrl = (k) => `${table.base}/sync/${k}?t=${encodeURIComponent(table.t)}`;
function tableModal() {
  const kind = ui.linkKind || "dm";
  const pick = `<div class="row" style="margin-top:6px;align-items:center;gap:6px"><span class="s">Link for</span><select id="linkKind" data-u="linkKind">${options(
    [
      ["dm", "DM: the full screen"],
      ["spec", "Spectator: map, party and log"],
      ["player", "Player (coming later)"],
    ],
    kind,
  )}</select></div>`;
  const say = {
    dm: "Anyone with this link gets this same DM screen, and changes show on every device.",
    spec: "A spectator sees the map, the party and the combat log. They can open a party member's inventory, sheet and health, use consumables and equip or unequip gear; everything else stays with the DM.",
    player: "Player links aren't ready yet.",
  }[kind];
  const links = kind === "dm" ? table.links : kind === "spec" ? table.specLinks : [];
  return `<div class="s">${table.up ? `${table.n} device${table.n === 1 ? "" : "s"} connected.` : "Reconnecting to the table..."}</div>${pick}<div class="s dim" style="margin-top:4px">${say}</div>${links.map((l, i) => `<div class="row" style="margin-top:6px"><input id="tableLink${i}" class="grow" readonly value="${h(l)}" title="${h(l)}">${btn("tableCopy", i, "Copy", "", "tiny")}</div>`).join("")}<div class="s dim" style="margin-top:8px">${table.base ? "The link works from any network. The game is kept online for 14 days after the last change." : "These links work on the same Wi-Fi. To bring your campaign here: Save pack in your usual copy, then Load pack here."}</div>${table.base ? `<div class="acts" style="margin-top:8px">${btn("leaveSession", "", "Leave session", "", "tiny", "Stop syncing on this device. The others keep playing.")}</div>` : ""}`;
}
function tableSend() {
  clearTimeout(table.timer);
  table.timer = setTimeout(tablePost, 150);
}
async function tablePost() {
  if (table.busy) return (table.again = true); // one send at a time, so each one starts from the newest rev
  table.busy = true;
  try {
    const r = await fetch(tableUrl("state"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseRev: table.rev, from: table.id, S }),
    });
    const j = await r.json();
    if (r.ok) table.rev = Math.max(table.rev, j.rev);
    else if (r.status === 409) {
      table.again = false;
      tableTake(j);
      toast("Someone else changed that first. Your last change was not kept.");
    }
  } catch (e) {
    table.again = true; // offline: try again once the stream is back
  }
  table.busy = false;
  if (table.again && table.up) {
    table.again = false;
    tablePost();
  }
}
// Only a drag or a box with a half-typed value holds updates back; a box the app focused for you does not.
const tableBusy = () => {
  const a = document.activeElement;
  return pointerDown || (!!a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && !a.readOnly && a.value !== a.defaultValue);
};
function tableTake(msg) {
  if (tableBusy()) return (table.pending = msg); // don't redraw under a drag or a half-typed number
  table.pending = null;
  let p;
  try {
    p = normalize(msg.S);
  } catch (e) {
    return;
  }
  const had = new Set((S.fxq || []).map((x) => x.id)),
    first = !table.gotState;
  S = p;
  table.rev = msg.rev;
  table.gotState = true;
  // play the effects that came with this update (none on joining: those already happened)
  ui.fxSeen = ui.fxSeen || new Set();
  for (const x of S.fxq || [])
    if (!had.has(x.id) && !ui.fxSeen.has(x.id)) {
      ui.fxSeen.add(x.id);
      if (!first) playFx(x.f);
    }
  // shortcut: undo only covers your own changes since the last remote update; upgrade to a shared server-side undo if the user asks.
  undoStack.length = redoStack.length = undoChars = 0;
  if (!ent(ui.sel)) ui.sel = (S.chars[0] || {}).id;
  if (ui.modal && ui.modal.id && !ent(ui.modal.id)) ui.modal = null;
  if (ui.atk && (!S.combat || !ent(ui.atk.att) || !ent(ui.atk.tgt))) ui.atk = null;
  table.quiet = true;
  save();
  table.quiet = false;
  scheduleRender();
}
const tableFlush = () =>
  setTimeout(() => {
    if (table.pending && !tableBusy()) tableTake(table.pending);
  }, 0);
document.addEventListener("pointerup", tableFlush, true);
document.addEventListener("pointercancel", tableFlush, true);
document.addEventListener("focusout", tableFlush, true);
async function tableJoin() {
  const q = new URLSearchParams(location.search);
  table.t = q.get("t") || "";
  const room = q.get("room");
  if (room) {
    table.base = RELAY + "/s/" + room;
    table.links = [(location.protocol === "https:" ? location.origin + location.pathname : APP_URL) + `?room=${room}&t=${table.t}`];
  } else if (!table.t || location.protocol === "file:") return;
  let hello;
  try {
    const r = await fetch(tableUrl("hello"));
    hello = await r.json();
    if (!r.ok) return room && toast(hello.error || "Could not join that session.");
  } catch (e) {
    return room && toast("Could not reach the session. Check the internet connection and reload.");
  }
  Object.assign(table, { on: true, rev: hello.rev });
  if (hello.role) table.role = hello.role;
  if (hello.links) table.links = hello.links;
  if (hello.s) table.specLinks = room ? [table.links[0].replace(/&t=[^&]*/, `&t=${hello.s}`) + "&v=s"] : (hello.specLinks || []).map((l) => l + "&v=s");
  if (!hello.hasState && !isSpec()) {
    table.gotState = true; // this screen's game is the table's, so the next update is a real change (its effects play)
    tablePost(); // first DM device in: its campaign becomes the table's
  }
  const es = new EventSource(tableUrl("events"));
  const status = () => {
    saveStatus();
    const b = document.querySelector('[data-a="table"]');
    if ((b || isSpec()) && !tableBusy()) scheduleRender(); // the button shows the device count; a spectator's screen shows the connection
  };
  es.onopen = () => {
    table.up = true;
    status();
    if (table.again) tablePost();
  };
  es.onerror = () => {
    table.up = false;
    status();
  };
  es.onmessage = (e) => {
    const m = JSON.parse(e.data);
    table.up = true;
    if (m.n) table.n = m.n;
    if (m.ask) {
      if (!isSpec()) applyAsk(m.ask);
      return status();
    }
    if (!m.S) return status();
    if (m.from === table.id) {
      table.rev = Math.max(table.rev, m.rev);
      return status();
    }
    tableTake(m);
  };
  render();
}
Object.assign(ACT, AUTO_ACT);
tableJoin();
