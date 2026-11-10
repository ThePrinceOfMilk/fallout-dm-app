// Balance test: weapons, armor, ammo and enemies, run through the app's own combat math.
// node balance.js [out.json]   (from app/). Every attack is scored exactly over all 100 rolls (00-99); duels are seeded Monte Carlo.
// Assumptions, stated in the report: a player at tier T is level 5T-2 with SPECIAL S6 P6 E6 C5 I6 A5 L6 (10 AP),
// skill equal to what a typical weapon of the tier asks for (the same rule the enemy generator uses), and the tier's median armor.
const fs = require("fs");
const E = require("./src/engine.js");
const { DEFAULT_RULES } = require("./src/rules.js");
const data = JSON.parse(fs.readFileSync("./tests/data.json", "utf8"));
const rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
// What-if knobs, for testing a fix before making it: BAL_HITSHIFT=0.15 (add to every gun's hit row), BAL_MELEEBASE=0.35, BAL_CREATUREPEN=4 (Pen per tier on creature attacks)
const knob = (k) => (process.env[k] != null && process.env[k] !== "" ? Number(process.env[k]) : null);
if (knob("BAL_HITSHIFT")) for (const w of data.weapons) if (w.tab !== "MW" && w.hit) w.hit = w.hit.map((x) => (x == null ? x : x + knob("BAL_HITSHIFT")));
if (knob("BAL_MELEEBASE") != null) for (const w of data.weapons) if (w.tab === "MW") w.base = knob("BAL_MELEEBASE");
if (knob("BAL_CREATUREPEN")) for (const e of data.enemies) if (e.mob) for (const n of [e.w1, e.w2]) { const w = data.weapons.find((x) => x.n === n && !x.tier); if (w) w.pen = Math.max(w.pen || 0, knob("BAL_CREATUREPEN") * e.tier); }
// BAL_TABS=SG,MW keeps only those weapon tabs (creature attacks always stay), so enemies are generated from them alone
if (process.env.BAL_TABS) { const keep = process.env.BAL_TABS.split(","); data.weapons = data.weapons.filter((w) => !w.tier || keep.includes(w.tab)); }
if (knob("BAL_CRITALL") === 0) rules.critAllBullets = false;
if (knob("BAL_FLOOR") != null) rules.damageFloor = knob("BAL_FLOOR");
if (knob("BAL_MELEEAP")) for (const w of data.weapons) if (w.tab === "MW" && w.tier) { if (w.ap) w.ap = Math.ceil(w.ap * knob("BAL_MELEEAP")); if (w.ap2) w.ap2 = Math.ceil(w.ap2 * knob("BAL_MELEEAP")); }
if (knob("BAL_BURSTAP")) for (const w of data.weapons) if (w.tab !== "MW" && (w.count || 1) > 1 && w.ap) w.ap += knob("BAL_BURSTAP");
if (knob("BAL_MOBHP")) for (const e of data.enemies) if (e.mob && e.tier >= 5 && e.hp) e.hp = Math.round(e.hp * knob("BAL_MOBHP"));
const db = E.makeDb(data);
// Rule what-ifs that live in code: BAL_PCHP (player HP per level), BAL_PCAP (extra player AP), BAL_NPCHP (enemy human HP per tier, now 6), BAL_NPCDT (enemy human DT multiplier), BAL_SKILLDIV (skill slope divisor, now 200)
const derive0 = E.derive;
E.derive = (e, c) => {
  const d = derive0(e, c);
  if (e.kind === "pc") { if (knob("BAL_PCHP") != null) d.hp += Math.round(((e.level || 1) - 1) * (knob("BAL_PCHP") - 1)); if (knob("BAL_PCAP")) d.ap += knob("BAL_PCAP"); }
  else if (!e.mob) { if (knob("BAL_NPCHP") != null) d.hp -= ((e.tier || 1) - 1) * (6 - knob("BAL_NPCHP")); if (knob("BAL_NPCDT") != null) d.dt = Math.round(d.dt * knob("BAL_NPCDT")); }
  return d;
};
const hit0 = E.hitChance;
E.hitChance = (att, A, tgt, T, v, range, c, cover) => {
  const r = hit0(att, A, tgt, T, v, range, c, cover);
  if (!r.noData && knob("BAL_SKILLDIV")) { const sk = Math.min(A.skills[v.skill] || 0, rules.overskillCap); r.raw += (sk - v.req) / knob("BAL_SKILLDIV") - (sk - v.req) / 200; r.hit = Math.min(r.raw, rules.maxHit); }
  return r;
};
const ctx = { db, rules, scene: { effects: [] }, ov: {} };
const TIERS = [1, 2, 3, 4, 5, 6];
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const med = (a) => { const s = a.filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const lowTab = { SG: "Small Guns", BG: "Big Guns", EW: "Energy Weapons", MW: "Melee", EX: "Explosives" };
const bandFor = (m) => { const i = rules.bandMeters.findIndex((b) => m <= b + 1e-9); return i < 0 ? 10 : i + 1; };

// ---------------------------------------------------------------- reference player
const skillAt = (tier) => Object.fromEntries(["SG", "BG", "EW", "MW", "EXP"].map((k) => [k, E.tierReq(ctx, k, tier)]));
function player(tier, slots, gear = {}) {
  return { id: "pc", kind: "pc", name: "Reference", level: 5 * tier - 2, special: [6, 6, 6, 5, 6, 5, 6], skills: skillAt(tier), gear: { head: gear.head || "", armor: gear.armor || "", acc: [] },
    weapons: slots, activeW: 0, statuses: [], effects: [], inv: [], ov: {}, traits: [], perks: [] };
}
const dummy = { id: "t", kind: "npc", tier: 1, special: [5, 5, 5, 5, 5, 5, 5], skills: {}, gear: {}, weapons: [], statuses: [], effects: [], inv: [], ov: {} };
const dummyD = E.derive(dummy, ctx);

// ---------------------------------------------------------------- ammo: which load a weapon fires
const loads = (cal) => E.loadsFor(ctx, cal);
function standardLoad(w, tier) {
  const all = loads(w.ammo), ok = all.filter((a) => a.ok);
  const fit = ok.filter((a) => (a.tier || 1) <= tier);
  return fit.find((a) => a.load === "Standard") || fit.find((a) => !a.pellets) || fit[0] || ok[0] || null;
}

// the load that does most against this DT, from what the tier can get
function bestLoad(w, tier, dt) {
  const fit = loads(w.ammo).filter((a) => a.ok && a.dam != null && a.pen != null && (a.tier || 1) <= tier);
  let best = null, bv = -1;
  for (const a of fit) { const v = E.damage((a.dam || 0) * (a.pellets || 1), a.pen, dt, 1, 1, rules.damageFloor).raw; if (v > bv) { bv = v; best = a; } }
  return best;
}

// ---------------------------------------------------------------- one attack, scored over every roll
function attackStats(att, A, tgt, T, slot, band, dt) {
  const v = E.weaponView(slot, att, A, ctx);
  if (v.missing || (!v.melee && v.noLoad)) return null;
  const hc = E.hitChance(att, A, tgt, T, v, band, ctx, null);
  if (hc.noData) return null;
  const b = E.bands(hc.hit, v.jam, v.crit, A.superCrit, { rules });
  let tot = 0, jams = 0, hits = 0;
  for (let roll = 0; roll < 100; roll++) { const res = E.resolve({ v, b, roll, loc: "Body", rules, dt, floor: E.floorOf(tgt, ctx), shot: {} }); tot += res.total; if (res.outcome === "jam") jams++; else if (res.outcome !== "miss") hits++; }
  const rounds = v.usesAmmo ? (v.count || 1) * (v.perShot || 1) : 0;
  const perMag = v.usesAmmo && v.cap ? Math.max(1, Math.floor(v.cap / Math.max(1, rounds))) : Infinity;
  const effAP = (v.ap || 0) + (jams / 100) * (v.clearJam || 0) + (isFinite(perMag) ? (v.reload || 0) / perMag : 0);
  return { v, hit: hc.hit, raw: hc.raw, exp: tot / 100, jam: jams / 100, hitRate: hits / 100, ap: v.ap, effAP, perMag, dpt: effAP > 0 ? (A.ap * tot) / 100 / effAP : 0 };
}

// ---------------------------------------------------------------- armor
const BODY = ["Body", "Whole Body", "Power"], HEAD = ["Head", "Whole Head"];
const armorRows = data.armor.filter((a) => a.tier > 0 && a.tier < 100 && !a.faction);
const pickMed = (locs, tier) => { for (let t = tier; t >= 1; t--) { const p = armorRows.filter((a) => locs.includes(a.loc) && a.tier === t && a.dt > 0).sort((x, y) => x.dt - y.dt); if (p.length) return p[Math.floor((p.length - 1) / 2)]; } return null; };
const pcGear = Object.fromEntries(TIERS.map((t) => [t, { armor: (pickMed(BODY, t) || {}).n, head: (pickMed(HEAD, t) || {}).n }]));

// ---------------------------------------------------------------- enemies: sample what the generator makes
const templates = data.enemies.filter((e) => !e.test && e.tier >= 1 && e.tier <= 6);
const samples = {};
for (const t of templates) {
  const rng = seeded(1000 + templates.indexOf(t) * 7919), out = [];
  for (let i = 0; i < (t.mob ? 1 : 40); i++) { const e = E.spawn(t, "e" + i, ctx, rng); out.push({ e, d: E.derive(e, ctx) }); }
  samples[t.n] = out;
}
const tierDT = Object.fromEntries(TIERS.map((t) => [t, med(templates.filter((x) => x.tier === t).flatMap((x) => samples[x.n].map((s) => s.d.dt)))]));

// ---------------------------------------------------------------- weapons
const weapons = [];
for (const w of data.weapons) {
  const tier = Number(w.tier);
  const row = { n: w.n, tab: w.tab, type: w.type, tier: tier || null, ok: !!w.ok, req: w.req, ap: w.ap, mag: w.mag, reload: w.reload, count: w.count, crit: w.crit, jam: w.jam, lb: w.lb, val: w.val, ammo: w.ammo, unique: E.isUnique(w), natural: !tier };
  weapons.push(row);
  if (!w.ok || !tier || w.tab === "EX" || w.thrown) continue;
  const slot = { n: w.n };
  if (w.tab === "SG" || w.tab === "BG") { const a = standardLoad(w, tier); if (!a) { row.problem = "no load for its caliber"; continue; } slot.ammo = a.n; row.load = a.n; row.dam = a.dam; row.pen = a.pen; row.pellets = a.pellets || 0; }
  else { row.dam = w.dmg; row.pen = w.pen || 0; }
  const P = player(tier, [slot], {}); const A = E.derive(P, ctx);
  row.skill = A.skills[w.skill || "MW"];
  const bandsToTry = w.tab === "MW" ? [1] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  let best = null; row.byBand = {};
  for (const band of bandsToTry) {
    const s0 = attackStats(P, A, dummy, dummyD, slot, band, 0); if (!s0) continue;
    const sT = attackStats(P, A, dummy, dummyD, slot, band, tierDT[tier] || 0);
    row.byBand[band] = { hit: r2(s0.hit), dpt0: r2(s0.dpt), dptT: r2(sT.dpt) };
    if (!best || sT.dpt > best.sT.dpt) best = { band, s0, sT };
  }
  if (!best) { row.problem = "no hit data"; continue; }
  row.hit100 = r2(Math.min(rules.maxHit, (w.tab === "MW" ? (w.base != null ? w.base : 0.45) : Math.max(...(w.hit || []).filter((x) => x != null))) + (Math.min(100, rules.overskillCap) - (w.req || 0)) / 200));
  const at10 = row.byBand[5] || null, at25 = row.byBand[6] || null;
  if (slot.ammo) { const bl = bestLoad(w, tier, tierDT[tier] || 0); if (bl && bl.n !== slot.ammo) { const s2 = attackStats(P, A, dummy, dummyD, { n: w.n, ammo: bl.n }, best.band, tierDT[tier] || 0); if (s2) { row.bestLoad = bl.n; row.dptTBest = r2(s2.dpt); } } }
  if (row.dptTBest == null) row.dptTBest = r2(best.sT.dpt);
  Object.assign(row, { bestBand: best.band, bestM: rules.bandMeters[best.band - 1], hit: r2(best.s0.hit), rawHit: r2(best.s0.raw), perAttack: r2(best.s0.exp), dpt0: r2(best.s0.dpt), dptT: r2(best.sT.dpt), jamRate: r2(best.s0.jam), effAP: r2(best.s0.effAP), dpt10: at10 && at10.dptT, dpt25: at25 && at25.dptT, hit10: at10 && at10.hit });
}

// ---------------------------------------------------------------- ammo
const calibers = {};
for (const a of data.ammo) (calibers[a.cal] = calibers[a.cal] || []).push(a);
const ammo = { calibers: [], dominated: [], betterThanStandard: [], broken: [], orphanCalibers: [] };
for (const [cal, list] of Object.entries(calibers)) {
  const ok = list.filter((a) => a.ok && a.dam != null && a.pen != null);
  const std = ok.find((a) => a.load === "Standard");
  const total = (a) => (a.dam || 0) * (a.pellets || 1);
  ammo.calibers.push({ cal, loads: list.length, ok: ok.length, std: std ? { dam: std.dam, pen: std.pen, tier: std.tier } : null, rows: list.map((a) => ({ n: a.load, dam: a.dam, pen: a.pen, pellets: a.pellets || 0, total: total(a), tier: a.tier, ok: !!a.ok })) });
  for (const a of list) if (!a.ok) ammo.broken.push({ cal, load: a.load, dam: a.dam, pen: a.pen });
  for (const a of ok) for (const b of ok) if (a !== b && total(a) >= total(b) && a.pen >= b.pen && (a.tier || 1) <= (b.tier || 1) && (total(a) > total(b) || a.pen > b.pen || (a.tier || 1) < (b.tier || 1))) { ammo.dominated.push({ cal, load: b.load, by: a.load, b: [total(b), b.pen, b.tier], a: [total(a), a.pen, a.tier] }); break; }
  if (std) for (const a of ok) if (a !== std && (a.tier || 1) <= (std.tier || 1) && total(a) >= total(std) && a.pen >= std.pen && (total(a) > total(std) || a.pen > std.pen)) ammo.betterThanStandard.push({ cal, load: a.load, dam: total(a), pen: a.pen, tier: a.tier, std: [total(std), std.pen, std.tier] });
}
const usedCal = new Set(data.weapons.filter((w) => w.ok && ["SG", "BG"].includes(w.tab)).map((w) => w.ammo));
ammo.orphanCalibers = [...usedCal].filter((c) => !(calibers[c] || []).some((a) => a.ok)).map((c) => ({ cal: c, weapons: data.weapons.filter((w) => w.ok && w.ammo === c).map((w) => w.n) }));
ammo.tierCurve = TIERS.map((t) => { const s = data.ammo.filter((a) => a.ok && a.tier === t && a.load === "Standard"); return { tier: t, n: s.length, dam: med(s.map((a) => a.dam)), pen: med(s.map((a) => a.pen)) }; });
ammo.points = data.ammo.filter((a) => a.ok && a.dam != null).map((a) => ({ n: a.n, dam: (a.dam || 0) * (a.pellets || 1), pen: a.pen, tier: a.tier, load: a.load }));

// ---------------------------------------------------------------- armor table and what it stops
const tierAmmo = (t) => data.ammo.filter((a) => a.ok && a.dam != null && a.pen != null && a.tier === t && !a.pellets);
const armor = { rows: armorRows.filter((a) => [...BODY, ...HEAD].includes(a.loc) || a.dt > 0).map((a) => ({ n: a.n, loc: a.loc, tier: a.tier, dt: a.dt || 0, lb: a.lb, val: a.val, buffs: a.buffs, nerfs: a.nerfs })), byTier: [] };
for (const t of TIERS) {
  const body = armorRows.filter((a) => BODY.includes(a.loc) && a.tier === t), head = armorRows.filter((a) => HEAD.includes(a.loc) && a.tier === t);
  const kitDT = ((pickMed(BODY, t) || {}).dt || 0) + ((pickMed(HEAD, t) || {}).dt || 0);
  const vs = (dt, list) => { if (!list.length) return null; const m = list.map((a) => E.damage(a.dam, a.pen, dt, 1, 1, rules.damageFloor).raw / Math.max(1, a.dam)); return { blocked: r2(list.filter((a) => a.pen < dt).length / list.length), keep: r2(m.reduce((x, y) => x + y, 0) / m.length) }; };
  armor.byTier.push({ tier: t, body: body.length, head: head.length, bodyDT: med(body.map((a) => a.dt || 0)), bodyMax: Math.max(0, ...body.map((a) => a.dt || 0)), headDT: med(head.map((a) => a.dt || 0)), kitDT, enemyDT: tierDT[t],
    vsSame: vs(kitDT, tierAmmo(t)), vsBelow: vs(kitDT, tierAmmo(Math.max(1, t - 1))), vsAbove: vs(kitDT, tierAmmo(Math.min(6, t + 1))), lbPerDT: r2(med(body.filter((a) => a.dt > 0 && a.lb != null).map((a) => a.lb / a.dt))), valPerDT: r2(med(body.filter((a) => a.dt > 0 && a.val).map((a) => a.val / a.dt))) });
}
armor.zeroDT = armorRows.filter((a) => [...BODY, ...HEAD].includes(a.loc) && !(a.dt > 0)).map((a) => `${a.n} (T${a.tier} ${a.loc})`);

// ---------------------------------------------------------------- the reference player's weapon for each tier: the median small gun
const refWeapon = {}, refMelee = {};
for (const t of TIERS) {
  const pool = weapons.filter((w) => w.tab === "SG" && w.tier === t && w.dpt10 != null && !w.unique).sort((a, b) => a.dpt10 - b.dpt10);
  const w = pool[Math.floor((pool.length - 1) / 2)];
  const bl = w && bestLoad(data.weapons.find((x) => x.n === w.n), t, tierDT[t] || 0);
  refWeapon[t] = w ? { n: w.n, ammo: bl ? bl.n : w.load, dpt10: w.dpt10 } : null;
  const mp = weapons.filter((x) => x.tab === "MW" && x.tier <= t && x.dptT != null && !x.unique); const top = Math.max(0, ...mp.map((x) => x.tier));
  const ms = mp.filter((x) => x.tier === top).sort((a, b) => a.dptT - b.dptT); const m = ms[Math.floor((ms.length - 1) / 2)];
  refMelee[t] = m ? { n: m.n, dpt: m.dptT } : null;
}
// BAL_REF=<an earlier result .json>: keep that run's reference gun and melee weapon, so scenarios compare like for like
if (process.env.BAL_REF) { const P = JSON.parse(fs.readFileSync(process.env.BAL_REF, "utf8")); for (const t of TIERS) { if (P.reference[t].weapon) refWeapon[t] = { ...P.reference[t].weapon }; if (P.refMelee[t]) refMelee[t] = { ...P.refMelee[t] }; } }
// the player loads whatever ammo does most against the enemy in front of them (dt), as a player would
const kit = (t, dt) => { const w = data.weapons.find((x) => x.n === refWeapon[t].n); const bl = dt != null && w ? bestLoad(w, t, dt) : null; return [{ n: refWeapon[t].n, ammo: bl ? bl.n : refWeapon[t].ammo }, ...(refMelee[t] ? [{ n: refMelee[t].n }] : [])]; };

// ---------------------------------------------------------------- duels: one reference player against one enemy, starting 10 m apart
const MAX_ROUNDS = 30;
function fighter(e) {
  const d = E.derive(e, ctx);
  return { e, d, hp: d.hp, mags: (e.weapons || []).map((s) => { const v = E.weaponView(s, e, d, ctx); return v.usesAmmo ? v.cap : Infinity; }) };
}
function plan(f, foe, dist) {
  // the slot and stance that score most damage this turn: shoot from here, or close in and hit
  let best = null;
  (f.e.weapons || []).forEach((s, i) => {
    const v = E.weaponView(s, f.e, f.d, ctx); if (v.missing || !(v.ap > 0)) return;
    const move = v.melee && dist > 0.6 ? rules.moveAP[bandFor(dist - 0.5) - 1] : 0;
    const band = v.melee ? 1 : bandFor(dist);
    const st = attackStats(f.e, f.d, foe.e, foe.d, s, band, foe.d.dt); if (!st) return;
    const n = Math.max(0, Math.floor((f.d.ap - move) / v.ap));
    const score = n * st.exp + (move ? 0.01 : 0);
    if (!best || score > best.score) best = { i, v, s, move, band, score, st };
  });
  return best;
}
function duel(pcE, enE, seed) {
  const rng = seeded(seed); const a = fighter(pcE), b = fighter(enE); let dist = 10;
  const ini = (f) => 1 + Math.floor(rng() * 20) + f.d.pri;
  const order = ini(a) >= ini(b) ? [a, b] : [b, a];
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    for (const f of order) {
      const foe = f === a ? b : a; let ap = f.d.ap; f.e.punches = 0;
      const p = plan(f, foe, dist); if (!p) continue;
      if (p.move) { ap -= p.move; dist = 0.5; }
      let v = p.v; const band = v.melee ? 1 : bandFor(dist);
      const hc = E.hitChance(f.e, f.d, foe.e, foe.d, v, band, ctx, null); if (hc.noData) continue;
      const bb = E.bands(hc.hit, v.jam, v.crit, f.d.superCrit, { rules });
      const rounds = v.usesAmmo ? (v.count || 1) * (v.perShot || 1) : 0;
      while (ap >= v.ap) {
        if (v.usesAmmo && f.mags[p.i] < rounds) { if (ap >= (v.reload || 0)) { ap -= v.reload || 0; f.mags[p.i] = v.cap; continue; } break; }
        ap -= v.ap; if (v.punch) { f.e.punches++; v = E.weaponView(p.s, f.e, f.d, ctx); } const res = E.resolve({ v, b: bb, roll: Math.floor(rng() * 100), loc: "Body", rules, dt: foe.d.dt, floor: E.floorOf(foe.e, ctx), shot: {}, available: v.usesAmmo ? Math.floor(f.mags[p.i] / (v.perShot || 1)) : undefined });
        if (v.usesAmmo) f.mags[p.i] -= res.outcome === "jam" || res.outcome === "miss" ? rounds : Math.max(1, res.bullets) * (v.perShot || 1);
        if (res.outcome === "jam") ap -= v.clearJam || 0;
        foe.hp -= res.total;
        if (foe.hp <= 0) return { win: f === a, rounds: round, pcHp: Math.max(0, a.hp) / a.d.hp };
      }
    }
  }
  return { win: null, rounds: MAX_ROUNDS, pcHp: Math.max(0, a.hp) / a.d.hp };
}
const enemies = [];
for (const t of templates) {
  const S = samples[t.n]; const tier = t.tier;
  const row = { n: t.n, tier, mob: !!t.mob, faction: t.faction || "Unaligned", xp: t.xp || 0, hp: med(S.map((s) => s.d.hp)), dt: med(S.map((s) => s.d.dt)), ap: med(S.map((s) => s.d.ap)), weapons: [...new Set(S.flatMap((s) => (s.e.weapons || []).map((w) => w.n)))].slice(0, 4), problems: [] };
  if (t.mob && !t.hp) row.problems.push("no HP");
  if (!row.xp) row.problems.push("no XP");
  if (t.mob && !(t.w1 || t.w2)) row.problems.push("no attacks");
  for (const n of [t.w1, t.w2].filter(Boolean)) if (!E.get(ctx, n)) row.problems.push(`${n} doesn't exist`);
  const ref = refWeapon[tier];
  if (ref && row.hp > 0) {
    const pcE = player(tier, kit(tier, row.dt), pcGear[tier]); const pcD = E.derive(pcE, ctx); row.pcDT = pcD.dt; row.pcHp = pcD.hp;
    // damage per turn each way, at whichever suits the attacker better: 10 m apart, or already in reach
    const eDpt = [], pDpt = [];
    const sustained = (p) => (p ? p.score * (p.st.effAP > 0 ? p.st.ap / p.st.effAP : 1) : 0);
    for (const s of S.slice(0, 12)) {
      const f = fighter(s.e), pf = fighter(pcE);
      eDpt.push(Math.max(sustained(plan(f, pf, 10)), sustained(plan(f, pf, 0.5))));
      pDpt.push(Math.max(sustained(plan(pf, f, 10)), sustained(plan(pf, f, 0.5))));
    }
    row.enemyDpt = r2(med(eDpt)); row.pcDpt = r2(med(pDpt));
    row.turnsToKillIt = row.pcDpt > 0 ? r2(row.hp / row.pcDpt) : null; row.turnsToDownPc = row.enemyDpt > 0 ? r2(pcD.hp / row.enemyDpt) : null;
    let wins = 0, losses = 0, rounds = 0, left = 0; const N = 200;
    for (let i = 0; i < N; i++) { const s = S[i % S.length]; const r = duel(player(tier, kit(tier, row.dt), pcGear[tier]), JSON.parse(JSON.stringify(s.e)), 77 + i * 131); if (r.win === true) wins++; else if (r.win === false) losses++; rounds += r.rounds; left += r.pcHp; }
    Object.assign(row, { pcWin: r2(wins / N), pcLose: r2(losses / N), stalemate: r2((N - wins - losses) / N), rounds: r2(rounds / N), pcHpLeft: r2(left / N) });
    row.xpPerThreat = row.enemyDpt > 0 ? r2(row.xp / Math.sqrt(row.hp * row.enemyDpt)) : null;
  }
  enemies.push(row);
}

