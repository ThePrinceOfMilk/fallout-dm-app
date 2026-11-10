// Run: node --test app/tests/
// fixtures.json and data.json are written by app/build.py from the workbook's saved results.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const E = require("../src/engine.js");
const { DEFAULT_RULES } = require("../src/rules.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures.json"), "utf8"));
const skippedList = E.standardize(data, DEFAULT_RULES);
const db = E.makeDb(data);
const rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
Object.assign(rules, { perPenalty: 0.05, strGun: 0.0125, strMelee: 0.05, conditions: false,
  gunHitAdd: 0, skillHitMul: 1, meleeHeavyBase: null, meleeApMul: 1, punchAP: null, burstAP: 0, burstMode: "steps", creaturePen: 0, armorFloors: null, pcHpPerLevel: 1, pcHpMul: 1, npcHpPerTier: 6 });  // fixtures come from the sheet; the 9 Nov balance pass is tested on its own below
const ctx = { db, rules, scene: { time: "Daytime", weather: "Clear", env: "Grassland", effects: [] }, ov: {} };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: got ${a}, sheet says ${b}`);
const gecko = E.spawn(db.enemies.get("gecko"), "e1", ctx, () => 0.5);
const Tg = E.derive(gecko, ctx);

for (const p of fx.players) {
  const c = data.party.find((x) => x.name === p.name);
  const d = E.derive(c, ctx);
  test(`derived stats match Player Sheets: ${p.name}`, () => {
    assert.deepStrictEqual(E.SPECIAL.map((k) => d.sp[k]), p.effective);
    for (const k in p.skills) assert.strictEqual(d.skills[k], p.skills[k], k);
    for (const k of ["hp", "dt", "ap", "carry", "pri", "save", "pts"]) near(d[k], p[k], k);
  });
  test(`hit chance matches Combat Sheet at every range: ${p.name}`, () => {
    [[p.w1, p.hit1, p.load], [p.w2, p.hit2, ""]].forEach(([n, cached, load]) => {
      const v = E.weaponView({ n, ammo: load }, c, d, ctx);
      for (let r = 1; r <= 10; r++) {
        if (v.melee && r !== 1 && r !== 6) continue;  // the sheet leaves the other melee cells empty
        near(E.hitChance(c, d, gecko, Tg, v, r, ctx, false).raw, cached[r - 1], `${n} R${r}`);
      }
    });
  });
  test(`final damage matches Combat Sheet!M9: ${p.name}`, () => {
    const v = E.weaponView({ n: p.w1, ammo: p.load }, c, d, ctx);
    assert.strictEqual(E.damage(v.base, v.pen, Tg.dt, 1, 1).final, p.finalDmg);
  });
  test(`sheet-mode bands match Combat Sheet row 6: ${p.name}`, () => {
    const v = E.weaponView({ n: p.w1, ammo: p.load }, c, d, ctx);
    const hc = E.hitChance(c, d, gecko, Tg, v, v.melee ? 1 : p.range, ctx, false);
    const b = E.bands(hc.raw, v.jam, v.crit, 0.01, { rules: { critMode: "sheet", jamMode: "sheet" }, lck: d.sp.L, cond: p.cond });
    near(b.hitAt, p.hitAt, "hit threshold");
    near(b.critAt, p.critAt, "crit threshold");
    near(b.jamAt - 1, p.failAt, "fail threshold");
  });
}

test("gecko's bite is 94.5% like the sheet", () => {
  const c = data.party[0];
  const d = E.derive(c, ctx);
  const v = E.weaponView(gecko.weapons[0], gecko, Tg, ctx);
  near(E.hitChance(gecko, Tg, c, d, v, 1, ctx, false).raw, 0.945, "gecko");
});

test("brief's band example, exactly", () => {
  const b = E.bands(0.7, 0.13, 0.2, 0.02);
  assert.strictEqual(E.bandText(b), "Jam 00-12 · Miss 13-29 · Hit 30-79 · Crit 80-97 · Super 98-99");
  const cases = { 0: "jam", 12: "jam", 13: "miss", 29: "miss", 30: "hit", 79: "hit", 80: "crit", 97: "crit", 98: "super", 99: "super" };
  for (const r in cases) assert.strictEqual(E.classify(Number(r), b), cases[r], r);
});

test("bands stay sane at the edges", () => {
  assert.strictEqual(E.bandText(E.bands(0.95, 0, 0.1, 0.01)), "Miss 00-04 · Hit 05-89 · Crit 90-98 · Super 99-99");
  const lowOdds = E.bands(0.05, 0.1, 0.2, 0.01);   // crit band starts below the hit band: every hit is a crit
  assert.strictEqual(E.classify(50, lowOdds), "miss");
  assert.strictEqual(E.classify(96, lowOdds), "crit");
  assert.strictEqual(E.classify(5, lowOdds), "jam");
  assert.strictEqual(E.bandText(lowOdds), "Jam 00-09 · Miss 10-94 · Crit 95-98 · Super 99-99");
  const jamOverHit = E.bands(0.95, 0.1, 0.05, 0.01);  // jam eats the miss band
  assert.strictEqual(E.bandText(jamOverHit), "Jam 00-09 · Hit 10-94 · Crit 95-98 · Super 99-99");
  const impossible = E.bands(-0.2, 0.1, 0.05, 0.01);
  assert.strictEqual(E.bandText(impossible), "Jam 00-09 · Miss 10-99");
  assert.strictEqual(E.classify(99, impossible), "miss");
});

test("damage formula", () => {
  assert.strictEqual(E.damage(8, 4, 0, 1, 1).final, 8);
  assert.strictEqual(E.damage(8, 4, 8, 1, 1).final, 4);
  assert.strictEqual(E.damage(8, 4, 40, 2, 3).final, 9);
  assert.strictEqual(E.damage(8, 0, 25, 1, 1).final, 1);
  assert.strictEqual(E.damage(3, 2, 2, 0.75, 1).final, 2);
  assert.strictEqual(E.damage(1, 0, 10, 0.75, 1).final, 1);
  assert.strictEqual(E.damage(5.5, 3, 0, 1, 1).final, 5);
});

test("skill checks", () => {
  assert.strictEqual(E.checkNeeded(80, 80, rules), 11);
  assert.strictEqual(E.checkNeeded(85, 80, rules), 10);
  assert.strictEqual(E.checkNeeded(70, 80, rules), 13);
  assert.strictEqual(E.checkNeeded(73, 80, rules), 12);
  assert.strictEqual(E.checkNeeded(84, 80, rules), 11);
  assert.strictEqual(E.checkNeeded(60, 80, rules), 15);  // PER 6 as 60
  assert.deepStrictEqual(E.checkResult(1, 2), { pass: false, why: "natural 1" });
  assert.deepStrictEqual(E.checkResult(20, 25), { pass: true, why: "natural 20" });
  assert.strictEqual(E.checkResult(10, 11).pass, false);
  assert.strictEqual(E.checkResult(11, 11).pass, true);
  assert.strictEqual(E.checkOdds(11), 50);
  assert.strictEqual(E.checkOdds(25), 5);
  assert.strictEqual(E.checkOdds(-3), 95);
});

test("your rulings: overskill counts as 100, melee STR penalty applies, save caps at 20", () => {
  const c = { kind: "pc", id: "x", special: [10, 10, 10, 10, 10, 10, 10], skills: { SG: 150, MW: 60 }, gear: {}, inv: [], weapons: [] };
  const d = E.derive(c, ctx);
  assert.strictEqual(d.skills.SG, 150);
  const v = { melee: false, skill: "SG", req: 50, str: 0, hitBase: () => 0, thrown: false };
  near(E.hitChance(c, d, gecko, Tg, v, 1, ctx, false).raw, 0.25, "skill 150 acts as 100");
  const weak = { kind: "pc", id: "y", special: [5, 5, 5, 5, 5, 5, 5], gear: {}, inv: [], weapons: [] };
  const dw = E.derive(weak, ctx);
  const sledge = { melee: true, skill: "MW", req: dw.skills.MW, str: 8, hitBase: () => 0.45 };
  near(E.hitChance(weak, dw, gecko, Tg, sledge, 1, ctx, false).raw, 0.45 - 1.2, "melee STR 5 vs 8");
  assert.strictEqual(E.saveTarget(10, 100, 0, 0, rules), 20);   // the sheet's bug gave 19 here
  assert.strictEqual(E.saveTarget(8, 7, 0, 0, rules), 15);
  assert.strictEqual(E.saveTarget(8, 7, 0, 1, rules), 11);
});

test("hit chance is capped at the max", () => {
  const c = { kind: "pc", id: "x", special: [10, 10, 10, 10, 10, 10, 10], skills: { SG: 100 }, gear: {}, inv: [], weapons: [] };
  const d = E.derive(c, ctx);
  const hc = E.hitChance(c, d, gecko, Tg, { melee: false, skill: "SG", req: 0, str: 0, hitBase: () => 0.9 }, 1, ctx, false);
  assert.strictEqual(hc.hit, 0.95); assert.ok(hc.capped);
});

test("cover and carried-over scene effects change hit chance", () => {
  const c = data.party[0]; const d = E.derive(c, ctx);
  const v = E.weaponView(gecko.weapons[0], gecko, Tg, ctx);
  const dark = { ...ctx, scene: { ...ctx.scene, effects: [{ label: "Darkness", who: "enemies", hit: -0.1 }] } };
  near(E.hitChance(gecko, Tg, c, d, v, 1, dark, false).raw, 0.845, "darkness only hits enemies");
  near(E.hitChance(gecko, Tg, c, d, v, 1, ctx, { tier: "custom", hit: -0.15, dam: 0 }).raw, 0.795, "cover");
  const gun = E.weaponView({ n: "Pipe Shotgun", ammo: "20 Gauge - Buckshot" }, c, d, dark);
  near(E.hitChance(c, d, gecko, Tg, gun, 2, dark, false).raw, 0.175, "party unaffected by enemy darkness");
});

test("bursts: higher rolls land more bullets, matching the sheet's steps", () => {
  const b = { hitAt: 82.5, critAt: 96.2, jamAt: 0, superAt: 99 };
  assert.strictEqual(E.bullets(85, b, 2, "hit", rules), 1);
  assert.strictEqual(E.bullets(89.35, b, 2, "hit", rules), 2);
  assert.strictEqual(E.bullets(95, b, 2, "hit", rules), 2);
  assert.strictEqual(E.bullets(97, b, 5, "crit", rules), 5);
  const r = E.resolve({ v: { base: 8, pen: 4, count: 2 }, b, roll: 90, dt: 8, loc: "Body", rules });
  assert.strictEqual(r.outcome, "hit"); assert.strictEqual(r.bullets, 2); assert.strictEqual(r.each, 4); assert.strictEqual(r.total, 8);
  assert.match(r.math, /8 × Body 1 × Hit 1 = 8; Pen 4 < DT 8 → 4 × 2 bullets = 8/);
  const short = E.resolve({ v: { base: 8, pen: 4, count: 5 }, b, roll: 97, dt: 0, loc: "Body", rules, available: 2 });
  assert.strictEqual(short.bullets, 2, "cannot land more than the magazine holds");
});

test("pellet ammo reads as damage x pellets", () => {
  const a = data.ammo.find((x) => x.n === "12 Gauge - Buckshot");
  assert.strictEqual(a.dam, 2); assert.strictEqual(a.pellets, 10);
  const r = E.resolve({ v: { base: 2, pen: 3, count: 1, pellets: 10 }, b: { hitAt: 10, critAt: 90, jamAt: 0, superAt: 99 }, roll: 50, dt: 0, loc: "Body", rules });
  assert.strictEqual(r.total, 20);
});

test("XP and levels", () => {
  assert.strictEqual(E.xpFor(2, rules), 100);
  assert.strictEqual(E.xpFor(30, rules), 43500);
  assert.strictEqual(E.levelForXp(99, rules), 1);
  assert.strictEqual(E.levelForXp(100, rules), 2);
  assert.strictEqual(E.levelForXp(1e6, rules), 30);
  assert.strictEqual(E.xpGain(10, 8, rules), 11.5);
});

test("status and item text become numbers", () => {
  assert.deepStrictEqual(E.parseEffect("Zapped: -1 AP / -10% acc, x2 Damage to Robots/PA", false), { ap: -1, acc: -0.1 });
  assert.deepStrictEqual(E.parseEffect("1 AP to focus, otherwise -10% Hit Chance/flee", false), { acc: -0.1 });
  assert.deepStrictEqual(E.parseEffect("1+ STR, 1+ CHA, -1 INT"), { S: 1, C: 1, I: -1 });
  assert.deepStrictEqual(E.parseEffect("Chilled:+1 AP to movement, attack, and items", false), { apCost: 1 });
  assert.strictEqual(E.parseEffect("Slashed: 2 dmg", false).dot, 2);
  assert.strictEqual(E.parseEffect("Dazed:-50% acc / 2 turns", false).turns, 2);
  assert.strictEqual(E.parseEffect("Irradiated: -2 S.P.E.C.I.A.L", false).L, -2);
  assert.deepStrictEqual(E.parseHeal("25% HP"), { pct: 0.25 });
  assert.deepStrictEqual(E.parseHeal("10 HP + END"), { flat: 10, end: true });
});

test("enemy skills follow tier, SPECIAL and the weapon carried", () => {
  const T = (n) => data.enemies.find((e) => e.n === n);
  let r = 0.37; const rng = () => (r = (r * 9301 + 49297) % 233280 / 233280);
  for (const n of ["Legion Veteran", "Recruit", "Fiend", "Ranger", "Viper Cutthroat"]) for (let i = 0; i < 25; i++) {
    const e = E.spawn(T(n), "x", ctx, rng);
    for (const s of e.weapons) { const w = E.get(ctx, s.n); if (w && w.o.req != null) assert.ok(e.skills[w.o.skill] >= w.o.req, `${n} can use its ${s.n}: ${w.o.skill} ${e.skills[w.o.skill]} vs ${w.o.req}`); }
    for (const k of ["SG", "BG", "EW", "MW", "EXP"]) assert.ok(e.skills[k] >= 0 && e.skills[k] <= 100);
  }
  // a Legion Veteran with a small gun is at about the tier's usual requirement
  const vets = Array.from({ length: 40 }, () => E.spawn(T("Legion Veteran"), "v", ctx, rng)).filter((e) => e.weapons.some((s) => (E.get(ctx, s.n) || { o: {} }).o.skill === "SG"));
  const avg = vets.reduce((t, e) => t + e.skills.SG, 0) / Math.max(1, vets.length);
  assert.ok(!vets.length || avg >= E.tierReq(ctx, "SG", 4) - 8, "veterans handle most tier 4 small guns: " + avg);
  // more PER and AGI means more Small Guns, everything else equal
  const lo = { ...T("Soldier"), special: [5, 3, 5, 5, 5, 3, 5] }, hi = { ...T("Soldier"), special: [5, 9, 5, 5, 5, 9, 5] };
  const mean = (t) => { let s = 0; for (let i = 0; i < 80; i++) s += E.spawn(t, "s", ctx).skills.SG; return s / 80; };
  assert.ok(mean(hi) > mean(lo) + 6, "SPECIAL raises the skill");
});
test("generic enemies get a faction name, with ranks that follow tier", () => {
  const r = JSON.parse(JSON.stringify(DEFAULT_RULES)); const T = (n) => data.enemies.find((e) => e.n === n);
  const many = (n) => Array.from({ length: 200 }, () => E.npcName(T(n), r));
  assert.ok(many("Ranger").every((x) => /^Ranger - /.test(x) && !/Pvt|PFC|Cpl|Sgt/.test(x) && /'/.test(x)), "Rangers have no rank and do have a nickname");
  assert.ok(many("Recruit").every((x) => /^Recruit - (Pvt\.|PFC) /.test(x) && !/'/.test(x)));
  assert.ok(many("Legion Recruit").every((x) => /^Legion Recruit - [A-Z][a-z]+$/.test(x)));
  assert.ok(many("Legion Veteran").some((x) => /Decanus/.test(x)) && many("Legion Veteran").every((x) => x.split(" - ")[1].split(" ").length >= 2));
  assert.ok(many("Fiend").every((x) => /^Fiend - \S/.test(x)));
  assert.strictEqual(E.npcName(T("Omerta Thug"), r), null, "mafia keeps its plain name");
  assert.strictEqual(E.npcName(T("Bloatfly"), r), null);
  const taken = new Set(); for (let i = 0; i < 20; i++) taken.add(E.npcName(T("Fiend"), r, Math.random, taken));
  assert.strictEqual(taken.size, 20, "no repeats in one fight");
  r.autoNames = false; assert.strictEqual(E.npcName(T("Fiend"), r), null);
});
test("spawned enemies are independent copies with stats and gear", () => {
  let i = 0; const seq = () => (i++ * 0.137) % 1;
  const t = db.enemies.get("raider");
  const a = E.spawn(t, "a", ctx, seq), b = E.spawn(t, "b", ctx, seq);
  a.special[0] = 10; a.name = "Raider Boss";
  assert.strictEqual(t.special[0], 5); assert.strictEqual(b.special[0], 5); assert.strictEqual(t.n, "Raider");
  assert.ok(a.weapons.length >= 1, "has a weapon");
  for (const s of a.weapons) { const w = E.get(ctx, s.n).o; assert.ok(w.ok, s.n); assert.ok(w.tier <= 2, s.n); }
  assert.strictEqual(E.derive(a, ctx).hp, 15 + 3 * 2 + 6);
  assert.strictEqual(E.derive(a, ctx).ap, 12);
});

test("Make Boss boosts a copy only", () => {
  const t = db.enemies.get("veteran");
  const e = E.spawn(t, "b", ctx, () => 0.5);
  const hp0 = E.derive(e, ctx).hp, w0 = E.get(ctx, e.weapons[0].n).o.tier, xp0 = e.xp;
  const r = E.makeBoss(e, ctx, () => 0.5);
  assert.ok(r.hp >= 0.1 && r.hp <= 0.3);
  assert.ok(E.derive(e, ctx).hp > hp0); assert.ok(e.dmgMult > 1); assert.ok(e.xp > xp0);
  assert.ok(E.get(ctx, e.weapons[0].n).o.tier > w0, "weapon goes up a tier");
  assert.strictEqual(t.xp, xp0);
});

test("jam clear cost is by weapon type and every weapon type has one", () => {
  const c = data.party[0]; const d = E.derive(c, ctx);
  const v = E.weaponView({ n: "Pipe Shotgun", ammo: "20 Gauge - Buckshot" }, c, d, ctx);
  assert.strictEqual(v.clearJam, rules.clearJam[v.type]);
  for (const ty of new Set(data.weapons.map((w) => w.type))) assert.ok(rules.clearJam[ty] != null, `no clear cost for ${ty}`);
});

test("weapons with no ammo system never block on an empty magazine", () => {
  const c = data.party[0]; const d = E.derive(c, ctx);
  const crank = data.weapons.find((w) => w.ammo === "Crank");
  assert.ok(crank);
  assert.strictEqual(E.weaponView({ n: crank.n }, c, d, ctx).usesAmmo, false);
  assert.strictEqual(E.weaponView({ n: "Pipe Flamer" }, c, d, ctx).usesAmmo, true);
});

test("overridden item data wins over the workbook", () => {
  const c = data.party[0]; const d = E.derive(c, ctx);
  const ov = { ...ctx, ov: { "pipe flamer": { dmg: 50 } } };
  assert.strictEqual(E.weaponView({ n: "Pipe Flamer" }, c, d, ov).base, 50);
});

test("default rules: hit chance is base weapon, skill and the gun bonus only", () => {
  const c = { db, rules: JSON.parse(JSON.stringify(DEFAULT_RULES)), scene: ctx.scene, ov: {} };
  const A = E.derive({ kind: "pc", special: [1, 1, 5, 5, 5, 5, 5], skills: {}, gear: {}, weapons: [] }, c);
  const v = E.weaponView({ n: "Pipe Pistol", ammo: ".32 ACP - Standard" }, { kind: "pc" }, A, c);
  const hc = E.hitChance({ kind: "pc" }, A, { kind: "npc" }, A, v, 8, c, false);
  assert.deepStrictEqual(hc.parts.map(([k]) => k).filter((k) => k !== "mods"), ["base", "skill", "gun"]);
});

// ---------- the 9 Nov 2026 balance pass, on the app's default rules
const R9 = JSON.parse(JSON.stringify(DEFAULT_RULES));
const c9 = { db, rules: R9, scene: ctx.scene, ov: {} };
const pc9 = (skills, extra = {}) => ({ kind: "pc", level: 1, special: [5, 5, 5, 5, 5, 5, 5], skills, gear: {}, weapons: [], statuses: [], effects: [], inv: [], ...extra });
test("balance pass: guns +12% at every range, skill over the requirement counts 1.5x rounded down", () => {
  const P = pc9({ SG: 40 }); const A = E.derive(P, c9);
  const w = data.weapons.find((x) => x.n === "Pipe Pistol"); const v = E.weaponView({ n: w.n, ammo: ".32 ACP - Standard" }, P, A, c9);
  for (const band of [1, 3, 5]) {
    const hc = E.hitChance(P, A, { kind: "npc" }, A, v, band, c9, null);
    const part = (k) => (hc.parts.find(([n]) => n === k) || [])[1];
    near(part("gun"), 0.12, "gun bonus");
    near(part("skill"), Math.floor(((40 - w.req) / 2) * 1.5) / 100, "skill counts 1.5x, rounded down");
  }
});
test("balance pass: heavy two-handed melee starts at 35%, light at 45%; melee AP x1.5; punches cost 1, 2, 3", () => {
  const P = pc9({ MW: 50 }); const A = E.derive(P, c9);
  const heavy = data.weapons.find((x) => x.tab === "MW" && x.tier && x.ok && x.type !== "Hand" && x.ap >= 3);
  const light = data.weapons.find((x) => x.tab === "MW" && x.tier && x.ok && x.type !== "Hand" && x.ap <= 2);
  const vh = E.weaponView({ n: heavy.n }, P, A, c9), vl = E.weaponView({ n: light.n }, P, A, c9);
  assert.strictEqual(vh.hitBase(), 0.35, heavy.n); assert.strictEqual(vl.hitBase(), 0.45, light.n);
  assert.strictEqual(vl.ap, Math.ceil(light.ap * 1.5)); assert.strictEqual(vh.ap, Math.ceil(heavy.ap * 1.5));
  const fist = { n: "Basic Fighting" };
  assert.deepStrictEqual([0, 1, 2].map((n) => E.weaponView(fist, { ...P, punches: n }, A, c9).ap), [1, 2, 3]);
});
test("balance pass: bursts cost 1 more AP, bullets come from where the roll lands, only the first bullet crits", () => {
  const P = pc9({ SG: 60 }); const A = E.derive(P, c9);
  const w = data.weapons.find((x) => x.tab === "SG" && x.ok && x.count === 4);
  const load = E.loadsFor(c9, w.ammo).find((a) => a.ok && !a.pellets);
  const v = E.weaponView({ n: w.n, ammo: load.n }, P, A, c9); assert.strictEqual(v.ap, w.ap + 1, "burst AP +1");
  // the example: hit at 60+, super at 95, a burst of 4
  const b = { jamAt: 0, hitAt: 60, critAt: 90, superAt: 95 };
  assert.deepStrictEqual([60, 75, 76, 85, 88, 94, 95].map((r) => E.bullets(r, b, 4, E.classify(r, b), R9)), [1, 1, 2, 2, 3, 3, 4]);
  const crit = E.resolve({ v, b, roll: 91, dt: 0, loc: "Body", rules: R9 });
  assert.strictEqual(crit.outcome, "crit"); assert.strictEqual(crit.bullets, 3);
  assert.strictEqual(crit.total, crit.each + crit.rest * 2, "one crit bullet, then plain hits"); assert.ok(crit.each > crit.rest);
});
test("balance pass: armor class sets the damage floor; creatures get Pen 4 a tier", () => {
  const floor = (armor) => E.floorOf({ kind: "pc", gear: { armor } }, c9);
  const of = (re) => data.armor.find((a) => ["Body", "Whole Body", "Power"].includes(a.loc) && re.test(a.type || "")).n;
  assert.deepStrictEqual([floor(""), floor(of(/^light/i)), floor(of(/^medium/i)), floor(of(/^heavy/i)), floor(of(/^power/i))], [0.4, 0.3, 0.2, 0.1, 0.05]);
  assert.strictEqual(E.resolve({ v: { base: 10, pen: 0, count: 1 }, b: { jamAt: 0, hitAt: 0, critAt: 100, superAt: 100 }, roll: 50, dt: 5, floor: 0.4, loc: "Body", rules: R9 }).total, 4, "10 damage, no Pen, clothing floor 40%");
  const dc = E.spawn(db.enemies.get("deathclaw"), "e9", c9, () => 0.5);
  const v = E.weaponView(dc.weapons[0], dc, E.derive(dc, c9), c9); assert.strictEqual(v.pen, 4 * dc.tier);
});
test("balance pass: players gain 2 HP a level with a 1.2x multiplier; enemy humans gain 5 a tier", () => {
  const P = pc9({}, { level: 6 }); assert.strictEqual(E.derive(P, c9).hp, Math.floor((15 + 5 * 2 + 2 * 5) * 1.2));
  const N = { kind: "npc", tier: 4, special: [5, 5, 5, 5, 5, 5, 5], skills: {}, gear: {}, weapons: [], statuses: [], effects: [], inv: [] };
  assert.strictEqual(E.derive(N, c9).hp, 15 + 10 + 3 * 5);
});
test("balance pass: vendors carry ammo only for the guns they stock, junk thins out, the best loads are scarce", () => {
  const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const [tier, seed] of [[1, 3], [3, 9], [6, 21]]) {
    const st = E.vendorStock(c9, tier, seeded(seed)); const cat = (l) => E.get(c9, l.n);
    const cals = new Set(st.filter((l) => cat(l).cat === "weapon").map((l) => E.low(cat(l).o.ammo || "")));
    for (const l of st.filter((l) => cat(l).cat === "ammo")) {
      assert.ok(cals.has(E.low(cat(l).o.cal)), `${l.n} has no gun on the shelf`);
      const k = E.ammoClass(c9, cat(l).o);
      if (tier === 6) assert.notStrictEqual(k, "junk", "no junk at tier 6");
      if (k === "best") assert.ok(l.q <= 10, "only a little of the best");
    }
  }
  assert.ok(E.valueOf(c9, "9mm Parabellum - Junk").val < E.valueOf(c9, "9mm Parabellum - Standard").val && E.valueOf(c9, "9mm Parabellum - Standard").val < E.valueOf(c9, "9mm Parabellum - Hand Load").val, "junk < standard < hand loads");
  assert.ok(data.ammo.some((a) => a.n === "5.56mm NATO - API" && a.cal === "5.56mm NATO"), "the API load is filed under 5.56mm NATO");
});
test("no placeholder gear in the data", () => {
  for (const list of [data.armor, data.items, data.weapons, data.materials]) assert.ok(!list.some((x) => /^\(no /i.test(x.n)));
  assert.ok(!data.enemies.some((e) => /^\(no /i.test(`${e.head || ""}`) || /^\(no /i.test(`${e.armor || ""}`)));
});
test("armor text reads into modifiers", () => {
  assert.deepStrictEqual(E.parseGear("10+ Big Guns, +10 Explosives, 1+ END, AG:L - 2"), { BG: 10, EXP: 10, E: 1, A: -2 });
  assert.deepStrictEqual(E.parseGear("Poison resistance, Sneak +10"), { SNK: 10 });
});
test("vendor stock: guns and armor stay in tier, consumables reach down, and higher tiers carry much more", () => {
  const size = {};
  for (const tier of [1, 3, 6]) {
    const stock = E.vendorStock({ db, rules, ov: {} }, tier);
    assert.ok(stock.length > 10);
    for (const l of stock) {
      const it = E.get({ db, ov: {} }, l.n); const t = Number(it.o.tier) || 1;
      if (it.cat === "weapon" || it.cat === "armor") assert.ok(t <= tier && t >= Math.max(1, tier - 1), `${l.n} is tier ${t}`);
      else assert.ok(t <= tier, `${l.n} is tier ${t}`);
      if (it.cat === "weapon") assert.ok(!E.isUnique(it.o), l.n);
      assert.ok(l.q > 0);
    }
    const kind = (l) => E.get({ db, ov: {} }, l.n).cat;
    size[tier] = { guns: stock.filter((l) => kind(l) === "weapon").length, cons: stock.filter((l) => kind(l) === "item").length, ammo: stock.filter((l) => kind(l) === "ammo").reduce((t, l) => t + l.q, 0) };
  }
  assert.ok(size[6].cons >= size[1].cons * 2, "a tier 6 vendor has far more consumables");
  assert.ok(size[6].ammo >= size[1].ammo * 3, "and far more ammo");
  assert.ok(size[6].guns <= size[1].guns + 3, "but still only a few guns");
});
test("barter: a vendor at 100 matches the sheet's price formula, and no resale profit", () => {
  const f = E.barterFactors(40, 100); near(f.buy, 100 / 40, "buy"); near(f.sell, 40 / 100, "sell");
  const g = E.barterFactors(90, 10); assert.ok(g.buy >= 1 && g.sell <= 1);
});
test("optimal range is the best band on the hit table", () => {
  assert.strictEqual(E.optimalRange(data.weapons.find((w) => w.n === "Pipe Pistol")), 2);
});

test("item text: heals use the formula, penalties stay penalties", () => {
  const user = { skills: { MED: 40, SUR: 30 }, sp: { E: 3 }, hp: 20 }, target = { skills: {}, sp: { E: 7 }, hp: 50 };
  assert.strictEqual(E.healAmount("10 HP + (Medicine/5)", user, target), 18);
  assert.strictEqual(E.healAmount("5 HP + (Survival/10), -1 AGI", user, target), 8);
  assert.strictEqual(E.healAmount("10 HP + END", user, target), 17);
  assert.strictEqual(E.healAmount("25% HP", user, target), 13);
  assert.strictEqual(E.healAmount("2+ STR, 2+ CHA, -2 INT, -2 HP", user, target), -2);
  assert.deepStrictEqual(E.parseEffect("x1.5 AP"), { apMul: 0.5 });
  assert.deepStrictEqual(E.parseEffect("2+ CHA, 1- INT"), { C: 2, I: -1 });
});
test("a saved named NPC comes back without old statuses", () => {
  const g = E.spawn(db.enemies.get("gecko"), "g", ctx, () => 0.5); g.statuses = [{ n: "Weak", tier: 2 }]; g.hp = 1;
  const again = E.spawn({ n: "G", saved: JSON.parse(JSON.stringify(g)) }, "h", ctx, () => 0.5);
  assert.deepStrictEqual(again.statuses, []); assert.ok(again.hp > 1);
});

test("40 archetypes: every kit is real, everyone can fight, wears clothes and carries something, and kits stay modest", () => {
  const list = DEFAULT_RULES.archetypes; assert.strictEqual(list.length, 40);
  const get = (n) => E.get({ db, ov: {} }, n);
  for (const a of list) {
    const w = get(a.w); assert.ok(w, `${a.n}: ${a.w}`); assert.ok(Number(w.o.tier) <= 2, `${a.n}: weapon tier ${w.o.tier}`);
    if (["SG", "BG"].includes(w.o.tab) && !w.o.thrown) assert.ok(a.ammo, `${a.n} has a gun but no ammo`);
    if (a.ammo) { assert.ok(get(a.ammo[0]), `${a.n}: ${a.ammo[0]}`); assert.ok(a.ammo[1] <= 10, `${a.n} rounds`); }
    const locs = a.wear.map((n) => { const g = get(n); assert.ok(g, `${a.n}: ${n}`); return g.o.loc; });
    assert.ok(locs.includes("Vanity") || locs.includes("Body"), `${a.n} has no clothes`);
    assert.ok(a.items.length >= 1 && a.items.length <= 3, `${a.n} items`);
    for (const [n, q] of a.items) { assert.ok(get(n), `${a.n}: ${n}`); assert.ok(q <= 10); }
    assert.ok(a.d && a.d.length <= 60 && !/ - |—|–/.test(a.d), `${a.n}: short plain description`);
  }
  assert.strictEqual(new Set(list.map((a) => a.n)).size, list.length, "names are unique");
});

test("combat stories: every token filled, players only go down, robots never bleed, and lines vary", () => {
  const { COMBAT_TEXT } = require("../src/combat_text.js");
  const parts = ["Head", "Body", "LArm", "RArm", "LLeg", "RLeg"], outs = ["hit", "crit", "super", "miss", "jam"];
  const weapons = data.weapons.filter((w) => w.tier).filter((_, i) => i % 7 === 0);
  let r = 0.21; const rng = () => (r = (r * 9301 + 49297) % 233280 / 233280);
  for (const w of weapons) for (const part of parts) for (const outcome of outs) for (const kind of ["flesh", "robot", "insect"]) for (const end of ["", "killed", "downed"]) {
    const s = E.story({ a: "Albert", t: "Raider 1", w, ammo: w.ammo ? w.ammo + " - Hollow Point" : "", d: 23, n: 3, part, outcome, kind, statuses: ["Bleeding", "Poisoned", "Burned"], killed: end === "killed", downed: end === "downed" }, COMBAT_TEXT, rng);
    assert.ok(s.length > 5 && !/[{}]/.test(s), "unfilled: " + s);
    assert.strictEqual((s.split(w.n).join("").match(/[.!?](\s|$)/g) || []).length, 1, "one sentence, no commentary: " + s);
    if (outcome !== "miss" && outcome !== "jam") assert.ok(s.includes("23 DMG"), "damage shown as DMG: " + s);
    if (kind === "robot" && end !== "killed") assert.ok(!/b(blood|lungs?|skin|bones?|venom|femur)b/i.test(s.split(w.n).join("")), "robot read as flesh: " + s);
  }
  const W = data.weapons.find((w) => /Sniper/.test(w.type));
  const once = () => E.story({ a: "Albert", t: "Raider 1", w: W, ammo: ".50 BMG - Standard", d: 40, n: 1, part: "LArm", outcome: "crit", kind: "flesh", statuses: [], killed: true }, COMBAT_TEXT);
  const lines = Array.from({ length: 6 }, once);
  for (let i = 1; i < lines.length; i++) assert.notStrictEqual(lines[i], lines[i - 1], "same line twice in a row");
  const down = E.story({ a: "Raider", t: "Gordon", w: W, d: 30, part: "Head", outcome: "super", kind: "flesh", downed: true }, COMBAT_TEXT);
  assert.ok(!/dead|skull|brains|decapitat/i.test(down.split(".").slice(-3).join(".")) || /down|breathing|grey|ground/i.test(down), "players go down, they don't die: " + down);
});

test("line of fire: the worst tier crossed wins, and open is the default", () => {
  const r = DEFAULT_RULES; const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
  assert.strictEqual(E.lineCover(a, b, [], r).tier, "open");
  const bush = { x: 3, y: 0, w: 1, h: 1, cover: "concealment" }, rock = { x: 6, y: 0, w: 1, h: 1, cover: "soft" }, off = { x: 5, y: 5, w: 1, h: 1, cover: "impenetrable" };
  assert.strictEqual(E.lineCover(a, b, [bush], r).hit, -0.1);
  assert.strictEqual(E.lineCover(a, b, [bush, rock, off], r).tier, "soft", "misses the wall to the side");
  assert.strictEqual(E.lineCover({ x: 3, y: 0 }, b, [bush], r).tier, "open", "you can shoot out of the bush you stand in");
  assert.ok(E.pathBlocked(a, b, [{ x: 5, y: 0, w: 2, h: 2, block: true }])); assert.ok(!E.pathBlocked(a, b, [rock]));
  assert.deepStrictEqual(Object.values(r.cover).map((c) => [c.hit, c.dam]), [[0, 0], [-0.1, 0], [-0.25, -0.1], [-0.5, -0.5], [-1, -1]]);
});
test("room generator: every theme fills a room, stays in bounds, no overlaps, city gets blocks", () => {
  for (const id of Object.keys(DEFAULT_RULES.roomThemes)) {
    const map = { w: 40, h: 30 }; const room = E.generateRoom(map, id, DEFAULT_RULES, Math.random, [{ x: -18, y: 0 }]);
    assert.ok(room.length >= 2, id);
    for (const o of room) { assert.ok(Math.abs(o.x) <= map.w / 2 + 0.01 && Math.abs(o.y) <= map.h / 2 + 0.01, `${id} ${o.item} out of bounds`); assert.ok(DEFAULT_RULES.cover[o.cover], o.item); }
    room.forEach((p, i) => room.forEach((q, j) => { if (i < j && !(p.item === "concreteWall" && q.item === "concreteWall")) assert.ok(Math.abs(p.x - q.x) >= (p.w + q.w) / 2 - 0.05 || Math.abs(p.y - q.y) >= (p.h + q.h) / 2 - 0.05, `${id}: ${p.item} overlaps ${q.item}`); }));  // wall pieces meet at corners
  }
  const city = E.generateRoom({ w: 90, h: 70 }, "city", DEFAULT_RULES, Math.random);
  assert.ok(city.filter((o) => o.item === "building" && o.block && o.cover === "impenetrable").length >= 2, "concrete blocks");
  assert.ok(!E.generateRoom({ w: 12, h: 10 }, "city", DEFAULT_RULES, Math.random).some((o) => o.item === "building"), "no buildings in a small room");
});
test("standardized effects: substances, reductions, variables", () => {
  const by = (n) => data.items.find((i) => i.n === n);
  assert.strictEqual(data.statuses.find((s) => s.n === "Cover"), undefined, "Cover moved to the rules");
  assert.deepStrictEqual(by("Med-X").use.applies[0], { n: "Anaesthetised", tier: 5, fx: { dmgTaken: -0.25 } }, "painkillers lower damage taken");
  const beer = by("Beer - 714 Beer").use; assert.deepStrictEqual(beer.applies.map((a) => a.n), ["Loose", "Drunk"]); assert.deepStrictEqual(beer.applies[0].fx, { S: 1, C: 1, I: -1 }); assert.deepStrictEqual(beer.applies[1].fx, {}, "no double counting");
  assert.strictEqual(beer.after.n, "Hangover");
  assert.deepStrictEqual(by("Bandage").use.reduces, { Bleeding: 1 }); assert.ok(by("Jet").use.removes.includes("Disoriented")); assert.deepStrictEqual(by("Splint").use.reduces, { "Injured Limb (Leg/Arm)": 1 });
  assert.strictEqual(by("Stimpak").use.applies.length, 0, "medical items stay plain heals"); assert.ok(by("Stimpak").use.heal);
  const s = (n, t) => data.statuses.find((x) => x.n === n).fx[t];
  assert.strictEqual(s("Burned", 0).hpPct, -0.1); assert.strictEqual(s("Burned", 0).heal, -0.1); assert.strictEqual(s("Plasma Melt", 1).dtPct, -0.2); assert.strictEqual(s("Calm", 0).crit, 0.05); assert.strictEqual(s("Injured Limb (Leg/Arm)", 1).mvm, -0.25); assert.strictEqual(s("Injured Limb (Leg/Arm)", 4).immobile, 1); assert.strictEqual(s("Anaesthetised", 0).dmgTaken, -0.05);
  const perk = data.levelPerks.find((p) => /^Improves AP by 1 when/.test(p.effect)); assert.deepStrictEqual([perk.fx, perk.when], [{ ap: 1 }, { hpBelow: 0.2 }]);
  assert.ok(skippedList.length > 0);
});
test("a hurt-only perk counts only when hurt", () => {
  const perk = data.levelPerks.find((p) => /^Improves DT by 1 when/.test(p.effect));
  const on = { ...ctx, rules: DEFAULT_RULES };
  const pc = (hp) => E.derive({ kind: "pc", hp, special: [5, 5, 5, 5, 5, 5, 5], perks: [perk.n], gear: {}, inv: [], weapons: [], statuses: [], effects: [], level: 1 }, on).dt;
  assert.strictEqual(pc(1) - pc(25), 1);
});
test("cover and damage-taken multiply damage", () => {
  const v = { base: 10, pen: 99, count: 1 }; const b = E.bands(0.9, 0, 0, 0, { rules: {} });
  const res = (mult) => E.resolve({ v, b, roll: 50, dt: 0, loc: "Body", rules: DEFAULT_RULES, mult }).total;
  assert.strictEqual(res(1), 10); assert.strictEqual(res(0.5), 5); assert.strictEqual(res(0), 0);
});

test("conditions: reminders turned into rules that switch on for the right shot", () => {
  const c = { db, rules: DEFAULT_RULES, scene: ctx.scene, ov: {} };
  const pc = (perks, extra = {}) => ({ kind: "pc", hp: 20, special: [5, 5, 5, 5, 5, 5, 5], perks, gear: {}, inv: [], weapons: [], statuses: [], effects: [], level: 1, ...extra });
  const shot = (e, s) => { const d = E.derive(e, c); return E.forShot(d, e, s, c); };
  assert.strictEqual(shot(pc(["Robotics Expert"]), { vs: "robot", round: 1 }).m.dam, 0.25);
  assert.strictEqual(shot(pc(["Robotics Expert"]), { vs: "human", round: 1 }).m.dam, undefined, "not against humans");
  assert.strictEqual(shot(pc(["Opportune Strike"]), { round: 3 }).m.crit, 0.04, "grows each round");
  assert.strictEqual(shot(pc(["Quickdraw"]), { round: 1, range: 1, o: { tab: "SG" } }).m.acc, 0.2);
  assert.strictEqual(shot(pc(["Quickdraw"]), { round: 2, range: 1, o: { tab: "SG" } }).m.acc, undefined, "first turn only");
  assert.strictEqual(shot(pc(["Hit The Deck"]), { round: 1, attackerO: { tab: "EX" } }).dt - E.derive(pc(["Hit The Deck"]), c).dt, 12, "defensive rule");
  assert.strictEqual(E.enemyType({ kind: "npc", tmpl: "Protectron", mob: true }, DEFAULT_RULES), "robot");
  assert.strictEqual(E.enemyType({ kind: "npc", tmpl: "Giant Ant", mob: true }, DEFAULT_RULES), "insect");
  const pistolero = data.sc.find((r) => r.n === "Pistolero"); assert.ok(pistolero.when.types.includes("Revolver"), "Meant only for became a condition");
  const finesse = data.sc.find((r) => r.n === "Finesse"); assert.strictEqual(finesse.mods.critDam, 0.25, "Not automated became a variable");
});
test("crit variables change the math", () => {
  const v = { base: 10, pen: 99, count: 1 }; const b = E.bands(0.9, 0, 0.5, 0.01, { rules: {} });
  const go = (roll, shot, loc = "Body") => E.resolve({ v, b, roll, dt: 0, loc, rules: DEFAULT_RULES, shot });
  assert.strictEqual(go(60, {}).total, 20); assert.strictEqual(go(60, { critMult: 1 }).total, 30); assert.strictEqual(go(60, { critDam: 0.5 }).total, 30);
  assert.strictEqual(go(60, { critToSuper: 1 }).outcome, "super"); assert.ok(go(99, { superKill: 1 }).kill);
});

test("every preset map is whole grid squares, with its objects inside and real", () => {
  const r = DEFAULT_RULES;
  for (const [id, m] of Object.entries(r.maps)) {
    assert.strictEqual(m.w % r.gridM, 0, `${id} width`); assert.strictEqual(m.h % r.gridM, 0, `${id} height`);
    for (const [key, x, y, w, h] of m.objs || []) {
      assert.ok(r.mapItems[key], `${id}: ${key} isn't a catalog item`);
      assert.ok(Math.abs(x) + w / 2 <= m.w / 2 + 0.01 && Math.abs(y) + h / 2 <= m.h / 2 + 0.01, `${id}: ${key} sticks out of the map`);
    }
    for (const [key] of m.scatter || []) assert.ok(r.mapItems[key], `${id}: ${key}`);
  }
  assert.strictEqual(r.mapItems.tree.cover, "soft"); assert.strictEqual(r.mapItems.bigTree.cover, "soft");
  assert.deepStrictEqual(["concealment", "soft", "hard", "impenetrable"].map((k) => r.cover[k].opacity), [0.3, 0.5, 0.7, 1]);
});

