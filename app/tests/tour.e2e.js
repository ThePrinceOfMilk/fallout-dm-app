// The interactive tour, played start to finish with real clicks: every step lights something up, ticks itself off when
// it's done and moves on; the practice campaign never overwrites the real one, which comes back at the end.
// Run: node tests/tour.e2e.js [shots dir]
const path = require("path");
const fs = require("fs");
const assert = require("node:assert");
const { chromium } = require("playwright-core");
const APP = "file:///" + path.resolve(__dirname, "../../Fallout DM App.html").replace(/\\/g, "/");
const SHOTS = process.argv[2];
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
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
  // something in the real campaign to recognise it by
  await p.evaluate(() => {
    act("mine", () => (S.chars[0].name = "My Real Character"));
    save();
  });
  const saved0 = await p.evaluate(() => localStorage.getItem(SAVE_KEY));
  await p.evaluate(() => ACT.railGo("guide"));
  await p.locator('[data-a="tutStart"]').click();
  const at = () => p.evaluate(() => tut && tut.i);
  let shot = 0;
  const snap = async () => SHOTS && p.screenshot({ path: path.join(SHOTS, `tour-${String(shot++).padStart(2, "0")}.png`) });
  // do the step's task, then wait for the tour to tick it off and move on
  const step = async (n, doIt) => {
    assert.strictEqual(await at(), n, "on step " + n);
    const lit = await p.evaluate(() => {
      const r = document.querySelector("#tut .tutring");
      return !!r || !TUT_STEPS[tut.i].at;
    });
    assert.ok(lit, `step ${n} lights up what to use`);
    assert.strictEqual(await p.evaluate(() => tut.ok), false, `step ${n} waits for you before it ticks off`);
    await snap();
    await doIt();
    await p.waitForFunction((n) => !tut || tut.i > n, n, { timeout: 5000 });
  };
  const next = () => p.locator('#tut [data-a="tutGo"]').last().click();
  const id = await p.evaluate(() => S.chars[0].id);
  assert.notStrictEqual(await p.evaluate(() => S.chars[0].name), "My Real Character", "the tour plays on a practice campaign");
  await step(0, next);
  await step(1, () => p.locator(`.w-party [data-a="openChar"][data-v="${id}|inv"]`).click());
  await step(2, () => p.keyboard.press("Escape"));
  await step(3, () => p.locator('.w-check [data-a="chkPreset"][data-v="60"]').click());
  await step(4, async () => {
    await p.fill(`#chk-${id}`, "14");
    await p.press(`#chk-${id}`, "Enter");
  });
  await step(5, next);
  await step(6, async () => {
    await p.locator('.w-reward [data-a="rewardFocus"][data-v="weapons"]').click();
    await p.locator('.w-reward [data-a="rewardFocus"][data-v="ammo"]').click();
  });
  await step(7, () => p.locator('.w-reward [data-a="rewardGen"]').click());
  await step(8, () => p.keyboard.press("Escape"));
  await step(9, () => p.locator('[data-a="setupOpen"][data-v="1"]').click());
  await step(10, () => p.locator(".w-enemies .results [data-a]").first().click());
  await step(11, () => p.locator('[data-a="beginC"][data-v=""]').click());
  await step(12, () => p.locator('[data-a="beginRounds"]').click());
  await step(13, () => p.locator("#map .tok.npc").first().click());
  await step(14, () => p.locator('[data-a="atkPart"][data-v="Head"]').click());
  await step(15, async () => {
    await p.fill("#roll", "50");
    await p.press("#roll", "Enter");
  });
  await step(16, () => p.locator('[data-a="next"]').first().click());
  await step(17, () => p.locator('.rail [data-v="skillTree"]').click());
  assert.strictEqual(await at(), 18, "the last step");
  await snap();
  assert.strictEqual(await p.evaluate(() => localStorage.getItem(SAVE_KEY)), saved0, "nothing was saved during the tour");
  await p.locator('#tut [data-a="tutEnd"]').last().click();
  assert.strictEqual(await p.evaluate(() => S.chars[0].name), "My Real Character", "the real campaign is back");
  assert.strictEqual(await p.locator("#tut").count(), 0, "the light and the card are gone");
  assert.deepStrictEqual(errs, [], "no page errors");
  console.log("PASS  the tour, 19 steps, start to finish");
  console.log("\n1/1 passed");
  await b.close();
})().catch((e) => {
  console.error("FAIL ", e.message.split("\n")[0]);
  console.log("\n0/1 passed");
  process.exit(1);
});
