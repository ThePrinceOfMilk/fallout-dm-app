// 12 Nov (night): the Factions window, and dispositions weighted by faction. Run: node tests/factions.e2e.js [shots dir]
const path = require("path");
const assert = require("node:assert");
const { chromium } = require("playwright-core");
const APP = "file:///" + path.resolve(__dirname, "../../Fallout DM App.html").replace(/\\/g, "/");
const SHOTS = process.argv[2];
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
  await step("the Factions rail button opens the New Vegas factions, each with its leaders", async () => {
    await p.locator('[data-a="railGo"][data-v="factions"]').click();
    await p.waitForSelector('.dialog[data-dlg="factions"]');
    const tabs = await p.locator(".factabs .opt").allTextContents();
    assert.ok(tabs.includes("NCR") && tabs.includes("Caesar's Legion") && tabs.includes("Followers of the Apocalypse"), tabs.join());
    assert.strictEqual(await p.locator(".fnode").first().locator(".fname").inputValue(), "Aaron Kimball");
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "14-factions-ncr.png") });
  });
  await step("a new faction with a theme generates a hierarchy of that theme's ranks, with names", async () => {
    await p.locator('[data-a="facNew"]').click();
    await p.selectOption('select[data-c="facTheme"]', "criminal");
    await p.locator('[data-a="facGen"]').click();
    const titles = await p.locator(".fnode .ftitle").evaluateAll((l) => l.map((x) => x.value));
    assert.deepStrictEqual([...new Set(titles)], ["Don", "Underboss", "Caporegime", "Soldier", "Consigliere"]);
    const names = await p.locator(".fnode .fname").evaluateAll((l) => l.map((x) => x.value));
    assert.ok(names.every(Boolean) && new Set(names).size === names.length, "everyone named, no repeats");
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "15-factions-generated.png") });
  });
  await step("titles, names and the faction name are editable; boxes can be added under anyone and removed", async () => {
    const t = p.locator(".fnode .ftitle").first();
    await t.fill("Boss of Bosses");
    await t.press("Enter");
    const nm = p.locator('input[data-c="facName"]');
    await nm.fill("The Sunset Syndicate");
    await nm.press("Enter");
    const before = await p.locator(".fnode").count();
    await p.locator('.fnode [data-a="facAdd"]').first().click();
    assert.strictEqual(await p.locator(".fnode").count(), before + 1);
    await p.locator('.fnode [data-a="facDel"]').nth(1).click(); // the underboss and everyone under them
    const r = await p.evaluate(() => {
      const f = S.factions.list[S.factions.list.length - 1];
      return { n: f.n, top: f.nodes.find((n) => !n.parent).title, count: f.nodes.length };
    });
    assert.deepStrictEqual([r.n, r.top], ["The Sunset Syndicate", "Boss of Bosses"]);
    assert.ok(r.count < before, `${r.count} < ${before}`);
    assert.ok((await p.locator(".factabs .opt").allTextContents()).includes("The Sunset Syndicate"));
  });
  await step("marking someone dead, the party's standing, and deleting a faction", async () => {
    await p.locator('.fnode [data-a="facDead"]').first().check();
    await p.selectOption('select[data-c="facAtt"]', "Hated");
    const r = await p.evaluate(() => {
      const f = S.factions.list[S.factions.list.length - 1];
      return { dead: f.nodes.filter((n) => n.dead).length, att: f.att };
    });
    assert.deepStrictEqual(r, { dead: 1, att: "Hated" });
    assert.ok((await p.locator(".fnode.dead").count()) === 1);
    const n0 = await p.locator(".factabs .opt").count();
    await p.locator('[data-a="facDelete"]').click();
    assert.strictEqual(await p.locator(".factabs .opt").count(), n0 - 1);
  });
  await step("killing an enemy of a faction adds to its count; undo takes it back", async () => {
    const r = await p.evaluate(() => {
      ACT.closeModal();
      ACT.setupOpen("1");
      S.scene.npcs = [];
      const fiend = allTemplates().find((t) => t.faction === "Fiends");
      ACT.addPick(fiend.n);
      ACT.beginC("");
      beginRounds();
      const e = K().npcs[0];
      const before = facByName("Fiends").killed;
      act("test kill", () => {
        e.hp = 0;
        syncDown(e);
      });
      const after = facByName("Fiends").killed;
      ACT.undo();
      return { before, after, undone: facByName("Fiends").killed };
    });
    assert.deepStrictEqual(r, { before: 0, after: 1, undone: 0 });
  });
  await step("faction weights the disposition roll: Legion is almost never Craven, Fiends often in a drug-fueled rage", async () => {
    const r = await p.evaluate(() => {
      const share = (f, k, reach) => {
        let n = 0;
        for (let i = 0; i < 4000; i++) if (E.rollDisposition("human", reach, S.rules, Math.random, f) === k) n++;
        return n / 4000;
      };
      return { legion: share("Caesar's Legion", "craven", "mid"), plain: share("", "craven", "mid"), fiends: share("Fiends", "drugRage", "melee"), none: share("", "drugRage", "melee") };
    });
    assert.ok(r.legion < 0.03 && r.plain > 0.06, JSON.stringify(r));
    assert.ok(r.fiends > r.none * 3, JSON.stringify(r));
  });
  await step("a new campaign starts with the New Vegas factions again", async () => {
    const r = await p.evaluate(() => {
      S.factions = null;
      return facState().list.map((f) => f.n).length;
    });
    assert.ok(r >= 15);
  });
  assert.deepStrictEqual(errs, [], "no page errors");
  console.log(`\n${pass}/${pass + fail} passed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
