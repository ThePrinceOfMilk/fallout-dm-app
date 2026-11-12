// ===== 07-mapmaker.js: THE MAP CREATOR. Draw a location once and keep it with the campaign. Its mouse and touch input is in 11-input.js.
// ---------- MAP CREATOR: draw a location once, keep it with the campaign, pick it under Location like any other.
const MM_SHAPES = [
  ["rect", "Rectangle"],
  ["L", "L-shape"],
  ["U", "U-shape"],
  ["T", "T-shape"],
  ["plus", "Cross"],
  ["oct", "Cut corners"],
];
const MM_TOOLS = [
  ["select", "Select / move", "Click a thing to select it, drag to move it."],
  ["building", "Building", "Drag on the map to draw a building of any size. Nobody can walk or shoot through it."],
  ["wall", "Wall", "Drag to draw a wall. It runs along the longer side of your drag."],
  ["item", "Cover / item", "Pick from the menu, then click the map to place it."],
];
// The playable area is always a W x H box. Any other shape is that box with parts closed off by out-of-bounds blocks.
function mmVoids(shape, w, h) {
  const g = S.rules.gridM || 2;
  const snap = (x) => Math.max(g, Math.round(x / g) * g);
  const W = w / 2,
    H = h / 2,
    a = snap(w / 2),
    b = snap(h / 2),
    cw = snap(w / 3),
    ch = snap(h / 3);
  const box = (x0, y0, x1, y1, angle) => {
    const o = {
      item: "void",
      kind: "cover",
      cover: "impenetrable",
      block: true,
      voidBlock: true,
      x: E.fix((x0 + x1) / 2),
      y: E.fix((y0 + y1) / 2),
      w: E.fix(x1 - x0),
      h: E.fix(y1 - y0),
      label: "",
    };
    if (angle) o.angle = angle;
    return o;
  };
  if (shape === "L") return [box(W - a, -H, W, -H + b)];
  if (shape === "U") return [box(-cw / 2, -H, cw / 2, -H + b)];
  if (shape === "T") return [box(-W, H - b, -cw / 2, H), box(cw / 2, H - b, W, H)];
  if (shape === "plus") return [box(-W, -H, -cw / 2, -ch / 2), box(cw / 2, -H, W, -ch / 2), box(-W, ch / 2, -cw / 2, H), box(cw / 2, ch / 2, W, H)];
  if (shape === "oct") {
    const s = (Math.min(w, h) / 4) * Math.SQRT2; // a square turned 45 degrees on each corner cuts it off
    return [
      [-W, -H],
      [W, -H],
      [-W, H],
      [W, H],
    ].map(([x, y]) => box(x - s / 2, y - s / 2, x + s / 2, y + s / 2, 45));
  }
  return [];
}
function mmNew(id) {
  const src = id && (S.customMaps || {})[id];
  ui.mm = src
    ? {
        id,
        name: src.n,
        w: src.w,
        h: src.h,
        shape: src.shape || "rect",
        objects: clone(src.objs)
          .filter((o) => !o.voidBlock)
          .map((o, i) => ({ ...o, id: "m" + i })),
        tool: "select",
        item: "crate",
        sel: null,
        seq: src.objs.length,
      }
    : { id: null, name: "", w: 30, h: 20, shape: "rect", objects: [], tool: "building", item: "crate", sel: null, seq: 0 };
}
const mmAll = () => [...mmVoids(ui.mm.shape, ui.mm.w, ui.mm.h), ...ui.mm.objects];
function mmItem(key, x, y, w, h) {
  const c = S.rules.mapItems[key];
  const o = {
    id: "m" + ui.mm.seq++,
    item: key,
    kind: c.round ? "tree" : "cover",
    x: E.fix(x),
    y: E.fix(y),
    w: E.fix(w || c.w),
    h: E.fix(h || c.h),
    cover: c.cover,
    label: "",
  };
  if (c.block) o.block = true;
  if (c.round) o.round = true;
  return o;
}
function mapMakerBody() {
  const m = ui.mm;
  if (!m) return "";
  const g = S.rules.gridM || 2,
    pad = Math.max(m.w, m.h) * 0.04 + 1;
  let grid = "";
  for (let x = -m.w / 2 + g; x < m.w / 2 - 0.01; x += g) grid += `M${x} ${-m.h / 2}V${m.h / 2}`;
  for (let y = -m.h / 2 + g; y < m.h / 2 - 0.01; y += g) grid += `M${-m.w / 2} ${y}H${m.w / 2}`;
  const sel = m.objects.find((o) => o.id === m.sel);
  const nameOf = (o) => (S.rules.mapItems[o.item] || {}).n || o.item;
  const draw = (o) => {
    const tier = E.coverTier(o, S.rules);
    const gl = GLYPH[ITEM_GLYPH[o.item] || KIND_GLYPH[o.kind] || "crate"];
    const turn = o.angle ? `rotate(${o.angle}) ` : "";
    const art = turn + (o.rot ? `rotate(90) scale(${o.h} ${o.w})` : `scale(${o.w} ${o.h})`);
    return `<g class="obj ${o.kind} tier-${tier} ${o.voidBlock ? "oob" : ""} ${m.sel === o.id ? "sel" : ""}"${o.voidBlock ? "" : ` data-mm="${o.id}"`} transform="translate(${o.x} ${o.y})"><title>${h(nameOf(o))}: ${h((S.rules.cover[tier] || {}).n || "")}, ${fmt(o.w)} x ${fmt(o.h)} m</title><g class="gly" transform="${art}">${gl}</g></g>`;
  };
  const tiers = [
    ["impenetrable", "Walls and buildings"],
    ["hard", "Hard cover"],
    ["soft", "Soft cover"],
    ["concealment", "Concealment"],
    ["open", "Open ground and props"],
  ];
  const menu = tiers
    .map(
      ([t, label]) =>
        `<optgroup label="${label}">${Object.entries(S.rules.mapItems)
          .filter(([k, c]) => c.cover === t && k !== "void")
          .sort((a, b) => a[1].n.localeCompare(b[1].n))
          .map(([k, c]) => `<option value="${k}"${m.item === k ? " selected" : ""}>${h(c.n)} ${c.w}x${c.h}m</option>`)
          .join("")}</optgroup>`,
    )
    .join("");
  const tool = MM_TOOLS.find(([id]) => id === m.tool);
  const selBox = sel
    ? `<div class="mmsel"><div class="bright">${h(nameOf(sel))}</div><div class="grid" style="grid-template-columns:1fr 1fr">${field("Width (m)", numBox(`id="mmOW" data-c="mmObjSize" data-k="w"`, sel.w))}${field("Depth (m)", numBox(`id="mmOH" data-c="mmObjSize" data-k="h"`, sel.h))}</div><div class="acts">${btn("mmTurn", "", "Turn 90°", "", "tiny")}${btn("mmDel", "", "Remove", "", "tiny danger", "Or press Delete")}</div></div>`
    : "";
  const side = `<div class="mmside">
    ${field("Name", `<input type="text" id="mmName" autocomplete="off" placeholder="e.g. Raider gas station" data-u="mm.name" value="${h(m.name)}">`)}
    <div class="grid" style="grid-template-columns:1.4fr 1fr 1fr">${field("Shape", `<select id="mmShape" data-c="mmShape">${options(MM_SHAPES, m.shape)}</select>`)}${field("Width (m)", numBox(`id="mmW" data-c="mmSize" data-k="w"`, m.w))}${field("Height (m)", numBox(`id="mmH" data-c="mmSize" data-k="h"`, m.h))}</div>
    <h3>Add to the map</h3>
    <div class="opts mmtools">${MM_TOOLS.map(([id, n]) => `<button class="opt ${m.tool === id ? "on" : ""}" data-a="mmTool" data-v="${id}" aria-pressed="${m.tool === id}">${n}</button>`).join("")}</div>
    ${field("Cover and items", `<select id="mmItem" data-c="mmPick">${menu}</select>`)}
    <div class="s dim" id="mmHint">${h(tool[2])} Hold Shift to place off the half-meter steps.</div>
    ${selBox}
    <div class="s dim">${m.w} x ${m.h} m, ${m.objects.length} thing${m.objects.length === 1 ? "" : "s"} placed. The party starts at the middle of the left edge.</div>
    <div class="acts">${primary("mmSave", "", m.id ? "Save changes" : "Save map")}${btn("mmClear", "", "Clear")}${m.id ? btn("mmRemove", "", "Delete map", "", "danger") : ""}${btn("closeModal", "", "Cancel")}</div>
  </div>`;
  const svg = `<div class="mmcanvas"><svg id="mmSvg" tabindex="-1" class="tool-${m.tool}" viewBox="${-m.w / 2 - pad} ${-m.h / 2 - pad} ${m.w + 2 * pad} ${m.h + 2 * pad}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map being drawn, ${m.w} by ${m.h} meters"><rect class="floor" x="${-m.w / 2}" y="${-m.h / 2}" width="${m.w}" height="${m.h}"/><path class="grid" d="${grid}"/>${mmAll().map(draw).join("")}<rect id="mmDraft" class="draft" width="0" height="0"/></svg></div>`;
  return `<div class="mmwrap">${side}${svg}</div>`;
}
