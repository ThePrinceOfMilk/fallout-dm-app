// Two-finger pinch on the map, on a tablet-sized spectator screen: zoom in around the spot between the fingers,
// slide while pinching, zoom back out, and the screen keeps taking the DM's updates after a cancelled touch.
// Run: node tests/pinch.e2e.js [shots dir]
const path = require("path");
const os = require("os");
const fs = require("fs");
const assert = require("node:assert");
const { spawn } = require("child_process");
const { chromium, webkit, devices } = require("playwright-core");

const PORT = 8190 + Math.floor(Math.random() * 100);
const TOKEN = "dmtoken",
  SPEC = "spectoken";
const STATE = path.join(os.tmpdir(), `pinch_state_${PORT}.json`);
const SHOTS = process.argv[2];
let server;
const startServer = () =>
  new Promise((ok, no) => {
    server = spawn(process.execPath, [path.join(__dirname, "..", "table_server.js")], {
      env: { ...process.env, PORT, TABLE_STATE: STATE, TABLE_TOKEN: TOKEN, TABLE_SPEC: SPEC },
    });
    server.stdout.on("data", (d) => String(d).includes("Table open") && ok());
    server.on("exit", (c) => no(new Error("table_server.js exited " + c)));
  });
const errs = [];
let pass = 0,
  fail = 0;
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
// one touch frame through the browser's own input pipeline, so pointer events come out exactly as on a real tablet
const touch = (cdp, type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
async function pinchGesture(cdp, from, to, steps = 12) {
  await touch(cdp, "touchStart", [from[0]]);
  await touch(cdp, "touchStart", from);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touch(
      cdp,
      "touchMove",
      from.map(([x, y], j) => [x + (to[j][0] - x) * t, y + (to[j][1] - y) * t]),
    );
  }
  await touch(cdp, "touchEnd", []);
}
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
  // a tablet in landscape: touch only, no mouse
  const SP = await (await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
  SP.on("pageerror", (e) => errs.push("spectator: " + e.message));
  await SP.goto(`http://localhost:${PORT}/?t=${SPEC}&v=s`);
  await SP.waitForFunction(() => table.gotState && S.chars.length > 0, null, { timeout: 8000 });
  await step("before a fight the spectator sees the party board, not the map or the enemies", async () => {
    await DM.evaluate(() => {
      const c = S.chars[0];
      act("gear up", () => {
        for (let i = 0; i < 9; i++) addInv(c, "Stimpak " + i, 1, true); // more active items than the board shows
        ACT.setupOpen("1");
        ACT.randomRoom();
        ACT.addPick(allTemplates()[0].n);
      });
    });
    await SP.waitForFunction(() => S.scene && S.scene.npcs && S.scene.npcs.length > 0, null, { timeout: 5000 });
    assert.strictEqual(await SP.locator("#map").count(), 0, "no map while the DM sets up");
    assert.strictEqual(await SP.locator(".w-spfoes").count(), 0, "no enemy list either");
    assert.strictEqual(await SP.locator(".spmember").count(), await SP.evaluate(() => S.chars.length), "a big card per member");
    const first = SP.locator(".spmember").first();
    assert.strictEqual(await first.locator(".spitems").last().locator(".spitem").count(), 6, "active items stop at 6");
    const extra = (await SP.evaluate(() => S.chars[0].inv.filter((l) => l.active && l.q > 0).length)) - 6;
    const txt = await first.innerText();
    assert.ok(txt.toLowerCase().includes(`+${extra} more`), `and say how many more (+${extra}): ${txt.slice(-160)}`);
    if (SHOTS) await SP.screenshot({ path: path.join(SHOTS, "board-tablet.png") });
  });
  await step("on a touch screen picking a gear slot in the inventory doesn't put the cursor in its search box (no keyboard)", async () => {
    await SP.locator(".spmember").first().locator('.icons [data-a="openChar"][data-v$="|inv"]').tap();
    await SP.waitForSelector(".dialog");
    await SP.locator('.dialog [data-a="gearSlot"]').first().tap(); // used to focus #gearQ
    await SP.waitForSelector("#gearQ");
    await SP.waitForTimeout(100);
    const a = await SP.evaluate(() => ({ tag: document.activeElement.tagName, type: document.activeElement.type || "" }));
    assert.ok(!(a.tag === "TEXTAREA" || (a.tag === "INPUT" && !["checkbox", "radio", "range", "button", "file"].includes(a.type))), JSON.stringify(a));
    await SP.evaluate(() => {
      ui.modal = null;
      render();
    });
  });
  // the map shows from the initiative screen on
  await DM.evaluate(() => ACT.beginC(""));
  await SP.waitForSelector("#map", { timeout: 5000 });
  const cdp = await SP.context().newCDPSession(SP);
  const box = async () => await SP.locator("#map").boundingBox();
  const zoomK = () => SP.evaluate(() => (ui.zoom ? ui.zoom.k : 1));
  if (SHOTS) await SP.screenshot({ path: path.join(SHOTS, "pinch-0-before.png") });

  await step("spreading two fingers zooms in", async () => {
    const r = await box();
    const cx = r.x + r.width / 2,
      cy = r.y + r.height / 2;
    await pinchGesture(
      cdp,
      [
        [cx - 40, cy],
        [cx + 40, cy],
      ],
      [
        [cx - 160, cy],
        [cx + 160, cy],
      ],
    );
    const k = await zoomK();
    assert.ok(k > 3.5 && k < 4.5, "about 4 times (fingers went 80 px to 320 px apart), got " + k);
  });
  await step("the spot between the fingers stays between them", async () => {
    const r = await box();
    const cx = r.x + r.width / 3,
      cy = r.y + r.height / 3;
    const before = await SP.evaluate(([x, y]) => svgPoint(document.getElementById("map"), { clientX: x, clientY: y }), [cx, cy]);
    await pinchGesture(
      cdp,
      [
        [cx - 30, cy - 30],
        [cx + 30, cy + 30],
      ],
      [
        [cx - 45, cy - 45],
        [cx + 45, cy + 45],
      ],
    );
    const after = await SP.evaluate(([x, y]) => svgPoint(document.getElementById("map"), { clientX: x, clientY: y }), [cx, cy]);
    const v = await SP.evaluate(() => mapView().w);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < v * 0.02, `moved ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  });
  await step("moving both fingers slides the map", async () => {
    const r = await box();
    const cx = r.x + r.width / 2,
      cy = r.y + r.height / 2;
    const z0 = await SP.evaluate(() => ({ ...ui.zoom }));
    await pinchGesture(
      cdp,
      [
        [cx - 50, cy],
        [cx + 50, cy],
      ],
      [
        [cx - 150, cy],
        [cx - 50, cy],
      ],
    );
    const z1 = await SP.evaluate(() => ({ ...ui.zoom }));
    assert.ok(z1.x > z0.x, "slid right on the map (fingers moved left)");
    assert.ok(Math.abs(z1.k - z0.k) < 0.05, "same zoom");
  });
  if (SHOTS) await SP.screenshot({ path: path.join(SHOTS, "pinch-1-zoomed.png") });
  await step("pinching in zooms back out to the whole map", async () => {
    const r = await box();
    const cx = r.x + r.width / 2,
      cy = r.y + r.height / 2;
    for (let i = 0; i < 3; i++)
      await pinchGesture(
        cdp,
        [
          [cx - 200, cy],
          [cx + 200, cy],
        ],
        [
          [cx - 20, cy],
          [cx + 20, cy],
        ],
      );
    assert.strictEqual(await zoomK(), 1);
  });
  await step("a double tap on empty ground zooms in twice as close, around that spot", async () => {
    const r = await box();
    const x = r.x + r.width * 0.7,
      y = r.y + r.height * 0.2;
    const k0 = await zoomK();
    const at = () => SP.evaluate(([x, y]) => svgPoint(document.getElementById("map"), { clientX: x, clientY: y }), [x, y]);
    const before = await at();
    for (let i = 0; i < 2; i++) {
      await touch(cdp, "touchStart", [[x, y]]);
      await touch(cdp, "touchEnd", []);
    }
    const k1 = await zoomK();
    assert.ok(Math.abs(k1 / k0 - 2) < 0.01, `x2: ${k0} -> ${k1}`);
    const after = await at();
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 1, "the tapped spot stays under the finger");
    await SP.evaluate(() => {
      ui.zoom = null;
      render();
    });
  });
  await step("a pinch doesn't move a token or tap anything", async () => {
    const before = await SP.evaluate(() => JSON.stringify(S.scene && S.scene.pos));
    const r = await box();
    const cx = r.x + r.width / 2,
      cy = r.y + r.height / 2;
    await pinchGesture(
      cdp,
      [
        [cx, cy],
        [cx + 60, cy],
      ],
      [
        [cx - 100, cy],
        [cx + 160, cy],
      ],
    );
    assert.strictEqual(await SP.evaluate(() => JSON.stringify(S.scene && S.scene.pos)), before);
    assert.strictEqual(await SP.evaluate(() => !!(ui.modal || ui.mapSel)), false);
  });
  await step("a cancelled touch doesn't hold back the DM's updates", async () => {
    await touch(cdp, "touchStart", [[30, 30]]);
    await touch(cdp, "touchCancel", []);
    await DM.evaluate(() => act("rename", () => (S.chars[0].n = "Pinch Tester")));
    await SP.waitForFunction(() => S.chars[0].n === "Pinch Tester", null, { timeout: 5000 });
  });
  if (SHOTS) await SP.screenshot({ path: path.join(SHOTS, "pinch-2-after.png") });
  // Safari on an iPad: WebKit can't take raw touches from a test, so the same two-finger pointer events are sent to the map
  await step("an iPad in Safari (WebKit) pinches the map too", async () => {
    let wb;
    try {
      wb = await webkit.launch();
    } catch (e) {
      return console.log("  (WebKit not installed: npx playwright install webkit)");
    }
    const IP = await (await wb.newContext({ ...devices["iPad Pro 11 landscape"] })).newPage();
    IP.on("pageerror", (e) => errs.push("iPad: " + e.message));
    await IP.goto(`http://localhost:${PORT}/?t=${SPEC}&v=s`);
    await IP.waitForFunction(() => table.gotState && document.getElementById("map"), null, { timeout: 8000 });
    const k = await IP.evaluate(() => {
      const r = document.getElementById("map").getBoundingClientRect();
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      const send = (type, id, x) =>
        document
          .getElementById("map")
          .dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: cy, bubbles: true, isPrimary: id === 1 }));
      send("pointerdown", 1, cx - 30);
      send("pointerdown", 2, cx + 30);
      for (let i = 1; i <= 10; i++) {
        send("pointermove", 1, cx - 30 - i * 6);
        send("pointermove", 2, cx + 30 + i * 6);
      }
      send("pointerup", 1, cx - 90);
      send("pointerup", 2, cx + 90);
      return ui.zoom ? ui.zoom.k : 1;
    });
    await wb.close();
    assert.ok(k > 2.7 && k < 3.3, "about 3 times (60 px to 180 px apart), got " + k);
  });
  assert.deepStrictEqual(errs, []);
  console.log(`\n${pass}/${pass + fail} passed`);
  await b.close();
  server.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("FAIL", e.message, errs);
  if (server) server.kill();
  process.exit(1);
});