// ---------------------------------------------------------------- tier curves and outliers
const scored = weapons.filter((w) => w.dptT != null);
const curves = [];
for (const tab of ["SG", "BG", "EW", "MW"]) for (const t of TIERS) {
  const g = scored.filter((w) => w.tab === tab && w.tier === t), all = weapons.filter((w) => w.tab === tab && w.tier === t);
  curves.push({ tab, tier: t, total: all.length, scored: g.length, dptT: med(g.map((w) => w.dptT)), dptTBest: med(g.map((w) => w.dptTBest)), dpt0: med(g.map((w) => w.dpt0)), dpt10: med(g.map((w) => w.dpt10)), hit: med(g.map((w) => w.hit)), hit10: med(g.map((w) => w.hit10)), maxDpt: g.length ? Math.max(...g.map((w) => w.dptT)) : null });
}
const outliers = [];
for (const w of scored) {
  const c = curves.find((x) => x.tab === w.tab && x.tier === w.tier); if (!c || c.scored < 4) continue;
  const ratio = w.dptT / Math.max(0.01, c.dptT);
  if (ratio >= 2 || ratio <= 0.4) outliers.push({ n: w.n, tab: w.tab, tier: w.tier, type: w.type, dptT: w.dptT, median: r2(c.dptT), ratio: r2(ratio), why: ratio >= 2 ? "high" : "low" });
}
// compared with no armor on either side, so a jump in enemy DT between tiers doesn't distort it
const nextTier = scored.filter((w) => { const up = curves.find((x) => x.tab === w.tab && x.tier === w.tier + 1); return up && up.scored >= 3 && w.dpt0 > up.dpt0 * 1.3; }).map((w) => ({ n: w.n, tab: w.tab, tier: w.tier, dpt0: w.dpt0, nextMedian: r2(curves.find((x) => x.tab === w.tab && x.tier === w.tier + 1).dpt0) }));