test("trees: only the trunk stops a shot, the leaves don't", () => {
  const r = DEFAULT_RULES; const tree = { item: "tree", kind: "tree", cover: "soft", x: 5, y: 0, w: 4, h: 4 };
  assert.strictEqual(E.lineCover({ x: 0, y: 0 }, { x: 10, y: 0 }, [tree], r).tier, "soft", "through the trunk");
  assert.strictEqual(E.lineCover({ x: 0, y: 1.5 }, { x: 10, y: 1.5 }, [tree], r).tier, "open", "through the leaves only");
  const crate = { item: "crate", kind: "cover", cover: "soft", x: 5, y: 0, w: 4, h: 4 };
  assert.strictEqual(E.lineCover({ x: 0, y: 1.5 }, { x: 10, y: 1.5 }, [crate], r).tier, "soft", "a crate stops it across its whole size");
});

test("rotation: shots and walking follow the turned shape", () => {
  const r = DEFAULT_RULES; const wall = { kind: "wall", cover: "impenetrable", block: true, x: 5, y: 0, w: 10, h: 0.4 };
  const a = { x: 5, y: -3 }, b = { x: 5, y: 3 }, side = { x: 0, y: 3 }, side2 = { x: 10, y: 3 };
  assert.strictEqual(E.lineCover(a, b, [wall], r).tier, "impenetrable", "crosses it flat");
  assert.strictEqual(E.lineCover(side, side2, [wall], r).tier, "open", "passes above it");
  const turned = { ...wall, angle: 90 };
  assert.strictEqual(E.lineCover(side, side2, [turned], r).tier, "impenetrable", "turned upright it's in the way");
  assert.ok(E.pathBlocked(side, side2, [turned]));
  assert.strictEqual(E.lineCover({ x: 8, y: -3 }, { x: 8, y: 3 }, [turned], r).tier, "open", "and no longer reaches here");
  const diag = { ...wall, angle: 45 };
  assert.strictEqual(E.lineCover({ x: 8, y: 0 }, { x: 8, y: 6 }, [diag], r).tier, "impenetrable", "a diagonal blocks along its diagonal");
  assert.strictEqual(E.lineCover({ x: 8, y: -6 }, { x: 8, y: -1 }, [diag], r).tier, "open");
  assert.ok(E.inside({ x: 5, y: 4 }, turned)); assert.ok(!E.inside({ x: 5, y: 4 }, wall));
});

