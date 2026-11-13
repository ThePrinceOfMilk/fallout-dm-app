// ===== 11-input.js: MOUSE AND TOUCH. Dragging tokens and objects, resize bars, moving windows, the map creator, two-finger pinch on the map,
// and wheel zoom. A touch the browser cancels (pointercancel) must end a drag the same way pointerup does.
// ---------- mouse: map tokens, resize bars, and moving and sizing context windows
let drag = null,
  downOnScrim = false;
function svgPoint(svg, ev) {
  const m = svg.getScreenCTM();
  return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : { x: 0, y: 0 };
}
document.addEventListener("dblclick", (ev) => {
  const t = ev.target.closest && ev.target.closest(".win[data-wcls] > .wt");
  if (!t || ev.target.closest("button,input,select")) return;
  const c = t.parentElement.dataset.wcls;
  if ((prefs.wsize || {})[c]) {
    prefs.wsize = { ...prefs.wsize };
    delete prefs.wsize[c];
    savePrefs();
    render();
  }
});
document.addEventListener("pointerdown", (ev) => {
  downOnScrim = ev.target.classList && ev.target.classList.contains("scrim");
  const gut = ev.target.closest("[data-gut]");
  if (gut) {
    ev.preventDefault();
    const box = (q) => {
      const el = document.querySelector(q);
      return el ? el.getBoundingClientRect() : null;
    };
    drag = { kind: "gut", which: gut.dataset.gut, box: box(".board"), stage: box(".stage"), arena: box(".arena") };
    document.body.classList.add("dragging");
    return;
  }
  const title = ev.target.closest(".float > .wt");
  if (title && !ev.target.closest("button,input,select")) {
    const w = title.parentElement;
    const r = w.getBoundingClientRect();
    drag = { kind: "win", w, dx: ev.clientX - r.left, dy: ev.clientY - r.top };
    ev.preventDefault();
    return;
  }
  if (ev.target.matches && ev.target.matches(".win[data-wcls]")) {
    const r = ev.target.getBoundingClientRect();
    drag = { kind: "wsize", w: ev.target, w0: r.width, h0: r.height };
    return;
  }
  const fl = ev.target.closest(".float");
  if (fl) {
    const r = fl.getBoundingClientRect();
    drag = { kind: "size", w: fl, w0: r.width, h0: r.height };
    return;
  }
  const svg = ev.target.closest && ev.target.closest("#map");
  if (svg && ev.button === 0) {
    const sz = ev.target.closest("[data-size]");
    if (sz) {
      const o = S.scene.objects.find((x) => x.id === sz.dataset.size);
      if (o) drag = { kind: "osize", svg, o, w0: o.w, h0: o.h };
      ev.preventDefault();
      return;
    }
    const rh = ev.target.closest("[data-rot]");
    if (rh) {
      const o = S.scene.objects.find((x) => x.id === rh.dataset.rot);
      drag = { kind: "rot", svg, o, group: rh.closest("[data-obj]") };
      ev.preventDefault();
      return;
    }
    const g = ui.place || isSpec() ? null : ev.target.closest("[data-tok],[data-obj]"); // while placing, any click places, even on top of a rock; spectators only look
    if (g) {
      const p = svgPoint(svg, ev);
      drag = { kind: "map", svg, g, tok: g.dataset.tok, obj: g.dataset.obj, x0: p.x, y0: p.y, moved: false, p: null };
      ev.preventDefault();
    } else drag = { kind: "mapbg", svg };
  }
});
document.addEventListener("pointermove", (ev) => {
  if (ui.throwing && !ui.throwing.at && !drag) {
    const svg = ev.target.closest && ev.target.closest("#map");
    if (svg) throwPreview(svg, ev);
  }
  if (!drag) return;
  if (drag.kind === "gut") {
    const right = drag.box.right - 47; // the rail
    if (drag.which === "left") prefs.partyW = clamp(ev.clientX - drag.box.left, 210, drag.box.width - 500) / kx();
    if (drag.which === "right") prefs.enemyW = clamp(right - ev.clientX, 160, 500) / kx();
    if (drag.which === "bottom") {
      const v = clamp(drag.stage.bottom - ev.clientY, 70, drag.stage.height - 200);
      if (K()) prefs.bottomFight = v / ky();
      else prefs.bottomH = v / ky();
    }
    if (drag.which === "map") prefs.mapW = clamp(ev.clientX - drag.arena.left, 200, drag.arena.width - 260) / kx();
    const st = document.documentElement.style;
    applySizes();
  } else if (drag.kind === "win") {
    const w = drag.w;
    const r = w.getBoundingClientRect();
    w.style.cssText += `;position:fixed;margin:0;max-height:none;width:${r.width}px;height:${r.height}px;left:${clamp(ev.clientX - drag.dx, 0, innerWidth - 60)}px;top:${clamp(ev.clientY - drag.dy, 0, innerHeight - 30)}px`;
  } else if (drag.kind === "osize") {
    // The corner handle sets the size: twice the pointer's distance from the middle, along the object's own turned axes.
    const p = svgPoint(document.getElementById("map") || drag.svg, ev), // each preview redraws the map, so ask for the new one
      o = drag.o,
      a = ((o.angle || 0) * Math.PI) / 180;
    const dx = p.x - o.x,
      dy = p.y - o.y;
    const lx = dx * Math.cos(a) + dy * Math.sin(a),
      ly = -dx * Math.sin(a) + dy * Math.cos(a);
    const step = ev.shiftKey ? 0.01 : 0.1;
    const q = (v) => Math.max(0.1, Math.round((2 * Math.abs(v)) / step) * step);
    drag.w = E.fix(q(lx));
    drag.h = E.fix(q(ly));
    o.w = drag.w; // a live preview; the real change is one undo step on release
    o.h = drag.h;
    render();
  } else if (drag.kind === "rot") {
    // The handle points where the top of the object should face. Snaps to 5 degrees, Shift for exact.
    const p = svgPoint(drag.svg, ev);
    let a = (Math.atan2(p.y - drag.o.y, p.x - drag.o.x) * 180) / Math.PI + 90;
    a = ((a % 360) + 360) % 360;
    if (!ev.shiftKey) a = (Math.round(a / 5) * 5) % 360;
    drag.angle = Math.round(a);
    const gly = drag.group.querySelector(".gly:not(.trunk)");
    if (gly && drag.base == null) drag.base = (gly.getAttribute("transform") || "").replace(/^rotate\([^)]*\)\s*/, "");
    if (gly) gly.setAttribute("transform", `rotate(${drag.angle}) ${drag.base}`);
    const hd = drag.group.querySelector(".rothandle");
    if (hd) hd.parentNode.setAttribute("transform", `rotate(${drag.angle})`);
  } else if (drag.kind === "mapbg" && ui.zoom && !ui.place) {
    // Dragging empty ground slides the map around while zoomed in.
    const r = drag.svg.getBoundingClientRect();
    const v = mapView();
    const scale = Math.max(v.w / r.width, v.h / r.height);
    const dx = ev.clientX - (drag.lx != null ? drag.lx : ev.clientX),
      dy = ev.clientY - (drag.ly != null ? drag.ly : ev.clientY);
    drag.lx = ev.clientX;
    drag.ly = ev.clientY;
    if (dx || dy) {
      drag.panned = true;
      ui.zoom.x = v.x + v.w / 2 - dx * scale;
      ui.zoom.y = v.y + v.h / 2 - dy * scale;
      const nv = mapView();
      drag.svg.setAttribute("viewBox", `${nv.x} ${nv.y} ${nv.w} ${nv.h}`);
    }
  } else if (drag.kind === "map") {
    const p = svgPoint(drag.svg, ev);
    if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > (ui.viewW || 20) * 0.012) drag.moved = true;
    if (drag.moved) {
      drag.p = inMap(p);
      let snap = null;
      if (ev.ctrlKey && drag.tok && K()) {
        snap = snapRange(drag.tok, drag.p);
        drag.p = snap.p;
      }
      drag.g.setAttribute("transform", `translate(${drag.p.x} ${drag.p.y})${drag.tok ? ` scale(${ui.tokK || 1})` : ""}`);
      drag.g.classList.add("lift");
      if (drag.tok && K() && fightPhase() && drag.tok === actorId() && !ev.shiftKey) {
        const e = ent(drag.tok);
        const cost = moveCost(posOf(drag.tok), drag.p, e);
        const tip = drag.g.querySelector(".drg");
        if (tip) {
          tip.textContent = (cost === Infinity ? "CAN'T" : `${cost} AP`) + (snap && snap.band ? ` · R${snap.band}` : "");
          tip.classList.toggle("bad", cost > (e.ap || 0));
        }
      }
    }
  }
});
// Double-tap empty ground on a touch screen: twice as close around that spot; at the closest zoom, the whole map again.
// Only when nothing is being placed or thrown, so a tap there only ever cleared the selection before.
let lastTap = null;
function doubleTap(ev) {
  const t = performance.now(),
    l = lastTap;
  lastTap = { t, x: ev.clientX, y: ev.clientY };
  if (!l || t - l.t > 350 || Math.hypot(ev.clientX - l.x, ev.clientY - l.y) > 40) return false;
  lastTap = null;
  return true;
}
function tapZoom(svg, ev) {
  const p = svgPoint(svg, ev),
    v0 = mapView(),
    k0 = ui.zoom ? ui.zoom.k : 1;
  if (k0 * 2 > (v0.W / ZOOM_MIN_VIEW) * 0.99) setZoom(1);
  else {
    setZoom(k0 * 2, p.x, p.y);
    const v1 = mapView(); // keep the tapped spot under the finger
    ui.zoom.x = p.x + v1.w / 2 - ((p.x - v0.x) / v0.w) * v1.w;
    ui.zoom.y = p.y + v1.h / 2 - ((p.y - v0.y) / v0.h) * v1.h;
  }
  render();
}
function keepDialog(w) {
  const r = w.getBoundingClientRect();
  ui.dlg[w.dataset.dlg] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}
