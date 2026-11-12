// ===== 10-render.js: DRAWING THE SCREEN AND THE KEYBOARD. render() rebuilds the page from S and ui; it keeps focus and scroll where they were.
// ---------- rendering
const app = document.getElementById("app");
// Safari (iPhone, iPad) only turns a tap into a click on something it thinks is clickable, and a listener on the
// whole page doesn't count. With this one on the app itself, tapping a panel header, a card or a table row works there.
app.addEventListener("click", () => {});
function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return "#" + CSS.escape(el.id);
  if (el.dataset && el.dataset.bind) return `[data-bind="${CSS.escape(el.dataset.bind)}"]`;
  if (el.dataset && el.dataset.a) return `[data-a="${CSS.escape(el.dataset.a)}"][data-v="${CSS.escape(el.dataset.v || "")}"]`;
  return null;
}
function liveSync() {
  if (!table.on || isSpec()) return;
  const m = ui.pendingMove,
    p = ui.autoPlan;
  const live = {
    move: m ? { id: m.id, x: m.x, y: m.y, cost: m.cost } : p && p.at ? { id: p.id, x: p.at.x, y: p.at.y, cost: p.moveCost || 0 } : null,
    aim: p && p.tgt ? { att: p.id, tgt: p.tgt } : ui.atk && ui.atk.tgt ? { att: ui.atk.att, tgt: ui.atk.tgt } : null,
  };
  if (JSON.stringify(live) === JSON.stringify(S.live || { move: null, aim: null })) return;
  S.live = live;
  tableSend();
}
function render() {
  liveSync();
  pendingRender = false;
  if (dataRev !== (S.tableRev || 0)) applyData(); // Undo or loading a save can change imported tables
  document.body.className = `${prefs.face} ${prefs.scan ? "scan" : ""}`;
  if (ui.atk && !ent(ui.atk.att)) ui.atk = null;
  const a = document.activeElement;
  const key = focusKey(a);
  let sel = null;
  try {
    if (a && a.selectionStart != null) sel = [a.selectionStart, a.selectionEnd];
  } catch (e) {
    /* not a text field */
  }
  const scrolls = {};
  document.querySelectorAll("[data-scroll]").forEach((el) => {
    scrolls[el.dataset.scroll] = el.scrollTop;
  });
  const keepX = {};
  document.querySelectorAll("[data-scroll]").forEach((el) => {
    keepX[el.dataset.scroll] = el.scrollLeft;
  });
  app.innerHTML = view();
  document.querySelectorAll("[data-scroll]").forEach((el) => {
    if (scrolls[el.dataset.scroll]) el.scrollTop = scrolls[el.dataset.scroll];
    if (keepX[el.dataset.scroll]) el.scrollLeft = keepX[el.dataset.scroll];
    else if (el.dataset.scroll === "ttree" && !(el.dataset.scroll in keepX)) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; // a freshly opened skill tree starts at its root
  });
  if (isSpec()) specLock();
  document.querySelectorAll(".tierkey").forEach(fitLine);
  if (ui.autoScroll) {
    ui.autoScroll = false;
    const ap = document.querySelector(".autoplan");
    const wb = ap && ap.closest(".wb");
    if (wb) wb.scrollTop = 0; // the plan is at the top of the turn panel
  }
  if (ui.termScroll) {
    ui.termScroll = false;
    const hit = document.getElementById("termhit");
    if (hit) hit.scrollIntoView({ block: "center" });
  }
  if (ui.focus) {
    const el = document.querySelector(ui.focus);
    ui.focus = null;
    focusSoft(el);
  } else if (key) {
    const el = document.querySelector(key);
    if (el) {
      el.focus();
      if (sel)
        try {
          el.setSelectionRange(sel[0], sel[1]);
        } catch (e) {
          /* not a text field */
        }
    }
  }
  const dlg = document.querySelector(".dialog");
  if (dlg && !dlg.contains(document.activeElement)) {
    // with a keyboard the first box is ready to type in; on a touch screen that would pop the keyboard up, so a button instead
    const f = dlg.querySelector(touchScreen() ? ".wb button" : ".wb input, .wb select, .wb textarea, .wb button");
    (f || dlg.querySelector("button")).focus();
  }
}
// On a phone or tablet the keyboard only opens when you tap a box yourself: the app never focuses a text box there.
// (Focus that was already in a box before a redraw is put back, since you tapped that box.)
const touchScreen = () => matchMedia("(pointer: coarse)").matches;
const typingBox = (el) => !!el && el.matches("textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=file])");
function focusSoft(el) {
  if (el && !(touchScreen() && typingBox(el))) el.focus();
}