test("tracked reminders: counts and situations drive the rules", () => {
  const c = { db, rules: DEFAULT_RULES, scene: { ...ctx.scene, effects: [] }, ov: {} };
  const pc = (perks, extra = {}) => ({ kind: "pc", hp: 20, special: [5, 5, 5, 5, 5, 5, 5], perks, gear: {}, inv: [], weapons: [], statuses: [], effects: [], level: 1, ...extra });
  const shot = (e, s) => E.forShot(E.derive(e, c), e, { round: 1, ...s }, c);
  assert.strictEqual(shot(pc(["Concentrated Gunfire"]), { streak: 3 }).m.acc, 0.15, "subsequent hits add up");
  assert.strictEqual(shot(pc(["Concentrated Gunfire"]), { streak: 0 }).m.acc || 0, 0);
  const row = (n) => data.sc.find((r) => r.n === n);
  assert.deepStrictEqual(row("Underworld Nationalist").when, { perKillHuman: true }); assert.strictEqual(row("Underworld Nationalist").note, undefined);
  assert.strictEqual(row("Police Gas Mask").mods["resist:Poisoned"], 1);
  assert.strictEqual(data.items.find((i) => i.n === "Rad-X").use.fx["resist:Irradiated"], 1);
  assert.strictEqual(data.items.find((i) => i.n === "Numbing Salve").use.numb, true);
  assert.strictEqual(data.statuses.find((s) => s.n === "Sedated").fx[2].ignoreTier, 3);
  const weak = pc([], { statuses: [{ n: "Weak", tier: 2 }, { n: "Sedated", tier: 3 }] }); assert.strictEqual(E.derive(weak, c).sp.S, 5, "Sedated ignores low-tier harm");
  const numb = pc([], { statuses: [{ n: "Weak", tier: 2 }], numbed: 2 }); assert.strictEqual(E.derive(numb, c).sp.S, 5, "Numbing Salve suspends statuses");
  assert.strictEqual(shot(pc(["Loyal Party Member"], { traits: [] }), {}).m.weaponSkill, undefined);
  const lp = pc(["Lucky Number"], {}); const m = shot(lp, {}).m; assert.strictEqual(m.lucky, 1);
  const v = { base: 10, pen: 99, count: 1 }; const b = E.bands(0.9, 0, 0.1, 0.01, { rules: {} });
  assert.strictEqual(E.resolve({ v, b, roll: 47, dt: 0, loc: "Body", rules: DEFAULT_RULES, shot: { lucky: 1, luckyDigit: 7 } }).outcome, "crit");
  assert.strictEqual(E.resolve({ v, b, roll: 46, dt: 0, loc: "Body", rules: DEFAULT_RULES, shot: { lucky: 1, luckyDigit: 7 } }).outcome, "hit");
});

