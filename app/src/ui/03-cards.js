// ===== 03-cards.js: WINDOWS AND CARDS. Rewards, recent events, notes, the dev bar, the party and enemy windows, character cards,
// weapon and gear boxes, the hit table, cover, objects' HP, chests, status icons, familiarity, map effect animations,
// throwing, the body map, the Health tab and its implant list, and vendor prices.
// ---------- pixel icons, 8x8
const ICONS = {
  flag: "#....... ######.. #######. ######.. #....... #....... #....... #.......",
  gear: "..#..#.. .######. .#....#. ##.##.## ##.##.## .#....#. .######. ..#..#..",
  floppy: "#######. #.#..#.# #.#..#.# #.####.# #......# #.####.# #.#..#.# ########",
  folder: ".###.... #...#### #......# ######## #......# #......# #......# ########",
  clock: "..####.. .#.##.#. #..##..# #..###.# #......# #......# .#....#. ..####..",
  book: "######.. #.#...#. #.#.#.#. #.#...#. #.#.#.#. #.#...#. #.#####. ########",
  log: "######## #......# #.####.# #......# #.####.# #......# #.##...# ########",
  box: "######## #..##..# ######## #......# #.####.# #......# #......# ########",
  pencil: "......## .....### ....###. ...###.. ..###... .###.... ##...... #.......",
  gun: "........ ######## ######## ..###... ..##.#.. ..####.. ..##.... ..##....",
  sword: "......## .....### ....###. #..###.. ####.... .##..... #.##.... #...#...",
  bolt: "....##.. ...##... ..##.... .#####.. ...##... ..##.... .##..... .#......",
  bomb: ".....#.# ....#... ..###... .#####.. #######. #######. .#####.. ..###...",
  ammo: ".#...#.. ###.###. ###.###. ###.###. ###.###. ###.###. ###.###. ###.###.",
  vest: "##....## ######## .######. .##..##. .######. .##..##. .######. .######.",
  ring: "..####.. .#....#. #......# #......# #......# #......# .#....#. ..####..",
  cross: "..####.. ..#..#.. ###..### #......# #......# ###..### ..#..#.. ..####..",
  syringe: ".....##. ....#.## ...#..#. ..#..#.. .#..#... #..#.... #.#..... .#......",
  bottle: "...##... ...##... ...##... ..####.. .######. .#.##.#. .######. .######.",
  cup: "........ #######. #.....## #.....#. #.....## #.....#. .#####.. ........",
  apple: "....#... ...#.... .##.##.. #######. #######. #######. .#####.. ..#.#...",
  smoke: ".....#.# ......#. .....#.. ........ #######. #######. ........ ........",
  shield: "######## #..##..# #..##..# ######## #..##..# .#.##.#. ..####.. ...##...",
  skull: ".######. ######## #..##..# #..##..# ######## .##..##. .######. .#.##.#.",
  wrench: "......## .....#.# ....##.. ...##... ..##.... .##..... ##...... #.......",
  nut: "...##... .######. .##..##. ##....## ##....## .##..##. .######. ...##...",
  scope: "...##... ...##... .#.##.#. ###..### ###..### .#.##.#. ...##... ...##...",
  dot: "........ ..####.. .#....#. .#.##.#. .#.##.#. .#....#. ..####.. ........",
  star: "...##... ...##... ######## .######. ..####.. .##..##. .#....#. ........",
  dna: "##....## .##..##. ..####.. ...##... ...##... ..####.. .##..##. ##....##",
  heart: ".##..##. ######## ######## ######## .######. ..####.. ...##... ........",
  sliders: "..#..... ######## ..#..... .....#.. ######## .....#.. ..#..... ########",
  bars: "........ ......## ......## ...##.## ...##.## ##.##.## ##.##.## ##.##.##",
};
const pixCache = {};
function pix(name) {
  if (pixCache[name]) return pixCache[name];
  let r = "";
  (ICONS[name] || ICONS.dot).split(" ").forEach((row, y) => {
    for (let x = 0; x < 8; x++) if (row[x] === "#") r += `M${x} ${y}h1v1h-1z`;
  });
  return (pixCache[name] = `<svg class="pix" viewBox="0 0 8 8" aria-hidden="true"><path d="${r}"/></svg>`);
}

// ---------- the dashboard
// Panel sizes are kept as they would be on a 1440 x 900 screen and scaled to the screen in use, so a layout carries over to any size.
const BASE_W = 1440,
  BASE_H = 900;
const kx = () => innerWidth / (prefs.uiScale || 1) / BASE_W;
const ky = () => innerHeight / (prefs.uiScale || 1) / BASE_H;
function applySizes() {
  const st = document.documentElement.style;
  st.setProperty("--left", Math.max(200, Math.round(prefs.partyW * kx())) + "px");
  st.setProperty("--right", Math.max(150, Math.round(prefs.enemyW * kx())) + "px");
  st.setProperty("--bottomh", Math.max(70, Math.round((K() ? prefs.bottomFight : prefs.bottomH) * ky())) + "px");
  st.setProperty("--mapw", prefs.mapW ? Math.round(prefs.mapW * kx()) + "px" : "46%");
}
function view() {
  if (isSpec()) return specView();
  ensureMap();
  partySpots();
  const k = K();
  const st = document.documentElement.style;
  applySizes();
  const mode = k ? "fight" : setupOpen() ? "setup" : "calm";
  const center =
    mode === "fight"
      ? ["end", "defeat"].includes(k.phase)
        ? `<div class="arena solo">${consoleWin()}</div>`
        : `<div class="arena">${fightMap()}<div class="gut" data-gut="map" title="Drag to resize"></div>${consoleWin()}</div>`
      : mode === "setup"
        ? `<div class="setupgrid">${encounterWin(true)}</div>`
        : `<div class="calm"><div class="calmcol">${encounterWin(false)}${skillWin()}${rewardWin()}</div>${recentWin()}${combatLogWin()}</div>`;
  const top = `<div class="top">${partyWin()}<div class="gut" data-gut="left" title="Drag to resize"></div>${center}${mode === "calm" ? "" : `<div class="gut" data-gut="right" title="Drag to resize"></div>${mode === "setup" ? `<div class="rcol">${enemyWin()}${skillWin()}${rewardWin()}</div>` : enemyWin()}`}</div>`;
  const bottom = `<div class="bottom">${notesWin()}${mode === "calm" ? "" : combatLogWin()}</div>`;
  const initBar = mode === "fight" && !["init", "stealth", "end", "defeat"].includes(k.phase) ? turnBar() : "";
  return `<div class="dash">${devBar()}<div class="board ${mode}"><div class="stage">${initBar}${top}<div class="gut h" data-gut="bottom" title="Drag to resize"></div>${bottom}</div>${rail()}</div><footer class="foot">${hints()
    .map(([a, b]) => `<span>${kbd(a)}${h(b)}</span>`)
    .join("")}</footer>${ui.logOpen ? logFloat() : ""}${ui.modal ? renderModal() : ""}</div>`;
}
const setupOpen = () => (ui.setup != null ? ui.setup : S.scene.npcs.length > 0);
// A spectator reads the story only: no fold-out numbers, and formulas in brackets come out, e.g. "uses Stimpak: 10 HP + (Medicine/5)." reads "uses Stimpak."
const specText = (x) =>
  String(x)
    .replace(/: [^.:]*\([^)]*\)\./g, ".")
    .replace(/\s*\([^)]*\)/g, "");
const logRow = (l) =>
  isSpec()
    ? `<div class="log-${h(l.k)}">${h(specText(l.x))}</div>`
    : l.more && l.more.length
      ? `<details class="logrow log-${h(l.k)}" data-k="log${l.id}"${ui.open["log" + l.id] ? " open" : ""}><summary>${h(l.x)}</summary><div class="logmore">${l.more.map((x) => `<div>${h(x)}</div>`).join("")}</div></details>`
      : `<div class="log-${h(l.k)}">${h(l.x)}</div>`;
const logLines = (list, n) => list.slice(-n).reverse().map(logRow).join("") || `<div class="dim">Nothing yet.</div>`;
const combatLogWin = () =>
  win(
    "w-clog",
    "Combat log",
    "",
    `<div class="loglist">${logLines(
      S.log.filter((l) => l.r > 0),
      40,
    )}</div>`,
    { tools: btn("clearLog", "combat", "Clear", "", "tiny", "Clear the combat log (Undo brings it back)") },
  );