// ---------- events
document.addEventListener(
  "pointerdown",
  () => {
    pointerDown = true;
  },
  true,
);
// A touch the browser takes over to scroll a panel ends in pointercancel, not pointerup. Both have to let go,
// or redraws and table updates stay held back until the next tap.
for (const type of ["pointerup", "pointercancel"])
  document.addEventListener(
    type,
    () => {
      pointerDown = false;
      setTimeout(() => {
        if (pendingRender) render();
      }, 0);
    },
    true,
  );
document.addEventListener(
  "pointercancel",
  () => {
    drag = mmDrag = null;
    document.body.classList.remove("dragging");
  },
  true,
);
document.addEventListener("click", (e) => {
  const head = small() && e.target.closest("[data-fold]");
  if (head && !e.target.closest("button,input,select,textarea,label,a,[data-a]")) {
    ACT.fold(head.dataset.fold);
    return;
  }
  const sum = e.target.closest("summary");
  if (sum) {
    e.preventDefault();
    const d = sum.parentElement;
    ui.open[d.dataset.k] = !d.open;
    render();
    return;
  }
  const el = e.target.closest("[data-a]");
  if (!el) {
    return;
  }
  const inField = e.target.matches("input,select,textarea,label") || !!e.target.closest("label");
  if (inField && el !== e.target) {
    // typing in a box inside a card must not trigger the card
    if (el.dataset.a === "pick" && !ui.atk && el.dataset.card && ui.sel !== el.dataset.v) {
      ui.sel = el.dataset.v;
      document.querySelectorAll(".card").forEach((c) => c.classList.toggle("sel", c.dataset.card === ui.sel));
    }
    return;
  }
  if (el.classList.contains("scrim") && (e.target !== el || !downOnScrim)) return;
  if (el.dataset.a === "noop") return;
  if (isSpec()) {
    if (SPEC_ASK.has(el.dataset.a)) return tableAsk(el.dataset.a, el);
    if (!SPEC_UI.has(el.dataset.a)) return;
  }
  const fn = ACT[el.dataset.a];
  if (fn) fn(el.dataset.v, el, e);
});
const valueOf = (el) => (el.type === "checkbox" ? el.checked : el.dataset.t === "num" ? num(el.value) : el.value);
document.addEventListener("input", (e) => {
  const el = e.target;
  if (isSpec() && !el.dataset.u) return;
  if (el.dataset.note) {
    let n = S.notesList.find((x) => x.id === ui.noteId);
    if (!n) {
      n = { id: "nt" + S.seq++, subject: "", text: "", at: Date.now() };
      S.notesList.push(n);
      ui.noteId = n.id;
    }
    n[el.dataset.note] = el.value;
    n.at = Date.now();
    touched();
    render();
    return;
  }
  if (el.dataset.u) {
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.id === "roll") {
      v = String(v).replace(/\D/g, "").slice(0, 2);
      el.value = v;
    }
    setPath(ui, el.dataset.u, v);
    if (el.dataset.u.startsWith("atk.")) ui.atk.err = "";
    if (el.dataset.u.startsWith("modal.q") && ui.modal) ui.modal.i = 0;
    if (el.dataset.u === "chk.use" || el.dataset.u === "chk.target") ui.chk.res = {};
    if (el.id === "rawState") return;
    render();
  }
  if (el.dataset.initroll) {
    const c = cbOf(el.dataset.initroll);
    if (c) {
      c.roll = num(el.value);
      touched();
      const row = el.closest("tr");
      if (row && row.lastElementChild) row.lastElementChild.textContent = c.roll == null ? "-" : fmt(c.base + c.roll);
    }
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.u || el.dataset.initroll || el.dataset.note) return;
  if (isSpec() && SPEC_ASK_C.has(el.dataset.c)) return tableAsk(el.dataset.c, el);
  if (isSpec() && !SPEC_UI.has(el.dataset.c)) return render();
  deferRender = true;
  try {
    if (el.dataset.bind) {
      const i = el.dataset.bind.indexOf(":");
      const id = el.dataset.bind.slice(0, i),
        path = el.dataset.bind.slice(i + 1);
      const who = ent(id);
      if (!who) return;
      const v = valueOf(el);
      act(`Edit ${who.name}`, () => {
        if (path === "name") who.customName = true;
        if (path === "hp" || path === "ap") setPath(who, path, Math.max(0, v || 0));
        else keepFull(who, () => setPath(who, path, v));
        if (path === "hp") syncDown(who);
      });
    } else if (el.dataset.c && ACT[el.dataset.c]) ACT[el.dataset.c](el.value, el);
    else if (el.dataset.scene)
      act("Change setting", () => {
        S.scene[el.dataset.scene] = el.value;
        if (!S.combat) for (const c of S.chars) c.ap = der(c).ap;
      });
    else if (el.dataset.rule) {
      const blankNull = el.dataset.rule === "tier1Req" && String(el.value).trim() === ""; // blank: the workbook's own requirements
      const v = blankNull
        ? null
        : el.type === "checkbox"
          ? el.checked
          : el.dataset.rt === "pct"
            ? num(el.value, 0) / 100
            : el.dataset.rt === "num"
              ? num(el.value, 0)
              : el.value;
      act("Change rule", () => {
        setPath(S.rules, el.dataset.rule, v);
        if (el.dataset.rule === "tier1Req") S.tableRev = (S.tableRev || 0) + 1; // the weapon data is rebuilt with it, on every screen
      });
    } else if (el.dataset.pref) {
      const k = el.dataset.pref;
      if (k === "seconds") prefs.interval = Math.max(0, num(el.value, 0));
      else if (k === "interval") prefs.interval = Number(el.value);
      else if (k === "scan") prefs.scan = el.checked;
      else prefs[k] = el.value;
      savePrefs();
      scheduleRender();
    } else if (el.dataset.ov) {
      const [key, field, kind] = el.dataset.ov.split("|");
      const base = key.startsWith("enemy:")
        ? db.enemies.get(key.slice(6))
        : key.startsWith("status:")
          ? db.status.get(key.slice(7))
          : key.startsWith("perk:")
            ? DATA.levelPerks.find((p) => E.low(p.n) === key.slice(5)) || DATA.skillPerks.find((p) => E.low(p.n) === key.slice(5))
            : key.startsWith("trait:")
              ? db.traitByCode.get(key.slice(6))
              : (db.idx.get(key) || {}).o;
      const raw = kind === "bool" ? el.checked : kind === "text" ? el.value : num(el.value);
      act("Edit data", () => setOverride(key, field, kind === "pct" && raw != null ? E.fix(raw / 100) : raw, base));
    }
  } finally {
    deferRender = false;
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "tableFile") return;
  const f = e.target.files[0];
  if (!f) return;
  try {
    const text = await f.text();
    if (!/\.csv$/i.test(f.name)) return toast("Tables come in as .csv files. In Excel: Save As, CSV.");
    const rows = fromCsv(text, tableRows(e.target.dataset.table));
    const err = importTable(e.target.dataset.table, rows);
    toast(err || `Replaced with ${rows.length} rows. Undo goes back.`);
  } catch (err) {
    toast("Could not read that file.");
  }
});
// ---- files: the pack this session saves to, if the browser lets us keep hold of one
let packFile = null;
const packName = () => `fallout-pack-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.zip`;
async function writePack(fh) {
  const w = await fh.createWritable();
  await w.write(new Blob([makeZip(packFiles())], { type: "application/zip" }));
  await w.close();
}
async function readImport(f, fh) {
  try {
    if (/\.(rar|7z)$/i.test(f.name)) throw new Error("Browsers can't open that. Re-pack it as a .zip: WinRAR can save as zip.");
    const buf = await f.arrayBuffer();
    const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
    if (head[0] === 0x50 && head[1] === 0x4b) {
      const n = await loadPack(buf);
      if (fh) packFile = fh;
      toast(`Pack loaded: ${n} edited table${n === 1 ? "" : "s"}.${fh ? ` Saves will go to ${fh.name}.` : ""} Undo goes back.`);
    } else {
      const p = normalize(JSON.parse(await f.text()));
      act("Restore backup", () => {
        S = p;
        ui.sel = (S.chars[0] || {}).id;
        ui.atk = null;
        ui.modal = null;
      });
      toast("Backup restored");
    }
  } catch (err) {
    toast(err.message || "Could not read that file.");
  }
}
document.getElementById("importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  await readImport(f, null);
  e.target.value = "";
});