test("enemy list: factions on everyone real, and every new enemy spawns with working weapons", () => {
  const real = data.enemies.filter((e) => !e.test);
  assert.ok(real.length >= 177, `${real.length} enemies`);
  assert.deepStrictEqual(real.filter((e) => !e.faction).map((e) => e.n), [], "every enemy has a faction");
  const names = real.map((e) => e.n); assert.strictEqual(new Set(names).size, names.length, "no duplicate names");
  for (const f of ["Jackals", "Vipers", "Fiends", "Rogue Scavengers", "Highwaymen", "City Muggers", "Omertas", "Garrets", "Chairmen", "White Glove Society", "The Kings", "Unaligned"]) assert.ok(real.some((e) => e.faction === f), f);
  const c = { db, rules: DEFAULT_RULES, scene: { effects: [] }, ov: {} };
  for (const e of real.filter((x) => !x.mob && x.w1)) {
    const s = E.spawn(e, "x", c, () => 0.5); assert.ok(s.hp > 0 && s.weapons.length >= 1, e.n);
    assert.ok(E.get(c, s.weapons[0].n), `${e.n}: ${s.weapons[0].n}`);
  }
});

test("new enemies follow the workbook's pattern for skills, SPECIAL and XP", () => {
  const names = JSON.parse(fs.readFileSync(path.join(__dirname, "new_enemies.json"), "utf8"));
  const by = new Map(data.enemies.map((e) => [e.n, e])); const fresh = names.map((n) => by.get(n)); assert.strictEqual(fresh.length, 50);
  const mine = data.enemies.filter((e) => !e.test && !e.mob && !names.includes(e.n) && e.skills && e.skills.MW != null && e.skills.EW != null);
  // The bands come straight from the DM's own enemies at each tier.
  const band = (t, f) => { const v = mine.filter((e) => e.tier === t).map(f); return [Math.min(...v), Math.max(...v)]; };
  const top = (e) => Math.max(e.skills.EW, e.skills.SG, e.skills.BG, e.skills.MW); const sum = (e) => e.special.reduce((a, b) => a + (b || 0), 0);
  for (const e of fresh) {
    assert.deepStrictEqual(Object.keys(e.skills).slice(0, 4), ["EW", "SG", "BG", "MW"], `${e.n}: the same four skills in the same order`);
    assert.ok(Object.keys(e.skills).every((k) => ["EW", "SG", "BG", "MW", "EXP"].includes(k)), `${e.n}: no other skills`);
    assert.ok(Object.values(e.skills).every((v) => v % 5 === 0), `${e.n}: multiples of 5`);
    assert.strictEqual(e.special.length, 7);
    const [lo, hi] = band(e.tier, top); const [slo, shi] = band(e.tier, sum);
    assert.ok(top(e) >= Math.min(lo, 20) && top(e) <= hi + 10, `${e.n} top skill ${top(e)} vs tier ${e.tier} band ${lo}-${hi}`);
    assert.ok(sum(e) <= shi + 1 && sum(e) >= slo - 2, `${e.n} SPECIAL total ${sum(e)} vs tier ${e.tier} band ${slo}-${shi}`);
    assert.ok(/^\d+-\d+$/.test(e.caps), e.n);
  }
});


