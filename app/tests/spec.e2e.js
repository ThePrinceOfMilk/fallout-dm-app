// Spectator links on table_server.js: a DM screen in Edge, spectators in WebKit (iPhone upright and sideways, iPad) and Edge (PC).
// Run: node tests/spec.e2e.js [shots dir]
const path = require("path");
const fs = require("fs");
const os = require("os");
const assert = require("node:assert");
const { spawn } = require("child_process");
const { chromium, webkit, devices } = require("playwright-core");

const PORT = 7890 + Math.floor(Math.random() * 100);
const TOKEN = "dmtoken",
  SPEC = "spectoken";
const STATE = path.join(os.tmpdir(), `spec_state_${PORT}.json`);
const DM = `http://localhost:${PORT}/?t=${TOKEN}`;
const SP = `http://localhost:${PORT}/?t=${SPEC}&v=s`;
const SHOTS = process.argv[2];
let server;
function startServer() {
  server = spawn(process.execPath, [path.join(__dirname, "..", "table_server.js")], { env: { ...process.env, PORT, TABLE_STATE: STATE, TABLE_TOKEN: TOKEN, TABLE_SPEC: SPEC } });
  server.stderr.on("data", (d) => process.stderr.write(d));
  return new Promise((ok, no) => {
    server.stdout.on("data", (d) => String(d).includes("Table open") && ok());
    server.on("exit", (c) => no(new Error("table_server.js exited " + c)));
  });
}
const until = (page, fn, arg, what, ms = 4000) => page.waitForFunction(fn, arg, { timeout: ms }).catch(() => assert.fail("not within " + ms + " ms: " + what));
const errs = [];
const watch = (p, n) => p.on("pageerror", (e) => errs.push(n + ": " + e.message));