function pickCard(dir) {
  const l = S.chars.map((c) => c.id);
  if (l.length) {
    ui.sel = cycle(l, ui.sel, dir);
    ui.rowSel = ui.sel;
    render();
  }
}
const KEYS = {
  idle: {
    b: () => ACT.beginC(""),
    i: () => {
      if (ui.sel) ACT.openChar(`${ui.sel}|inv`);
    },
    arrowright: () => pickCard(1),
    arrowleft: () => pickCard(-1),
  },
  fight: { a: ACT.attack, r: ACT.reload, m: () => ACT.keyMoveStart(), i: ACT.itemModal, n: ACT.next },
};
document.addEventListener("keydown", (e) => {
  if (isSpec() && e.key !== "Escape") return; // no shortcuts on a spectator screen
  const t = e.target;
  if (ui.autoPlan && !(t.matches && t.matches("input,select,textarea")) && (e.key === "Enter" || e.key === "Escape")) {
    e.preventDefault();
    return e.key === "Enter" ? ACT.autoConfirm() : ACT.autoCancel();
  }
  const k = e.key.toLowerCase();
  const typing = t.matches && t.matches("input,select,textarea");
  // Q and E turn the object you're holding or have selected: Q counter-clockwise, E clockwise, 15 degrees a press
  if ((k === "q" || k === "e") && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const step = (k === "e" ? 1 : -1) * (e.shiftKey ? 5 : 15);
    if (drag && drag.kind === "map" && drag.obj) {
      const o = S.scene.objects.find((x) => x.id === drag.obj);
      if (o) {
        e.preventDefault();
        drag.angle = ((((drag.angle != null ? drag.angle : o.angle || 0) + step) % 360) + 360) % 360;
        const gly = drag.g.querySelector(".gly:not(.trunk)");
        if (gly && drag.base == null) drag.base = (gly.getAttribute("transform") || "").replace(/^rotate\([^)]*\)\s*/, "");
        if (gly) gly.setAttribute("transform", `rotate(${drag.angle}) ${drag.base}`);
        return;
      }
    }
    if (ui.mapSel && !ui.modal) {
      e.preventDefault();
      ACT.objRotate(step);
      return;
    }
  }
  if (ui.keyMove && !typing && !ui.modal && ["a", "d", "w", "s", "enter", "escape"].includes(k)) {
    e.preventDefault();
    const km = ui.keyMove;
    if (k === "escape") {
      ui.keyMove = null;
      ui.pendingMove = null;
    } else if (k === "enter") {
      ui.keyMove = null;
      return ACT.moveConfirm();
    } else if (k === "a" || k === "d") km.ang = (km.ang + (k === "d" ? 15 : -15) + 360) % 360;
    else km.steps = clamp(km.steps + (k === "w" ? 1 : -1), 0, Math.max(0, ent(km.id).ap || 0));
    keyMovePlan();
    return render();
  }
  if (ui.modal && ui.modal.type === "move" && t.tagName === "SELECT" && /^[0-9]$/.test(k)) {
    e.preventDefault();
    return ACT.moveTo(k === "0" ? 10 : Number(k));
  }
  if (e.ctrlKey || e.metaKey) {
    if (k === "s") {
      e.preventDefault();
      ACT.saveNow();
      return;
    }
    if (typing && t.id !== "roll") return; // the browser's own undo while typing in a box
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (k === "y" || (k === "z" && e.shiftKey)) {
      e.preventDefault();
      redo();
    }
    return;
  }
  if (e.altKey) return;
  if (k === "escape" && ui.throwing) {
    e.preventDefault();
    return ACT.throwCancel();
  }
  if (k === "enter" && ui.throwing && ui.throwing.at && !typing) {
    e.preventDefault();
    return ACT.throwConfirm();
  }
  if (k === "escape") {
    e.preventDefault();
    if (ui.modal) return ACT.closeModal();
    if (typing && t.id !== "roll") {
      t.blur();
      render();
      return;
    }
    if (ui.pendingMove) return ACT.moveCancel();
    if (ui.place) {
      ui.place = null;
      return render();
    }
    if (ui.atk && K() && K().phase !== "turns") return ACT.closeAtk();
    if (ui.logOpen) return ACT.toggleLog();
    return;
  }
  if (ui.modal && k === "tab") {
    // keep Tab inside the context window
    const f = [...document.querySelectorAll(".dialog input, .dialog select, .dialog textarea, .dialog button, .dialog summary")];
    if (f.length) {
      const i = f.indexOf(t);
      if ((e.shiftKey && i <= 0) || (!e.shiftKey && i === f.length - 1)) {
        e.preventDefault();
        f[e.shiftKey ? f.length - 1 : 0].focus();
      }
    }
    return;
  }
  if (ui.modal && ui.modal.type === "search" && (k === "arrowdown" || k === "arrowup")) {
    e.preventDefault();
    const n = searchHits(ui.modal.q).length;
    if (n) {
      ui.modal.i = ((ui.modal.i || 0) + (k === "arrowdown" ? 1 : -1) + n) % n;
      render();
    }
    return;
  }
  if (k === "enter") {
    if (ui.pendingMove && !ui.modal) {
      e.preventDefault();
      return ACT.moveConfirm();
    }
    if (t.dataset && t.dataset.enter) {
      e.preventDefault();
      if (t.dataset.c || t.dataset.bind) t.blur();
      const fn = ACT[t.dataset.enter];
      if (fn) fn(t.value, t);
      return;
    }
    if (t.tagName === "BUTTON" || t.tagName === "SUMMARY" || t.tagName === "TEXTAREA") return;
    if (typing) {
      t.blur();
    }
    const scope = ui.modal ? document.querySelector(".dialog") : document;
    const p = scope.querySelector("[data-primary]");
    if (p) {
      e.preventDefault();
      p.click();
    }
    return;
  }
  const isRoll = t.id === "roll";
  if (typing && !isRoll) return;
  if (isRoll && (/^[0-9]$/.test(k) || ["backspace", "delete", "arrowleft", "arrowright", "tab", "home", "end"].includes(k))) return;
  if (ui.modal) {
    const m = ui.modal;
    if (m.type === "move" && /^[0-9]$/.test(k)) {
      e.preventDefault();
      ACT.moveTo(k === "0" ? 10 : Number(k));
      return;
    }
    if (m.type === "item" && /^[1-9]$/.test(k)) {
      e.preventDefault();
      const lines = (ent(m.who).inv || []).map((l, i) => ({ l, i, it: E.get(ctx(), l.n) })).filter((x) => x.it && x.it.cat === "item" && usable(x.it.o));
      const pick = lines[Number(k) - 1];
      if (pick) ACT.itemPick(pick.i);
      return;
    }
    if (m.type === "mapmaker" && (k === "delete" || k === "backspace")) {
      e.preventDefault();
      return ACT.mmDel();
    }
    if (m.type === "help") {
      e.preventDefault();
      ACT.closeModal();
    }
    return;
  }
  if (ui.atk && K()) {
    const a = ui.atk;
    const A = ent(a.att);
    const atkKeys = {
      w: () => {
        a.w = (a.w + 1) % A.weapons.length;
        a.mode = "pr";
        a.err = "";
      },
      t: () => {
        const ts = targetsFor(a.att);
        if (ts.length) a.tgt = cycle(ts, a.tgt, 1);
        a.err = "";
      },
    };
    if (!e.shiftKey && atkKeys[k]) {
      e.preventDefault();
      atkKeys[k]();
      ui.focus = "#roll";
      render();
      return;
    }
    if (/^[0-9]$/.test(k)) {
      const r = document.getElementById("roll");
      if (r) r.focus();
      return;
    }
  }
  const glob = { "/": () => ACT.search(), "?": ACT.help };
  if (glob[e.key]) {
    e.preventDefault();
    glob[e.key]();
    return;
  }
  if (k === "delete" && ui.mapSel) {
    e.preventDefault();
    ACT.objDel(ui.mapSel);
    return;
  }
  const map = !K() ? KEYS.idle : ["end", "defeat"].includes(K().phase) ? {} : KEYS.fight;
  const fn = map[k];
  if (fn) {
    e.preventDefault();
    fn();
    return;
  }
  if (isRoll && k.length === 1) e.preventDefault();
});
// Shrinks a one-line row's text until it fits its width (not below 8 px), so a legend never wraps or gets cut.
function fitLine(el) {
  el.style.fontSize = "";
  let fs = parseFloat(getComputedStyle(el).fontSize) || 12;
  while (el.scrollWidth > el.clientWidth + 1 && fs > 8) {
    fs -= 0.5;
    el.style.fontSize = fs + "px";
  }
}
addEventListener("resize", () => document.querySelectorAll(".tierkey").forEach(fitLine));