// ---------- room layouts: every map with every setting, then the rules that make a room make sense
const LAYOUT_RULES = DEFAULT_RULES;
const seeded = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const room = (id, theme, seed, w, h) => { const m = { id, w: w || LAYOUT_RULES.maps[id].w, h: h || LAYOUT_RULES.maps[id].h }; return { m, objs: E.generateRoom(m, theme, LAYOUT_RULES, seeded(seed), [{ x: -m.w / 2 + 2, y: 0 }]) }; };
const touching = (a, b, g = 0.15) => Math.abs(a.x - b.x) <= (a.w + b.w) / 2 + g && Math.abs(a.y - b.y) <= (a.h + b.h) / 2 + g;
const wallish = (o) => o.item === "concreteWall" || o.item === "building";

test("layouts: every map with every setting fits, nothing overlaps, and everything can be walked up to", () => {
  for (const id of Object.keys(LAYOUT_RULES.maps)) for (const theme of Object.keys(LAYOUT_RULES.roomThemes)) for (const seed of [11, 4242, 90001]) {
    const { m, objs } = room(id, theme, seed); const tag = `${id}/${theme}/${seed}`;
    for (const o of objs) assert.ok(o.x - o.w / 2 >= -m.w / 2 - 0.01 && o.x + o.w / 2 <= m.w / 2 + 0.01 && o.y - o.h / 2 >= -m.h / 2 - 0.01 && o.y + o.h / 2 <= m.h / 2 + 0.01, `${tag}: ${o.item} is off the map`);
    for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) { const a = objs[i], b = objs[j]; if (wallish(a) && wallish(b)) continue; assert.ok(!(Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.05 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 0.05), `${tag}: ${a.item} on top of ${b.item}`); }
    const R = E.layoutReach(objs, m); assert.ok(R.share >= 0.85, `${tag}: the floor is cut into pieces`); assert.ok(R.inMain({ x: -m.w / 2 + 2, y: 0 }), `${tag}: the party is walled in`);
    const stuff = objs.filter((o) => !wallish(o));
    for (const o of stuff) assert.ok(R.reachable(o) || stuff.some((p) => p !== o && touching(o, p) && R.reachable(p)), `${tag}: nobody can get to the ${o.item}`);
    const n = {}; for (const o of objs) n[o.item] = (n[o.item] || 0) + 1;
    const perBuilding = id === "streets" && E.LAYOUT.indoorThemes.includes(theme);  // in a city the limits are per building
    for (const [k, v] of Object.entries(n)) if (E.LAYOUT.caps[k] && !perBuilding) assert.ok(v <= E.LAYOUT.caps[k], `${tag}: ${v} ${k}`);
    if (["home"].includes(theme) && !perBuilding) assert.ok((n.stove || 0) <= 1, `${tag}: one kitchen per home`);
  }
});

