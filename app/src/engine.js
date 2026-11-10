// Game math only: no DOM, no saved state. Tested in app/tests against the workbook's own results.
const E = (() => {
  const SPECIAL = ["S", "P", "E", "C", "I", "A", "L"];
  const SPECIAL_NAMES = { S: "Strength", P: "Perception", E: "Endurance", C: "Charisma", I: "Intelligence", A: "Agility", L: "Luck" };
  const SKILLS = [["BAR", "Barter", "C", "I"], ["EW", "Energy Weapons", "P", "I"], ["EXP", "Explosives", "I", "A"], ["SG", "Small Guns", "P", "A"], ["BG", "Big Guns", "P", "S"], ["LPK", "Lockpick", "A", "I"], ["MED", "Medicine", "E", "I"],
    ["MW", "Melee Weapons", "S", "E"], ["REP", "Repair", "I", "P"], ["SCI", "Science", "I", "L"], ["SNK", "Sneak", "A", "L"], ["SPE", "Speech", "C", "L"], ["SUR", "Survival", "E", "L"]];
  const ACTIVE_NAMES = ["Encumbered I", "Encumbered II", "Encumbered III", "Encumbered IV", "Encumbered V"];
  const TOTAL_NAMES = ["Overencumbered I", "Overencumbered II", "Overencumbered III", "Immobilized"];
  const low = (s) => String(s || "").trim().toLowerCase();
  const fix = (x) => Math.round(x * 1e6) / 1e6;

  function makeDb(data) {
    const idx = new Map();
    for (const [cat, list] of [["weapon", data.weapons], ["ammo", data.ammo], ["armor", data.armor], ["item", data.items], ["material", data.materials], ["mod", data.mods]])
      for (const o of list) if (!idx.has(low(o.n))) idx.set(low(o.n), { cat, o });
    const sc = new Map();
    for (const r of data.sc) { const k = low(r.n); if (!sc.has(k)) sc.set(k, []); sc.get(k).push(r); }
    const traitByCode = new Map(data.traits.map((t) => [t.code, t]));
    const situations = data.sc.filter((r) => r.cat === "Situation" && r.sub);
    const levelPerkFx = new Map(data.levelPerks.filter((p) => p.rows).map((p) => [low(p.n), p]));
    return { data, idx, sc, traitByCode, situations, levelPerkFx, status: new Map(data.statuses.map((s) => [low(s.n), s])), enemies: new Map(data.enemies.map((e) => [low(e.n), e])) };
  }

  /** Item by name, with the DM's saved edits on top. */
  function get(ctx, name) {
    const hit = ctx.db.idx.get(low(name));
    const ov = ctx.ov && ctx.ov[low(name)];
    if (!hit) return ov ? { cat: "custom", o: { n: name, ...ov } } : null;
    return ov ? { cat: hit.cat, o: { ...hit.o, ...ov } } : hit;
  }
  const weightOf = (ctx, name) => { const t = ctx.rules && ctx.rules.throwables && ctx.rules.throwables[name]; if (t && t.lb != null) return t.lb; const h = get(ctx, name); return (h && h.o.lb) || 0; };
  /** Damage a blast does at this many meters: dmg[0] within 1m, dmg[1] within 2m, and so on out to the radius. */
  const blastDamage = (t, d) => (d > t.radius + 1e-9 ? 0 : t.dmg[Math.min(t.dmg.length - 1, Math.max(0, Math.ceil(d - 1e-9) - 1))] || 0);

  // ---- reading numbers out of status and item text
  function parseEffect(text, positive = true) {
    const m = {}; let t = String(text || "");
    const add = (k, v) => { m[k] = fix((m[k] || 0) + v); };
    t = t.replace(/x\s?(\d+(?:\.\d+)?)\s*AP\b/gi, (_, x) => { add("apMul", Number(x) - 1); return ""; });  // "x1.5 AP" multiplies, it isn't +5 AP
    t = t.replace(/\b(\d+)-\s?(?=STR|PER|END|CHA|INT|AGI|AGL|LCK|Luck)/g, "-$1 ");  // "1- INT" means -1 INT
    const stat = /([+-]?)\s?(\d+)(\+?)\s*(STR|PER|END|CHA|INT|AGI|AGL|LCK|Luck|S\.P\.E\.C\.I\.A\.L|AP|DT|Initiative)\b(?!\s*(?:cost|to movement|to focus|for movement|for reload|per|to))/g;
    const keys = { STR: "S", PER: "P", END: "E", CHA: "C", INT: "I", AGI: "A", AGL: "A", LCK: "L", Luck: "L", AP: "ap", DT: "dt", Initiative: "pri" };
    for (const [, sign, num, , word] of t.matchAll(stat)) {
      if (sign !== "-" && !positive) continue;
      const v = (sign === "-" ? -1 : 1) * Number(num);
      if (word === "S.P.E.C.I.A.L") SPECIAL.forEach((k) => add(k, v)); else add(keys[word], v);
    }
    for (const [, sign, num] of t.matchAll(/([+-]?)\s?(\d+)%?\+?\s*(?:acc\b|Hit Chance|chance to hit)/gi)) if (sign === "-" || positive) add("acc", (sign === "-" ? -1 : 1) * Number(num) / 100);
    for (const [, sign, num] of t.matchAll(/([+-]?)\s?(\d+)%\+?\s*Damage\b(?!\s*Taken)/g)) if (sign === "-" || positive) add("dam", (sign === "-" ? -1 : 1) * Number(num) / 100);
    for (const [, num] of t.matchAll(/(\d+)\+?\s*Max HP/g)) add("hp", Number(num));
    // Crit: "+5% Crit Chance" raises crit chance. Stored as a fraction, so 5% is 0.05.
    for (const [, sign, num] of t.matchAll(/([+-]?)\s?(\d+)%\+?\s*Crit/gi)) if (sign === "-" || positive) add("crit", (sign === "-" ? -1 : 1) * Number(num) / 100);
    // Max health percent: "-10% max health", or "+10% HP" with a sign. A plain "25% HP" is a heal, so it doesn't count here.
    for (const [, sign, num] of t.matchAll(/([+-]?)\s?(\d+)%\+?\s*max health/gi)) if (sign === "-" || positive) add("hpPct", (sign === "-" ? -1 : 1) * Number(num) / 100);
    for (const [, sign, num] of t.matchAll(/([+-])\s?(\d+)%\s*HP\b/g)) if (sign === "-" || positive) add("hpPct", (sign === "-" ? -1 : 1) * Number(num) / 100);
    // Healing received: "-25% healing" makes every heal on this character 25% weaker.
    for (const [, num] of t.matchAll(/-\s?(\d+)%\s*healing/gi)) add("heal", -Number(num) / 100);
    // DT percent: "-10% DT" shaves a share off total Damage Threshold.
    for (const [, num] of t.matchAll(/-\s?(\d+)%\s*DT\b/g)) add("dtPct", -Number(num) / 100);
    // Damage taken: "-5% Damage Taken" makes hits on this character weaker.
    for (const [, sign, num] of t.matchAll(/([+-]?)\s?(\d+)%\s*Damage Taken/gi)) add("dmgTaken", (sign === "-" ? -1 : 1) * Number(num) / 100);
    // Healing per turn: "+2 HP per turn" adds HP at the end of every round.
    for (const [, num] of t.matchAll(/\+(\d+) HP per turn/gi)) add("regen", Number(num));
    // Walking: "-25% mvm" or "-20% movement" makes moving cost more AP. "no movement" or "Immobile" stops it.
    for (const [, num] of t.matchAll(/-\s?(\d+)%\s*(?:mvm|movement)/gi)) add("mvm", -Number(num) / 100);
    if (/no movement|immobile/i.test(t)) m.immobile = 1;
    // Action cost: "+2 AP cost" or "+1 AP to movement, attack, and items" makes attacks cost more AP.
    for (const [, num] of t.matchAll(/\+(\d+) AP (?:cost|to movement)/gi)) add("apCost", Number(num));
    // XP: "x1.5 xp" multiplies XP earned.
    for (const [, x] of t.matchAll(/x(\d+(?:\.\d+)?) xp/gi)) add("xpMul", Number(x) - 1);
    // Status resistance: stored and shown. The DM still decides what resisting means, since the sheet doesn't say.
    for (const [, n, kind] of t.matchAll(/([+-]?\d+) (Mental|Physical) (?:Eff|Status)/gi)) if (Number(n) < 0 || positive) add(kind.toLowerCase() === "mental" ? "resistMental" : "resistPhysical", Number(n));
    // "Crit Chance +5%" written the other way round, as on books.
    for (const [, n] of t.matchAll(/Crit Chance \+(\d+)%/gi)) add("crit", Number(n) / 100);
    // "1 PRI" is initiative. "ignore Tier 3 adverse effects" switches off harmful statuses up to that tier.
    for (const [, n] of t.matchAll(/(\d+) PRI\b/g)) add("pri", Number(n));
    const ig = t.match(/ignore Tier (\d)/i); if (ig) m.ignoreTier = Number(ig[1]);
    const healUp = t.match(/Healing \+(\d+)%/i); if (healUp) add("heal", Number(healUp[1]) / 100);
    const dmg = t.match(/(\d+) dmg/); if (dmg) m.dot = Number(dmg[1]);
    const turns = t.match(/(\d+) turns?\b/i); if (turns) m.turns = Number(turns[1]);
    return m;
  }
  function parseHeal(text) {
    const t = String(text || "");
    const pct = t.match(/(\d+)%\s*(?:HP|health)/); if (pct) return { pct: Number(pct[1]) / 100 };
    const flat = t.match(/(-\s?)?(\d+)\s*\+?\s*HP/); if (!flat) return null;
    const out = { flat: (flat[1] ? -1 : 1) * Number(flat[2]) };
    const sk = t.match(/\(\s*(Medicine|Survival)\s*\/\s*(\d+)\s*\)/i); if (sk) { out.skill = sk[1].toLowerCase() === "medicine" ? "MED" : "SUR"; out.div = Number(sk[2]); }
    if (/HP\s*\+\s*END\b/i.test(t)) out.end = true;
    return out;
  }
  /** HP from an item's text: skill bonuses use the healer, END and percents use the patient. */
  function healAmount(text, user, target) {
    const h = parseHeal(text); if (!h) return 0;
    const eff = 1 + ((target.m && target.m.heal) || 0);  // Burns and similar make heals weaker on this patient
    if (h.pct) return Math.round(target.hp * h.pct * eff);
    const raw = h.flat + (h.skill ? Math.floor((user.skills[h.skill] || 0) / h.div) : 0) + (h.end ? target.sp.E || 0 : 0);
    return raw > 0 ? Math.round(raw * eff) : raw;
  }
  // Armor text such as "10+ Big Guns, +10 Explosives, 1+ END" or "AGL - 2".
  function parseGear(text) {
    const m = {}; const t = String(text || "").replace(/:/g, "");
    const names = [...SKILLS.map(([k, n]) => [n, k]), ["Melee", "MW"], ["STR", "S"], ["PER", "P"], ["END", "E"], ["CHA", "C"], ["INT", "I"], ["AGI", "A"], ["AGL", "A"], ["LCK", "L"], ["Luck", "L"]];
    for (const [word, key] of names) {
      const re = new RegExp(`(?:\\b(\\d+)\\+\\s*|([+-])\\s*(\\d+)\\s+)${word}\\b|\\b${word}\\s*([+-])\\s*(\\d+)`, "gi");
      for (const x of t.matchAll(re)) {
        const v = x[1] ? Number(x[1]) : x[3] ? Number(x[2] + x[3]) : Number(x[4] + x[5]);
        m[key] = (m[key] || 0) + v;
      }
    }
    return m;
  }
  function statusInfo(ctx, st) {
    const base = ctx.db.status.get(low(st.n));
    const edited = ctx.ov && ctx.ov["status:" + low(st.n)];
    const s = base && edited ? { ...base, ...edited } : base;
    const text = (s && s.tiers && (s.tiers[(st.tier || 1) - 1] || s.tiers.find(Boolean))) || "";
    // A status from a drink or drug carries that item's exact numbers. Otherwise use the tier's numbers from the status table.
    const mods = st.fx || (s && s.fx && s.fx[(st.tier || 1) - 1]) || parseEffect(text, !s || s.tone !== "Negative");
    return { text: st.text || text, mods, def: s };
  }

  // ---- modifiers (Stat Converter), same live columns as the sheet
  function activeRows(e, ctx) {
    const { db, scene } = ctx; const rows = [];
    const add = (name, only) => { for (const r of db.sc.get(low(name)) || []) if (!only || only.includes(r.cat)) rows.push(r); };
    if (e.kind === "pc") {
      for (const code of e.traits || []) {
        const t = db.traitByCode.get(code); if (!t) continue;
        add(t.n);
        for (const x of t.rows || []) rows.push({ n: t.n, cat: "Trait", mods: x.fx, when: x.when });
        const st = (e.evolved || {})[code];
        if (st === "E" && t.evo) add(t.evo);
        if (st === "R" && t.rep) add(t.rep);
      }
      for (const v of e.variants || []) add(v);
      for (const p of e.perks || []) { add(p, ["Skill Perk"]); const lp = db.levelPerkFx && db.levelPerkFx.get(low(p)); if (lp) for (const x of lp.rows || []) rows.push({ n: p, cat: "Level Perk", mods: x.fx, when: x.when }); }
      for (const a of (e.gear && e.gear.acc) || []) add(a, ["Accessory", "Weapon Mod"]);
      for (const n of [e.gear && e.gear.head, e.gear && e.gear.armor, e.gear && e.gear.vanity]) {
        const it = n && get(ctx, n); if (!it) continue;
        const mods = it.o.fx || parseGear(`${it.o.buffs || ""}, ${it.o.nerfs || ""}`);
        if (Object.keys(mods).length) rows.push({ n: it.o.n, cat: "Gear", mods });
      }
      for (const l of e.inv || []) if (l.active) add(l.n, ["Accessory", "Weapon Mod"]);
      if (scene) for (const k of ["time", "weather", "env"]) add(scene[k], ["Situation"]);
    }
    return rows;
  }
  function encumbrance(e, ctx, carry, m = {}) {
    const r = ctx.rules; let total = (e.caps || 0) * 0.001, active = 0;
    if (m.capsNoWeight) total = 0;  /* Money Dispenser Harness */
    for (const l of e.inv || []) { const it = get(ctx, l.n); const one = weightOf(ctx, l.n) * (it && it.cat === "ammo" ? 1 + (m.ammoWeight || 0) : 1); const w = (m.lightHalf && one <= 2 ? one / 2 : one) * (l.q || 0); /* Pack Rat: light things weigh half */ total += w; if (l.active) active += w; }
    const g = e.gear || {};
    for (const n of [g.head, g.armor, g.vanity, ...(g.acc || []), ...(e.weapons || []).map((w) => w.n)]) { const w = weightOf(ctx, n); total += w; active += w; }
    const capA = carry * r.activePct;
    const iA = r.activeTiers.filter((t) => capA > 0 && active / capA >= t).length;
    const iT = r.totalTiers.filter((t) => carry > 0 && total / carry >= t).length;
    return { total: fix(total), active: fix(active), capActive: fix(capA), activeTier: iA ? ACTIVE_NAMES[iA - 1] : "", totalTier: iT ? TOTAL_NAMES[iT - 1] : "" };
  }

  // true or false if a condition depends only on this person. null means it has to wait for a particular shot.
  const SELF_KEYS = ["ooc", "combat", "sober", "hasStatus", "hasEffect", "night", "indoors", "chemsMin"];
  function selfHolds(w, e, ctx) {
    const keys = Object.keys(w); if (!keys.length || !keys.every((k) => SELF_KEYS.includes(k))) return null;
    const statuses = e.statuses || []; const chems = statuses.filter((x) => x.from).length;
    if (w.ooc && ctx.combat) return false;
    if (w.combat && !ctx.combat) return false;
    if (w.sober && chems) return false;
    if (w.hasStatus && !statuses.some((x) => w.hasStatus.includes(x.n))) return false;
    if (w.hasEffect && !(e.effects || []).some((x) => x.label === w.hasEffect)) return false;
    if (w.night && !/night|dark/i.test((ctx.scene && ctx.scene.time) || "")) return false;
    if (w.indoors && !ctx.rules.indoorMaps.includes((ctx.scene && ctx.scene.map && ctx.scene.map.id) || "")) return false;
    if (w.chemsMin && chems < w.chemsMin) return false;
    return true;
  }
  /** Everything derived about a person or creature right now. */
  function derive(e, ctx) {
    const r = ctx.rules; const m = {}; const notes = []; const sources = []; const d0cond = [];
    const bump = (mods) => { for (const k in mods) if (typeof mods[k] === "number" && k !== "turns" && k !== "dot") m[k] = fix((m[k] || 0) + mods[k]); };
    const rowsNow = activeRows(e, ctx);
    d0cond.length = 0;
    // Night penalties: Electronic Shades halve them, scopes remove them. The lowest number wins.
    const nightFactor = Math.min(1, ...rowsNow.filter((x) => x.mods && x.mods.nightPen != null).map((x) => x.mods.nightPen));
    // Heritable and similar: every trait's numbers count for more.
    const traitScale = 1 + rowsNow.reduce((t, x) => t + ((x.mods && x.mods.traitScale) || 0), 0);
    for (const row of rowsNow) {
      // A rule with a condition isn't always on. It waits in the list below and gets checked when it matters.
      if (nightFactor < 1 && row.cat === "Situation" && /night|dark/i.test(row.n)) { const soft = {}; for (const [k, v] of Object.entries(row.mods || {})) soft[k] = typeof v === "number" && v < 0 ? fix(v * nightFactor) : v; bump(soft); sources.push(row); continue; }
      // Conditions about the character's own state, not a particular shot, are settled right here.
      if (row.when && r.conditions !== false && selfHolds(row.when, e, ctx) === false) continue;
      if (row.when && r.conditions !== false && selfHolds(row.when, e, ctx) === true) { if (row.mods) bump(row.mods); sources.push(row); continue; }
      if (row.when && r.conditions !== false) { d0cond.push(row); if (row.note) notes.push(`${row.n}: ${row.note}`); sources.push(row); continue; }
      if (row.sheetMods && r.conditions === false) { bump(row.sheetMods); sources.push(row); continue; }
      if (row.mods) bump(traitScale !== 1 && /^Trait/.test(row.cat || "") ? Object.fromEntries(Object.entries(row.mods).map(([k, v]) => [k, typeof v === "number" ? fix(v * traitScale) : v])) : row.mods);
      if (row.mods || row.note) sources.push(row);
      if (row.note) notes.push(`${row.n}: ${row.note}`);
    }
    // Sedated and similar switch off harmful statuses up to a tier. Numbing Salve switches off everything but bleeding for a while.
    const ignore = Math.max(0, ...(e.statuses || []).map((st) => statusInfo(ctx, st).mods.ignoreTier || 0));
    for (const st of e.statuses || []) {
      const i = statusInfo(ctx, st);
      if (e.numbed > 0 && st.n !== "Bleeding") continue;
      if (i.def && i.def.tone === "Negative" && (st.tier || 1) <= ignore) continue;
      bump(i.mods);
    }
    for (const fx of e.effects || []) bump(fx.mods || {});
    const ov = e.ov || {};
    const sp = {};
    SPECIAL.forEach((k, i) => { const b = e.special[i]; sp[k] = b == null || b === "" ? null : Math.max(1, Number(b) + (m[k] || 0)); });
    const skills = {};
    for (const [k, , a, b] of SKILLS) {
      const given = e.skills && e.skills[k];
      const formula = sp[a] != null && sp[b] != null ? Math.floor((sp[a] * 3 + sp[b]) / 2) : 0;
      const spent = ((e.spent || {})[k] || 0) * ((e.tags || []).includes(k) ? 2 : 1);
      skills[k] = (given != null && given !== "" ? Number(given) : formula) + (m[k] || 0) + spent;
    }
    if (m.setC != null && sp.C != null) sp.C = m.setC;  // Ogrish: Charisma is fixed
    const d = { sp, skills, m, notes, sources, cond: d0cond, level: e.level || 1 };
    const S = sp.S || 0, P = sp.P || 0, En = sp.E || 0, A = sp.A || 0, L = sp.L || 0;
    d.carry = fix((25 + (S + En / 4) * 25 + (m.carry || 0)) * (1 + (m.carryMul || 0)));
    d.enc = encumbrance(e, ctx, d.carry, m);
    if (e.mob) {
      d.hp = Math.floor(((e.baseHp || 0) + (m.hp || 0)) * (e.hpMult || 1));
      d.ap = Math.floor((e.baseAp || 0) + (m.ap || 0));
      d.pri = (e.basePri || 0) + (m.pri || 0);
      d.dt = (e.baseDt || 0) + (m.dt || 0);
      d.save = 0;
    } else {
      const lvlHp = e.kind === "pc" ? (d.level - 1) * (r.pcHpPerLevel != null ? r.pcHpPerLevel : 1) : ((e.tier || 1) - 1) * (r.npcHpPerTier != null ? r.npcHpPerTier : 6);
      d.hp = Math.floor((15 + En * 2 + lvlHp + (m.hp || 0)) * (m.hpMul ? m.hpMul : 1) * (1 + (m.hpPct || 0)) * (e.hpMult || 1) * (e.kind === "pc" ? r.pcHpMul || 1 : 1) + 1e-9);
      if (e.kind === "pc") for (const name of [d.enc.activeTier, d.enc.totalTier]) if (name) for (const row of ctx.db.sc.get(low(name)) || []) if (row.mods) bump(row.mods);
      d.ap = Math.max(0, Math.floor((5 + A + (m.ap || 0)) * (1 + (m.apMul || 0))));
      d.pri = (A + P) / 2 + (m.pri || 0);
      const g = e.gear || {};
      const pieces = e.kind === "pc" ? [g.head, g.armor, ...(g.acc || [])] : [g.head, g.armor, g.vanity];
      d.dt = pieces.reduce((t, n) => { const h = get(ctx, n); return t + ((h && h.o.dt) || 0); }, 0) + (m.dt || 0);
      d.dt = fix(d.dt * (1 + (m.dtPct || 0)));  // Plasma Melt and similar remove a share of DT
      d.save = saveTarget(L, skills.SUR, m.save || 0, e.timesRevived || 0, r);
    }
    d.pts = 10 + Math.floor((sp.I || 0) / 2) + (m.pts || 0);
    d.buy = skills.BAR > 0 ? 100 / skills.BAR : 0;
    d.sell = skills.BAR / 100;
    for (const k of ["hp", "ap", "dt", "pri", "save"]) if (ov[k] != null && ov[k] !== "") d[k] = Number(ov[k]);
    // Rules that depend only on how hurt you are. Checked last because they need max HP.
    for (const row of d0cond) if (Object.keys(row.when).every((k) => k === "hpBelow" || k === "hpAbove") && e.hp != null && (row.when.hpBelow == null || e.hp < d.hp * row.when.hpBelow) && (row.when.hpAbove == null || e.hp > d.hp * row.when.hpAbove)) for (const k in row.mods) { if (k === "ap" || k === "dt" || k === "pri" || k === "hp") d[k] += row.mods[k]; else m[k] = fix((m[k] || 0) + row.mods[k]); }
    if (m.saveMul) d.save = Math.round(d.save * (1 + m.saveMul));  // Last Stand doubles the odds
    if (m.speechCap != null) skills.SPE = Math.min(skills.SPE, m.speechCap);
    d.superCrit = e.superCrit != null && e.superCrit !== "" ? Number(e.superCrit) : r.superDefault;
    return d;
  }

  /** Roll at or under this on a d20. Times Revived costs a share of the die. */
  function saveTarget(lck, survival, mod, revived, r) {
    const raw = Math.floor((lck * 0.1 + (survival / 2 / 100) / 2) * 20 + 1e-9) - 1;
    return Math.min(raw, r.saveCap) + mod - revived * r.revivePenalty;
  }

  // ---- weapons
  function weaponView(slot, e, d, ctx, mode = "pr") {
    const h = slot && get(ctx, slot.n);
    if (!h || (h.cat !== "weapon" && h.cat !== "custom")) return { n: slot ? slot.n : "No weapon", missing: true, ok: false, tab: "MW", melee: true, skill: "MW", base: 0, pen: 0, ap: 0, crit: 0, jam: 0, str: 0, req: 0, count: 1, usesAmmo: false, clearJam: 0, hitBase: () => null };
    const w = h.o;
    const v = { n: w.n, tab: w.tab, type: w.type, skill: w.skill || "MW", crit: (w.crit || 0) + (d.m.crit || 0), jam: w.jam || 0, str: w.str || 0, req: w.req || 0, ok: !!w.ok, status: w.status, note: w.note, thrown: !!w.thrown, radius: w.radius, melee: w.tab === "MW" };
    const dm = (1 + (d.m.dam || 0)) * (e.dmgMult || 1);
    if (v.melee) {
      const se = mode === "se" && w.dmg2 != null;
      v.mode = se ? "se" : "pr"; v.modeName = se ? w.seName : w.prName; v.hasSecondary = w.dmg2 != null;
      v.base = (se ? w.dmg2 : w.dmg) || 0; v.pen = (se ? w.pen2 : w.pen) || 0; v.ap = (se ? w.ap2 : w.ap) || 0;
      const r = ctx.rules, natural = !w.tier, punch = !natural && /^hand$/i.test(w.type || "");
      // Heavy two-handed melee (base AP heavyMeleeAP or more, not fists) starts lower; skill carries it past light weapons later.
      v.heavy = !natural && !punch && r.heavyMeleeAP != null && (w.ap || 0) >= r.heavyMeleeAP;
      const lightBase = r.meleeBase != null ? r.meleeBase : 0.45;
      const rowBase = w.base != null && w.base !== 0.45 ? w.base : null;  // 0.45 is the sheet's blanket default, so it follows the rules
      v.hitBase = () => (rowBase != null ? rowBase : v.heavy && r.meleeHeavyBase != null ? r.meleeHeavyBase : lightBase);
      if (punch && r.punchAP != null) { v.punch = true; v.ap = r.punchAP + (e.punches || 0) * (r.punchStep != null ? r.punchStep : 1); }  // 1 AP, then 2, 3... in the same turn
      else if (!natural && r.meleeApMul) v.ap = Math.ceil(v.ap * r.meleeApMul - 1e-9);
      if (natural && e.mob && r.creaturePen) v.pen += r.creaturePen * (e.tier || 1);
      v.base = (v.base || 0) + (d.m.damFlat && se ? d.m.damFlat : 0);
      v.count = 1; v.usesAmmo = false;
    } else {
      v.ap = Math.max(0, (w.ap || 0) + (d.m.apCost || 0));
      v.reload = Math.floor(Math.max(0, (w.reload || 0) + (d.m.reload || 0)) * (1 + (d.m.reloadMul || 0)));
      v.count = (w.count || 1) + (d.m.count || 0); v.cap = Math.floor(((w.mag || 0) + (d.m.magAdd || 0)) * (1 + (d.m.magPct || 0))); v.perShot = w.perShot || 1;
      if (v.count > 1 && !w.thrown && ctx.rules.burstAP) v.ap += ctx.rules.burstAP;
      v.hitBase = (rng) => (w.hit || [])[rng - 1];
      v.reserve = w.ammo;
      v.usesAmmo = !v.thrown && !!w.ammo && w.ammo !== "N/A" && v.cap > 0;
      if (w.tab === "SG" || w.tab === "BG") {
        const a = slot.ammo && get(ctx, slot.ammo);
        v.reserve = slot.ammo; v.caliber = w.ammo; v.load = slot.ammo;
        if (a) { v.base = a.o.dam; v.pen = a.o.pen; v.pellets = a.o.pellets; v.ammoNote = a.o.note; if (a.o.ok !== true) v.ok = false; } else { v.base = 0; v.pen = 0; v.noLoad = true; }
      } else { v.base = w.dmg || 0; v.pen = w.pen || 0; }
    }
    v.clearJam = (ctx.rules.clearJam[v.type] != null ? ctx.rules.clearJam[v.type] : ctx.rules.clearJamDefault);
    if (d.m.apCostMul) v.ap = Math.max(1, Math.round(v.ap * d.m.apCostMul));  // "AP Cost / 0.5" on a perk or mod
    v.jam = Math.max(0, v.jam + (d.m.jam || 0));
    v.base = fix((v.base || 0) * dm);
    v.pen = (v.pen || 0) + (d.m.pen || 0);
    v.clearJam = Math.max(0, v.clearJam + (d.m.clearJamAdd || 0));  // Quick Repair Harness
    return v;
  }
  const loadsFor = (ctx, caliber) => ctx.db.data.ammo.filter((a) => low(a.cal) === low(caliber));

  // ---- hit chance
  function hitChance(att, A, target, T, v, range, ctx, cover) {
    const r = ctx.rules; const rng = Math.min(10, Math.max(1, range || 1)); const parts = [];
    const skill = Math.min(A.skills[v.skill] || 0, r.overskillCap);
    const base = v.melee ? v.hitBase() : v.hitBase(rng);
    if (base == null) return { hit: 0, raw: 0, parts: ["no hit data at this range"], noData: true, range: rng };
    parts.push(["base", base]);
    const mul = r.skillHitMul != null ? r.skillHitMul : 1, sk = ((skill - v.req) / 2) * mul;
    parts.push(["skill", (mul === 1 ? sk : Math.floor(sk + 1e-9)) / 100]);
    if (!v.melee && !v.thrown && r.gunHitAdd) parts.push(["gun", r.gunHitAdd]);
    if (r.perPenalty && !v.melee && A.sp.P != null && A.sp.P < rng) parts.push(["PER", -(rng - A.sp.P) * r.perPenalty]);
    if ((v.melee || v.thrown ? r.strMelee : r.strGun) && A.sp.S != null && A.sp.S < v.str) parts.push(["STR", -(v.str - A.sp.S) * v.str * (v.melee || v.thrown ? r.strMelee : r.strGun)]);
    let mods = A.m.acc || 0;
    if (att.kind === "pc") mods += A.m["r" + (v.melee ? 1 : rng)] || 0;
    if (att.kind !== "pc" && target && target.kind === "pc") mods += T.m.enemyAcc || 0;
    for (const fx of (ctx.scene && ctx.scene.effects) || []) {
      if (!fx.hit) continue;
      const side = att.kind === "pc" || att.ally ? "party" : "enemies";
      if (fx.who === "all" || fx.who === side || fx.who === att.id) mods += fx.hit;
    }
    if (mods) parts.push(["mods", mods]);
    // Cover: the tier the aiming line crosses. "open" adds nothing.
    if (cover && cover.hit) parts.push([`cover ${cover.tier}`, cover.hit]);
    const raw = fix(parts.reduce((t, [, x]) => t + x, 0));
    return { hit: Math.min(raw, r.maxHit), raw, parts, range: rng, capped: raw > r.maxHit };
  }
  const pct = (x) => fix(x * 100);
  const sgn = (x) => (x >= 0 ? "+" : "−") + Math.abs(pct(x));
  const hitLine = (hc) => (hc.noData ? hc.parts[0] : `${pct(hc.hit)}% = ` + hc.parts.map(([k, x], i) => (i === 0 ? `${k} ${pct(x)}` : `${k} ${sgn(x)}`)).join(", ") + (hc.capped ? ` (capped from ${pct(hc.raw)})` : ""));

  // ---- attack roll bands. Numbers are percent thresholds on the 00-99 roll.
  function bands(hit, jam, crit, superCrit, opts = {}) {
    const r = opts.rules || {};
    let jamAt = jam * 100, critAt = 100 - crit * 100;
    if (r.jamMode === "sheet") jamAt = Math.min(99, jam * (10 / opts.lck) * 100 - 1 + (10 - (opts.cond != null ? opts.cond : 10))) + 1;
    if (r.critMode === "sheet") critAt = 99 - crit * (opts.lck / 5) * hit * 100;
    return { jamAt: fix(jamAt), hitAt: fix(100 - hit * 100), critAt: fix(critAt), superAt: fix(100 - superCrit * 100) };
  }
  function classify(roll, b) {
    if (roll < b.jamAt) return "jam";
    if (roll < b.hitAt) return "miss";
    if (roll >= b.superAt) return "super";
    if (roll >= b.critAt) return "crit";
    return "hit";
  }
  /** Whole-number ranges for reading aloud, e.g. Jam 00-12 · Miss 13-29 · Hit 30-79 · Crit 80-97 · Super 98-99 */
  function bandSpans(b) {
    const c = (x) => Math.min(100, Math.max(0, Math.ceil(x - 1e-9)));
    const j = c(b.jamAt), h = Math.max(j, c(b.hitAt)), s = Math.max(h, c(b.superAt)), k = Math.min(s, Math.max(h, c(b.critAt)));
    const out = [];
    const push = (id, label, a, z) => { if (z >= a) out.push({ id, label, from: a, to: z }); };
    push("jam", "Jam", 0, j - 1); push("miss", "Miss", j, h - 1); push("hit", "Hit", h, k - 1); push("crit", "Crit", k, s - 1); push("super", "Super", s, 99);
    return out;
  }
  const two = (n) => String(n).padStart(2, "0");
  const bandText = (b) => bandSpans(b).map((s) => `${s.label} ${two(s.from)}-${two(s.to)}`).join(" · ");

  /** Bullets landing in a burst: the hit band is cut into Count equal steps, higher rolls land more. */
  function bullets(roll, b, count, outcome, rules) {
    if (count <= 1) return 1;
    if (rules && rules.burstMode === "segments") {
      // The hit band up to the super crit is cut into Count - 1 steps, widest first (weights Count, Count-1 ... 2). Only a super crit lands them all.
      if (outcome === "super") return count;
      const span = b.superAt - b.hitAt; if (span <= 0) return 1;
      const w = Array.from({ length: count - 1 }, (_, i) => count - i), tot = w.reduce((x, y) => x + y, 0);
      let edge = b.hitAt;
      for (let i = 0; i < w.length; i++) { edge += (span * w[i]) / tot; if (roll < edge - 1e-9) return i + 1; }
      return count - 1;
    }
    if (outcome === "crit" || outcome === "super") return rules && rules.critAllBullets === false ? 1 : count;
    const step = (b.critAt - b.hitAt) / count;
    if (step <= 0) return count;
    return Math.max(1, Math.min(count, 1 + Math.floor(fix(roll - b.hitAt) / fix(step))));
  }

  function damage(base, pen, dt, locMult, critMult, floor = 0.2) {
    const x = base * locMult * critMult;
    const raw = pen >= dt ? Math.max(1, x) : Math.max(1, x * pen / dt, Math.max(1, x) * floor);
    return { x: fix(x), raw: fix(raw), final: Math.floor(raw + 1e-9) };
  }

  /** Resolve one attack from a typed roll. Pure: returns what happened, the caller applies it. */
  function resolve(p) {
    const { v, b, roll, loc, rules } = p; let dt = p.dt;
    const sm = p.shot || {};  // this shooter's variables for this shot
    let outcome = classify(roll, b);
    if (outcome === "crit" && sm.critToSuper) outcome = "super";  // Hunter: crits become super crits against animals
    if (outcome === "hit" && (sm.vengeNow || (sm.lucky && roll % 10 === (sm.luckyDigit != null ? sm.luckyDigit : 7)))) outcome = "crit";  // Vengeful, Lucky Number
    if (outcome === "super" && sm.superIgnoreDT) dt = 0;  // Plinkster
    const res = { outcome, bullets: 0, each: 0, total: 0, roll };
    if (outcome === "jam" || outcome === "miss") return res;
    const critName = outcome === "crit" ? "Crit" : outcome === "super" ? "Super" : "Hit";
    // Crit Mult and Super Crit Mult variables add to the multiplier, Head Mult to head shots. Crit D is extra percent damage on any crit.
    const cm = (rules.critMult[critName] + (outcome === "crit" ? sm.critMult || 0 : outcome === "super" ? sm.superMult || 0 : 0)) * (outcome === "hit" ? 1 : 1 + (sm.critDam || 0));
    const lm = rules.loc[loc] + (loc === "Head" ? sm.headMult || 0 : 0) + (loc === "Limb" ? (p.taken && p.taken.limbMult) || 0 : 0);  // limbMult: hurt less in the limbs
    const avail = p.available != null ? p.available : v.count;
    res.bullets = Math.min(p.bulletsOv != null ? p.bulletsOv : bullets(roll, b, v.count, outcome, rules), Math.max(1, avail));
    const pel = v.pellets || 0;
    const floor = p.floor != null ? p.floor : rules.damageFloor;  // the target's armor sets the floor
    const hitOf = (m) => { if (pel && rules.pelletMode === "each") { const one = damage(v.base, v.pen, dt, lm, m, floor); return { x: one.x, raw: one.raw, final: one.final * pel }; } return damage(pel ? v.base * pel : v.base, v.pen, dt, lm, m, floor); };
    const dmg = hitOf(cm);
    // mult: cover and the target's damage-taken statuses, for example 0.9 behind soft cover.
    const mult = p.mult != null ? p.mult : 1;
    const after = (x) => Math.max(mult > 0 ? 1 : 0, Math.floor(x.final * mult + 1e-9));
    res.each = p.damageOv != null ? p.damageOv : after(dmg);
    res.total = res.each * res.bullets;
    // In segments mode only the first bullet of a burst is the crit; the rest are plain hits.
    if (rules.burstMode === "segments" && res.bullets > 1 && outcome !== "hit" && p.damageOv == null) { res.rest = after(hitOf(rules.critMult.Hit)); res.total = res.each + res.rest * (res.bullets - 1); }
    if (outcome === "super" && sm.superKill) { res.kill = true; res.total = Math.max(res.total, 99999); }  // perks that instantly kill on a super crit
    const baseText = pel ? `${fix(v.base)}x${pel}` : String(fix(v.base));
    res.math = `${baseText} × ${loc} ${lm} × ${critName} ${cm} = ${fix(dmg.x)}; Pen ${fix(v.pen)} ${v.pen >= dt ? "≥" : "<"} DT ${dt} → ${dmg.final}` + (res.bullets > 1 ? (res.rest != null ? ` first bullet, + ${res.bullets - 1} more at ${res.rest} = ${res.total}` : ` × ${res.bullets} bullets = ${res.total}`) : "") + (mult !== 1 ? ` × ${fix(mult)} (cover, resistances) = ${res.each}` : "") + (p.damageOv != null ? ` (DM set ${p.damageOv})` : "");
    return res;
  }

  /** Damage floor for hits on this target: its body armor's class sets it (clothing when there's none). Creatures keep the rules' floor. */
  function floorOf(e, ctx) {
    const r = ctx.rules, F = r.armorFloors; if (!F || !e || e.mob) return r.damageFloor;
    const it = e.gear && e.gear.armor && get(ctx, e.gear.armor);
    const k = it && (String(it.o.type || "").match(/^(light|medium|heavy|power)/i) || [])[1];
    return F[k ? k.toLowerCase() : "clothing"] != null ? F[k ? k.toLowerCase() : "clothing"] : r.damageFloor;
  }

  // ---- skill checks
  function checkNeeded(value, target, r) { return r.checkBase - Math.trunc((value - target) / r.checkStep); }
  function checkResult(d20, needed) {
    if (d20 === 1) return { pass: false, why: "natural 1" };
    if (d20 === 20) return { pass: true, why: "natural 20" };
    return { pass: d20 >= needed, why: "" };
  }
  const checkOdds = (needed) => Math.min(19, Math.max(1, 21 - needed)) * 5;

  // ---- XP
  const xpFor = (lvl, r) => r.levelXpStep * lvl * (lvl - 1);
  function levelForXp(xp, r) { let l = 1; while (l < r.maxLevel && xp >= xpFor(l + 1, r)) l++; return l; }
  const xpGain = (base, int, r) => fix(base * (1 + (int - 5) * r.xpIntStep));

  // ---- enemies
  const pick = (list, rng) => list[Math.floor(rng() * list.length)];
  // Blank Value marks the one-offs on the tabs that price their weapons (GLT's Unique column is empty).
  const isUnique = (w) => /unique/i.test(w.n) || (w.val == null && ["SG", "MW"].includes(w.tab));
  function poolFor(ctx, tabs, tier) {
    const all = ctx.db.data.weapons.filter((w) => tabs.includes(w.tab) && w.ok && w.tier > 0 && !ctx.rules.genExclude.includes(w.n) && !isUnique(w) && !w.thrown && (!["SG", "BG"].includes(w.tab) || loadsFor(ctx, w.ammo).length));
    for (let t = tier; t >= 1; t--) { const p = all.filter((w) => w.tier === t); if (p.length) return p; }
    return all;
  }
  function loadFor(ctx, w, tier, rng) {
    const all = loadsFor(ctx, w.ammo);
    const ok = all.filter((a) => a.ok && !a.pellets);
    const inTier = ok.filter((a) => (a.tier || 1) <= tier);
    return inTier.find((a) => a.load === "Standard") || (inTier.length && pick(inTier, rng)) || (ok.length && pick(ok, rng)) || all[0];
  }
  function slotFor(ctx, w, tier, rng) {
    const s = { n: w.n, mag: w.mag || 0 };
    if (w.tab === "SG" || w.tab === "BG") { const a = loadFor(ctx, w, tier, rng); if (a) s.ammo = a.n; }
    return s;
  }
  function pickArmor(ctx, locs, tier, rng) {
    const all = ctx.db.data.armor.filter((a) => locs.includes(a.loc) && a.dt > 0 && a.tier > 0 && a.tier < 100 && !a.faction);
    for (let t = tier; t >= 1; t--) { const p = all.filter((a) => a.tier === t); if (p.length) return pick(p, rng).n; }
    return "";
  }
  function rollCaps(text, rng) {
    const m = String(text || "").match(/(\d+)\s*-\s*(\d+)/);
    if (!m) return 0;
    const a = Number(m[1]), b = Number(m[2]);
    return a + Math.floor(rng() * (b - a + 1));
  }
  /** Weapons, armor, caps and loot for a human at this tier. */
  function gearUp(e, ctx, rng) {
    if (e.mob) return;
    const tmpl = ctx.db.enemies.get(low(e.tmpl)) || {};
    const sk = e.skills || {}; const tier = e.tier; const out = [];
    const keep = e.keepTemplateGear;
    const ranged = [["SG", sk.SG || 0], ["BG", sk.BG || 0], ["EW", sk.EW || 0]];
    const atTier = ranged.filter(([t]) => (poolFor(ctx, [t], tier)[0] || {}).tier === tier);
    const best = (atTier.length ? atTier : ranged).reduce((a, b) => (b[1] + rng() * 10 > a[1] ? b : a));
    const main = keep && tmpl.w1 && get(ctx, tmpl.w1) ? get(ctx, tmpl.w1).o : pick(poolFor(ctx, [best[0]], tier), rng);
    if (main) out.push(slotFor(ctx, main, tier, rng));
    const side = keep && tmpl.w2 && get(ctx, tmpl.w2) ? get(ctx, tmpl.w2).o : keep ? null : pick(poolFor(ctx, ["MW"], tier), rng);
    if (side) out.push(slotFor(ctx, side, tier, rng));
    e.weapons = out; e.activeW = 0;
    if (ctx.rules.genSkills) e.skills = { ...e.skills, ...npcSkills(e, ctx, rng) };
    e.gear = keep ? { head: tmpl.head || "", armor: tmpl.armor || "", vanity: tmpl.vanity || "" } : { head: ctx.rules.genArmor && rng() < 0.5 ? pickArmor(ctx, ["Head"], tier, rng) : "", armor: ctx.rules.genArmor ? pickArmor(ctx, ["Body"], tier, rng) : "", vanity: "" };
    e.caps = rollCaps(e.capsRange, rng);
    const inv = [];
    for (const s of out) { const w = get(ctx, s.n); const res = s.ammo || (w && w.o.ammo !== "N/A" && !w.o.thrown && w.o.mag ? w.o.ammo : null); if (res) inv.push({ n: res, q: Math.max(1, s.mag || 1) }); }
    const cons = ctx.db.data.items.filter((i) => i.effect && Number(i.tier) && Number(i.tier) <= tier && ["Healing", "Chem/Drug", "Drink", "Food", "Alcohol"].includes(i.cat));
    const n = Math.floor(rng() * (ctx.rules.genLootMax + 1));
    for (let i = 0; i < n && cons.length; i++) inv.push({ n: pick(cons, rng).n, q: 1 });
    e.inv = inv;
  }
  /** What a typical weapon of this skill and tier asks for: the 75th percentile requirement, from the nearest tier that has any. */
  function tierReq(ctx, skill, tier) {
    const all = ctx.db.data.weapons.filter((w) => w.skill === skill && w.ok && w.tier > 0 && w.tier < 100 && w.req != null);
    for (let t = tier; t >= 1; t--) { const r = all.filter((w) => w.tier === t).map((w) => w.req).sort((a, b) => a - b); if (r.length) return r[Math.floor(r.length * 0.75)]; }
    return 10 * tier;
  }
  /** Enemy combat skills from tier, SPECIAL and the weapons it carries. A carried weapon's skill reaches most weapons of the tier and never falls short of that weapon. */
  function npcSkills(e, ctx, rng = Math.random) {
    const r = ctx.rules, out = {};
    const carried = {};
    for (const s of e.weapons || []) { const w = get(ctx, s.n); if (w && w.o.skill) carried[w.o.skill] = Math.max(carried[w.o.skill] || 0, w.o.req || 0); }
    for (const k of ["SG", "BG", "EW", "MW", "EXP"]) {
      const sk = SKILLS.find((x) => x[0] === k); const sp = e.special || [];
      const stat = (c) => Number(sp[SPECIAL.indexOf(c)]) || 5;
      const special = Math.round(((stat(sk[2]) + stat(sk[3])) / 2 - 5) * r.npcSkillSpecial);
      const noise = Math.round((rng() * 2 - 1) * r.npcSkillSpread);
      const base = tierReq(ctx, k, e.tier || 1);
      const v = k in carried ? Math.max(carried[k], Math.max(base, carried[k]) + special + noise) : Math.round(base * r.npcOffSkill) + special + noise;
      out[k] = Math.max(0, Math.min(100, v));
    }
    return out;
  }
  /** junk, standard, improved (surplus, hand loads, match...), special, or best: the caliber's top special load. */
  function ammoClass(ctx, a) {
    const r = ctx.rules.ammoClasses || {}; const is = (k, x) => !!r[k] && new RegExp(r[k], "i").test(String(x.load || "").trim());
    for (const k of ["junk", "standard", "improved"]) if (is(k, a)) return k;
    const sp = loadsFor(ctx, a.cal).filter((x) => x.ok && !["junk", "standard", "improved"].some((k) => is(k, x)));
    const score = (x) => (x.tier || 1) * 1000 + (x.dam || 0) * (x.pellets || 1) + (x.pen || 0);
    const best = sp.reduce((m, x) => (!m || score(x) > score(m) ? x : m), null);
    return sp.length > 1 && best && best.n === a.n ? "best" : "special";
  }
  /** A vendor's shelf: this tier and the one below, never unique weapons. Ammo only for the guns on the shelf, most of it the common loads. */
  function vendorStock(ctx, tier, rng = Math.random) {
    const d = ctx.db.data; const c = ctx.rules.vendorCounts; const g = ctx.rules.vendorGrowth || {}, qg = ctx.rules.vendorQtyGrowth || {};
    const inTier = (o) => { const t = Number(o.tier); return t >= Math.max(1, tier - 1) && t <= tier; };
    const upTo = (o) => Number(o.tier || 1) <= tier;  // consumables: anything up to the vendor's tier
    const n = (k) => Math.round((c[k] || 0) + (g[k] || 0) * (tier - 1));
    const grow = (k) => 1 + (qg[k] || 0) * (tier - 1);
    const med = (o) => /heal|chem|drug|stim|med/i.test(`${o.cat || ""} ${o.n}`);
    const draw = (list, n) => { const pool = [...list], out = []; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]); return out; };
    const armor = d.armor.filter((a) => inTier(a) && a.tier < 100 && !a.faction);
    const groups = [
      [d.weapons.filter((w) => w.ok && inTier(w) && !isUnique(w) && !ctx.rules.genExclude.includes(w.n)), n("weapon"), () => 1],
      [armor.filter((a) => a.loc !== "Accessory"), n("armor"), () => 1],
      [armor.filter((a) => a.loc === "Accessory"), n("accessory"), () => 1],
      [d.items.filter((i) => i.effect && upTo({ tier: i.tier || 1 })), n("item"), (o) => Math.max(1, Math.round((1 + rng() * 2) * grow(med(o) ? "med" : "item")))],
      [d.materials.filter((m) => upTo(m)), n("material"), () => Math.max(1, Math.round((1 + rng() * 4) * grow("material")))],
    ];
    // Guns: a caliber already on the shelf is less likely to come up again, so calibers vary without forbidding two 9mm guns.
    const same = ctx.rules.vendorSameCaliber != null ? ctx.rules.vendorSameCaliber : 0.35;
    const guns = []; { const pool = [...groups[0][0]], seen = {};
      while (guns.length < groups[0][1] && pool.length) {
        const wt = pool.map((w) => (w.ammo && w.ammo !== "N/A" ? Math.pow(same, seen[low(w.ammo)] || 0) : 1));
        let x = rng() * wt.reduce((a, b) => a + b, 0), i = 0; while (i < pool.length - 1 && (x -= wt[i]) > 0) i++;
        const w = pool.splice(i, 1)[0]; guns.push(w); if (w.ammo) seen[low(w.ammo)] = (seen[low(w.ammo)] || 0) + 1;
      } }
    const out = guns.map((o) => ({ n: o.n, q: 1 }));
    for (const [list, k, qty] of groups.slice(1)) out.push(...draw(list, k).map((o) => ({ n: o.n, q: qty(o) })));
    // Ammo for those guns: lots of the common loads, less of the good ones, a little of the caliber's best. Junk thins out by tier 5.
    const VA = ctx.rules.vendorAmmo || {}, L = VA.lines || {};
    const lines = (k) => { const [a, b] = L[k] || [1, 0]; return Math.max(0, Math.round(a + b * (tier - 1))); };
    const qOf = (k) => { const [a, b] = VA[k] || [0, 0]; return Math.round((a + b * (tier - 1)) * (0.75 + rng() * 0.5)); };
    for (const cal of [...new Set(guns.filter((w) => w.ammo && w.ammo !== "N/A" && !w.thrown).map((w) => w.ammo))]) {
      const by = {}; for (const a of loadsFor(ctx, cal).filter((a) => a.ok && upTo(a))) { const k = ammoClass(ctx, a); (by[k] = by[k] || []).push(a); }
      for (const k of ["junk", "standard", "improved", "special", "best"]) for (const a of draw(by[k] || [], lines(k))) { const q = qOf(k); if (q > 0) out.push({ n: a.n, q }); }
    }
    return out;
  }
  /** Base value of an item in caps. est means the workbook had no price, so this is the rules' placeholder. */
  function valueOf(ctx, name) {
    const it = get(ctx, name); if (!it) return { val: 0, est: true };
    if (it.o.val != null && it.o.val > 0) return { val: it.o.val, est: false };
    const t = Math.max(1, Math.min(6, Number(it.o.tier) || 1));
    return { val: it.cat === "ammo" ? fix(ctx.rules.ammoPrice * t * ((ctx.rules.ammoClassPrice || {})[ammoClass(ctx, it.o)] || 1)) : ctx.rules.noPrice[t - 1], est: true };
  }
  // The sheet's Buy is 100/Barter and Sell is Barter/100: that is a vendor at 100. Clamped so nobody can buy low and sell high to the same vendor.
  const barterFactors = (mine, theirs) => ({ buy: Math.max(1, theirs / Math.max(1, mine)), sell: Math.max(0, Math.min(1, mine / theirs)) });
  const optimalRange = (w) => { if (!w || !w.hit || w.tab === "MW") return 1; let best = -1, at = 1; w.hit.forEach((x, i) => { if (x != null && x > best) { best = x; at = i + 1; } }); return at; };
  function spawn(tmpl, id, ctx, rng = Math.random, nameSuffix = "") {
    const e = { id, kind: "npc", tmpl: tmpl.n, name: tmpl.n + nameSuffix, tier: tmpl.tier || 1, mob: !!tmpl.mob, special: [...(tmpl.special || [null, null, null, null, null, null, null])], skills: { ...(tmpl.skills || {}) }, xp: tmpl.xp || 0, capsRange: tmpl.caps || "", caps: 0, faction: tmpl.faction || "",
      gear: { head: tmpl.head || "", armor: tmpl.armor || "", vanity: tmpl.vanity || "" }, weapons: [], activeW: 0, statuses: [], effects: [], inv: [], ov: {}, hpMult: 1, dmgMult: 1, keepTemplateGear: !!(tmpl.w1 && !tmpl.mob) };
    if (tmpl.saved) Object.assign(e, JSON.parse(JSON.stringify(tmpl.saved)), { id, name: tmpl.saved.name + nameSuffix, statuses: [], effects: [] });
    else if (e.mob) {
      Object.assign(e, { baseHp: tmpl.hp || 0, baseAp: tmpl.ap || 0, baseDt: tmpl.dt || 0, basePri: tmpl.pri || 0 });
      e.weapons = [...new Set([tmpl.w1, tmpl.w2].filter(Boolean))].map((n) => ({ n }));
    } else gearUp(e, ctx, rng);
    const d = derive(e, ctx);
    e.hp = d.hp; e.ap = d.ap;
    return e;
  }
  /** "Legion Recruit - Aquilius". Null when the faction has no name style. taken: names already in the fight, so two don't match. */
  function npcName(tmpl, rules, rng = Math.random, taken = new Set()) {
    const st = rules.autoNames && (rules.nameStyles || {})[tmpl.faction]; if (!st) return null;
    const list = (k) => String((rules.namePools || {})[k] || "").split(",").map((x) => x.trim()).filter(Boolean);
    const any = (k) => { const l = list(k); return l.length ? pick(l, rng) : ""; };
    const tier = tmpl.tier || 1;
    for (let i = 0; i < 25; i++) {
      const rank = pick(String((st.ranks || {})[tier] ?? "").split(",").map((x) => x.trim()), rng);
      const nick = st.style === "gang" || (st.nickFrom && tier >= st.nickFrom) ? any(st.nick) : "";
      const name = st.style === "gang" ? nick
        : st.style === "latin" ? [rank, any(st.first), nick].filter(Boolean).join(" ")
        : [rank, any(st.first), nick && `'${nick}'`, any(st.last)].filter(Boolean).join(" ");
      if (!name) return null;
      const full = `${tmpl.n} - ${name}`;
      if (![...taken].some((x) => String(x).split(" - ").slice(1).join(" - ") === name) || i === 24) return full;
    }
  }
  // ---------- combat log stories
  /** Which family of lines a weapon uses. */
  function weaponFamily(w) {
    const tab = w.tab || "", type = String(w.type || "");
    if (tab === "MW" || w.melee) { if (/hand/i.test(type)) return "unarmed"; return { B: "blunt", S: "blade", P: "pierce" }[type[0]] || "blunt"; }
    if (tab === "EX" || /grenade|launcher|missile|mine|trap/i.test(type)) return "explosive";
    if (tab === "EW") return /laser/i.test(type) ? "laser" : /plasma/i.test(type) ? "plasma" : /electric/i.test(type) ? "electric" : /magnetic/i.test(type) ? "gauss" : /fuel/i.test(type) ? "fire" : "energy";
    if (/shotgun/i.test(type)) return "shotgun";
    if (/sniper|anti-mat|dmr/i.test(type)) return "sniper";
    if (/bow/i.test(type)) return "bow";
    if (/^heavy$/i.test(type)) return "heavy";
    if (/lmg|smg|machine pistol|pdw|auto rifle/i.test(type)) return "auto";
    if (/pistol|revolver|plinker/i.test(type)) return "pistol";
    return "rifle";
  }
  const storyRecent = {};
  /** A random line from a list, skipping the ones used lately, so the same fight never reads the same way twice in a row. */
  function storyPick(key, list, rng) {
    if (!list || !list.length) return "";
    const seen = storyRecent[key] || (storyRecent[key] = []);
    const fresh = list.map((_, i) => i).filter((i) => !seen.includes(i));
    const i = (fresh.length ? fresh : list.map((_, j) => j))[Math.floor(rng() * (fresh.length || list.length))];
    seen.push(i); while (seen.length > Math.min(list.length - 1, 6)) seen.shift();
    return list[i];
  }
  /**
   * One or two sentences for the combat log. o: { a, t, w: weapon row, ammo, d, n, part: "Head"|"Body"|"LArm"..., outcome, kind: "flesh"|"robot"|"insect", statuses: [names], killed, downed }.
   * text is COMBAT_TEXT. Player characters only ever go down (o.downed); o.killed is for everyone else.
   */
  function story(o, text, rng = Math.random) {
    const fam = weaponFamily(o.w || {}); const F = text.families[fam] || text.families.rifle;
    const group = o.part === "Head" ? "Head" : o.part === "Body" ? "Body" : "Limb";
    const limb = /Leg/.test(o.part || "") ? "leg" : /Arm/.test(o.part || "") ? "arm" : "body";
    const side = /^L/.test(o.part || "") ? "left " : /^R/.test(o.part || "") ? "right " : "";
    const partName = group === "Limb" ? side + limb : group === "Body" ? "chest" : "head";
    const cal = String(o.ammo || "").split(" - ")[0].trim();
    const withT = rng() < 0.45 ? (cal && !/^n\/a$/i.test(cal) ? ` with ${/^[aeiou8]|^\.(11|18)/i.test(cal) ? "an" : "a"} ${cal}` : o.w && o.w.n ? ` with the ${o.w.n}` : "") : "";
    const verb = storyPick(`verb:${fam}`, F.verbs, rng);
    const fill = (s) => s.replace(/\{a\}/g, o.a).replace(/\{t\}/g, o.t).replace(/\{d\}/g, `${o.d} DMG`).replace(/\{n\}/g, o.n || 1).replace(/\{w\}/g, (o.w && o.w.n) || "weapon")
      .replace(/\{with\}/g, withT).replace(/\{verb\}/g, verb).replace(/\{proj\}/g, F.proj).replace(/\{part\}/g, partName).replace(/\{limb\}/g, limb);
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    if (o.outcome === "miss") { const k = ["blunt", "blade", "pierce", "unarmed"].includes(fam) ? "missMelee" : fam === "explosive" ? "missBlast" : "missRanged"; return fill(storyPick(k, text[k], rng)); }
    if (o.outcome === "jam") return fill(storyPick("jam", text.jam, rng));
    const crit = o.outcome === "crit" || o.outcome === "super", sup = o.outcome === "super";
    const out = [];
    if (o.killed) {
      const K = text.kills; let key;
      if (o.kind === "robot" || o.kind === "insect") key = o.kind;
      else if (sup) key = "super" + group;
      else if (crit) key = "crit" + group;
      else key = ["burn", "blast", "shock"].includes(F.nature) && rng() < 0.6 ? F.nature : "plain";
      if (crit && o.kind === "flesh" && ["burn", "blast"].includes(F.nature) && rng() < 0.35) key = F.nature;
      out.push(fill(storyPick(`kill:${key}`, K[key] || K.plain, rng)));
      return out.join(" ");
    }
    const generic = crit ? ["{a} {verb} {t} in the {part} for {d}{with}.", "Critical hit: {a} {verb} {t} in the {part} for {d}.", "{a} finds a gap and {verb} {t} in the {part} for {d}."]
      : ["{a} {verb} {t} for {d}{with}.", "{a} {verb} {t} in the {part} for {d}."];
    let main;
    if ((o.n || 1) > 1 && F.multi && F.multi.length && rng() < 0.75) main = storyPick(`multi:${fam}`, F.multi, rng);
    else if (crit || rng() < 0.4) main = storyPick(`gen:${crit}`, generic, rng);
    else main = storyPick(`hit:${fam}`, F.hit, rng);
    main = fill(main);
    if (main.startsWith(o.a) && rng() < 0.15) main = `${storyPick("open", text.openers, rng)} ${main}`;
    out.push(main);
    if (crit) {
      const kind = text.wounds[o.kind] ? o.kind : "flesh";
      const fits = (row) => (!row[1] || row[1].split(" ").includes(F.nature)) && (!row[2] || row[2] === limb);
      const pool = (text.wounds[kind][group] || []).filter(fits).map((r) => r[0]);
      const strong = ((text.superWounds[kind] || {})[group]) || [];
      const line = sup && strong.length && rng() < 0.7 ? storyPick(`sw:${kind}:${group}`, strong, rng) : storyPick(`w:${kind}:${group}:${F.nature}:${limb}`, pool, rng);
      if (line) out.push(fill(line));
    }
    const ammoKey = Object.keys(text.ammo).find((k) => new RegExp(k, "i").test(String(o.ammo || "").split(" - ").slice(1).join(" - ")));
    if (ammoKey && rng() < 0.35) out.push(fill(storyPick(`ammo:${ammoKey}`, text.ammo[ammoKey], rng)));
    for (const st of o.statuses || []) {
      const S = text.status[st] || text.status[Object.keys(text.status).find((k) => st.toLowerCase().startsWith(k.toLowerCase().slice(0, 6)))];
      if (!S) continue;
      const list = o.kind === "robot" ? S.robot : (o.kind === "flesh" && S[group]) || S.any || S[group];
      if (list) out.push(fill(storyPick(`st:${st}:${group}`, list, rng)));
    }
    if (o.downed) out.push(fill(storyPick("down", text.downed, rng)));
    return out.map(cap).join(" ");
  }
  /** Boost a copy in place. Returns the rolled percentages for the log. */
  function makeBoss(e, ctx, rng = Math.random) {
    const lo = ctx.rules.bossMin, hi = ctx.rules.bossMax;
    const roll = () => lo + rng() * (hi - lo);
    const hp = roll(), dm = roll();
    const before = derive(e, ctx).hp;
    e.hpMult = fix((e.hpMult || 1) * (1 + hp));
    e.dmgMult = fix((e.dmgMult || 1) * (1 + dm));
    e.xp = Math.round((e.xp || 0) * (1 + (hp + dm) / 2));
    if (!e.mob) e.weapons = (e.weapons || []).map((s) => {
      const cur = get(ctx, s.n);
      if (!cur || !cur.o.tab) return s;
      const pool = poolFor(ctx, [cur.o.tab], (cur.o.tier || 1) + 1).filter((w) => w.tier > (cur.o.tier || 1));
      const same = pool.filter((w) => w.type === cur.o.type);
      const next = same.length ? pick(same, rng) : pool.length ? pick(pool, rng) : null;
      return next ? slotFor(ctx, next, (cur.o.tier || 1) + 1, rng) : s;
    });
    e.boss = true;
    const after = derive(e, ctx).hp;
    e.hp = Math.min(after, (e.hp != null ? e.hp : before) + after - before);
    return { hp, dm };
  }

  // ---- line of fire: which objects does a straight line from a to b cross?
  // The part of an object that stops a shot. For a tree that's the trunk, not the leaves.
  const trunkOf = (o, r) => { const c = r && r.mapItems && r.mapItems[o.item]; return (c && c.trunk) || (!o.item && o.kind === "tree" ? 0.2 : 0); };
  const shotBox = (o, r) => { const t = trunkOf(o, r); return t ? { x: o.x, y: o.y, w: (o.w || 1) * t, h: (o.h || 1) * t } : o; };
  // A turned object: spin the points the opposite way around its center, then treat it as an unturned box.
  function unturn(p, o) {
    if (!o.angle) return p;
    const r = (o.angle * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), dx = p.x - o.x, dy = p.y - o.y;
    return { x: o.x + dx * c + dy * s, y: o.y - dx * s + dy * c };
  }
  function crosses(a0, b0, o) {
    const a = unturn(a0, o), b = unturn(b0, o);
    // Standard box test: shrink the line to the part inside the box's x range, then its y range. Anything left means it crosses.
    const hw = (o.w || 1) / 2, hh = (o.h || 1) / 2; let lo = 0, hi = 1; const dx = b.x - a.x, dy = b.y - a.y;
    for (const [d, p, c, half] of [[dx, a.x, o.x, hw], [dy, a.y, o.y, hh]]) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(p - c) > half) return false; continue; }
      let t1 = (c - half - p) / d, t2 = (c + half - p) / d; if (t1 > t2) [t1, t2] = [t2, t1];
      lo = Math.max(lo, t1); hi = Math.min(hi, t2); if (lo > hi) return false;
    }
    return true;
  }
  const inside = (p0, o) => { const p = unturn(p0, o); return Math.abs(p.x - o.x) <= (o.w || 1) / 2 && Math.abs(p.y - o.y) <= (o.h || 1) / 2; };
  const coverTier = (o, r) => o.cover || r.coverByKind[o.kind] || "open";
  /** The worst cover between shooter and target. Something the shooter stands inside doesn't count: they can shoot out of a bush. */
  function lineCover(a, b, objects, r) {
    const rank = Object.keys(r.cover); let best = "open", by = null;
    for (const o of objects || []) { const t = coverTier(o, r); const box = shotBox(o, r); if (rank.indexOf(t) > rank.indexOf(best) && !inside(a, box) && crosses(a, b, box)) { best = t; by = o; } }
    return { tier: best, n: r.cover[best].n, hit: r.cover[best].hit, dam: r.cover[best].dam, by: by ? (by.label || (r.mapItems[by.item] || {}).n || "") : "" };
  }
  /** Does walking this path hit something solid, like a building? */
  const pathBlocked = (a, b, objects) => (objects || []).some((o) => o.block && crosses(a, b, o));

  /** Random furniture for a location. Count = area x density x 0.8 to 1.2, kept between the theme's min and max. */
  // ---------- room layouts
  // A layout is built from the setting (theme) and the location (map), with rules instead of dice:
  // indoor maps are furnished wall to wall; a building setting on open ground becomes a walled building in the middle
  // with its junk around it and wilderness beyond; city blocks become buildings of the setting. Rows stay parallel,
  // conveyors chain into lines, drums stand in rows, and aisles and doorways stay clear so you can walk everywhere.
  const LAYOUT = {
    indoorThemes: ["home", "office", "factory", "warehouse", "police"],
    footprint: { home: [16, 12], office: [24, 16], factory: [34, 22], warehouse: [38, 24], police: [26, 18] },
    // the most of each item one layout may hold
    caps: { conveyor: 14, pressMachine: 8, boiler: 2, generator: 3, oilDrum: 24, workbench: 10, toolCart: 6, pipeRack: 4, crate: 14, shelves: 40, crateStack: 8, pallet: 14, forklift: 2, barrels: 8, desk: 24, officeChair: 26, cabinet: 10, bookshelf: 8, copier: 2, cooler: 2, pottedPlant: 6, partition: 14, couch: 4, officeSafe: 1, lDesk: 2, bed: 4, kitchenTable: 2, toilet: 3, bathtub: 2, sink: 4, stove: 2, fridge: 2, dresser: 4, cellBars: 6, lockers: 6, sandbags: 8, bench: 8, frontCounter: 2, armoryCage: 1, bedroll: 10, cot: 8, footlocker: 10, campfire: 2, tarpWall: 6, tentPole: 8, car: 24, bus: 2, dumpster: 10, mailbox: 8, hydrant: 10, lamppost: 30, barricade: 10, rubble: 10, wreck: 6, ruinWall: 10, stoneWall: 8, deadTree: 12, cactus: 30, dune: 16, boulder: 24, rock: 50, smallRock: 60, tree: 260, bigTree: 30, bush: 140, log: 30, thicket: 20, stump: 30 },
  };
  function generateRoom(map, themeId, r, rng, keepClear = [], newId = (i) => "o" + i) {
    const out = [], reserved = []; let n = 0; const count = {}; const walls = new Set();
    const B = { x0: -map.w / 2, y0: -map.h / 2, x1: map.w / 2, y1: map.h / 2 };
    const rand = (a, b) => a + rng() * (b - a); const ri = (a, b) => Math.floor(rand(a, b + 1)); const any = (l) => l[Math.floor(rng() * l.length)];
    const over = (a, b, pad) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + pad;
    const inside = (x, y, w, h, R = B, m = 0.1) => x - w / 2 >= R.x0 + m - 1e-6 && x + w / 2 <= R.x1 - m + 1e-6 && y - h / 2 >= R.y0 + m - 1e-6 && y + h / 2 <= R.y1 - m + 1e-6;
    // Can something of this size go here? Inside the map, off the tokens, out of aisles, and not on top of anything.
    const fits = (x, y, w, h, pad, o = {}) => {
      if (!inside(x, y, w, h, o.within || B, o.within ? 0.02 : 0.1)) return false;
      if (keepClear.some((p) => Math.abs(p.x - x) < w / 2 + 1.2 && Math.abs(p.y - y) < h / 2 + 1.2)) return false;
      const me = { x, y, w, h };
      if (!o.inAisle && reserved.some((q) => over(me, q, 0))) return false;
      return out.every((b) => (o.touch && o.touch.includes(b)) || !over(me, b, walls.has(b) ? 0.05 : pad));
    };
    const add = (key, x, y, o = {}) => {
      const c = r.mapItems[key]; if (!c) return null;
      if ((count[key] || 0) >= (LAYOUT.caps[key] || 999)) return null;
      let w = o.w != null ? o.w : c.w, h = o.h != null ? o.h : c.h; if (o.rot && !c.round) [w, h] = [h, w];
      if (!o.force && !fits(x, y, w, h, o.pad != null ? o.pad : 0.3, o)) return null;
      const ob = { id: newId(n++), item: key, kind: c.round ? "tree" : "cover", x: fix(x), y: fix(y), w: fix(w), h: fix(h), cover: c.cover, label: "" };
      if (c.block) ob.block = true; if (c.round) ob.round = true; if (o.rot && !c.round) ob.rot = 90;
      out.push(ob); count[key] = (count[key] || 0) + 1; return ob;
    };
    // A frame turns "along the room / across the room" (u, v) into map x, y, so each layout is written once for any orientation.
    const frame = (R, door) => {
      const side = door || (R.x1 - R.x0 >= R.y1 - R.y0 ? "W" : "N");
      const horiz = side === "W" || side === "E", Lu = horiz ? R.x1 - R.x0 : R.y1 - R.y0, Lv = horiz ? R.y1 - R.y0 : R.x1 - R.x0;
      const at = (u, v) => (side === "W" ? [R.x0 + u, R.y0 + v] : side === "E" ? [R.x1 - u, R.y0 + v] : side === "N" ? [R.x0 + v, R.y0 + u] : [R.x0 + v, R.y1 - u]);
      // a wall inside the room between two (u, v) points, with doorways given as [position along the line, width]
      const line = (ua, va, ub, vb, gaps = [], thick = 0.2) => {
        const [ax, ay] = at(ua, va), [bx, by] = at(ub, vb); const alongU = Math.abs(va - vb) < 1e-6;
        const g = gaps.map(([t, w]) => { const [gx, gy] = alongU ? at(t, va) : at(ua, t); return [Math.abs(ay - by) < 1e-6 ? gx : gy, w]; });
        wallLine(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), g, thick);
      };
      // along: the item's long side runs along u
      const put = (key, u, v, along = true, o = {}) => { const [x, y] = at(u, v); return add(key, x, y, { ...o, rot: along ? !horiz : horiz, within: o.within || R }); };
      const size = (key, along = true) => { const c = r.mapItems[key]; return along ? [c.w, c.h] : [c.h, c.w]; };  // [u size, v size]
      // the first of several spots that works
      const first = (key, spots, o = {}) => { for (const [u, v, along] of spots) { const p = put(key, u, v, along, o); if (p) return p; } return null; };
      return { R, horiz, Lu, Lv, at, put, size, line, first };
    };
    const reserve = (x0, y0, x1, y1) => reserved.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
    // Wall pieces along a line, with gaps for doors and for anyone standing on the line.
    const T = 0.4;
    const wallLine = (x0, y0, x1, y1, gaps = [], thick = T) => {
      const horiz = Math.abs(y1 - y0) < 1e-6; const a0 = horiz ? Math.min(x0, x1) : Math.min(y0, y1), a1 = horiz ? Math.max(x0, x1) : Math.max(y0, y1);
      const fixed = horiz ? y0 : x0;
      const g = [...gaps];
      for (const p of keepClear) { const along = horiz ? p.x : p.y, off = horiz ? p.y : p.x; if (Math.abs(off - fixed) < 1 && along > a0 && along < a1) g.push([along, 1.6]); }
      g.sort((p, q) => p[0] - q[0]);
      let s = a0;
      const piece = (p0, p1) => { if (p1 - p0 < 0.3) return; const mid = (p0 + p1) / 2, len = p1 - p0; const o = horiz ? add("concreteWall", mid, fixed, { w: len, h: thick, force: true }) : add("concreteWall", fixed, mid, { w: thick, h: len, force: true }); if (o) walls.add(o); };
      for (const [c, wd] of g) { piece(s, Math.max(s, c - wd / 2)); s = Math.max(s, c + wd / 2); }
      piece(s, a1);
    };
    // A walled shell on rectangle R with doors; returns the floor inside the walls and where the doors are.
    const shell = (R, doorSides, doorW = 2.4) => {
      const doors = [];
      const gapOn = (side) => { const len = side === "N" || side === "S" ? R.x1 - R.x0 : R.y1 - R.y0; const c = (side === "N" || side === "S" ? R.x0 : R.y0) + len * (0.3 + rng() * 0.4); return c; };
      const g = { N: [], S: [], W: [], E: [] };
      for (const side of doorSides) { const c = gapOn(side); g[side].push([c, doorW]); doors.push(side === "N" ? { x: c, y: R.y0, side } : side === "S" ? { x: c, y: R.y1, side } : side === "W" ? { x: R.x0, y: c, side } : { x: R.x1, y: c, side }); }
      wallLine(R.x0 - T / 2, R.y0, R.x1 + T / 2, R.y0, g.N); wallLine(R.x0 - T / 2, R.y1, R.x1 + T / 2, R.y1, g.S);
      wallLine(R.x0, R.y0 + T / 2, R.x0, R.y1 - T / 2, g.W); wallLine(R.x1, R.y0 + T / 2, R.x1, R.y1 - T / 2, g.E);
      const In = { x0: R.x0 + T / 2, y0: R.y0 + T / 2, x1: R.x1 - T / 2, y1: R.y1 - T / 2 };
      for (const d of doors) clearDoor(d, In, doorW);
      return { In, doors };
    };
    // Keep the ground in front of a door free, inside and out.
    const clearDoor = (d, In, wd = 2.4, depth = 3) => {
      if (d.side === "N") reserve(d.x - wd / 2, In.y0 - depth, d.x + wd / 2, In.y0 + depth);
      if (d.side === "S") reserve(d.x - wd / 2, In.y1 - depth, d.x + wd / 2, In.y1 + depth);
      if (d.side === "W") reserve(In.x0 - depth, d.y - wd / 2, In.x0 + depth, d.y + wd / 2);
      if (d.side === "E") reserve(In.x1 - depth, d.y - wd / 2, In.x1 + depth, d.y + wd / 2);
    };
    // Items in a row against one wall of R, long side along the wall, from one end toward the other.
    const alongWall = (F, key, side, u0, u1, gap, max, o = {}) => {
      const [su, sv] = F.size(key, true); const v = side === "near" ? sv / 2 + 0.05 : F.Lv - sv / 2 - 0.05; const placed = [];
      for (let u = u0 + su / 2; u + su / 2 <= u1 && placed.length < max; u += su + gap) { const p = F.put(key, u, v, true, { pad: gap > 0.15 ? 0.1 : 0.02, touch: placed, ...o }); if (p) placed.push(p); }
      return placed;
    };
    // ---- interiors, written along the room (u) and across it (v); the door end is u = 0
    const ROOM = {
      warehouse(F) {
        const dock = Math.min(7, F.Lu * 0.25);
        // shelves: parallel rows along the room, aisles between, a cross aisle at the far end and in the middle of long runs
        const pitch = 1 + 2.6; const u0 = dock + 1, u1 = F.Lu - 2.6; const runs = u1 - u0 > 24 ? [[u0, (u0 + u1) / 2 - 1.3], [(u0 + u1) / 2 + 1.3, u1]] : [[u0, u1]];
        for (let v = 0.55; v + 0.5 <= F.Lv - 0.55; v += pitch) for (const [a, b] of runs) { const row = []; for (let u = a + 3; u + 3 <= b; u += 6) { const s = F.put("shelves", u, v, true, { pad: 0.02, touch: row }); if (s) row.push(s); } }
        // the dock: pallets in rows, a forklift parked beside them, crate stacks in the corner, barrels on the wall
        const pal = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const p = F.put("pallet", 1 + i * 1.35, 0.9 + j * 1.35, true, { pad: 0.05, touch: pal }); if (p) pal.push(p); }
        F.put("forklift", Math.min(dock - 1.4, 4.5), Math.min(F.Lv - 1, 4.4), true, { pad: 0.3 });
        const cs = []; for (let i = 0; i < 3; i++) { const p = F.put("crateStack", 1.1 + i * 2.05, F.Lv - 1.1, true, { pad: 0.02, touch: cs }); if (p) cs.push(p); }
        alongWall(F, "barrels", "far", 0.3, dock, 0.1, 3);
      },
      factory(F) {
        // production lines: conveyors end to end down the middle, press machines beside them, alternating sides
        const lines = F.Lv >= 17 ? [F.Lv * 0.36, F.Lv * 0.68] : [F.Lv * 0.5];
        for (const v of lines) {
          const belt = []; let u = 4.5;
          while (u + 5 <= F.Lu - 6 && belt.length < 6) { const s = F.put("conveyor", u + 2.5, v, true, { pad: 0.02, touch: belt }); if (!s) break; belt.push(s); u += 5; }
          belt.forEach((s, i) => { if (i % 2) return; const side = (i / 2) % 2 ? -1 : 1; F.put("pressMachine", 4.5 + i * 5 + 2.5, v + side * (0.5 + 1 + 0.15), true, { pad: 0.1, touch: belt }); });
          reserve(...F.at(2, v - 0.6), ...F.at(4.4, v + 0.6));  // a walkway at the head of each line
        }
        // workbenches on the near wall with tool carts between, a utility corner (boiler, generators, pipes) at the far end
        const benches = alongWall(F, "workbench", "near", 3, F.Lu - 7, 1.4, 6);
        benches.forEach((b, i) => { if (i % 2 === 0) { const pt = F.horiz ? [b.x + b.w / 2 + 0.7, b.y] : [b.x, b.y + b.h / 2 + 0.7]; add("toolCart", pt[0], pt[1], { rot: !F.horiz, pad: 0.05, touch: [b], within: F.R }); } });
        F.put("boiler", F.Lu - 1.5, F.Lv - 1.5, true, { pad: 0.2 });
        const gens = []; for (let i = 0; i < 2; i++) { const g = F.put("generator", F.Lu - 1.1, F.Lv - 4.2 - i * 2.3, false, { pad: 0.1, touch: gens }); if (g) gens.push(g); }
        alongWall(F, "pipeRack", "near", F.Lu - 6.5, F.Lu - 0.2, 0.3, 2);
        // oil drums in rows along the far wall by the machinery
        for (let row = 0; row < 2; row++) { const drums = []; for (let i = 0; i < 6; i++) { const d = F.put("oilDrum", F.Lu - 4.2 - i * 0.85, F.Lv - 0.45 - row * 0.85, true, { pad: 0.02, touch: drums }); if (d) drums.push(d); } }
        // crates stacked near the door
        const cr = []; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const c = F.put("crate", 1 + i * 1.05, F.Lv - 0.6 - j * 1.05, true, { pad: 0.02, touch: cr }); if (c) cr.push(c); }
      },
      office(F) {
        let openU1 = F.Lu;
        if (F.Lu >= 14 && F.Lv >= 9) {  // the manager's office in the far corner, walled off with a door
          const mw = 5.5, mh = 4.6; const [ax, ay] = F.at(F.Lu - mw, 0), [bx, by] = F.at(F.Lu, mh);
          const R = { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
          F.line(F.Lu - mw, 0, F.Lu - mw, mh, [[mh * 0.55, 1.6]]); F.line(F.Lu - mw, mh, F.Lu, mh);
          reserve(...F.at(F.Lu - mw - 1.4, mh * 0.55 - 0.8), ...F.at(F.Lu - mw + 1.4, mh * 0.55 + 0.8));
          const M = frame({ x0: R.x0 + 0.15, y0: R.y0 + 0.15, x1: R.x1 - 0.15, y1: R.y1 - 0.15 });
          M.put("lDesk", M.Lu - 1.2, M.Lv - 1.2, true, { pad: 0.1 }); M.put("officeChair", M.Lu - 2.7, M.Lv - 1.4, true, { pad: 0.1 });
          M.put("officeSafe", M.Lu - 0.6, 0.6, true, { pad: 0.05 }); alongWall(M, "bookshelf", "near", 0.3, M.Lu - 1.5, 0.2, 1); M.put("pottedPlant", 0.6, M.Lv - 0.6, true, { pad: 0.05 });
          openU1 = F.Lu - mw - 0.4;
        }
        // desk pods: two desks face to face with a partition, chairs on the outside, aisles around each pod
        const podU = 3.4, podV = 3.4;
        for (let u = 3.4; u + podU <= openU1 - 0.6; u += podU + 2.2) for (let v = 1.6; v + podV <= F.Lv - 1.4; v += podV + 2) {
          const cu = u + podU / 2, cv = v + podV / 2; const pod = [];
          const before = out.length;
          const part = F.put("partition", cu, cv, true, { pad: 0.02, w: 3.2 }); if (!part) continue; pod.push(part);
          for (const s of [-1, 1]) for (const k of [-0.8, 0.8]) { const d = F.put("desk", cu + k, cv + s * 0.55, true, { pad: 0.01, touch: pod, w: 1.55 }); if (d) { pod.push(d); const ch = F.put("officeChair", cu + k, cv + s * 1.35, true, { pad: 0.02, touch: pod }); if (ch) pod.push(ch); } }
          if (pod.filter((o) => o.item === "desk").length < 4) for (const o of out.splice(before)) count[o.item]--;  // a pod is all four desks or nothing
        }
        // the lobby by the door: a couch on the wall, cooler, copier and a plant; filing cabinets in a row on the far wall
        F.put("couch", 1.5, 0.5, true, { pad: 0.1 }); F.put("cooler", 0.4, F.Lv - 0.4, true, { pad: 0.05 }); F.put("copier", 1.6, F.Lv - 0.5, true, { pad: 0.1 }); F.put("pottedPlant", 0.45, 0.45 + 1.2, true, { pad: 0.05 });
        alongWall(F, "cabinet", "far", F.Lu * 0.45, Math.min(openU1, F.Lu * 0.45 + 3), 0.02, 4);
        alongWall(F, "bookshelf", "near", 3.6, Math.min(openU1, 3.6 + 4.6), 0.4, 2);
      },
      police(F) {
        // lobby: a counter across the room with a way through, benches on the lobby wall, sandbags by the door
        const lob = Math.min(5, F.Lu * 0.25);
        const cl = Math.min(4, F.Lv - 3); F.put("frontCounter", lob, 0.3 + cl / 2, false, { pad: 0.1, w: cl });
        alongWall(F, "bench", "far", 1, lob - 0.4, 0.3, 2);
        // cells along the far end: bars in front, walls between, a bunk inside each
        const depth = 2.8, cw = 3; const nCells = Math.min(4, Math.floor((F.Lv - 0.4) / cw));
        const cu = F.Lu - depth; const v0 = (F.Lv - nCells * cw) / 2;
        for (let i = 0; i < nCells; i++) {
          const v = v0 + i * cw;
          if (i > 0) F.line(cu, v, F.Lu, v);
          F.put("cellBars", cu, v + 0.15 + (cw - 1.45) / 2, false, { pad: 0.02, w: cw - 1.45, force: true });  // the gap is the open cell door
          F.put("bench", F.Lu - 0.3, v + cw / 2, false, { pad: 0.05 });
        }
        if (nCells) { if (v0 > 0.3) F.line(cu, v0, F.Lu, v0); if (v0 + nCells * cw < F.Lv - 0.3) F.line(cu, v0 + nCells * cw, F.Lu, v0 + nCells * cw); }
        reserve(...F.at(cu - 2.2, 0), ...F.at(cu - 0.2, F.Lv));  // the walk in front of the cells
        // the bullpen: rows of desks with chairs, lockers on the wall, the armory cage in a corner
        for (let u = lob + 2.6; u + 1.6 <= cu - 2.6; u += 3.2) for (let v = 1.8; v + 0.8 <= F.Lv - 1.6; v += 2.8) { if (F.put("desk", u, v, true, { pad: 0.3 })) F.put("officeChair", u, v + 0.9, true, { pad: 0.05 }); }
        alongWall(F, "lockers", "near", lob + 0.5, cu - 3, 0.05, 3);
        F.put("armoryCage", cu - 3.8, F.Lv - 1.1, true, { pad: 0.2 });
        alongWall(F, "cabinet", "far", lob + 0.5, lob + 3, 0.02, 3);
      },
      // a home is split into rooms first; these furnish one room each
      living(F) { alongWall(F, "couch", "far", F.Lu * 0.3, F.Lu * 0.3 + 2.1, 0, 1); alongWall(F, "bookshelf", "near", 0.6, 3, 0, 1); F.put("pottedPlant", F.Lu - 0.5, 0.5, true, { pad: 0.05 }); F.put("kitchenTable", F.Lu * 0.55, F.Lv * 0.5, true, { pad: 0.6 }); },
      kitchen(F) {
        // fridge, stove and sink side by side on one wall: tried in each corner until all three fit
        corners: for (const far of [false, true]) for (const fromEnd of [false, true]) {
          const strip = []; let u = fromEnd ? F.Lu - 0.4 : 0.4;
          for (const k of ["fridge", "stove", "sink"]) { const [su, sv] = F.size(k, true); const c = fromEnd ? u - su / 2 : u + su / 2; const o = F.put(k, c, far ? F.Lv - sv / 2 - 0.05 : sv / 2 + 0.05, true, { pad: 0.02, touch: strip }); if (!o) break; strip.push(o); u = fromEnd ? u - su : u + su; }
          if (strip.length === 3) break corners;  // one kitchen
          for (const o of strip) { out.splice(out.indexOf(o), 1); count[o.item]--; }
        }
        F.first("kitchenTable", [[F.Lu * 0.6, F.Lv * 0.62, true], [F.Lu * 0.4, F.Lv * 0.4, true], [F.Lu * 0.5, F.Lv * 0.5, false]], { pad: 0.5 });
      },
      bedroom(F) { const bed = F.first("bed", [[1.1, F.Lv / 2, false], [1.1, 1.05, false], [1.1, F.Lv - 1.05, false], [F.Lu / 2, 0.75, true], [1.05, 0.75, true], [F.Lu - 1.05, 0.75, true]], { pad: 0.05 }); if (bed) { const ds = [[bed.w / 2 + 0.85, 0, false], [-(bed.w / 2 + 0.85), 0, false], [0, bed.h / 2 + 0.45, false], [0, -(bed.h / 2 + 0.45), false], [bed.w / 2 + 0.45, 0, true], [-(bed.w / 2 + 0.45), 0, true]]; for (const [dx, dy, rot] of ds) if (add("dresser", bed.x + dx, bed.y + dy, { rot, pad: 0.05, within: F.R })) break; } /* beside the bed, wherever it ended up */ alongWall(F, "bookshelf", "far", F.Lu * 0.5, F.Lu - 0.2, 0, 1); },
      livingKitchen(F) { ROOM.kitchen(F); alongWall(F, "couch", "far", F.Lu * 0.45, F.Lu * 0.45 + 2.1, 0, 1); F.put("pottedPlant", F.Lu - 0.5, 0.5, true, { pad: 0.05 }); },
      bedBath(F) { ROOM.bedroom(F); F.first("toilet", [[F.Lu - 0.45, F.Lv - 0.55, true], [F.Lu - 0.45, 0.5, true], [F.Lu * 0.6, F.Lv - 0.55, true]], { pad: 0.05 }); F.put("sink", F.Lu - 1.5, F.Lv - 0.35, true, { pad: 0.05 }); },
      bathroom(F) { F.first("toilet", [[0.5, 0.5, true], [0.5, F.Lv - 0.55, true], [F.Lu * 0.5, 0.5, true]], { pad: 0.05 }); alongWall(F, "bathtub", "far", 0.1, 2, 0, 1); F.put("sink", F.Lu - 0.5, 0.35, true, { pad: 0.05 }); },
    };
    // A room tries each wall as its "back" and keeps the first layout where the things it's for actually fit.
    const NEED = { living: ["couch"], kitchen: ["stove"], bedroom: ["bed"], bathroom: ["toilet"], livingKitchen: ["stove"], bedBath: ["bed", "toilet"] };
    const furnish = (job, A) => {
      const sides = ["W", "E", "N", "S"].sort(() => rng() - 0.5);
      for (let k = 0; k < sides.length; k++) {
        const before = out.length; ROOM[job](frame(A, sides[k]));
        const got = out.slice(before).map((o) => o.item);
        if ((NEED[job] || []).every((n) => got.includes(n)) || k === sides.length - 1) return;
        for (const o of out.splice(before)) count[o.item]--;
      }
    };
    // Split a home into rooms with inner walls and doorways, then give each room a job by size.
    const homeRooms = (R, outer = []) => {
      const doorways = outer.map((d) => ({ x: d.x, y: d.y }));  // points in the walls that must stay open, the front door first
      const split = (A, depth) => {
        const W = A.x1 - A.x0, H = A.y1 - A.y0; if (depth > 2 || W * H < 44 || (W < 7 && H < 7)) return [A];  // rooms stay at least ~20 square meters
        let vert = W >= H, at = null;
        for (const v of [vert, !vert]) {  // the other way round if a doorway is in the way
          const len = v ? W : H; if (len < 7) continue;
          for (let k = 0; k < 12 && at == null; k++) { const t = v ? A.x0 + W * (0.36 + rng() * 0.28) : A.y0 + H * (0.36 + rng() * 0.28); if (doorways.every((d) => Math.abs((v ? d.x : d.y) - t) > 1.6)) at = t; }
          if (at != null) { vert = v; break; }
        }
        if (at == null) return [A];
        const len = vert ? H : W; const door = (vert ? A.y0 : A.x0) + len * (0.25 + rng() * 0.5);
        doorways.push(vert ? { x: at, y: door } : { x: door, y: at });
        if (vert) wallLine(at, A.y0, at, A.y1, [[door, 1.6]], 0.2); else wallLine(A.x0, at, A.x1, at, [[door, 1.6]], 0.2);
        if (vert) reserve(at - 1.4, door - 0.8, at + 1.4, door + 0.8); else reserve(door - 0.8, at - 1.4, door + 0.8, at + 1.4);
        const a = vert ? { ...A, x1: at - 0.1 } : { ...A, y1: at - 0.1 }, b = vert ? { ...A, x0: at + 0.1 } : { ...A, y0: at + 0.1 };
        return [...split(a, depth + 1), ...split(b, depth + 1)];
      };
      const list = split(R, 0).sort((p, q) => (q.x1 - q.x0) * (q.y1 - q.y0) - (p.x1 - p.x0) * (p.y1 - p.y0));
      // every home gets somewhere to cook, sleep and wash, however many rooms it has
      const jobs = list.length === 2 ? ["livingKitchen", "bedBath"] : list.length === 3 ? ["livingKitchen", "bedroom", "bathroom"] : ["living", "kitchen", "bedroom", "bathroom", "bedroom", "bedroom", "bedroom", "bedroom"];
      if (list.length === 1) { ROOM.studio(frame(list[0])); return; }  // one room: bed and bath on one side, kitchen on the other
      list.forEach((A, i) => furnish(jobs[i], A));
      // last resort: a home without a bed, toilet or stove looks along every wall for room for it
      const order = [...list].sort((p, q) => (p.x1 - p.x0) * (p.y1 - p.y0) - (q.x1 - q.x0) * (q.y1 - q.y0));
      for (const key of ["toilet", "bed", "stove"]) {
        if (out.some((o) => o.item === key)) continue;
        search: for (const A of key === "toilet" ? order : [...order].reverse()) for (const side of ["W", "E", "N", "S"]) { const F = frame(A, side); const [, sv] = F.size(key, true); for (let u = 0.6; u < F.Lu - 0.6; u += 0.4) if (F.put(key, u, sv / 2 + 0.05, true, { pad: 0.05 })) break search; }
      }
    };
    ROOM.home = (F) => homeRooms(F.R, F.doors || []);
    ROOM.studio = (F) => { const R = F.R, wide = R.x1 - R.x0 >= R.y1 - R.y0; const half = wide ? R.x0 + (R.x1 - R.x0) * 0.5 : R.y0 + (R.y1 - R.y0) * 0.5; furnish("bedBath", wide ? { ...R, x1: half } : { ...R, y1: half }); furnish("kitchen", wide ? { ...R, x0: half } : { ...R, y0: half }); };
    // a narrow hall: things only on one wall, so there's always a way through
    const hallway = (R, theme) => {
      const F = frame(R); const keys = { home: ["dresser", "bookshelf", "pottedPlant"], office: ["cabinet", "bookshelf", "cooler", "pottedPlant"], factory: ["oilDrum", "toolCart", "crate"], warehouse: ["crate", "barrels", "pallet"], police: ["bench", "lockers", "cabinet"] }[theme] || ["crate"];
      for (let u = 2; u < F.Lu - 2; u += rand(3, 6)) { const k = any(keys); const [su, sv] = F.size(k, true); F.put(k, u, sv / 2 + 0.05, true, { pad: 1 }); }
    };
    // a camp: sleeping spots around a fire, footlockers at their feet, a windbreak with poles on one side
    const camp = (cx, cy) => {
      add("campfire", cx, cy, { pad: 0.3 }); const nSpots = ri(5, 8); const rot0 = rng() * Math.PI * 2;
      for (let i = 0; i < nSpots; i++) {
        const a = rot0 + (i / nSpots) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); const radial = Math.abs(ca) >= Math.abs(sa);
        const key = rng() < 0.5 ? "cot" : "bedroll"; const sp = add(key, cx + ca * 3.4, cy + sa * 3.4, { rot: !radial, pad: 0.2 });
        if (sp && rng() < 0.6) add("footlocker", cx + ca * 4.9, cy + sa * 4.9, { rot: radial, pad: 0.1, touch: [sp] });
      }
      const side = any([[0, -1], [0, 1], [-1, 0], [1, 0]]); const along = side[0] === 0; const wallN = ri(2, 3);
      for (let i = 0; i < wallN; i++) { const off = (i - (wallN - 1) / 2) * 3.05; const x = cx + side[0] * 7 + (along ? off : 0), y = cy + side[1] * 7 + (along ? 0 : off); const tw = add("tarpWall", x, y, { rot: !along, pad: 0.02 }); if (tw) { for (const e of [-1, 1]) add("tentPole", x + (along ? e * 1.7 : 0), y + (along ? 0 : e * 1.7), { pad: 0.02 }); } }
      for (let i = 0; i < 2; i++) add("crate", cx + side[0] * 5.5 + (i - 0.5) * 1.1 * (along ? 1 : 0), cy + side[1] * 5.5 + (i - 0.5) * 1.1 * (along ? 0 : 1), { pad: 0.02 });
    };
    // ---- outdoors: clusters, not confetti
    const nature = (kind, R, avoid = [], density = 1) => {
      const area = Math.max(0, (R.x1 - R.x0) * (R.y1 - R.y0)); const pt = () => ({ x: rand(R.x0 + 2, R.x1 - 2), y: rand(R.y0 + 2, R.y1 - 2) });
      const clear = (p, m) => avoid.every((A) => p.x < A.x0 - m || p.x > A.x1 + m || p.y < A.y0 - m || p.y > A.y1 + m) && keepClear.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > m + 3);
      const near = (p, rad) => { const a = rng() * Math.PI * 2, d = rad * Math.sqrt(rng()); return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }; };
      const put = (key, p, size, o = {}) => (clear(p, size / 2 + 0.5) ? add(key, p.x, p.y, { w: size, h: r.mapItems[key].round ? size : undefined, pad: 0.35, ...o }) : null);
      if (kind === "forested") {
        const groves = Math.max(1, Math.min(14, Math.round((area / 700) * density)));
        for (let g = 0; g < groves * 3 && g < 40; g++) { const c = pt(); if (!clear(c, 2)) continue; const rad = rand(5, 10);
          for (let i = 0; i < ri(6, 14); i++) put(rng() < 0.12 ? "bigTree" : "tree", near(c, rad), rand(3, 4.5));
          for (let i = 0; i < ri(3, 7); i++) put(rng() < 0.2 ? "thicket" : "bush", near(c, rad + 3), rand(1.2, 2.4));
          if (rng() < 0.6) { const p = near(c, rad); put("log", p, 3, { rot: rng() < 0.5 }); } if (rng() < 0.6) put("stump", near(c, rad), 0.8); }
        for (let i = 0; i < Math.round((area / 400) * density); i++) put("bush", pt(), rand(1, 2));
        for (let i = 0; i < Math.round((area / 260) * density); i++) put("tree", pt(), rand(3, 4.2));  /* single trees between the groves */
      } else {
        const forms = Math.max(1, Math.min(14, Math.round((area / 900) * density)));
        for (let f = 0; f < forms; f++) { const c = pt(); if (!clear(c, 5)) continue; const b = put("boulder", c, rand(3, 5)); if (b) for (let i = 0; i < ri(2, 4); i++) put(rng() < 0.5 ? "rock" : "smallRock", near(c, 4), rand(1, 2.2)); }
        const dunes = Math.min(4, Math.round((area / 2500) * density)); for (let d = 0; d < dunes; d++) { const c = pt(); const along = rng() < 0.5; for (let i = 0; i < ri(2, 4); i++) put("dune", { x: c.x + (along ? i * 6.5 : 0), y: c.y + (along ? 0 : i * 3.5) }, 6, { w: 6, h: 3, pad: 0.4 }); }
        for (let i = 0; i < Math.round((area / 500) * density); i++) { const c = pt(); if (put("cactus", c, 1) && rng() < 0.3) put("cactus", near(c, 2.5), 1); }
        for (let i = 0; i < Math.round((area / 1800) * density); i++) put("deadTree", pt(), 2.5);
        if (area > 1500 && rng() < 0.8) { const c = pt(); if (clear(c, 3)) { const l1 = add("ruinWall", c.x, c.y, { pad: 0.02 }); const l2 = l1 && add("ruinWall", c.x + 1.25, c.y + 1.75, { rot: true, pad: 0.02, touch: [l1] }); if (l1) add("wreck", c.x + 4, c.y - 2.5, { pad: 0.4 }); } }
      }
    };
    // the map's own idea of how wild it is: a tight forest stays tight. Top up to its counts on whatever ground is left open.
    const topUp = (kind, avoid, density) => {
      const spec = ((r.maps[map.id] || {}).scatter || []).filter(([k]) => (kind === "forested" ? ["tree", "bush", "bigTree", "thicket"] : ["boulder", "rock", "bush", "smallRock", "cactus"]).includes(k));
      if (!spec.length) return;
      const area = map.w * map.h; const blocked = avoid.reduce((t, A) => t + Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)) * Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0)), 0);
      const share = Math.max(0, (area - blocked) / area);
      for (const [key, n, lo, hi] of spec) {
        const want = Math.round(n * share * density); let have = out.filter((o) => o.item === key).length;
        for (let t = 0; t < want * 4 && have < want; t++) {
          const p = { x: rand(B.x0 + 1, B.x1 - 1), y: rand(B.y0 + 1, B.y1 - 1) }; const size = rand(lo, hi);
          if (!avoid.every((A) => p.x < A.x0 - size / 2 || p.x > A.x1 + size / 2 || p.y < A.y0 - size / 2 || p.y > A.y1 + size / 2)) continue;
          if (!keepClear.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > size / 2 + 3)) continue;
          if (add(key, p.x, p.y, { w: size, h: size, pad: 0.4 })) have++;
        }
      }
    };
    // junk around a building, by what it is
    const yard = (S, theme) => {
      const W = S.x1 - S.x0, H = S.y1 - S.y0;
      const row = (key, x, y, n, dx, dy, o = {}) => { const got = []; for (let i = 0; i < n; i++) { const p = add(key, x + i * dx, y + i * dy, { pad: 0.02, touch: got, ...o }); if (p) got.push(p); } return got; };
      if (theme === "factory") { row("oilDrum", S.x0 + 2, S.y0 - 0.9, 6, 0.85, 0); row("oilDrum", S.x1 - 6, S.y1 + 0.9, 5, 0.85, 0); row("crate", S.x1 + 1, S.y0 + 2, 3, 0, 1.05); add("wreck", S.x0 - 5, S.y1 + 4, { pad: 0.5 }); add("pipeRack", S.x0 - 1.2, S.y0 + H / 2, { rot: true, pad: 0.1 }); add("generator", S.x1 + 1.6, S.y1 - 2, { pad: 0.2 }); }
      if (theme === "warehouse") { row("pallet", S.x0 + 3, S.y1 + 1.2, 5, 1.35, 0); row("crateStack", S.x1 + 1.5, S.y0 + 2, 3, 0, 2.05); add("forklift", S.x0 + 6, S.y1 + 4, { pad: 0.4 }); row("barrels", S.x0 - 1.2, S.y0 + 2, 2, 0, 1.7, { rot: true }); }
      if (theme === "home") { add("car", S.x0 + W * 0.3, S.y1 + 3.5, { pad: 0.5 }); add("mailbox", S.x0 + W * 0.6, S.y1 + 2.5, { pad: 0.3 }); add("dumpster", S.x1 + 1.3, S.y0 + 2, { rot: true, pad: 0.2 }); }
      if (theme === "office") { row("car", S.x0 + 3, S.y1 + 4, Math.max(2, Math.floor(W / 6)), 6, 0, { pad: 0.6 }); row("lamppost", S.x0 + 1, S.y1 + 1.2, Math.max(2, Math.floor(W / 10)), 10, 0); }
      if (theme === "police") { row("car", S.x0 + 3, S.y1 + 4, 3, 6, 0, { pad: 0.6 }); row("sandbags", S.x0 + W / 2 - 4, S.y1 + 2.6, 2, 2.2, 0); row("barricade", S.x0 + W / 2 + 3, S.y1 + 2.6, 2, 3.2, 0); }
    };
    // ---- city blocks with streets between: buildings of the setting, or plain concrete; cars park along the curbs
    const city = (theme) => {
      const cell = 28, street = 9; const cols = Math.max(1, Math.floor((map.w + 2) / cell)), rows = Math.max(1, Math.floor((map.h + 2) / cell));
      const ox = -(cols * cell) / 2, oy = -(rows * cell) / 2; const lots = [];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const cx = ox + (i + 0.5) * cell, cy = oy + (j + 0.5) * cell; const w = cell - street - rand(0, 2), h = cell - street - rand(0, 2);
        lots.push({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
      }
      for (const L of lots) {
        if (!inside((L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2, L.x1 - L.x0, L.y1 - L.y0)) continue;
        if (LAYOUT.indoorThemes.includes(theme)) {
          const toward = Math.abs((L.x0 + L.x1) / 2) > Math.abs((L.y0 + L.y1) / 2) ? ((L.x0 + L.x1) / 2 > 0 ? "W" : "E") : (L.y0 + L.y1) / 2 > 0 ? "N" : "S";
          const before = { ...count }; const { In, doors } = shell(L, [toward]); ROOM[theme]({ ...frame(In, toward), doors });
          for (const k of Object.keys(count)) count[k] = before[k] || 0;  /* limits count per building in a city */
        } else { const b = add("building", (L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2, { w: L.x1 - L.x0, h: L.y1 - L.y0, pad: 0 }); if (b) walls.add(b); }
      }
      // the street furniture: lamp posts at even spacing on the sidewalks, cars parked nose to tail, hydrants at corners,
      // dumpsters against the walls, a barricade across one street now and then. One lane always stays clear.
      for (const L of lots) {
        if (!inside((L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2, L.x1 - L.x0, L.y1 - L.y0)) continue;
        const roomS = B.y1 - L.y1 > 5, roomN = L.y0 - B.y0 > 5;
        for (let x = L.x0 + 2; x < L.x1 - 1; x += 10) { if (roomS) add("lamppost", x, L.y1 + 1.2, { pad: 0.2 }); if (roomN) add("lamppost", x, L.y0 - 1.2, { pad: 0.2 }); }
        add("hydrant", L.x1 + 1.2, L.y1 + 1.2, { pad: 0.7 });
        if (rng() < 0.7) add("dumpster", L.x0 - 0.7, L.y0 + rand(2, L.y1 - L.y0 - 2), { rot: true, pad: 0.1 });
        if (roomS && rng() < 0.5) add("mailbox", L.x0 + rand(2, L.x1 - L.x0 - 2), L.y1 + 0.35, { pad: 1 });
        let x = L.x0 + rand(1, 4); while (roomS && x + 4.5 < L.x1) { if (rng() < 0.55) add(rng() < 0.06 ? "bus" : "car", x + 2.25, L.y1 + 3.9, { pad: 0.3 }); x += rand(5, 9); }
        if (theme === "city" && rng() < 0.3) add("rubble", L.x1 + 2, L.y0 + rand(2, 8), { pad: 0.9 });
      }
      if (theme === "city") { const L = any(lots); const row = []; for (let i = 0; i < 2; i++) { const b = add("barricade", L.x1 + 1.5 + i * 3.1, L.y0 - 4.5, { pad: 0.9, touch: row }); if (b) row.push(b); } }
      return lots;
    };
    // ---- choose the plan
    const indoorMap = (r.indoorMaps || []).includes(map.id) || (map.id === "custom" && map.w * map.h <= 1600);
    const outdoorKind = ["forest", "woods"].includes(map.id) ? "forested" : "desert";
    const building = LAYOUT.indoorThemes.includes(themeId);
    if (themeId === "city" && indoorMap) {
      const F = frame({ x0: B.x0 + 0.05, y0: B.y0 + 0.05, x1: B.x1 - 0.05, y1: B.y1 - 0.05 });
      const bar = []; for (let v = 0.5; v + 3 <= F.Lv - 2; v += 3.1) { const b = F.put("barricade", F.Lu * 0.55, v + 1.5, false, { pad: 0.02, touch: bar }); if (b) bar.push(b); }
      F.put("car", F.Lu * 0.3, F.Lv - 1.3, true, { pad: 0.4 }); F.put("dumpster", F.Lu - 1.2, 0.6, true, { pad: 0.2 }); F.put("rubble", F.Lu * 0.75, F.Lv * 0.6, true, { pad: 0.4 }); F.put("lamppost", 0.5, 0.5, true, { pad: 0.1 });
    } else if (map.id === "streets" || themeId === "city") {
      const lots = city(themeId);
      if (["forested", "desert"].includes(themeId)) nature(themeId, B, lots.map((L) => ({ x0: L.x0 - 3, y0: L.y0 - 3, x1: L.x1 + 3, y1: L.y1 + 3 })), 0.4);
    } else if (building && indoorMap) {
      const R = { x0: B.x0 + 0.05, y0: B.y0 + 0.05, x1: B.x1 - 0.05, y1: B.y1 - 0.05 };
      // the way in is at the ends of the room; keep both clear
      const horiz = map.w >= map.h; const ends = horiz ? [{ x: R.x0, y: 0, side: "W" }, { x: R.x1, y: 0, side: "E" }] : [{ x: 0, y: R.y0, side: "N" }, { x: 0, y: R.y1, side: "S" }];
      for (const d of map.w * map.h < 80 ? ends.slice(0, 1) : ends) clearDoor(d, R, map.w * map.h < 80 ? 1.6 : 2, map.w * map.h < 80 ? 1.6 : 2.5);
      if (Math.min(map.w, map.h) < 5) hallway(R, themeId); else if (themeId === "home" && map.w * map.h < 60) ROOM.studio(frame(R)); else ROOM[themeId](frame(R));
    } else if (building) {
      // a building in the middle of the open: walls, doors, the setting inside, its junk around it, wilderness beyond
      const [fw, fh] = LAYOUT.footprint[themeId]; const w = Math.min(fw, map.w * 0.6), h = Math.min(fh, map.h * 0.6);
      const S = { x0: -w / 2, y0: -h / 2, x1: w / 2, y1: h / 2 };
      const { In, doors } = shell(S, ["S", any(["W", "E", "N"])]); ROOM[themeId]({ ...frame(In, "S"), doors }); yard(S, themeId);
      const yardM = Math.max(2.5, Math.min(9, Math.min(map.w - w, map.h - h) / 4));  /* a small map keeps a narrower yard so the wild still shows */
      const yardBox = [{ x0: S.x0 - yardM, y0: S.y0 - yardM, x1: S.x1 + yardM, y1: S.y1 + yardM }];
      nature(outdoorKind, B, yardBox, 0.8); topUp(outdoorKind, yardBox, 0.8);
    } else if (indoorMap && Math.min(map.w, map.h) < 9 && ["tent", "desert", "forested"].includes(themeId)) {
      const F = frame({ x0: B.x0 + 0.05, y0: B.y0 + 0.05, x1: B.x1 - 0.05, y1: B.y1 - 0.05 });
      if (themeId === "tent") { for (let u = 2.5; u + 1 < F.Lu - 2.5; u += 2.4) { const cot = F.put(rng() < 0.5 ? "cot" : "bedroll", u, 0.95, false, { pad: 0.1 }); if (cot) F.put("footlocker", u, 2.05, true, { pad: 0.02, touch: [cot] }); } }
      else { const keys = themeId === "desert" ? ["smallRock", "cactus", "smallRock"] : ["bush", "stump", "bush"]; for (let u = 2; u < F.Lu - 2; u += rand(2.5, 5)) { const k = any(keys); const side = rng() < 0.5 ? "near" : "far"; const sv = r.mapItems[k].h; F.put(k, u, side === "near" ? sv / 2 + 0.05 : F.Lv - sv / 2 - 0.05, true, { pad: 1.3 }); } }
    } else if (themeId === "tent") {
      if (indoorMap) camp(0, 0); else { camp(0, 0); if (map.w * map.h > 15000) camp(any([-1, 1]) * map.w * 0.25, any([-1, 1]) * map.h * 0.25); nature(outdoorKind, B, [{ x0: -10, y0: -10, x1: 10, y1: 10 }], 0.7); topUp(outdoorKind, [{ x0: -10, y0: -10, x1: 10, y1: 10 }], 0.7); }
    } else {
      const kind = themeId === "forested" ? "forested" : "desert";
      nature(kind, B, indoorMap ? [{ x0: -1.5, y0: -1.5, x1: 1.5, y1: 1.5 }] : [], indoorMap ? 1.6 : 1); if (!indoorMap && kind === outdoorKind) topUp(kind, [], 1);
    }
    return out;
  }
  /** Walking check for a layout: free ground on a grid, the largest connected area, and what touches it. Used by the tests and the DM's report. */
  function layoutReach(objs, map, step = 0.5, open = ["bedroll", "pallet"]) {
    const nx = Math.ceil(map.w / step), ny = Math.ceil(map.h / step); const blocked = new Uint8Array(nx * ny);
    // a cell is blocked when its center is within 0.2m (half a shoulder) of something
    const body = 0.2;
    for (const o of objs) { if (open.includes(o.item)) continue; const x0 = Math.max(0, Math.ceil((o.x - o.w / 2 - body + map.w / 2) / step - 0.5)), x1 = Math.min(nx - 1, Math.floor((o.x + o.w / 2 + body + map.w / 2) / step - 0.5)), y0 = Math.max(0, Math.ceil((o.y - o.h / 2 - body + map.h / 2) / step - 0.5)), y1 = Math.min(ny - 1, Math.floor((o.y + o.h / 2 + body + map.h / 2) / step - 0.5)); for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) blocked[j * nx + i] = 1; }
    const comp = new Int32Array(nx * ny).fill(-1); let best = -1, bestN = 0, k = 0, free = 0;
    for (let s = 0; s < nx * ny; s++) { if (blocked[s] || comp[s] >= 0) continue; let size = 0; const q = [s]; comp[s] = k; while (q.length) { const c = q.pop(); size++; const i = c % nx, j = (c / nx) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const t = b * nx + a; if (!blocked[t] && comp[t] < 0) { comp[t] = k; q.push(t); } } } free += size; if (size > bestN) { bestN = size; best = k; } k++; }
    const cellOf = (x, y) => { const i = Math.floor((x + map.w / 2) / step), j = Math.floor((y + map.h / 2) / step); return i >= 0 && j >= 0 && i < nx && j < ny ? j * nx + i : -1; };
    // can someone stand within reach (1.2m) of it? every grid cell in that ring is checked
    const reachable = (o, m = 1.2) => { const i0 = Math.floor((o.x - o.w / 2 - m + map.w / 2) / step), i1 = Math.floor((o.x + o.w / 2 + m + map.w / 2) / step), j0 = Math.floor((o.y - o.h / 2 - m + map.h / 2) / step), j1 = Math.floor((o.y + o.h / 2 + m + map.h / 2) / step); for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) if (comp[j * nx + i] === best) return true; return false; };
    return { share: free ? bestN / free : 1, reachable, inMain: (p) => { const c = cellOf(p.x, p.y); return c >= 0 && comp[c] === best; } };
  }

  // ---- rules with conditions: "vs robots", "first turn", "only with pistols".
  function enemyType(e, r) {
    if (!e || e.kind === "pc") return "human";
    const name = low(e.tmpl || e.name);
    for (const [type, pattern] of Object.entries(r.enemyTypes || {})) if (new RegExp(pattern, "i").test(name)) return type;
    return e.mob ? "animal" : "human";
  }
  /** s describes this exact moment: shooter's weapon, target, range, round and so on. Does the rule's condition hold? */
  function whenHolds(w, s, r) {
    if (w.types && !(s.o && w.types.includes(s.o.type))) return false;
    if (w.tabs && !(s.o && w.tabs.includes(s.o.tab))) return false;
    if (w.vs && !w.vs.includes(s.vs)) return false;
    if (w.firstTurn && s.round !== 1) return false;
    if (w.afterFirst && s.round <= 1) return false;
    if (w.sneak && !s.sneak) return false;
    if (w.secondary && s.mode !== "se") return false;
    if (w.auto && !(s.o && s.o.auto)) return false;
    if (w.silenced && !(s.o && /silenc/i.test(`${s.o.n} ${s.o.note || ""}`))) return false;
    if (w.magFull && !s.magFull) return false;
    if (w.inCover && !s.inCover) return false;
    if (w.targetMelee && !s.targetMelee) return false;
    if (w.sameTarget && !s.sameTarget) return false;
    if (w.oneHanded && !(s.o && r.oneHanded.includes(s.o.type))) return false;
    if (w.rangeMin != null && !(s.range >= w.rangeMin)) return false;
    if (w.rangeMax != null && !(s.range <= w.rangeMax)) return false;
    if (w.part && s.part !== w.part) return false;
    if (w.armor && !s.armorTypes.some((t) => new RegExp(w.armor, "i").test(t))) return false;
    if (w.attackerTabs && !(s.attackerO && w.attackerTabs.includes(s.attackerO.tab))) return false;
    if (w.attackerAuto && !(s.attackerO && s.attackerO.auto)) return false;
    if (w.hpBelow != null && !(s.hpShare < w.hpBelow)) return false;
    if (w.hpAbove != null && !(s.hpShare > w.hpAbove)) return false;
    if (w.moved && !s.moved) return false;
    if (w.notMoved && s.moved) return false;
    if (w.melee && !(s.o && s.o.tab === "MW")) return false;
    if (w.vsMob && !s.targetMob) return false;
    if (w.attackerMob && !s.attackerMob) return false;
    if (w.afterCrit && !s.afterCrit) return false;
    if (w.lightLoad && !s.lightLoad) return false;
    if (w.hpHigher && !s.hpHigher) return false;
    if (w.armorFaction && !s.armorFaction) return false;
    if (w.weaponStatus && !(s.o && new RegExp(w.weaponStatus, "i").test(String(s.o.status || "")))) return false;
    if (w.nameRe && !(s.o && new RegExp(w.nameRe, "i").test(s.o.n || ""))) return false;
    if (w.items && !w.items.includes(s.item)) return false;
    if (w.cats && !w.cats.includes(s.itemCat)) return false;
    return true;
  }
  /** A copy of someone's numbers with every condition that holds right now added in. Used for each shot, on both shooter and target. */
  function forShot(d, e, s, ctx) {
    const r = ctx.rules; const m = { ...d.m }; const skills = { ...d.skills }; const sp = { ...d.sp }; let extraDt = 0, extraAp = 0;
    const g = e.gear || {};
    const worn = [g.head, g.armor].map((n) => n && get(ctx, n)).filter(Boolean);
    // armorTypes holds the type and the name, so a rule can say "Light" or "riot" or "reflect".
    const s2 = { ...s, hpShare: d.hp ? (e.hp || 0) / d.hp : 1, armorTypes: worn.map((h) => `${h.o.type || ""} ${h.o.n}`), armorFaction: worn.some((h) => h.o.faction), lightLoad: d.enc && d.enc.total <= d.carry / 2 };
    for (const row of d.cond || []) {
      if (Object.keys(row.when).every((k) => k === "hpBelow" || k === "hpAbove")) continue;  // already counted in derive
      if (!whenHolds(row.when, s2, r)) continue;
      // Some rules grow with what has happened: rounds gone by, burst size, kills, hits taken and so on.
      const w = row.when; const scale = w.perRound ? Math.max(0, s.round - 1) : w.per2Rounds ? Math.floor(Math.max(0, s.round - 1) / 2) : w.perCount ? (s.o && s.o.count) || 1 : w.perRange ? s.range || 1 : w.perKillHuman ? s.killsHuman || 0 : w.perHitTaken ? s.hitsTaken || 0 : w.perAfraid ? s.afraid || 0 : w.perBleed ? s.targetBleed || 0 : w.perDebuff ? s.targetDebuffs || 0 : w.perStreak ? s.streak || 0 : w.perStill ? s.still || 0 : w.perCaps100 ? Math.floor((e.caps || 0) / 100) : 1;
      for (const [k, v] of Object.entries(row.mods || {})) {
        if (typeof v !== "number") continue;
        const x = fix(v * scale);
        if (k === "weaponSkill") { if (s.o && s.o.skill && s.o.skill in skills) skills[s.o.skill] += x; continue; }
        if (k in skills) skills[k] += x; else if (k in sp) sp[k] = (sp[k] || 0) + x; else if (k === "dt") extraDt += x; else if (k === "ap") extraAp += x; else m[k] = fix((m[k] || 0) + x);
      }
    }
    return { ...d, m, skills, sp, dt: d.dt + extraDt, ap: d.ap + extraAp };
  }

  // ---- one list of every effect the rules can apply automatically. The Variables dev window shows this table.
  const VARS = {
    S: "Strength", P: "Perception", E: "Endurance", C: "Charisma", I: "Intelligence", A: "Agility", L: "Luck",
    hp: "Max HP, flat", hpMul: "Max HP, multiplier", hpPct: "Max HP, percent", ap: "Max AP, flat", apMul: "Max AP, percent", dt: "Damage Threshold, flat", dtPct: "Damage Threshold, percent", pri: "Initiative", save: "Saving throw", carry: "Carry weight, flat", carryMul: "Carry weight, percent", pts: "Skill points per level",
    acc: "Hit chance", enemyAcc: "Enemies' hit chance against you", dam: "Damage dealt, percent", dmgTaken: "Damage taken, percent", crit: "Crit chance", apCost: "AP cost of attacks", reload: "AP cost of reloads", pen: "Penetration", "r1 to r10": "Hit chance at that range band",
    heal: "Healing received, percent", regen: "HP gained each round", dot: "HP lost each round", turns: "How long it lasts", mvm: "Walking speed, percent", immobile: "Can't walk", xpMul: "XP earned, percent", buy: "Vendor buy price, percent", sell: "Vendor sell price, percent", resistMental: "Mental status resistance (shown, DM decides)", resistPhysical: "Physical status resistance (shown, DM decides)",
    critMult: "Crit damage multiplier, added", superMult: "Super crit multiplier, added", critDam: "Extra damage on any crit, percent", headMult: "Head shot multiplier, added", critToSuper: "Crits count as super crits", superKill: "Super crits kill outright", superRoll: "Widens the super crit band", failRoll: "Widens the jam band", enemyFail: "Widens enemies' jam band (shown, DM decides)", critBleed: "Crits also apply Bleeding at this tier", knockChance: "Chance a hit knocks the target out", debuffCh: "Chance to apply a status, percent", debuffEff: "Strength of statuses you apply (shown, DM decides)",
    apCostMul: "Multiplies a weapon's AP cost", reloadMul: "Reload AP, percent", count: "Burst count", jam: "Jam chance", magAdd: "Magazine size, flat", magPct: "Magazine size, percent", damFlat: "Flat damage on the second melee attack", targetFree: "Aimed shots cost no extra AP", swapFree: "Swapping weapons costs no AP", itemFree: "Using items costs no AP", itemAP: "AP cost of items", clearJamAdd: "AP cost of clearing jams", moveAdd: "Extra AP for every move",
    chemEff: "Strength of chems, percent", chemDur: "Duration of chems, percent", addict: "Addiction chance, percent", endHeal: "Heal this share of max HP after combat", killAP: "Regain this share of AP on a kill", apOnHit: "Gain this much AP when hit", enemyInit: "Enemies' initiative", lightHalf: "Items of 2 lb or less weigh half", traitScale: "All trait effects, percent", setC: "Sets Charisma to this",
    "resist:Status": "Lowers that status's tier when it lands on you", weaponSkill: "Skill with weapons the rule names", healOut: "Healing you give, percent", accMul: "Multiplies final hit chance", nightPen: "Share of night penalties that still apply", critPerRange: "Crit chance multiplied by range band", superIgnoreDT: "Super crits ignore DT", critNoAmmo: "Crits use no ammo", critKnock: "Crits knock the target out", hitBleed: "Hits apply Bleeding at this tier", critDisorient: "Crits apply Disoriented at this tier", critLimb: "Crits cripple a random limb", crippleTaken: "Limb injuries on you are one tier worse", limbMult: "Limb hit multiplier on you, added", speechCap: "Highest your Speech can be", startAfraid: "Afraid tier at the start of each fight", noEW: "Can't use energy weapons", noItems: "Can't use items in a fight", capsMul: "Extra caps looted, percent", ammoWeight: "Ammo weight, percent", capsNoWeight: "Caps weigh nothing", counterAP: "AP cost of counter items", drinkAP: "AP cost of drinks", swapFreeMelee: "Free swap to melee", swapFreePistol: "Free swap to a pistol", saveMul: "Saving throw odds, percent", lucky: "A chosen last digit always crits", vengeful: "Your next hit crits after you take a crit", inspire: "Adds the Inspire action", auraEnemyAcc: "Enemies' hit chance on allies close to you", debuffAdd: "Status chance, added in percent", moveMaxM: "Farthest you can walk in one move", ignoreTier: "Ignores harmful statuses up to this tier", lunge: "Melee can reach R2",
    ...Object.fromEntries(SKILLS.map(([k, n]) => [k, n + " skill"])),
  };
  const ALIAS = { bleed: "Bleeding", bleeding: "Bleeding", burn: "Burned", burned: "Burned", poison: "Poisoned", poisoned: "Poisoned", irradiated: "Irradiated", "crippled limb": "Injured Limb (Leg/Arm)", electrocuted: "Electrocuted", afraid: "Afraid", blinded: "Blinded", disoriented: "Disoriented" };
  /**
   * Turns the workbook's written effects into variables the rules can use. Runs when the app opens and after an import.
   * Rows you import with their own fx or use columns keep them, so off-app edits win.
   * Returns a list of everything it couldn't turn into a variable, for the skipped list.
   */
  function standardize(data, r) {
    const skipped = [];
    const worth = (o) => Object.keys(o).filter((k) => k !== "turns").length > 0;
    // ---- statuses: one set of variables per tier. Cover moved to the rules (Settings) since the map handles it now.
    data.statuses = data.statuses.filter((s) => s.n !== "Cover");
    for (const s of data.statuses) {
      const src = JSON.stringify(s.tiers || []);
      if (!s.fx || s.fxFrom !== src) s.fx = (s.tiers || []).map((t) => {
        const m = parseEffect(t, s.tone !== "Negative");
        for (const [k, v] of Object.entries(parseGear(t))) if (m[k] == null) m[k] = v;  // "-10 Speech" and other skills
        Object.assign(m, (r.statusRules || {})[s.n]);
        // "-3 HP" on a status is read as lower max HP. Items handle HP changes as heals instead.
        for (const [, n] of String(t).matchAll(/-(\d+) HP\b(?! per)/g)) m.hp = (m.hp || 0) - Number(n);
        return m;
      });
      s.fxFrom = src;
      const tiers = (s.tiers || []).filter(Boolean);
      if (!tiers.length) skipped.push(["Status", s.n, "Blank in the workbook, so it has no numbers. It can still be applied and removed."]);
      else if (s.fx.every((f) => !worth(f))) skipped.push(["Status", s.n, `Text only, needs the DM: "${tiers[0].slice(0, 60)}"`]);
    }
    const RESIST = { poison: "Poisoned", radiation: "Irradiated", sick: "Sick", weak: "Weak", hunger: "Hunger", bleed: "Bleeding", bleeding: "Bleeding", burn: "Burned", blind: "Blinded", electrocute: "Electrocuted", cold: "Frozen" };
    // ---- consumables
    const SKIP_CATS = new Set(["Healing", "Tool", "Literature"]);
    for (const i of data.items) {
      const t = String(i.effect || "");
      if (i.use && i.useFrom === t) continue;  // already read. Change the written effect in a pack and this row is read again.
      i.useFrom = t;
      const use = { heal: null, applies: [], reduces: {}, removes: [], fx: {}, after: null };
      // Heals are read by parseHeal when used, because they depend on who is healing whom.
      const healing = parseHeal(t); if (healing) use.heal = true;
      // Numbers: "+2 STR", "-10% Hit Chance", "STR +3".
      Object.assign(use.fx, parseEffect(t.replace(/\d+\s*\+?\s*HP\b[^,]*/, "")));
      for (const [k, v] of Object.entries(parseGear(t))) if (use.fx[k] == null) use.fx[k] = v;
      for (const [, n] of t.matchAll(/chance to hit\s*-\s*(\d+)/gi)) use.fx.acc = -Number(n) / 100;
      const hpUp = t.match(/\bHP \+(\d+)/); if (hpUp) { use.fx.hp = Number(hpUp[1]); use.heal = null; }
      delete use.fx.turns;
      // Painkillers: the workbook's "-25% Damage" on Med-X and friends means damage you take, not damage you deal.
      if (i.cat === "Chem/Drug" && use.fx.dam < 0) { use.fx.dmgTaken = use.fx.dam; delete use.fx.dam; }
      // "x1.5 AP" on a drug multiplies AP.
      // Lowers a status: "Bleeding -1 Tier", "Afraid -1", "Blinded/Disoriented -2 Tier".
      for (const [, names, n] of t.matchAll(/((?:Blinded\/Disoriented)|Crippled Limb|Bleed(?:ing)?|Burn(?:ed)?|Poison(?:ed)?|Irradiated|Electrocuted|Afraid)\s*-\s*(\d)/gi)) for (const w of names.split("/")) use.reduces[ALIAS[low(w)]] = Number(n);
      // Removes a status: "Counters disoriented", "Blind Removed".
      if (/counters disoriented/i.test(t)) use.removes.push("Disoriented");
      if (/heal limb damage/i.test(t)) use.reduces["Injured Limb (Leg/Arm)"] = 1;
      if (/revive downed ally/i.test(t)) use.revive = true;  // Surgeon's Kit is the one item the workbook says can stand someone up
      const adds = t.match(/^Adds (\d+) (.+)$/i); if (adds) use.gives = [adds[2], Number(adds[1])];
      const healBoost = t.match(/Healing \+(\d+)%/i); if (healBoost) use.fx.heal = Number(healBoost[1]) / 100;
      // Resist X: that status lands one tier lower while this is active.
      for (const [, w] of t.matchAll(/Resist (\w+)/gi)) { const st = RESIST[low(w)]; if (st) use.fx["resist:" + st] = 1; }
      if (/temporarily removes all status effects/i.test(t)) use.numb = true;
      const lim = t.match(/(?:reduces limb damage multiplier by \.(\d)|-(\d+)% Limb Damage)/i); if (lim) use.fx.limbMult = lim[1] ? -Number(lim[1]) / 10 : -Number(lim[2]) / 100;
      const repairs = t.match(/Improves Weapon Con by Rep\/(\d+)/i); if (repairs) use.repairDiv = Number(repairs[1]);
      if (/blind removed/i.test(t)) use.removes.push("Blinded");
      // Poisons: "2+ Poison" applies Poisoned at that tier.
      const poison = t.match(/(\d)\+\s*Poison/i); if (poison) use.applies.push({ n: "Poisoned", tier: Number(poison[1]) });
      // Which status does this substance count as?
      const byName = Object.entries(r.substanceByName || {}).find(([re]) => new RegExp(re, "i").test(i.n));
      const sub = r.substances[i.n] || (/^Beer\b/.test(i.n) ? r.substances.Beer : null) || (byName && byName[1]) || (!t && (r.substanceByCat || {})[i.cat]) || null;
      const numeric = worth(use.fx);
      if (sub) {
        // The first status carries the item's exact numbers. Extra statuses are labels, so nothing counts twice.
        sub.forEach(([n, tier, guess], ix) => {
          if (!data.statuses.some((x) => x.n === n)) return;
          const a = { n, tier }; if (numeric) a.fx = ix === 0 ? { ...use.fx } : {};
          use.applies.push(a);
        });
        if (numeric) use.fx = {};
      } else if (!numeric && !healing && !worth(use.reduces) && !use.removes.length && !use.applies.length && !use.gives && !use.numb && !use.repairDiv && !use.revive && !/jack shit/i.test(t)) {
        if (i.effect) skipped.push(["Item", i.n, `Text only, needs the DM: "${t.slice(0, 70)}"`]);
        else if (!SKIP_CATS.has(i.cat)) skipped.push(["Item", i.n, "No effect written in the workbook, so nothing was changed."]);
      }
      // What comes after it wears off: "Hangover: -5 chance to hit", "Comedown: -5 AP", or a plain "INT -2".
      if (i.after) {
        const a = String(i.after); const after = /hangover/i.test(a) ? "Hangover" : /^Shock/i.test(a) ? "Shock" : /^Radiation/i.test(a) ? "Irradiated" : "Fatigue";
        const fx = { ...parseEffect(a, false), ...parseGear(a) }; delete fx.turns;
        for (const [, n] of a.matchAll(/-\s?(\d+) chance to hit/gi)) fx.acc = -Number(n) / 100;
        use.after = worth(fx) ? { n: after, tier: 1, fx, text: a } : { n: after, tier: 1 };
      }
      i.use = use;
    }
    // ---- armor: buffs and nerfs as variables. Accessories already have rows in the Stat Converter table.
    for (const a of data.armor) {
      if (a.loc === "Accessory") continue;
      const armorSrc = `${a.buffs || ""}|${a.nerfs || ""}`; if (a.fx !== undefined && a.fxFrom === armorSrc) continue; a.fxFrom = armorSrc;
      const all = `${a.buffs || ""},${a.nerfs || ""},${a.mech || ""}`;
      const fx = parseGear(`${a.buffs || ""}, ${a.nerfs || ""}`);
      // Armor text that isn't a plain number: resistances, "- 1 AP to fire", "Cannot wear accessories".
      for (const [word, st] of [[/poison|poisioin/i, "Poisoned"], [/bleeding/i, "Bleeding"], [/radiation/i, "Irradiated"]]) if (word.test(all)) fx["resist:" + st] = 1;
      const fire = all.match(/-\s*(\d+) AP to fire/i); if (fire) fx.apCost = -Number(fire[1]);
      if (/cannot wear accessories/i.test(all)) fx.noAccessories = 1;
      if (worth(fx)) a.fx = fx;
    }
    // ---- level perks: only effects that are plain numbers. Everything else stays a reminder.
    const PERK = [
      [/^Improves AP by (\d+)/i, "ap"], [/^Improves DT by (\d+)/i, "dt"], [/^Permanently Gain (\d+) DT/i, "dt"], [/^Improves PEN by (\d+)$/i, "pen"], [/^Improves PRI by (\d+)$/i, "pri"], [/^Improves Saving throw by (\d+)/i, "save"], [/^(\d+)\+ HP$/i, "hp"], [/^(\d+)\+ base Intiative$/i, "pri"], [/^Increases physical status eff\. resistance by (\d+)/i, "resistPhysical"], [/^Increases phychological status eff\. resistance by (\d+)/i, "resistMental"],
    ];
    const PERKPCT = [[/^Improves buy prices by (\d+)%/i, "buy", -1], [/^Improves active inventory by (\d+)%/i, "carryMul", 1]];
    const seen = new Set();
    for (const p of data.levelPerks) {
      if (!p.effect) continue;
      const t = String(p.effect).trim();
      if (p.rows && p.fxFrom === t) continue;
      p.fxFrom = t;
      // First the written table in rules.js, then simple sentences like "Improves AP by 1".
      if (r.perkRules && r.perkRules[p.n]) { p.rows = r.perkRules[p.n]; p.fx = p.rows[0].fx; if (p.rows[0].when) p.when = p.rows[0].when; continue; }
      const fx = {};
      for (const [re, k] of PERK) { const m = t.match(re); if (m) fx[k] = Number(m[1]); }
      for (const [re, k, sign] of PERKPCT) { const m = t.match(re); if (m) fx[k] = sign * Number(m[1]) / 100; }
      const big = t.match(/^When below (\d+)% Health gain \+(\d+) AP, \+(\d+) DT, and \+(\d+)% Damage/i);
      if (big) { p.fx = { ap: Number(big[2]), dt: Number(big[3]), dam: Number(big[4]) / 100 }; p.when = { hpBelow: Number(big[1]) / 100 }; p.rows = [{ fx: p.fx, when: p.when }]; continue; }
      const when = t.match(/when health is below (\d+)%/i);
      if (worth(fx)) { p.fx = fx; if (when) p.when = { hpBelow: Number(when[1]) / 100 }; p.rows = [{ fx, when: p.when }]; } else if (!seen.has(t)) { seen.add(t); skipped.push(["Level perk", p.n, `For the DM: "${t.slice(0, 80)}"`]); }
    }
    // ---- Stat Converter rows (traits, skill perks, accessories, mods): their reminder notes become variables and conditions.
    const tr0 = (row) => (r.traitRules || {})[row.n];
    const NOTE_KEYS = { "crit mult": "critMult", "super crit mult": "superMult", "crit d": "critDam", "head mult": "headMult", "ap cost": "apCostMul", "chem eff": "chemEff", "addict ch": "addict", "debuff ch": "debuffCh", "debuff eff": "debuffEff", count: "count", "fail ch": "jam", "super crit roll": "superRoll", "super fail roll": "failRoll", "enemy fail roll": "enemyFail", buy: "buy", sell: "sell" };
    const NOTE_WHEN = [[/^vs\.? humans?$/i, { vs: ["human"] }], [/^(?:vs\.? robots?|if robot)$/i, { vs: ["robot"] }], [/^(?:when|if) sneak$/i, { sneak: true }], [/^if first turn$/i, { firstTurn: true }], [/^only if \(MAGAZINE=CAPACITY\)$/i, { magFull: true }], [/^(?:if silencer|when silenced)$/i, { silenced: true }], [/^when one handed$/i, { oneHanded: true }], [/^when power armor$/i, { armor: "Power" }], [/^<\s*25%$/, { hpBelow: 0.25 }], [/^only for movement$/i, null]];
    for (const row of data.sc) {
      if (row.noteFrom === (row.note || "") && row.parsed) continue;
      row.noteFrom = row.note || ""; row.parsed = true;
      const when = {}; const left = [];
      for (const raw of String(row.note || "").split(";").map((x) => x.trim()).filter(Boolean)) {
        const only = raw.match(/^Meant only for: (.+)$/i);
        if (only) { when.types = only[1].split(",").map((x) => x.trim()); continue; }
        if (/^Not automated:/i.test(raw)) {
          for (const part of raw.replace(/^Not automated:\s*/i, "").split(",")) {
            const m = part.trim().match(/^(.+?)\s*(\+\/-|\*|\/|\+)?\s*(-?[\d.]+)$/);
            const key = m && NOTE_KEYS[low(m[1])];
            if (m && /^capacity$/i.test(m[1])) { row.mods = { ...(row.mods || {}), [m[2] === "*" ? "magPct" : "magAdd"]: Number(m[3]) }; continue; }
            if (!key) { left.push(part.trim()); continue; }
            // "Chem Eff * 2.0" means double, so it's stored as +100%. "* -0.5" is already a percent.
            const val = key === "chemEff" && Number(m[3]) > 0 ? fix(Number(m[3]) - 1) : Number(m[3]);
            row.mods = { ...(row.mods || {}), [key]: val };
          }
          continue;
        }
        const hit = NOTE_WHEN.find(([re]) => re.test(raw));
        if (hit) { if (hit[1]) Object.assign(when, hit[1]); else left.push(raw); continue; }
        if (/if "?super"?.*instakill|instakill on "?super/i.test(raw)) { row.mods = { ...(row.mods || {}), superKill: 1 }; if (/sneak/i.test(raw)) when.sneak = true; continue; }
        const kp = raw.match(/^Carry \/(\d)$/); if (kp) { row.mods = { ...(row.mods || {}), carryMul: 1 / Number(kp[1]) - 1 }; continue; }
        left.push(raw);
      }
      if (Object.keys(when).length) row.when = when;
      row.note = left.join("; ");
      if (!row.note) delete row.note;
      // The rule tables in rules.js settle whatever the note parser couldn't.
      const nr = (r.noteRules || {})[row.n];
      if ((nr || tr0(row)) && !row.sheetMods) row.sheetMods = row.mods || {};  // keeps the workbook's own numbers for comparing against the sheet
      if (nr) { if (nr.fx) row.mods = { ...(row.mods || {}), ...nr.fx }; if (nr.when) row.when = { ...(row.when || {}), ...nr.when }; delete row.note; }
      const tr = (r.traitRules || {})[row.n];
      if (tr) { row.mods = { ...(row.mods || {}) }; for (const x of tr) Object.assign(row.mods, x.fx); if (tr[0].when) row.when = { ...(row.when || {}), ...tr[0].when }; delete row.note; }
    }
    for (const row of data.sc) if (row.note) skipped.push([row.cat || "Row", row.n, `For the DM: "${row.note.slice(0, 90)}"`]);
    // Traits the workbook only describes in words: the rule table in rules.js.
    const hasRow = new Set(data.sc.map((x) => low(x.n)));
    for (const t of data.traits) {
      const rule = r.traitRules && r.traitRules[t.n];
      if (rule) { if (!hasRow.has(low(t.n))) t.rows = rule; continue; }  // a trait with a row already got its rule above
      if (!hasRow.has(low(t.n))) skipped.push(["Trait", t.n, `For the DM: "${String(t.ben || "").slice(0, 70)}"`]);
    }
    for (const m of data.mods) if (!hasRow.has(low(m.n))) skipped.push(["Weapon mod", m.n, `Text only: "${String(m.effect || "blank").slice(0, 60)}"`]);
    return skipped;
  }

  return { floorOf, ammoClass, blastDamage, layoutReach, LAYOUT, story, weaponFamily, npcSkills, tierReq, npcName, inside, trunkOf, VARS, standardize, forShot, whenHolds, enemyType, lineCover, pathBlocked, generateRoom, coverTier, SPECIAL, SPECIAL_NAMES, SKILLS, low, fix, makeDb, get, weightOf, parseEffect, parseHeal, healAmount, statusInfo, activeRows, derive, saveTarget, weaponView, loadsFor, hitChance, hitLine, bands, classify, bandSpans, bandText, bullets, damage, resolve, checkNeeded, checkResult, checkOdds, xpFor, levelForXp, xpGain, gearUp, spawn, makeBoss, rollCaps, pct, two, poolFor, isUnique, parseGear, vendorStock, valueOf, barterFactors, optimalRange };
})();
if (typeof module !== "undefined") module.exports = E;
