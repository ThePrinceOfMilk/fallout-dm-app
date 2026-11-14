// ===== 08-modals.js: POP-UP WINDOWS. The perk and skill trees, move, item, status, edit and level-up windows, notes, the guide,
// the character wizard, help, bible search, details and the terminal view.
// PERK TREES: a folder tab per player. Skill perks grow in three ranks per skill (Proficiency, Expertise, Mastery); level perks by level.
// Skill tree branches. A skill not listed here lands in an Other branch.
const SKILL_TYPES = [
  ["Combat", ["SG", "BG", "EW", "MW", "EXP"]],
  ["Technical", ["LPK", "REP", "SCI", "MED"]],
  ["Social and survival", ["BAR", "SPE", "SNK", "SUR"]],
];
const treeZ = () => ui.treeZoom || (small() ? 0.6 : 1); // phones start zoomed out
// A skill's perks as branches. The workbook lays each skill out in rows of Proficiency, Expertise and Mastery cells,
// with a blank cell meaning "same as above", so a perk's parent is the last perk one rank lower that came before it.
const PERK_RANKS = ["Proficiency", "Expertise", "Mastery"];
const perkBranchCache = new Map();
function perkBranches(group) {
  if (perkBranchCache.has(group)) return perkBranchCache.get(group);
  const roots = [],
    last = {};
  for (const p of DATA.skillPerks.filter((x) => x.group === group)) {
    const ri = PERK_RANKS.indexOf(p.rank);
    const x = { p, kids: [], parent: null };
    const up = ri > 0 ? last[ri - 1] : null;
    if (up) {
      x.parent = up.p;
      up.kids.push(x);
    } else roots.push(x);
    last[ri] = x;
    for (let j = ri + 1; j < PERK_RANKS.length; j++) delete last[j]; // a new branch starts below this perk
  }
  perkBranchCache.set(group, roots);
  return roots;
}
// The parent perk of a skill perk, or null for a first-rank perk.
function perkParent(name) {
  const p = DATA.skillPerks.find((x) => E.low(x.n) === E.low(name));
  if (!p) return null;
  const walk = (xs) => {
    for (const x of xs) {
      if (x.p === p) return x.parent;
      const r = walk(x.kids);
      if (r !== undefined) return r;
    }
    return undefined;
  };
  return walk(perkBranches(p.group)) || null;
}
// 12 Nov: the effect in short, under a perk's name: its numbers when the app applies any, else the first words of its text.
function perkFx(p) {
  const rows = DATA.sc.filter((r) => E.low(r.n) === E.low(p.n));
  const rule = (S.rules.perkRules || {})[p.n] || [];
  const mods = Object.assign({}, ...rows.map((r) => r.mods || {}), ...rule.map((r) => r.fx || {}));
  const nums = modLine({ mods });
  if (nums) return nums;
  const t = String(p.effect || "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > 70 ? t.slice(0, 67).replace(/\s\S*$/, "") + "..." : t;
}
function treeModal(mode) {
  const pcs = S.chars;
  if (!pcs.length) return `<div class="dim">No characters yet.</div>`;
  const e = ent(ui.treeId) || pcs[0];
  ui.treeId = e.id;
  const d = der(e);
  const owned = new Set((e.perks || []).map(E.low));
  const tabs = `<div class="ftabs">${pcs.map((c) => `<button class="ftab ${c.id === e.id ? "on" : ""}" data-a="treeTab" data-v="${c.id}" aria-pressed="${c.id === e.id}">${iconSvg(c.icon)}${h(c.name)}${c.perkDue ? `<b>${c.perkDue}</b>` : ""}</button>`).join("")}</div>`;
  const node = (p, state, sub, kind) =>
    `<button class="pnode ${state}" ${state === "can" ? `data-a="levelPerk" data-v="${e.id}|${h(p.n)}|${kind}"` : `data-a="noop" data-v=""`} title="${h(p.effect || "No effect written.")}${state === "can" ? " Click to take it." : state === "lock" ? " Not yet." : ""}"><span class="pn">${h(p.n)}</span>${sub ? `<span class="s dim">${h(sub)}</span>` : ""}<span class="pfx">${h(perkFx(p))}</span></button>`;
  // 12 Nov: a real tree. Each skill's perks branch: a Proficiency perk leads to its own Expertise perks, and those to their Mastery perks.
  // Taking a perk needs the skill over its rank and, below the first rank, the perk it branches from.
  const RANK_N = { Proficiency: "Prof.", Expertise: "Exp.", Mastery: "Mast." };
  const skillTree = ([k, n]) => {
    const val = d.skills[k] || 0;
    const kids = perkBranches(n);
    const perkLi = (x) => {
      const p = x.p;
      const parentOk = !x.parent || owned.has(E.low(x.parent.n));
      const state = owned.has(E.low(p.n)) ? "have" : val > p.need && parentOk ? "can" : "lock";
      return `<li class="${state}">${node(p, state, `${RANK_N[p.rank] || p.rank} · over ${p.need}`, "skill")}${x.kids.length ? `<ul>${x.kids.map(perkLi).join("")}</ul>` : ""}</li>`;
    };
    return `<li><div class="snode sskill" data-a="treeSkill" data-v="${k}" title="Show only ${h(n)}">${vicon(k)}<span class="grow">${h(n)}</span><span class="tval">${val}</span></div>${kids.length ? `<ul>${kids.map(perkLi).join("")}</ul>` : ""}</li>`;
  };
  const byKey = Object.fromEntries(E.SKILLS.map((s) => [s[0], s]));
  const types = [...SKILL_TYPES, ["Other", E.SKILLS.map((s) => s[0]).filter((k) => !SKILL_TYPES.some(([, ks]) => ks.includes(k)))]];
  const focus = ui.treeSkill && byKey[ui.treeSkill] ? ui.treeSkill : null;
  const skills = focus
    ? `<ul class="ptree">${skillTree(byKey[focus])}</ul>`
    : `<ul class="ptree"><li><div class="snode sroot">${iconSvg(e.icon)}<span>${h(e.name)}</span></div><ul>${types
        .map(([type, keys]) => {
          const lis = keys.filter((k) => byKey[k] && perkBranches(byKey[k][1]).length).map((k) => skillTree(byKey[k]));
          return lis.length ? `<li><div class="snode stype">${h(type)}</div><ul>${lis.join("")}</ul></li>` : "";
        })
        .join("")}</ul></li></ul>`;
  const skillBar = `<div class="row wrap tskills"><button class="opt ${focus ? "" : "on"}" data-a="treeSkill" data-v="">All skills</button>${E.SKILLS.filter(
    ([k, n]) => perkBranches(n).length,
  )
    .map(
      ([k, n]) =>
        `<button class="opt ${focus === k ? "on" : ""}" data-a="treeSkill" data-v="${k}" title="${h(n)}">${vicon(k)}${h(n)} <b>${d.skills[k] || 0}</b></button>`,
    )
    .join("")}</div>`;
  const levels = [...new Set(DATA.levelPerks.map((p) => num(p.level)).filter((x) => x != null))].sort((a, b) => a - b);
  const lv = levels
    .map(
      (L) =>
        `<div class="trow"><div class="tlabel"><span class="bright">Level ${L}</span></div><div class="tchain wrap">${DATA.levelPerks
          .filter((p) => num(p.level) === L)
          .map((p0) => {
            const p = perkInfo(p0.n) || p0;
            return node(p, owned.has(E.low(p.n)) ? "have" : L <= e.level && reqMet(p.req, d) ? "can" : "lock", p.req || p.group || "", "level");
          })
          .join("")}</div></div>`,
    )
    .join("");
  const head = `<div class="s dim" style="margin-bottom:6px">${h(e.name)} · level ${e.level}${mode === "level" && e.perkDue ? ` · <span class="warn">${e.perkDue} level perk${e.perkDue === 1 ? "" : "s"} to pick</span>` : ""}. Bright: taken. Outlined: open to take. Faint: locked.</div>`;
  return mode === "skill"
    ? `${tabs}<div class="fpane">${head}<div class="row tzoom"><span class="s dim">Zoom</span><button class="btn tiny" data-a="treeZoom" data-v="-1" title="Zoom out (or Ctrl + scroll)">-</button><span class="s">${Math.round(treeZ() * 100)}%</span><button class="btn tiny" data-a="treeZoom" data-v="1" title="Zoom in (or Ctrl + scroll)">+</button><button class="btn tiny" data-a="treeZoom" data-v="0" title="Back to 100%">100%</button><span class="s dim">Scroll to move around.</span></div>${skillBar}<div class="ttreewrap" data-scroll="ttree"><div class="ttree" style="zoom:${treeZ()}">${skills}</div></div></div>`
    : `${tabs}<div class="fpane">${head}${lv}</div>`;
}
function moveSpot(att, tgt, r) {
  const a = posOf(att),
    t = posOf(tgt);
  const d = dist(a, t);
  const m = S.rules.bandMeters[r - 1];
  if (!d) return inMap({ x: t.x + m, y: t.y });
  return inMap({ x: t.x + ((a.x - t.x) / d) * m, y: t.y + ((a.y - t.y) / d) * m });
}
function moveModal() {
  const m = ui.modal;
  const A = ent(m.att),
    T = ent(m.tgt);
  const cur = rangeOf(m.att, m.tgt);
  const opts = S.rules.moveAP
    .map((c, i) => {
      const r = i + 1;
      const spot = moveSpot(m.att, m.tgt, r);
      if (r !== cur && bandFor(dist(spot, posOf(m.tgt))) !== r) return "";
      const cost = r === cur ? 0 : moveCost(posOf(m.att), spot, A);
      return `<button class="opt ${r === cur ? "on" : ""} ${cost > A.ap ? "na" : ""}" data-a="moveTo" data-v="${r}">${kbd(r === 10 ? "0" : String(r))}R${r} <small>${cost === Infinity ? "can't" : cost + "AP"}</small></button>`;
    })
    .join("");
  return `${field(
    "Relative to",
    `<select id="mvT" data-u="modal.tgt">${options(
      targetsFor(m.att).map((id) => [id, ent(id).name]),
      m.tgt,
    )}</select>`,
  )}<div class="s dim" style="margin:3px 0">${h(T.name)} is at R${cur}. ${h(A.name)} has ${fmt(A.ap)} AP. Press a number for the new range (0 is R10), or drag the token on the map. Bands that don't fit this location aren't listed.</div><div class="opts">${opts}</div>`;
}
function itemModal() {
  const m = ui.modal;
  const A = ent(m.who);
  const lines = (A.inv || []).map((l, i) => ({ l, i, it: E.get(ctx(), l.n) })).filter((x) => x.it && x.it.cat === "item" && usable(x.it.o));
  const sel = m.sel != null ? (A.inv || [])[m.sel] : null;
  const it = sel && E.get(ctx(), sel.n);
  const tl = (A.inv || [])
    .filter((l) => (S.rules.throwables || {})[l.n])
    .map(
      (l) =>
        `<button class="rowbtn" data-a="throwStart" data-v="${A.id}|${h(l.n)}">${pix("bomb")}<span class="grow">Throw ${h(l.n)} <span class="dim">x ${fmt(l.q)}</span></span><span class="s dim">${S.rules.throwables[l.n].ap} AP</span></button>`,
    )
    .join("");
  const list =
    tl +
    lines
      .map(
        (x, n) =>
          `<button class="rowbtn ${m.sel === x.i ? "on" : ""}" data-a="itemPick" data-v="${x.i}">${n < 9 ? kbd(String(n + 1)) : ""}<span class="grow">${h(x.l.n)} <span class="dim">x ${fmt(x.l.q)}</span>${x.l.active ? "" : ` <span class="tag">STOWED</span>`}<span class="ustat">${h(useStats(x.it.o))}</span></span><span class="s dim">${x.it.o.ap != null ? x.it.o.ap + " AP" : ""}</span></button>`,
      )
      .join("");
  let detail = "";
  if (it) {
    const tgtE = ent(m.tgt) || A;
    const healDefault = E.healAmount(it.o.effect, der(A), der(tgtE));
    const who = [...S.chars, ...((K() && K().npcs) || [])].map((x) => [x.id, x.name]);
    const u = it.o.use || {};
    const mods = u.fx || {};
    detail = `<div class="result"><span class="bright">${h(sel.n)}</span>: ${h(it.o.effect || "No effect written.")}${it.o.after ? `<br>After: ${h(it.o.after)}` : ""}${it.o.addict ? `<br>Addiction ${E.pct(it.o.addict)}%${it.o.withdrawal ? `, withdrawal: ${h(it.o.withdrawal)}` : ""}` : ""}</div>
     <div class="grid wide">${field("On", `<select id="itemTgt" data-u="modal.tgt">${options(who, m.tgt || A.id)}</select>`)}${field("Heal HP", numBox(`id="itemHeal" data-u="modal.heal"`, m.heal != null ? m.heal : healDefault))}</div>
     ${tgtE.dbno ? `<div class="warnline">${h(tgtE.name)} is down. Healing items won't stand them up: use Revive.</div>` : ""}<div class="s dim" style="margin-bottom:3px">${
       [
         (u.applies || []).length ? `Applies ${u.applies.map((x) => `${x.n} ${x.tier}`).join(", ")}${it.o.dur ? ` for ${it.o.dur} turns` : ""}` : "",
         Object.keys(u.reduces || {}).length
           ? `Lowers ${Object.entries(u.reduces)
               .map(([n, x]) => `${n} by ${x}`)
               .join(", ")}`
           : "",
         (u.removes || []).length ? `Removes ${u.removes.join(", ")}` : "",
         Object.keys(mods).length ? `Effect: ${h(modLine({ mods }))}` : "",
         u.after ? `Afterward: ${u.after.n}` : "",
       ]
         .filter(Boolean)
         .join(" · ") || "Nothing automatic. Apply anything else by hand."
     }</div>${primary("itemUse", "", "Use", "Enter")}`;
  }
  return `<div class="results" style="max-height:230px">${list || `<div class="dim">Nothing usable in this inventory.</div>`}</div>${detail}`;
}
function statusModal() {
  const m = ui.modal;
  const e = ent(m.id);
  const def = db.status.get(E.low(m.name));
  const inf = def ? E.statusInfo(ctx(), { n: def.n, tier: num(m.tier, 1) }) : null;
  return `${statusSect(e)}<h3>Quick add</h3><div class="grid wide">${field("Status", `<input id="stName" autocomplete="off" list="dl-status" data-u="modal.name" value="${h(m.name)}" data-enter="stAdd">`)}${field("Tier", `<select id="stTier" data-u="modal.tier">${options([1, 2, 3, 4, 5], m.tier)}</select>`)}${field("Turns (blank: until removed)", numBox(`id="stTurns" data-u="modal.turns" data-enter="stAdd"`, m.turns))}</div>${inf && inf.text ? `<div class="s dim" style="margin-bottom:3px">${h(inf.text)}</div>` : ""}${primary("stAdd", "", "Add", "Enter")}`;
}
function editModal() {
  const e = ent(ui.modal.id);
  if (!e) return "Gone.";
  const d = der(e);
  const isPc = e.kind === "pc";
  const pool = S.rules.startPool - e.special.reduce((t, x) => t + (x || 0), 0);
  const sp = E.SPECIAL.map((k, i) =>
    field(`${SP_LABEL[k]}${d.sp[k] != null && d.sp[k] !== e.special[i] ? ` (${d.sp[k]})` : ""}`, bindNum(e.id, `special.${i}`, e.special[i])),
  ).join("");
  const common = `<div class="grid">${field("Current HP", bindNum(e.id, "hp", e.hp))}${field(`Max HP (${d.hp})`, bindNum(e.id, "ov.hp", (e.ov || {}).hp, 'placeholder="auto"'))}${field("AP now", bindNum(e.id, "ap", e.ap))}${field(`Max AP (${d.ap})`, bindNum(e.id, "ov.ap", (e.ov || {}).ap, 'placeholder="auto"'))}${field(`DT (${fmt(d.dt)})`, bindNum(e.id, "ov.dt", (e.ov || {}).dt, 'placeholder="auto"'))}${field(`Init (${fmt(d.pri)})`, bindNum(e.id, "ov.pri", (e.ov || {}).pri, 'placeholder="auto"'))}</div>`;
  if (isPc) {
    const skills = E.SKILLS.map(
      ([k, n]) =>
        `<button class="opt ${(e.tags || []).includes(k) ? "on" : ""}" data-a="toggleTag" data-v="${e.id}|${k}" title="${n}">${k} <small>${d.skills[k]}</small></button>`,
    ).join("");
    const traitInput = (i) => {
      const code = (e.traits || [])[i] || "";
      const t = db.traitByCode.get(code);
      return field(
        i === 2 ? "Trait 3 (rolled 000-099)" : `Trait ${i + 1}`,
        `<input autocomplete="off" data-c="setTrait" data-id="${e.id}" data-i="${i}" id="tr-${e.id}-${i}" list="dl-traits" value="${h(t ? `${code} ${t.n}` : code)}">`,
      );
    };
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
  const e = ent(ui.modal.id);
  const d = der(e);
  const due = e.perkDue || 0;
  const owned = new Set((e.perks || []).map(E.low));
  const levelOpts = DATA.levelPerks
    .map((p) => perkInfo(p.n) || p)
    .filter((p) => !owned.has(E.low(p.n)) && num(p.level) != null && num(p.level) <= e.level && reqMet(p.req, d));
  const skillOpts = DATA.skillPerks.filter((p) => !owned.has(E.low(p.n)) && (d.skills[(E.SKILLS.find(([, n]) => n === p.group) || [])[0]] || 0) > p.need);
  const row = (p, sub, kind) =>
    `<div class="line t"><div class="grow"><span class="bright">${h(p.n)}</span> <span class="s dim">${h(sub)}</span><div class="s dim">${h(p.effect || "No effect written.")}</div></div>${btn("levelPerk", `${e.id}|${p.n}|${kind}`, "Take", "", "tiny")}</div>`;
  return `<div class="lvlhead"><div><b>${e.ptsBank || 0}</b><span>SKILL POINTS TO ASSIGN</span></div><div class="${due ? "warn" : ""}"><b>${due}</b><span>PERK${due === 1 ? "" : "S"} TO PICK</span></div><div class="s dim grow">Level ${e.level}. ${d.pts} points a level (10 + INT/2). Tagged skills gain 2 per point. A level perk comes every ${S.rules.perkEvery} levels. Anything you leave stays banked on the card.</div></div>
    <div style="columns:2">${E.SKILLS.map(([k, n]) => `<div class="line" style="break-inside:avoid"><span class="grow">${n}${(e.tags || []).includes(k) ? ` <span class="tag warn">TAG</span>` : ""}</span><span class="bright">${d.skills[k]}</span><button class="btn tiny" data-a="spend" data-v="${e.id}|${k}|-1" title="Take a point back">-</button><button class="btn tiny" data-a="spend" data-v="${e.id}|${k}|1" title="Spend a point">+</button><button class="btn tiny" data-a="spend" data-v="${e.id}|${k}|5" title="Spend five points">+5</button></div>`).join("")}</div>
    ${fold("lvlperks", due ? `Pick a level perk (${due})` : "Level perks you qualify for", levelOpts.map((p) => row(p, `Lv ${p.level}${p.req ? " · " + p.req : ""}`, "level")).join("") || `<div class="dim">None in the sheet for this level. Add any perk by name below.</div>`, { open: due > 0, badge: levelOpts.length })}
    ${fold("skillperks", "Skill perks you qualify for", skillOpts.map((p) => row(p, `${p.group} ${p.rank}`, "skill")).join("") || `<div class="dim">None yet. They open up at over 60, 80 and 100 in a skill.</div>`, { badge: skillOpts.length })}
    <div class="line"><input class="grow" id="lvlPerkAny" autocomplete="off" list="dl-perks" placeholder="Or add any perk by name, Enter" data-enter="addPerk" data-id="${e.id}"></div>
    <div class="acts" style="margin-top:4px">${canLevel(e) ? btn("levelUp", e.id, `Next level (${e.level + 1})`) : ""}${primary("closeModal", "", "Done", "Enter")}</div>`;
}
const noteTitle = (n) => {
  const t = String(n.text || "").trim();
  return String(n.subject || "").trim() || (t.length > 15 ? t.slice(0, 15) + "..." : t) || "Empty note";
};
function notesBody() {
  const list = [...S.notesList].sort((a, b) => b.at - a.at);
  const cur = S.notesList.find((n) => n.id === ui.noteId);
  return `<div class="notes"><div class="nlist" data-scroll="nlist">${btn("noteNew", "", "New note", "", "tiny")}<h3>Recent</h3>${list.map((n) => `<button class="rowbtn ${n === cur ? "on" : ""}" data-a="noteOpen" data-v="${n.id}" title="${h(noteTitle(n))}"><span class="grow nm">${h(noteTitle(n))}</span><span class="s faint">${h(new Date(n.at).toLocaleDateString())}</span></button>`).join("") || `<div class="s dim">Nothing yet.</div>`}</div>
    <div class="nedit"><input id="noteSubj" autocomplete="off" placeholder="Subject (optional: otherwise the first 15 characters)" data-note="subject" value="${h(cur ? cur.subject : "")}"><textarea id="noteText" spellcheck="false" data-scroll="notetext" placeholder="Anything you want to remember. Saved with the campaign." data-note="text">${h(cur ? cur.text : "")}</textarea>${cur ? `<div class="acts">${btn("noteDel", cur.id, "Delete", "", "tiny danger")}</div>` : ""}</div></div>`;
}
const GUIDE = [
  [
    "Your screen",
    "Party cards are on the left. Notes run along the bottom, with the vendor in the bottom right corner when nobody is fighting. The middle shows what's going on: encounter setup, skill checks, recent events and the combat log out of combat, and the map and turn panel in a fight. The thin column on the right holds new campaign, settings, save, load, autosave, the Wiki, the log, the item browser, old notes and this guide. You can drag the bars between panels to resize them, and drag a window's title to move it. Undo (Ctrl+Z) reverses anything.",
  ],
  [
    "Party cards",
    "Each card shows HP, AP, SPECIAL and skills as boxes you can type in. Type over a number to override it. Three buttons open menus. Inventory shows gear on a body with everything carried below. Character holds stats, perks and traits. Health shows statuses and what they do to skills. When a character has points or a perk waiting, a bright button appears on the card.",
  ],
  [
    "Gear",
    "In Inventory, click a box on the body, or a weapon box on the left, to pick what goes there. It lists what the character carries. Search to hand out something new. Equipping swaps the old piece back into the pack. Hover armor to read its effects. Total DT and bonuses show at the top. Weapons only load ammo that's in the pack.",
  ],
  [
    "Out of combat",
    "Skill check: pick a skill and difficulty, or press Random, then type each player's d20. It tells you pass or fail and logs it. Vendor: pick a tier and barter level. Prices depend on the selected character's Barter against the vendor's. Buy and Sell move caps and items. A ~ on a price means the workbook has no price, so it's a placeholder from Settings. Use Rest on the party window after a fight, and All to change everyone at once.",
  ],
  [
    "Setting up a fight",
    "Press Set up encounter or B. Pick a location, which sets the map's size and so which ranges are possible. Add enemies from the list on the right. Random and Surround place them, or drag them. Click Ally on a card to turn someone blue and on the party's side. Place cover and markers with the buttons above the map. Press Begin, or Sneak to start with a stealth phase. Then type initiative rolls.",
  ],
  [
    "Taking a turn",
    "The acting character's name is at the top of the action column, and they blink green on the map and in the lists. The attack menu is already up. Pick a weapon, click a target on the map or in a list, click a body part, type the two-dice roll, press Enter. The body is bright red for an enemy and bright green for your own side. Your consumables are listed below it. Drag your token inside the dashed circle to preview a move: you see the AP cost, what's left and the new range, then Confirm or Cancel. Everything costs AP and stops when you can't afford it. Tick Free under OVR, or hold Shift while dragging, to overrule that. Press N to end the turn.",
  ],
  [
    "Cover and the aim line",
    "The line to your target is colored by the selected weapon's accuracy at each range band: red is its worst, green its best. Every shot has a cover flag from whatever the line crosses, and the worst thing wins. Open has no penalty. Concealment is -10% to hit. Soft cover is -25% to hit and -10% damage. Hard cover is -50% and -50%. Impenetrable is -100% and -100%. You can change any object's tier by clicking it, and set a shot's cover by hand under OVR. Buildings also stop walking.",
  ],
  [
    "Moving around the map",
    "Scroll over the map, or pinch it with two fingers, to zoom in on that spot. Drag empty ground, or move two fingers, to slide the map while zoomed in. On a touch screen, double-tap empty ground to get twice as close, and again at the closest zoom to see the whole map. Fit shows the whole map at once.",
  ],
  [
    "Rooms",
    "In encounter setup, pick a Location for the size and a Setting for what fills it, then press Randomize room as often as you like. Each setting has its own furniture, and bigger maps get more of it. City streets lays out concrete blocks when the map is large enough. Every map uses a 2 meter grid of whole squares. Scroll over the map, or use + and -, to zoom, drag empty ground to slide around, and Fit to see it all. Objects are drawn at real size, and people keep a readable size zoomed out and become life-size up close. Solid-looking objects stop more: concealment is faint, impenetrable is solid. On trees, only the small trunk circle stops shots: the leaves are just a picture. Click an object to select it, then use the turn buttons or Shift+scroll to rotate it. Shots and walking follow its turned shape. Add your own pieces with the buttons above the map, drag them around, and right-click to remove.",
  ],
  [
    "Packs",
    "Save pack, in the Load window, makes a .zip with your campaign, rules and every table as a spreadsheet. Open it, edit what you want, zip it back and use Load pack. It only keeps tables you actually changed, and Undo reverses a load. Keep it a .zip: WinRAR can save as zip, but browsers can't open .rar files.",
  ],
  [
    "Effects and data",
    "Items, statuses, perks and armor store their effects as named variables, listed in the Variables window up top with everything that still needs a DM. Rules can have conditions, like vs robots, first turn, only with pistols, or below 25% health, and they turn on by themselves for the shot in question. Drugs and drinks apply a real status with the workbook's numbers. When they wear off, a hangover or comedown can follow. Rest clears them. Each table up top has Export CSV, Export JSON and Import, so you can edit it in a spreadsheet and bring it back. The columns must match. Back to workbook undoes a replaced table.",
  ],
  [
    "After a fight",
    "Press End when it's over. The after-action screen gives XP and healing, and you hand out loot. If someone earned a level, a button appears on their card: it gives skill points to assign, and a perk every two levels. If the party lost, the Defeat button lets you choose what it costs them.",
  ],
  [
    "Saving",
    "Autosave keeps your place in this browser. Save writes to a named save you can reload from Load. Use Backup file there to keep a copy somewhere safe, because browser data can be cleared. New campaign asks whether to save first.",
  ],
  [
    "New campaign",
    "New campaign wipes everything back to the workbook: party, edited rules and items, notes and log. Then you build each character in five steps. Name and archetype, which sets the small starting kit. SPECIAL, which starts at 5 each and can't total more than 40. Traits: one rolled for you with a single reroll, then two you pick. Three tag skills. Then review, and add another or start.",
  ],
];
function guideBody() {
  const i = clamp(ui.guide, 0, GUIDE.length - 1);
  const tour = isSpec()
    ? ""
    : `<div class="tourcall"><span class="grow"><b>New here?</b> The interactive tour walks you through a check, rewards and a fight, lighting up each thing to use and ticking it off when you've done it. It uses a practice campaign; yours comes back after.</span>${btn("tutStart", "", "Start the interactive tour", "", "primary")}</div>`;
  return `<div class="opts" style="margin-bottom:6px">${GUIDE.map(([t], n) => `<button class="opt ${n === i ? "on" : ""}" data-a="guideGo" data-v="${n}">${n + 1}. ${h(t)}</button>`).join("")}</div>${tour}<h3>${h(GUIDE[i][0])}</h3><div class="txt guide">${h(GUIDE[i][1])}</div><div class="acts" style="margin-top:8px">${i > 0 ? btn("guideGo", i - 1, "Back") : ""}${i < GUIDE.length - 1 ? primary("guideGo", i + 1, "Next", "Enter") : primary("closeModal", "", "Done", "Enter")}</div>`;
}
// ----- step-by-step character creation
const rollTrait = (not = []) => {
  const pool = DATA.traits.filter((t) => !not.includes(t.code));
  return pool[Math.floor(Math.random() * pool.length)].code;
};
const newWiz = () => ({
  step: 0,
  name: "",
  arch: null,
  special: Array(7).fill(S.rules.startSpecial),
  rolled: rollTrait(),
  rerolled: false,
  pick: ["", ""],
  tags: [],
});
const WIZ_STEPS = ["Who", "SPECIAL", "Traits", "Tag skills", "Review"];
function kitText(a) {
  const plain = (n) => n.replace(/\s+-\s+/g, " ");
  return [
    a.w + (a.ammo ? ` (${a.ammo[1]} rounds)` : ""),
    ...(a.wear || []),
    ...(a.items || []).map(([n, q]) => plain(n) + (q > 1 ? ` x${q}` : "")),
    a.caps ? `${a.caps} caps` : "",
  ]
    .filter(Boolean)
    .join(", ");
}
// Custom gear turns into an archetype on the fly: the first weapon is drawn, worn things are worn, the rest is carried.
function customArch(k) {
  const a = { n: k.bg.trim() || "Custom", d: "Custom gear", w: "", wear: [], items: [], caps: Math.max(0, num(k.caps, 0)), extraW: [] };
  for (const [n, q] of k.items) {
    const it = E.get(ctx(), n);
    if (!it) continue;
    if (it.cat === "weapon" && !it.o.thrown) {
      if (!a.w) a.w = n;
      else a.extraW.push(n);
      if (q > 1) a.items.push([n, q - 1]);
    } else if (it.cat === "armor" && !a.wear.some((x) => (E.get(ctx(), x) || { o: {} }).o.loc === it.o.loc && it.o.loc !== "Accessory")) {
      a.wear.push(n);
      if (q > 1) a.items.push([n, q - 1]);
    } else a.items.push([n, q]);
  }
  return a;
}
const wizArchOf = (w) => (w.custom ? customArch(w.custom) : S.rules.archetypes[w.arch]);
function buildChar(w) {
  const a = wizArchOf(w);
  const c = {
    id: "c" + Date.now().toString(36) + S.seq++,
    name: w.name.trim() || a.n,
    background: a.n,
    spec: "",
    special: [...w.special],
    traits: [w.rolled, ...w.pick],
    tags: [...w.tags],
    inv: [],
    caps: a.caps || 0,
    weapons: [],
    gear: {},
  };
  for (const n of a.wear || []) {
    const it = E.get(ctx(), n);
    if (!it) continue;
    if (it.o.loc === "Accessory") {
      c.gear.acc = [...(c.gear.acc || []), it.o.n].slice(0, 3);
      continue;
    }
    const slot = /head/i.test(it.o.loc) ? "head" : it.o.loc === "Vanity" ? "vanity" : "armor";
    c.gear[slot] = it.o.n;
  }
  for (const [n, q] of a.items || []) addInv(c, n, q, true);
  const wp = E.get(ctx(), a.w);
  if (wp) {
    const slot = { n: wp.o.n, mag: 0 };
    if (a.ammo) {
      if (["SG", "BG"].includes(wp.o.tab)) slot.ammo = a.ammo[0];
      slot.mag = Math.min(wp.o.mag || 0, a.ammo[1]);
      if (a.ammo[1] > slot.mag) addInv(c, a.ammo[0], a.ammo[1] - slot.mag, true);
    }
    c.weapons.push(slot);
  }
  for (const n of a.extraW || []) {
    const it = E.get(ctx(), n);
    if (it) c.weapons.push({ n: it.o.n, mag: 0 });
  }
  c.weapons.push({ n: "Basic Fighting" });
  return initChar(c, ctx());
}
function wizCustom(w) {
  const k = w.custom;
  const a = customArch(k);
  const list = k.items
    .map(
      ([n, q], i) =>
        `<div class="irow">${itemIcon(n, true)}<span class="grow bright">${h(n)}</span><span class="s dim">x${q}</span><span class="s dim">${h(itemKind(n)[0])}</span><button class="btn tiny" data-a="wizKitDel" data-v="${i}" title="Remove">X</button></div>`,
    )
    .join("");
  return `<h3>Custom starting gear <span class="s dim">pick anything from the item lists</span></h3><div class="row wrap" style="margin-bottom:4px"><label class="f grow">Background<input id="wizBg" autocomplete="off" data-u="wiz.custom.bg" value="${h(k.bg)}" placeholder="e.g. Wasteland drifter"></label><label class="f" style="width:80px">Caps${numBox(`id="wizCaps" data-u="wiz.custom.caps"`, k.caps)}</label></div>
    <div class="row wrap"><input id="wizKitN" class="grow" autocomplete="off" list="dl-all" placeholder="Add an item: type a name, Enter" data-u="wiz.custom.n" value="${h(k.n)}" data-enter="wizKitAdd"><span style="width:44px">${numBox(`id="wizKitQ" data-u="wiz.custom.q" title="How many"`, k.q, "cell")}</span>${btn("wizKitAdd", "", "Add", "", "tiny")}</div>
    <div class="kitlist">${list || `<div class="dim">Nothing yet. The first weapon you add is the one in hand, armor is worn, and everything else goes in the pack.</div>`}</div>${k.items.length ? `<div class="s dim">Kit: ${h(kitText(a))}</div>` : ""}`;
}
function wizardBody() {
  const w = ui.wiz;
  const pool = S.rules.startPool;
  const used = w.special.reduce((t, x) => t + x, 0);
  const steps = `<div class="wizsteps">${WIZ_STEPS.map((n, i) => `<span class="${i === w.step ? "on" : i < w.step ? "done" : ""}">${i + 1} ${n}</span>`).join("")}</div>`;
  const nav = (next, label = "Next") =>
    `<div class="acts wiznav">${w.step > 0 ? btn("wizGo", w.step - 1, "Back") : ""}<span class="spacer"></span>${primary(next, next === "wizGo" ? w.step + 1 : "", label, "Enter")}</div>`;
  const trait = (code) => {
    const t = db.traitByCode.get(code);
    return t
      ? `<div class="txt"><span class="bright">${h(t.code)} ${h(t.n)}</span> <span class="s dim">${h(t.cat)}</span><br>+ ${h(t.ben)}<br>- ${h(t.draw)}</div>`
      : "";
  };
  if (w.step === 5)
    return `<div class="wizsteps"><span class="on">Party so far: ${S.chars.length}</span></div>${S.chars.map((c) => `<div class="line"><span class="bright grow">${h(c.name)}</span><span class="s dim">${h(c.background)}</span></div>`).join("")}<div class="acts wiznav">${btn("wizAnother", "", "Create another character")}<span class="spacer"></span>${primary("closeModal", "", "Start the campaign", "Enter")}</div>`;
  if (w.step === 0)
    return `${steps}<div class="row" style="margin-bottom:4px"><label class="f grow">Name<input id="wizName" autocomplete="off" data-u="wiz.name" value="${h(w.name)}" placeholder="Character name"></label></div><div class="ftabs"><button class="ftab ${w.custom ? "" : "on"}" data-a="wizMode" data-v="">Archetype</button><button class="ftab ${w.custom ? "on" : ""}" data-a="wizMode" data-v="1">Custom gear</button></div>${w.custom ? wizCustom(w) : `<h3>Archetype <span class="s dim">who they were, and what they carry</span></h3><div class="archgrid">${S.rules.archetypes.map((a, i) => `<button class="arch ${w.arch === i ? "on" : ""}" data-a="wizArch" data-v="${i}"><span class="bright">${h(a.n)}</span><span class="s">${h(a.d)}</span><span class="s dim">${h(kitText(a))}</span></button>`).join("")}</div>`}${nav("wizGo")}${S.chars.length ? "" : `<div class="s dim" style="margin-top:6px">Testing? ${btn("wizSample", "", "Load the workbook's sample party", "", "tiny")}</div>`}`;
  if (w.step === 1)
    return `${steps}<div class="geartop"><div class="bigdt"><b>${pool - used}</b><span>POINTS LEFT</span></div><div class="s dim">Everyone starts at ${S.rules.startSpecial} in each. The total can't go over ${pool}. Lower one to raise another. Each stat is 1 to 10.</div></div>${E.SPECIAL.map((k, i) => `<div class="line wizstat"><span class="grow">${E.SPECIAL_NAMES[k]}</span><button class="btn" data-a="wizStat" data-v="${i}|-1" aria-label="Lower ${E.SPECIAL_NAMES[k]}">-</button><b>${w.special[i]}</b><button class="btn" data-a="wizStat" data-v="${i}|1" aria-label="Raise ${E.SPECIAL_NAMES[k]}">+</button></div>`).join("")}${nav("wizGo")}`;
  if (w.step === 2) {
    const opts = (cur, other) =>
      `<option value="">Choose a trait</option>${options(
        DATA.traits.filter((t) => t.code !== w.rolled && t.code !== other).map((t) => [t.code, `${t.code} ${t.n}`]),
        cur,
      )}`;
    return `${steps}<h3>Rolled for you</h3>${trait(w.rolled)}<div style="margin:3px 0 6px">${w.rerolled ? `<span class="s dim">Reroll used.</span>` : btn("wizReroll", "", "Reroll (once only)", "", "tiny")}</div><h3>Pick two</h3><div class="grid wide"><label class="f">First<select id="wizP0" data-u="wiz.pick.0">${opts(w.pick[0], w.pick[1])}</select></label><label class="f">Second<select id="wizP1" data-u="wiz.pick.1">${opts(w.pick[1], w.pick[0])}</select></label></div>${trait(w.pick[0])}${trait(w.pick[1])}${nav("wizGo")}`;
  }
  const preview = E.derive(
    { kind: "pc", special: w.special, traits: [w.rolled, ...w.pick], tags: w.tags, gear: {}, inv: [], weapons: [], statuses: [], effects: [], level: 1 },
    ctx(),
  );
  if (w.step === 3)
    return `${steps}<h3>Tag three skills <span class="tag ${w.tags.length === 3 ? "" : "warn"}">${w.tags.length} OF 3</span></h3><div class="s dim" style="margin-bottom:4px">Tagged skills gain 2 per point you spend on them.</div><div class="archgrid tags">${E.SKILLS.map(([k, n]) => `<button class="arch ${w.tags.includes(k) ? "on" : ""}" data-a="wizTag" data-v="${k}"><span class="bright">${n}</span><span class="s dim">${preview.skills[k]}</span></button>`).join("")}</div>${nav("wizGo")}`;
  const a = wizArchOf(w);
  return `${steps}<h3>${h(w.name.trim() || a.n)} <span class="s dim">${h(a.n)}</span></h3><div class="geartop"><div class="bigdt"><b>${preview.hp}</b><span>HP</span></div><div class="bigdt"><b>${preview.ap}</b><span>AP</span></div><div class="grow s">${E.SPECIAL.map((k, i) => `${k} ${preview.sp[k]}`).join("  ")}<br><span class="dim">Tags: ${h(w.tags.map((k) => SKILL_NAME[k]).join(", "))}</span></div></div><h3>Starting kit</h3><div class="txt">${h(kitText(a))}</div><h3>Traits</h3>${trait(w.rolled)}${trait(w.pick[0])}${trait(w.pick[1])}${nav("wizAdd", "Add to party")}`;
}
function newcBody() {
  return `<div class="txt" style="margin-bottom:6px">This clears everything: the party, rules you changed, item edits, notes, the log and any fight. Then you build new characters. Do you want to save the current campaign first?</div><div class="acts">${primary("newStart", "save", "Save, then start new", "Enter")}${btn("newStart", "", "Start without saving", "", "danger")}${btn("closeModal", "", "Cancel")}</div>`;
}
function helpModal() {
  const g = [
    [
      "Everywhere",
      [
        ["Ctrl+Z / Ctrl+Y", "Undo, redo"],
        ["Ctrl+S", "Save"],
        ["/", "Search everything"],
        ["?", "This list"],
        ["Esc", "Close, or leave a field"],
        ["Enter", "Confirm"],
      ],
    ],
    [
      "Out of combat",
      [
        ["B", "Open encounter setup, then begin"],
        ["I", "Inventory of the selected character"],
        ["← →", "Pick a character"],
      ],
    ],
    [
      "On a turn",
      [
        ["A", "Attack: your last target, weapon and body part"],
        ["0-9, Enter", "Type the roll and resolve"],
        ["W", "Next weapon"],
        ["T", "Next target"],
        ["M", "Move"],
        ["R", "Reload"],
        ["I", "Use item"],
        ["N", "End turn"],
      ],
    ],
    [
      "Mouse on the map",
      [
        ["Drag", "Move the acting character. Costs AP"],
        ["Shift+drag", "Reposition anyone for free"],
        ["Click", "Select. On a turn, clicking an enemy attacks it"],
        ["Right-click", "Remove cover or a marker"],
      ],
    ],
  ];
  return `<div class="keys">${g.map(([t, rows]) => `<h3>${t}</h3>${rows.map(([k, l]) => `<div>${kbd(k)}${h(l)}</div>`).join("")}`).join("")}</div>`;
}
const SEARCH_LIST = () => [
  ...DATA.weapons.filter((o) => o.tier).map((o) => ["Weapon", o]),
  ...DATA.ammo.map((o) => ["Ammo", o]),
  ...DATA.armor.map((o) => ["Armor", o]),
  ...DATA.items.map((o) => ["Item", o]),
  ...DATA.materials.map((o) => ["Material", o]),
  ...DATA.mods.map((o) => ["Mod", o]),
  ...DATA.enemies.filter((o) => !o.test).map((o) => ["Enemy", o]),
  ...DATA.levelPerks.map((o) => ["Level perk", o]),
  ...DATA.skillPerks.map((o) => ["Skill perk", o]),
  ...DATA.traits.map((o) => ["Trait", o]),
  ...DATA.statuses.map((o) => ["Status", o]),
];
const BIBLE_Z = "/*BIBLETXT*/";
let bibleCache = null;
function bibleIdx() {
  if (bibleCache) return bibleCache;
  try {
    const bin = atob(BIBLE_Z);
    const raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
    bibleCache = JSON.parse(new TextDecoder().decode(inflate(raw))).map(([n, page, text]) => ({ n, page, text }));
  } catch (e) {
    bibleCache = []; // a build without the bible text (tests, or the PDF missing)
  }
  return bibleCache;
}
// Bible hits: every word of the search must appear in the chapter. A match in the chapter's title ranks first.
function bibleHits(q) {
  const words = E.low(q)
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (!words.length || E.low(q).length < 3) return [];
  return bibleIdx()
    .map((b) => {
      const t = E.low(b.text);
      if (!words.every((w) => t.includes(w) || E.low(b.n).includes(w))) return null;
      const at = t.indexOf(words[0]);
      const snip = at < 0 ? b.text.slice(0, 90) : (at > 40 ? "…" : "") + b.text.slice(Math.max(0, at - 40), at + 70) + "…";
      return ["Bible", { ...b, snip, score: (words.every((w) => E.low(b.n).includes(w)) ? 100 : 0) + words.reduce((s, w) => s + t.split(w).length - 1, 0) }];
    })
    .filter(Boolean)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 12);
}
const searchHits = (q) => (E.low(q) ? [...rankByName(SEARCH_LIST(), q, (x) => x[1].n).slice(0, 30), ...bibleHits(q)] : []);
function searchModal() {
  const m = ui.modal;
  const hits = searchHits(m.q);
  return `<input id="searchQ" autocomplete="off" style="width:100%" placeholder="Items, enemies, perks, traits, statuses, rules in the bible" data-u="modal.q" value="${h(m.q)}" data-enter="searchOpen"><div class="results" style="max-height:60vh">${hits.map(([c, o], i) => `<button class="rowbtn ${i === (m.i || 0) ? "on" : ""}" data-a="searchPick" data-v="${i}"><span class="tag">${c.toUpperCase()}</span><span class="grow">${h(o.n)}${c === "Bible" ? ` <span class="s dim">p.${h(o.page)} · ${h(o.snip)}</span>` : ""}</span></button>`).join("") || `<div class="dim" style="padding:4px">${m.q ? "No matches." : "Start typing. Up and down to move, Enter to open."}</div>`}</div>`;
}
function detailModal() {
  const m = ui.modal;
  const [c, o] = m.hit;
  const sel = ent(K() && ui.rowSel ? ui.rowSel : ui.sel);
  const acts = [];
  if (sel && sel.inv && ["Weapon", "Ammo", "Armor", "Item", "Material", "Mod"].includes(c))
    acts.push(primary("detailAdd", "inv", `Add to ${h(sel.name)}`, "Enter"));
  if (sel && sel.kind === "pc" && ["Level perk", "Skill perk"].includes(c)) acts.push(primary("detailAdd", "perk", `Give to ${h(sel.name)}`, "Enter"));
  if (sel && c === "Status") acts.push(primary("detailAdd", "status", `Give to ${h(sel.name)}`, "Enter"));
  if (c === "Enemy") acts.push(primary("detailAdd", K() ? "enemyNow" : "enemy", K() ? "Add to this fight" : "Add to encounter", "Enter"));
  const lines = Object.entries(o)
    .filter(([k]) => !["n", "ok"].includes(k))
    .map(
      ([k, v]) =>
        `<div class="s"><span class="dim">${h(k)}:</span> ${h(
          Array.isArray(v)
            ? v
                .filter((x) => x != null && x !== "")
                .map((x) =>
                  typeof x === "number" && k === "hit" ? E.pct(x) : Array.isArray(x) ? x.join(" x ") : x && typeof x === "object" ? JSON.stringify(x) : x,
                )
                .join(" | ")
            : typeof v === "object"
              ? JSON.stringify(v)
              : v,
        )}</div>`,
    )
    .join("");
  return `${termView(c, o, m.q, lines)}<div class="acts" style="margin-top:6px">${acts.join("")}${btn("search", m.q || "", "Back to search")}</div>`;
}
// A RobCo terminal: header, the query typed at a prompt, the entry's fields as dotted rows (or a bible chapter's text with the
// search words lit up), and a blinking cursor. Same data as before, only drawn as a terminal screen.
const TERM_KEYS = {
  lb: "Weight (lb)",
  val: "Value (caps)",
  cat: "Category",
  ap: "AP",
  dmg: "Damage",
  pen: "Pen",
  req: "Skill needed",
  hit: "Hit by range",
  mag: "Magazine",
  ammo: "Ammo",
  tab: "Type",
  type: "Kind",
  tier: "Tier",
  effect: "Effect",
  dt: "DT",
  loc: "Worn on",
  crit: "Crit chance",
  jam: "Jam chance",
  reload: "Reload AP",
  count: "Burst",
  str: "STR needed",
  skill: "Skill",
  hp: "HP",
  xp: "XP",
  caps: "Caps",
  faction: "Faction",
  group: "Group",
  dur: "Duration",
  uses: "Uses",
  mob: "Creature",
  pri: "Initiative",
};
const TERM_SKIP = new Set([
  "use",
  "useFrom",
  "fx",
  "fxFrom",
  "req0",
  "unique",
  "rows",
  "when",
  "ok",
  "tiers",
  "special",
  "skills",
  "w1",
  "w2",
  "capsRange",
  "src",
]);
function termView(c, o, q, lines) {
  const words = E.low(q || "")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const lit = (s) => (words.length ? h(s).replace(new RegExp(`(${words.join("|")})`, "gi"), "<mark>$1</mark>") : h(s));
  let body;
  if (c === "Bible") {
    let first = true;
    body = `<div class="termtext">${lit(o.text).replace(/<mark>/, () => (first ? ((first = false), '<mark id="termhit">') : "<mark>"))}</div>`;
    ui.termScroll = true;
  } else
    body = lines.replace(/<div class="s"><span class="dim">([^<]*):<\/span>\s*([\s\S]*?)<\/div>/g, (_, k, v) => {
      const key = k.trim();
      if (TERM_SKIP.has(key) || /^[\[{]/.test(v.trim())) return ""; // internal fields and raw data stay out of the readout
      return `<div class="termrow"><span class="k">${(TERM_KEYS[key] || key).toUpperCase()}</span><span class="dots"></span><span class="v">${v}</span></div>`;
    });
  return `<div class="robco"><div class="termhd">ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL<br>${c === "Bible" ? `GAME BIBLE // PAGE ${h(o.page)}` : `DATABASE // ${h(c.toUpperCase())}`}</div><div class="termln">&gt; ${q ? `QUERY "${h(q)}"` : "OPEN"}<br>&gt; ENTRY: ${h(String(o.n).toUpperCase())}</div>${body}<div class="termln">&gt; <span class="termcur">&#9608;</span></div></div>`;
}