test("layouts: warehouses have parallel shelf rows with walkable aisles, factories have production lines", () => {
  for (const seed of [3, 77, 501, 9001]) {
    const { objs } = room("warehouse", "warehouse", seed);
    const shelves = objs.filter((o) => o.item === "shelves"); assert.ok(shelves.length >= 8, "a warehouse has shelves");
    assert.ok(shelves.every((s) => !!s.rot === !!shelves[0].rot), "all shelf rows run the same way");
    const across = shelves[0].rot ? "x" : "y"; const rows = [...new Set(shelves.map((s) => s[across].toFixed(2)))].map(Number).sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i] - rows[i - 1] - 1 >= 2.2, `aisle between shelf rows is ${(rows[i] - rows[i - 1] - 1).toFixed(2)}m`);
    const f = room("warehouse", "factory", seed).objs;
    const belts = f.filter((o) => o.item === "conveyor"); assert.ok(belts.length >= 4, "a factory has conveyor lines");
    for (const b of belts) assert.ok(belts.some((c) => c !== b && touching(b, c, 0.1)), "every conveyor joins the line");
    assert.ok(belts.every((b) => !!b.rot === !!belts[0].rot), "lines run straight");
    for (const p of f.filter((o) => o.item === "pressMachine")) assert.ok(belts.some((b) => touching(p, b, 0.3)), "press machines sit on the line");
    const drums = f.filter((o) => o.item === "oilDrum"); for (const d of drums) assert.ok(drums.some((e) => e !== d && touching(d, e, 0.15)), "oil drums stand in rows");
    assert.ok(f.some((o) => o.item === "boiler") && f.some((o) => o.item === "generator"), "a utility corner");
  }
});