(async () => {
  try {
    fs.unlinkSync(STATE);
  } catch (e) {}
  await startServer();
  let edge;
  for (const channel of ["msedge", "chrome"]) {
    try {
      edge = await chromium.launch({ channel, headless: true });
      break;
    } catch (e) {}
  }
  const wk = await webkit.launch({ headless: true });
  const A = await (await edge.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  watch(A, "DM");
  await A.goto(DM);
  await A.waitForFunction(() => table.on && table.up && table.rev > 0);
  // a fight on the DM's screen, with a consumable to use and armor to put on
  await A.evaluate(() => {
    ACT.setupOpen("1");
    ACT.randomRoom();
    ACT.addPick(allTemplates()[0].n);
    ACT.beginC("");
    beginRounds();
    startTurn(S.chars[0].id);
    act("kit", () => {
      addInv(S.chars[0], "Stimpak", 2, true);
      S.chars[0].hp = 5;
    });
  });
  // the DM's session window offers the three link kinds, and the spectator link is read-only
  const links = await A.evaluate(() => ({ dm: table.links, spec: table.specLinks }));
  assert.ok(links.spec.length && links.spec[0].includes(`t=${SPEC}`) && links.spec[0].endsWith("&v=s"), "spectator link: " + JSON.stringify(links));
  await A.evaluate(() => ACT.table());
  await A.selectOption("#linkKind", "spec");
  assert.ok((await A.inputValue("#tableLink0")).includes(SPEC), "Spectator in the dropdown shows the spectator link");
  await A.selectOption("#linkKind", "player");
  assert.strictEqual(await A.locator("#tableLink0").count(), 0, "Player has no link yet");
  await A.evaluate(() => ACT.closeModal());

  const views = [
    ["iphone", wk, devices["iPhone 14"]],
    ["iphone-side", wk, devices["iPhone 14 landscape"]],
    ["ipad", wk, devices["iPad (gen 7)"]],
    ["ipad-side", wk, devices["iPad (gen 7) landscape"]],
    ["pc", edge, { viewport: { width: 1440, height: 900 } }],
  ];
  const pages = {};
  for (const [n, b, dev] of views) {
    const p = await (await b.newContext(dev)).newPage();
    watch(p, n);
    await p.goto(SP);
    await until(p, () => table.gotState && document.querySelector(".dash.spec #map"), null, n + " spectator screen");
    pages[n] = p;
  }
  const B = pages.iphone;
  // the map (with the aim circle), the party and the log; no DM tools
  const seen = await B.evaluate(() => ({
    dev: !!document.querySelector(".devbar"),
    enemies: !!document.querySelector(".w-enemies"),
    console: !!document.querySelector(".w-action, .ttiles, .body .bp"),
    ring: !!document.querySelector("#map .accring, #map .reach, #map .aim"),
    party: document.querySelectorAll(".spcard").length,
    log: !!document.querySelector(".w-clog"),
    rail: [...document.querySelectorAll(".sprail [data-v]")].map((b) => b.dataset.v),
  }));
  assert.deepStrictEqual(seen, { dev: false, enemies: false, console: false, ring: true, party: 4, log: true, rail: ["log", "skillTree", "wiki", "uiScale", "guide"] }, JSON.stringify(seen));
  // the relay refuses a spectator's write
  const st = await B.evaluate(async () => (await fetch(tableUrl("state"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseRev: table.rev, from: "x", S }) })).status);
  assert.strictEqual(st, 403, "spectator can't post the game");
  // keys and DM-only clicks do nothing
  const hp0 = await A.evaluate(() => S.chars[0].hp);
  await B.evaluate(() => ACT.railGo("settings"));
  assert.strictEqual(await B.evaluate(() => ui.modal), null, "Settings won't open");
  // a spectator uses a Stimpak on themselves: it goes to the DM, who applies it once, and comes back
  await B.evaluate(() => ACT.openChar(S.chars[0].id + "|inv"));
  await B.waitForSelector('.dialog [data-a="useSelf"]');
  if (SHOTS) await B.screenshot({ path: path.join(SHOTS, "spec-iphone-inventory.png") });
  const q0 = await A.evaluate(() => S.chars[0].inv.find((l) => l.n === "Stimpak").q);
  await B.locator('.dialog .irow:has-text("Stimpak") [data-a="useSelf"]').click();
  await until(A, (q0) => (S.chars[0].inv.find((l) => l.n === "Stimpak") || { q: 0 }).q === q0 - 1, q0, "DM applied the Stimpak");
  await until(B, (q0) => (S.chars[0].inv.find((l) => l.n === "Stimpak") || { q: 0 }).q === q0 - 1, q0, "spectator sees it");
  assert.ok((await A.evaluate(() => S.chars[0].hp)) > hp0, "healed");
  // the same ask twice is applied once
  const one = await A.evaluate(() => {
    addInv(S.chars[0], "Stimpak", 3, true);
    const q = S.chars[0].inv.find((l) => l.n === "Stimpak").q;
    const i = S.chars[0].inv.findIndex((l) => l.n === "Stimpak");
    const ask = { id: "dup1", a: "useSelf", v: S.chars[0].id + "|" + i, n: "Stimpak" };
    applyAsk(ask);
    applyAsk(ask);
    return q - S.chars[0].inv.find((l) => l.n === "Stimpak").q;
  });
  assert.ok(one <= 1, "applied once");
  // Active on and off goes through the DM too
  const act0 = await A.evaluate(() => S.chars[0].inv.map((l) => !!l.active));
  await B.locator('.dialog [data-a="invActive"]').first().click();
  await until(A, (a0) => S.chars[0].inv.some((l, i) => !!l.active !== a0[i]), act0, "DM applied Active");
  // a spectator's inputs are read-only
  const ro = await B.evaluate(() => [...document.querySelectorAll(".dialog input:not([data-u]):not([type=checkbox])")].every((x) => x.readOnly));
  assert.ok(ro, "inventory boxes are read-only");
  await B.evaluate(() => ACT.closeModal());
  // the DM's changes show on every spectator
  await A.evaluate(() => act("hp", () => (S.chars[1].hp = 3)));
  for (const n in pages) await until(pages[n], () => S.chars[1].hp === 3, null, n + " got the DM's change");
  // the spectator's own saved campaign on that device is untouched
  assert.strictEqual(await B.evaluate(() => localStorage.getItem("fallout-dm-save-v1") === null || !JSON.parse(localStorage.getItem("fallout-dm-save-v1")).chars.some((c) => c.hp === 3)), true, "no save on a spectator");
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const n in pages) await pages[n].screenshot({ path: path.join(SHOTS, `spec-${n}.png`) });
    await A.screenshot({ path: path.join(SHOTS, "spec-dm.png") });
    const P = pages.pc;
    for (const s of ["inv", "sheet", "health"]) {
      await P.evaluate((s) => ACT.openChar(S.chars[0].id + "|" + s), s);
      await P.waitForTimeout(200);
      await P.screenshot({ path: path.join(SHOTS, `spec-pc-${s}.png`) });
    }
    await P.evaluate(() => ACT.closeModal());
    await A.evaluate(() => {
      ui.linkKind = "spec";
      ACT.table();
    });
    await A.screenshot({ path: path.join(SHOTS, "spec-dm-linkmenu.png") });
  }
  assert.deepStrictEqual(errs, [], "no page errors");
  console.log("spectator: passed");
  await edge.close();
  await wk.close();
  server.kill();
})().catch((e) => {
  console.error("FAIL", e.message);
  if (server) server.kill();
  process.exit(1);
});
