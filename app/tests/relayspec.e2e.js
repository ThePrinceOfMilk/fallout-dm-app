// Spectator through the live cloud relay: DM in Edge opens a session, an iPhone (WebKit, sideways) joins with the spectator link,
// uses a Stimpak, and the DM's game applies it. Needs internet. Run: node tests/relayspec.e2e.js
const path = require("path");
const assert = require("node:assert");
const { chromium, webkit, devices } = require("playwright-core");
const APP = "file://" + path.join(__dirname, "..", "..", "Fallout DM App.html");

(async () => {
  let edge;
  for (const channel of ["msedge", "chrome"]) {
    try {
      edge = await chromium.launch({ channel, headless: true });
      break;
    } catch (e) {}
  }
  const wk = await webkit.launch({ headless: true });
  const errs = [];
  const A = await (await edge.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const B = await (await wk.newContext(devices["iPhone 14 landscape"])).newPage();
  for (const p of [A, B]) p.on("pageerror", (e) => errs.push(e.message));
  await A.goto(APP);
  await A.evaluate(() => act("kit", () => addInv(S.chars[0], "Stimpak", 2, true)));
  await A.click('[data-a="openSession"]');
  await A.waitForFunction(() => table.up && table.rev > 0 && table.specLinks.length, null, { timeout: 15000 });
  const link = await A.evaluate(() => table.specLinks[0]);
  assert.match(link, /\?room=[0-9a-f]{12}&t=[0-9a-f]{32}&v=s$/, "spectator link");
  await B.goto(APP + link.slice(link.indexOf("?")));
  await B.waitForFunction(() => table.gotState && document.querySelector(".dash.spec #map"), null, { timeout: 15000 });
  const q0 = await A.evaluate(() => S.chars[0].inv.find((l) => l.n === "Stimpak").q);
  const t0 = Date.now();
  await B.evaluate(() => ACT.openChar(S.chars[0].id + "|inv"));
  await B.locator('.dialog .irow:has-text("Stimpak") [data-a="useSelf"]').click();
  await B.waitForFunction((q0) => (S.chars[0].inv.find((l) => l.n === "Stimpak") || { q: 0 }).q === q0 - 1, q0, { timeout: 8000 });
  console.log(`spectator use -> DM -> back: ${Date.now() - t0} ms`);
  assert.strictEqual(await A.evaluate(() => S.chars[0].inv.find((l) => l.n === "Stimpak").q), q0 - 1, "DM applied it once");
  assert.deepStrictEqual(errs, [], "no page errors");
  console.log("relay spectator: passed");
  await edge.close();
  await wk.close();
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
