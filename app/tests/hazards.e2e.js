// 12 Nov (late): hazards, rads, doors and the vault rule in the real app.
// Run: node tests/hazards.e2e.js
const path = require("path");
const assert = require("node:assert");
const { chromium } = require("playwright-core");
const APP = "file:///" + path.resolve(__dirname, "../../Fallout DM App.html").replace(/\\/g, "/");
let pass = 0,
  fail = 0;
(async () => {
  let b;
  for (const channel of ["msedge", "chrome"]) {
    try {
      b = await chromium.launch({ channel, headless: true });
      break;
    } catch (e) {}
  }
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("dialog", (d) => d.accept());
  await p.goto(APP);
  const step = async (name, fn) => {
    try {
      await fn();
      pass++;
      console.log("PASS ", name);
    } catch (e) {
      fail++;
      console.log("FAIL ", name, " ", String(e.message).split("\n")[0]);
    }
  };
  // a fight on a cleared map, the first party member's turn; put(item or hazard, dx, dy) places something beside them
  await p.evaluate(() => {
    ACT.setupOpen("1");
    ACT.clearRoom();
    ACT.addPick(allTemplates()[0].n);
    ACT.beginC("");
    beginRounds();
    window.__put = (what, dx, dy, extra = {}) => {
      const me = posOf(S.chars[0].id);
      const c = S.rules.mapItems[what];
      const o = c
        ? { id: "o" + S.seq++, kind: "cover", item: what, cover: c.cover, x: me.x + dx, y: me.y + dy, w: c.w, h: c.h, label: "", ...extra }
        : { id: "o" + S.seq++, kind: "hazard", sub: what, x: me.x + dx, y: me.y + dy, w: 2, h: 2, label: "" };
      S.scene.objects.push(o);
      return o;
    };
    window.__endTurn = () => {
      startTurn(S.chars[0].id);
      nextTurn();
    };
    render();
  });
  const me = () => p.evaluate(() => ({ rads: S.chars[0].rads || 0, hp: S.chars[0].hp, st: (S.chars[0].statuses || []).map((s) => `${s.n} ${s.tier}`) }));

  await step("a radioactive barrel gives 10 rads to whoever ends a turn within 2 m; 200 rads is Irradiated 1", async () => {
    await p.evaluate(() => {
      S.scene.objects = [];
      __put("radBarrel", 1.8, 0);
      __endTurn();
    });
    assert.strictEqual((await me()).rads, 10);
    await p.evaluate(() => {
      S.chars[0].rads = 195;
      __endTurn();
    });
    const m = await me();
    assert.strictEqual(m.rads, 205);
    assert.ok(m.st.includes("Irradiated 1"), m.st.join());
    assert.match(await p.locator(`.card[data-card] .radline .tag`).first().textContent(), /IRR 1/);
    await p.evaluate(() => {
      S.scene.objects[0].x += 4; // now 4 m off: too far
      __endTurn();
    });
    assert.strictEqual((await me()).rads, 205);
  });
  await step("fire under you at the end of a turn burns: Burned 1, then 2", async () => {
    await p.evaluate(() => {
      S.scene.objects = [];
      S.chars[0].statuses = [];
      __put("fire", 0, 0);
      __endTurn();
    });
    assert.ok((await me()).st.includes("Burned 1"));
    await p.evaluate(() => __endTurn());
    assert.ok((await me()).st.includes("Burned 2"));
  });
  await step("a rad lake can be walked into, and ending a turn in it costs 25 rads and 3 HP", async () => {
    const before = await p.evaluate(() => {
      S.scene.objects = [];
      S.chars[0].statuses = [];
      S.chars[0].rads = 0;
      S.chars[0].hp = der(S.chars[0]).hp;
      __put("radLake", 0, 0);
      return { hp: S.chars[0].hp, stand: standBlocked(posOf(S.chars[0].id)) };
    });
    assert.strictEqual(before.stand, false, "you can stand in it");
    await p.evaluate(() => __endTurn());
    const m = await me();
    assert.deepStrictEqual([m.rads, m.hp], [25, before.hp - 3]);
  });
  await step("the DM types rads on the card; the Irradiated tier follows it up and down", async () => {
    const box = p.locator(`#rd-${await p.evaluate(() => S.chars[0].id)}`);
    await box.fill("650");
    await box.press("Enter");
    await p.waitForFunction(() => S.chars[0].rads === 650);
    assert.ok((await me()).st.includes("Irradiated 3"));
    await box.fill("0");
    await box.press("Enter");
    await p.waitForFunction(() => S.chars[0].rads === 0);
    assert.ok(!(await me()).st.some((s) => s.startsWith("Irradiated")));
  });
  await step("anything that would have to be vaulted stops a walk; open things don't", async () => {
    const r = await p.evaluate(() => {
      S.scene.objects = [];
      const a = posOf(S.chars[0].id),
        to = { x: a.x + 6, y: a.y };
      __put("sandbags", 3, 0, { rot: 90, w: 0.6, h: 2 });
      const sand = E.pathBlocked(a, to, S.scene.objects, S.rules);
      S.scene.objects = [];
      __put("pallet", 3, 0);
      return { sand, pallet: E.pathBlocked(a, to, S.scene.objects, S.rules) };
    });
    assert.deepStrictEqual(r, { sand: true, pallet: false });
  });
  await step("a shut door blocks walking and sight, is cover by its material, and opens from the map", async () => {
    const id = await p.evaluate(() => {
      S.scene.objects = [];
      const T = foes()[0],
        a = posOf(S.chars[0].id);
      S.combat.cbs.find((c) => c.id === T.id).x = a.x + 8;
      S.combat.cbs.find((c) => c.id === T.id).y = a.y;
      const d = __put("ironDoor", 4, 0, { w: 0.2, h: 1.4 });
      startTurn(S.chars[0].id);
      ACT.attack();
      ui.atk.tgt = T.id;
      ui.mapSel = d.id;
      render();
      return d.id;
    });
    assert.match(await p.locator(".covflag").first().textContent(), /Soft cover[\s\S]*no sight/);
    assert.strictEqual(await p.evaluate(() => E.pathBlocked(posOf(S.chars[0].id), { x: posOf(S.chars[0].id).x + 8, y: posOf(S.chars[0].id).y }, S.scene.objects, S.rules)), true);
    await p.locator(`[data-a="objDoor"][data-v="${id}"]`).click();
    assert.strictEqual(await p.evaluate((id) => S.scene.objects.find((o) => o.id === id).open, id), true);
    assert.strictEqual(await p.evaluate(() => E.pathBlocked(posOf(S.chars[0].id), { x: posOf(S.chars[0].id).x + 8, y: posOf(S.chars[0].id).y }, S.scene.objects, S.rules)), false);
    assert.doesNotMatch(await p.locator(".covflag").first().textContent(), /no sight/);
  });
  await step("a generated home has wooden doors; a police station a steel front door", async () => {
    const r = await p.evaluate(() => {
      const out = {};
      for (const t of ["home", "police"]) {
        S.scene.theme = t;
        S.scene.objects = E.generateRoom({ id: "open", w: 60, h: 50 }, t, S.rules, Math.random, [], () => "g" + S.seq++);
        out[t] = [...new Set(S.scene.objects.filter((o) => o.door).map((o) => o.item))];
      }
      render();
      return out;
    });
    assert.deepStrictEqual(r.home, ["woodDoor"]);
    assert.ok(r.police.includes("steelDoor"));
  });
  // ---- second round: traps on the way, hidden traps, dispositions
  const freshFight = () =>
    p.evaluate(() => {
      S.combat = null;
      for (const c of S.chars) Object.assign(c, { statuses: [], dbno: false, hp: der(c).hp, rads: 0 });
      ACT.setupOpen("1");
      S.scene.npcs = [];
      ACT.clearRoom();
      ACT.addPick(allTemplates()[0].n);
      ACT.beginC("");
      beginRounds();
      startTurn(S.chars[0].id);
      render();
    });
  const walk = (dx, dy) =>
    p.evaluate(
      ([dx, dy]) => {
        const e = S.chars[0],
          a = { ...posOf(e.id) };
        const to = { x: a.x + dx, y: a.y + dy };
        ui.pendingMove = { id: e.id, x: to.x, y: to.y, cost: moveCost(a, to, e) };
        ACT.moveConfirm();
        const b = posOf(e.id);
        return { x: b.x - a.x, y: b.y - a.y, ap: e.ap, hp: e.hp, st: (e.statuses || []).map((s) => `${s.n} ${s.tier}${s.parts ? " " + s.parts.join() : ""}`) };
      },
      [dx, dy],
    );
  await step("walking across live wires shocks you once the move is confirmed", async () => {
    await freshFight();
    const hp0 = await p.evaluate(() => {
      __put("wires", 3, 0);
      return S.chars[0].hp;
    });
    const r = await walk(6, 0);
    assert.strictEqual(r.x, 6, "the walk goes on");
    assert.strictEqual(r.hp, hp0 - 6);
    assert.ok(r.st.some((s) => s.startsWith("Electrocuted")), r.st.join());
  });
  await step("walking into a minefield sets off a mine: a small blast hurts the walker and anyone close by", async () => {
    await freshFight();
    const r = await p.evaluate(() => {
      __put("mines", 3, 0, 1, 1);
      const mate = S.chars[1];
      const a = posOf(S.chars[0].id);
      Object.assign(cbOf(mate.id), { x: a.x + 3, y: a.y + 1.4 }); // beside the mine
      return { hp0: S.chars[0].hp, mate0: mate.hp };
    });
    const w = await walk(6, 0);
    const mate = await p.evaluate(() => S.chars[1].hp);
    assert.strictEqual(w.hp, r.hp0 - 5, "the walker is in the innermost meter");
    assert.strictEqual(mate, r.mate0 - 2, "the one 1.5 m off takes the outer ring");
  });
  await step("a hidden bear trap: the players can't see it; 4 damage, an injured leg and Bleeding 1, once", async () => {
    await freshFight();
    const before = await p.evaluate(() => {
      window.__hp0 = S.chars[0].hp;
      const o = __put("bearTrap", 3, 0);
      o.w = o.h = 1;
      render();
      return { hidden: hiddenTrap(o), seen: trapsSeen(), cls: document.querySelector(`[data-obj="${o.id}"]`).getAttribute("class") };
    });
    assert.deepStrictEqual([before.hidden, before.seen], [true, false]);
    assert.match(before.cls, /hidtrap/, "the DM sees it faint");
    const r = await walk(6, 0);
    assert.strictEqual(r.x, 6, "the walk goes on");
    assert.strictEqual(r.hp, await p.evaluate(() => __hp0 - 4));
    assert.ok(r.st.some((s) => /Injured Limb.*1 LLeg/.test(s)) && r.st.includes("Bleeding 1"), r.st.join());
    const o = await p.evaluate(() => S.scene.objects.find((x) => x.sub === "bearTrap"));
    assert.ok(o.found && o.sprung, "found and sprung");
    // sprung, it does nothing more
    const again = await p.evaluate(() => {
      startTurn(S.chars[0].id);
      return E.hazardsCrossed(posOf(S.chars[0].id), { x: posOf(S.chars[0].id).x - 3, y: posOf(S.chars[0].id).y }, S.scene.objects, S.rules).length;
    });
    assert.strictEqual(again, 0);
  });
  await step("+Trap places a hidden trap; +Hazard no longer lists them", async () => {
    await freshFight();
    await p.locator('[data-a="mapPlace"][data-v="trap"]').click();
    const list = await p.evaluate(() => [...document.querySelectorAll("#placeItem option")].map((o) => o.textContent));
    assert.deepStrictEqual(list, ["Bear trap", "Tripwire", "Buried landmine", "Dart plate", "Snare"]);
    await p.selectOption("#placeItem", "hz:tripwire");
    const box = await p.locator("#map .floor").boundingBox();
    await p.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
    const o = await p.evaluate(() => S.scene.objects[S.scene.objects.length - 1]);
    assert.deepStrictEqual([o.kind, o.sub], ["hazard", "tripwire"]);
    await p.keyboard.press("Escape");
    await p.locator('[data-a="mapPlace"][data-v="hazard"]').click();
    const hz = await p.evaluate(() => [...document.querySelectorAll("#placeItem option")].map((o) => o.textContent));
    assert.ok(!hz.includes("Bear trap") && hz.includes("Shallow water") && hz.some((x) => /^Lake/.test(x)), hz.join());
    await p.locator('[data-a="mapPlace"][data-v="hazard"]').click();
  });
  await step("wading: shallow water costs a quarter more AP per meter; deep water can't be entered", async () => {
    await freshFight();
    const r = await p.evaluate(() => {
      const e = S.chars[0],
        a = { ...posOf(e.id) };
      const to = { x: a.x + 30, y: a.y };
      const dry = moveCost(a, to, e);
      const sh = __put("shallowWater", 15, 0, { w: 40, h: 10, round: true });
      const wet = moveCost(a, to, e);
      S.scene.objects = [];
      __put("lake", 15, 0, { w: 6, h: 4, round: true, block: true });
      return { dry, wet, blocked: E.pathBlocked(a, to, S.scene.objects, S.rules), stand: standBlocked({ x: a.x + 15, y: a.y }) };
    });
    assert.ok(r.wet > r.dry, JSON.stringify(r));
    assert.deepStrictEqual([r.blocked, r.stand], [true, true]);
  });
  await step("a party member with Minelayer spots hidden traps for the players", async () => {
    const r = await p.evaluate(() => {
      const had = S.chars[0].perks || [];
      S.chars[0].perks = [...had, "Minelayer"];
      const seen = trapsSeen();
      S.chars[0].perks = had;
      return seen;
    });
    assert.strictEqual(r, true);
  });
  await step("every enemy gets a disposition when the fight begins, shown as an icon on its card from initiative on", async () => {
    const r = await p.evaluate(() => {
      S.combat = null;
      ACT.setupOpen("1");
      S.scene.npcs = [];
      for (const t of allTemplates().slice(0, 5)) ACT.addPick(t.n);
      ACT.beginC("");
      render();
      return { disp: K().npcs.map((e) => e.disp), icons: document.querySelectorAll(".card.foe .dispb").length, phase: K().phase };
    });
    assert.strictEqual(r.phase, "init");
    const known = await p.evaluate(() => Object.keys(S.rules.dispositions));
    assert.ok(r.disp.every((d) => d && known.includes(d)), r.disp.join());
    assert.strictEqual(r.icons, 5);
    // clicking the icon changes it
    const btn = p.locator(".card.foe .dispb").first();
    const who = await btn.getAttribute("data-v");
    const before = await p.evaluate((id) => ent(id).disp, who);
    await btn.click();
    assert.notStrictEqual(await p.evaluate((id) => ent(id).disp, who), before);
  });
  await step("a Craven runs once most of its side is down; a Zealot fights on", async () => {
    const r = await p.evaluate(() => {
      beginRounds();
      const foes = K().npcs;
      for (const e of foes.slice(1, 4)) cbOf(e.id).dead = true;
      const e = foes[0];
      startTurn(e.id);
      e.disp = "craven";
      const craven = planTurn(e.id);
      e.disp = "zealot";
      const zealot = planTurn(e.id);
      return { craven: craven.say.join("; "), zealot: zealot.say.join("; ") };
    });
    assert.match(r.craven, /^run .*down or gone/);
    assert.doesNotMatch(r.zealot, /^run/);
  });
  assert.deepStrictEqual(errs, [], "no page errors");
  console.log(`\n${pass}/${pass + fail} passed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