const REWARD_FOCUS = [
  ["general", "General"],
  ["weapons", "Weapons"],
  ["armor", "Armor"],
  ["ammo", "Ammo"],
  ["medical", "Medical"],
  ["alcohol", "Alcohol"],
  ["drugs", "Drugs"],
  ["food", "Food"],
  ["junk", "Junk"],
  ["mods", "Mods"],
];
// What a cache can hold, by kind and tier. General is every kind together with no weighting.
// 12 Nov: several kinds can be ticked at once (Weapons + Ammo makes a weapon and ammo crate); their pools are pooled.
function rewardPool(kinds, tiers) {
  const inT = (x) => x.tier == null || tiers.includes(Math.max(1, Math.min(6, Number(x.tier) || 1)));
  const items = (cats) => DATA.items.filter((i) => cats.includes(i.cat) && inT(i)).map((i) => i.n);
  const pools = {
    weapons: DATA.weapons.filter((w) => w.ok && w.tier && inT(w) && !E.isUnique(w)).map((w) => w.n),
    armor: DATA.armor.filter((a) => a.tier > 0 && a.tier < 7 && inT(a) && !a.faction).map((a) => a.n),
    ammo: DATA.ammo.filter((a) => a.ok !== false && inT(a)).map((a) => a.n),
    medical: items(["Healing", "Resistance", "Counter"]),
    alcohol: items(["Alcohol"]),
    drugs: items(["Chem/Drug"]),
    food: items(["Food", "Drink"]),
    junk: DATA.materials.filter(inT).map((m) => m.n),
    mods: (DATA.mods || []).filter(inT).map((m) => m.n),
  };
  const ks = [].concat(kinds);
  return [...new Set(ks.includes("general") ? Object.values(pools).flat() : ks.flatMap((k) => pools[k] || []))];
}
function rewardRoll(kinds, tiers, n) {
  // with several kinds ticked each gets its turn, so a Weapons + Ammo crate always holds both, however big each pool is
  const pools = []
    .concat(kinds)
    .map((k) => rewardPool(k, tiers))
    .filter((p) => p.length);
  const out = [];
  for (let i = 0; i < n && pools.length; i++) {
    const pool = pools[i % pools.length];
    const name = pool[Math.floor(Math.random() * pool.length)];
    const it = E.get(ctx(), name);
    const q = !it
      ? 1
      : it.cat === "ammo"
        ? 5 + Math.floor(Math.random() * 16)
        : it.cat === "material"
          ? 1 + Math.floor(Math.random() * 3)
          : it.cat === "item"
            ? 1 + Math.floor(Math.random() * 2)
            : 1;
    const had = out.find((x) => x.n === name);
    if (had) had.q += q;
    else out.push({ n: name, q });
  }
  return out;
}
function rewardState() {
  const r = (ui.reward = ui.reward || { kinds: ["general"], tiers: [1], n: 5, items: [], to: {}, all: "" });
  if (!r.kinds) r.kinds = [r.focus || "general"]; // the old single pick
  return r;
}
function rewardWin() {
  const r = rewardState();
  const tiers = [1, 2, 3, 4, 5, 6]
    .map((t) => `<button class="opt ${r.tiers.includes(t) ? "on" : ""}" data-a="rewardTier" data-v="${t}" aria-pressed="${r.tiers.includes(t)}">T${t}</button>`)
    .join("");
  const kinds = REWARD_FOCUS.map(
    ([id, n]) =>
      `<button class="opt ${r.kinds.includes(id) ? "on" : ""}" data-a="rewardFocus" data-v="${id}" aria-pressed="${r.kinds.includes(id)}">${n}</button>`,
  ).join("");
  return win(
    "w-reward",
    "Rewards",
    "",
    `<div class="row wrap rwrow"><span class="s dim">KIND</span>${kinds}</div><div class="row wrap rwrow"><span class="s dim">TIERS</span>${tiers}<span class="s dim" style="margin-left:6px">ITEMS</span>${numBox(`id="rwN" data-u="reward.n" title="How many items"`, r.n)}${btn("rewardGen", "", "Generate", "", "primary tiny")}${r.items.length ? btn("rewardShow", "", `Last roll (${r.items.length})`, "", "tiny", "Open the last roll again") : ""}</div>
     <div class="s dim">Tick one or more kinds and the tiers, then Generate. The result opens in a window.</div>`,
  );
}
// The rolled rewards, in their own window: who gets what, give out, or leave them on the map as a cache.
function rewardBody() {
  const r = rewardState();
  const who = [["", "Leave it"], ...S.chars.map((c) => [c.id, c.name])];
  const names = r.kinds.map((k) => (REWARD_FOCUS.find(([id]) => id === k) || [k, k])[1]).join(" + ");
  if (!r.items.length) return `<div class="s dim">Nothing left to hand out.</div>`;
  return `<div class="s dim" style="margin-bottom:4px">${h(names)} · tiers ${r.tiers.map((t) => "T" + t).join(", ")}</div><table class="t rewt">${r.items
    .map((l, i) => {
      const it = E.get(ctx(), l.n);
      return `<tr><td>${itemIcon(l.n)}</td><td class="bright">${h(l.n)}</td><td>${fmt(l.q)}</td><td class="s dim">${it ? h(statText(it.cat, it.o)) : ""}</td><td><select id="rwTo${i}" data-u="reward.to.${i}">${options(who, r.to[i] || "")}</select></td></tr>`;
    })
    .join("")}</table>
     <div class="row wrap" style="margin-top:6px"><select id="rwAll" data-u="reward.all" title="Who gets everything">${options([["", "All to..."], ...S.chars.map((c) => [c.id, c.name])], r.all || "")}</select>${btn("rewardGive", "", "Give out", "", "primary tiny", "Each item goes to who is picked beside it, or everything to the All to pick")}${btn("rewardCache", "", "Leave as a cache", "", "tiny", "Put it all on the map as a container that opens for whoever reaches it")}${btn("rewardGen", "", "Reroll", "", "tiny")}${btn("rewardClear", "", "Clear", "", "tiny")}</div>`;
}
const skillWin = () =>
  win("w-check", "Skill check", "", checkBody(), { tools: btn("chkGen", "", "Random", "", "tiny", "Generate a random skill and difficulty") });
function recentWin() {
  return win(
    "w-recent",
    "Recent events",
    "",
    `<div class="loglist">${logLines(
      S.log.filter((l) => !l.r),
      30,
    )}</div>`,
    { tools: btn("clearLog", "recent", "Clear", "", "tiny", "Clear recent events (Undo brings them back)") },
  );
}
function notesWin() {
  const cur = S.notesList.find((n) => n.id === ui.noteId);
  return win(
    "w-notes",
    "Notes",
    "",
    `<input id="qnSubj" autocomplete="off" placeholder="Subject (optional)" data-note="subject" value="${h(cur ? cur.subject : "")}"><textarea id="qnText" spellcheck="false" placeholder="Type a note. Old notes are in the column on the right." data-note="text">${h(cur ? cur.text : "")}</textarea>`,
    { tools: btn("noteNew", "", "New", "", "tiny") },
  );
}
const DEV = [
  ["loot", "Loot tables"],
  ["items", "Items"],
  ["weapons", "Weapons"],
  ["armor", "Armor"],
  ["ammo", "Ammo"],
  ["mods", "Mods"],
  ["materials", "Materials"],
  ["recipes", "Recipes"],
  ["enemies", "Enemies"],
  ["traits", "Traits"],
  ["perks", "Perks"],
  ["statuses", "Statuses"],
  ["variables", "Variables"],
  ["report", "Data report"],
  ["state", "Raw state"],
];
function devBar() {
  return `<header class="devbar"><span class="brand">Fallout DM</span><button class="btn tiny devtoggle ${ui.devOpen ? "on" : ""}" data-a="devToggle" data-v="">Dev ${ui.devOpen ? "-" : "+"}</button><span class="devlabel">Dev:</span><span class="devlist ${ui.devOpen ? "open" : ""}">${DEV.map(([id, n]) => btn("dev", id, n, "", "tiny")).join("")}</span><span class="spacer"></span>${table.on ? btn("table", "", table.up ? `Table: ${table.n}` : "Table: ...", "", "tiny " + (table.up ? "" : "warn"), "Share this table: join links and devices") : btn("openSession", "", "Open session", "", "tiny", "Get a link so other devices can join this game as DM screens")}${btn("refresh", "", "Refresh", "", "tiny", "Reload every list and table into the menus after you edit them")}${btn("undo", "", "Undo", "U", "tiny", undoStack.length ? "Undo: " + undoStack[undoStack.length - 1].label : "Nothing to undo")}${btn("redo", "", "Redo", "Y", "tiny")}${btn("search", "", "Search", "/", "tiny")}${btn("help", "", "Keys", "?", "tiny keysbtn")}${btn("railGo", "changelog", "Changelog", "", "tiny", "What changed, version by version")}</header>`;
}
function hints() {
  if (ui.modal)
    return [
      ["Esc", "Close"],
      ["Enter", "Confirm"],
    ];
  if (K()) {
    if (ui.atk)
      return [
        ["0-9", "Roll"],
        ["Enter", "Resolve"],
        ["N", "End turn"],
        ["W", "Weapon"],
        ["T", "Target"],
        ["M", "Move"],
        ["R", "Reload"],
        ["I", "Item"],
        ["Ctrl+Z", "Undo"],
      ];
    return [
      ["Enter", "Continue"],
      ["Ctrl+Z", "Undo"],
    ];
  }
  return [
    ["B", "Encounter"],
    ["I", "Inventory"],
    ["←→", "Pick character"],
    ["/", "Search"],
    ["Ctrl+Z", "Undo"],
    ["?", "Keys"],
  ];
}
function logFloat() {
  const rows = S.log.slice(-300).reverse().map(logRow).join("") || `<div class="dim">Nothing yet.</div>`;
  return `<section class="win float floatlog" data-dlg="log" style="${dlgStyle("log")}"><header class="wt">${pix("log")}<span>Log</span><span class="spacer"></span><button class="btn tiny" data-a="clearLog" data-v="all" title="Clear the whole log (Undo brings it back)">Clear all</button><button class="btn tiny" data-a="toggleLog" data-v="">${kbd("F4")}Close</button></header><div class="wb loglist" data-scroll="floatlog">${rows}</div></section>`;
}