test("layouts: offices, homes, police stations and camps are furnished the way people use them", () => {
  for (const seed of [5, 61, 777]) {
    const o = room("bigRoom", "office", seed).objs; const chairs = o.filter((x) => x.item === "officeChair");
    for (const d of o.filter((x) => x.item === "desk")) assert.ok(chairs.some((c) => Math.hypot(c.x - d.x, c.y - d.y) < 1.6), "every desk has a chair");
    for (const p of o.filter((x) => x.item === "partition")) assert.ok(o.filter((x) => x.item === "desk" && touching(x, p, 0.1)).length >= 2, "partitions divide desk pods");
    const h = room("interior", "home", seed).objs;
    const strip = ["fridge", "stove", "sink"].map((k) => h.find((x) => x.item === k)).filter(Boolean);
    if (strip.length === 3) assert.ok(touching(strip[0], strip[1], 0.1) && touching(strip[1], strip[2], 0.1), "the kitchen is one strip: fridge, stove, sink");
    assert.ok(h.some((x) => x.item === "bed") && h.some((x) => x.item === "toilet"), "a home has a bedroom and a bathroom");
    assert.ok(h.filter((x) => x.item === "concreteWall").length >= 3, "a home is split into rooms");
    const p = room("warehouse", "police", seed).objs;
    assert.ok(p.some((x) => x.item === "frontCounter") && p.filter((x) => x.item === "cellBars").length >= 2, "a counter and a row of cells");
    const c = room("wild", "tent", seed).objs; const fire = c.find((x) => x.item === "campfire");
    for (const b of c.filter((x) => x.item === "cot" || x.item === "bedroll")) assert.ok(c.filter((x) => x.item === "campfire").some((f) => Math.hypot(b.x - f.x, b.y - f.y) < 4.5), "beds are around the fire");
    assert.ok(fire, "a camp has a fire");
  }
});

