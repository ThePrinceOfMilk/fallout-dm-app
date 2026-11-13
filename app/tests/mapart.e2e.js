// 13 Nov: natural water outlines, resizing objects, only the acting token takes clicks in a fight, and terrain. Run: node tests/mapart.e2e.js
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
  };
  const mapClick = async (fx, fy) => {
    const box = await p.locator("#map .floor").boundingBox();
    await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  };
  await step("each lake placed by hand gets its own natural outline, drawn as a curve", async () => {
    await p.evaluate(() => {
      ACT.setupOpen("1");
      ACT.setMapId("field");
      ACT.clearRoom();
      ui.zoom = null;
      render();
    });
    await p.locator('[data-a="mapPlace"][data-v="hazard"]').click();
    await p.selectOption("#placeItem", "lake");
    await mapClick(0.3, 0.3);
    await mapClick(0.7, 0.7);
    await p.keyboard.press("Escape");
    const r = await p.evaluate(() => S.scene.objects.filter((o) => o.item === "lake").map((o) => ({ blob: o.blob, w: o.w, h: o.h })));
    assert.strictEqual(r.length, 2);
    assert.ok(r.every((o) => Array.isArray(o.blob) && o.blob.length >= 12), "both have an outline");
    assert.notDeepStrictEqual(r[0].blob, r[1].blob, "and they differ");
    assert.ok(Math.min(...r[0].blob) < 0.9, "it bulges and narrows, not a circle");
    assert.ok((await p.locator('#map .obj.m-water path[d*="C"]').count()) >= 2, "drawn as a smooth curve");
  });
  await step("the outline is the water: a point inside the box but outside the outline is dry ground", async () => {
    const r = await p.evaluate(() => {
      const o = { item: "shallowWater", x: 0, y: 0, w: 10, h: 6, blob: [1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5], cover: "open" };
      const slowAt = (pt) => E.walkLength({ x: pt.x - 0.1, y: pt.y }, { x: pt.x + 0.1, y: pt.y }, [o], S.rules) > 0.21;
      return { mid: slowAt({ x: 0, y: 0 }), corner: slowAt({ x: 4.6, y: 2.6 }) };
    });
    assert.deepStrictEqual(r, { mid: true, corner: false });
  });
  await step("any object can be resized: the size boxes and the corner handle, one undo step", async () => {
    const id = await p.evaluate(() => {
      const o = { id: "rz1", kind: "cover", item: "crate", cover: "soft", x: 0, y: 0, w: 1, h: 1, label: "" };
      S.scene.objects.push(o);
      ui.mapSel = "rz1";
      setZoom(4, 0, 0);
      render();
      return o.id;
    });
    const w = p.locator("#objW");
    await w.fill("2.5");
    await w.press("Enter");
    assert.strictEqual(await p.evaluate(() => S.scene.objects.find((o) => o.id === "rz1").w), 2.5);
    await p.evaluate(() => {
      document.activeElement.blur(); // as clicking away does: the map redraws with the handle at the new corner
      render();
    });
    await p.waitForSelector('[data-size="rz1"]', { state: "visible" }); // under load the redraw can land a moment later
    const hd = await p.locator('[data-size="rz1"]').boundingBox();
    const pxPerM = await p.evaluate(() => {
      const r = document.getElementById("map").getBoundingClientRect(),
        v = mapView();
      return Math.min(r.width / v.w, r.height / v.h); // the map is letterboxed: the smaller scale is the real one
    });
    await p.mouse.move(hd.x + hd.width / 2, hd.y + hd.height / 2);
    await p.mouse.down();
    await p.mouse.move(hd.x + hd.width / 2 + pxPerM * 0.5, hd.y + hd.height / 2 + pxPerM * 1, { steps: 4 });
    await p.mouse.up();
    const after = await p.evaluate(() => {
      const o = S.scene.objects.find((x) => x.id === "rz1");
      return { w: o.w, h: o.h };
    });
    assert.deepStrictEqual(after, { w: 3.5, h: 3 }, "twice the handle's distance from the middle, to 0.1 m: " + JSON.stringify(after));
    await p.evaluate(() => ACT.undo());
    assert.strictEqual(await p.evaluate(() => S.scene.objects.find((o) => o.id === "rz1").w), 2.5, "undo takes the drag back in one step");
  });
  await step("in a fight, only the token whose turn it is takes clicks, and it's on top; Shift lets the DM grab anyone", async () => {
    const r = await p.evaluate(() => {
      S.scene.objects = [];
      ACT.addPick(allTemplates()[0].n);
      ACT.beginC("");
      beginRounds();
      const me = S.chars[0],
        mate = S.chars[1];
      startTurn(me.id);
      const a = posOf(me.id);
      Object.assign(cbOf(mate.id), { x: a.x + 0.2, y: a.y }); // bunched up, the mate half on top
      ui.zoom = null;
      setZoom(6, a.x, a.y);
      render();
      const toks = [...document.querySelectorAll("#map .tok")];
      const style = (id) => getComputedStyle(document.querySelector(`#map .tok[data-tok="${id}"]`)).pointerEvents;
      return { last: toks[toks.length - 1].dataset.tok === me.id, mine: style(me.id), mate: style(mate.id), me: me.id };
    });
    assert.ok(r.last, "the acting token is drawn last, on top");
    assert.notStrictEqual(r.mine, "none");
    assert.strictEqual(r.mate, "none");
    // a click on the bunched spot reaches the acting token
    const box = await p.locator(`#map .tok[data-tok="${r.me}"] .hit`).boundingBox();
    const hitId = await p.evaluate(([x, y]) => (document.elementFromPoint(x, y).closest("[data-tok]") || {}).dataset?.tok, [box.x + box.width * 0.75, box.y + box.height / 2]);
    assert.strictEqual(hitId, r.me);
    await p.keyboard.down("Shift");
    const withShift = await p.evaluate((id) => getComputedStyle(document.querySelector(`#map .tok[data-tok="${id}"]`)).pointerEvents, await p.evaluate(() => S.chars[1].id));
    await p.keyboard.up("Shift");
    assert.notStrictEqual(withShift, "none");
  });
  await step("terrain follows the place: grass in a forest, sand in a desert, concrete in an office, a wooden floor in a home on open ground", async () => {
    const r = await p.evaluate(() => {
      S.combat = null;
      const fill = () => document.querySelector("#map .floor").style.fill;
      const out = {};
      for (const [m, t] of [
        ["forest", "forested"],
        ["wild", "desert"],
        ["interior", "office"],
        ["streets", "city"],
        ["cavern", "cave"],
      ]) {
        ACT.setMapId(m);
        S.scene.theme = t;
        render();
        out[m] = fill();
      }
      ACT.setMapId("field");
      S.scene.theme = "home";
      S.scene.objects = E.generateRoom(mapOf(), "home", S.rules, Math.random, [], () => "g" + S.seq++);
      render();
      out.homeFloor = S.scene.objects.some((o) => o.item === "floorWood") && !!document.querySelector("#map .obj.floorobj");
      out.firstObj = document.querySelector("#map .obj").classList.contains("floorobj");
      return out;
    });
    assert.match(r.forest, /ter-grass/);
    assert.match(r.wild, /ter-sand/);
    assert.match(r.interior, /ter-concrete/);
    assert.match(r.streets, /ter-asphalt/);
    assert.match(r.cavern, /ter-rock/);
    assert.ok(r.homeFloor && r.firstObj, "the floor is there, under everything");
  });
  await step("the Changelog button at the top right lists every version, newest first", async () => {
    await p.evaluate(() => {
      S.combat = null;
      ui.modal = null;
      render();
    });
    await p.locator('.devbar [data-a="railGo"][data-v="changelog"]').click();
    await p.waitForSelector('.dialog[data-dlg="changelog"]');
    const r = await p.evaluate(() => ({ n: document.querySelectorAll(".clentry").length, first: document.querySelector(".cldate").textContent, total: CHANGELOG.length }));
    assert.ok(r.n === r.total && r.n >= 25, JSON.stringify(r));
    assert.strictEqual(r.first, await p.evaluate(() => CHANGELOG[0].date), "the newest day first");
  });
  assert.deepStrictEqual(errs, [], "no page errors");
  console.log(`\n${pass}/${pass + fail} passed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