// ----- party
const CARD_MENUS = [
  ["inv", "Inventory", "box"],
  ["sheet", "Character", "star"],
  ["health", "Health", "heart"],
];
function partyWin() {
  const tools = `${btn("pwOpen", "party", "All", "O", "tiny", "Party-wide changes")}${K() ? "" : btn("newChar", "", "New", "N", "tiny")}${K() ? "" : btn("rest", "", "Rest", "Z", "tiny", "Passive heal, clears Shock and item effects")}`;
  return win(
    "w-party",
    `Party ${S.chars.length}`,
    "",
    `<div class="cards">${S.chars.map(charCard).join("") || `<div class="empty">No characters yet. Click New.</div>`}</div>`,
    { tools },
  );
}
function enemyWin() {
  const k = K();
  const n = k ? k.cbs.filter((c) => sideOf(c.id) === "npc" && alive(c)).length : foes().length;
  const allies = foes().filter((e) => e.ally).length;
  return win("w-enemies", `Enemies ${n - allies < 0 ? 0 : k ? n : n - allies}${allies ? ` · Allies ${allies}` : ""}`, "", enemyTab(), {
    tools: btn("pwOpen", "enemies", "All", "", "tiny", "Change every enemy at once"),
  });
}
const baseStats = (c) => E.derive({ ...c, statuses: [], effects: [], gear: { acc: [] } }, ctx()); // without statuses, item effects or worn gear
const moved = (now, was) => (now > was ? "up" : now < was ? "down" : "");
function charCard(c) {
  const d = der(c);
  const b0 = baseStats(c);
  const sel = c.id === ui.sel;
  const cb = cbOf(c.id);
  const me = K() ? actorId() : null;
  const sp = E.SPECIAL.map(
    (k, i) =>
      `<label title="${E.SPECIAL_NAMES[k]}: ${d.sp[k]}${d.sp[k] !== b0.sp[k] ? ` (base ${b0.sp[k]}, changed by statuses or gear)` : ""}"><span class="spk">${prefs.spStyle === "text" ? k : prefs.spStyle === "both" ? `${vicon(k, "spmini")}${k}` : vicon(k, "spmini")}</span>${numBox(`data-c="setSpecial" data-id="${c.id}" data-i="${i}" id="sp-${c.id}-${i}"`, d.sp[k], `cell ${moved(d.sp[k], b0.sp[k])}`)}</label>`,
  ).join("");
  const sk = E.SKILLS.map(([k, n]) => {
    const tagged = (c.tags || []).includes(k);
    const ovr = c.skills && c.skills[k] != null;
    return `<label class="${tagged ? "tagged" : ""}" title="${n}: ${d.skills[k]}${d.skills[k] !== b0.skills[k] ? ` (base ${b0.skills[k]})` : ""}${tagged ? ", tagged" : ""}. Type to override, clear to go back to the formula."><span>${ABBR[k]}</span>${numBox(`data-c="setSkill" data-id="${c.id}" data-k="${k}" id="sk-${c.id}-${k}"`, d.skills[k], `cell ${ovr ? "ovr" : ""} ${moved(d.skills[k], b0.skills[k])}`)}</label>`;
  }).join("");
  const count = { inv: (c.inv || []).length, sheet: (c.perks || []).length, health: (c.statuses || []).length + (c.effects || []).length };
  const menus = CARD_MENUS.map(
    ([id, n, ic]) =>
      `<button class="icb" data-a="openChar" data-v="${c.id}|${id}" title="${n}">${pix(ic)}<span>${n}</span>${count[id] ? `<b>${count[id]}</b>` : ""}</button>`,
  ).join("");
  const due = (c.ptsBank || 0) > 0 || (c.perkDue || 0) > 0;
  const enc = [d.enc.activeTier, d.enc.totalTier].filter(Boolean);
  return `<article class="card ${sel ? "sel" : ""} ${c.dbno ? "down" : ""} ${K() && K().turnId === c.id ? "cur" : ""} ${ui.atk && ui.atk.tgt === c.id ? "tgt" : ""}" data-a="pick" data-v="${c.id}" data-card="${c.id}">
    <header class="chead"><button class="iconbtn" data-a="iconPick" data-v="${c.id}" title="Map icon: ${h((TOKEN_ICONS[c.icon] || TOKEN_ICONS.person)[0])}. Click to change.">${iconSvg(c.icon)}</button>${cb && cb.init != null ? numBox(`data-c="setInit" data-id="${c.id}" id="in-${c.id}" title="Initiative"`, fmt(cb.init), "cell init") : ""}<span class="nm grow" title="${h(c.background)} ${h(c.spec)}">${h(c.name)}</span><span class="tag">LV${c.level}</span>${c.dbno ? `<span class="tag bad">DBNO</span>` : ""}${cb && cb.caught ? `<span class="tag bad">CAUGHT</span>` : ""}<button class="btn tiny ordb" data-a="partyMove" data-v="${c.id}|-1" title="Move up: earlier in the party and its starting spots" ${S.chars[0] === c ? "disabled" : ""}>&#9650;</button><button class="btn tiny ordb" data-a="partyMove" data-v="${c.id}|1" title="Move down" ${S.chars[S.chars.length - 1] === c ? "disabled" : ""}>&#9660;</button>${btn("edit", c.id, "E", "", "tiny", "Edit")}</header>
    <div class="hpline"><span>HP</span>${bindNum(c.id, "hp", c.hp, `id="rh-${c.id}" title="Current HP"`, "cell")}<span>/</span>${ovCell(c, "hp", d.hp, "Max HP")}<span class="grow">${hpBar(c.hp, d.hp)}</span><span>AP</span>${bindNum(c.id, "ap", c.ap, `id="ra-${c.id}" title="AP now"`, "cell")}<span>/</span>${ovCell(c, "ap", d.ap, "Action Points after modifiers")}${me && me !== c.id ? `<span>R</span>${numBox(`data-c="setRange" data-id="${c.id}" id="rr-${c.id}" title="Range from ${h((ent(me) || {}).name)}"`, rangeOf(me, c.id), "cell")}` : ""}</div>${radLine(c)}${statusIcons(c)}
    <div class="stats7 spc">${sp}</div><div class="stats7">${sk}</div>
    ${canLevel(c) ? `<div class="banner s">${btn("levelUp", c.id, `Level up to ${c.level + 1}`, "", "primary tiny")}</div>` : ""}
    ${due ? `<div class="banner s">${btn("spendPts", c.id, `Assign: ${c.ptsBank ? `${c.ptsBank} skill points` : ""}${c.ptsBank && c.perkDue ? " + " : ""}${c.perkDue ? `${c.perkDue} perk` : ""}`, "", "primary tiny")}</div>` : ""}
    ${c.dbno ? `<div class="banner s">${btn("reviveChk", c.id, "Revive: Medicine check", "", "primary tiny")}</div>` : ""}
    ${enc.length ? `<div class="chips">${enc.map((x) => `<span class="chip">${x}</span>`).join("")}</div>` : ""}${chips(c, true)}
    <div class="icons">${menus}</div></article>`;
}
// ----- the inventory window: gear on a rough body, then what's carried
const GEAR_SLOTS = {
  head: ["Headgear", (a) => /head/i.test(a.loc)],
  vanity: ["Clothing", (a) => a.loc === "Vanity"],
  armor: ["Armor", (a) => ["Body", "Whole Body", "Power"].includes(a.loc)],
  acc0: ["Vanity 1", (a) => a.loc === "Accessory"],
  acc1: ["Vanity 2", (a) => a.loc === "Accessory"],
  acc2: ["Vanity 3", (a) => a.loc === "Accessory"],
};
const slotName = (c, s) => (s.startsWith("acc") ? c.gear.acc[Number(s[3])] : c.gear[s]) || "";
function setSlot(c, s, name) {
  if (s.startsWith("acc")) c.gear.acc[Number(s[3])] = name;
  else c.gear[s] = name;
}
function gearBox(c, s) {
  const name = slotName(c, s);
  const it = name && E.get(ctx(), name);
  const o = it ? it.o : {};
  const tip = [o.buffs && `+ ${o.buffs}`, o.nerfs && `- ${o.nerfs}`, o.mech, o.note, o.type]
    .filter(Boolean)
    .map((x) => `<div>${h(x)}</div>`)
    .join("");
  return `<button class="gbox gb-${s} ${ui.modal.pick === s ? "on" : ""}" data-a="gearSlot" data-v="${s}"><span class="gl">${GEAR_SLOTS[s][0]}</span><span class="gn">${h(name || "Empty")}</span>${name ? `<span class="gdt">DT ${fmt(o.dt || 0)}</span>` : ""}${tip ? `<span class="gtip">${tip}</span>` : ""}</button>`;
}
// The odds with this weapon at every range band, on open ground against a target with no modifiers: the weapon's own number
// from the workbook, and what this character gets with their skill. Melee reaches R1 only (a lunge perk reaches further).
function hitTable(c, d, slot, o, v) {
  const c0 = ctx();
  const open = { tier: "open", n: "Open", hit: 0, dam: 0 };
  const you = S.rules.bandMeters.map((_, i) => {
    const r = i + 1;
    try {
      const dA = E.forShot(d, c, { o, range: r, round: 1 }, c0);
      const v2 = E.weaponView(slot, c, dA, c0);
      if (v2.melee && r > 1 && !dA.m.lunge) return null;
      const hc = E.hitChance(c, dA, c, d, v2, r, c0, open, "Body");
      return hc.noData ? null : Math.max(0, Math.round(hc.hit * 100));
    } catch (e) {
      return null;
    }
  });
  const base = S.rules.bandMeters.map((_, i) =>
    v.melee ? (i ? null : Math.round((o.base != null ? o.base : S.rules.meleeBase) * 100)) : o.hit && o.hit[i] != null ? Math.round(o.hit[i] * 100) : null,
  );
  const cell = (x, cls = "") => `<td class="${cls}">${x == null ? "–" : x + "%"}</td>`;
  return `<table class="hitt"><tr><th></th>${S.rules.bandMeters.map((m, i) => `<th title="${m} m">R${i + 1}</th>`).join("")}</tr><tr><th title="The weapon's own number from the workbook">Base</th>${base.map((x) => cell(x, "dim")).join("")}</tr><tr><th title="${h(c.name)} with their skill, open ground">${h(c.name.split(" ")[0])}</th>${you.map((x) => cell(x, x >= 50 ? "good" : x > 0 ? "" : "zero")).join("")}</tr></table>`;
}
function weaponBox(c, d, i) {
  const slot = c.weapons[i];
  if (!slot)
    return `<button class="wbox empty ${ui.modal.pick === "w" + i ? "on" : ""}" data-a="gearSlot" data-v="w${i}"><span class="gl">Weapon ${i + 1}</span><span class="gn">Empty</span></button>`;
  const v = E.weaponView(slot, c, d, ctx());
  const o = (E.get(ctx(), slot.n) || { o: {} }).o;
  const loads = loadsHeld(c, v, slot);
  const ammo = v.usesAmmo
    ? `<div class="wrow"><span>Mag <b>${slot.mag || 0}/${v.cap}</b></span><span>In pack <b>${v.reserve ? ammoHeld(c, v.reserve) : 0}</b></span>${btn("reloadSlot", `${c.id}|${i}`, "Reload", "", "tiny")}</div>${
        v.caliber
          ? `<select id="gl-${c.id}-${i}" class="wsel" data-c="setLoad" data-id="${c.id}" data-i="${i}" title="Loaded ammo">${
              loads.length
                ? `<option value="">No ammo loaded</option>${options(
                    loads.map((a) => [a.n, `${a.n} (Dam ${a.pellets ? a.dam + "x" + a.pellets : (a.dam ?? "?")} Pen ${a.pen ?? 0})`]),
                    slot.ammo,
                  )}`
                : `<option value="">No ${h(v.caliber)} in inventory</option>`
            }</select>`
          : `<div class="s dim">Uses ${h(v.reserve)}</div>`
      }`
    : `<div class="wrow"><span>${v.melee ? "Melee" : v.thrown ? "Thrown" : "No ammo"}</span><span>Dam <b>${v.pellets ? `${fmt(v.base)}x${v.pellets}` : fmt(v.base)}</b></span><span>Pen <b>${fmt(v.pen)}</b></span>${v.count > 1 ? `<span>Hits <b>${v.count}</b></span>` : ""}</div>`;
  return `<div class="wbox ${(c.activeW || 0) === i ? "act" : ""}"><button class="whead ${ui.modal.pick === "w" + i ? "on" : ""}" data-a="gearSlot" data-v="w${i}"><span class="gl">Weapon ${i + 1}${(c.activeW || 0) === i ? " · in hand" : ""}</span><span class="gn">${h(slot.n)}</span></button>
    <div class="wrow"><span>AP <b>${fmt(v.ap)}</b></span><span>Best <b>R${E.optimalRange(o)}</b></span><span>Value <b>${o.val != null ? fmt(o.val) : "-"}</b></span><span>Skill <b>${fmt(v.req)}</b></span><span>Crit <b>${fmt(E.pct(v.crit))}%</b></span>${c.kind === "pc" && o.tier ? `<span>${famTag(c, slot.n)} <span class="famedit" title="Rounds fired: the DM can set it">${numBox(`data-c="setFam" data-id="${c.id}" data-n="${h(slot.n)}" id="famw-${c.id}-${i}"`, fmt(famOf(c, slot.n).n), "cell")}</span></span>` : ""}${slot.jammed ? `<span class="bad">JAMMED</span>${btn("clearSlot", `${c.id}|${i}`, "Clear", "", "tiny")}` : ""}</div>${ammo}</div>${hitTable(c, d, slot, o, v)}`;
}
function gearPicker(c, s) {
  const m = ui.modal;
  const isW = s[0] === "w";
  const fits = isW ? (it) => it.cat === "weapon" : (it) => it.cat === "armor" && GEAR_SLOTS[s][1](it.o);
  const q = E.low(m.pq || "");
  const held = (c.inv || []).map((l) => ({ l, it: E.get(ctx(), l.n) })).filter((x) => x.it && fits(x.it) && (!q || E.low(x.l.n).includes(q)));
  const stats = (o) =>
    isW ? `${fmt(o.ap || 0)} AP${o.ammo && o.ammo !== "N/A" ? " · " + o.ammo : ""}` : `DT ${fmt(o.dt || 0)}${o.buffs ? " · " + o.buffs : ""}`;
  const row = (o, tag) =>
    `<button class="rowbtn" data-a="gearEquip" data-v="${h(o.n)}" title="${h([o.buffs, o.nerfs, o.note].filter(Boolean).join(" · "))}">${itemIcon(o.n)}<span class="grow">${h(o.n)}</span><span class="s dim">${h(stats(o))}</span>${tag}</button>`;
  const all = q
    ? (isW ? DATA.weapons.filter((w) => w.tier) : DATA.armor.filter((a) => GEAR_SLOTS[s][1](a))).filter((o) => E.low(o.n).includes(q)).slice(0, 30)
    : [];
  return `<h3>Equip: ${isW ? `Weapon ${Number(s[1]) + 1}` : GEAR_SLOTS[s][0]}</h3><div class="row"><input id="gearQ" class="grow" autocomplete="off" placeholder="Search everything to hand one out" data-u="modal.pq" value="${h(m.pq || "")}">${btn("gearEquip", "", "Unequip", "", "tiny")}${btn("gearSlot", s, "Cancel", "", "tiny")}</div>${held.map((x) => row(x.it.o, `<span class="tag">HAS ${fmt(x.l.q)}</span>`)).join("") || (q ? "" : `<div class="s dim">Nothing that fits in this inventory. Search to hand one out.</div>`)}${all
    .filter((o) => !held.some((x) => x.it.o.n === o.n))
    .map((o) => row(o, `<span class="tag warn">NEW</span>`))
    .join("")}`;
}
function gearMenu(c, d) {
  const sum = {};
  const rows = d.sources.filter((r) => ["Gear", "Accessory"].includes(r.cat) && r.mods);
  for (const r of rows) for (const k in r.mods) sum[k] = E.fix((sum[k] || 0) + r.mods[k]);
  const bands = Object.keys(sum).filter((k) => /^r\d+$/.test(k));
  const bandVals = bands.map((k) => E.pct(sum[k]));
  for (const k of bands) delete sum[k];
  const list = [
    ...modLine({ mods: sum }).split(", ").filter(Boolean),
    ...(bandVals.length ? [`Hit by range ${Math.max(...bandVals) > 0 ? "+" : ""}${Math.max(...bandVals)} to ${Math.min(...bandVals)}%`] : []),
  ];
  const mods = list.map((x) => `<span class="chip ${/ -|to -/.test(x) ? "" : "pos"}">${h(x)}</span>`).join("");
  const accs = c.gear.acc[2] ? ["acc0", "acc1", "acc2"] : ["acc0", "acc1"];
  // the same figure as the Health window, with a line from each gear box to where it's worn: headgear to the head, armor to the
  // outside of the body, clothing to the middle of it
  const fig = `<svg class="figsvg" viewBox="60 0 120 172" aria-hidden="true">${Object.values(FIG_PARTS)
    .map((p) => p[0])
    .join(
      "",
    )}</svg><svg class="figlines" viewBox="0 0 300 250" aria-hidden="true"><path d="M150 28L220 22M150 106L214 52M150 188L230 74"/><circle cx="220" cy="22" r="3"/><circle cx="214" cy="52" r="3"/><circle cx="230" cy="74" r="3"/></svg>`;
  return `<div class="geartop"><div class="bigdt"><b>${fmt(d.dt)}</b><span>TOTAL DT</span></div><div class="grow"><div class="s dim">FROM GEAR</div><div class="chips">${mods || `<span class="s dim">No modifiers.</span>`}</div></div><div class="s dim" style="text-align:right">Caps ${fmt(c.caps)}<br>Total ${fmt(d.enc.total)}/${fmt(d.carry)} lb<br>Active ${fmt(d.enc.active)}/${fmt(d.enc.capActive)} lb</div></div>
   <div class="gearmenu"><div class="gcol">${weaponBox(c, d, 0)}${weaponBox(c, d, 1)}${c.weapons
     .slice(2)
     .map((_, i) => weaponBox(c, d, i + 2))
     .join(
       "",
     )}</div><div class="gfig">${fig}${gearBox(c, "head")}${gearBox(c, "armor")}${gearBox(c, "vanity")}</div><div class="gcol">${accs.map((s) => gearBox(c, s)).join("")}</div></div>
   ${ui.modal.pick ? `<div class="gpick">${gearPicker(c, ui.modal.pick)}</div>` : ""}`;
}
// ----- character and health menus
function sheetBody() {
  const m = ui.modal;
  const c = ent(m.id);
  if (!c) return "";
  const d = der(c);
  const tabs = [
    ["stats", "Stats"],
    ["perks", "Perks"],
    ["traits", "Traits"],
  ]
    .map(([id, n]) => `<button class="opt ${m.tab === id ? "on" : ""}" data-a="sheetTab" data-v="${id}">${n}</button>`)
    .join("");
  const body =
    m.tab === "perks"
      ? perksSect(c)
      : m.tab === "traits"
        ? traitsSect(c)
        : `${d.m.lucky ? `<label class="rr" style="max-width:220px"><span>Lucky Number digit</span>${bindNum(c.id, "luckyDigit", c.luckyDigit != null ? c.luckyDigit : 7)}</label>` : ""}<div class="hpline sheetstats" style="margin-bottom:3px"><span>DT</span>${ovCell(c, "dt", fmt(d.dt), "Damage Threshold")}<span>INIT</span>${ovCell(c, "pri", fmt(d.pri), "Initiative base")}<span>SAVE</span>${ovCell(c, "save", d.save, `Saving throw: roll ${saveNeed(d.save)} or more on a d20 (the box holds the old at-or-under number)`)}</div>${statList(c, d)}${statsSect(c, d)}${isSpec() ? "" : `<h3>What's changing this character's numbers</h3>${modsSect(c, d)}`}`;
  return `${specialRow(c, d)}<div class="opts sheettabs" style="margin:8px 0 6px">${tabs}</div>${body}`;
}
// A box figure: each body part shows what's wrong with it. Limbs from the statuses that name them, head and body from the crit statuses.
const diceBtn = (id, kind) =>
  `<button type="button" class="dicebtn" data-a="rollDice" data-v="${id}|${kind}" title="Roll ${kind === "2d10" ? "two d10 (00 to 99)" : kind} for me" aria-label="Roll ${kind}">${DIE_SVG}</button>`;