test("layouts: a building setting on open ground is a building in the middle, and on city streets every block is one", () => {
  for (const seed of [2, 31, 404]) {
    const { m, objs } = room("wild", "factory", seed);
    const walls = objs.filter((o) => o.item === "concreteWall"); assert.ok(walls.length >= 4, "the factory has walls");
    const box = { x0: Math.min(...walls.map((w) => w.x - w.w / 2)), x1: Math.max(...walls.map((w) => w.x + w.w / 2)), y0: Math.min(...walls.map((w) => w.y - w.h / 2)), y1: Math.max(...walls.map((w) => w.y + w.h / 2)) };
    const inBox = (o) => o.x > box.x0 && o.x < box.x1 && o.y > box.y0 && o.y < box.y1;
    for (const o of objs.filter((x) => ["conveyor", "pressMachine", "workbench", "boiler"].includes(x.item))) assert.ok(inBox(o), `the ${o.item} is inside the factory`);
    for (const o of objs.filter((x) => ["boulder", "cactus", "dune", "deadTree"].includes(x.item))) assert.ok(!inBox(o), `no ${o.item} inside the factory`);
    assert.ok(objs.some((o) => o.item === "oilDrum" && !inBox(o)), "junk outside: drums along the walls");
    assert.ok(objs.filter((o) => ["boulder", "rock", "cactus"].includes(o.item)).length >= 10, "the rest is wilderness");
    assert.ok(Math.abs((box.x0 + box.x1) / 2) < 2 && Math.abs((box.y0 + box.y1) / 2) < 2 && box.x1 - box.x0 < m.w * 0.7, "in the middle, not filling the map");
    // city blocks of factories: every machine has walls on all four sides
    const city = room("streets", "factory", seed).objs; const cw = city.filter((o) => o.item === "concreteWall");
    // three parallel sight lines each way, 2m apart: a doorway can let one or two through, never all three
    const hits = (o, dx, dy, off) => cw.some((w) => (dx ? Math.abs(w.y - (o.y + off)) <= w.h / 2 && Math.sign(w.x - o.x) === dx && Math.abs(w.x - o.x) < 25 : Math.abs(w.x - (o.x + off)) <= w.w / 2 && Math.sign(w.y - o.y) === dy && Math.abs(w.y - o.y) < 25));
    const walled = (o) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => [-2, 0, 2].some((off) => hits(o, dx, dy, off)));
    const machines = city.filter((o) => ["conveyor", "pressMachine", "workbench"].includes(o.item)); assert.ok(machines.length >= 6, "the blocks are factories");
    for (const o of machines) assert.ok(walled(o), `the ${o.item} is inside a building, not in the street`);
    assert.ok(city.some((o) => o.item === "car") && city.some((o) => o.item === "lamppost"), "streets keep their cars and lamp posts");
  }
});

test("frag grenade: damage falls off by meter out to 5m, and it weighs half a pound", () => {
  const t = rules.throwables["Frag Grenade"];
  assert.deepStrictEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 5.01].map((d) => E.blastDamage(t, d)), [12, 12, 12, 8, 8, 4, 4, 2, 1, 0]);
  assert.strictEqual(t.ap, 1);
  const c = JSON.parse(JSON.stringify(data.party[0])); const before = E.derive(c, ctx).enc.total; c.inv.push({ n: "Frag Grenade", q: 2, active: true });
  assert.ok(Math.abs(E.derive(c, ctx).enc.total - before - 1) < 0.01, "two grenades are 1 lb");
});
test("cover: beds, campfires and other low things are open ground", () => {
  for (const k of ["bed", "cot", "bedroll", "campfire", "pallet", "footlocker", "bench", "smallRock", "stump", "tentPole"]) assert.strictEqual(rules.mapItems[k].cover, "open", k);
  assert.strictEqual(rules.mapItems.kitchenTable.cover, "concealment");
});
