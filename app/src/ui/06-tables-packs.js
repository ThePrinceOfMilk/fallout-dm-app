// ===== 06-tables-packs.js: DATA TABLES AND SAVE PACKS. The dev windows' editable tables, CSV and JSON import and export, .zip save packs,
// loot tables, and the modal window frame (renderModal) that every pop-up uses.
// ----- dev windows: full, editable tables
const R_COLS = Array.from({ length: 10 }, (_, i) => [`hit.${i}`, `R${i + 1}`, "pct"]);
const WEAPON_COLS = {
  SG: [
    ["tier", "T"],
    ["type", "Type", "text"],
    ["ammo", "Ammo", "text"],
    ["auto", "Auto", "bool"],
    ["mag", "Mag"],
    ["reload", "Rld"],
    ["ap", "AP"],
    ["count", "Cnt"],
    ["crit", "Crit", "pct"],
    ["jam", "Jam", "pct"],
    ["str", "STR"],
    ["req", "Skill"],
    ...R_COLS,
    ["lb", "Lb"],
    ["val", "Cap"],
    ["note", "Notes", "text"],
  ],
  EW: [
    ["tier", "T"],
    ["type", "Type", "text"],
    ["ammo", "Ammo", "text"],
    ["status", "Status", "text"],
    ["dmg", "Dam"],
    ["pen", "Pen"],
    ["perShot", "/Sh"],
    ["mag", "Mag"],
    ["reload", "Rld"],
    ["ap", "AP"],
    ["count", "Cnt"],
    ["crit", "Crit", "pct"],
    ["jam", "Jam", "pct"],
    ["str", "STR"],
    ["req", "Skill"],
    ...R_COLS,
    ["lb", "Lb"],
    ["val", "Cap"],
    ["note", "Notes", "text"],
  ],
  EX: [
    ["tier", "T"],
    ["type", "Type", "text"],
    ["ammo", "Ammo", "text"],
    ["dmg", "Dam"],
    ["pen", "Pen"],
    ["radius", "Rad"],
    ["fuze", "Fuze"],
    ["mag", "Mag"],
    ["reload", "Rld"],
    ["ap", "AP"],
    ["count", "Cnt"],
    ["crit", "Crit", "pct"],
    ["jam", "Jam", "pct"],
    ["str", "STR"],
    ["req", "Skill"],
    ...R_COLS,
    ["lb", "Lb"],
    ["note", "Notes", "text"],
  ],
  MW: [
    ["tier", "T"],
    ["type", "Type", "text"],
    ["prName", "1st", "text"],
    ["dmg", "Dam"],
    ["ap", "AP"],
    ["base", "Hit", "pct"],
    ["pen", "Pen"],
    ["seName", "2nd", "text"],
    ["dmg2", "Dam"],
    ["ap2", "AP"],
    ["pen2", "Pen"],
    ["crit", "Crit", "pct"],
    ["jam", "Fail", "pct"],
    ["str", "STR"],
    ["req", "Skill"],
    ["status", "DOT", "text"],
    ["dotCh", "DOT%", "text"],
    ["lb", "Lb"],
    ["val", "Cap"],
    ["note", "Notes", "text"],
  ],
};
WEAPON_COLS.BG = WEAPON_COLS.SG;
const itemKey = (o) => E.low(o.n);
const TABLES = {
  items: () => ({
    title: "Items",
    rows: DATA.items,
    key: itemKey,
    cols: [
      ["cat", "Cat", "text"],
      ["tier", "T", "text"],
      ["effect", "Effect", "text", 260],
      ["ap", "AP"],
      ["uses", "Uses"],
      ["dur", "Dur"],
      ["after", "After effect", "text", 150],
      ["trigger", "Trigger", "text"],
      ["addict", "Add", "pct"],
      ["withdrawal", "Withdrawal", "text", 130],
      ["req", "Requires", "text"],
      ["lb", "Lb"],
      ["val", "Cap"],
    ],
  }),
  weapons: (cls) => ({
    title: "Weapons",
    classes: { SG: "Small Guns", BG: "Big Guns", EW: "Energy", EX: "Explosives", MW: "Melee" },
    rows: DATA.weapons.filter((w) => w.tab === cls),
    key: itemKey,
    cols: WEAPON_COLS[cls],
  }),
  armor: () => ({
    title: "Armor",
    rows: DATA.armor,
    key: itemKey,
    cols: [
      ["tier", "T"],
      ["type", "Type", "text"],
      ["loc", "Slot", "text"],
      ["dt", "DT"],
      ["buffs", "Buffs", "text", 170],
      ["nerfs", "Nerfs", "text", 170],
      ["mech", "Mechanic", "text", 120],
      ["faction", "Faction", "text"],
      ["formal", "Formal"],
      ["note", "Notes", "text", 120],
      ["lb", "Lb"],
      ["val", "Cap"],
    ],
  }),
  ammo: () => ({
    title: "Ammo",
    rows: DATA.ammo,
    key: itemKey,
    cols: [
      ["cal", "Caliber", "text"],
      ["load", "Load", "text"],
      ["dam", "Dam"],
      ["pellets", "Pellets"],
      ["pen", "Pen"],
      ["tier", "T"],
      ["lb", "Lb"],
      ["cls", "Class", "text"],
      ["note", "Note", "text", 180],
    ],
  }),
  mods: () => ({
    title: "Weapon mods",
    rows: DATA.mods,
    key: itemKey,
    cols: [
      ["tier", "T"],
      ["skill", "Skill", "text"],
      ["group", "Group", "text"],
      ["loc", "Slot", "text"],
      ["effect", "Effect", "text", 280],
      ["applies", "Applies to", "text", 140],
      ["lb", "Lb"],
    ],
  }),
  materials: () => ({
    title: "Materials",
    rows: DATA.materials,
    key: itemKey,
    cols: [
      ["cat", "Cat", "text"],
      ["tier", "T", "text"],
      ["lb", "Lb"],
      ["val", "Cap"],
      ["note", "Notes", "text", 200],
    ],
  }),
  recipes: () => ({
    title: "Crafting recipes (reference: crafting comes in a later stage)",
    rows: DATA.recipes,
    key: (o) => "recipe:" + E.low(o.n),
    cols: [
      ["type", "Type", "text"],
      ["station", "Station", "text"],
      ["req", "Requires", "text"],
      ["matsText", "Materials", "text", 420],
    ],
    view: (o) => ({ ...o, matsText: (o.mats || []).map(([m, q]) => (q != null ? `${q} x ${m}` : m)).join(", ") }),
  }),
  enemies: () => ({
    title: "Enemy templates",
    rows: DATA.enemies,
    key: (o) => "enemy:" + E.low(o.n),
    cols: [
      ["tier", "T"],
      ["xp", "XP"],
      ["caps", "Caps", "text"],
      ["faction", "Faction", "text"],
      ...E.SPECIAL.map((k, i) => [`special.${i}`, k]),
      ["hp", "HP"],
      ["dt", "DT"],
      ["ap", "AP"],
      ["pri", "Init"],
      ["w1", "Weapon 1", "text", 130],
      ["w2", "Weapon 2", "text", 130],
      ["armor", "Armor", "text", 110],
    ],
  }),
  traits: () => ({
    title: "Traits",
    rows: DATA.traits,
    key: (o) => "trait:" + o.code,
    cols: [
      ["code", "Roll", "text"],
      ["cat", "Cat", "text"],
      ["ben", "Benefit", "text", 260],
      ["draw", "Drawback", "text", 260],
      ["evo", "Evolution", "text", 120],
      ["evoBonus", "Evo bonus", "text", 220],
      ["evoTrig", "Trigger", "text", 140],
      ["fail", "Fail", "text", 140],
      ["rep", "Repression", "text", 110],
      ["repBonus", "Rep bonus", "text", 180],
    ],
  }),
  perks: () => ({
    title: "Perks",
    rows: [
      ...DATA.levelPerks.map((p) => ({ ...p, kind: "Level" })),
      ...DATA.skillPerks.map((p) => ({ ...p, kind: "Skill", level: p.rank, req: `${p.need}+ ${p.group}` })),
    ],
    key: (o) => perkKey(o.n),
    cols: [
      ["kind", "Kind", "text"],
      ["level", "Level", "text"],
      ["req", "Requires", "text", 120],
      ["effect", "Effect", "text", 520],
    ],
  }),
  statuses: () => ({
    title: "Status effects",
    rows: DATA.statuses,
    key: (o) => "status:" + E.low(o.n),
    cols: [
      ["mp", "M/P", "text"],
      ["tone", "Tone", "text"],
      ...[0, 1, 2, 3, 4].map((i) => [`tiers.${i}`, `Tier ${i + 1}`, "text", 170]),
      ["counters", "Counters", "text", 120],
    ],
  }),
};
// ----- every table can leave the app for a spreadsheet and come back, as long as the columns match
// Each entry says where a table's rows live. perks are two workbook tables shown as one, so a kind column keeps them apart.
const TABLE_IO = {
  items: "items",
  armor: "armor",
  weapons: "weapons",
  ammo: "ammo",
  mods: "mods",
  materials: "materials",
  recipes: "recipes",
  enemies: "enemies",
  traits: "traits",
  statuses: "statuses",
  effects: "sc",
  perks: "perks",
  loot: "loot",
};
function tableRows(id) {
  if (id === "perks") return [...DATA.levelPerks.map((p) => ({ kind: "Level", ...p })), ...DATA.skillPerks.map((p) => ({ kind: "Skill", ...p }))];
  if (id === "loot") return S.rules.lootTable.map(([roll, shift]) => ({ roll, shift }));
  return DATA[TABLE_IO[id]];
}
const toCsv = (rows) => {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    const t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function fromCsv(text, like = []) {
  // A column that only ever holds text in the app's own table stays text, so a trait code "007" or a level "2.0" comes back unchanged.
  const isText = {};
  for (const r of like) for (const k in r) if (r[k] != null) isText[k] = isText[k] !== false && typeof r[k] === "string";
  // Reads spreadsheet text one character at a time, because quoted cells can hold commas and line breaks.
  const rows = [];
  let row = [],
    cur = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== "")) rows.push(row);
  const head = rows.shift() || [];
  // Turns cell text back into numbers, true or false, and lists, so a spreadsheet round trip changes nothing.
  const val = (t, k) => {
    if (t === "") return undefined;
    if (isText[k])
      return t.replace(/^(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i, (_, d, m) => `${MONTHS.indexOf(m.toLowerCase()) + 1}-${d}`); // Excel turns "5-15" into 15-May
    if (t === "true") return true;
    if (t === "false") return false;
    if (/^[[{]/.test(t)) {
      try {
        return JSON.parse(t);
      } catch (e) {
        return t;
      }
    }
    return /^-?\d*\.?\d+(e-?\d+)?$/i.test(t) ? Number(t) : t;
  };
  return rows.map((r) => {
    const o = {};
    head.forEach((k0, i) => {
      const k = k0.replace(/^﻿/, "");
      const v = val(r[i] == null ? "" : r[i], k);
      if (v !== undefined) o[k] = v;
    });
    return o;
  });
}
// ----- packs. A .zip holds: campaign.json, rules.json, tables/*.csv, readme.txt.
const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
/** Writes a zip with no compression. It's the simplest form every tool can open, and packs are small enough. */
function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [],
    central = [];
  let offset = 0;
  const le = (n, size) => {
    const out = new Uint8Array(size);
    for (let i = 0; i < size; i++) out[i] = (n >>> (8 * i)) & 255;
    return out;
  };
  const join = (...a) => {
    const out = new Uint8Array(a.reduce((t, x) => t + x.length, 0));
    let p = 0;
    for (const x of a) {
      out.set(x, p);
      p += x.length;
    }
    return out;
  };
  for (const [name, text] of files) {
    const nm = enc.encode(name),
      data = enc.encode(text),
      crc = le(crc32(data), 4),
      size = le(data.length, 4);
    const common = join(le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), crc, size, size, le(nm.length, 2), le(0, 2)); // 0x0800: names are UTF-8
    const head = join(le(0x04034b50, 4), common, nm);
    parts.push(head, data);
    central.push(join(le(0x02014b50, 4), le(20, 2), common, le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(offset, 4), nm));
    offset += head.length + data.length;
  }
  const cd = join(...central);
  return join(...parts, cd, le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(cd.length, 4), le(offset, 4), le(0, 2));
}
/** Reads a zip, including one re-saved by WinRAR, 7-Zip or Windows, which compress with "deflate". */
/** Unpacks "deflate" data, the compression WinRAR, 7-Zip and Windows use inside a zip. Built in, so no browser feature is needed. */
function inflate(src) {
  const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  const bad = () => new Error("That zip is damaged.");
  const out = [];
  let pos = 0,
    buf = 0,
    cnt = 0;
  const bits = (n) => {
    while (cnt < n) {
      if (pos >= src.length) throw bad();
      buf |= src[pos++] << cnt;
      cnt += 8;
    }
    const v = buf & ((1 << n) - 1);
    buf >>>= n;
    cnt -= n;
    return v;
  };
  // A code table: how many codes there are of each length, and the symbols in code order.
  const table = (lens) => {
    const count = new Array(16).fill(0),
      offs = new Array(16).fill(0),
      sym = [];
    for (const l of lens) count[l]++;
    count[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    lens.forEach((l, i) => {
      if (l) sym[offs[l]++] = i;
    });
    return { count, sym };
  };
  const decode = (h) => {
    let code = 0,
      first = 0,
      index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.sym[index + (code - first)];
      index += c;
      first = (first + c) << 1;
      code <<= 1;
    }
    throw bad();
  };
  let last;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      // stored as is: skip to the next whole byte, read the length, copy
      buf = 0;
      cnt = 0;
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      for (let i = 0; i < len; i++) out.push(src[pos++]);
      continue;
    }
    if (type === 3) throw bad();
    let lt, dt;
    if (type === 1) {
      lt = table([...Array(144).fill(8), ...Array(112).fill(9), ...Array(24).fill(7), ...Array(8).fill(8)]);
      dt = table(Array(30).fill(5));
    } else {
      const nl = bits(5) + 257,
        nd = bits(5) + 1,
        nc = bits(4) + 4;
      const cl = Array(19).fill(0);
      for (let i = 0; i < nc; i++) cl[ORDER[i]] = bits(3);
      const ct = table(cl),
        lens = [];
      while (lens.length < nl + nd) {
        const s = decode(ct);
        if (s < 16) lens.push(s);
        else {
          const [prev, n] = s === 16 ? [lens[lens.length - 1], 3 + bits(2)] : s === 17 ? [0, 3 + bits(3)] : [0, 11 + bits(7)];
          for (let i = 0; i < n; i++) lens.push(prev);
        }
      }
      lt = table(lens.slice(0, nl));
      dt = table(lens.slice(nl, nl + nd));
    }
    for (;;) {
      const s = decode(lt);
      if (s === 256) break;
      if (s < 256) out.push(s);
      else {
        const len = LB[s - 257] + bits(LE[s - 257]);
        const ds = decode(dt);
        const d = DB[ds] + bits(DE[ds]);
        if (d > out.length) throw bad();
        for (let i = 0; i < len; i++) out.push(out[out.length - d]);
      }
    }
  } while (!last);
  return new Uint8Array(out);
}
async function readZip(buf) {
  const b = new Uint8Array(buf),
    v = new DataView(buf);
  let e = b.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("That isn't a zip file.");
  const count = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const out = {};
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("That zip is damaged.");
    const method = v.getUint16(p + 10, true),
      csize = v.getUint32(p + 20, true),
      nl = v.getUint16(p + 28, true),
      xl = v.getUint16(p + 30, true),
      cl = v.getUint16(p + 32, true),
      off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    const raw = b.subarray(start, start + csize);
    if (!name.endsWith("/")) {
      if (method === 0) out[name] = new TextDecoder().decode(raw);
      else if (method === 8) out[name] = new TextDecoder().decode(inflate(raw));
      else throw new Error(`Can't read ${name}: unsupported compression.`);
    }
    p += 46 + nl + xl + cl;
  }
  return out;
}
const PACK_TABLES = ["items", "armor", "weapons", "ammo", "mods", "materials", "recipes", "enemies", "traits", "statuses", "effects", "perks", "loot"];
function packFiles() {
  const { tables, tableRev, rules, ...campaign } = S;
  const readme =
    "FALLOUT DM PACK\n\ncampaign.json: party, notes, log, the current scene and any fight.\nrules.json: every rule number, room setting, archetype and furniture item.\ntables/*.csv: every table. Open in Excel or Sheets, keep the column names, and save as CSV again.\nExcel may show a range such as 5-15 as a date (15-May) and drop the zeros from a code such as 007. The app puts both back on load.\n\nThe fx and use columns are what the game applies. Change a written effect and the app reads it again on load. Change fx or use instead to set the variables yourself.\nThe Variables window in the app lists what each variable means.\n\nTo load: keep it a .zip (WinRAR can save as zip), then use Load pack in the app.\n";
  return [
    ["readme.txt", readme],
    ["campaign.json", JSON.stringify(campaign, null, 1)],
    ["rules.json", JSON.stringify(rules, null, 1)],
    ...PACK_TABLES.map((id) => [`tables/${id}.csv`, toCsv(tableRows(id))]),
  ];
}
// What each table looks like with no edits, so a pack only stores the ones someone really changed.
function baseCsv(id) {
  const rows =
    id === "perks"
      ? [...baseTable("levelPerks").map((p) => ({ kind: "Level", ...p })), ...baseTable("skillPerks").map((p) => ({ kind: "Skill", ...p }))]
      : baseTable(TABLE_IO[id]);
  return toCsv(rows).trim().replace(/\r\n/g, "\n");
}
async function loadPack(buf) {
  const files = await readZip(buf);
  const pick = (name) =>
    Object.keys(files).find(
      (k) =>
        k.replace(/^.*?(campaign\.json|rules\.json|tables\/)/i, "$1").toLowerCase() === name ||
        k.toLowerCase().endsWith("/" + name) ||
        k.toLowerCase() === name,
    );
  const cname = pick("campaign.json");
  if (!cname) throw new Error("That zip has no campaign.json, so it isn't a pack.");
  const campaign = JSON.parse(files[cname]);
  const rn = pick("rules.json");
  campaign.rules = rn ? JSON.parse(files[rn]) : S.rules;
  const p = normalize({ ...campaign, tables: {}, tableRev: (S.tableRev || 0) + 1 });
  let edited = 0;
  for (const id of PACK_TABLES) {
    const name = pick(`${id}.csv`);
    if (!name) continue;
    const text = files[name].replace(/^﻿/, "");
    if (id === "loot") {
      p.rules.lootTable = fromCsv(text).map((r) => [r.roll, r.shift]);
      continue;
    }
    if (text.trim().replace(/\r\n/g, "\n") === baseCsv(id)) continue;
    const rows = fromCsv(text, tableRows(id));
    if (rows.some((r) => !r.n)) throw new Error(`${id}.csv: every row needs a name in the n column.`);
    edited++;
    if (id === "perks") {
      p.tables.levelPerks = shrinkTable(
        "levelPerks",
        rows.filter((r) => r.kind !== "Skill").map(({ kind, ...r }) => r),
      );
      p.tables.skillPerks = shrinkTable(
        "skillPerks",
        rows.filter((r) => r.kind === "Skill").map(({ kind, ...r }) => r),
      );
    } else p.tables[TABLE_IO[id]] = shrinkTable(TABLE_IO[id], rows);
  }
  act("Load pack", () => {
    S = p;
    ui.sel = (S.chars[0] || {}).id;
    ui.atk = null;
    ui.modal = null;
    ui.end = null;
    ui.def = null;
    ui.pendingMove = null;
  });
  return edited;
}
function importTable(id, rows) {
  if (!Array.isArray(rows) || !rows.length) return "That file has no rows.";
  const known = new Set(tableRows(id).flatMap((r) => Object.keys(r)));
  for (const k of [
    "fx",
    "use",
    "when",
    "rows",
    "useFrom",
    "fxFrom",
    "noteFrom",
    "parsed",
    "mods",
    "note",
    "sheetMods",
    "faction",
    "caps",
    "vanity",
    "head",
    "armor",
  ])
    known.add(k);
  const extra = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !known.has(k));
  if (extra.length) return `Wrong format: this table has no column called ${extra.slice(0, 4).join(", ")}.`;
  if (id !== "loot" && rows.some((r) => !r.n)) return "Wrong format: every row needs a name in the n column.";
  act(`Import ${id}`, () => {
    if (id === "loot") {
      S.rules.lootTable = rows.map((r) => [r.roll, r.shift]);
      return;
    }
    S.tables = S.tables || {};
    if (id === "perks") {
      S.tables.levelPerks = shrinkTable(
        "levelPerks",
        rows.filter((r) => r.kind !== "Skill").map(({ kind, ...r }) => r),
      );
      S.tables.skillPerks = shrinkTable(
        "skillPerks",
        rows.filter((r) => r.kind === "Skill").map(({ kind, ...r }) => r),
      );
    } else S.tables[TABLE_IO[id]] = shrinkTable(TABLE_IO[id], rows);
    S.tableRev = (S.tableRev || 0) + 1;
    log("status", `Table replaced from a file: ${id}, ${rows.length} rows.`);
  });
  return "";
}
const tableTools = (id) =>
  TABLE_IO[id]
    ? `<span class="iobar">${btn("tableExport", `${id}|csv`, "Export CSV", "", "tiny")}<label class="btn tiny">Import<input type="file" id="tableFile" data-table="${id}" accept=".csv" style="display:none"></label>${S.tables && (S.tables[TABLE_IO[id]] || (id === "perks" && S.tables.levelPerks)) ? btn("tableReset", id, "Back to workbook", "", "tiny danger") : ""}</span>`
    : "";
