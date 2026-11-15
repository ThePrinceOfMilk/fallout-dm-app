// 12 Nov (evening) features in the real app: rewards with several kinds open in a window, item browser subcategories,
// the branching skill tree, the two-weapon loadout, consumable stats, the enemy list filling its window, check outcomes.
// Run: node tests/ui12.e2e.js
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
    await p.evaluate(() => {
      ui.modal = null;
      render();
    });
  };
  await step("rewards: two kinds make a crate of both, and the roll opens in a window", async () => {
    await p.locator('[data-a="rewardFocus"][data-v="weapons"]').click();
    await p.locator('[data-a="rewardFocus"][data-v="ammo"]').click();
    const kinds = await p.evaluate(() => ui.reward.kinds);
    assert.deepStrictEqual(kinds, ["weapons", "ammo"], "General gives way to the picks");
    await p.locator('[data-a="rewardGen"]').first().click();
    await p.waitForSelector('.dialog[data-dlg="reward"]');
    const cats = await p.evaluate(() => ui.reward.items.map((l) => E.get(ctx(), l.n).cat));
    assert.ok(cats.includes("weapon") && cats.includes("ammo"), "weapons and ammo both: " + cats);
    await p.locator(".dialog select#rwAll").selectOption({ index: 1 });
    await p.locator('.dialog [data-a="rewardGive"]').click();
    assert.strictEqual(await p.locator('.dialog[data-dlg="reward"]').count(), 0, "the window closes when everything is given");
    await p.locator('[data-a="rewardFocus"][data-v="general"]').click();
    assert.deepStrictEqual(await p.evaluate(() => ui.reward.kinds), ["general"]);
  });
  await step("item browser: a subcategory narrows the list", async () => {
    await p.evaluate(() => ACT.railGo("items"));
    await p.selectOption("#brCat", "Weapons");
    const opts = await p.locator("#brSub option").allTextContents();
    assert.ok(opts.some((o) => o.startsWith("Small Guns")) && opts.some((o) => o.includes("- Revolver")), "families and types: " + opts.slice(0, 6));
    await p.selectOption("#brSub", "Small Guns: Revolver");
    const rows = await p.evaluate(() => ui.brSub);
    assert.strictEqual(rows, "Small Guns: Revolver");
    const names = await p.locator(".dialog .itab td.bright").allTextContents();
    const types = await p.evaluate((ns) => ns.map((n) => (DATA.weapons.find((w) => w.n === n) || {}).type), names);
    assert.ok(names.length > 0 && types.every((t) => t === "Revolver"), "only revolvers: " + types);
    await p.selectOption("#brCat", "Items");
    assert.ok(
      (await p.locator("#brSub option").allTextContents()).some((o) => o.startsWith("Chem/Drug")),
      "items by kind",
    );
  });
  await step("skill tree: perks branch, a branch needs its parent, and a skill can be shown alone", async () => {
    await p.evaluate(() => {
      const c = S.chars[0];
      act("t", () => {
        c.spent = { ...(c.spent || {}), REP: 100 };
        c.perks = ["Mechanic"];
      });
      ACT.railGo("skillTree");
      ACT.treeSkill("REP");
    });
    const st = (n) => p.evaluate((n) => [...document.querySelectorAll(".dialog .pnode")].find((x) => x.querySelector(".pn").textContent === n).className, n);
    assert.match(await st("Mechanic"), /have/);
    assert.match(await st("Jumpsuit Johnny"), /can/, "Mechanic's branch opens");
    assert.match(await st("Weaponsmith"), /lock/, "Technician's branch stays shut until Technician is taken");
    assert.match(await st("Technician"), /can/);
    assert.strictEqual(await p.locator(".dialog .snode.sskill").count(), 1, "one skill shown");
    assert.ok((await p.locator(".dialog .pnode .pfx").first().textContent()).length > 0, "each perk has its effect in short");
    await p.locator('.dialog [data-a="treeSkill"][data-v=""]').click();
    assert.ok((await p.locator(".dialog .snode.sskill").count()) > 5, "All skills again");
  });
  await step("clicking in the attack panel keeps the panel where it was scrolled (14 Nov)", async () => {
    await p.evaluate(() => {
      ACT.setupOpen("1");
      ACT.randomRoom();
      ACT.addPick(allTemplates()[0].n);
      ACT.beginC("");
      beginRounds();
      startTurn(S.chars[0].id);
      ACT.attack();
      render();
      document.querySelector(".wcards").closest(".wb").scrollTop = 60;
    });
    const top = () => p.evaluate(() => document.querySelector(".wcards").closest(".wb").scrollTop);
    const before = await top();
    assert.ok(before > 0, "the panel can scroll");
    await p.locator(".wcard.slim").first().click();
    await p.locator(".body [data-a]").first().click();
    assert.strictEqual(await top(), before, "still where it was");
  });
  await step("aiming at the weapon: no damage, can break it or knock it away; picking up costs double the jam (14 Nov)", async () => {
    await p.evaluate(() => {
      ACT.setupOpen("1");
      ACT.randomRoom();
      ACT.addPick(allTemplates()[0].n);
      ACT.beginC("");
      beginRounds();
      startTurn(S.chars[0].id);
      ACT.attack();
      const T = ent(ui.atk.tgt);
      T.weapons = [{ n: "Pipe Pistol", mag: 5 }];
      T.activeW = 0;
      T.hp = 99;
      S.chars[0].ap = 99;
      render();
    });
    assert.ok(await p.locator(".bp-Weapon:not([disabled])").count(), "the Weapon target is open for a gun in hand");
    await p.locator(".bp-Weapon").click();
    const shot = (r) =>
      p.evaluate((r) => {
        const rnd = Math.random;
        Math.random = () => r;
        try {
          const T = ent(ui.atk.tgt);
          T.weapons[0].mag = 5;
          ui.atk.part = "Weapon";
          ui.atk.loc = "Body";
          const gun = S.chars[0].weapons[ui.atk.w];
          gun.mag = 5;
          gun.jammed = false;
          ui.atk.roll = "50";
          ui.atk.ov.hit = "95";
          fire();
          return { hp: T.hp, slot: { ...T.weapons[0] }, res: ui.atk.res, err: ui.atk.err };
        } finally {
          Math.random = rnd;
        }
      }, r);
    const a = await shot(0);
    assert.strictEqual(a.err, "", a.err);
    assert.strictEqual(a.hp, 99, "no damage");
    assert.ok(a.slot.broken, "a knock roll of 00 breaks it");
    assert.ok(/BROKEN/.test(a.res.disarm), a.res.disarm);
    assert.ok(await p.locator(".bp-Weapon[disabled]").count(), "a broken weapon can't be aimed at again");
    await p.evaluate(() => {
      const T = ent(ui.atk.tgt);
      delete T.weapons[0].broken;
      render();

    });
    const held = await shot(0.999);
    assert.ok(!held.slot.broken && !held.slot.dropped, "a high knock roll: held on");
    const cost = await p.evaluate(() => {
      const T = ent(ui.atk.tgt);
      const v0 = E.weaponView(T.weapons[0], T, der(T), ctx()).clearJam;
      Object.assign(T.weapons[0], { dropped: true, jammed: true });
      const v1 = E.weaponView(T.weapons[0], T, der(T), ctx()).clearJam;
      return [v0, v1];
    });
    assert.strictEqual(cost[1], cost[0] * 2, "picking it up costs double the jam");
    const after = await p.evaluate(() => {
      const c = S.chars[0];
      c.weapons[0].broken = true;
      Object.assign(c.weapons[1] || {}, { dropped: true, jammed: true });
      weaponsBack();
      return c.weapons.map((s) => !!(s.broken || s.dropped || s.jammed));
    });
    assert.ok(after.every((x) => !x), "after the fight both are back in hand");
  });
  await step("a jammed weapon gets a big JAMMED stamp over its picture, and Clear jam shows only then (14 Nov)", async () => {
    const n0 = await p.evaluate(() => {
      const c = S.chars[0];
      c.weapons[c.activeW || 0].jammed = false;
      c.ap = 99;
      ui.atk.w = c.activeW || 0;
      render();
      return document.querySelectorAll(".wstamp, .acts [data-a='clearJamBtn']").length;
    });
    assert.strictEqual(n0, 0, "nothing while it works");
    const got = await p.evaluate(() => {
      const c = S.chars[0];
      c.weapons[c.activeW || 0].jammed = true;
      render();
      return [document.querySelector(".wcard.full .wstamp")?.textContent || "", document.querySelectorAll(".acts [data-a='clearJamBtn']").length];
    });
    assert.ok(/^JAMMED/.test(got[0]), got[0]);
    assert.strictEqual(got[1], 1, "Clear jam button appears");
    await p.evaluate(() => {
      S.chars[0].weapons[S.chars[0].activeW || 0].jammed = false;
      render();
    });
  });
  await step("loadout: the weapon in use shows mag, reserve, fire and reload AP; the other is slim", async () => {
    await p.evaluate(() => {
      ACT.setupOpen("1");
      ACT.randomRoom();
      ACT.addPick(allTemplates()[0].n);
      ACT.beginC("");
      beginRounds();
      startTurn(S.chars[0].id);
      ACT.attack();
      render();
    });
    const full = await p.locator(".wcard.full").innerText();
    for (const w of ["MAG", "RESERVE", "FIRE", "RELOAD"]) assert.ok(full.toUpperCase().includes(w), `${w} in ${full}`);
    assert.strictEqual(await p.locator(".wcard.slim").count(), (await p.evaluate(() => S.chars[0].weapons.length)) - 1);
    assert.strictEqual(await p.locator(".aptypes").count(), 0, "no body-part AP row");
    const cost = await p.evaluate(() => {
      ui.atk.part = ui.atk.loc = "Head";
      const a = atkView();
      return [a.cost, a.v.ap + a.swap];
    });
    assert.strictEqual(cost[0], cost[1], "a head shot costs no extra AP");
    await p.evaluate(() => {
      ACT.endCombat && S.combat && (S.combat = null);
      ui.atk = null;
      render();
    });
  });
  await step("consumables show their numbers in the inventory and the fight's item list", async () => {
    await p.evaluate(() => {
      const c = S.chars[0];
      act("t", () => addInv(c, "Buffout", 1, true));
      ACT.openChar(c.id + "|inv");
    });
    const txt = await p.locator(".dialog").innerText();
    assert.match(txt, /Roided 2: STR \+2, END \+2/, "Buffout's numbers");
  });
  await step("the enemy list fills its window in encounter setup", async () => {
    await p.setViewportSize({ width: 1600, height: 1300 });
    await p.evaluate(() => {
      ACT.setupOpen("1");
      ui.enemyQ = "";
      render();
    });
    const h = await p.evaluate(() => {
      const r = document.querySelector(".w-enemies .results");
      return r ? r.getBoundingClientRect().height : 0;
    });
    assert.ok(h > 340, "taller than the old 340 px cap: " + h);
    await p.setViewportSize({ width: 1600, height: 1000 });
    await p.evaluate(() => {
      ACT.setupOpen("");
      render();
    });
  });
  await step("skill check: each row shows its outcome strip, and a roll names its outcome", async () => {
    await p.evaluate(() => {
      ui.chk.target = 25;
      ui.chk.res = {};
      render();
    });
    assert.strictEqual(await p.locator(".w-check .tierstrip").count(), await p.evaluate(() => S.chars.length));
    await p.evaluate(() => ACT.chkRoll("20", document.getElementById("chk-" + S.chars[0].id)));
    assert.strictEqual(await p.locator(".w-check .ctword").first().textContent(), "Perfect");
  });
  assert.deepStrictEqual(errs, [], "no page errors");
  console.log(`\n${pass}/${pass + fail} passed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