// ---------------------------------------------------------------- the current party, as a reality check (no names: Character 1-4)
const party = (data.party || []).map((c, i) => {
  const e = { ...JSON.parse(JSON.stringify(c)), kind: "pc", id: "p" + i }; const d = E.derive(e, ctx);
  return { who: `Character ${i + 1}`, level: e.level, hp: d.hp, ap: d.ap, dt: d.dt, weapons: (e.weapons || []).map((s) => {
    const r = { n: s.n, ammo: s.ammo || "" };
    for (const [band, m] of [[1, "0.5"], [3, "3"], [5, "10"], [6, "25"]]) { const st = attackStats(e, d, dummy, dummyD, s, band, 0); r["hit" + m] = st ? r2(st.hit) : null; r["dpt" + m] = st ? r2(st.dpt) : null; }
    return r; }) };
});
// human enemies that come with armor, and how XP paces levelling
const humanArmor = TIERS.map((t) => { const h = templates.filter((x) => !x.mob && x.tier === t); const all = h.flatMap((x) => samples[x.n]); return { tier: t, templates: h.length, fixedGear: h.filter((x) => x.w1).length, armored: r2(all.filter((s) => s.d.dt > 0).length / Math.max(1, all.length)) }; });
const xpPace = TIERS.map((t) => ({ tier: t, human: med(templates.filter((x) => !x.mob && x.tier === t).map((x) => x.xp || 0)), creature: med(templates.filter((x) => x.mob && x.tier === t).map((x) => x.xp || 0)), level: 5 * t - 2 }));
const out = { humanArmor, xpPace, levelXp: Array.from({ length: rules.maxLevel }, (_, i) => E.xpFor(i + 1, rules)), party, refMelee, builtAt: data.builtAt, rules: { maxHit: rules.maxHit, overskillCap: rules.overskillCap, damageFloor: rules.damageFloor, critMult: rules.critMult, superDefault: rules.superDefault, bandMeters: rules.bandMeters, moveAP: rules.moveAP },
  reference: Object.fromEntries(TIERS.map((t) => { const P = player(t, [], pcGear[t]); const d = E.derive(P, ctx); return [t, { level: P.level, hp: d.hp, ap: d.ap, dt: d.dt, gear: pcGear[t], skills: P.skills, weapon: refWeapon[t] }]; })),
  tierDT, weapons, curves, outliers, nextTier, ammo, armor, enemies,
  coverage: ["SG", "BG", "EW", "MW", "EX"].map((tab) => ({ tab, name: lowTab[tab], total: data.weapons.filter((w) => w.tab === tab && w.tier).length, ok: data.weapons.filter((w) => w.tab === tab && w.tier && w.ok).length, scored: scored.filter((w) => w.tab === tab).length, tiers: TIERS.map((t) => [data.weapons.filter((w) => w.tab === tab && Number(w.tier) === t).length, scored.filter((w) => w.tab === tab && w.tier === t).length]) })) };
fs.writeFileSync(process.argv[2] || "balance-results.json", JSON.stringify(out));
console.log("weapons scored", scored.length, "of", weapons.filter((w) => w.tier).length, "| outliers", outliers.length, "| enemies", enemies.length, "| tier DT", JSON.stringify(tierDT));