function devWin() {
  return devTable() + (ui.modal.cat === "enemies" ? nameLists() : "");
}
function devTable() {
  const m = ui.modal;
  if (m.cat === "variables")
    return `${tableTools("effects")}<div class="s dim" style="margin:3px 0">Every effect the rules apply by themselves. Items, statuses, perks, traits and armor store these names in their fx column. Export a table to edit them in a spreadsheet.</div><table class="t"><tr><th>Variable</th><th>What it changes</th></tr>${Object.entries(
      E.VARS,
    )
      .map(([k, v]) => `<tr><td class="bright">${h(k)}</td><td>${h(v)}</td></tr>`)
      .join("")}</table><h3>Not converted (${SKIPPED.length})</h3><table class="t"><tr><th>Type</th><th>Name</th><th>Why</th></tr>${SKIPPED.slice(0, 400)
      .map(([t, n, w]) => `<tr><td class="dim">${h(t)}</td><td>${h(n)}</td><td class="s">${h(w)}</td></tr>`)
      .join("")}</table>`;
  if (m.cat === "loot") return `${tableTools("loot")}${lootTables()}`;
  if (m.cat === "report") return `<pre class="rep">${h(DATA.report || "Rebuild to include the report.")}</pre>`;
  if (m.cat === "state")
    return `<div class="s dim" style="margin-bottom:3px">The whole campaign as JSON. Edit it and apply; Undo brings the old version back.</div><div class="acts">${btn("rawApply", "", "Apply", "", "primary")}${btn("rawReload", "", "Reload from current")}</div><textarea id="rawState" spellcheck="false" style="height:calc(100% - 52px)" data-u="modal.raw">${h(m.raw)}</textarea>`;
  const def = TABLES[m.cat](m.cls);
  const q = E.low(m.q);
  let rows = def.rows
    .map((o) => {
      const key = def.key(o);
      const v = { ...(def.view ? def.view(o) : o), ...(S.overrides[key] || {}) };
      return { o, key, v };
    })
    .filter((r) => !q || E.low(r.v.n).includes(q) || JSON.stringify(r.v).toLowerCase().includes(q));
  if (m.sort) {
    const dir = m.dir || 1;
    rows = [...rows].sort((a, b) => {
      const x = m.sort === "n" ? a.v.n : getPath(a.v, m.sort),
        y = m.sort === "n" ? b.v.n : getPath(b.v, m.sort);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true })) * dir;
    });
  }
  const size = m.cat === "enemies" ? Math.max(1, rows.length) : 60;
  /* every enemy on one page */ const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = clamp(m.page || 0, 0, pages - 1);
  const shown = rows.slice(page * size, page * size + size);
  const head = def.cols.map(([k, l]) => `<th data-a="devSort" data-v="${h(k)}">${h(l)}${m.sort === k ? (m.dir > 0 ? " ^" : " v") : ""}</th>`).join("");
  const body = shown
    .map(
      (r, ri) =>
        `<tr class="${r.v.ok === undefined && r.o.tab ? "gap" : ""}"><td class="stick" title="${h(r.v.n)}">${h(r.v.n)}</td>${def.cols
          .map(([k, , kind, w], ci) => {
            const val = getPath(r.v, k);
            const edited = S.overrides[r.key] && getPath(S.overrides[r.key], k) !== undefined;
            if (kind === "bool") return `<td><input type="checkbox" data-ov="${h(r.key)}|${k}|bool" id="dc-${ri}-${ci}"${val ? " checked" : ""}></td>`;
            const text = kind === "pct" ? (val == null ? "" : E.pct(val)) : val == null ? "" : val;
            return `<td style="min-width:${w || (kind === "text" ? 92 : 34)}px"><input type="text" autocomplete="off" class="cell left ${edited ? "ovr" : ""}" style="width:100%" title="${h(text)}" data-ov="${h(r.key)}|${k}|${kind || "num"}" id="dc-${ri}-${ci}" value="${h(text)}"></td>`;
          })
          .join("")}<td>${S.overrides[r.key] ? btn("ovReset", r.key, "Reset", "", "tiny") : ""}</td></tr>`,
    )
    .join("");
  return `<div class="row wrap" style="margin-bottom:3px">${tableTools(m.cat)}${
    def.classes
      ? Object.entries(def.classes)
          .map(([c, n]) => `<button class="opt ${m.cls === c ? "on" : ""}" data-a="devClass" data-v="${c}">${n}</button>`)
          .join("")
      : ""
  }<input id="devQ" autocomplete="off" placeholder="Filter" data-u="modal.q" value="${h(m.q)}" style="width:180px"><span class="s dim">${rows.length} rows. Every box is editable. Yellow means edited by you. Click a heading to sort.</span><span class="spacer"></span>${pages > 1 ? `${btn("devPage", "-1", "Prev", "", "tiny")}<span class="s">${page + 1}/${pages}</span>${btn("devPage", "1", "Next", "", "tiny")}` : ""}</div><table class="t"><tr><th class="stick" data-a="devSort" data-v="n">Name</th>${head}<th></th></tr>${body}</table>`;
}
function nameLists() {
  const pools = S.rules.namePools || {};
  const used = (k) =>
    Object.entries(S.rules.nameStyles || {})
      .filter(([, st]) => [st.first, st.last, st.nick].includes(k))
      .map(([f]) => f)
      .join(", ") || "no faction yet";
  return `<h3 style="margin-top:8px">Enemy names</h3><div class="s dim">Generic enemies pick from these when they join: "Legion Soldier - Vulpa". Separate names with commas. Export JSON above saves these with the enemies; Refresh at the top loads edits into the menus.</div>
  <div class="namegrid">${Object.keys(pools)
    .map(
      (k) =>
        `<label><span>${h(k)} <span class="dim">(${String(pools[k]).split(",").filter(Boolean).length}, used by ${h(used(k))})</span></span><textarea id="np-${h(k)}" rows="4" data-c="setNamePool" data-k="${h(k)}">${h(String(pools[k]).split(",").join(", "))}</textarea></label>`,
    )
    .join("")}</div>`;
}
function lootTables() {
  const t = S.rules.lootTable;
  const caps = DATA.enemies.filter((e) => !e.test && e.caps).map(enemyV);
  const tiers = [1, 2, 3, 4, 5, 6]
    .map((tier) => {
      const it = DATA.items.filter((i) => i.effect && Number(i.tier) === tier && ["Healing", "Chem/Drug", "Drink", "Food", "Alcohol"].includes(i.cat));
      return `<tr><td>T${tier}</td><td>${E.poolFor(ctx(), ["SG", "BG", "EW"], tier).filter((w) => w.tier === tier).length}</td><td>${E.poolFor(ctx(), ["MW"], tier).filter((w) => w.tier === tier).length}</td><td class="s">${h(it.map((i) => i.n).join(", ") || "none")}</td></tr>`;
    })
    .join("");
  return `<div class="ops" style="grid-template-columns:200px minmax(0,1fr) minmax(0,1.6fr);height:100%"><div style="overflow:auto"><h3>d20: average tier</h3><table class="t"><tr><th>Roll</th><th>Tier shift</th></tr>${t.map((r, i) => `<tr><td>${h(r[0])}</td><td>${numBox(`data-rule="lootTable.${i}.1" data-rt="num" id="lt-${i}"`, r[1], "cell")}</td></tr>`).join("")}</table></div>
    <div style="overflow:auto"><h3>Enemy caps</h3><table class="t"><tr><th>Enemy</th><th>T</th><th>Caps</th></tr>${caps.map((e, i) => `<tr><td>${h(e.n)}</td><td>${h(e.tier)}</td><td><input type="text" autocomplete="off" class="cell" data-ov="enemy:${h(E.low(e.n))}|caps|text" id="lc-${i}" value="${h(e.caps)}"></td></tr>`).join("")}</table></div>
    <div style="overflow:auto"><h3>What generated enemies can carry</h3><table class="t"><tr><th>Tier</th><th>Guns</th><th>Melee</th><th>Consumables</th></tr>${tiers}</table><div class="s dim" style="margin-top:4px">The workbook's faction loot columns (Raider, NCR, Legion and so on) are empty, so faction doesn't change loot yet. Looting stays manual: the after-action screen lets you hand things out.</div></div></div>`;
}

