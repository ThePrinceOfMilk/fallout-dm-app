// ===== 04-sheet-map.js: THE CHARACTER SHEET AND THE MAP. The turn bar, the vendor window, the sheet's sections (SPECIAL, stats, traits, perks,
// inventory, statuses, mods), the encounter window, the fight map and its placement bar, the move readout (moveHow),
// enemy cards, token labels, zoom (mapView, setZoom), the aim line, the accuracy ring and the map's SVG (mapSvg).
// THE TURN BAR: everyone in initiative order across the top of the fight. Click a name to select them.
function turnBar() {
  const k = K();
  return `<div class="turnbar" role="list" aria-label="Turn order"><span class="tblabel">ROUND ${k.round}</span>${order()
    .filter(alive)
    .map((c) => {
      const e = ent(c.id);
      const d = der(e);
      return `<button role="listitem" class="tbi ${c.id === k.turnId ? "on" : ""} ${e.kind === "pc" ? "pc" : e.ally ? "ally" : "foe"} ${k.acted[c.id] && c.id !== k.turnId ? "done" : ""} ${e.dbno ? "down" : ""}" data-a="select" data-v="${c.id}" title="${h(e.name)}: initiative ${fmt(c.init)}, ${fmt(e.hp)}/${d.hp} HP">${iconSvg(iconOf(e))}<span class="tbn">${h(e.name)}</span><span class="tbh">${hpBar(e.hp, d.hp)}</span><span class="tbi0">${fmt(c.init)}</span></button>`;
    })
    .join("")}</div>`;
}
function vendorWin() {
  const v = S.vendor;
  if (!v.stock) v.stock = []; // stock is rolled in an action when the shop opens (railGo), so it's undoable and shared; never while drawing
  const c = ent(ui.sel);
  const bar = c ? der(c).skills.BAR : 0;
  const f = priceFactors(c, v.barter);
  const chipsRow = (act_, list, cur, pre = "") =>
    list.map((x) => `<button class="opt ${x === cur ? "on" : ""}" data-a="${act_}" data-v="${x}">${pre}${x}</button>`).join("");
  const line = (name, q, price, est, a, val, label) =>
    `<tr><td style="width:18px">${itemIcon(name)}</td><td class="bright" title="${h((E.get(ctx(), name) || { o: {} }).o.effect || (E.get(ctx(), name) || { o: {} }).o.buffs || "")}">${h(name)}</td><td>${fmt(q)}</td><td title="${est ? "The workbook has no price for this. Placeholder from Settings." : ""}">${fmt(price)}${est ? "~" : ""}</td><td><button class="btn tiny" data-a="${a}" data-v="${h(val)}">${label}</button></td></tr>`;
  const body = !c
    ? `<div class="dim">Pick a character.</div>`
    : ui.venTab === "buy"
      ? v.stock
          .map((l, i) => {
            const p = E.valueOf(ctx(), l.n);
            return line(l.n, l.q, Math.max(1, Math.ceil(p.val * f.buy)), p.est, "venBuy", i, "Buy");
          })
          .join("")
      : (c.inv || [])
          .map((l, i) => {
            const p = E.valueOf(ctx(), l.n);
            return line(l.n, l.q, Math.floor(p.val * f.sell), p.est, "venSell", i, "Sell");
          })
          .join("");
  return (ui.modal && ui.modal.type === "vendor" ? (b, o) => `<div class="w-vendor">${o.tools}${b}</div>` : (b, o) => win("w-vendor", "Vendor", "", b, o))(
    `<div class="row wrap"><span class="s dim">TIER</span>${chipsRow("venTier", [1, 2, 3, 4, 5, 6], v.tier)}<span class="s dim" style="margin-left:6px">BARTER</span>${chipsRow("venBarter", S.rules.vendorBarter, v.barter)}</div>
    <div class="row wrap" style="margin:3px 0"><button class="opt ${ui.venTab === "buy" ? "on" : ""}" data-a="venTab" data-v="buy">Buy</button><button class="opt ${ui.venTab === "sell" ? "on" : ""}" data-a="venTab" data-v="sell">Sell</button><select id="venWho" data-u="sel" title="Who is trading">${options(
      S.chars.map((x) => [x.id, x.name]),
      ui.sel,
    )}</select><span class="bright">${c ? fmt(c.caps) : 0} caps</span><span class="s dim">Barter ${fmt(bar)} · Buy x${fmt(Math.round(f.buy * 100) / 100)} · Sell x${fmt(Math.round(f.sell * 100) / 100)}</span></div>
    <table class="t"><tr><th></th><th>Item</th><th>Qty</th><th>Caps</th><th></th></tr>${body || `<tr><td colspan="5" class="dim">Nothing here.</td></tr>`}</table>`,
    {
      tools: `<label class="chk s" title="Players on spectator screens get a Vendor button and can buy and sell"><input type="checkbox" data-a="venPublic" data-v=""${v.public ? " checked" : ""}${isSpec() ? " disabled" : ""}>Open to players</label>${btn("venRoll", "", "Restock", "", "tiny", "New stock at this tier")}`,
    },
  );
}
// S.P.E.C.I.A.L. in big type with a drawing for each, across the top of the Character window
function specialRow(c, d) {
  const b0 = baseStats(c);
  return `<div class="spbig">${E.SPECIAL.map(
    (k) =>
      `<div class="spcell ${moved(d.sp[k], b0.sp[k])}" title="${E.SPECIAL_NAMES[k]}: ${d.sp[k]}${d.sp[k] !== b0.sp[k] ? ` (base ${b0.sp[k]})` : ""}">${vicon(k, "spi")}<b>${d.sp[k]}</b><span class="spfull">${E.SPECIAL_NAMES[k]}</span><span class="spabbr">${E.SPECIAL_NAMES[k].slice(0, 3)}</span></div>`,
  ).join("")}</div>`;
}
function statList(c, d) {
  const b0 = baseStats(c);
  return `<h3>Skills</h3><div class="skgrid">${E.SKILLS.map(([k, n]) => {
    const tag = (c.tags || []).includes(k);
    const now = d.skills[k],
      was = b0.skills[k];
    return `<div class="skc ${tag ? "tagged" : ""}" title="${h(n)}: ${now}${now !== was ? ` (base ${was})` : ""}${tag ? ", tagged" : ""}">${vicon(k, "ski")}<span class="grow">${h(n)}</span>${tag ? `<span class="tag">TAG</span>` : ""}<b class="${moved(now, was) || ""}">${fmt(now)}</b></div>`;
  }).join("")}</div>`;
}
function statsSect(c, d) {
  if (isSpec())
    return `<div class="spstats"><span>Level <b>${c.level}</b></span><span>XP <b>${fmt(c.xp)}</b> / ${E.xpFor(c.level + 1, S.rules)}</span><span>Caps <b>${fmt(c.caps)}</b></span></div>`;
  return `<div class="grid">${field("AP now", bindNum(c.id, "ap", c.ap))}${field("Caps", bindNum(c.id, "caps", c.caps))}${field(`XP (next ${E.xpFor(c.level + 1, S.rules)})`, bindNum(c.id, "xp", c.xp))}${field("Level", bindNum(c.id, "level", c.level))}${field("Revived", bindNum(c.id, "timesRevived", c.timesRevived))}${field("Super crit %", numBox(`data-c="setSuper" data-id="${c.id}" id="sc-${c.id}" placeholder="${fmt(E.pct(d.superCrit))}"`, c.superCrit == null ? "" : E.pct(c.superCrit)))}</div>
    <div class="s dim">Carry ${fmt(d.carry)} lb · Active ${fmt(d.enc.active)}/${fmt(d.enc.capActive)} lb · Total ${fmt(d.enc.total)} lb · Skill pts/level ${d.pts}${c.ptsBank ? ` · Unspent ${c.ptsBank}` : ""} · Buy ×${fmt(Math.round(d.buy * 100) / 100)} · Sell ×${fmt(Math.round(d.sell * 100) / 100)}</div>
    ${c.ptsBank ? btn("spendPts", c.id, "Spend skill points", "", "tiny") : ""}
    ${field("Notes", `<textarea rows="2" data-bind="${c.id}:notes" spellcheck="false">${h(c.notes)}</textarea>`)}`;
}
function traitsSect(c) {
  return (
    (c.traits || [])
      .filter(Boolean)
      .map((code) => {
        const t = traitV(db.traitByCode.get(code));
        if (!t) return `<div class="txt bad">Unknown trait ${h(code)}</div>`;
        const variants = DATA.sc.filter((r) => E.low(r.n).startsWith(E.low(t.n) + " ("));
        const st = (c.evolved || {})[code];
        if (st === "E" || st === "R")
          return `<div class="txt"><span class="bright">${h(code)} ${h(st === "E" ? t.evo : t.rep)}</span> <span class="tag ${st === "E" ? "" : "warn"}">${st === "E" ? "EVOLVED" : "REPRESSED"}</span> <span class="s dim">from ${h(t.n)}</span><br>${h(st === "E" ? t.evoDesc || "" : t.repDesc || "")}<br>+ ${h(st === "E" ? t.evoBonus || "" : t.repBonus || "")}
      <div class="row wrap"><select data-bind="${c.id}:evolved.${code}" title="Trait state">${options([["", "Back to " + t.n], ...(t.evo ? [["E", "Evolved: " + t.evo]] : []), ...(t.rep ? [["R", "Repressed: " + t.rep]] : [])], st)}</select></div></div>`;
        return `<div class="txt"><span class="bright">${h(code)} ${h(t.n)}</span> <span class="s dim">${h(t.cat)}</span><br>+ ${h(t.ben)}<br>- ${h(t.draw)}
      ${t.evo || t.rep ? `<div class="s dim">${t.evo ? `Evolves: ${h(t.evo)}${t.evoBonus ? `: ${h(t.evoBonus)}` : ""}${t.evoTrig ? ` (when: ${h(t.evoTrig)})` : ""}` : ""}${t.rep ? ` · Represses: ${h(t.rep)}${t.repBonus ? `: ${h(t.repBonus)}` : ""}` : ""}${t.fail ? ` (fail: ${h(t.fail)})` : ""}</div>` : ""}
      <div class="row wrap"><select data-bind="${c.id}:evolved.${code}" title="Trait state">${options([["", "Base"], ...(t.evo ? [["E", "Evolve: " + t.evo]] : []), ...(t.rep ? [["R", "Repress: " + t.rep]] : [])], (c.evolved || {})[code] || "")}</select>
      ${variants.map((r) => `<label class="chk s"><input type="checkbox" data-a="toggleVariant" data-v="${c.id}|${h(r.n)}"${(c.variants || []).includes(r.n) ? " checked" : ""}>${h(r.n.replace(t.n, "").trim())}</label>`).join(" ")}</div></div>`;
      })
      .join("") || `<div class="dim">No traits. Press E to pick them.</div>`
  );
}
function perksSect(c) {
  const rows = (c.perks || [])
    .map((p) => {
      const i = perkInfo(p);
      const auto = (db.sc.get(E.low(p)) || []).some((r) => r.mods);
      return `<div class="line t"><div class="grow"><span class="bright">${h(p)}</span> <span class="tag">${auto ? "AUTO" : "REMINDER"}</span><div class="s dim">${h(i ? i.effect : "")}</div></div>${btn("delPerk", `${c.id}|${p}`, "X", "", "tiny", "Remove")}</div>`;
    })
    .join("");
  return `${rows}<div class="line"><input class="grow" id="addPerk-${c.id}" list="dl-perks" placeholder="Add perk: type, Enter" data-enter="addPerk" data-id="${c.id}"></div>`;
}
const ITEM_ICON = {
  Healing: "cross",
  "Chem/Drug": "syringe",
  Alcohol: "bottle",
  Drink: "cup",
  Food: "apple",
  Counter: "shield",
  Literature: "book",
  Tobacco: "smoke",
  Resistance: "shield",
  Poison: "skull",
  Tool: "wrench",
};
// [folder name, old pixel icon, line icon]
const ITEM_VICON = {
  Healing: "MED",
  "Chem/Drug": "stim",
  Alcohol: "bottle",
  Drink: "bottle",
  Food: "food",
  Counter: "shield",
  Literature: "book",
  Tobacco: "smoke",
  Resistance: "shield",
  Poison: "skull",
  Tool: "tool",
};
function itemKind(name) {
  const it = E.get(ctx(), name);
  if (!it) return ["Other", "dot", "item"];
  const o = it.o;
  if (it.cat === "weapon")
    return [
      ...(o.tab === "MW" ? ["Melee", "sword"] : o.tab === "EW" ? ["Energy weapons", "bolt"] : o.tab === "EX" ? ["Explosives", "bomb"] : ["Guns", "gun"]),
      weaponIcon(o),
    ];
  if (it.cat === "ammo") return ["Ammo", "ammo", "ammo"];
  if (it.cat === "armor") return o.loc === "Accessory" ? ["Accessories", "ring", "ring"] : ["Armor", "vest", /head/i.test(o.loc) ? "helmet" : "armor"];
  if (it.cat === "material") return ["Materials", "nut", "nut"];
  if (it.cat === "mod") return ["Mods", "scope", "mod"];
  if (it.cat === "item") return [o.cat || "Items", ITEM_ICON[o.cat] || "dot", ITEM_VICON[o.cat] || "item"];
  return ["Other", "dot", "item"];
}
const itemIcon = (name) => vicon(itemKind(name)[2], "ii");
// Inventory folders: each item kind sorts into one tab. Active is everything ticked as on hand.
const INV_TABS = [
  ["all", "All"],
  ["active", "Active"],
  ["weapons", "Weapons"],
  ["armor", "Armor"],
  ["ammo", "Ammo"],
  ["consumables", "Consumables"],
  ["misc", "Misc"],
];
function invTab(name) {
  const it = E.get(ctx(), name);
  if (!it) return "misc";
  if (it.cat === "weapon") return "weapons";
  if (it.cat === "armor") return "armor";
  if (it.cat === "ammo") return "ammo";
  if (it.cat === "item" && CONSUMABLE_CATS.includes(it.o.cat)) return "consumables";
  return "misc";
}
const INV_SORTS = [
  ["recent", "Recent"],
  ["n", "A-Z"],
  ["lb", "Weight"],
  ["val", "Value"],
  ["tier", "Tier"],
];
function invSect(c, d) {
  const q = E.low(ui.modal.q || "");
  const tab = ui.invTab || "all";
  const sort = ui.invSort || "recent";
  const dir = ui.invDir || 1;
  const all = (c.inv || []).map((l, i) => [l, i]);
  const inTab = (l) => tab === "all" || (tab === "active" ? l.active : invTab(l.n) === tab);
  const count = Object.fromEntries(INV_TABS.map(([id]) => [id, all.filter(([l]) => id === "all" || (id === "active" ? l.active : invTab(l.n) === id)).length]));
  const key = {
    recent: ([, i]) => i,
    n: ([l]) => E.low(l.n),
    lb: ([l]) => E.weightOf(ctx(), l.n) * l.q,
    val: ([l]) => E.valueOf(ctx(), l.n).val,
    tier: ([l]) => Number((E.get(ctx(), l.n) || { o: {} }).o.tier) || 0,
  }[sort];
  const rowsIn = all
    .filter(([l]) => inTab(l) && (!q || E.low(l.n).includes(q)))
    .sort((a, b) => {
      const x = key(a),
        y = key(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  const groups = new Map([["", { ic: "dot", rows: rowsIn }]]);
  const tabs = `<div class="ftabs">${INV_TABS.map(([id, n]) => `<button class="ftab ${tab === id ? "on" : ""}" data-a="invTab" data-v="${id}" aria-pressed="${tab === id}">${h(n)}<b>${count[id]}</b></button>`).join("")}</div>`;
  const sorter = `<div class="row wrap isort"><span class="s dim">Sort</span>${INV_SORTS.map(([id, n]) => `<button class="opt ${sort === id ? "on" : ""}" data-a="invSort" data-v="${id}">${n}</button>`).join("")}<button class="btn tiny" data-a="invDir" data-v="" title="${dir > 0 ? "Ascending" : "Descending"}: click to flip">${dir > 0 ? "&#9650; Asc" : "&#9660; Desc"}</button></div>`;
  const body = [...groups.entries()]
    .map(
      ([g, x]) =>
        `${x.rows
          .map(([l, i]) => {
            const it = E.get(ctx(), l.n);
            const canUse = it && it.cat === "item" && usable(it.o);
            return `<div class="irow"><span class="iq">${numBox(`data-c="setQty" data-id="${c.id}" data-i="${i}" id="q-${c.id}-${i}" title="How many"`, fmt(l.q), "cell")}</span>${itemIcon(l.n)}<span class="grow" title="${h(it && it.o.effect ? it.o.effect : "")}">${h(l.n)}${canUse ? `<span class="ustat">${h(useStats(it.o))}</span>` : ""}${it && it.cat === "weapon" && c.kind === "pc" ? ` ${famTag(c, l.n)} <span class="famedit" title="Rounds fired: the DM can set it">${numBox(`data-c="setFam" data-id="${c.id}" data-n="${h(l.n)}" id="fam-${c.id}-${i}"`, fmt(famOf(c, l.n).n), "cell")}</span>` : ""}</span><span class="s faint">${fmt(E.weightOf(ctx(), l.n) * l.q)}lb</span><label class="chk s" title="Active: on hand during combat"><input type="checkbox" data-a="invActive" data-v="${c.id}|${i}"${l.active ? " checked" : ""}>ACTIVE</label>${canUse ? `<button class="btn tiny primary usebtn" data-a="useSelf" data-v="${c.id}|${i}" title="Use it on ${h(c.name)} right away">Self</button><button class="btn tiny usebtn" data-a="useItemFrom" data-v="${c.id}|${i}" title="Use or give it: pick who, then Use">Use…</button>` : ""}<button class="btn tiny" data-a="invDel" data-v="${c.id}|${i}" title="Remove">X</button></div>`;
          })
          .join("")}`,
    )
    .join("");
  return `${gearMenu(c, d)}<div class="row wrap" style="margin:4px 0"><input id="addItem-${c.id}" class="grow" autocomplete="off" list="dl-all" placeholder="Add item: type, Enter" data-enter="addItem" data-id="${c.id}"><input id="invQ" autocomplete="off" style="width:110px" placeholder="Filter" data-u="modal.q" value="${h(ui.modal.q || "")}"></div>${tabs}<div class="fpane">${sorter}${body || `<div class="dim">Nothing here.</div>`}</div>`;
}
function weaponRows(e, d) {
  return (
    (e.weapons || [])
      .map((s, i) => {
        const v = E.weaponView(s, e, d, ctx());
        const loads = v.caliber ? E.loadsFor(ctx(), v.caliber) : [];
        return `<div class="line t"><div class="grow"><input style="width:100%" autocomplete="off" data-c="setWeapon" data-id="${e.id}" data-i="${i}" id="w-${e.id}-${i}" list="dl-weapons" value="${h(s.n)}">
      <div class="s dim">${e.kind === "pc" ? famTag(e, s.n) + " · " : ""}${v.missing ? "unknown weapon" : `${v.melee ? "melee" : h(v.type)} · ${fmt(v.ap)} AP · ${v.count > 1 ? `burst ${v.count} · ` : ""}Dam ${fmt(v.base)} Pen ${fmt(v.pen)}${v.ok ? "" : ` · <span class="warn">blank stats</span>`}${s.jammed ? ` · <span class="bad">JAMMED</span>` : ""}`}</div>
      ${
        loads.length
          ? `<select style="width:100%" data-c="setLoad" data-id="${e.id}" data-i="${i}" id="l-${e.id}-${i}"><option value="">Choose ammo</option>${options(
              loads.map((a) => [a.n, `${a.load}: Dam ${a.pellets ? a.dam + "x" + a.pellets : (a.dam ?? "?")} Pen ${a.pen ?? 0}`]),
              s.ammo,
            )}</select>`
          : ""
      }</div>
      ${v.usesAmmo ? `<label class="f" style="width:48px">Mag/${v.cap}${bindNum(e.id, `weapons.${i}.mag`, s.mag)}</label>${btn("reloadSlot", `${e.id}|${i}`, "Reload", "", "tiny")}` : ""}${s.jammed ? btn("clearSlot", `${e.id}|${i}`, "Clear", "", "tiny") : ""}<button class="btn tiny" data-a="delWeapon" data-v="${e.id}|${i}" title="Remove">X</button></div>`;
      })
      .join("") +
    `<div class="line"><input class="grow" id="addW-${e.id}" list="dl-weapons" placeholder="Add weapon: type, Enter" data-enter="addWeapon" data-id="${e.id}"></div>`
  );
}
function statusSect(e) {
  const rows = (e.statuses || [])
    .map((st, i) => {
      const inf = E.statusInfo(ctx(), st);
      const tiers = (inf.def && inf.def.tiers) || [];
      return `<div class="line t"><div class="grow"><span class="bright">${h(st.n)}</span><div class="s dim">${h(inf.text)}</div></div>${tiers.filter(Boolean).length > 1 ? `<label class="f" style="width:42px">Tier<select data-bind="${e.id}:statuses.${i}.tier" data-t="num">${options([1, 2, 3, 4, 5], st.tier)}</select></label>` : ""}<label class="f" style="width:42px">Turns${bindNum(e.id, `statuses.${i}.turns`, st.turns)}</label><button class="btn tiny" data-a="delStatus" data-v="${e.id}|${i}" title="Remove">X</button></div>`;
    })
    .join("");
  const fx = (e.effects || [])
    .map(
      (f, i) =>
        `<div class="line t"><div class="grow"><span class="bright">${h(f.label)}</span><div class="s dim">${h(f.text || "")}</div></div><label class="f" style="width:42px">Turns${bindNum(e.id, `effects.${i}.turns`, f.turns)}</label><button class="btn tiny" data-a="delEffect" data-v="${e.id}|${i}" title="Remove">X</button></div>`,
    )
    .join("");
  return `${rows}${fx}<div class="line"><input class="grow" id="addSt-${e.id}" list="dl-status" placeholder="Add status: type, Enter" data-enter="addStatusFromInput" data-id="${e.id}"></div>`;
}
function modLine(row) {
  const L = {
    hpMul: "Max HP x",
    hp: "HP",
    dt: "DT",
    ap: "AP",
    apMul: "AP %",
    carry: "Carry",
    carryMul: "Carry %",
    pri: "Init",
    save: "Save",
    pts: "Skill pts",
    acc: "Hit %",
    enemyAcc: "Enemy hit %",
    dam: "Damage %",
    crit: "Crit %",
    apCost: "Attack AP",
    reload: "Reload AP",
    pen: "Pen",
    failRoll: "Fail roll",
    enemyFail: "Enemy fail roll",
    superRoll: "Super crit roll",
    dmgTaken: "Damage taken %",
    hpPct: "Max HP %",
    regen: "HP per turn",
    implantSlots: "Implant slots",
    implantFail: "Implant fail %",
    robotDmgTaken: "Damage from robots %",
    accMul: "Hit chance %",
    addict: "Addiction %",
    apCostMul: "Attack AP %",
    apOnHit: "AP per hit",
    auraEnemyAcc: "Nearby enemies' hit %",
    capsMul: "Caps found %",
    chemDur: "Chem duration",
    count: "Shots per burst",
    critBleed: "Bleeding on a crit",
    critDam: "Crit damage %",
    critToSuper: "Crits that turn super %",
    damFlat: "Damage",
    debuffAdd: "Status tiers dealt",
    endHeal: "HP at turn end",
    enemyInit: "Enemy initiative",
    healOut: "Healing given %",
    killAP: "AP per kill",
    knockChance: "Knockdown %",
    limbMult: "Limb damage taken",
    moveAdd: "Move AP",
    mvm: "Move speed",
    nightPen: "Night penalty",
    reloadMul: "Reload AP %",
    resistMental: "Mental resist",
    saveMul: "Save %",
    setC: "CHA set to",
    traitScale: "Trait effects %",
    weaponSkill: "Weapon skill",
    xpMul: "XP %",
  };
  // on-off abilities read as a name, not a number
  const FLAG = {
    inspire: "Inspires allies",
    itemFree: "Free item use",
    lunge: "Lunge",
    swapFree: "Free weapon swap",
    targetFree: "Free aiming",
    noItems: "Can't use items",
    lucky: "Lucky number",
    vengeful: "Vengeful",
    superKill: "Super crits kill",
    lightHalf: "Light armor halved",
  };
  const pctKeys = new Set([
    "acc",
    "enemyAcc",
    "dam",
    "crit",
    "apMul",
    "carryMul",
    "dmgTaken",
    "hpPct",
    "implantFail",
    "robotDmgTaken",
    "accMul",
    "addict",
    "apCostMul",
    "auraEnemyAcc",
    "capsMul",
    "critDam",
    "critToSuper",
    "healOut",
    "knockChance",
    "reloadMul",
    "saveMul",
    "traitScale",
    "xpMul",
    "r1",
    "r2",
    "r3",
    "r4",
    "r5",
    "r6",
    "r7",
    "r8",
    "r9",
    "r10",
  ]);
  return Object.entries(row.mods || {})
    .filter(([k, v]) => (typeof v === "number" && v !== 0) || v === true)
    .map(([k, v]) => {
      if (k.startsWith("resist:")) return `Resists ${k.slice(7)}${v !== 1 && v !== true ? ` ${v > 0 ? "+" : ""}${v}` : ""}`;
      if (FLAG[k]) return v === 1 || v === true ? FLAG[k] : `${FLAG[k]} ${v}`;
      if (v === true) return L[k] || k;
      const label = SP_LABEL[k] || SKILL_NAME[k] || L[k] || (/^r\d+$/.test(k) ? `Hit R${k.slice(1)} %` : k);
      const val = pctKeys.has(k) ? E.pct(v) : v;
      return `${label} ${k === "hpMul" ? val : (val > 0 ? "+" : "") + val}`;
    })
    .join(", ");
}
// 12 Nov: a consumable's effect in numbers: healing, what it applies, what it cures, the after-effect and the AP to use it.
function useStats(o) {
  const u = o.use || {};
  const bits = [];
  if (u.heal) bits.push(`Heals ${((String(o.effect || "").match(/[^,;:]*\bHP\b[^,;]*/) || [""])[0] || "HP").trim()}`);
  for (const a of u.applies || []) {
    const st = modLine({ mods: a.fx || {} });
    bits.push(`${a.n}${a.tier > 1 ? " " + a.tier : ""}${st ? `: ${st}` : ""}`);
  }
  const fx = modLine({ mods: u.fx || {} });
  if (fx) bits.push(fx);
  for (const [n, t] of Object.entries(u.reduces || {})) bits.push(`${n} -${t} tier${t === 1 ? "" : "s"}`);
  if ((u.removes || []).length) bits.push(`Cures ${u.removes.join(", ")}`);
  if (u.after) bits.push(`then ${u.after.n}${u.after.tier > 1 ? " " + u.after.tier : ""}`);
  if (o.addict) bits.push(`Addiction ${E.pct(o.addict)}%`);
  return bits.join(" · ") || o.effect || "";
}
function modsSect(c, d) {
  return (
    d.sources
      .map(
        (r) =>
          `<div class="txt"><span class="bright">${h(r.n)}</span> <span class="s dim">${h(r.cat || "")}</span>${r.mods ? `<div class="s">${h(modLine(r))}</div>` : ""}${r.note ? `<div class="s dim">${h(r.note)}</div>` : ""}</div>`,
      )
      .join("") || `<div class="dim">Nothing is changing this character's numbers.</div>`
  );
}

// ----- situation windows
function consoleWin() {
  const k = K();
  if (k.phase === "end") return win("w-action", "After action", "", endStage());
  if (k.phase === "defeat") return win("w-action", "Defeat", "", defeatStage());
  const stage = { stealth: stealthStage, init: initStage, turns: turnStage, roundEnd: roundEndStage }[k.phase]();
  const title =
    k.phase === "turns"
      ? `Round ${k.round}: ${h((ent(k.turnId) || {}).name || "")}`
      : k.phase === "roundEnd"
        ? `End of round ${k.round}`
        : k.phase === "init"
          ? "Roll initiative"
          : "Stealth phase";
  return win("w-action", title, "", stage, {
    tools:
      k.phase === "turns" || k.phase === "roundEnd"
        ? `${btn("endCombat", "", npcsAlive() ? "End" : "End the fight", "Q", npcsAlive() ? "tiny" : "primary pulse")}${btn("defeat", "", "Defeat", "D", partyUp() ? "tiny" : "primary pulse")}`
        : "",
  });
}
function mapOptions() {
  return [
    ...Object.entries(S.rules.maps).map(([id, m]) => [id, id === "custom" ? m.n : `${m.n} ${m.w}x${m.h}m`]),
    ...Object.entries(S.customMaps || {}).map(([id, m]) => ["cm:" + id, `${m.n} ${m.w}x${m.h}m (yours)`]),
  ];
}
function encounterWin(open) {
  if (!open)
    return `<section class="win w-enc closed"><header class="wt"><span>Encounter</span></header><div class="wb"><div class="row"><span class="s dim grow">No fight running.</span><button class="btn primary" data-primary="1" data-a="setupOpen" data-v="1">${kbd("B")}Set up encounter</button></div></div></section>`;
  const sc = S.scene;
  const M = mapOf();
  const fx = sc.effects
    .map(
      (f, i) =>
        `<span class="chip neu">${h(f.label)}${f.hit ? ` ${f.who === "enemies" ? "enemy" : f.who === "party" ? "party" : "all"} ${E.pct(f.hit) > 0 ? "+" : ""}${E.pct(f.hit)}%` : ""}<button class="xb" data-a="delEffectScene" data-v="${i}" title="Remove">x</button></span>`,
    )
    .join("");
  const nFx = sc.effects.length;
  // One panel, labelled groups. Desktop puts the action bar on top; phones pin it to the bottom of the screen, in thumb reach.
  const group = (cls, label, body) => `<div class="egrp ${cls}"><div class="eglabel">${label}</div><div class="egbody">${body}</div></div>`;
  const actions = `<div class="encactions">${btn("setupOpen", "", "Close", "", "", "Hide the map. Enemies you added stay in the list.")}<span class="spacer"></span>${btn("beginC", "1", "Sneak in", "H", "", "Start with a stealth phase")}<button class="btn primary big" data-a="beginC" data-v="">${kbd("B")}Begin combat</button></div>`;
  const scene = group(
    "g-scene",
    "Scene",
    `<label class="f loc">Location<select id="mapId" data-c="setMapId">${options(mapOptions(), M.id)}</select></label>${M.id === "custom" ? `<label class="f sz">W (m)${numBox(`id="mapW" data-c="setMapSize" data-k="w"`, M.w)}</label><label class="f sz">H (m)${numBox(`id="mapH" data-c="setMapSize" data-k="h"`, M.h)}</label>` : ""}<label class="f">Time<select data-scene="time" id="scT">${options(SITES("Time/Light"), sc.time)}</select></label><label class="f">Weather<select data-scene="weather" id="scW">${options(SITES("Weather"), sc.weather)}</select></label><label class="f">Terrain<select data-scene="env" id="scE">${options(SITES("Environment"), sc.env)}</select></label>`,
  );
  const room = group(
    "g-room",
    "Room",
    `<label class="f">Style<select id="themeId" data-c="setTheme">${options(
      [...(customMap(M.id) ? [["asBuilt", "As built"]] : []), ...Object.entries(S.rules.roomThemes).map(([id, t]) => [id, t.n])],
      sc.theme,
    )}</select></label><div class="egbtns"><button class="btn primary" data-a="randomRoom" data-v="" title="New furniture for this location and style">Randomize room</button><select id="roomDensity" data-c="setDensity" title="How full the room gets the next time you press Randomize room">${options(
      [
        ["sparse", "Sparse"],
        ["normal", "Normal"],
        ["cluttered", "Cluttered"],
      ],
      S.scene.density || "normal",
    )}</select><label class="chk s" title="Add a chest of ammo near the party. It opens for whoever is within R1 on their turn."><input type="checkbox" id="roomChest" data-u="roomChest"${ui.roomChest ? " checked" : ""}> Chest</label>${btn("clearRoom", "", "Clear room", "", "", "Remove all objects")}</div>`,
  );
  const place = group(
    "g-place",
    "Place on map",
    `<div class="egbtns">${mapTools()}</div><div class="s dim">Pick one, then tap the map.</div><div class="egbtns mmbtns">${btn("mmOpen", "", "Create map", "", "", "Draw a location of your own and keep it with the campaign")}${customMap(M.id) ? btn("mmOpen", String(M.id).slice(3), "Edit this map") : ""}</div>`,
  );
  const foesG = group(
    "g-foes",
    "Enemy positions",
    `<select id="spawnAt" data-c="setSpawn" title="How far from the party enemies appear, as a share of this map's size. New enemies follow it too.">${options(
      [
        ["", "Any distance"],
        ["close", "Close to party"],
        ["mid", "Mid range"],
        ["far", "Far from party"],
      ],
      sc.spawn || "",
    )}</select><div class="egbtns">${btn("scatter", "", "Random spots", "", "", "Random spots for every enemy")}${btn("surround", "", "Surround party", "", "", "Space enemies evenly around the party")}</div>`,
  );
  const mods = fold(
    "encfx",
    "Scene modifiers",
    `<div class="row wrap">${fx || `<span class="s dim">None yet. Results of checks before the fight go here.</span>`}</div><div class="fxadd"><input id="fxLabel" autocomplete="off" placeholder="What happened (e.g. Distraction)" data-u="fxLabel" value="${h(ui.fxLabel)}" data-enter="addFx"><select data-u="fxWho" id="fxWho" title="Whose attacks change">${options(
      [
        ["enemies", "Enemy hit"],
        ["party", "Party hit"],
        ["all", "Everyone's hit"],
      ],
      ui.fxWho,
    )}</select><input type="text" inputmode="decimal" id="fxHit" placeholder="+/- %" data-u="fxHit" value="${h(ui.fxHit)}" data-enter="addFx">${btn("addFx", "", "Add", "", "")}${btn("fxDark", "", "Darkness -10", "", "", "Darkness: enemies -10 to hit")}</div>`,
    { open: false, badge: nFx ? `${nFx} active` : "" },
  );
  const folded = (prefs.fold || {})["w-enc"];
  return `<section class="win w-enc ${folded ? "folded" : ""}" data-wcls="w-enc"${winSize("w-enc")}><header class="wt" data-fold="w-enc"><button type="button" class="foldbtn" data-a="fold" data-v="w-enc" aria-label="${folded ? "Open" : "Fold"} Encounter setup" aria-expanded="${!folded}">${folded ? "+" : "-"}</button><span>Encounter setup</span></header><div class="wb encwb">${actions}<div class="enctop">${scene}<div class="egrow">${room}${place}${foesG}</div>${mods}</div>${mapExtras()}${mapSvg()}</div></section>`;
}
function fightMap() {
  const k = K();
  const M = mapOf();
  const strip = ""; // the turn order lives in the turn bar across the top now
  return `<section class="win w-map"><header class="wt"><span>${h(M.n)} <span class="dim">${M.w}x${M.h}m</span></span><span class="spacer"></span>${mapTools()}</header><div class="wb" style="padding:0">${strip}${mapExtras()}${mapSvg()}</div></section>`;
}
const mapTools = () =>
  Object.entries(MAP_OBJ)
    .filter(([, x]) => x[1])
    .map(
      ([id, [n]]) =>
        `<button class="btn tiny ${ui.place === id ? "on" : ""}" data-a="mapPlace" data-v="${id}" title="Then click the map to place ${h(n.toLowerCase())}">+${h(n.split(" ")[0])}</button>`,
    )
    .join("");
// What the next click on the map places: a kind of thing from the list and, if you like, a name of your own.
function placeChoices(kind) {
  const r = S.rules;
  const hidden = (k) => !!((r.hazardFx || {})[k] || {}).hidden;
  if (kind === "trap")
    return Object.entries(r.hazardKinds || {})
      .filter(([k]) => hidden(k))
      .map(([k, n]) => ["hz:" + k, n]);
  if (kind === "hazard")
    return [
      ...Object.entries(r.hazardKinds || {})
        .filter(([k]) => !hidden(k))
        .map(([k, n]) => ["hz:" + k, n]),
      ...Object.entries(r.mapItems)
        .filter(([, c]) => c.hazard || c.water)
        .map(([k, c]) => [k, `${c.n} (${c.w}x${c.h}m)`]),
    ];
  if (kind === "note") return Object.entries(r.markerKinds || {}).map(([k, n]) => ["mk:" + k, n]);
  const tiers = kind === "hard" ? ["hard", "impenetrable"] : ["concealment", "soft"];
  return [
    ["", kind === "hard" ? "Plain hard cover" : "Plain cover"],
    ...Object.entries(r.mapItems)
      .filter(([k, c]) => tiers.includes(c.cover) && k !== "void")
      .map(([k, c]) => [k, `${c.n} (${(r.cover[c.cover] || {}).n || c.cover}, ${c.w}x${c.h}m)`])
      .sort((a, b) => a[1].localeCompare(b[1])),
  ];
}
function placeBar() {
  const list = placeChoices(ui.place);
  if (ui.placeItem == null || !list.some(([k]) => k === ui.placeItem)) ui.placeItem = list[0][0];
  return `<div class="maptools placebar"><span class="warn s">Place ${h(MAP_OBJ[ui.place][0].toLowerCase())}:</span><select id="placeItem" data-u="placeItem" title="What to place">${options(list, ui.placeItem)}</select><input id="placeName" autocomplete="off" class="grow" placeholder="Name (optional)" data-u="placeName" value="${h(ui.placeName || "")}"><span class="s dim">then click the map · Esc to stop</span></div>`;
}
// The map key: what objects are made of, how solid their cover is, whose token is whose, and the accuracy ring's colors.
function mapLegend() {
  const sw = (m, n) => `<span class="lg"><svg viewBox="0 0 20 14"><rect class="lgobj m-${m}" x="2" y="2" width="16" height="10" rx="1"/></svg>${n}</span>`;
  const tier = (t, n) => `<span class="lg"><svg viewBox="0 0 20 14"><rect class="lgtier lt-${t}" x="2" y="2" width="16" height="10"/></svg>${n}</span>`;
  const ring = [0.1, 0.3, 0.5, 0.7, 0.9].map((x) => `<i style="background:${ringColor(x)}"></i>`).join("");
  return `<div class="maplegend"><b>Made of</b>${sw("wood", "Wood")}${sw("metal", "Metal")}${sw("rust", "Wrecks")}${sw("stone", "Stone")}${sw("plant", "Plants")}${sw("fabric", "Cloth")}${sw("sand", "Sand")}${sw("tile", "Tile")}${sw("rad", "Radioactive")}${sw("radpool", "Rad lake")}${sw("water", "Deep water")}${sw("shallow", "Shallow water")}
    <b>Cover (outline)</b>${tier("concealment", "Concealment: dashed")}${tier("soft", "Soft: thin")}${tier("hard", "Hard: thick")}${tier("impenetrable", "Impenetrable: thickest")}
    <b>Tokens</b><span class="lg"><svg viewBox="0 0 20 14"><circle class="lgb pc" cx="10" cy="7" r="5"/></svg>Party</span><span class="lg"><svg viewBox="0 0 20 14"><circle class="lgb ally" cx="10" cy="7" r="5"/></svg>Ally</span><span class="lg"><svg viewBox="0 0 20 14"><rect class="lgb npc" x="6" y="3" width="8" height="8" transform="rotate(45 10 7)"/></svg>Enemy</span>
    <b>Accuracy ring</b><span class="lg ringkey">${ring}</span><span class="lg">low to high · clear = no shot</span></div>`;
}
// How a queued move happens: the meters, the pace, and what slows it
function moveHow(e, m) {
  const d = Math.round(dist(posOf(m.id), m) * 10) / 10;
  const mult = moveMult(e),
    add = der(e).m.moveAdd || 0;
  const slow = [mult > 1 ? `slowed x${fmt(Math.round(mult * 100) / 100)}` : "", add ? `+${fmt(add)} AP per move` : ""].filter(Boolean).join(", ");
  const wet = E.walkLength(posOf(m.id), m, S.scene.objects, S.rules) - d > 0.05 ? ", slowed by water" : "";
  return { d, text: `walks ${fmt(d)} m at ${fmt(E.fix(speedOf(e)))} m per AP (AGI ${der(e).sp.A})${slow ? `, ${slow}` : ""}${wet}` };
}
function mapExtras() {
  if (ui.throwing) return throwBar();
  if (ui.keyMove && ent(ui.keyMove.id)) {
    const km = ui.keyMove,
      e = ent(km.id),
      m = ui.pendingMove;
    return `<div class="moveconfirm"><span class="bright">Walk ${h(e.name)}</span><span><b>${km.steps}</b> AP · <b>${fmt(E.fix(km.steps * speedOf(e)))}</b> m · ${km.ang}°</span><span class="s dim">${fmt(E.fix(speedOf(e)))} m per AP (AGI ${der(e).sp.A}). ${kbd("A")}${kbd("D")} turn · ${kbd("W")}${kbd("S")} 1 AP more or less · ${kbd("Enter")} walk · ${kbd("Esc")} stop</span>${m ? `<span class="spacer"></span><button class="btn primary tiny" data-a="moveConfirm" data-v="">Walk ${fmt(m.cost)} AP</button>` : ""}</div>`;
  }
  const pm = ui.pendingMove && ent(ui.pendingMove.id);
  if (pm) {
    const m = ui.pendingMove;
    const left = (pm.ap || 0) - m.cost;
    const tgt = ui.atk && ui.atk.tgt && ui.atk.att === m.id && ent(ui.atk.tgt);
    const newR = tgt ? bandFor(dist(m, posOf(tgt.id))) : null;
    const how = moveHow(pm, m);
    return `<div class="moveconfirm"><span class="bright">Move ${h(pm.name)}?</span><span><b>${fmt(how.d)}</b> m</span><span><b>${fmt(m.cost)}</b> AP</span><span class="s dim">${h(how.text)}</span><span><b>${fmt(left)}</b> left</span>${tgt ? `<span>${h(tgt.name)}: <b>R${rangeOf(m.id, tgt.id)} to R${newR}</b></span>` : ""}<span class="spacer"></span><button class="btn primary tiny" data-primary="1" data-a="moveConfirm" data-v="">${kbd("Enter")}Confirm</button><button class="btn tiny" data-a="moveCancel" data-v="">${kbd("Esc")}Cancel</button></div>`;
  }
  const sel = ui.mapSel && S.scene.objects.find((o) => o.id === ui.mapSel);
  return `${
    sel
      ? `<div class="maptools"><span class="s dim">${h(((S.rules.mapItems[sel.item] || {}).n || MAP_OBJ[sel.kind][0]).toUpperCase())}</span><span class="rotbar"><button class="btn tiny" data-a="objRotate" data-v="-15" title="Turn left 15 degrees (Q, or Shift+scroll)">&#8634;</button><span style="width:30px">${numBox(`id="objAngle" data-c="setObjAngle" title="Angle in degrees"`, sel.angle || 0, "cell")}</span><button class="btn tiny" data-a="objRotate" data-v="15" title="Turn right 15 degrees (E, or Shift+scroll)">&#8635;</button><button class="btn tiny" data-a="objRotate" data-v="90" title="Turn a quarter">90</button></span><select id="objCover" data-c="setObjCover" title="Cover tier">${options(
          Object.entries(S.rules.cover).map(([id, t]) => [id, t.n]),
          E.coverTier(sel, S.rules),
        )}</select>${
          E.isDoor(sel, S.rules)
            ? `<button class="btn tiny ${sel.open ? "" : "on"}" data-a="objDoor" data-v="${sel.id}" title="A shut door stops walking and sight; shots still go through at its cover">${sel.open ? "Open: shut it" : "Shut: open it"}</button>`
            : `<label class="chk s"><input type="checkbox" data-a="objBlock" data-v="${sel.id}"${E.walkBlocks(sel, S.rules) ? " checked" : ""}>Blocks walking</label>`
        }<span class="objsize" title="Size in meters">${numBox(`id="objW" data-c="setObjSize" data-k="w" aria-label="Width in meters"`, sel.w, "cell")}x${numBox(`id="objH" data-c="setObjSize" data-k="h" aria-label="Height in meters"`, sel.h, "cell")}m</span><input id="objLabel" autocomplete="off" class="grow" placeholder="Label" data-c="setObjLabel" value="${h(sel.label || "")}">${btn("objDel", sel.id, "Remove", "", "tiny")}</div>`
      : ""
  }${!sel && !ui.place ? `<div class="maptools s dim maphint">Select an object, then drag its handle or press Q/E to turn it.</div>` : ""}${ui.place ? placeBar() : ""}`;
}
const SITES = (sub) => db.situations.filter((r) => r.sub === sub).map((r) => [r.n, r.n === "Grassland" ? "Grassland (Plains)" : r.n]);
function enemyTab() {
  const k = K();
  const list = foes();
  const showList = ui.enemyQ || (!k && !list.length && setupOpen());
  const sort = ui.enemySort || "faction";
  const fac = (t) => (t.named ? " Named" : t.faction || "Unaligned"); // the space puts saved NPCs first
  const byName = (a, b) => a.n.localeCompare(b.n, undefined, { numeric: true });
  const cmp = {
    faction: (a, b) => fac(a).localeCompare(fac(b)) || (a.tier || 0) - (b.tier || 0) || byName(a, b),
    tier: (a, b) => (a.tier || 0) - (b.tier || 0) || byName(a, b),
    az: byName,
  }[sort];
  // typing ranks by the name, so the closest match stays on top; with no text the sort decides
  const found = showList
    ? (ui.enemyQ ? rankByName(allTemplates(), ui.enemyQ) : allTemplates().sort(cmp)).filter((t) => !ui.enemyTier || String(t.tier) === String(ui.enemyTier))
    : [];
  const head = (t, i) =>
    sort === "faction" && !ui.enemyQ && (i === 0 || fac(found[i - 1]) !== fac(t)) ? `<div class="grouphead">${h(fac(t).trim())}</div>` : "";
  const rows = found
    .map(
      (t, i) =>
        `${head(t, i)}<button class="rowbtn" data-a="addPick" data-v="${h(t.n)}" title="${h(t.faction || "Unaligned")} · ${t.mob ? `HP ${t.hp ?? "?"} DT ${t.dt ?? 0}` : "Human"} · XP ${t.xp || 0}"><span class="tag">T${t.tier}</span><span class="grow">${h(t.n)}${t.named ? ` <span class="tag hi">NAMED</span>` : ""}</span>${sort !== "faction" || ui.enemyQ ? `<span class="s dim">${h(fac(t).trim())}</span>` : ""}</button>`,
    )
    .join("");
  const counts = new Map();
  for (const n of list) counts.set(n.tmpl, (counts.get(n.tmpl) || 0) + 1);
  const groups = k
    ? ""
    : [...counts.entries()]
        .map(
          ([t, c]) =>
            `<div class="line"><button class="btn tiny" data-a="pickQty" data-v="${h(t)}|-1" title="One fewer">-</button><span class="bright" style="width:16px;text-align:center">${c}</span><button class="btn tiny" data-a="pickQty" data-v="${h(t)}|1" title="One more">+</button><span class="grow nm">${h(t)}</span></div>`,
        )
        .join("");
  return `<div class="row" style="margin-bottom:3px"><input class="grow" id="enemyQ" autocomplete="off" style="min-width:0" placeholder="Add: type, Enter" data-u="enemyQ" data-enter="addFirstEnemy" value="${h(ui.enemyQ)}"><select data-u="enemyTier" title="Tier" id="enemyTier" style="width:50px">${options([["", "All"], ...[1, 2, 3, 4, 5, 6].map((t) => [t, "T" + t])], ui.enemyTier)}</select><select data-u="enemySort" title="Sort the list" id="enemySort" style="width:84px">${options(
    [
      ["faction", "Faction"],
      ["tier", "Tier"],
      ["az", "A-Z"],
    ],
    sort,
  )}</select></div>
    ${showList ? `<div class="s dim">${found.length} enemies</div>` : ""}
    ${found.length ? `<div class="results" data-scroll="enemyres">${rows}</div>` : ""}${groups ? `<div style="margin-bottom:3px">${groups}</div>` : ""}<div class="cards one">${(k
      ? order()
          .map((c) => ent(c.id))
          .filter((e) => e && e.kind === "npc")
      : list
    )
      .map(enemyCard)
      .join("")}</div>`;
}
function enemyCard(e) {
  const k = K();
  const d = der(e);
  const cb = cbOf(e.id);
  const me = k ? actorId() : null;
  const slot = (e.weapons || [])[e.activeW || 0];
  const gone = cb && !alive(cb);
  const rangeBox =
    me && me !== e.id
      ? numBox(`data-c="setRange" data-id="${e.id}" id="rr-${e.id}" title="Range from ${h((ent(me) || {}).name)}"`, rangeOf(me, e.id), "cell")
      : !k && ui.sel
        ? numBox(
            `data-c="setBand" data-id="${e.id}" id="rr-${e.id}" title="Range from ${h((ent(ui.sel) || {}).name)}. Type a band to move this enemy."`,
            rangeOf(ui.sel, e.id),
            "cell",
          )
        : "";
  return `<article class="card foe ${e.ally ? "ally" : ""} ${ui.rowSel === e.id ? "sel" : ""} ${gone ? "dead" : ""} ${k && k.turnId === e.id ? "cur" : ""} ${ui.atk && ui.atk.tgt === e.id ? "tgt" : ""}" data-a="pick" data-v="${e.id}">
    <header class="chead">${cb && cb.init != null ? numBox(`data-c="setInit" data-id="${e.id}" id="in-${e.id}" title="Initiative"`, fmt(cb.init), "cell init") : ""}${dispTag(e)}<span class="nm grow" title="${h(slot ? slot.n : "No weapon")}">${h(e.name)}</span><span class="tag">T${e.tier}</span>${e.boss ? `<span class="tag hi">BOSS</span>` : ""}${cb && cb.dead ? `<span class="tag bad">DEAD</span>` : ""}${cb && cb.fled ? `<span class="tag">FLED</span>` : ""}<button class="btn tiny ${e.ally ? "on" : ""}" data-a="toggleAlly" data-v="${e.id}" title="Blue tokens fight on the party's side">Ally</button>${btn("edit", e.id, "E", "", "tiny", "Edit this copy")}</header>
    <div class="hpline"><span>HP</span>${bindNum(e.id, "hp", e.hp, `id="rh-${e.id}"`, "cell")}<span>/${d.hp}</span><span class="grow">${hpBar(e.hp, d.hp)}</span></div>
    <div class="hpline"><span>AP</span>${bindNum(e.id, "ap", e.ap, `id="ra-${e.id}"`, "cell")}<span>/${d.ap}</span><span>DT ${fmt(d.dt)}</span><span class="grow"></span>${rangeBox ? `<span class="bright">R</span>${rangeBox}` : ""}</div>${chips(e)}</article>`;
}
// 12 Nov: the disposition icon beside an enemy's or ally's name, from the initiative screen on. Click to change it.
function dispTag(e) {
  const k = K();
  const d = e.disp && (S.rules.dispositions || {})[e.disp];
  if (!d || !k || k.phase === "stealth" || isSpec()) return "";
  return `<button class="dispb" data-a="dispNext" data-v="${e.id}" title="${h(d.n)}: ${h(d.d)} Click to change.">${vicon("d_" + e.disp, "dispic")}</button>`;
}
// The name under a token: an enemy's nickname if it has one ("Fiend - Zed" reads Zed), otherwise the whole name.
function tokenLabel(e) {
  const n = String(e.name);
  return e.kind !== "pc" && / - /.test(n) ? n.split(" - ").slice(1).join(" - ") : n;
}
// A long name is cut in two near its middle, so it sits under its own token and not under the neighbour's.
function labelLines(e, tail = "") {
  const n = tokenLabel(e),
    w = n.split(" ");
  let lines = [n];
  if (n.length > 10 && w.length > 1) {
    let best = 1,
      gap = Infinity;
    for (let i = 1; i < w.length; i++) {
      const d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length);
      if (d < gap) {
        gap = d;
        best = i;
      }
    }
    lines = [w.slice(0, best).join(" "), w.slice(best).join(" ")];
  }
  lines[lines.length - 1] += tail;
  return lines;
}
// PEOPLE ON THE MAP. Zoomed out they keep a steady size on screen, about 2% of the view, so you can always find them.
// As you zoom in they stop shrinking at real life size, so up close they look like a person next to a real-size table.
// 11 Nov: tokens are drawn at real size, about 1 m across, at every zoom (TOKEN_REAL: the base circle is 1 m wide).
// Zoomed out so far that a token is under LENS_PX on screen, a magnifier marker on a line points at it, with its name and health.
const TOKEN_REAL = 0.58,
  LENS_PX = 16;
