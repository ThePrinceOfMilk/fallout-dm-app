// Shared table: two browsers on one table_server.js stay in sync. Run: node tests/table.e2e.js
const path = require("path");
const fs = require("fs");
const os = require("os");
const assert = require("node:assert");
const { spawn } = require("child_process");
const { chromium } = require("playwright-core");

const PORT = 7790 + Math.floor(Math.random() * 100);
const TOKEN = "testtoken";
const STATE = path.join(os.tmpdir(), `table_state_${PORT}.json`);
const LINK = `http://localhost:${PORT}/?t=${TOKEN}`;
let server;
function startServer() {
  server = spawn(process.execPath, [path.join(__dirname, "..", "table_server.js")], { env: { ...process.env, PORT, TABLE_STATE: STATE, TABLE_TOKEN: TOKEN } });
  server.stderr.on("data", (d) => process.stderr.write(d));
  return new Promise((ok, no) => {
    server.stdout.on("data", (d) => String(d).includes("Table open") && ok());
    server.on("exit", (c) => no(new Error("table_server.js exited " + c)));
  });
}
const stopServer = () => new Promise((ok) => (server.on("exit", ok), server.kill()));
async function until(page, fn, arg, what) {
  await page.waitForFunction(fn, arg, { timeout: 2000 }).catch(() => assert.fail("not synced within 2 s: " + what));
}

(async () => {
  try {
    fs.unlinkSync(STATE);
  } catch (e) {}
  await startServer();
  let browser;
  for (const channel of ["msedge", "chrome"]) {
    try {
      browser = await chromium.launch({ channel, headless: true });
      break;
    } catch (e) {}
  }
  const A = await (await browser.newContext()).newPage();
  const B = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); // phone-sized
  const errs = [];
  for (const p of [A, B]) p.on("pageerror", (e) => errs.push(e.message));
  await A.goto(LINK);
  await A.waitForFunction(() => table.on && table.up && table.rev > 0);
  await B.goto(LINK);
  await B.waitForFunction(() => table.on && table.up);
  await until(B, () => table.rev === 1 && S.chars.length > 0, null, "B joins A's campaign");
  assert.ok(await A.locator('[data-a="table"]').isVisible(), "Table button shows");

  // A changes HP, moves a token and starts a fight; B sees each.
  const id = await A.evaluate(() => S.chars[0].id);
  await A.evaluate((id) => act("hp", () => (ent(id).hp = 3)), id);
  await until(B, (id) => ent(id).hp === 3, id, "HP");
  await A.evaluate((id) => act("move", () => (S.scene.pos[id] = { x: 7, y: 5 })), id);
  await until(B, (id) => S.scene.pos[id] && S.scene.pos[id].x === 7, id, "token move");
  A.on("dialog", (d) => d.accept());
  await A.evaluate(() => beginCombat(false));
  await until(B, () => !!S.combat, null, "fight start");

  // B changes something; A sees it.
  await B.evaluate((id) => act("hp", () => (ent(id).hp = 9)), id);
  await until(A, (id) => ent(id).hp === 9, id, "B -> A");

  // Both send from the same rev: one wins, the other is told, both end equal.
  await Promise.all([A.evaluate((id) => act("x", () => (ent(id).hp = 1)), id), B.evaluate((id) => act("x", () => (ent(id).hp = 2)), id)]);
  await A.waitForTimeout(800);
  const [ha, hb] = [await A.evaluate((id) => ent(id).hp, id), await B.evaluate((id) => ent(id).hp, id)];
  assert.strictEqual(ha, hb, "both end on the same state after a conflict");
  const toasts = (await A.locator("#toast").textContent()) + (await B.locator("#toast").textContent());
  assert.ok(/changed that first/.test(toasts), "conflict toast shown");

  // Restart: both reconnect and the game survived.
  await A.waitForTimeout(2200); // the server writes its file 2 s after a change
  await stopServer();
  await until(A, () => !table.up, null, "A sees the drop");
  await startServer();
  for (const p of [A, B]) await p.waitForFunction(() => table.up, null, { timeout: 8000 });
  await B.evaluate((id) => act("hp", () => (ent(id).hp = 5)), id);
  await until(A, (id) => ent(id).hp === 5 && !!S.combat, id, "after restart");

  // Opened as a file: no table, no /sync.
  const F = await (await browser.newContext()).newPage();
  const sync = [];
  F.on("request", (r) => r.url().includes("/sync/") && sync.push(r.url()));
  await F.goto("file://" + path.join(__dirname, "..", "..", "Fallout DM App.html") + "?t=" + TOKEN);
  await F.waitForTimeout(500);
  assert.strictEqual(await F.locator('[data-a="table"]').count(), 0, "no Table button from file://");
  assert.strictEqual(sync.length, 0, "no /sync request from file://");

  assert.deepStrictEqual(errs, [], "no page errors");
  console.log("table: 7/7 passed");
  await browser.close();
  await stopServer();
  fs.unlinkSync(STATE);
})().catch(async (e) => {
  console.error("FAIL", e.message);
  server && server.kill();
  process.exit(1);
});