// ----- context windows
function dlgStyle(type) {
  const d = ui.dlg[type];
  if (!d) return "";
  return `position:fixed;left:${d.x}px;top:${d.y}px;width:${d.w}px;height:${d.h}px;max-height:none;margin:0;`;
}
function renderModal() {
  const m = ui.modal;
  const ce = ent(m.id);
  const defs = {
    move: [`Move: ${h((ent(m.att) || {}).name)}`, moveModal],
    item: [`Use item: ${h((ent(m.who) || {}).name)}`, itemModal],
    status: [`Status: ${h((ce || {}).name)}`, statusModal],
    edit: [`Edit: ${h((ce || {}).name)}`, editModal],
    level: [`${h((ce || {}).name)}: now level ${(ce || {}).level}`, levelModal],
    help: ["Keys", helpModal],
    table: ["Shared table", tableModal],
    search: ["Search", searchModal],
    detail: [m.hit ? `${h(m.hit[1].n)} [${h(m.hit[0])}]` : "", detailModal],
    dev: [m.cat ? h((DEV.find(([id]) => id === m.cat) || [])[1]) : "", devWin],
    settings: ["Settings: game rules", settingsBody],
    items: ["Item browser", itemsBody],
    loadWin: ["Load save", loadBody],
    autoWin: ["Autosave", autoBody],
    uiScale: ["UI size", scaleBody],
    saveTo: ["Save", saveToBody],
    notes: ["Old notes", notesBody],
    check: ["Skill check", checkBody],
    sheet: [`${h((ce || {}).name)}: Character`, sheetBody],
    health: [`${h((ce || {}).name)}: Health`, healthBody],
    guide: ["How to use this", guideBody],
    wizard: ["New character", wizardBody],
    newc: ["New campaign", newcBody],
    pwide: [m.side === "enemies" ? "All enemies" : "Party-wide", pwBody],
    char: [`${h((ce || {}).name)}: Inventory`, () => (ce ? invSect(ce, der(ce)) : "")],
    icon: [`${h((ce || {}).name)}: map icon`, iconModal],
    vendor: ["Vendor", vendorWin],
    reward: ["Rewards rolled", rewardBody],
    skillTree: ["Skill tree", () => treeModal("skill")],
    levelPerks: ["Level perks", () => treeModal("level")],
    factions: ["Factions", factionsBody],
    mapmaker: [ui.mm && ui.mm.id ? "Map creator: edit" : "Map creator: new map", mapMakerBody],
  };
  const [title, body] = defs[m.type];
  const key = m.type === "dev" ? "dev" : m.type;
  const size =
    m.type === "dev" || m.type === "mapmaker"
      ? "full"
      : ["edit", "help", "char", "items", "notes", "sheet", "health", "guide", "wizard", "vendor", "skillTree", "levelPerks", "factions", "detail"].includes(
            m.type,
          )
        ? "big"
        : ["autoWin", "move", "uiScale", "saveTo"].includes(m.type)
          ? "tiny"
          : "";
  return `<div class="scrim" data-a="closeModal"><div class="dialog float ${size}" data-a="noop" data-dlg="${key}" style="${dlgStyle(key)}" role="dialog" aria-modal="true"><header class="wt"><span>${title}</span><span class="spacer"></span><button class="btn tiny" data-a="closeModal" data-v="">${kbd("Esc")}Close</button></header><div class="wb" data-scroll="modal-${key}">${body()}</div></div></div>`;
}
function iconModal() {
  const e = ent(ui.modal.id);
  if (!e) return "";
  const cur = e.icon || "person";
  const pick = (id) =>
    `<button class="iconpick ${cur === id ? "on" : ""}" data-a="iconSet" data-v="${e.id}|${id}" aria-pressed="${cur === id}">${iconSvg(id, "big")}<span>${h(TOKEN_ICONS[id][0])}</span></button>`;
  const listed = new Set(ICON_GROUPS.flatMap(([, ids]) => ids));
  const groups = [...ICON_GROUPS, ["Other", Object.keys(TOKEN_ICONS).filter((id) => !listed.has(id))]];
  return `<div class="s dim" style="margin-bottom:4px">How ${h(e.name)} shows on the map.</div>${groups
    .map(([g, ids]) => ids.filter((id) => TOKEN_ICONS[id]))
    .map((ids, i) => (ids.length ? `<h4 class="icongroup">${h(groups[i][0])}</h4><div class="icongrid">${ids.map(pick).join("")}</div>` : ""))
    .join("")}`;
}
