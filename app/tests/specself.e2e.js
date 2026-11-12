// A player on a spectator screen manages their own character with no DM involvement: level up, skill points, a perk,
// buying from a public vendor, changing ammo, dropping and using items. Each change shows on their screen at once and
// reaches the DM's game by itself. Also: the DM's queued move and aim show on the spectator's map.
// Run: node tests/specself.e2e.js
const path = require("path");
const fs = require("fs");
const os = require("os");
const assert = require("node:assert");
const { spawn } = require("child_process");
const { chromium } = require("playwright-core");

const PORT = 7990 + Math.floor(Math.random() * 100);
const TOKEN = "dmtoken",
  SPEC = "spectoken";
const STATE = path.join(os.tmpdir(), `specself_state_${PORT}.json`);
let server;
const startServer = () =>
  new Promise((ok, no) => {
    server = spawn(process.execPath, [path.join(__dirname, "..", "table_server.js")], { env: { ...process.env, PORT, TABLE_STATE: STATE, TABLE_TOKEN: TOKEN, TABLE_SPEC: SPEC } });
    server.stdout.on("data", (d) => String(d).includes("Table open") && ok());
    server.on("exit", (c) => no(new Error("table_server.js exited " + c)));
  });
const errs = [];
let pass = 0;
const step = async (name, fn) => {
  try {
    await fn();
    pass++;
    console.log("PASS ", name);
  } catch (e) {
    console.log("FAIL ", name, " ", String(e.message).split("\n")[0]);
  }
};
(async () => {
  try {
    fs.unlinkSync(STATE);
  } catch (e) {}
  await startServer();
  let b;
  for (const channel of ["msedge", "chrome"]) {
    try {
      b = await chromium.launch({ channel, headless: true });
      break;
    } catch (e) {}
  }
  const DM = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  DM.on("pageerror", (e) => errs.push("DM: " + e.message));
  await DM.goto(`http://localhost:${PORT}/?t=${TOKEN}`);
  await DM.waitForFunction(() => table.on && table.up && table.rev > 0);
  await DM.evaluate(() => {
    act("set up", () => {
      const c = S.chars[0];
      c.xp = 1500;
      c.caps = 500;
      c.hp = 5;
      addInv(c, "Stimpak", 2, true);
      addInv(c, "Screws", 3, false);
      addInv(c, ".22 LR - Junk", 20, true);
      addInv(c, ".22 LR - Standard", 20, true);
      c.weapons[0] = { n: "Varmint rifle", mag: 0, ammo: ".22 LR - Standard" };
      S.vendor.stock = [{ n: "Purified Water", q: 3 }];
      S.vendor.public = true;
    });
  });
  const SP = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  SP.on("pageerror", (e) => errs.push("spectator: " + e.message));
  await SP.goto(`http://localhost:${PORT}/?t=${SPEC}&v=s`);
  await SP.waitForFunction(() => table.gotState && S.chars.length > 0, null, { timeout: 8000 });
  const id = await SP.evaluate(() => S.chars[0].id);
  const dm = (fn, arg) => DM.waitForFunction(fn, arg, { timeout: 5000 });

  await step("level up on the player's screen, at once, and in the DM's game", async () => {
    await SP.locator(`[data-a="levelUp"][data-v="${id}"]`).first().click();
    assert.strictEqual(await SP.evaluate((i) => ent(i).level, id), 2, "at once on the player's screen");
    await dm((i) => ent(i).level === 2, id);
  });
  await step("skill points", async () => {
    await SP.evaluate((i) => ACT.spendPts(i), id);
    await SP.locator(`[data-a="spend"][data-v="${id}|SG|1"]`).first().click();
    await dm((i) => (ent(i).spent || {}).SG === 1, id);
  });
  await step("buy from the vendor the DM opened to players", async () => {
    await SP.evaluate(() => {
      ui.modal = null;
      ACT.railGo("vendor");
    });
    await SP.locator('[data-a="venBuy"]').first().click();
    await dm((i) => ent(i).inv.some((l) => l.n === "Purified Water") && ent(i).caps < 500, id);
  });
  await step("change ammo type", async () => {
    await SP.evaluate((i) => {
      ui.modal = null;
      ACT.openChar(i + "|inv");
    }, id);
    await SP.selectOption(`#gl-${id}-0`, ".22 LR - Junk");
    await dm((i) => ent(i).weapons[0].ammo === ".22 LR - Junk", id);
  });
  await step("drop an item", async () => {
    const i = await SP.evaluate((pid) => ent(pid).inv.findIndex((l) => l.n === "Screws"), id);
    await SP.locator(`[data-a="invDel"][data-v="${id}|${i}"]`).first().click();
    await dm((pid) => !ent(pid).inv.some((l) => l.n === "Screws"), id);
  });
  await step("use a consumable on themselves", async () => {
    const i = await SP.evaluate((pid) => ent(pid).inv.findIndex((l) => l.n === "Stimpak"), id);
    await SP.locator(`[data-a="useSelf"][data-v="${id}|${i}"]`).first().click();
    await dm((pid) => ent(pid).hp > 5, id);
  });
  await step("the vendor stays shut when the DM closes it", async () => {
    await DM.evaluate(() => act("close", () => (S.vendor.public = false)));
    await SP.waitForFunction(() => !S.vendor.public, null, { timeout: 4000 });
    assert.strictEqual(await SP.locator('.sprail [data-v="vendor"]').count(), 0, "no Shop button");
  });
  await step("the DM's queued move and aim show on the spectator's map", async () => {
    await DM.evaluate((pid) => {
      ACT.setupOpen("1");
      ACT.addPick(allTemplates()[0].n);
      ACT.beginC("");
      beginRounds();
      startTurn(pid);
      makeAttack(pid);
      ui.atk.tgt = K().cbs.find((c) => sideOf(c.id) === "npc").id;
      const p = posOf(pid);
      ui.pendingMove = { id: pid, x: p.x + 3, y: p.y, cost: 1 };
      render();
    }, id);
    await SP.waitForFunction(() => S.live && S.live.move && S.live.aim, null, { timeout: 4000 });
    assert.ok(await SP.locator("#map .ghost").count(), "a ghost where the DM is about to move");
    assert.ok(await SP.locator("#map .aimspec").count(), "the DM's aim line");
  });
  console.log(`${pass}/8 passed`);
  if (errs.length) console.log("page errors:", errs);
  await b.close();
  server.kill();
  process.exit(pass === 8 && !errs.length ? 0 : 1);
})();