document.addEventListener("pointerup", (ev) => {
  const d = drag;
  drag = null;
  if (!d) return;
  document.body.classList.remove("dragging");
  if (d.kind === "gut") {
    savePrefs();
    return;
  }
  if (d.kind === "win") return keepDialog(d.w);
  if (d.kind === "wsize") {
    const r = d.w.getBoundingClientRect();
    if (Math.abs(r.width - d.w0) > 2 || Math.abs(r.height - d.h0) > 2) {
      prefs.wsize = { ...(prefs.wsize || {}), [d.w.dataset.wcls]: { w: Math.round(r.width / kx()), h: Math.round(r.height / ky()) } };
      savePrefs();
      render();
    }
    return;
  }
  if (d.kind === "size") {
    const r = d.w.getBoundingClientRect();
    if (Math.abs(r.width - d.w0) > 2 || Math.abs(r.height - d.h0) > 2) keepDialog(d.w);
    return;
  }
  if (d.kind === "osize") {
    const { o } = d;
    o.w = d.w0;
    o.h = d.h0;
    if (d.w != null && (d.w !== d.w0 || d.h !== d.h0))
      act("Resize", () => {
        o.w = d.w;
        o.h = d.h;
      });
    else render();
    return;
  }
  if (d.kind === "rot") {
    if (d.angle != null)
      act("Rotate", () => {
        d.o.angle = d.angle;
      });
    return;
  }
  if (d.kind === "mapbg") {
    if (!d.panned && !ui.throwing && !ui.place && ev.pointerType === "touch" && doubleTap(ev)) return tapZoom(d.svg, ev);
    if (d.panned || isSpec()) return;
    if (ui.throwing) {
      ui.throwing.at = inMap(svgPoint(d.svg, ev));
      return render();
    }
    if (ui.place) {
      const p = inMap(svgPoint(d.svg, ev));
      const kind = ui.place === "trap" ? "hazard" : ui.place; // a trap is a hidden hazard
      const id = "o" + S.seq++;
      const pick = ui.placeItem || "";
      const cat = S.rules.mapItems[pick];
      const sub = /^(hz|mk):/.test(pick) ? pick.slice(3) : "";
      const subName = sub ? (kind === "hazard" ? S.rules.hazardKinds : S.rules.markerKinds)[sub] : "";
      act(`Place ${cat ? cat.n : subName || MAP_OBJ[kind][0]}`, () => {
        const size = ui.place === "trap" ? [1, 1] : { cover: [1, 1], hard: [1.2, 1.2], hazard: [2, 2], note: [0.5, 0.5] }[kind];
        const big = Math.max(1, (ui.viewW || 20) / 40);
        const label = String(ui.placeName || "").trim() || (kind === "hazard" || (kind === "note" && sub && sub !== "note") ? subName : "");
        // a catalog item comes at its real size; a plain one a little larger when zoomed far out, so it can be seen and grabbed
        const o = cat
          ? { id, kind: cat.round ? "tree" : kind, item: pick, cover: cat.cover, x: E.fix(p.x), y: E.fix(p.y), w: cat.w, h: cat.h, label }
          : { id, kind, x: E.fix(p.x), y: E.fix(p.y), w: E.fix(size[0] * big), h: E.fix(size[1] * big), label };
        if (cat && cat.block) o.block = true;
        if (cat && cat.round) o.round = true;
        if (sub) o.sub = sub;
        if (isLiquid(o)) {
          // every pool placed by hand gets its own natural outline and a slightly different stretch
          o.blob = E.blobShape();
          o.w = E.fix(o.w * (0.8 + Math.random() * 0.45));
          o.h = E.fix(o.h * (0.8 + Math.random() * 0.45));
        }
        S.scene.objects.push(o);
        ui.mapSel = kind === "note" ? id : null;
        if (kind === "note") ui.focus = "#objLabel";
      });
    } else if (ui.mapSel) {
      ui.mapSel = null;
      render();
    }
    return;
  }
  if (d.kind === "map") {
    if (!d.moved) {
      if (d.obj && d.angle != null) {
        ui.mapSel = d.obj;
        return act("Rotate", () => {
          const o = S.scene.objects.find((q) => q.id === d.obj);
          if (o) o.angle = d.angle;
        });
      }
      if (d.tok && ui.throwing) {
        ui.throwing.at = { ...posOf(d.tok) };
        return render();
      }
      if (d.tok) ACT.pick(d.tok);
      else {
        ui.mapSel = d.obj;
        render();
      }
      return;
    }
    const x = E.fix(d.p.x),
      y = E.fix(d.p.y);
    if (d.obj)
      return act("Move on map", () => {
        const o = S.scene.objects.find((q) => q.id === d.obj);
        if (o) {
          o.x = x;
          o.y = y;
          if (d.angle != null) o.angle = d.angle;
        }
      });
    if (standBlocked({ x, y })) {
      toast("Nobody can stand there: something's in the way.");
      return render();
    }
    const k = K();
    if (!k)
      return act("Move token", () => {
        S.scene.pos[d.tok] = { x, y };
      });
    const c = cbOf(d.tok);
    const e = ent(d.tok);
    const free = ev.shiftKey || !fightPhase();
    if (!free && E.pathBlocked({ x: c.x, y: c.y }, { x, y }, S.scene.objects, S.rules)) {
      toast(`Something in the way would have to be vaulted, or a door is shut. Go around, or hold Shift.`);
      return render();
    }
    if (!free && d.tok !== actorId()) {
      toast(`It isn't ${e.name}'s turn. Hold Shift to reposition for free.`);
      return render();
    }
    const cost = free ? 0 : moveCost({ x: c.x, y: c.y }, { x, y }, e);
    if (cost > (e.ap || 0)) {
      toast(cost === Infinity ? `${e.name} can't walk: a shattered leg.` : `${e.name} needs ${cost} AP to walk that far, has ${fmt(e.ap)}.`);
      return render();
    }
    // On your turn a drag is only a preview. Nothing changes until you confirm it, so you can see the cost first.
    if (!free) {
      ui.pendingMove = { id: d.tok, x, y, cost };
      ui.focus = null;
      return render();
    }
    act("Move token", () => {
      c.x = x;
      c.y = y;
      for (const key of Object.keys(k.ranges)) if (key.split("|").includes(d.tok)) delete k.ranges[key];
      log("status", `DM moves ${e.name}.`);
    });
  }
});
// ---------- mouse and touch in the map creator: drag to draw buildings and walls, click to place, drag to move
let mmDrag = null;
const mmSnap = (v, ev) => (ev.shiftKey ? E.fix(v) : Math.round(v * 2) / 2);
const mmIn = (p) => ({ x: clamp(p.x, -ui.mm.w / 2, ui.mm.w / 2), y: clamp(p.y, -ui.mm.h / 2, ui.mm.h / 2) });
document.addEventListener("pointerdown", (ev) => {
  if (!(ev.target.closest && ev.target.closest("#mmSvg")) || ev.button !== 0 || !ui.mm) return;
  ev.preventDefault();
  // A box still being typed in (name, width) is finished first. That redraws the window, so everything is looked up again after it.
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  const svg = document.getElementById("mmSvg");
  if (!svg) return;
  const under = document.elementFromPoint(ev.clientX, ev.clientY);
  const m = ui.mm,
    p = mmIn(svgPoint(svg, ev)),
    g = under && under.closest && under.closest("[data-mm]");
  if (m.tool === "item") {
    if (!S.rules.mapItems[m.item]) return;
    const o = mmItem(m.item, mmSnap(p.x, ev), mmSnap(p.y, ev));
    m.objects.push(o);
    m.sel = o.id;
    ui.focus = "#mmSvg";
    return render();
  }
  if (m.tool === "select") {
    const o = g && m.objects.find((x) => x.id === g.dataset.mm);
    m.sel = o ? o.id : null;
    ui.focus = "#mmSvg";
    render();
    if (o) mmDrag = { kind: "move", o, dx: p.x - o.x, dy: p.y - o.y };
    return;
  }
  const x = mmSnap(p.x, ev),
    y = mmSnap(p.y, ev);
  mmDrag = { kind: "draw", tool: m.tool, x0: x, y0: y, x1: x, y1: y };
});
// What a drag with the Building or Wall tool makes: the box itself, or a thin wall along its longer side.
function mmBox(d) {
  let w = Math.abs(d.x1 - d.x0),
    h = Math.abs(d.y1 - d.y0);
  const x = (d.x0 + d.x1) / 2,
    y = (d.y0 + d.y1) / 2;
  if (d.tool === "wall") {
    if (w >= h) h = 0.4;
    else w = 0.4;
  }
  return { x, y, w, h };
}
document.addEventListener("pointermove", (ev) => {
  if (!mmDrag) return;
  const svg = document.getElementById("mmSvg");
  if (!svg || !ui.mm) return void (mmDrag = null);
  const p = mmIn(svgPoint(svg, ev)),
    d = mmDrag;
  if (d.kind === "move") {
    d.o.x = mmSnap(p.x - d.dx, ev);
    d.o.y = mmSnap(p.y - d.dy, ev);
    const el = svg.querySelector(`[data-mm="${d.o.id}"]`);
    if (el) el.setAttribute("transform", `translate(${d.o.x} ${d.o.y})`);
    return;
  }
  d.x1 = mmSnap(p.x, ev);
  d.y1 = mmSnap(p.y, ev);
  const b = mmBox(d),
    r = svg.querySelector("#mmDraft");
  if (r) {
    r.setAttribute("x", b.x - b.w / 2);
    r.setAttribute("y", b.y - b.h / 2);
    r.setAttribute("width", b.w);
    r.setAttribute("height", b.h);
  }
});
document.addEventListener("pointerup", () => {
  const d = mmDrag;
  mmDrag = null;
  if (!d || !ui.mm) return;
  if (d.kind === "draw") {
    let b = mmBox(d);
    // a click with no drag still makes something sensible: a small building, or a short wall
    if (Math.max(b.w, b.h) < 1) b = d.tool === "wall" ? { x: d.x0, y: d.y0, w: 6, h: 0.4 } : { x: d.x0, y: d.y0, w: 8, h: 6 };
    else if (d.tool === "building") b = { ...b, w: Math.max(b.w, 1), h: Math.max(b.h, 1) };
    const o = mmItem(d.tool === "wall" ? "concreteWall" : "building", b.x, b.y, b.w, b.h);
    ui.mm.objects.push(o);
    ui.mm.sel = o.id;
  }
  ui.focus = "#mmSvg";
  render();
});
// ---------- two fingers on the map: pinch to zoom, move both to slide (phones and tablets, spectators too)
// The page's own pinch is off over the map (touch-action: none in the CSS), so the map gets the fingers.
// While the fingers move only the view box changes, which keeps it smooth; the map is redrawn once when they lift.
const fingers = new Map();
let pinch = null;
function fingerPair() {
  const [a, b] = [...fingers.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
document.addEventListener(
  "pointerdown",
  (ev) => {
    if (ev.pointerType !== "touch" || !ev.target.closest || !ev.target.closest("#map")) return;
    if (ev.isPrimary) fingers.clear(); // a new gesture: forget any finger whose lift never arrived
    fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (fingers.size !== 2) return;
    ev.stopPropagation(); // the second finger is not a tap or a drag of its own
    drag = null; // nor is the first one any more
    const svg = document.getElementById("map"),
      r = svg.getBoundingClientRect(),
      v = mapView(),
      f = fingerPair();
    // the map point between the fingers stays between them; upp is meters per screen pixel when the pinch began
    pinch = {
      f,
      k: ui.zoom ? ui.zoom.k : 1,
      at: svgPoint(svg, { clientX: f.x, clientY: f.y }),
      upp: Math.max(v.w / r.width, v.h / r.height),
      w: v.w,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
    };
  },
  true,
);
document.addEventListener(
  "pointermove",
  (ev) => {
    if (!fingers.has(ev.pointerId)) return;
    fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!pinch || fingers.size < 2) return;
    const f = fingerPair();
    setZoom(pinch.k * (f.d / pinch.f.d));
    if (ui.zoom) {
      const upp = pinch.upp * (mapView().w / pinch.w);
      ui.zoom.x = pinch.at.x - (f.x - pinch.cx) * upp;
      ui.zoom.y = pinch.at.y - (f.y - pinch.cy) * upp;
    }
    const v = mapView(),
      svg = document.getElementById("map");
    if (svg) svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  },
  true,
);
for (const type of ["pointerup", "pointercancel"])
  document.addEventListener(
    type,
    (ev) => {
      if (!fingers.delete(ev.pointerId) || !pinch || fingers.size >= 2) return;
      pinch = drag = null; // the finger still down doesn't start a drag
      render();
    },
    true,
  );
// Safari (iPad, iPhone) also sends its own pinch as gesture events; over the map they would zoom the whole page instead.
for (const type of ["gesturestart", "gesturechange"])
  document.addEventListener(
    type,
    (ev) => {
      if (ev.target.closest && ev.target.closest("#map")) ev.preventDefault();
    },
    { passive: false },
  );
// Scroll over the map to zoom in on what's under the pointer.
let wheelQueued = false;
document.addEventListener(
  "wheel",
  (ev) => {
    if (ev.ctrlKey && ev.target.closest && ev.target.closest(".ttreewrap")) {
      ev.preventDefault(); // Ctrl + scroll zooms the skill tree instead of the page
      return ACT.treeZoom((ev.deltaY || 0) < 0 ? 1 : -1);
    }
    const svg = ev.target.closest && ev.target.closest("#map");
    if (!svg) return;
    ev.preventDefault();
    if (ev.shiftKey && ui.mapSel) return ACT.objRotate((ev.deltaY || ev.deltaX) < 0 ? -15 : 15); // Shift+scroll turns the selected object
    const p = svgPoint(svg, ev);
    const v0 = mapView();
    const k0 = ui.zoom ? ui.zoom.k : 1;
    // a mouse wheel notch (about 100) zooms 1.2 times; a trackpad pinch sends many small steps, so it zooms smoothly
    const dy = clamp((ev.deltaY || 0) * (ev.deltaMode === 1 ? 33 : 1), -100, 100);
    setZoom(k0 * Math.exp(-dy * 0.0018), p.x, p.y);
    if (ui.zoom) {
      const v1 = mapView();
      ui.zoom.x = p.x + v1.w / 2 - ((p.x - v0.x) / v0.w) * v1.w;
      ui.zoom.y = p.y + v1.h / 2 - ((p.y - v0.y) / v0.h) * v1.h;
    } // keep the same spot under the pointer
    if (!wheelQueued) {
      wheelQueued = true;
      requestAnimationFrame(() => {
        wheelQueued = false;
        render();
      });
    }
  },
  { passive: false },
);
document.addEventListener("contextmenu", (ev) => {
  const g = ev.target.closest && ev.target.closest("[data-obj]");
  if (g) {
    ev.preventDefault();
    ACT.objDel(g.dataset.obj);
  }
});