const tokenScale = () => TOKEN_REAL;
const ZOOM_MIN_VIEW = 5; // the closest zoom: 5 meters across
// What part of the map is on screen. No zoom means the whole map with a small margin.
function mapView() {
  const M = mapOf();
  const pad = Math.max(M.w, M.h) * 0.03;
  const W = M.w + 2 * pad,
    H = M.h + 2 * pad;
  const z = ui.zoom;
  if (!z) return { x: -W / 2, y: -H / 2, w: W, h: H, W, H };
  const w = W / z.k,
    h = H / z.k;
  return { x: clamp(z.x - w / 2, -W / 2, W / 2 - w), y: clamp(z.y - h / 2, -H / 2, H / 2 - h), w, h, W, H };
}
function setZoom(k, cx, cy) {
  const v = mapView();
  const maxK = Math.max(1, v.W / ZOOM_MIN_VIEW);
  const nk = clamp(k, 1, maxK);
  ui.zoom = nk <= 1.001 ? null : { k: nk, x: cx != null ? cx : v.x + v.w / 2, y: cy != null ? cy : v.y + v.h / 2 };
}
// ----- top-down drawings, in a 1 by 1 box that gets stretched to the object's real size in meters. "d" lines are details.
const lobes = (r, n, cx = 0, cy = 0) => {
  let p = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = (cx + r * Math.cos(a)).toFixed(3),
      y = (cy + r * Math.sin(a)).toFixed(3);
    p += i ? `A${(r * 0.42).toFixed(3)} ${(r * 0.42).toFixed(3)} 0 0 1 ${x} ${y}` : `M${x} ${y}`;
  }
  return p + "Z";
};
const box = (x, y, w, h, c = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".035"${c ? ` class="${c}"` : ""}/>`; // corners softened a touch
const dline = (d) => `<path class="d" d="${d}"/>`;
const CIRC = (r, x = 0, y = 0, c = "") => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r}"${c ? ` class="${c}"` : ""}/>`;
// TOKEN ICONS: how a character shows on the map. Same box as the default person: head at the top, shoulders at the bottom.
// "b" parts take the side's color, "cut" parts are dark details. Pick one by clicking the icon on the top left of a player card.
const HEAD = `<circle class="b" cy="-.42" r=".27"/>`,
  BODY = `<path class="b" d="M-.46 .4 A.46 .62 0 0 1 .46 .4 Z"/>`;
const TOKEN_ICONS = {
  person: ["Person", HEAD + BODY],
  armored: [
    "Armored",
    `${HEAD}<path class="b" d="M-.5 .4 V.02 Q-.5 -.12 -.3 -.12 H.3 Q.5 -.12 .5 .02 V.4 Z"/><path class="cut" d="M-.5 -.02 H-.24 V.08 H-.5Z M.24 -.02 H.5 V.08 H.24Z M-.1 .02 H.1 V.36 H-.1Z"/>`,
  ],
  power: [
    "Power armor",
    `<path class="b" d="M-.3 -.72 H.3 Q.36 -.72 .36 -.62 V-.2 H-.36 V-.62 Q-.36 -.72 -.3 -.72Z"/><path class="cut" d="M-.26 -.5 H.26 V-.4 H-.26Z"/><path class="b" d="M-.56 .4 V-.04 Q-.56 -.16 -.42 -.16 H.42 Q.56 -.16 .56 -.04 V.4 Z"/><path class="cut" d="M-.18 -.06 H.18 V.18 H-.18Z"/>`,
  ],
  raider: [
    "Raider",
    `${HEAD}<path class="b" d="M-.3 -.5 Q-.34 -1 0 -1 Q.34 -1 .3 -.5 L.2 -.46 V-.38 H-.2 V-.46Z"/><path class="cut" d="M-.2 -.8 H-.05 V-.66 H-.2Z M.05 -.8 H.2 V-.66 H.05Z M-.03 -.6 H.03 V-.52 H-.03Z M-.12 -.46 H-.08 V-.38 H-.12Z M-.02 -.46 H.02 V-.38 H-.02Z M.08 -.46 H.12 V-.38 H.08Z"/>${BODY}<path class="b" d="M-.52 .06 L-.68 -.08 L-.44 -.02Z M0.52 0.06 L0.68 -0.08 L0.44 -0.02 Z"/>`,
  ],
  cowboy: [
    "Cowboy",
    `${HEAD}<path class="b" d="M-.48 -.56 Q0 -.48 .48 -.56 Q.34 -.62 .2 -.62 Q.2 -.86 0 -.86 Q-.2 -.86 -.2 -.62 Q-.34 -.62 -.48 -.56Z"/>${BODY}<path class="cut" d="M-.08 -.12 L0 .02 L.08 -.12Z"/>`,
  ],
  soldier: [
    "Soldier",
    `${HEAD}<path class="b" d="M-.34 -.46 Q-.34 -.82 0 -.82 Q.34 -.82 .34 -.46 H.4 V-.42 H-.4 V-.46Z"/>${BODY}<path class="cut" d="M-.38 .02 L.28 .36 L.32 .3 L-.34 -.04Z"/>`,
  ],
  king: [
    "King",
    `${HEAD}<path class="b" d="M-.26 -.6 L-.3 -.86 L-.14 -.72 L0 -.9 L.14 -.72 L.3 -.86 L.26 -.6Z"/>${BODY}<path class="cut" d="M-.06 -.08 H.06 V.3 H-.06Z"/>`,
  ],
  ninja: [
    "Ninja",
    `${HEAD}<path class="cut" d="M-.25 -.48 H.25 V-.38 H-.25Z"/><path class="b" d="M.22 -.56 L.46 -.66 L.44 -.6 L.24 -.52Z"/>${BODY}<path class="b" d="M-.5 -.4 L.44 .3 L.4 .34 L-.54 -.36Z"/>`,
  ],
  muscle: [
    "Muscle",
    `<circle class="b" cy="-.48" r=".22"/><path class="b" d="M-.62 .4 Q-.66 -.06 -.42 -.2 Q-.2 -.26 0 -.18 Q.2 -.26 .42 -.2 Q.66 -.06 .62 .4 Z"/><path class="cut" d="M-.02 -.14 V.16 M-.3 -.04 Q-.16 .04 -.04 -.02 M.3 -.04 Q.16 .04 .04 -.02" style="fill:none;stroke:#000;stroke-width:.05"/>`,
  ],
  sniper: ["Sniper", `${HEAD}${BODY}<path class="b" d="M-.6 -.1 L.66 -.34 L.68 -.28 L-.58 -.04Z"/><path class="b" d="M.0 -.28 H.22 V-.2 H0Z"/>`],
  medic: ["Medic", `${HEAD}${BODY}<path class="cut" d="M-.05 -.02 H.05 V.08 H.15 V.18 H.05 V.28 H-.05 V.18 H-.15 V.08 H-.05Z"/>`],
  scientist: [
    "Scientist",
    `${HEAD}<path class="cut" d="M-.22 -.47 a.08 .08 0 1 0 .16 0 a.08 .08 0 1 0 -.16 0 M.06 -.47 a.08 .08 0 1 0 .16 0 a.08 .08 0 1 0 -.16 0"/>${BODY}<path class="cut" d="M-.04 -.12 L-.16 .4 H-.08 L0 0 L.08 .4 H.16 L.04 -.12Z"/>`,
  ],
  hood: [
    "Hooded",
    `<path class="b" d="M-.32 -.3 Q-.34 -.78 0 -.8 Q.34 -.78 .32 -.3 Q0 -.2 -.32 -.3Z"/><path class="cut" d="M-.18 -.34 Q-.18 -.58 0 -.6 Q.18 -.58 .18 -.34 Q0 -.28 -.18 -.34Z"/>${BODY}`,
  ],
  tribal: [
    "Tribal",
    `${HEAD}<path class="b" d="M.16 -.62 Q.36 -.9 .3 -1 Q.18 -.86 .1 -.66Z"/>${BODY}<path class="cut" d="M-.3 .04 L.3 .04 M-.3 .14 L.3 .14" style="fill:none;stroke:#000;stroke-width:.04"/>`,
  ],
  mutant: ["Mutant", `<circle class="b" cy="-.5" r=".2"/><path class="b" d="M-.66 .4 Q-.7 -.24 -.24 -.3 H.24 Q.7 -.24 .66 .4Z"/>`],
  ghoul: [
    "Ghoul",
    `${HEAD}<path class="cut" d="M-.14 -.5 h.08 v.08 h-.08Z M.06 -.5 h.08 v.08 h-.08Z M-.1 -.32 h.2 v.04 h-.2Z"/>${BODY}<path class="cut" d="M-.3 .1 l.08 .1 l.06 -.08 M.12 .2 l.1 -.06 l.06 .1" style="fill:none;stroke:#000;stroke-width:.04"/>`,
  ],
  robot: [
    "Robot",
    `<path class="b" d="M-.24 -.68 H.24 V-.22 H-.24Z"/><path class="b" d="M-.02 -.86 H.02 V-.68 H-.02Z"/><path class="cut" d="M-.16 -.52 h.1 v.08 h-.1Z M.06 -.52 h.1 v.08 h-.1Z"/><path class="b" d="M-.42 .4 V-.14 H.42 V.4Z"/><path class="cut" d="M-.16 -.02 h.32 v.16 h-.32Z"/>`,
  ],
  gunslinger: ["Gunslinger", `${HEAD}${BODY}<path class="b" d="M.3 .02 H.66 V.1 H.42 L.36 .26 H.28Z M-.3 .02 H-.66 V.1 H-.42 L-.36 .26 H-.28Z"/>`],
  heavy: ["Heavy gunner", `${HEAD}${BODY}<path class="b" d="M-.2 -.02 H.7 V.16 H-.2Z"/><path class="cut" d="M.4 .02 H.68 V.06 H.4Z M.4 .1 H.68 V.14 H.4Z"/>`],
  dog: [
    "Dog",
    `<path class="b" d="M-.5 .1 Q-.5 -.12 -.2 -.12 H.22 L.3 -.34 L.52 -.36 L.58 -.22 L.42 -.1 V.1 L.36 .38 H.28 L.26 .14 H-.3 L-.32 .38 H-.4Z"/><path class="b" d="M.36 -.36 L.4 -.5 L.46 -.36Z"/>`,
  ],
  fiend: [
    "Fiend",
    `${HEAD}<path class="b" d="M-.2 -.54 Q-.62 -.56 -.56 -1 Q-.44 -.74 -.12 -.68Z M0.2 -0.54 Q0.62 -0.56 0.56 -1 Q0.44 -0.74 0.12 -0.68 Z"/><path class="cut" d="M-.17 -.5 H-.05 V-.41 H-.17Z M.05 -.5 H.17 V-.41 H.05Z"/>${BODY}<path class="cut" d="M-.3 .0 L-.2 .12 L-.1 0 L0 .12 L.1 0 L.2 .12 L.3 0 L.3 .06 L.2 .18 L.1 .06 L0 .18 L-.1 .06 L-.2 .18 L-.3 .06Z"/>`,
  ],
  khan: [
    "Great Khan",
    `${HEAD}<path class="b" d="M-.32 -.44 Q-.32 -.8 0 -.8 Q.32 -.8 .32 -.44Z M-.05 -.78 L0 -1.02 L.05 -.78Z"/><path class="b" d="M-.3 -.6 L-.56 -.82 L-.3 -.48Z M0.3 -0.6 L0.56 -0.82 L0.3 -0.48 Z"/>${BODY}<path class="cut" d="M-.12 -.16 L0 .32 L.12 -.16 L.05 -.16 L0 .08 L-.05 -.16Z"/>`,
  ],
  convict: [
    "Powder Ganger",
    `${HEAD}${BODY}<path class="cut" d="M-.34 -.04 H.34 V.03 H-.34Z M-.42 .12 H.42 V.19 H-.42Z M-.44 .28 H.44 V.35 H-.44Z"/><path class="b" d="M.5 -.3 H.58 V.1 H.5Z"/><path class="b" d="M.52 -.3 L.6 -.44 L.62 -.42 L.56 -.3Z"/>`,
  ],
  bandit: [
    "Bandit",
    `${HEAD}<path class="b" d="M-.46 -.6 H.46 V-.53 H-.46Z M-.24 -.6 V-.84 H.24 V-.6Z"/><path class="cut" d="M-.25 -.4 H.25 V-.26 Q0 -.12 -.25 -.26Z"/>${BODY}`,
  ],
  ncr: [
    "NCR trooper",
    `${HEAD}<path class="b" d="M-.54 -.5 H.54 V-.57 Q.38 -.62 .3 -.66 Q.26 -.88 0 -.88 Q-.26 -.88 -.3 -.66 Q-.38 -.62 -.54 -.57Z"/>${BODY}<path class="cut" d="M-.22 -.02 H-.08 V.1 H-.22Z M.08 -.02 H.22 V.1 H.08Z"/>`,
  ],
  legion: [
    "Legionary",
    `${HEAD}<path class="b" d="M-.3 -.42 Q-.3 -.74 0 -.74 Q.3 -.74 .3 -.42Z"/><path class="b" d="M-.4 -.7 Q0 -1.16 .4 -.7 L.28 -.66 Q0 -.9 -.28 -.66Z"/><path class="b" d="M-.3 -.44 V-.22 H-.22 V-.44Z M0.3 -0.44 V-0.22 H0.22 V-0.44 Z"/>${BODY}<path class="cut" d="M-.34 -.06 L.3 .38 L.36 .32 L-.28 -.12Z M0.34 -0.06 L-0.3 0.38 L-0.36 0.32 L0.28 -0.12 Z"/>`,
  ],
  mobster: [
    "Mobster",
    `${HEAD}<path class="b" d="M-.48 -.58 Q0 -.5 .48 -.58 L.46 -.66 Q0 -.6 -.46 -.66Z M-.27 -.64 L-.22 -.9 Q0 -.96 .22 -.9 L.27 -.64Z"/><path class="cut" d="M-.25 -.72 H.25 V-.67 H-.25Z"/>${BODY}<path class="cut" d="M-.05 -.16 H.05 L.09 .2 L0 .32 L-.09 .2Z"/>`,
  ],
  greaser: [
    "Greaser",
    `${HEAD}<path class="b" d="M-.3 -.5 Q-.4 -.94 .1 -.92 Q.5 -.9 .34 -.54 Q.16 -.74 -.3 -.5Z"/>${BODY}<path class="cut" d="M-.22 -.18 L0 .06 L.22 -.18 L.13 -.18 L0 -.04 L-.13 -.18Z"/>`,
  ],
  pilot: [
    "Boomer",
    `${HEAD}<path class="b" d="M-.3 -.42 Q-.3 -.74 0 -.74 Q.3 -.74 .3 -.42Z"/><path class="b" d="M-.33 -.46 V-.2 H-.23 V-.46Z M0.33 -0.46 V-0.2 H0.23 V-0.46 Z"/><path class="cut" d="M-.25 -.62 H-.04 V-.5 H-.25Z M.04 -.62 H.25 V-.5 H.04Z"/>${BODY}`,
  ],
  eyebot: [
    "Eyebot",
    `<ellipse class="b" cx="0" cy="-0.32" rx="0.36" ry="0.36"/><ellipse class="cut" cx="0" cy="-0.32" rx="0.13" ry="0.13"/><path class="b" d="M-.2 -.62 L-.42 -1 L-.36 -1.02 L-.13 -.66Z M0.2 -0.62 L0.42 -1 L0.36 -1.02 L0.13 -0.66 Z"/><path class="b" d="M-.025 -.68 H.025 V-.94 H-.025Z"/><path class="b" d="M-.2 0 L-.28 .32 L-.21 .32 L-.11 .03Z M0.2 0 L0.28 0.32 L0.21 0.32 L0.11 0.03 Z"/>`,
  ],
  ant: [
    "Ant",
    `<ellipse class="b" cx="0" cy="-0.64" rx="0.14" ry="0.13"/><ellipse class="b" cx="0" cy="-0.34" rx="0.13" ry="0.18"/><ellipse class="b" cx="0" cy="0.1" rx="0.24" ry="0.3"/><path class="b" d="M-.1 -.74 L-.3 -1 L-.26 -1.02 L-.05 -.76Z M0.1 -0.74 L0.3 -1 L0.26 -1.02 L0.05 -0.76 Z"/><path class="b" d="M-.1 -.42 L-.5 -.62 L-.53 -.56 L-.1 -.35Z M0.1 -0.42 L0.5 -0.62 L0.53 -0.56 L0.1 -0.35 Z"/><path class="b" d="M-.12 -.3 L-.58 -.26 L-.58 -.19 L-.12 -.23Z M0.12 -0.3 L0.58 -0.26 L0.58 -0.19 L0.12 -0.23 Z"/><path class="b" d="M-.12 -.2 L-.52 .1 L-.48 .15 L-.1 -.13Z M0.12 -0.2 L0.52 0.1 L0.48 0.15 L0.1 -0.13 Z"/>`,
  ],
  scorpion: [
    "Scorpion",
    `<ellipse class="b" cx="0" cy="0.02" rx="0.2" ry="0.3"/><path class="b" d="M-.12 -.2 L-.44 -.42 L-.52 -.74 L-.38 -.6 L-.4 -.8 L-.26 -.58 L-.33 -.44 L-.08 -.27Z M0.12 -0.2 L0.44 -0.42 L0.52 -0.74 L0.38 -0.6 L0.4 -0.8 L0.26 -0.58 L0.33 -0.44 L0.08 -0.27 Z"/><path class="b" d="M-.18 -.04 L-.48 -.1 L-.49 -.04 L-.18 .03Z M0.18 -0.04 L0.48 -0.1 L0.49 -0.04 L0.18 0.03 Z"/><path class="b" d="M-.18 .1 L-.5 .16 L-.48 .22 L-.17 .17Z M0.18 0.1 L0.5 0.16 L0.48 0.22 L0.17 0.17 Z"/><path class="b" d="M-.05 .28 Q-.06 .44 .2 .44 Q.56 .44 .56 .1 L.66 .04 L.46 -.06 L.46 .12 Q.46 .34 .2 .34 Q.06 .34 .05 .28Z"/>`,
  ],
  wasp: [
    "Cazador",
    `<ellipse class="b" cx="0" cy="-0.6" rx="0.14" ry="0.13"/><ellipse class="b" cx="0" cy="-0.1" rx="0.16" ry="0.34"/><path class="b" d="M-.1 -.32 Q-.74 -.78 -.7 -.12 Q-.42 .02 -.1 -.16Z M0.1 -0.32 Q0.74 -0.78 0.7 -0.12 Q0.42 0.02 0.1 -0.16 Z"/><path class="b" d="M-.05 .22 L0 .45 L.05 .22Z"/><path class="cut" d="M-.15 -.04 H.15 V.03 H-.15Z M-.13 .1 H.13 V.17 H-.13Z"/>`,
  ],
  deathclaw: [
    "Deathclaw",
    `<path class="b" d="M-.3 .4 Q-.36 -.3 -.16 -.42 H.16 Q.36 -.3 .3 .4Z"/><path class="b" d="M-.19 -.48 Q-.19 -.8 0 -.8 Q.19 -.8 .19 -.48 L.08 -.3 H-.08Z"/><path class="b" d="M-.14 -.7 Q-.48 -.78 -.44 -1.02 Q-.32 -.86 -.05 -.78Z M0.14 -0.7 Q0.48 -0.78 0.44 -1.02 Q0.32 -0.86 0.05 -0.78 Z"/><path class="b" d="M-.28 -.36 L-.62 -.1 L-.74 .2 L-.73 .45 L-.66 .26 L-.62 .45 L-.57 .26 L-.52 .42 L-.5 .16 L-.42 -.02 L-.3 -.1Z M.28 -.36 L.62 -.1 L.74 .2 L.73 .45 L.66 .26 L.62 .45 L.57 .26 L.52 .42 L.5 .16 L.42 -.02 L.3 -.1Z"/><path class="cut" d="M-.11 -.62 H-.03 V-.56 H-.11Z M.03 -.62 H.11 V-.56 H.03Z"/>`,
  ],
  lizard: [
    "Gecko",
    `<path class="b" d="M-.72 .2 Q-.4 0 -.1 -.02 Q.1 -.2 .3 -.2 L.34 -.44 L.46 -.24 Q.68 -.2 .7 -.06 Q.5 .06 .34 .02 L.3 .14 L.36 .38 H.26 L.2 .16 H-.1 L-.14 .38 H-.24 L-.22 .14 Q-.46 .16 -.72 .2Z"/><path class="cut" d="M.48 -.15 H.55 V-.09 H.48Z"/>`,
  ],
  beast: [
    "Horned beast",
    `<path class="b" d="M-.27 -.5 H.27 L.2 .12 Q0 .34 -.2 .12Z"/><path class="b" d="M-.24 -.46 Q-.66 -.5 -.62 -.94 Q-.5 -.64 -.18 -.62Z M0.24 -0.46 Q0.66 -0.5 0.62 -0.94 Q0.5 -0.64 0.18 -0.62 Z"/><path class="b" d="M-.26 -.36 L-.5 -.28 L-.25 -.22Z M0.26 -0.36 L0.5 -0.28 L0.25 -0.22 Z"/><path class="cut" d="M-.17 -.3 H-.08 V-.22 H-.17Z M.08 -.3 H.17 V-.22 H.08Z M-.1 .06 H-.04 V.13 H-.1Z M.04 .06 H.1 V.13 H.04Z"/>`,
  ],
  rat: [
    "Rat",
    `<ellipse class="b" cx="-0.06" cy="0.1" rx="0.36" ry="0.2"/><path class="b" d="M.2 -.04 L.66 .14 L.2 .28Z"/><ellipse class="b" cx="0.2" cy="-0.12" rx="0.11" ry="0.11"/><path class="b" d="M-.38 .12 Q-.72 .1 -.72 -.24 L-.65 -.24 Q-.65 .04 -.38 .05Z"/><path class="b" d="M-.22 .26 H-.13 V.4 H-.22Z M.08 .26 H.17 V.4 H.08Z"/><path class="cut" d="M.4 .06 H.46 V.12 H.4Z"/>`,
  ],
  plant: [
    "Spore plant",
    `<path class="b" d="M-.035 .42 V-.14 H.035 V.42Z"/><path class="b" d="M0 .22 Q-.44 .12 -.54 -.1 Q-.2 -.08 0 .1Z M-0 0.22 Q0.44 0.12 0.54 -0.1 Q0.2 -0.08 -0 0.1 Z"/><ellipse class="b" cx="0" cy="-0.44" rx="0.3" ry="0.28"/><path class="cut" d="M-.22 -.44 L-.11 -.35 L0 -.44 L.11 -.35 L.22 -.44 L.22 -.37 L.11 -.28 L0 -.37 L-.11 -.28 L-.22 -.37Z"/>`,
  ],
  paw: [
    "Animal",
    `<ellipse class="b" cx="0" cy="0.1" rx="0.27" ry="0.21"/><ellipse class="b" cx="-0.32" cy="-0.18" rx="0.1" ry="0.12"/><ellipse class="b" cx="-0.12" cy="-0.38" rx="0.1" ry="0.12"/><ellipse class="b" cx="0.12" cy="-0.38" rx="0.1" ry="0.12"/><ellipse class="b" cx="0.32" cy="-0.18" rx="0.1" ry="0.12"/>`,
  ],
  skull: [
    "Skull",
    `<path class="b" d="M-.34 -.36 Q-.34 -.78 0 -.78 Q.34 -.78 .34 -.36 Q.34 -.2 .2 -.16 V-.04 H-.2 V-.16 Q-.34 -.2 -.34 -.36Z"/><path class="cut" d="M-.2 -.46 h.14 v.12 h-.14Z M.06 -.46 h.14 v.12 h-.14Z"/>${BODY}`,
  ],
};
function iconOf(e) {
  if (!e) return "person";
  if (e.kind === "pc" || e.icon) return e.icon || "person";
  const r = S.rules;
  const name = E.low(e.tmpl || e.name);
  if (!e.mob) for (const [pattern, icon] of r.roleIcons || []) if (TOKEN_ICONS[icon] && new RegExp(pattern, "i").test(name)) return icon;
  const byFaction = !e.mob && (r.factionIcons || {})[e.faction];
  if (byFaction) return byFaction;
  for (const [pattern, icon] of r.creatureIcons || []) if (new RegExp(pattern, "i").test(name)) return icon;
  return { robot: "robot", insect: "ant", ghoul: "ghoul", animal: "paw" }[E.enemyType(e, r)] || "person";
}
const iconSvg = (id, cls = "") =>
  `<svg class="ticon ${cls}" viewBox="-.75 -1.05 1.5 1.5" aria-hidden="true">${(TOKEN_ICONS[id] || TOKEN_ICONS.person)[1]}</svg>`;
const GLYPH = {
  chest: `${box(-0.5, -0.5, 1, 1, "")}${dline("M-.5 -.12H.5M-.08 -.12V.12H.08V-.12")}`,
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
  // ---- added 11 Nov: a drawing of its own for each kind of thing
  dumpster: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.2H.5M-.1 -.5V-.2M.1 -.5V-.2")}${box(-0.46, 0.25, 0.92, 0.16, "d")}`,
  tires: `${CIRC(0.24, -0.2, -0.18)}${CIRC(0.24, 0.22, -0.1)}${CIRC(0.24, 0, 0.22)}${CIRC(0.1, -0.2, -0.18, "d")}${CIRC(0.1, 0.22, -0.1, "d")}${CIRC(0.1, 0, 0.22, "d")}`,
  tireWall: `${CIRC(0.17, -0.33, 0)}${CIRC(0.17, 0, 0)}${CIRC(0.17, 0.33, 0)}${CIRC(0.07, -0.33, 0, "d")}${CIRC(0.07, 0, 0, "d")}${CIRC(0.07, 0.33, 0, "d")}`,
  roundTable: `${CIRC(0.34)}${CIRC(0.1, 0, 0, "d")}${CIRC(0.09, 0, -0.43, "pale")}${CIRC(0.09, 0, 0.43, "pale")}${CIRC(0.09, -0.43, 0, "pale")}${CIRC(0.09, 0.43, 0, "pale")}`,
  post: `${CIRC(0.34)}${CIRC(0.14, 0, 0, "pale")}`,
  hydrant: `${CIRC(0.32)}${box(-0.48, -0.1, 0.96, 0.2)}${CIRC(0.12, 0, 0, "d")}`,
  statue: `${box(-0.5, -0.5, 1, 1)}${CIRC(0.3, 0, 0, "pale")}${CIRC(0.13, 0, -0.04, "d")}`,
  tower: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.5L.5 .5M.5 -.5L-.5 .5")}${box(-0.2, -0.2, 0.4, 0.4, "pale")}`,
  container: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.25H.42M-.5 0H.42M-.5 .25H.42M.42 -.5V.5")}`,
  hesco: `${box(-0.5, -0.5, 1, 1)}${dline("M-.25 -.5V.5M0 -.5V.5M.25 -.5V.5M-.5 0H.5")}`,
  wire: `${box(-0.5, -0.12, 1, 0.24, "pale")}${dline("M-.5 0L-.4 -.4L-.3 .4L-.2 -.4L-.1 .4L0 -.4L.1 .4L.2 -.4L.3 .4L.4 -.4L.5 0")}`,
  pillar: `${box(-0.5, -0.5, 1, 1)}${box(-0.3, -0.3, 0.6, 0.6, "d")}`,
  jersey: `${box(-0.5, -0.5, 1, 1)}${box(-0.32, -0.5, 0.12, 1, "pale")}${box(0.2, -0.5, 0.12, 1, "pale")}${dline("M-.5 0H.5")}`,
  mailbox: `<rect x="-.5" y="-.5" width="1" height="1" rx=".5" ry=".3"/>${box(0.12, -0.44, 0.1, 0.4, "pale")}`,
  fence: `${box(-0.5, -0.14, 1, 0.28, "pale")}${box(-0.5, -0.5, 0.1, 1)}${box(-0.05, -0.5, 0.1, 1)}${box(0.4, -0.5, 0.1, 1)}`,
  crops: (() => {
    let p = "";
    for (const y of [-0.3, 0, 0.3]) for (let x = -0.42; x <= 0.43; x += 0.12) p += CIRC(0.06, E.fix(x), y);
    return p;
  })(),
  hay: `${CIRC(0.46)}${dline("M0 0a.1 .1 0 0 1 .1 .1a.2 .2 0 0 1 -.2 .2a.3 .3 0 0 1 -.3 -.3a.36 .36 0 0 1 .36 -.36")}`,
  tank: `${CIRC(0.48)}${CIRC(0.34, 0, 0, "d")}${dline("M-.48 0H.48M0 -.48V.48")}`,
  pump: `${box(-0.5, -0.5, 1, 1)}${box(-0.3, -0.36, 0.6, 0.3, "pale")}${CIRC(0.08, 0.28, 0.28, "dot")}`,
  slot: `${box(-0.5, -0.5, 1, 1)}${box(-0.36, -0.3, 0.72, 0.3, "pale")}${dline("M-.12 -.3V0M.12 -.3V0")}`,
  jukebox: `<path d="M-.5 .5V-.1A.5 .5 0 0 1 .5 -.1V.5Z"/>${dline("M-.3 .5V-.05A.3 .3 0 0 1 .3 -.05V.5")}`,
  piano: `${box(-0.5, -0.5, 1, 1)}${box(-0.5, 0.24, 1, 0.26, "pale")}${dline("M-.3 .24V.5M-.1 .24V.5M.1 .24V.5M.3 .24V.5")}`,
  planks: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.25H.5M-.5 0H.5M-.5 .25H.5")}`,
  bunk: `${box(-0.5, -0.5, 1, 1)}${box(-0.46, -0.42, 0.22, 0.36, "pale")}${box(-0.46, 0.06, 0.22, 0.36, "pale")}${dline("M-.5 0H.5")}`,
  cart: `${box(-0.4, -0.5, 0.8, 1)}${box(-0.28, -0.36, 0.56, 0.72, "d")}${box(-0.5, -0.42, 0.1, 0.24, "dot")}${box(0.4, -0.42, 0.1, 0.24, "dot")}${box(-0.5, 0.18, 0.1, 0.24, "dot")}${box(0.4, 0.18, 0.1, 0.24, "dot")}`,
  rails: (() => {
    let p = "";
    for (let x = -0.45; x <= 0.46; x += 0.1) p += box(E.fix(x - 0.025), -0.45, 0.05, 0.9, "pale");
    return p + dline("M-.5 -.25H.5M-.5 .25H.5");
  })(),
  crater: `${CIRC(0.48, 0, 0, "d")}${CIRC(0.32, 0, 0, "d")}${CIRC(0.15)}`,
  stalagmite: `${CIRC(0.46)}${CIRC(0.28, 0, 0, "d")}${CIRC(0.1, 0, 0, "pale")}`,
  beam: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.5L.5 .5M.5 -.5L-.5 .5")}`,
  engine: `${box(-0.5, -0.5, 1, 1)}${CIRC(0.12, -0.25, -0.15, "d")}${CIRC(0.12, 0, -0.15, "d")}${CIRC(0.12, 0.25, -0.15, "d")}${dline("M-.5 .2H.5")}`,
  column: `${CIRC(0.46)}${dline("M-.3 -.2L0 .1L.25 -.15M0 .1V.4")}`,
  booth: `${box(-0.5, -0.5, 1, 1)}${box(-0.36, -0.36, 0.72, 0.72, "pale")}${box(-0.12, -0.12, 0.24, 0.24, "dot")}`,
  vending: `${box(-0.5, -0.5, 1, 1)}${box(-0.4, -0.4, 0.5, 0.8, "pale")}${box(0.2, -0.3, 0.2, 0.12, "dot")}`,
  tractor: `${box(-0.3, -0.35, 0.65, 0.7)}${box(-0.5, -0.5, 0.26, 0.3, "dot")}${box(-0.5, 0.2, 0.26, 0.3, "dot")}${box(0.3, -0.46, 0.2, 0.2, "dot")}${box(0.3, 0.26, 0.2, 0.2, "dot")}`,
  scarecrow: `${box(-0.5, -0.08, 1, 0.16)}${box(-0.08, -0.5, 0.16, 1)}${CIRC(0.16, 0, -0.32, "pale")}`,
  flag: `${CIRC(0.3)}${box(0, -0.5, 0.5, 0.3, "pale")}`,
  tent: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 0H.5M-.5 -.5L0 0L-.5 .5M.5 -.5L0 0L.5 .5")}`,
  ammoBox: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 0H.5")}${box(-0.08, -0.5, 0.16, 0.14, "dot")}${box(-0.08, 0.36, 0.16, 0.14, "dot")}`,
  radio: `${box(-0.5, -0.5, 1, 1)}${box(-0.36, -0.36, 0.36, 0.42, "pale")}${CIRC(0.08, 0.24, -0.15, "dot")}`,
  lockers: `${box(-0.5, -0.5, 1, 1)}${dline("M-.25 -.5V.5M0 -.5V.5M.25 -.5V.5")}${CIRC(0.03, -0.37, 0.2, "dot")}${CIRC(0.03, -0.12, 0.2, "dot")}${CIRC(0.03, 0.12, 0.2, "dot")}${CIRC(0.03, 0.37, 0.2, "dot")}`,
  drawers: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.17H.5M-.5 .17H.5")}${box(-0.1, -0.36, 0.2, 0.06, "dot")}${box(-0.1, -0.03, 0.2, 0.06, "dot")}${box(-0.1, 0.3, 0.2, 0.06, "dot")}`,
  copier: `${box(-0.5, -0.5, 1, 1)}${box(-0.4, -0.4, 0.8, 0.45, "pale")}${box(-0.4, 0.15, 0.5, 0.2, "d")}`,
  safe: `${box(-0.5, -0.5, 1, 1)}${CIRC(0.22, 0, 0, "d")}${dline("M0 -.22V.22M-.22 0H.22")}`,
  generator: `${box(-0.5, -0.5, 1, 1)}${dline("M-.4 -.3H.4M-.4 -.1H.4M-.4 .1H.4")}${box(0.15, 0.22, 0.25, 0.18, "pale")}`,
  press: `${box(-0.5, -0.5, 1, 1)}${box(-0.3, -0.3, 0.6, 0.6, "d")}${box(-0.15, -0.15, 0.3, 0.3, "pale")}`,
  toolCart: `${box(-0.5, -0.5, 1, 1)}${box(-0.42, -0.38, 0.36, 0.32, "pale")}${box(0.06, -0.38, 0.36, 0.32, "pale")}${CIRC(0.06, -0.42, 0.4, "dot")}${CIRC(0.06, 0.42, 0.4, "dot")}`,
  books: `${box(-0.5, -0.5, 1, 1)}${dline("M-.4 -.5V.5M-.32 -.5V.5M-.2 -.5V.5M-.05 -.5V.5M.05 -.5V.5M.2 -.5V.5M.3 -.5V.5M.42 -.5V.5")}`,
  campfire: `${CIRC(0.46, 0, 0, "d")}${dline("M-.35 -.35L.35 .35M.35 -.35L-.35 .35")}<path class="flame" d="M0 -.3C.2 -.1 .2 .1 0 .26C-.2 .1 -.2 -.1 0 -.3Z"/>`,
  burnBarrel: `${CIRC(0.46)}${CIRC(0.3, 0, 0, "d")}<path class="flame" d="M0 -.22C.15 -.05 .15 .1 0 .2C-.15 .1 -.15 -.05 0 -.22Z"/>`,
  truck: `<rect x="-.5" y="-.46" width=".72" height=".92" rx=".04" ry=".1"/><rect x=".24" y="-.4" width=".26" height=".8" rx=".06" ry=".1"/>${box(0.3, -0.32, 0.08, 0.64, "pale")}${dline("M-.5 0H.2")}`,
  moto: `<ellipse rx=".5" ry=".22"/>${CIRC(0.1, -0.36, 0, "dot")}${CIRC(0.1, 0.36, 0, "dot")}${dline("M.2 -.4V.4")}`,
  tankTrap: `<path d="M-.5 -.35L-.35 -.5L0 -.15L.35 -.5L.5 -.35L.15 0L.5 .35L.35 .5L0 .15L-.35 .5L-.5 .35L-.15 0Z"/>`,
  pipe: `${box(-0.5, -0.5, 1, 1)}<ellipse class="d" cx="-.42" rx=".06" ry=".4"/><ellipse class="d" cx=".42" rx=".06" ry=".4"/>`,
  spool: `${CIRC(0.48)}${CIRC(0.3, 0, 0, "d")}${CIRC(0.1, 0, 0, "pale")}`,
  hedge: `<path d="${lobes(0.24, 6, -0.25, 0)}"/><path d="${lobes(0.24, 6, 0.25, 0)}"/>`,
  mattress: `<rect x="-.5" y="-.5" width="1" height="1" rx=".12" ry=".2"/>${CIRC(0.04, -0.25, -0.2, "dot")}${CIRC(0.04, 0.25, -0.2, "dot")}${CIRC(0.04, -0.25, 0.2, "dot")}${CIRC(0.04, 0.25, 0.2, "dot")}${CIRC(0.04, 0, 0, "dot")}`,
  wheelchair: `${box(-0.3, -0.35, 0.6, 0.7)}${box(-0.5, -0.4, 0.14, 0.8, "dot")}${box(0.36, -0.4, 0.14, 0.8, "dot")}`,
  subwayCar: `<rect x="-.5" y="-.46" width="1" height=".92" rx=".03" ry=".15"/>${dline("M-.5 -.2H.5M-.5 .2H.5")}${box(-0.3, -0.46, 0.1, 0.12, "pale")}${box(0.2, -0.46, 0.1, 0.12, "pale")}${box(-0.3, 0.34, 0.1, 0.12, "pale")}${box(0.2, 0.34, 0.1, 0.12, "pale")}`,
  turnstile: `${box(-0.5, -0.2, 1, 0.4)}${CIRC(0.14, 0, 0, "pale")}${dline("M-.3 -.5V.5M.3 -.5V.5")}`,
  spikes: `${box(-0.5, -0.12, 1, 0.24)}${dline("M-.45 -.45L-.25 .45M-.15 -.45L.05 .45M.15 -.45L.35 .45M-.25 -.45L-.45 .45M.05 -.45L-.15 .45M.35 -.45L.15 .45")}`,
  spotlight: `${CIRC(0.3)}<path class="pale" d="M.2 -.15L.5 -.5V.5L.2 .15Z"/>`,
  medCabinet: `${box(-0.5, -0.5, 1, 1)}${box(-0.1, -0.4, 0.2, 0.8, "pale")}${box(-0.3, -0.1, 0.6, 0.2, "pale")}`,
  altar: `${box(-0.5, -0.5, 1, 1)}${box(-0.3, -0.3, 0.6, 0.6, "pale")}${dline("M0 -.25V.25M-.15 -.08H.15")}`,
  pulpit: `<path d="M-.5 -.5H.5V.2L0 .5L-.5 .2Z"/>`,
  metalCrate: `${box(-0.5, -0.5, 1, 1)}${box(-0.38, -0.38, 0.76, 0.76, "d")}${CIRC(0.05, -0.42, -0.42, "dot")}${CIRC(0.05, 0.42, -0.42, "dot")}${CIRC(0.05, -0.42, 0.42, "dot")}${CIRC(0.05, 0.42, 0.42, "dot")}`,
  scrapWall: `${box(-0.5, -0.5, 1, 1)}${dline("M-.3 -.5L-.25 .5M.05 -.5L-.05 .5M.3 -.5L.35 .5")}${CIRC(0.04, -0.4, 0, "dot")}${CIRC(0.04, 0.18, 0, "dot")}`,
  pew: `${box(-0.5, -0.5, 1, 1)}${box(-0.5, -0.5, 1, 0.28, "d")}`,
  hz: `<path d="M0 -.5L.5 .5H-.5Z"/>${dline("M0 -.15V.2")}${CIRC(0.04, 0, 0.33, "dot")}`,
  door: `${box(-0.5, -0.5, 1, 1)}${dline("M-.25 -.5V.5M.25 -.5V.5")}`,
  radBarrel: `${CIRC(0.46)}${CIRC(0.09, 0, 0, "dot")}<path class="d" d="M0 -.12L-.12 -.38A.4 .4 0 0 1 .12 -.38ZM.1 .06L.38 .1A.4 .4 0 0 1 .26 .32ZM-.1 .06L-.26 .32A.4 .4 0 0 1 -.38 .1Z"/>`,
  radLake: `<ellipse rx=".5" ry=".5"/>${dline("M-.3 -.1Q-.15 -.2 0 -.1T.3 -.1M-.22 .14Q-.08 .04 .06 .14T.3 .14")}`,
  pin: `<path d="M0 .5L-.32 -.05A.36 .36 0 1 1 .32 -.05Z"/>${CIRC(0.13, 0, -0.2, "pale")}`,
};
// 13 Nov: the commonest things drawn again with more detail: planks, drawers, stock on shelves, windscreens and wheels, rims, facets.
Object.assign(GLYPH, {
  crate: `${box(-0.5, -0.5, 1, 1)}${box(-0.4, -0.4, 0.8, 0.8, "d")}${dline("M-.4 -.4L.4 .4M-.4 -.13H.4M-.4 .13H.4")}`,
  crateStack: `${box(-0.5, -0.5, 0.49, 0.49)}${box(0.01, -0.5, 0.49, 0.49)}${box(-0.5, 0.01, 0.49, 0.49)}${box(0.01, 0.01, 0.49, 0.49)}${dline("M-.45 -.45L-.06 -.06M.06 -.45L.45 -.06M-.45 .06L-.06 .45M.06 .06L.45 .45")}`,
  car: `<rect x="-.5" y="-.44" width="1" height=".88" rx=".16" ry=".26"/><path class="pale" d="M.1 -.33L.3 -.38V.38L.1 .33Z"/><path class="pale" d="M-.32 -.31L-.2 -.33V.33L-.32 .31Z"/>${box(-0.18, -0.32, 0.27, 0.64, "d")}${CIRC(0.035, 0.45, -0.3, "dot")}${CIRC(0.035, 0.45, 0.3, "dot")}${dline("M-.3 -.44V-.4M.3 -.44V-.4M-.3 .44V.4M.3 .44V.4")}`,
  shelves: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 0H.5M-.5 -.5V.5M.5 -.5V.5")}${box(-0.44, -0.38, 0.12, 0.28, "pale")}${box(-0.26, -0.38, 0.18, 0.28, "pale")}${box(0.04, -0.38, 0.1, 0.28, "pale")}${box(0.24, -0.38, 0.18, 0.28, "pale")}${box(-0.4, 0.1, 0.2, 0.28, "pale")}${box(-0.12, 0.1, 0.14, 0.28, "pale")}${box(0.14, 0.1, 0.24, 0.28, "pale")}`,
  desk: `${box(-0.5, -0.5, 1, 1)}${box(-0.44, -0.4, 0.26, 0.8, "d")}${dline("M-.44 -.13H-.18M-.44 .13H-.18")}${box(0.05, -0.34, 0.28, 0.22, "pale")}${box(0.1, 0.08, 0.2, 0.26, "d")}`,
  barrel: `${CIRC(0.46)}${CIRC(0.36, 0, 0, "d")}${CIRC(0.07, 0.16, -0.16, "dot")}`,
  barrels: `${CIRC(0.24, -0.25, 0)}${CIRC(0.24, 0.25, 0)}${CIRC(0.17, -0.25, 0, "d")}${CIRC(0.17, 0.25, 0, "d")}${CIRC(0.04, -0.18, -0.08, "dot")}${CIRC(0.04, 0.32, -0.08, "dot")}`,
  rock: `<path d="M-.46 -.1L-.22 -.46L.26 -.42L.48 -.04L.3 .42L-.24 .46Z"/><path class="pale" d="M-.22 -.38L.2 -.36L.06 -.12L-.16 -.16Z" style="opacity:.35"/>${dline("M-.16 -.16L.06 -.12L.28 -.04M.06 -.12L-.02 .3M-.16 -.16L-.34 .1")}`,
  sandbags: `<rect x="-.5" y="-.46" width=".33" height=".92" rx=".16"/><rect x="-.17" y="-.46" width=".33" height=".92" rx=".16"/><rect x=".16" y="-.46" width=".33" height=".92" rx=".16"/>${dline("M-.34 -.3V.3M0 -.3V.3M.33 -.3V.3")}`,
  building: `${box(-0.5, -0.5, 1, 1)}${dline("M-.5 -.5L-.2 0L-.5 .5M.5 -.5L.2 0L.5 .5M-.2 0H.2")}`,
  bed: `${box(-0.5, -0.5, 1, 1)}${box(-0.46, -0.4, 0.22, 0.8, "pale")}${box(-0.2, -0.46, 0.68, 0.92, "d")}${dline("M-.06 -.46V.46")}`,
  couch: `${box(-0.5, -0.5, 1, 1)}${box(-0.5, -0.5, 1, 0.3, "d")}${box(-0.5, -0.5, 0.12, 1, "d")}${box(0.38, -0.5, 0.12, 1, "d")}${dline("M0 -.2V.5")}`,
  bush: `<path d="${lobes(0.3, 6, -0.12, -0.08)}"/><path d="${lobes(0.26, 6, 0.16, 0.12)}"/>${CIRC(0.04, -0.14, -0.1, "dot")}${CIRC(0.04, 0.14, 0.14, "dot")}${CIRC(0.035, 0.02, -0.02, "dot")}`,
  tree: `<path d="${lobes(0.42, 9)}"/>${dline(lobes(0.26, 7))}${dline(lobes(0.12, 5))}`,
  kitchenTable: `${box(-0.34, -0.3, 0.68, 0.6)}${box(-0.26, -0.48, 0.16, 0.14)}${box(0.1, -0.48, 0.16, 0.14)}${box(-0.26, 0.34, 0.16, 0.14)}${box(0.1, 0.34, 0.16, 0.14)}${CIRC(0.07, -0.16, 0, "pale")}${CIRC(0.07, 0.16, 0, "pale")}`,
  dumpster: `${box(-0.5, -0.5, 1, 1)}${box(-0.46, -0.46, 0.45, 0.62, "d")}${box(0.01, -0.46, 0.45, 0.62, "d")}${box(-0.46, 0.25, 0.92, 0.16, "d")}`,
  door: `${box(-0.5, -0.5, 1, 1)}${dline("M-.38 -.5V.5M.38 -.5V.5")}${CIRC(0.05, 0.25, 0, "dot")}`,
});
const ITEM_GLYPH = {
  chest: "chest",
  desk: "desk",
  officeChair: "chair",
  cabinet: "drawers",
  bookshelf: "books",
  copier: "copier",
  cooler: "barrel",
  pottedPlant: "bush",
  partition: "plainWall",
  couch: "couch",
  officeSafe: "safe",
  conveyor: "conveyor",
  pressMachine: "press",
  boiler: "tank",
  workbench: "table",
  oilDrum: "barrel",
  pipeRack: "bars",
  generator: "generator",
  toolCart: "toolCart",
  shelves: "shelves",
  crate: "crate",
  crateStack: "crateStack",
  floorWood: "plainWall",
  floorConcrete: "plainWall",
  floorTile: "plainWall",
  pallet: "pallet",
  forklift: "forklift",
  barrels: "barrels",
  cellBars: "bars",
  lockers: "lockers",
  sandbags: "sandbags",
  bench: "table",
  frontCounter: "table",
  armoryCage: "bars",
  bedroll: "bedroll",
  cot: "bed",
  footlocker: "crate",
  campfire: "campfire",
  tarpWall: "sheet",
  tentPole: "post",
  smallRock: "rock",
  rock: "rock",
  boulder: "rock",
  dune: "dune",
  cactus: "cactus",
  deadTree: "tree",
  wreck: "car",
  ruinWall: "stoneWall",
  bush: "bush",
  tree: "tree",
  bigTree: "tree",
  log: "log",
  thicket: "bush",
  stump: "stump",
  car: "car",
  bus: "bus",
  dumpster: "dumpster",
  mailbox: "mailbox",
  hydrant: "hydrant",
  lamppost: "post",
  barricade: "jersey",
  rubble: "rubble",
  building: "building",
  concreteWall: "plainWall",
  lDesk: "lDesk",
  kitchenTable: "kitchenTable",
  bed: "bed",
  toilet: "toilet",
  bathtub: "bathtub",
  sink: "sink",
  stove: "stove",
  fridge: "fridge",
  dresser: "drawers",
  stoneWall: "stoneWall",
  pillar: "pillar",
  void: "building",
  tirePile: "tires",
  scrapHeap: "rubble",
  shippingContainer: "container",
  carStack: "car",
  engineBlock: "engine",
  guardTower: "tower",
  hesco: "hesco",
  ammoCrate: "ammoBox",
  razorWire: "wire",
  fieldTent: "tent",
  flagpole: "flag",
  radioTable: "radio",
  concreteBlock: "jersey",
  metalSheet: "sheet",
  barCounter: "table",
  barStool: "post",
  pokerTable: "roundTable",
  slotMachine: "slot",
  jukebox: "jukebox",
  stage: "planks",
  piano: "piano",
  vaultConsole: "machine",
  bunkBed: "bunk",
  reactorCore: "tank",
  waterPurifier: "machine",
  hayBale: "hay",
  fence: "fence",
  waterTrough: "bathtub",
  tractor: "tractor",
  scarecrow: "scarecrow",
  cropRow: "crops",
  silo: "tank",
  gasPump: "pump",
  vendingMachine: "vending",
  billboard: "plainWall",
  phoneBooth: "booth",
  tollBooth: "booth",
  brokenColumn: "column",
  collapsedWall: "stoneWall",
  statue: "statue",
  crater: "crater",
  stalagmite: "stalagmite",
  mineCart: "cart",
  supportBeam: "beam",
  oreVein: "rock",
  railTrack: "rails",
  truck: "truck",
  motorcycle: "moto",
  tankTrap: "tankTrap",
  concretePipe: "pipe",
  cableSpool: "spool",
  fuelTank: "tank",
  metalCrate: "metalCrate",
  trashPile: "rubble",
  hedge: "hedge",
  spikeBarricade: "spikes",
  burnBarrel: "burnBarrel",
  mattress: "mattress",
  cage: "bars",
  scrapWall: "scrapWall",
  tireWall: "tireWall",
  hospitalBed: "bed",
  gurney: "bed",
  curtain: "sheet",
  medCabinet: "medCabinet",
  wheelchair: "wheelchair",
  operatingTable: "table",
  subwayCar: "subwayCar",
  turnstile: "turnstile",
  ticketBooth: "booth",
  boothSeat: "couch",
  dinerCounter: "table",
  nukaMachine: "vending",
  guardBooth: "booth",
  spotlight: "spotlight",
  pew: "pew",
  altar: "altar",
  pulpit: "pulpit",
  woodDoor: "door",
  ironDoor: "door",
  steelDoor: "door",
  radBarrel: "radBarrel",
  radLake: "radLake",
  lake: "radLake",
  pond: "radLake",
  shallowWater: "radLake",
  shopShelf: "shelves",
  cashRegister: "machine",
  examTable: "table",
};
// 12 Nov: each hazard and trap kind has its own icon (VICON h_<kind>), drawn on a plate
const hzGlyph = (sub) =>
  VICON["h_" + sub]
    ? `<rect x="-.5" y="-.5" width="1" height="1" rx=".16"/><g class="hzi" transform="translate(-.42 -.42) scale(.035)">${VICON["h_" + sub]}</g>`
    : null;
const KIND_GLYPH = { cover: "crate", hard: "plainWall", wall: "plainWall", tree: "tree", hazard: "hz", note: "pin" };
const MAT_OF = {};
for (const [m, list] of Object.entries({
  wood: "floorWood woodDoor desk lDesk kitchenTable workbench bench frontCounter barCounter radioTable pokerTable dresser bookshelf pallet crate footlocker chest ammoCrate log stump piano stage pew altar pulpit dinerCounter fence scarecrow waterTrough deadTree crateStack spikeBarricade cableSpool tentPole operatingTable",
  metal:
    "steelDoor shopShelf cashRegister examTable cabinet lockers officeSafe shelves cellBars armoryCage dumpster shippingContainer metalSheet engineBlock mineCart gasPump vendingMachine slotMachine jukebox phoneBooth lamppost hydrant fridge stove oilDrum barrels boiler pipeRack generator pressMachine conveyor forklift toolCart copier cooler vaultConsole reactorCore waterPurifier silo tractor cage metalCrate scrapWall fuelTank medCabinet turnstile spotlight burnBarrel nukaMachine wheelchair tankTrap razorWire railTrack billboard mailbox flagpole officeChair supportBeam subwayCar barStool",
  rust: "ironDoor wreck car bus truck motorcycle scrapHeap carStack tirePile tireWall trashPile",
  stone:
    "floorConcrete rock smallRock boulder stoneWall ruinWall rubble building concreteWall pillar barricade concreteBlock brokenColumn collapsedWall statue stalagmite oreVein crater concretePipe guardTower tollBooth guardBooth ticketBooth void",
  plant: "bush tree bigTree thicket pottedPlant cactus cropRow hedge hayBale",
  fabric: "bed cot bedroll couch bunkBed tarpWall fieldTent mattress curtain hospitalBed gurney boothSeat partition",
  sand: "dune sandbags hesco",
  tile: "floorTile toilet bathtub sink",
  fire: "campfire",
  rad: "radBarrel",
  radpool: "radLake",
  water: "lake pond",
  shallow: "shallowWater",
}))
  for (const k of list.split(" ")) MAT_OF[k] = m;
// 13 Nov: terrain. The ground under the map, a pattern in real meters, picked by rules.terrain; floors inside buildings use the same patterns.
const TERRAIN_DOTS = {
  grass: [
    [
      "#1c3d20",
      [
        [1.1, 1.2, 0.35],
        [2.4, 0.6, 0.25],
        [0.4, 2.6, 0.3],
      ],
    ],
  ],
  sand: [
    [
      "#57492b",
      [
        [0.6, 1.4, 0.05],
        [2.1, 1.5, 0.04],
        [1.3, 2.7, 0.05],
        [2.7, 0.3, 0.04],
      ],
    ],
  ],
  dirt: [
    [
      "#372b1d",
      [
        [0.5, 0.6, 0.18],
        [1.9, 0.4, 0.12],
        [1.2, 1.6, 0.22],
        [2.5, 2.1, 0.15],
        [0.4, 2.5, 0.1],
      ],
    ],
    [
      "#4a3b28",
      [
        [1.6, 1.0, 0.05],
        [0.9, 2.2, 0.04],
        [2.6, 0.9, 0.05],
      ],
    ],
  ],
  asphalt: [
    [
      "#24272a",
      [
        [0.4, 0.5, 0.05],
        [1.7, 0.9, 0.04],
        [1.1, 2, 0.05],
        [2.6, 2.5, 0.04],
        [2.2, 1.4, 0.03],
      ],
    ],
  ],
  concrete: [
    [
      "#2e3234",
      [
        [0.5, 0.6, 0.04],
        [1.4, 1.3, 0.05],
        [0.8, 1.6, 0.03],
      ],
    ],
  ],
  metal: [
    [
      "#3a444d",
      [
        [0.1, 0.1, 0.03],
        [1.1, 0.1, 0.03],
        [0.1, 1.1, 0.03],
        [1.1, 1.1, 0.03],
      ],
    ],
  ],
  rock: [
    [
      "#332b26",
      [
        [0.6, 1.9, 0.2],
        [2.3, 2.4, 0.16],
      ],
    ],
  ],
};
// [ground color, lines drawn on it, tile size in meters]
const TERRAIN = {
  grass: [
    "#132c17",
    '<path d="M.3 .9l.1-.3.1.3M1.5 .4l.1-.3.1.3M2.2 1.7l.1-.3.1.3M.9 2.1l.1-.3.1.3M2.6 2.6l.1-.3.1.3" stroke="#2a5a2c" stroke-width=".07" fill="none"/>',
    3,
  ],
  sand: ["#4a3f24", '<path d="M0 .8q.75-.3 1.5 0t1.5 0M0 2.2q.75-.3 1.5 0t1.5 0" stroke="#5c4f2f" stroke-width=".06" fill="none"/>', 3],
  dirt: ["#2b2217", "", 3],
  asphalt: ["#1a1c1e", '<path d="M.2 2.8l.5-.2.3.1" stroke="#111314" stroke-width=".05" fill="none"/>', 3],
  concrete: ["#25282a", '<path d="M0 0H2V2" stroke="#1b1d1f" stroke-width=".06" fill="none"/>', 2],
  wood: [
    "#36261a",
    '<path d="M0 .3H3M0 .6H3M0 .9H3M0 1.2H3M0 1.5H3M0 1.8H3M0 2.1H3M0 2.4H3M0 2.7H3M0 3H3" stroke="#271b11" stroke-width=".035"/>' +
      '<path d="M1 0V.3M2.2 .3V.6M.5 .6V.9M1.7 .9V1.2M2.6 1.2V1.5M.9 1.5V1.8M2 1.8V2.1M.3 2.1V2.4M1.4 2.4V2.7M2.4 2.7V3" stroke="#271b11" stroke-width=".035"/>',
    3,
  ],
  tile: ["#2b3533", '<path d="M0 0H.6V.6" stroke="#212927" stroke-width=".035" fill="none"/>', 0.6],
  metal: ["#252c33", '<path d="M0 0H1.2V1.2" stroke="#1a2026" stroke-width=".05" fill="none"/>', 1.2],
  rock: ["#28221e", '<path d="M0 .7l.8.3.5-.4.9.5.8-.2M1 3l.4-1 .9-.3" stroke="#1d1815" stroke-width=".05" fill="none"/>', 3],
};
const TERRAIN_DEFS = Object.entries(TERRAIN)
  .map(([k, [base, art, size]]) => {
    const dots = (TERRAIN_DOTS[k] || [])
      .map(([c, l]) => l.map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"/>').join(""))
      .join("");
    return (
      '<pattern id="ter-' +
      k +
      '" patternUnits="userSpaceOnUse" width="' +
      size +
      '" height="' +
      size +
      '"><rect width="' +
      size +
      '" height="' +
      size +
      '" fill="' +
      base +
      '"/>' +
      art +
      dots +
      "</pattern>"
    );
  })
  .join("");
// 12 Nov (map art): shared SVG defs for the map and the map creator. Each material is lit from the top left (a gradient from lighter to
// darker of its color), plants and water are shaded from the middle out, and solid things cast a soft shadow. Hazards are a tinted zone in
// their own color with a round badge carrying their icon; a trap is just the badge.
const MAT_COL = {
  none: "#2c7a44",
  wood: "#7a5a32",
  metal: "#5f6f78",
  rust: "#7a4630",
  stone: "#7d7f76",
  plant: "#2f6b2c",
  fabric: "#5c4f72",
  sand: "#9a8550",
  tile: "#9fb0ad",
  fire: "#5a2a10",
  rad: "#4a5c10",
};
const HZ_COL = {
  fire: "#ff7a1a",
  rads: "#d8ff3a",
  gas: "#9be05a",
  acid: "#7dff2a",
  wires: "#ffe14a",
  mines: "#ff5a3a",
  spikes: "#d0d0d0",
  water: "#3f8fe8",
  shallow: "#8ccaff",
  trap: "#ffb43f",
};
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};
const MAP_DEFS = (() => {
  const lin = Object.entries(MAT_COL)
    .filter(([m]) => m !== "plant")
    .map(
      ([m, c]) =>
        `<linearGradient id="gm-${m}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c, 0.5)}"/><stop offset=".45" stop-color="${shade(c, 0.08)}"/><stop offset="1" stop-color="${shade(c, -0.5)}"/></linearGradient>`,
    )
    .join("");
  const rad = (id, stops) =>
    `<radialGradient id="${id}" cx=".42" cy=".4" r=".62">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`;
  const hz = Object.entries(HZ_COL)
    .map(([k, c]) =>
      k === "water"
        ? rad("hz-water", [
            [0, "#0d2f5c", 0.95],
            [1, "#2a6db0", 0.9],
          ])
        : rad("hz-" + k, [
            [0, c, 0.5],
            [0.7, c, 0.26],
            [1, c, 0.1],
          ]),
    )
    .join("");
  return `${lin}${rad("gm-plant", [
    [0, "#4f9a3e", 1],
    [1, "#1f4a1a", 1],
  ])}${rad("gm-water", [
    [0, "#0d2f5c", 1],
    [1, "#2f74b8", 1],
  ])}${rad("gm-shallow", [
    [0, "#5aa0dc", 0.6],
    [1, "#8ccaff", 0.28],
  ])}${rad("gm-radpool", [
    [0, "#c8f03a", 0.55],
    [1, "#4a5c10", 0.35],
  ])}${rad("gm-canopy", [
    [0, "#5aa848", 1],
    [1, "#1d4a18", 1],
  ])}${hz}${TERRAIN_DEFS}<filter id="osh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx=".16" dy=".22" stdDeviation=".12" flood-color="#000" flood-opacity=".8"/></filter>`;
})();
// 13 Nov: liquids (lakes, ponds, shallows, the rad lake; deep water, shallow water and acid placed as hazards) have a natural outline
// of their own (o.blob, made by E.blobShape): a smooth curve through it, in the object's 1 by 1 box.
const LIQUID_SUBS = ["water", "shallow", "acid"];
const isLiquid = (o) => {
  const c = S.rules.mapItems[o.item];
  return !!((c && (c.water || o.item === "radLake")) || (o.kind === "hazard" && LIQUID_SUBS.includes(o.sub)));
};
function blobPath(blob) {
  const n = blob.length,
    f = E.fix;
  const P = blob.map((r, i) => {
    const t = (i / n) * 2 * Math.PI;
    return [Math.cos(t) * r * 0.5, Math.sin(t) * r * 0.5];
  });
  let d = `M${f(P[0][0])} ${f(P[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n],
      p1 = P[i],
      p2 = P[(i + 1) % n],
      p3 = P[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}
// the water itself, with a few ripples inside the outline
const blobGlyph = (o) => `<path d="${blobPath(o.blob)}"/>${dline("M-.24 -.06Q-.12 -.13 0 -.06T.24 -.06M-.14 .1Q-.03 .03 .08 .1T.24 .1")}`;
/** The ground for the map in use: indoors by setting; outdoors by setting, then map, then environment. */
function terrainOf() {
  const T = S.rules.terrain || {};
  const M = mapOf(),
    th = S.scene.theme;
  const indoor = (S.rules.indoorMaps || []).includes(M.id) || (M.id === "custom" && M.w * M.h <= 1600);
  if (indoor) return (T.indoor || {})[th] || T.indoorDefault || "concrete";
  const fromMap = (T.map || {})[M.id];
  if (th === "desert" && fromMap === "grass") return "grass"; // a desert setting in a forest is still a forest floor
  const env = String(S.scene.env || "");
  return (
    (T.theme || {})[th] ||
    fromMap ||
    (/desert|dune|waste|sand|canyon|mesa/i.test(env)
      ? "sand"
      : /forest|grass|swamp|plain|meadow|wood/i.test(env)
        ? "grass"
        : /urban|city|street|town/i.test(env)
          ? "asphalt"
          : /cave|mine|tunnel/i.test(env)
            ? "rock"
            : "dirt")
  );
}
// A hazard: its zone tinted in its color, and a badge with its icon in the middle (a small one, like a trap, is just the badge).
function hazardArt(o, w, ht, turn, draw, icon) {
  const key = HZ_COL[o.sub] ? o.sub : "trap";
  const col = HZ_COL[key];
  const small = Math.min(w, ht) <= 1.2;
  const zone = small
    ? ""
    : `<g class="gly hzz" transform="${draw}">${o.blob ? `<path d="${blobPath(o.blob)}"` : `<rect x="-.5" y="-.5" width="1" height="1" rx=".28"`} style="fill:url(#hz-${key});stroke:${col}"/></g>`;
  const s = E.fix(Math.min(w, ht, 1.6) * (small ? 0.95 : 0.62));
  return `${zone}<g class="hzbadge" transform="${turn}scale(${s})" style="color:${col}"><circle r=".5"/><g class="hzi" transform="translate(-.33 -.33) scale(.0275)">${icon}</g></g>`;
}
const MAP_OBJ = {
  cover: ["Cover", 1],
  hard: ["Hard cover", 1],
  hazard: ["Hazard", 1],
  trap: ["Trap", 1],
  note: ["Marker", 1],
  wall: ["Wall", 0],
  tree: ["Tree", 0],
};
// The aiming line is colored by the selected weapon's accuracy at each range band. Red is its worst band, green its best.
function aimLine(a, b) {
  const p = atkView();
  const d = dist(a, b) || 0.01;
  const m = S.rules.bandMeters;
  const hits = m.map((_, i) => {
    const x = p.v.melee ? (i === 0 ? 1 : 0) : p.v.hitBase(i + 1);
    return x == null ? -1 : x;
  });
  const lo = Math.min(...hits),
    hi = Math.max(...hits);
  // Full-brightness ramp: red, orange, yellow, lime, green. Each color sits mid-band, so it blends across the band instead of bunching at its edge.
  const RAMP = [0, 28, 58, 90, 135];
  const color = (x) => {
    const t = hi > lo ? (x - lo) / (hi - lo) : 1;
    const at = t * (RAMP.length - 1),
      i = Math.min(RAMP.length - 2, Math.floor(at));
    return `hsl(${Math.round(RAMP[i] + (RAMP[i + 1] - RAMP[i]) * (at - i))},100%,58%)`;
  };
  let stops = `<stop offset="0" stop-color="${color(hits[0])}"/>`;
  for (let i = 0; i < 10; i++) {
    const mid = ((i ? m[i - 1] : 0) + m[i]) / 2;
    if (mid < d) stops += `<stop offset="${(mid / d).toFixed(4)}" stop-color="${color(hits[i])}"/>`;
  }
  stops += `<stop offset="1" stop-color="${color(hits[bandFor(d) - 1])}"/>`;
  return `<defs><linearGradient id="aimg" gradientUnits="userSpaceOnUse" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}">${stops}</linearGradient></defs><line class="aimbg" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="aim" style="stroke:url(#aimg)" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
}
// THE ACCURACY RING. On someone's turn, a halo around them shows their real hit chance with the weapon in hand at every range band,
// and behind each object it reads as line of sight: the area past cover drops by that cover's penalty, until nothing can hit there.
// Solid steps, dark red at low odds up to bright yellow at high odds, so lightness alone tells them apart (colorblind-safe).
// Anywhere a shot can't land is left clear, with a black line around it.
const ringColor = (x) => `hsl(${Math.round(2 + 56 * x)},100%,${Math.round(40 + 40 * x)}%)`;
function ringHits(id) {
  const A = ent(id);
  const c = ctx();
  const wi = ui.atk && ui.atk.att === id ? ui.atk.w : A.activeW || 0;
  const slot = (A.weapons || [])[wi];
  if (!slot) return null;
  const o = (E.get(c, slot.n) || { o: {} }).o;
  const d0 = der(A);
  const open = { tier: "open", n: "Open", hit: 0, dam: 0 };
  // With no target picked, odds are against someone with no modifiers of their own (the shooter's stats stand in).
  return S.rules.bandMeters.map((_, i) => {
    try {
      const r = i + 1;
      const dA = E.forShot(d0, A, { o, range: r, round: K() ? K().round : 1 }, c);
      const v = E.weaponView(slot, A, dA, c, ui.atk && ui.atk.att === id ? ui.atk.mode : "pr");
      if (v.melee && r > 1 && !dA.m.lunge) return -1;
      // with a target picked, the odds are against them: their dodge perks, armor-type rules and so on, as in the attack panel
      const T = ui.atk && ui.atk.att === id && ui.atk.tgt ? ent(ui.atk.tgt) : null;
      if (T) {
        const tSlot = (T.weapons || [])[T.activeW || 0];
        const tO = tSlot ? (E.get(c, tSlot.n) || { o: {} }).o : {};
        const round = K() ? K().round : 1;
        const dA2 = E.forShot(d0, A, { o, vs: E.enemyType(T, S.rules), targetMob: !!T.mob, range: r, round, part: ui.atk.loc }, c);
        const v2 = E.weaponView(slot, A, dA2, c, ui.atk.mode);
        if (v2.melee && r > 1 && !dA2.m.lunge) return -1;
        const dT = E.forShot(der(T), T, { o: tO, round, attackerO: o, attackerMob: !!A.mob, range: r, part: ui.atk.loc }, c);
        const hc2 = E.hitChance(A, dA2, T, dT, v2, r, c, open, ui.atk.loc);
        return hc2.noData ? -1 : hc2.hit * (1 + (dA2.m.accMul || 0));
      }
      const hc = E.hitChance(A, dA, A, d0, v, r, c, open, ui.atk && ui.atk.att === id ? ui.atk.loc : null);
      return hc.noData ? -1 : hc.hit;
    } catch (e) {
      return -1;
    }
  });
}
const RING_RAYS = 240;
// One ray's pieces: [from, to, chance] in meters, with chance <= 0 meaning no shot lands there.
function rayPieces(a, ang, hits, objs) {
  const m = S.rules.bandMeters;
  const R = m[m.length - 1];
  const hitBy = E.rayCover(a, ang, R, objs, S.rules);
  const cuts = [...new Set([0, ...m, ...hitBy.map((x) => x.d)])].filter((x) => x <= R).sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const r0 = cuts[i],
      r1 = cuts[i + 1];
    if (r1 - r0 < 1e-6) continue;
    const band = bandFor((r0 + r1) / 2) - 1;
    let pen = 0;
    const passed = hitBy.filter((x) => x.d <= r0 + 1e-6);
    if (S.rules.coverStack) {
      // layered cover: the first object sets the hit penalty; anything impenetrable stops it entirely
      if (passed.length) pen = S.rules.cover[passed[0].tier].hit * coverLeft(passed[0].o);
      if (passed.some((x) => x.tier === "impenetrable")) pen = -1;
    } else for (const x of passed) pen = Math.min(pen, S.rules.cover[x.tier].hit * coverLeft(x.o));
    const ch = hits[band] < 0 ? 0 : Math.round((hits[band] + pen) * 100) / 100;
    const last = out[out.length - 1];
    if (last && last[2] === ch) last[1] = r1;
    else out.push([r0, r1, ch]);
  }
  return out;
}
let ringMemo = { key: "", svg: "" };
function accRing(id) {
  const hits = ringHits(id);
  if (!hits || !hits.some((x) => x > 0)) return "";
  const m = S.rules.bandMeters;
  const R = m[m.length - 1];
  const a = posOf(id);
  const objs = S.scene.objects.filter((o) => E.coverTier(o, S.rules) !== "open" && dist(o, a) - Math.max(o.w || 1, o.h || 1) <= R);
  const tgt = ui.atk && ui.atk.att === id && ent(ui.atk.tgt) ? ent(ui.atk.tgt).name : "";
  // Only redrawn when the shooter, the odds, the target or the cover around them change: this is the costly part of a map redraw.
  const key = JSON.stringify([a.x, a.y, hits, tgt, S.rules.coverStack, objs]);
  if (ringMemo.key === key) return ringMemo.svg;
  const TAU = 2 * Math.PI;
  const wrap = (x) => ((x % TAU) + TAU) % TAU;
  // Each object's slice of the view (its outline seen from here), so a ray only tests the few objects in its direction.
  const arcs = objs.map((o) => {
    const pts = E.shotOutline(o, S.rules);
    const c = Math.atan2(o.y - a.y, o.x - a.x);
    const near = Math.hypot(o.x - a.x, o.y - a.y) <= Math.max(...pts.map((q) => Math.hypot(q.x - o.x, q.y - o.y))) + 0.01;
    const half = Math.max(...pts.map((q) => Math.abs(((Math.atan2(q.y - a.y, q.x - a.x) - c + 3 * Math.PI) % TAU) - Math.PI)));
    return { o, pts, c, half: near ? 9 : half + 1e-6 };
  });
  const at = (t) => ({
    t,
    p: rayPieces(
      a,
      t,
      hits,
      arcs.filter((x) => Math.abs(((t - x.c + 3 * Math.PI) % TAU) - Math.PI) <= x.half).map((x) => x.o),
    ),
  });
  const sig = (p) => p.map((x) => x[2]).join(",");
  // Same kind of pieces, with no edge jumping: a straight segment between the two rays follows the outline.
  const close = (p, q) => sig(p) === sig(q) && p.every((x, i) => Math.abs(x[0] - q[i][0]) < 0.2 + 0.02 * x[0] && Math.abs(x[1] - q[i][1]) < 0.2 + 0.02 * x[1]);
  // Rays: an even sweep plus one at every corner of the cover nearby, so corners and edges land exactly.
  const angs = new Set();
  for (let k = 0; k < RING_RAYS; k++) angs.add((k / RING_RAYS) * TAU);
  for (const x of arcs) if (x.pts.length <= 8) for (const q of x.pts) angs.add(E.fix(wrap(Math.atan2(q.y - a.y, q.x - a.x)))); // corners only: curves (32-point ellipses) are smooth
  const base = [...angs].sort((x, y) => x - y).map(at);
  // Where two neighboring rays disagree, find the exact angle by halving the gap: that's the edge of the cover's shadow.
  const pts = [];
  base.forEach((s0, n) => {
    pts.push(s0);
    const s1 = n + 1 < base.length ? base[n + 1] : { t: base[0].t + TAU, p: base[0].p };
    if (close(s0.p, s1.p)) return;
    let lo = s0,
      hi = s1;
    for (let it = 0; it < 14 && hi.t - lo.t > 1e-6; it++) {
      const mid = at((lo.t + hi.t) / 2);
      if (close(lo.p, mid.p)) lo = mid;
      else hi = mid;
    }
    if (lo !== s0) pts.push(lo);
    pts.push({ ...hi, brk: true });
  });
  // the last one may be the wrapped first ray: keep angles inside one turn
  if (pts[pts.length - 1].t >= TAU) {
    const w = pts.pop();
    pts[0] = { ...pts[0], brk: !!w.brk || pts[0].brk };
  }
  // Runs: unbroken stretches of rays. With no break at all the whole ring is one closed run.
  const first = pts.findIndex((x) => x.brk);
  const runs = [];
  if (first < 0) runs.push([...pts, { ...pts[0], t: pts[0].t + TAU }]);
  else {
    const rot = [...pts.slice(first), ...pts.slice(0, first).map((x) => ({ ...x, t: x.t + TAU }))];
    for (const x of rot) (x.brk || !runs.length ? runs[runs.push([]) - 1] : runs[runs.length - 1]).push(x);
  }
  const P = (r, t) => `${E.fix(a.x + r * Math.cos(t))} ${E.fix(a.y + r * Math.sin(t))}`;
  const line = (r, run, j, which) => run.map((x) => P(x.p[j][which], x.t));
  // One path per color and one for all the black edges: hundreds of wedges would otherwise be hundreds of elements in every redraw.
  const byCol = new Map(),
    edgeD = [];
  for (const run of runs) {
    const pcs = run[0].p;
    pcs.forEach(([r0, , ch], j) => {
      if (ch <= 0) return;
      const col = ringColor(Math.min(1, ch));
      const outer = line(0, run, j, 1),
        inner = run.every((x) => x.p[j][0] < 1e-9) ? [`${E.fix(a.x)} ${E.fix(a.y)}`] : line(0, run, j, 0).reverse();
      byCol.set(col, (byCol.get(col) || "") + `M${outer.join("L")}L${inner.join("L")}Z`);
      // black lines along the near and far side wherever the next piece is a place no shot lands
      const before = pcs[j - 1],
        after = pcs[j + 1];
      if (r0 > 0 && (!before || before[2] <= 0)) edgeD.push(`M${line(0, run, j, 0).join("L")}`);
      if (!after || after[2] <= 0) edgeD.push(`M${outer.join("L")}`);
    });
  }
  // black lines across, where one side of a break can be hit and the other can't
  if (runs.length > 1)
    runs.forEach((run, i) => {
      const next = runs[(i + 1) % runs.length];
      const pa = run[run.length - 1],
        pb = next[0];
      const t = pb.t;
      const lit = (pcs) => pcs.filter((p) => p[2] > 0).map((p) => [p[0], p[1]]);
      const A0 = lit(pa.p),
        B0 = lit(pb.p);
      const cuts = [...new Set([...A0.flat(), ...B0.flat()])].sort((x, y) => x - y);
      const inn = (L, x) => L.some(([p, q]) => x > p && x < q);
      for (let j = 0; j + 1 < cuts.length; j++) {
        const mid = (cuts[j] + cuts[j + 1]) / 2;
        if (inn(A0, mid) !== inn(B0, mid)) edgeD.push(`M${P(cuts[j], t)}L${P(cuts[j + 1], t)}`);
      }
    });
  const fills = [...byCol].map(([col, d]) => `<path class="ringfill" style="fill:${col}" d="${d}"/>`).join(""),
    edges = edgeD.length ? `<path class="ringedge" d="${edgeD.join("")}"/>` : "";
  ringMemo = {
    key,
    svg: `<g class="accring"><title>Hit chance by range on open ground${ui.atk && ui.atk.att === id && ent(ui.atk.tgt) ? ` against ${h(ent(ui.atk.tgt).name)}` : ""}: ${hits.map((x, i) => `R${i + 1} ${Math.max(0, Math.round(x * 100))}%`).join(", ")}. Past cover it drops by the first object's penalty; more cover cuts damage, not the odds.</title>${fills}${edges}</g>`,
  };
  return ringMemo.svg;
}
// Ctrl while dragging on a turn: the token snaps to the middle of the range band it's in, measured from the target (or the nearest foe).
function snapRange(id, p) {
  const tid =
    ui.atk && ui.atk.att === id && ui.atk.tgt
      ? ui.atk.tgt
      : (K() ? K().cbs : [])
          .filter((c) => c.id !== id && alive(c) && sideOf(c.id) !== sideOf(id))
          .map((c) => c.id)
          .sort((x, y) => dist(posOf(x), posOf(id)) - dist(posOf(y), posOf(id)))[0];
  if (!tid) return { p, band: null };
  const t = posOf(tid);
  const d = dist(t, p) || 0.01;
  const m = S.rules.bandMeters;
  const b = bandFor(d);
  const r = ((b > 1 ? m[b - 2] : 0) + m[b - 1]) / 2;
  return { p: inMap({ x: E.fix(t.x + ((p.x - t.x) / d) * r), y: E.fix(t.y + ((p.y - t.y) / d) * r) }), band: b, tgt: tid };
}
function mapSvg() {
  const k = K();
  const M = mapOf();
  const v = mapView();
  ui.viewW = v.w;
  const label = v.w * 0.0125; // text stays the same size on screen at any zoom
  const step = S.rules.gridM || 2;
  // The grid counts out from the top-left corner, so every square is the same size and the map ends on a whole square.
  let grid = "";
  const hex = S.rules.gridMode === "hex";
  if (hex) {
    // Flat-topped hexes, hexM meters across the corners, laid from the top-left corner and cut off at the map's edge.
    const R = (S.rules.hexM || 12.5) / 2,
      H = Math.sqrt(3) * R;
    for (let c = 0, x = -M.w / 2; x - R < M.w / 2; c++, x += 1.5 * R)
      for (let y = -M.h / 2 + (c % 2 ? H / 2 : 0); y - H / 2 < M.h / 2; y += H) {
        grid += `M${E.fix(x + R)} ${E.fix(y)}`;
        for (let i = 1; i <= 6; i++) {
          const a = (Math.PI / 3) * i;
          grid += `L${E.fix(x + R * Math.cos(a))} ${E.fix(y + R * Math.sin(a))}`;
        }
      }
  } else if (S.rules.gridMode !== "none") {
    for (let x = -M.w / 2 + step; x < M.w / 2 - 0.01; x += step) grid += `M${x} ${-M.h / 2}V${M.h / 2}`;
    for (let y = -M.h / 2 + step; y < M.h / 2 - 0.01; y += step) grid += `M${-M.w / 2} ${y}H${M.w / 2}`;
  }
  const labels = []; // drawn above every object, so no neighbor or shadow covers a name
  const objs = [...S.scene.objects]
    .sort((a, b) => !!b.floor - !!a.floor) // floors first, under everything
    .filter((o) => !(isSpec() && hiddenTrap(o) && !trapsSeen())) // players never see a trap nobody has found
    .map((o) => {
      const w = o.w || 1,
        ht = o.h || 1;
      const tier = E.coverTier(o, S.rules);
      const cv = S.rules.cover[tier] || {};
      const name = o.label || (S.rules.mapItems[o.item] || {}).n || (o.kind === "hazard" && (S.rules.hazardKinds || {})[o.sub]) || MAP_OBJ[o.kind][0];
      const gl =
        o.blob && o.kind !== "hazard" ? blobGlyph(o) : (o.kind === "hazard" && hzGlyph(o.sub)) || GLYPH[ITEM_GLYPH[o.item] || KIND_GLYPH[o.kind] || "crate"];
      const hid = hiddenTrap(o);
      // Drawn at real size in meters, so a tree is tiny on a 220m map and full size when you zoom in. Harder cover looks more solid.
      const turn = o.angle ? `rotate(${o.angle}) ` : "";
      const draw = turn + (o.rot ? `rotate(90) scale(${ht} ${w})` : `scale(${w} ${ht})`);
      const showName =
        o.label ||
        (v.w <= 30 &&
          o.item !== "concreteWall" &&
          name.length * label * 0.6 <= Math.max(w, ht) * 1.6); /* walls are obvious; and a name wider than its thing would print over its neighbors */
      // Trees: a faint circle for the trunk, which is what stops shots, under a fainter picture of the leaves.
      const trunk = E.trunkOf(o, S.rules);
      const hzIcon = o.kind === "hazard" && VICON["h_" + o.sub];
      const fl = (S.rules.mapItems[o.item] || {}).floor;
      if (fl)
        return `<g class="obj floorobj" transform="translate(${o.x} ${o.y})"><rect x="${-w / 2}" y="${-ht / 2}" width="${w}" height="${ht}" style="fill:url(#ter-${fl})"/></g>`; // a floor: the terrain pattern, nothing else
      const art = hzIcon
        ? hazardArt(o, w, ht, turn, draw, hzIcon)
        : trunk
          ? `<g class="gly trunk" style="opacity:${S.rules.trunkOpacity}" transform="scale(${w * trunk} ${ht * trunk})"><ellipse rx=".5" ry=".5"/></g><g class="gly canopy" style="opacity:${S.rules.canopyOpacity}" transform="${draw}">${gl}</g><g class="gly canopyline" transform="${draw}">${gl}</g>`
          : `<g class="gly" style="opacity:${E.fix(0.78 + 0.22 * (cv.opacity != null ? cv.opacity : 1))}" transform="${draw}">${gl}</g>`; // harder cover still more solid
      const hpMax = objHp(o);
      const hpBar_ =
        hpMax && o.dmg
          ? `<g class="ohp"><rect class="ohpbg" x="${-w / 2}" y="${-ht / 2 - label * 0.7}" width="${w}" height="${label * 0.4}"/><rect class="ohpf" x="${-w / 2}" y="${-ht / 2 - label * 0.7}" width="${E.fix(w * clamp(1 - o.dmg / hpMax, 0, 1))}" height="${label * 0.4}"/></g>`
          : "";
      return `<g class="obj ${o.kind} tier-${tier} m-${MAT_OF[o.item] || "none"} ${o.voidBlock ? "oob" : ""} ${o.loot ? (o.opened ? "opened" : "lootable") : ""} ${o.open && E.isDoor(o, S.rules) ? "dooropen" : ""} ${hid ? "hidtrap" : ""} ${o.kind === "hazard" ? "hz-" + o.sub : ""} ${o.sprung ? "sprung" : ""} ${ui.mapSel === o.id ? "sel" : ""}" data-obj="${o.id}" transform="translate(${o.x} ${o.y})"><title>${h(name)}: ${h(cv.n || "")}${hpMax ? `, ${fmt(hpMax - (o.dmg || 0))}/${hpMax} HP` : ""}${o.loot ? (o.opened ? ", opened" : ", opens for whoever is within R1 on their turn") : ""}${trunk ? ", only the trunk stops shots" : ""}${E.isDoor(o, S.rules) ? (o.open ? ", open" : ", shut: blocks walking and sight") : E.walkBlocks(o, S.rules) ? ", blocks walking (it would have to be vaulted)" : ""}${(S.rules.mapItems[o.item] || {}).hazard ? ", radioactive" : ""}${hid ? ", hidden: the players can't see it" : ""}${o.sprung ? ", sprung" : ""}. Drag to move, right-click to remove.</title>${art}${ui.mapSel === o.id ? `<g transform="${o.angle ? `rotate(${o.angle})` : ""}"><line class="rotline" x1="0" y1="0" x2="0" y2="${-(ht / 2 + v.w * 0.04)}"/><circle class="rothandle" data-rot="${o.id}" cy="${-(ht / 2 + v.w * 0.04)}" r="${v.w * 0.014}"><title>Drag to turn</title></circle><rect class="sizehandle" data-size="${o.id}" x="${E.fix(w / 2 - v.w * 0.011)}" y="${E.fix(ht / 2 - v.w * 0.011)}" width="${E.fix(v.w * 0.022)}" height="${E.fix(v.w * 0.022)}"><title>Drag to resize (Shift: exact, not to 0.1 m)</title></rect></g>` : ""}${hpBar_}</g>${showName || o.loot ? (labels.push(`<text style="font-size:${label}px" x="${o.x}" y="${E.fix(o.y + ht / 2 + label)}">${h(name)}${o.loot && o.opened ? " (open)" : ""}</text>`), "") : ""}`;
    })
    .join("");
  const me = isSpec() ? null : k ? (fightPhase() ? actorId() : null) : ui.sel;
  const ring = k && fightPhase() && actorId() ? accRing(actorId()) : "";
  const k2 = tokenScale(v.w);
  ui.tokK = k2;
  const labU = label / k2;
  const mapPx = (document.getElementById("map") || {}).clientWidth || 700;
  const ppm = mapPx / v.w; // screen pixels per meter
  const lensOn = ppm * 1 < LENS_PX;
  const LU = 1 / (ppm * k2); // one screen pixel, in token units
  // 13 Nov: in a fight, only the token whose turn it is takes clicks (bunched-up tokens used to catch clicks meant for it), and it's
  // drawn on top. While the attack panel is open everyone is clickable again, to pick a target (an ally too). Shift lets the DM grab anyone.
  const turnLock = k && k.phase === "turns" && k.turnId && !isSpec() && !(ui.atk && ui.atk.att === k.turnId) ? k.turnId : null;
  const people = [...S.chars, ...foes()]
    .sort((a, b) => (a.id === turnLock) - (b.id === turnLock))
    .map((e) => {
      const c = cbOf(e.id);
      const p = posOf(e.id);
      const d = der(e);
      const pct = d.hp > 0 ? clamp(e.hp / d.hp, 0, 1) : 0;
      const gone = c && (c.dead || c.fled);
      const cls = [
        e.kind === "pc" ? "pc" : e.ally ? "ally" : "npc",
        k && k.turnId === e.id ? "cur" : "",
        ui.rowSel === e.id || (!k && ui.sel === e.id) ? "sel" : "",
        ui.atk && ui.atk.tgt === e.id ? "tgt" : "",
        gone ? "gone" : "",
        e.dbno ? "dbno" : "",
        turnLock && e.id !== turnLock ? "locked" : "",
      ].join(" ");
      const showR = me && me !== e.id && !gone && (k ? true : e.kind === "npc");
      const fx = tokFx(e.id);
      const icon = (TOKEN_ICONS[iconOf(e)] || TOKEN_ICONS.person)[1];
      const lines = (x) =>
        labelLines(e, showR ? ` R${rangeOf(me, e.id)}` : "")
          .map((t, i) => `<tspan x="${x}" dy="${i ? "1.05em" : 0}">${h(t)}</tspan>`)
          .join("");
      let tail;
      if (lensOn && !gone) {
        // the magnifier: a ring of fixed screen size up and to the right, on a line from the token, holding its picture, health and name
        const R = 12 * LU,
          cx = 22 * LU,
          cy = -0.3 - 22 * LU;
        tail = `<g class="lens"><line class="lensline" x1="0" y1="-.3" x2="${E.fix(cx)}" y2="${E.fix(cy)}"/><circle class="lensc" cx="${E.fix(cx)}" cy="${E.fix(cy)}" r="${E.fix(R)}"/><g transform="translate(${E.fix(cx)} ${E.fix(cy + R * 0.25)}) scale(${E.fix(R / 1.1)})">${icon}</g><rect class="hpbg" x="${E.fix(cx - R)}" y="${E.fix(cy + R + 2 * LU)}" width="${E.fix(2 * R)}" height="${E.fix(3 * LU)}"/><rect class="hpb" x="${E.fix(cx - R)}" y="${E.fix(cy + R + 2 * LU)}" width="${E.fix(2 * R * pct)}" height="${E.fix(3 * LU)}"/><text class="lab" style="font-size:${labU * 1.8}px" y="${E.fix(cy + R + 5 * LU + labU * 1.8)}">${lines(E.fix(cx))}</text></g>`;
      } else
        tail = `${gone ? `<path class="x" d="M-.4 -.4 L.4 .4 M.4 -.4 L-.4 .4"/>` : `<rect class="hpbg" x="-.6" y=".66" width="1.2" height=".2"/><rect class="hpb" x="-.6" y=".66" width="${(1.2 * pct).toFixed(2)}" height=".2"/>`}<text class="lab" style="font-size:${labU * 1.8}px" y="${0.95 + labU * 1.8}">${lines(0)}</text>`;
      return `<g class="tok ${cls}" data-tok="${e.id}" transform="translate(${p.x} ${p.y}) scale(${k2})"><title>${h(e.name)}: ${fmt(e.hp)}/${d.hp} HP</title><circle class="hit" r="${Math.max(0.75, (v.w * 0.014) / k2)}"/><g class="tokin ${fx ? fx.cls : ""}" style="${fx ? fx.style : ""}">${e.kind === "pc" || e.ally ? `<circle class="base" cy="-.3" r=".86"/>` : `<rect class="base" x="-.66" y="-.96" width="1.32" height="1.32" transform="rotate(45 0 -.3)"/>`}<g transform="translate(0 -.3) scale(.9) translate(0 .3)">${icon}</g>${fx ? `<circle class="flash" cy="-.3" r=".9" style="${fx.style}"/>` : ""}</g>${tail}<text class="drg" style="font-size:${labU * 1.2}px" y="-.85"></text></g>`;
    })
    .join("");
  let extra = "";
  // The move you're previewing: a dashed path and a ghost at the far end, with the price on it.
  if (ui.pendingMove && ent(ui.pendingMove.id)) {
    const m = ui.pendingMove,
      a = posOf(m.id);
    const len = Math.round(dist(a, m) * 10) / 10;
    extra += `<line class="movepath" x1="${a.x}" y1="${a.y}" x2="${m.x}" y2="${m.y}"/><text class="movelen" style="font-size:${labU * 1.1}px" x="${(a.x + m.x) / 2}" y="${(a.y + m.y) / 2}" dy="-.3">${fmt(len)} m</text><g class="ghost" transform="translate(${m.x} ${m.y}) scale(${k2})"><circle cy="-.42" r=".27"/><path d="M-.46 .4 A.46 .62 0 0 1 .46 .4 Z"/><text style="font-size:${labU * 1.2}px" y="-.85">${fmt(m.cost)} AP</text></g>`;
  }
  if (k && fightPhase() && actorId() && !isSpec()) {
    const a = posOf(actorId());
    const r = reachOf(ent(actorId()));
    if (r) extra += `<circle class="reach" cx="${a.x}" cy="${a.y}" r="${r}"/>`;
  }
  if (ui.keyMove && ent(ui.keyMove.id) && !isSpec()) {
    const km = ui.keyMove,
      a = posOf(km.id),
      r = (km.ang * Math.PI) / 180;
    const len = Math.max(km.steps * speedOf(ent(km.id)), 2.2 * k2);
    const tip = { x: a.x + Math.cos(r) * len, y: a.y + Math.sin(r) * len };
    const hw = 0.35 * k2;
    const back = { x: tip.x - Math.cos(r) * hw * 2, y: tip.y - Math.sin(r) * hw * 2 };
    extra += `<line class="karrow" x1="${a.x}" y1="${a.y}" x2="${E.fix(back.x)}" y2="${E.fix(back.y)}"/><path class="karrowhead" d="M${E.fix(tip.x)} ${E.fix(tip.y)}L${E.fix(back.x - Math.sin(r) * hw)} ${E.fix(back.y + Math.cos(r) * hw)}L${E.fix(back.x + Math.sin(r) * hw)} ${E.fix(back.y - Math.cos(r) * hw)}Z"/>`;
  }
  if (ui.atk && ui.atk.tgt && ent(ui.atk.tgt) && !ui.autoPlan) {
    const a = posOf(ui.atk.att),
      b = posOf(ui.atk.tgt);
    extra += aimLine(a, b);
  } else if (isSpec() && S.live && S.live.aim && ent(S.live.aim.att) && ent(S.live.aim.tgt)) {
    const a = (ui.pendingMove && ui.pendingMove.id === S.live.aim.att && ui.pendingMove) || posOf(S.live.aim.att),
      b = posOf(S.live.aim.tgt);
    extra += `<line class="aimbg" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="aim aimspec" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
  }
  // an automated turn waiting for Confirm: where they'll walk, and who they'll shoot
  if (ui.autoPlan && ent(ui.autoPlan.id) && !isSpec()) {
    const p = ui.autoPlan,
      a = posOf(p.id),
      to = p.at || a;
    if (p.at)
      extra += `<polyline class="movepath" fill="none" points="${a.x},${a.y} ${p.via ? `${p.via.x},${p.via.y} ` : ""}${to.x},${to.y}"/><g class="ghost" transform="translate(${to.x} ${to.y}) scale(${k2})"><circle cy="-.42" r=".27"/><path d="M-.46 .4 A.46 .62 0 0 1 .46 .4 Z"/></g>`;
    if (p.tgt && ent(p.tgt) && p.steps.some((s) => s.t === "attack")) {
      const T = posOf(p.tgt);
      extra += ui.atk ? aimLine(to, T) : `<line class="movepath" x1="${to.x}" y1="${to.y}" x2="${T.x}" y2="${T.y}"/>`; // no attack panel open: a plain line
    }
  }
  const zoomed = ui.zoom ? ui.zoom.k : 1;
  return `<div class="mapwrap"><svg id="map" class="${ui.place ? "placing" : ""}" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of ${h(M.n)}, ${M.w} by ${M.h} meters"><rect class="floor" x="${-M.w / 2}" y="${-M.h / 2}" width="${M.w}" height="${M.h}" style="fill:url(#ter-${terrainOf()})"/><defs>${MAP_DEFS}<clipPath id="floorclip"><rect x="${-M.w / 2}" y="${-M.h / 2}" width="${M.w}" height="${M.h}"/></clipPath></defs><path class="grid" clip-path="url(#floorclip)" d="${grid}" style="stroke-opacity:${hex ? 0.8 : v.w > 120 ? 0.35 : v.w > 60 ? 0.6 : 1}"/>${ring}${objs}<g class="obj olabels">${labels.join("")}</g>${extra}${throwOverlay()}${people}${fxLayer(k2, v.w)}</svg>${ui.legend ? mapLegend() : ""}<div class="zoombar"><button class="btn tiny ${ui.legend ? "on" : ""}" data-a="legendToggle" data-v="" title="What the colors, outlines and shapes on the map mean">Key</button><span class="scale s">${hex ? `${S.rules.hexM}m hexes` : S.rules.gridMode === "none" ? "No grid" : `${step}m grid`} · ${Math.round(v.w)}m across</span><button class="btn tiny ${!hex && S.rules.gridMode !== "none" ? "on" : ""}" data-a="setGrid" data-v="square" title="${step}m squares">&#9633;</button><button class="btn tiny ${hex ? "on" : ""}" data-a="setGrid" data-v="hex" title="Hexes ${S.rules.hexM}m across">Hex</button><button class="btn tiny ${S.rules.gridMode === "none" ? "on" : ""}" data-a="setGrid" data-v="none" title="No grid">Off</button><button class="btn tiny" data-a="mapZoom" data-v="1.5" title="Zoom in (or scroll, pinch, double-tap)">+</button><button class="btn tiny" data-a="mapZoom" data-v="0.667" title="Zoom out (or scroll, pinch)">-</button><button class="btn tiny ${zoomed > 1 ? "on" : ""}" data-a="mapZoom" data-v="0" title="Show the whole map">Fit</button></div></div>`;
}
function checkValue(e, use) {
  const d = der(e);
  return E.SPECIAL.includes(use)
    ? { v: (d.sp[use] || 0) * S.rules.specialAsSkill, label: `${SP_LABEL[use]} ${d.sp[use]} x ${S.rules.specialAsSkill}` }
    : { v: d.skills[use] || 0, label: `${SKILL_NAME[use]} ${d.skills[use] || 0}` };
}
