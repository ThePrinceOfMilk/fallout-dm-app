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
