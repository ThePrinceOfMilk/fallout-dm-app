// Open session through the cloud relay: one PC-sized host, one phone-sized joiner. Needs internet. Run: node tests/relay.e2e.js
const path = require("path");
const assert = require("node:assert");
const { chromium } = require("playwright-core");
const APP = "file://" + path.join(__dirname, "..", "..", "Fallout DM App.html");

(async () => {
  let browser;
  for (const channel of ["msedge", "chrome"]) {
    try {
      browser = await chromium.launch({ channel, headless: true });
      break;
    } catch (e) {}
  }
  const errs = [];
  const A = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const B = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  for (const p of [A, B]) p.on("pageerror", (e) => errs.push(e.message));
  await A.goto(APP);
  await A.click('[data-a="openSession"]');
  await A.waitForSelector("#tableLink0", { timeout: 15000 });
  const link = await A.inputValue("#tableLink0");
  assert.match(link, /^https:\/\/.+\?room=[0-9a-f]{12}&t=[0-9a-f]{32}$/, "share link");
  await A.waitForFunction(() => table.up && table.rev > 0, null, { timeout: 15000 });

  await B.goto(APP + link.slice(link.indexOf("?"))); // the built file stands in for the hosted copy
  await B.waitForFunction(() => table.up && table.rev > 0, null, { timeout: 15000 });
  const id = await A.evaluate(() => S.chars[0].id);
  assert.strictEqual(await B.evaluate((id) => !!ent(id), id), true, "joiner got the host's campaign");

  const t0 = Date.now();
  await A.evaluate((id) => act("hp", () => (ent(id).hp = 4)), id);
  await B.waitForFunction((id) => ent(id).hp === 4, id, { timeout: 5000 });
  console.log(`host -> phone: ${Date.now() - t0} ms`);
  const t1 = Date.now();
  await B.evaluate((id) => act("hp", () => (ent(id).hp = 8)), id);
  await A.waitForFunction((id) => ent(id).hp === 8, id, { timeout: 5000 });
  console.log(`phone -> host: ${Date.now() - t1} ms`);
  assert.strictEqual(await A.evaluate(() => table.n), 2, "host sees 2 devices");

  await B.reload(); // a reload rejoins from the link in the address bar
  await B.waitForFunction((id) => table.up && ent(id).hp === 8, id, { timeout: 15000 });
  assert.deepStrictEqual(errs, [], "no page errors");
  console.log("relay: passed");
  await browser.close();
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