const DIE_SVG = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="5" r="1.3"/><circle cx="11" cy="11" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="11" cy="5" r="1.3"/><circle cx="5" cy="11" r="1.3"/></svg>`;
// skill checks read as the d20 faces that fail and pass: a natural 1 always fails, a natural 20 always passes
function checkRange(need) {
  const n = Math.min(20, Math.max(2, need));
  return n === 20 ? "fail 1-19 / pass 20" : `fail 1-${n - 1} / pass ${n}-20`;
}
// ---- throwing
// Cover health: each tier lasts coverRounds 5.56 rounds. A hit through it does the shot's damage x coverTake, so flimsy cover wears out
// in fewer hits of the same gun's worth. Open ground never breaks.
const coverTake = (o) => (S.rules.coverTake || {})[E.coverTier(o, S.rules)] || 0;
function objHp(o) {
  if (!o) return 0;
  const t = E.coverTier(o, S.rules);
  const n = (S.rules.coverRounds || {})[t];
  const take = coverTake(o);
  return n && take ? Math.round(n * (S.rules.coverRound || 11) * take) : 0;
}
// Concealment and soft cover protect in proportion to the health they have left. Hard cover and walls protect fully until they break.
function coverNow(lc) {
  const o = lc.id && S.scene.objects.find((x) => x.id === lc.id);
  const max = objHp(o);
  if (!o || !max || !o.dmg || !(S.rules.coverFade || []).includes(lc.tier)) return lc;
  const f = clamp(1 - o.dmg / max, 0, 1);
  return { ...lc, hit: E.fix(lc.hit * f), dam: E.fix(lc.dam * f), n: `${lc.n} ${Math.round(f * 100)}%`, worn: f };
}
// How much of its cover an object still gives: worn concealment and soft cover protect less.
function coverLeft(o) {
  const max = objHp(o);
  if (!o || !max || !o.dmg || !(S.rules.coverFade || []).includes(E.coverTier(o, S.rules))) return 1;
  return clamp(1 - o.dmg / max, 0, 1);
}
const lineCoverNow = (a, b) =>
  S.rules.coverStack ? E.lineCover(a, b, S.scene.objects, S.rules, coverLeft) : coverNow(E.lineCover(a, b, S.scene.objects, S.rules));
function hurtObj(o, amount, by) {
  const max = objHp(o);
  if (!max || !(amount > 0)) return;
  o.dmg = E.fix((o.dmg || 0) + amount);
  const name = o.label || (S.rules.mapItems[o.item] || {}).n || (MAP_OBJ[o.kind] || [o.kind])[0];
  if (o.dmg >= max) {
    S.scene.objects = S.scene.objects.filter((x) => x !== o);
    log("status", `${name} is destroyed by ${by}.`);
  } else log("status", `${name} takes ${fmt(amount)} damage from ${by}: ${fmt(max - o.dmg)}/${max} left.`);
}
// Interactive objects. A chest opens for whoever starts a turn or finishes a move within R1 of it, and its loot goes to them.
function touchObjects(id) {
  const e = ent(id);
  if (!e || !K()) return;
  const p = posOf(id);
  const r1 = S.rules.bandMeters[0];
  for (const o of S.scene.objects) {
    if (!o.loot || o.opened) continue;
    if (Math.max(0, dist(p, o) - Math.max(o.w || 1, o.h || 1) / 2) > r1) continue;
    o.opened = true;
    const name = o.label || (S.rules.mapItems[o.item] || {}).n || "chest";
    for (const l of o.loot) keepFull(e, () => addInv(e, l.n, l.q));
    log("status", `${e.name} opens the ${name}: ${o.loot.map((l) => `${l.q} x ${l.n}`).join(", ") || "it's empty"}.`);
  }
}
// 12 Nov: hazards act on whoever ends a turn in them (fire, acid, a rad lake) or near them (a radioactive barrel).
function hazardTurnEnd(id) {
  const e = ent(id);
  if (!e || !K()) return;
  for (const hz of E.hazardsAt(posOf(id), S.scene.objects, S.rules)) {
    const on = hz.o.kind === "hazard" || (E.hazardOf(hz.o, S.rules) || {}).on;
    applyHazard(e, hz, `ends the turn ${on ? "in" : "by"} the ${hz.n}`);
  }
}
// What one hazard does to one fighter: rads, damage, a status (with the limb it hurts), lost AP. A one-shot trap is sprung, and a hidden one found.
function applyHazard(e, hz, how) {
  const bits = [];
  if (hz.rads) {
    setRads(e, (e.rads || 0) + hz.rads);
    bits.push(`+${hz.rads} rads (${e.rads})`);
  }
  if (hz.dmg) {
    e.hp = Math.max(0, (e.hp || 0) - hz.dmg);
    bits.push(`${hz.dmg} damage, HP ${e.hp}/${der(e).hp}`);
  }
  const list = Array.isArray(hz.status) ? hz.status : hz.status ? [[hz.status, hz.tier || 1, hz.part]] : [];
  for (const [name, tier = 1, part] of list) {
    if (!db.status.has(E.low(name))) continue;
    const cur = (e.statuses || []).find((s) => s.n === name);
    keepFull(e, () => addStatus(e, name, Math.min(5, (cur ? cur.tier : 0) + tier)));
    const now = (e.statuses || []).find((s) => s.n === name);
    if (now && part) now.parts = [...new Set([...(now.parts || []), part])];
    bits.push(now ? `${name} ${now.tier}${part ? ` (${PARTS[part][0].toLowerCase()})` : ""}` : `resists ${name}`);
  }
  if (hz.drain && K()) {
    e.ap = 0;
    bits.push("stuck for the rest of the turn");
  }
  if (hz.once) hz.o.sprung = true;
  if (hz.hidden) hz.o.found = true;
  if (hz.blast) {
    // a mine: it blows up where it was set off, and the blast catches everyone close by, like a grenade
    const p = hz.at || posOf(e.id),
      o = hz.o; // it goes off at the mine: the spot in it nearest where they were
    const at = { x: E.fix(clamp(p.x, o.x - (o.w || 1) / 2, o.x + (o.w || 1) / 2)), y: E.fix(clamp(p.y, o.y - (o.h || 1) / 2, o.y + (o.h || 1) / 2)) };
    const hits = blastHits(at, hz.blast);
    bits.push(`it explodes: ${hits.map((x) => `${x.e.name} ${fmt(x.d)}m: ${x.dmg}`).join(", ") || "nobody caught"}`);
    log("status", `${e.name} ${how}: ${bits.join(", ")}.`);
    for (const x of hits) {
      x.e.hp = Math.max(0, (x.e.hp || 0) - x.dmg);
      syncDown(x.e);
      log("hit", `${x.e.name} ${x.e.hp}/${der(x.e).hp} HP after the blast`);
    }
    for (const o of [...S.scene.objects]) {
      const d = Math.max(0, dist(o, at) - Math.max(o.w || 1, o.h || 1) / 2);
      if (o !== hz.o) hurtObj(o, E.fix(E.blastDamage(hz.blast, d) * (S.rules.objBlastMul || 1) * coverTake(o)), `the ${hz.n.toLowerCase()}`);
    }
    addFx({ type: "boom", at: { ...at }, radius: hz.blast.radius, dur: 900 });
    if (hz.dmg) syncDown(e);
    return;
  }
  log("status", `${e.name} ${how}: ${bits.join(", ") || "no harm done"}.`);
  if (hz.dmg) syncDown(e);
}
/** Walks a fighter along a confirmed straight move, setting off every trap, mine or live wire the line crosses on the way.
 * A bear trap or snare ends the walk where it bites. Returns where they end up. */
function walkTo(e, to) {
  const c = cbOf(e.id);
  const from = { x: c.x, y: c.y };
  let end = { x: E.fix(to.x), y: E.fix(to.y) };
  for (const hz of E.hazardsCrossed(from, end, S.scene.objects, S.rules)) {
    c.x = hz.at.x; // they're where it goes off when it goes off
    c.y = hz.at.y;
    applyHazard(e, hz, `${hz.hidden ? "sets off a hidden" : "walks into the"} ${hz.hidden ? hz.n.toLowerCase() : hz.n}`);
    if (hz.stop) {
      end = hz.at;
      break;
    }
    if (e.hp <= 0 || e.dbno) {
      end = hz.at;
      break;
    }
  }
  c.x = end.x;
  c.y = end.y;
  return end;
}
// Can the players see hidden traps? Only when someone in the party has a trapSense perk.
const trapsSeen = () => S.chars.some((c) => (c.perks || []).some((p) => (S.rules.trapSense || []).includes(p)));
// A hidden trap nobody has found, which players don't see unless the party can spot traps.
const hiddenTrap = (o) => {
  const hz = E.hazardOf(o, S.rules);
  return !!(hz && hz.hidden && !o.found);
};
/** Sets the rad counter (0 to radMax). When it crosses a radStep line, the Irradiated tier follows it. */
function setRads(e, n) {
  const was = E.radTier(e.rads, S.rules);
  e.rads = clamp(Math.round(n) || 0, 0, S.rules.radMax || 1200);
  const t = E.radTier(e.rads, S.rules);
  if (t === was) return;
  if (t > 0) addStatus(e, "Irradiated", t);
  else e.statuses = (e.statuses || []).filter((s) => s.n !== "Irradiated");
  log("status", `${e.name} has ${e.rads} rads: ${t ? `Irradiated ${t}` : "no longer irradiated"}.`);
}
// The rad counter on a party card: the count, a bar cut into one segment per Irradiated tier, and the tier in words.
function radLine(c) {
  const max = S.rules.radMax || 1200,
    step = S.rules.radStep || 200,
    t = E.radTier(c.rads, S.rules);
  const p = clamp((c.rads || 0) / max, 0, 1);
  const ticks = Array.from({ length: Math.floor(max / step) - 1 }, (_, i) => `<b style="left:${(((i + 1) * step) / max) * 100}%"></b>`).join("");
  return `<div class="hpline radline" title="Rads: every ${step} is one tier of Irradiated. Type a number to set it."><span>RAD</span>${numBox(`data-c="setRads" data-id="${c.id}" id="rd-${c.id}"`, c.rads || 0, "cell")}<span>/</span><span>${max}</span><span class="grow"><div class="bar rad"><i style="width:${p * 100}%"></i>${ticks}</div></span><span class="tag ${t ? "bad" : ""}">${t ? `IRR ${t}` : "CLEAN"}</span></div>`;
}
// A test chest: ammo for the guns the party carries, placed a few meters in front of them.
function makeChest() {
  const ammo = [
    ...new Set(
      S.chars.flatMap((c) =>
        (c.weapons || []).map((sl) => sl.ammo || (E.get(ctx(), sl.n) || { o: {} }).o.ammo).filter((n) => n && n !== "N/A" && E.get(ctx(), n)),
      ),
    ),
  ];
  const loot = ammo.slice(0, 3).map((n) => ({ n, q: 10 + Math.floor(Math.random() * 21) }));
  const party = S.chars.map((c) => posOf(c.id));
  const cx = party.reduce((t, q) => t + q.x, 0) / (party.length || 1),
    cy = party.reduce((t, q) => t + q.y, 0) / (party.length || 1);
  let at = null;
  for (let i = 0; i < 12 && !at; i++) {
    const q = inMap({ x: E.fix(cx + 3 + i * 0.7), y: E.fix(cy + (i % 2 ? 1 : -1) * i * 0.4) });
    if (!standBlocked(q)) at = q;
  }
  at = at || freeSpot();
  return { id: "o" + S.seq++, kind: "cover", item: "chest", cover: "soft", x: at.x, y: at.y, w: 1, h: 0.6, label: "", loot };
}
// STATUS ICONS: one small picture per status, drawn in a 16 by 16 box with lines. The number up top is the tier.
const SI = {
  face: "M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z",
  heart: "M8 13.5L2.6 8.2A3.2 3.2 0 0 1 8 4.2A3.2 3.2 0 0 1 13.4 8.2Z",
  drop: "M8 2C8 2 3.5 7.5 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7.5 8 2 8 2Z",
  bolt: "M9.5 1.5L4 9H8L6.5 14.5L12 7H8Z",
  flame: "M8 14.5c-3 0-4.5-2-4.5-4.5C3.5 7 6 5.5 6.5 2.5C8.5 4 9 5.5 9 7C10 6.5 10.5 5.5 10.5 4.5C12 6 12.5 8 12.5 10c0 2.5-1.5 4.5-4.5 4.5Z",
  skull: "M3.5 7.5a4.5 4.5 0 1 1 9 0V10H11V12.5H5V10H3.5ZM5.5 7.2h1.6v1.6H5.5ZM8.9 7.2h1.6v1.6H8.9Z",
  eye: "M1.5 8C3.5 4.5 12.5 4.5 14.5 8C12.5 11.5 3.5 11.5 1.5 8Z M8 6.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6Z",
  pill: "M3.3 9.7L9.7 3.3a2.6 2.6 0 0 1 3.7 3.7L7 13.4A2.6 2.6 0 0 1 3.3 9.7Z M6.5 6.5L9.5 9.5",
  shield: "M8 1.5L13.5 3.5V8c0 3.2-2.5 5.4-5.5 6.5C5 13.4 2.5 11.2 2.5 8V3.5Z",
  bottle: "M6.5 1.5h3V4l1.5 2V14.5h-6V6L6.5 4Z",
  cup: "M3 6h8v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z M11 7.5h1.5a1.5 1.5 0 0 1 0 3H11",
  arm: "M2.5 13.5V9.5l3-3l1.5-3.5h3l-1 3.5l3.5 1.5v3l-4 2.5Z",
  bone: "M3 5.5a1.5 1.5 0 1 1 2-2l6 6a1.5 1.5 0 1 1 2 2a1.5 1.5 0 1 1-2 2l-6-6a1.5 1.5 0 1 1-2-2Z",
  snow: "M8 1.5V14.5M2.4 4.8L13.6 11.2M2.4 11.2L13.6 4.8M6.5 2.5L8 4L9.5 2.5M6.5 13.5L8 12L9.5 13.5",
  spiral: "M8 8m-1 0a1 1 0 1 1 2 0a2 2 0 1 1-4 0a3 3 0 1 1 6 0a4 4 0 1 1-8 0a5 5 0 1 1 10 0",
  cloud: "M4 12.5a2.5 2.5 0 0 1 0-5a3.5 3.5 0 0 1 6.8-1A2.8 2.8 0 0 1 12 12.5Z",
  die: "M3 3h10v10H3Z",
  star: "M8 1.5l1.9 4.3l4.6.4l-3.5 3l1.1 4.6L8 11.4l-4.1 2.4l1.1-4.6l-3.5-3l4.6-.4Z",
  z: "M3 4h4L3 8h4M9 7h3l-3 3h3M12 2.5h2l-2 2h2",
};
const ST_ICON = {
  Afraid: [SI.face, "M5.5 6.5h1M9.5 6.5h1M5 11l1.5-1l1.5 1l1.5-1l1.5 1"],
  Calm: [SI.face, "M5 7q1-1 2 0M9 7q1-1 2 0M5.5 10q2.5 2 5 0"],
  Hopeless: [SI.heart, "M8 4.5L7 8l2 1.5l-1 4"],
  Hope: [SI.heart, "M13 1.5v3M11.5 3h3"],
  Hunger: ["M10.5 2a3.5 3.5 0 0 1 3.5 3.5c0 2-1.5 3-3.5 3.5L6 13.5", "M2 14L14 2"],
  "Well Fed": ["M10.5 2a3.5 3.5 0 0 1 3.5 3.5c0 2-1.5 3-3.5 3.5L6 13.5L4.5 12L9 7.5C9.5 5.5 9 3 10.5 2Z", "M4.5 12L3 13.5M2.5 12.5l1 1"],
  Thirst: [SI.drop, "M2 14L14 2"],
  Hydrated: [SI.drop, "M6 10.5q0 2 2 2"],
  Irradiated: [
    "M8 8m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0",
    "M8 6.2L5.5 1.9A6.5 6.5 0 0 1 10.5 1.9ZM6.4 8.9L1.5 9.7A6.5 6.5 0 0 0 4 14ZM9.6 8.9L14.5 9.7A6.5 6.5 0 0 1 12 14Z",
  ],
  "Iradiated (Ghoul)": [
    "M8 8m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0",
    "M8 6.2L5.5 1.9A6.5 6.5 0 0 1 10.5 1.9ZM6.4 8.9L1.5 9.7A6.5 6.5 0 0 0 4 14ZM9.6 8.9L14.5 9.7A6.5 6.5 0 0 1 12 14Z",
    "M13 1v4M11 3h4",
  ],
  Disoriented: ["M8 5a4 4 0 1 1 0 8a4 4 0 1 1 0-8Z", "M6 9l1 1M7 9l-1 1M9 9l1 1M10 9l-1 1", "M3 3.5q2-2 4 0t4 0q1.5-1.5 3 0"],
  Focused: ["M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z", "M8 0.5V4M8 12v3.5M0.5 8H4M12 8h3.5M8 7.5v1"],
  Damnation: [SI.flame, "M5 2L6 4M11 2L10 4"],
  Prayer: ["M8 2v12M4.5 5.5h7"],
  Horny: [SI.heart, "M1.5 14.5L14.5 1.5M12 1.5h2.5V4"],
  "Got Some": [SI.heart, "M11 2.5a1.5 1.5 0 0 1 2.5 1.5L12 5.5L10.5 4A1.5 1.5 0 0 1 11 2.5Z"],
  Drunk: ["M6.5 1.5h3V4l1.5 2V14.5h-6V6L6.5 4Z", "M1.5 9q1-1 2 0M12.5 9q1-1 2 0"],
  Loose: [SI.bottle, "M2 3q1 1 0 2t0 2M14 3q-1 1 0 2t0 2"],
  "Spun Out": [SI.spiral],
  Stimulated: [SI.bolt],
  "Roid Rage": [SI.arm, "M12 1.5l1 1.5l1.5-1M13 4.5l1.5 1"],
  Roided: [SI.arm],
  Narcotized: [SI.pill],
  Painless: [SI.pill, "M11 11l1.5 1.5L15 10"],
  "Blinded by Rage": [SI.eye, "M2 2l3 2M14 2l-3 2"],
  Rage: ["M2 2l3 3M14 2l-3 3M2 14l3-3M14 14l-3-3M6 8h4"],
  Tranquilized: ["M2 14L9 7M8 5l3 3l3.5-3.5l-3-3Z"],
  Sedated: [SI.z],
  Bleeding: ["M2 2L10 10", "M11 10.5c0 0-1.5 1.8-1.5 2.6a1.5 1.5 0 0 0 3 0c0-.8-1.5-2.6-1.5-2.6Z M5 9c0 0-1 1.2-1 1.8a1 1 0 0 0 2 0C6 10.2 5 9 5 9Z"],
  Blinded: [SI.eye, "M2 14L14 2"],
  Burned: [SI.flame],
  "Cloud Poison": [SI.cloud, "M6.5 9.5h1M8.5 9.5h1M7 11.5h2"],
  Electrocuted: ["M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z", "M9 3.5L5.5 8.5h3L7 12.5l3.5-5h-3Z"],
  Fatigue: ["M2 5h10v6H2ZM12 7h2v2h-2Z", "M3.5 6.5h2v3h-2Z"],
  "FEV Infection": ["M5 1.5q6 3.25 0 6.5t0 6.5M11 1.5q-6 3.25 0 6.5t0 6.5M6 4.5h4M6 11.5h4"],
  Frozen: [SI.snow],
  Halucinating: [SI.eye, "M12 1.5a1.5 1.5 0 1 1 0 3"],
  High: [SI.cloud, "M8 5V1M6.5 2.5L8 1l1.5 1.5"],
  "Hologram Glare": ["M8 1.5L14 8L8 14.5L2 8Z", "M5 6l6 4M5 10l6-4"],
  "Injured Limb (Leg/Arm)": [SI.bone, "M7 7L9 9"],
  "Laser Scorch": ["M1.5 14.5L9 7", "M11 5m-2.5 0l2.5-3.5l2.5 3.5l-2.5 3.5Z"],
  "Plasma Melt": ["M3 8a5 5 0 0 1 10 0v2q0 1-1 1t-1 1.5t-1.5 1.5t-1.5-1.5t-1.5-1t-1.5-1Z"],
  Poisoned: [SI.skull, "M13 1.5c0 0-1.5 1.8-1.5 2.6a1.5 1.5 0 0 0 3 0c0-.8-1.5-2.6-1.5-2.6Z"],
  Shock: [SI.star, "M8 5.5v3M8 10v.5"],
  Sick: ["M6.5 2a1.5 1.5 0 0 1 3 0v7.5a3 3 0 1 1-3 0Z", "M8 5v6"],
  "Undignified (Lack of Pride)": ["M2 12h12L13 5l-2.5 3L8 3.5L5.5 8L3 5Z", "M7 4l2 8"],
  Weak: [SI.arm, "M13 9v5M11.5 12.5L13 14l1.5-1.5"],
  Cover: [SI.shield],
  Acuity: [SI.eye, "M13 1v3M11.5 2.5h3"],
  Agile: ["M3 13Q4 5 13 2.5Q9 7 9.5 9.5Q7 9 5.5 12Z", "M3 13L9 6.5"],
  Amped: [SI.bolt, "M12 1.5v3M10.5 3h3"],
  Anaesthetised: ["M2 14l3-3M4 10l2 2l7-7l-2-2ZM11 3l2-2M12 1l3 3"],
  Assertive: ["M2 6.5h3l6-4v11l-6-4H2Z", "M13 6l2-1M13 8h2M13 10l2 1"],
  Caffenated: [SI.cup, "M5 1.5q1 1 0 2.5M8 1.5q1 1 0 2.5"],
  Bliss: [SI.face, "M5 6.5q1 1 2 0M9 6.5q1 1 2 0M5 9.5q3 3 6 0"],
  Hardened: [SI.shield, "M5 8l2 2l4-4"],
  "Lucky Streak": ["M8 8a2.5 2.5 0 1 1-2.5-2.5a2.5 2.5 0 1 1 5 0a2.5 2.5 0 1 1-2.5 2.5a2.5 2.5 0 1 1-2.5 2.5a2.5 2.5 0 1 1 5 0Z", "M8 8l2 6.5"],
  Sociable: ["M2 3h8v5H5l-3 2.5Z", "M7 9.5v2h4l2.5 2V9.5H14V6"],
  Strengthened: ["M1.5 6v4M3.5 4.5v7M3.5 8h9M12.5 4.5v7M14.5 6v4"],
  "Third Eye Open": ["M8 1.5L14.5 13.5H1.5Z", "M5 10q3-3 6 0q-3 3-6 0Z"],
  "Knocked Out": [SI.face, "M5 5.5l2 2M7 5.5l-2 2M9 5.5l2 2M11 5.5l-2 2M6 11h4"],
  "Flesh Craving": ["M3 3h10l-1.5 4.5L10 5l-2 6l-2-6l-1.5 2.5Z"],
  "Craving Satisfaction": ["M3 3h10l-1.5 4.5L10 5l-2 6l-2-6l-1.5 2.5Z", "M10 12l1.5 1.5L15 10"],
  "Gambler's High": [SI.die, "M6 6h.5M9.5 9.5h.5M14 6V1M12.5 2.5L14 1l1.5 1.5"],
  "Gambler's Slump": [SI.die, "M6 6h.5M9.5 9.5h.5M14 10v5M12.5 13.5L14 15l1.5-1.5"],
  Clairvoyance: ["M8 1.5a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z", "M4 13.5h8l-1-2H5Z", "M6 5q1-1.5 2.5-1"],
  "Shell Shocked": ["M2.5 9a5.5 5.5 0 0 1 11 0Z M1.5 9h13", "M8 11v3M5 12l-1 2M11 12l1 2"],
  "Fire Craving": [SI.flame, "M2 2l2 2"],
  Psychosis: ["M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z", "M8 2v12", "M5 6l1.5 1M10 7.5l1.5-1"],
  "Got Away With Lie": ["M2 5q6-3 12 0q0 6-6 8q-6-2-6-8Z", "M4.5 7h2.5M9 7h2.5M6 10q2 1 4 0"],
  Flagelate: ["M2 14L6 10q4-1 4-5t3-3", "M10 5l2 2M8 7l2 2"],
  Mania: [SI.star, "M8 8m-1 0a1 1 0 1 1 2 0"],
  Hangover: [SI.bottle, "M2 2l3 3M5 2L2 5"],
  Fixer: ["M10.5 1.5a3.5 3.5 0 0 0-3.3 4.6L1.8 11.5a1.6 1.6 0 0 0 2.3 2.3l5.4-5.4A3.5 3.5 0 0 0 14 5l-2 2l-2-.5L9.5 4.5l2-2Z"],
  "System Flushed": [SI.drop, "M8 6v5M6 9l2 2l2-2"],
  Immunity: [SI.shield, "M8 5v6M5 8h6"],
  Concussed: ["M8 5a4 4 0 1 1 0 8a4 4 0 1 1 0-8Z", "M3 3.5q2-2 4 0t4 0q1.5-1.5 3 0"],
};
const LIMB_ICON = { arm: ["M2 13l4-4l1.2 1.2l1.6-3.5L10 8l4-5", "M7.5 6.5l1.5 1.5"], leg: ["M6 1.5v6l-1 1.5v5h4", "M5 8.5l3 1.5"] };
function statusIcon(e, st) {
  const inf = E.statusInfo(ctx(), st);
  const tone = inf.def && inf.def.tone === "Positive" ? "pos" : inf.def && inf.def.tone === "Neutral" ? "neu" : "neg";
  const limb = st.n === "Injured Limb (Leg/Arm)" && st.parts ? (st.parts.some((p) => /Leg/.test(p)) ? "leg" : "arm") : null;
  const paths = limb ? LIMB_ICON[limb] : ST_ICON[st.n];
  const pic = paths
    ? paths.map((d) => `<path d="${d}"/>`).join("")
    : `<circle cx="8" cy="8" r="6"/><text x="8" y="11" text-anchor="middle">${h(st.n.slice(0, 2))}</text>`;
  return `<span class="sti ${tone}" title="${h(st.n)}${st.tier > 1 ? " " + st.tier : ""}${st.turns != null ? `, ${st.turns} turns` : ""}: ${h(inf.text)}"><svg viewBox="0 0 16 16" aria-hidden="true">${pic}</svg>${st.tier ? `<sup>${st.tier}</sup>` : ""}</span>`;
}
const statusIcons = (e) => ((e.statuses || []).length ? `<div class="stirow">${e.statuses.map((st) => statusIcon(e, st)).join("")}</div>` : "");
// FAMILIARITY with a weapon, from rounds fired. Each band has a word and a color.
const FAM_COLOR = { Unfamiliar: "#8b0000", Novice: "#ff8fc7", Familiar: "#ffffff", Proficient: "#4da3ff", Expert: "#000000", Master: "#39ff14" };
const famOf = (e, name) => E.famBand(e, name, S.rules);
const famTag = (e, name) => {
  const f = famOf(e, name);
  const sg = (x) => (x > 0 ? "+" : "") + fmt(E.pct(x));
  const fx = [f.crit ? `crit ${sg(f.crit)}%` : "", f.acc ? `hit ${sg(f.acc)}%` : ""].filter(Boolean).join(", ");
  return `<span class="fam fam-${f.word.toLowerCase()}" style="color:${FAM_COLOR[f.word] || "inherit"}" title="${fmt(f.n)} rounds fired with this weapon${fx ? `: ${fx}` : ""}">${f.word}</span>`;
};
function blastHits(at, t) {
  const who = K()
    ? K()
        .cbs.filter((c) => alive(c))
        .map((c) => ent(c.id))
    : [...S.chars, ...S.scene.npcs];
  return who
    .filter(Boolean)
    .map((e) => {
      const d = dist(posOf(e.id), at);
      return { e, d, dmg: E.blastDamage(t, d) };
    })
    .filter((x) => x.dmg > 0)
    .sort((p, q) => p.d - q.d);
}
// MAP EFFECTS: short animations for shots, throws and item use. Each is kept in ui.fx with its start time and drawn with a negative
// animation-delay, so a re-render halfway through carries on where it was instead of starting over. Off when the system asks for less motion.
// 12 Nov: every effect also goes into S.fxq (the last 8, by id), so other screens in a session play it when the game reaches them.
function addFx(f) {
  if (!isSpec()) {
    const id = Math.random().toString(36).slice(2, 10);
    S.fxq = [...(S.fxq || []).slice(-7), { id, f }];
    (ui.fxSeen = ui.fxSeen || new Set()).add(id);
    if (table.on) tableSend();
  }
  playFx(f);
}
function playFx(f) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const now = performance.now();
  ui.fx = (ui.fx || []).filter((x) => now - x.t0 < x.dur);
  ui.fx.push({ ...f, t0: now });
  setTimeout(scheduleRender, f.dur + 40);
}
const liveFx = () => (ui.fx || []).filter((x) => performance.now() - x.t0 < x.dur);
const fxDelay = (f, at = 0) => `animation-delay:${Math.round(at - (performance.now() - f.t0))}ms`;
const TRACER_GAP = 110,
  TRACER_MS = 260;
// a target being hit flashes red and shakes, once for each bullet that lands
function tokFx(id) {
  const f = liveFx().find((x) => x.type === "shot" && x.tgt === id && x.firstHit != null);
  return f ? { cls: "hitfx", style: fxDelay(f, f.firstHit) } : null;
}
function fxLayer(k2, vw) {
  const tw = E.fix(Math.max(0.14 * k2, vw * 0.006)); // tracer width in meters: thin up close, still visible zoomed out
  return liveFx()
    .map((f) => {
      if (f.type === "shot")
        return f.shots
          .map((s, i) => {
            // a short streak runs the length of the line: dash and gap in meters, since lines ignore pathLength in some browsers
            const len = E.fix(dist(f.a, s)),
              ld = E.fix(Math.min(2, Math.max(0.4, len * 0.25)));
            return `<line class="tracer ${s.hit ? "hit" : "miss"}" x1="${f.a.x}" y1="${f.a.y}" x2="${E.fix(s.x)}" y2="${E.fix(s.y)}" style="stroke-width:${tw};stroke-dasharray:${ld} ${E.fix(len + ld)};--ld:${ld}px;--len:${len}px;${fxDelay(f, i * TRACER_GAP)}"/>`;
          })
          .join("");
      if (f.type === "throw") {
        const dx = E.fix(f.to.x - f.from.x),
          dy = E.fix(f.to.y - f.from.y);
        return `<circle class="scatterfx" cx="${f.aim.x}" cy="${f.aim.y}" r="${f.spread}" style="${fxDelay(f)}"/><g transform="translate(${f.from.x} ${f.from.y})"><circle class="nade" r="${E.fix(0.3 * k2)}" style="--dx:${dx}px;--dy:${dy}px;${fxDelay(f)}"/></g><circle class="boom" cx="${f.to.x}" cy="${f.to.y}" r="${f.radius}" style="${fxDelay(f, 700)}"/>`;
      }
      if (f.type === "boom") return `<circle class="boom" cx="${f.at.x}" cy="${f.at.y}" r="${f.radius}" style="${fxDelay(f)}"/>`; // a mine going off
      if (f.type === "float") {
        const p = posOf(f.id);
        const pic =
          f.icon === "MED"
            ? `<rect x="-.42" y="-.42" width=".84" height=".84" rx=".12" class="medbg"/><path class="medx" d="M-.12 -.3h.24v.18h.18v.24h-.18v.18h-.24v-.18h-.18v-.24h.18z"/>`
            : `<g transform="translate(-.42 -.42) scale(.035)" class="ficon">${VICON[f.icon] || VICON.item}</g>`;
        return `<g transform="translate(${E.fix(p.x + 0.6 * k2)} ${E.fix(p.y - 1.2 * k2)}) scale(${E.fix(k2 * 1.4)})"><g class="floatfx" style="${fxDelay(f)}">${pic}</g></g>`;
      }
      return "";
    })
    .join("");
}
function throwOverlay() {
  const T = ui.throwing;
  if (!T) return "";
  const t = S.rules.throwables[T.item];
  const from = posOf(T.id);
  const at = T.at || from;
  const rings = t.dmg
    .map(
      (dm, i) =>
        `<circle class="blastring" cx="${at.x}" cy="${at.y}" r="${i + 1}" style="fill-opacity:${0.22 - i * 0.035}" vector-effect="non-scaling-stroke"/>`,
    )
    .reverse()
    .join("");
  const spread = throwSpread(ent(T.id));
  return `<g id="throwPrev" class="${T.at ? "set" : "follow"}"><line class="throwline" x1="${from.x}" y1="${from.y}" x2="${at.x}" y2="${at.y}" vector-effect="non-scaling-stroke"/>${rings}<circle class="scatterring blastring" cx="${at.x}" cy="${at.y}" r="${spread}"/></g>`;
}
// How far off a throw can land: less the better their Explosives.
function throwSpread(e) {
  const s = S.rules.throwScatter || { base: 0, perSkill: 1, min: 0 };
  return E.fix(Math.max(s.min || 0, (s.base || 0) - (der(e).skills.EXP || 0) / (s.perSkill || 1)));
}
function throwPreview(svg, ev) {
  const g = document.getElementById("throwPrev");
  if (!g) return;
  const p = inMap(svgPoint(svg, ev));
  const ln = g.querySelector(".throwline");
  if (ln) {
    ln.setAttribute("x2", p.x);
    ln.setAttribute("y2", p.y);
  }
  for (const c of g.querySelectorAll(".blastring")) {
    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
  }
}
function throwBar() {
  const T = ui.throwing;
  const A = ent(T.id);
  const t = S.rules.throwables[T.item];
  if (!T.at)
    return `<div class="moveconfirm"><span class="bright">${h(A.name)}: throw ${h(T.item)}</span><span class="s">Click where it lands, up to ${t.range || "any"}m. Blast ${t.radius}m: ${t.dmg.map((x, i) => `${x} at ${i + 1}m`).join(", ")}</span><span class="spacer"></span><button class="btn tiny" data-a="throwCancel" data-v="">${kbd("Esc")}Cancel</button></div>`;
  const hits = blastHits(T.at, t);
  const far = dist(posOf(A.id), T.at);
  if (t.range && far > t.range)
    return `<div class="moveconfirm"><span class="warn">${Math.round(far)}m is too far: ${h(T.item)} reaches ${t.range}m.</span><span class="s">Click closer.</span><span class="spacer"></span><button class="btn tiny" data-a="throwCancel" data-v="">${kbd("Esc")}Cancel</button></div>`;
  return `<div class="moveconfirm"><span class="bright">Throw ${h(T.item)} ${far.toFixed(1)}m?</span><span><b>${t.ap}</b> AP</span><span class="s">Lands within <b>${throwSpread(A)}m</b> of the spot (Explosives ${der(A).skills.EXP || 0}). On the spot: ${hits.map((x) => `${h(x.e.name)} <b>${x.dmg}</b>`).join(" · ") || "nobody in the blast"}</span><span class="spacer"></span><button class="btn primary tiny" data-primary="1" data-a="throwConfirm" data-v="">${kbd("Enter")}Throw</button><button class="btn tiny" data-a="throwCancel" data-v="">${kbd("Esc")}Cancel</button></div>`;
}
function saveToBody() {
  const m = ui.modal;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const pick = !coarse && typeof window.showSaveFilePicker === "function"; // phones use the share sheet
  return `<div class="s" style="margin-bottom:6px">${m.ok ? `Saved in this browser as <b>${h(m.slot)}</b>.` : `<span class="bad">Saving in this browser failed.</span>`} Save a copy to a file too?</div>
   <div class="acts" style="flex-direction:column;align-items:stretch">${packFile ? `<button class="btn primary" data-primary="1" data-a="saveToFile" data-v="same">Save to ${h(packFile.name)}</button>` : ""}
   <button class="btn ${packFile ? "" : "primary"}" ${packFile ? "" : 'data-primary="1"'} data-a="saveToFile" data-v="new">${pick ? "Save to a new location…" : coarse ? "Save a copy to this device" : "Download a copy"}</button>${btn("closeModal", "", "Not now")}</div>
   <div class="s dim" style="margin-top:6px">${pick ? "The file you pick, or the pack you loaded, is remembered for this session." : "This browser can't remember a file location, so a copy is downloaded instead."}</div>`;
}
// The health and inventory figure: the targeting body's boxes (.bp-* in style.css, an 84 x 146 box), moved by (78, 13), same sizes and corners.
// Each part is green when fine and red with stripes when something is wrong; its label sits off to the side on a line.
const FIG_BOX = {
  Head: [30, 0, 24, 24, 6],
  Body: [20, 27, 44, 56, 4],
  LArm: [4, 27, 13, 58, 4],
  RArm: [67, 27, 13, 58, 4],
  LLeg: [22, 86, 18, 60, 4],
  RLeg: [44, 86, 18, 60, 4],
};
const figRect = (id) => {
  const [x, y, w, hh, r] = FIG_BOX[id];
  return `<rect x="${x + 78}" y="${y + 13}" width="${w}" height="${hh}" rx="${r}"/>`;
};
const FIG_PARTS = {
  Head: [figRect("Head"), [132, 25], [176, 18], "r"],
  Body: [figRect("Body"), [142, 60], [176, 50], "r"],
  LArm: [figRect("LArm"), [82, 62], [64, 64], "l"],
  RArm: [figRect("RArm"), [158, 76], [176, 86], "r"],
  LLeg: [figRect("LLeg"), [100, 140], [64, 142], "l"],
  RLeg: [figRect("RLeg"), [140, 148], [176, 132], "r"],
};
function bodyMap(c) {
  const r = S.rules;
  const on = {};
  for (const id of Object.keys(PARTS)) on[id] = [];
  for (const st of c.statuses || []) {
    const label = `${st.n.replace(/ \(.*\)$/, "")}${st.tier > 1 ? " " + st.tier : ""}`;
    for (const p of st.parts || []) if (on[p]) on[p].push(label);
    if (!st.parts && st.n === (r.critStatus || {}).Head) on.Head.push(label);
    if (!st.parts && st.n === (r.critStatus || {}).Body) on.Body.push(label);
  }
  const parts = Object.entries(FIG_PARTS)
    .map(([id, [shape, from, to, side]]) => {
      const bad = on[id].length;
      const crip = on[id].some((x) => /injur|cripp/i.test(x));
      const name = PARTS[id][0].replace(/^(Left|Right) /, (m) => m[0] + " ");
      const say = crip ? "CRIPPLED" : bad ? on[id].join(", ") : "OK";
      const x = side === "l" ? to[0] - 4 : to[0] + 4;
      // the status words wrap onto two short lines so they fit beside the figure
      const words = say.split(" "),
        lines = [""];
      for (const w of words) {
        if (lines[lines.length - 1] && (lines[lines.length - 1] + " " + w).length > 14) lines.push(w);
        else lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim();
      }
      const shown = lines.slice(0, 2).map((t, i) => (i === 1 && lines.length > 2 ? t.slice(0, 13) + "…" : t));
      const anchor = side === "l" ? "end" : "start";
      return `<g class="fp ${bad ? "hurt" : ""} ${crip ? "crip" : ""}"><title>${h(PARTS[id][0])}: ${h(bad ? on[id].join(", ") : "fine")}</title><g class="fps">${shape}</g><path class="lead" d="M${from[0]} ${from[1]}L${to[0]} ${to[1]}"/><text x="${x}" y="${to[1] - 3}" text-anchor="${anchor}" class="fpn">${h(name)}</text>${shown.map((t, i) => `<text x="${x}" y="${to[1] + 11 + i * 12}" text-anchor="${anchor}" class="fpv">${h(t)}</text>`).join("")}</g>`;
    })
    .join("");
  return `<svg class="bodyfig" viewBox="-30 0 300 172" role="img" aria-label="Body"><defs><pattern id="hurtx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="hx0"/><rect width="3" height="6" class="hx1"/></pattern></defs>${parts}</svg>`;
}
function healthBody() {
  const c = ent(ui.modal.id);
  if (!c) return "";
  const d = der(c);
  const base = E.derive({ ...c, statuses: [], effects: [] }, ctx());
  // one row per status or item effect, in columns
  const rows = [];
  (c.statuses || []).forEach((st, i) => {
    const inf = E.statusInfo(ctx(), st);
    const tone = (inf.def || {}).tone === "Positive" ? "Beneficial" : "Harmful";
    rows.push({
      tone,
      n: st.n,
      tier: st.tier || 1,
      where: st.parts ? st.parts.map((p) => PARTS[p][0]).join(", ") : "",
      text: inf.text || (inf.def && inf.def.desc) || "",
      turns: bindNum(c.id, `statuses.${i}.turns`, st.turns),
      del: `${btn("delStatus", `${c.id}|${i}`, "X", "", "tiny", "Remove")}`,
      mods: inf.mods || {},
    });
  });
  (c.effects || []).forEach((f, i) =>
    rows.push({
      tone: "Item",
      n: f.label,
      tier: "",
      where: "",
      text: f.text || "",
      turns: bindNum(c.id, `effects.${i}.turns`, f.turns),
      del: btn("delEffect", `${c.id}|${i}`, "X", "", "tiny", "Remove"),
      mods: {},
    }),
  );
  rows.sort((x, y) => ["Harmful", "Beneficial", "Item"].indexOf(x.tone) - ["Harmful", "Beneficial", "Item"].indexOf(y.tone));
  const table = `<table class="t sttab"><tr><th>Status</th><th>Kind</th><th>Tier</th><th>Where</th><th>Effect</th><th>Turns</th><th></th></tr>${
    rows
      .map(
        (r) =>
          `<tr class="st-${r.tone.toLowerCase()}"><td class="bright">${h(r.n)}</td><td><span class="tag ${r.tone === "Harmful" ? "bad" : ""}">${r.tone}</span></td><td>${r.tier}</td><td class="dim">${h(r.where)}</td><td class="dim">${h(r.text)}</td><td class="tn">${r.turns}</td><td>${r.del}</td></tr>`,
      )
      .join("") || `<tr><td colspan="7" class="dim">No statuses. Harmful and Beneficial ones show here.</td></tr>`
  }</table>`;
  // everything they add up to: stats that moved, odds and damage, and damage or healing each round
  const diffs = [
    ...E.SPECIAL.map((k) => [E.SPECIAL_NAMES[k], base.sp[k], d.sp[k]]),
    ...E.SKILLS.map(([k, n]) => [n, base.skills[k], d.skills[k]]),
    ["Max HP", base.hp, d.hp],
    ["AP", base.ap, d.ap],
    ["DT", base.dt, d.dt],
  ].filter(([, a, b]) => a !== b);
  const sum = diffs.map(([n, a, b]) => [n, `${b - a > 0 ? "+" : ""}${fmt(E.fix(b - a))}`, b < a]);
  const acc = (d.m.acc || 0) - (base.m.acc || 0),
    dam = (d.m.dam || 0) - (base.m.dam || 0);
  if (acc) sum.push(["Hit chance", `${acc > 0 ? "+" : ""}${fmt(E.pct(acc))}%`, acc < 0]);
  if (dam) sum.push(["Damage", `${dam > 0 ? "+" : ""}${fmt(E.pct(dam))}%`, dam < 0]);
  const dot = rows.reduce((t, r) => t + (r.mods.dot || 0), 0),
    regen = rows.reduce((t, r) => t + (r.mods.regen || 0), 0);
  if (dot) sum.push(["Damage each round", `-${fmt(dot)} HP`, true]);
  if (regen) sum.push(["Healing each round", `+${fmt(regen)} HP`, false]);
  const summary = sum.length
    ? `<div class="stsum">${sum.map(([n, v, bad]) => `<div class="${bad ? "neg" : "pos"}"><b>${h(v)}</b><span>${h(n)}</span></div>`).join("")}</div>`
    : `<div class="s dim">Nothing is changing their numbers right now.</div>`;
  return `<div class="hlayout"><div class="hfig">${bodyMap(c)}</div><div class="hright"><div class="geartop"><div class="bigdt"><b>${fmt(c.hp)}/${d.hp}</b><span>HEALTH</span></div><div class="grow">${hpBar(c.hp, d.hp)}<div class="s dim" style="margin-top:4px">AP ${fmt(c.ap)}/${d.ap} · DT ${fmt(d.dt)} · Save ${saveNeed(d.save)}+${c.dbno ? ' · <span class="bad">DOWN (DBNO)</span>' : ""}${c.timesRevived ? ` · Revived ${c.timesRevived}x` : ""}</div></div></div><h3>All statuses together</h3>${summary}</div></div>
   <h3>Statuses <small class="dim">${rows.length}</small></h3>${table}<div class="line"><input class="grow" id="addSt-${c.id}" list="dl-status" placeholder="Add status: type, Enter" data-enter="addStatusFromInput" data-id="${c.id}"></div>${c.kind === "pc" ? implantsBox(c, d) : ""}`;
}
// Implants, at the bottom of Health: slots, what's in, and the odds of each way to put one in.
function implantsBox(c, d) {
  const I = S.rules.implants;
  if (!I) return "";
  const have = c.implants || [];
  const slots = E.implantSlots(c, d, S.rules);
  const free = have.length < slots;
  const busy = fightPhase();
  const dm = !isSpec();
  const pDoc = E.implantOdds(c, d, S.rules, false),
    pSelf = E.implantOdds(c, d, S.rules, true);
  const failed = (c.statuses || []).some((s) => s.n === I.failStatus);
  const rows = I.list
    .map((im, i) => {
      const inn = have.some((n) => E.low(n) === E.low(im.n));
      const carry = (c.inv || []).some((l) => E.low(l.n) === E.low(im.n) && l.q > 0);
      const why = (ok, msg) => (ok ? "" : msg);
      const docNo = why(free, "No free slot") || why(!busy, "Not during a fight") || why((c.caps || 0) >= im.cost, `Needs ${fmt(im.cost)} caps`);
      const selfNo =
        why(free, "No free slot") ||
        why(!busy, "Not during a fight") ||
        why(carry, "Carry the implant to put it in yourself") ||
        why(pSelf > 0, `Needs Medicine ${I.self.minMed}`);
      const acts = inn
        ? `<span class="tag">Installed</span>${dm ? btn("implantOut", `${c.id}|${i}`, "Remove", "", "tiny", "Take it out (no refund)") : ""}`
        : dm
          ? `${btn("implantIn", `${c.id}|${i}|doc`, `Doctor ${fmt(im.cost)}c · ${fmt(E.pct(pDoc))}%`, "", `tiny${docNo ? " na" : ""}`, docNo || "A doctor puts it in. Paid only if it works.")}${btn("implantIn", `${c.id}|${i}|self`, `Self · ${fmt(E.pct(pSelf))}%`, "", `tiny${selfNo ? " na" : ""}`, selfNo || "Put it in yourself. The implant is used only if it works.")}`
          : `<span class="s dim">${carry ? "Carried" : ""}</span>`;
      return `<tr class="${inn ? "st-beneficial" : ""}"><td class="bright">${h(im.n)}</td><td class="dim">${h(im.text)}</td><td class="tn">${fmt(im.cost)}</td><td><div class="opts">${acts}</div></td></tr>`;
    })
    .join("");
  const slotsCtl = dm ? `<span class="s dim">Extra slots</span>${bindNum(c.id, "implantSlotsAdd", c.implantSlotsAdd || 0)}` : "";
  const fix = failed
    ? `<div class="line"><span class="bad">${h(I.failStatus)}</span><span class="s dim">-1 STR, END, AGI until fixed: pay a doctor, or use a Doctor's Bag on yourself.</span>${dm ? btn("surgeryFix", c.id, `Doctor fixes it · ${fmt(I.doctorFix)}c`, "", `tiny${(c.caps || 0) < I.doctorFix ? " na" : ""}`) : ""}</div>`
    : "";
  return `<h3>Implants <small class="dim">${have.length}/${slots} slots</small></h3><div class="line impodds"><span class="s dim">Chance now: by a doctor ${fmt(E.pct(pDoc))}% (END and Luck) · by yourself ${pSelf ? fmt(E.pct(pSelf)) + "%" : `needs Medicine ${I.self.minMed}`} (Medicine, END and Luck). Each implant already in makes the next ${fmt(E.pct(I.perImplant))}% harder.</span><span class="spacer"></span>${slotsCtl}</div>${fix}<table class="t sttab imptab"><tr><th>Implant</th><th>Effect</th><th>Caps</th><th></th></tr>${rows}</table>`;
}
// ----- vendor
// Barter sets the base. Perks with buy or sell variables move it from there.
function priceFactors(e, vendor) {
  const d = e ? der(e) : null;
  const f = E.barterFactors(d ? d.skills.BAR : 0, vendor);
  return { buy: f.buy * (1 + ((d && d.m.buy) || 0)), sell: f.sell * (1 + ((d && d.m.sell) || 0)) };
}
