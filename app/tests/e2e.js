// Plays a full sample session on the dashboard in a real browser, mostly from the keyboard, the way a DM would.
// Run: npm install && npm run e2e   (uses the Edge or Chrome already on this machine)
const path = require("path");
const fs = require("fs");
const assert = require("node:assert");
const { chromium } = require("playwright-core");

const APP = "file:///" + path.resolve(__dirname, "../../Fallout DM App.html").replace(/\\/g, "/");
const SHOTS = process.env.SHOTS || "";
let step = 0;
const results = [];

async function launch() {
  for (const channel of ["msedge", "chrome"]) {
    try { return await chromium.launch({ channel, headless: true }); } catch (e) { /* try the next browser */ }
  }
  throw new Error("Neither Edge nor Chrome could be started.");
}

(async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  context.setDefaultTimeout(6000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  const ok = async (name, fn) => {
    step++;
    try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message.split("\n")[0]]); }
    assert.ok(errors.length === 0, `Script error during "${name}": ${errors.join(" | ")}`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${String(step).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png`) });
  };
  const press = async (...keys) => { for (const k of keys) await page.keyboard.press(k); };
  const type = (s) => page.keyboard.type(s);
  const text = (sel = "#app") => page.locator(sel).first().innerText();
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(S)));
  const has = async (s, sel) => assert.ok((await text(sel)).toLowerCase().includes(s.toLowerCase()), `expected to see "${s}"`);
  const rail = (id) => page.locator(`.rail [data-v="${id}"]`).click();
  const click = (a, v) => page.locator(v != null ? `[data-a="${a}"][data-v="${v}"]` : `[data-a="${a}"]`).first().click();
  const blur = () => page.evaluate(() => document.activeElement && document.activeElement.blur());
  // Where a spot in map meters lands on the screen.
  const onMap = (x, y) => page.evaluate(([px, py]) => { const svg = document.getElementById("map"); const q = new DOMPoint(px, py).matrixTransform(svg.getScreenCTM()); return { x: q.x, y: q.y }; }, [x, y]);
  const center = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const dragTo = async (from, to) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(20); };

  await page.goto(APP);
  await ok("Everything is on one screen with no page scroll", async () => {
    for (const n of ["Character 1", "Character 2", "Character 3", "Character 4", "Encounter", "Vendor", "Skill check", "Recent events", "Combat log", "Notes", "Loot tables", "Weapons"]) await has(n);
    assert.strictEqual(await page.locator(".w-items").count(), 0, "items are not left out");
    assert.strictEqual(await page.locator("#map").count(), 0, "no map until an encounter is being set up");
    assert.strictEqual(await page.locator(".w-enemies").count(), 0, "no enemy column with no fight");
    const party = await page.locator(".w-party").boundingBox(), notes = await page.locator(".w-notes").boundingBox();
    assert.ok(party.width <= 275, `thin party ${party.width}`); assert.ok(notes.y > party.y && notes.x < 20, "notes bottom left");
    const ven = await page.locator(".w-vendor").boundingBox(), rec = await page.locator(".w-recent").boundingBox(), clog = await page.locator(".w-clog").boundingBox();
    assert.ok(notes.width > 500, `notes are wide: ${notes.width}`);
    assert.ok(ven.x > notes.x + notes.width - 5 && Math.abs(ven.y - notes.y) < 3 && ven.x + ven.width > 1380, "vendor is in the bottom right corner");
    assert.ok(Math.abs(rec.y - clog.y) < 3 && clog.x > rec.x && clog.width < rec.width, "recent events and a small combat log side by side");
    const ys = await page.locator(".w-party .card").evaluateAll((l) => l.map((c) => [c.getBoundingClientRect().x, c.getBoundingClientRect().y]));
    assert.ok(ys.every(([x], i) => x === ys[0][0] && (!i || ys[i][1] > ys[i - 1][1])), "cards stack vertically");
    assert.match(await text('[data-card="c1"] .spc'), /^S/, "SPECIAL by single letter");
    assert.strictEqual(await page.locator('[data-card="c1"] .stats7:not(.spc) label').first().locator("span").innerText(), "BA", "skills by two letters");
    const s = await state();
    assert.strictEqual(s.chars.length, 4);
    assert.strictEqual(s.chars[0].hp, 19); assert.strictEqual(s.chars[0].ap, 18);
    const over = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    assert.ok(over <= 0, `page overflows by ${over}px`);
  });
  await ok("Right side is a thin column of symbols", async () => {
    const box = await page.locator(".rail").boundingBox();
    assert.ok(box.width <= 50, `rail is ${box.width}px wide`);
    assert.ok(box.x + box.width >= 1430, "rail is on the right");
    for (const id of ["settings", "saveNow", "loadWin", "autoWin", "wiki", "log"]) assert.strictEqual(await page.locator(`.rail [data-v="${id}"] svg`).count(), 1, id);
    assert.ok((await page.locator('[data-a="dev"][data-v="loot"]').boundingBox()).y < box.y, "dev options are above");
  });
  await ok("Rail windows open over the main view and close", async () => {
    await rail("settings"); await has("Settings: game rules", ".dialog"); await press("Escape");
    await rail("items"); await has("Item browser", ".dialog"); await press("Escape");
    await rail("log"); await page.locator(".floatlog").waitFor(); await rail("log");
    assert.strictEqual(await page.locator(".floatlog").count(), 0);
    await blur();
  });
  await ok("Panes resize with the mouse and remember it", async () => {
    const g = await page.locator('[data-gut="left"]').boundingBox();
    await page.mouse.move(g.x + 2, g.y + 100); await page.mouse.down(); await page.mouse.move(g.x + 42, g.y + 100); await page.mouse.up();
    assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem(PREF_KEY))).partyW > 300);
    await page.evaluate(() => { prefs.partyW = 270; savePrefs(); render(); });
  });
  await ok("Context windows move and resize, and keep it across a re-render", async () => {
    await rail("items");
    const d = page.locator(".dialog"); const b0 = await d.boundingBox();
    await page.mouse.move(b0.x + 80, b0.y + 8); await page.mouse.down(); await page.mouse.move(b0.x + 30, b0.y + 48); await page.mouse.up();
    const b1 = await d.boundingBox();
    assert.ok(Math.abs(b1.x - (b0.x - 50)) < 3 && Math.abs(b1.y - (b0.y + 40)) < 3, `moved to ${b1.x},${b1.y}`);
    await page.mouse.move(b1.x + b1.width - 3, b1.y + b1.height - 3); await page.mouse.down(); await page.mouse.move(b1.x + b1.width - 103, b1.y + b1.height - 63); await page.mouse.up();
    const b2 = await d.boundingBox();
    assert.ok(b2.width < b1.width - 80, `resized to ${b2.width}`);
    await page.evaluate(() => render());
    const b3 = await d.boundingBox();
    assert.ok(Math.abs(b3.width - b2.width) < 3 && Math.abs(b3.x - b2.x) < 3, "stays after a re-render");
    await press("Escape"); await page.evaluate(() => { ui.dlg = {}; });
  });
  await ok("Green terminal look with an embedded font", async () => {
    const r = await page.evaluate(async () => { await document.fonts.ready; return { bg: getComputedStyle(document.documentElement).backgroundColor, ink: getComputedStyle(document.body).color, font: document.fonts.check('14px "Share Tech Mono"'), used: getComputedStyle(document.body).fontFamily, sweep: getComputedStyle(document.body, "::before").animationName }; });
    assert.match(r.used, /Share Tech Mono/); assert.strictEqual(r.sweep, "crt-sweep", "shimmer runs");
    assert.strictEqual(r.ink, "rgb(77, 255, 124)"); assert.strictEqual(r.bg, "rgb(2, 5, 2)"); assert.ok(r.font, "font loaded");
  });
  await ok("Stats are editable boxes: effective values change the character", async () => {
    await page.fill("#sp-c1-0", "6"); await press("Tab"); await page.waitForTimeout(30);
    let s = await state(); assert.strictEqual(s.chars[0].special[0], 6);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "sp-c1-1", "Tab keeps moving through the boxes");
    await page.fill("#sp-c1-0", "4"); await press("Tab"); await page.waitForTimeout(30);
    await page.fill("#sk-c1-SG", "72"); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual(await page.evaluate(() => der(S.chars[0]).skills.SG), 72);
    await page.fill("#sk-c1-SG", ""); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual(await page.evaluate(() => der(S.chars[0]).skills.SG), 14, "clearing goes back to the formula");
    await page.fill("#ov-c1-ap", "25"); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual(await page.evaluate(() => der(S.chars[0]).ap), 25);
    await page.fill("#ov-c1-ap", ""); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual(await page.evaluate(() => der(S.chars[0]).ap), 18);
    await blur();
  });
  await ok("Typing a two-digit number stays in order", async () => {
    await page.focus("#chkTarget"); await page.keyboard.press("Control+a"); await type("85");
    assert.strictEqual(await page.inputValue("#chkTarget"), "85");
    await blur();
  });
  await ok("Character and Health are menus off the card", async () => {
    await click("openChar", "c2|sheet"); await has("Stats", ".dialog"); await click("sheetTab", "traits"); await has("Sadist", ".dialog");
    await click("sheetTab", "perks"); assert.ok(await page.locator(".dialog #addPerk-c2").count());
    await click("sheetTab", "stats"); assert.ok(await page.locator(".dialog #ov-c2-dt").count()); await press("Escape");
    await page.evaluate(() => { const c = S.chars[0]; addStatus(c, "Weak", 2); addStatus(c, "Strengthened", 1); render(); });
    await click("openChar", "c1|health"); await has("HEALTH", ".dialog"); await has("Harmful", ".dialog"); await has("Beneficial", ".dialog");
    await has("Effect on skills", ".dialog"); await has("Weak", ".dialog");
    await press("Escape");
    await page.evaluate(() => { S.chars[0].statuses = []; S.chars[0].ap = der(S.chars[0]).ap; ui.sel = "c1"; render(); });
  });
  await ok("Inventory opens over the main view, grouped with a symbol per category", async () => {
    await page.locator('[data-a="openChar"][data-v="c1|inv"]').click();
    await has("Adhesive", ".dialog"); await has("TOTAL DT", ".dialog");
    assert.strictEqual(await page.locator(".dialog .gfig .gbox").count(), 3, "helmet, clothing, armor on the body");
    assert.strictEqual(await page.locator(".dialog .gearmenu > .gcol").last().locator(".gbox").count(), 2, "two vanity boxes");
    assert.ok(await page.locator(".dialog .gearmenu > .gcol").first().locator(".wbox").count() >= 2, "weapon boxes");
    const w0 = await text(".dialog .wbox");
    for (const x of ["AP", "Best", "Value", "Skill", "Crit", "Mag", "In pack"]) assert.ok(w0.includes(x), `weapon box shows ${x}: ${w0}`);
    const heads = await page.locator(".dialog .igroup").count(); assert.ok(heads >= 2, `${heads} groups`);
    assert.strictEqual(await page.locator(".dialog .igroup svg").count(), heads);
    const n0 = (await state()).chars[0].inv.length;
    await page.fill("#addItem-c1", "Stimpak"); await press("Enter");
    assert.strictEqual((await state()).chars[0].inv.length, n0 + 1);
    await has("Healing", ".dialog");
    await page.fill("#invQ", "stimp"); await page.waitForTimeout(30);
    assert.strictEqual(await page.locator(".dialog .irow").count(), 1, "filter narrows it");
    await press("Escape");
  });
  await ok("Gear menu: equip from the pack, swaps back, DT and bonuses at the top", async () => {
    const armor = await page.evaluate(() => DATA.armor.find((a) => a.n === "Composite Military Armor"));
    assert.ok(armor, "test armor exists");
    await page.evaluate((n) => { addInv(S.chars[0], n, 1); render(); }, armor.n);
    const dt0 = await page.evaluate(() => der(S.chars[0]).dt), bg0 = await page.evaluate(() => der(S.chars[0]).skills.BG);
    await click("openChar", "c1|inv"); await click("gearSlot", "armor");
    await page.locator('.gpick [data-a="gearEquip"]', { hasText: armor.n }).click();
    let c = (await state()).chars[0];
    assert.strictEqual(c.gear.armor, armor.n); assert.ok(!c.inv.some((l) => l.n === armor.n), "left the pack");
    assert.strictEqual(await page.evaluate(() => der(S.chars[0]).dt), dt0 + armor.dt, "DT goes up");
    assert.strictEqual(await page.evaluate(() => der(S.chars[0]).skills.BG), bg0 + 10, "armor bonus applies");
    await has("TOTAL DT", ".geartop"); await has("Big Guns +10", ".geartop");
    await page.locator(".dialog .gb-armor").hover(); assert.ok(await page.locator(".dialog .gb-armor .gtip").isVisible(), "hover text");
    await click("gearSlot", "armor"); await page.locator('.gpick [data-a="gearEquip"][data-v=""]').click();
    c = (await state()).chars[0]; assert.strictEqual(c.gear.armor, ""); assert.ok(c.inv.some((l) => l.n === armor.n), "back in the pack");
    await page.evaluate((n) => { S.chars[0].inv = S.chars[0].inv.filter((l) => l.n !== n); render(); }, armor.n);
    await click("gearSlot", "armor");
    assert.ok(!(await text(".gpick")).includes("(NO"), "no placeholders");
    await press("Escape");
  });
  await ok("Party-wide: add a status and an item to all, then remove", async () => {
    await click("pwOpen", "party");
    await page.selectOption("#pwAct", "addStatus"); await page.fill("#pwName", "Thirst"); await page.selectOption("#pwTier", "2");
    await page.locator('[data-a="pwApply"]').click();
    let s = await state();
    for (const c of s.chars) assert.ok(c.statuses.some((x) => x.n === "Thirst" && x.tier === 2), c.name);
    await click("pwOpen", "party");
    await page.selectOption("#pwAct", "removeStatus"); await page.fill("#pwName", "Thirst");
    await page.locator('[data-a="pwApply"]').click();
    s = await state(); for (const c of s.chars) assert.ok(!c.statuses.some((x) => x.n === "Thirst"), c.name);
    await click("pwOpen", "party");
    await page.selectOption("#pwAct", "addItem"); await page.fill("#pwName", "water"); await page.fill("#pwVal", "2");
    await page.uncheck("#pw-c3");
    const wat = (c) => c.inv.filter((l) => /water/i.test(l.n)).reduce((a, l) => a + l.q, 0);
    const before = s.chars.map(wat);
    await page.locator('[data-a="pwApply"]').click();
    s = await state();
    assert.strictEqual(wat(s.chars[0]), before[0] + 2, "ticked character got it");
    assert.strictEqual(wat(s.chars[2]), before[2], "unticked character did not");
    await page.evaluate(() => undo());
    await click("pwOpen", "party");
    await page.selectOption("#pwAct", "hp"); await page.fill("#pwVal", "-3"); await page.locator('[data-a="pwApply"]').click();
    s = await state(); assert.strictEqual(s.chars[0].hp, 16); await page.evaluate(() => undo());
    assert.strictEqual((await state()).chars[0].hp, 19);
  });
  await ok("Check gen: every player's roll, typed in place, random check", async () => {
    await page.focus("#chkTarget"); await page.keyboard.press("Control+a"); await type("20"); await page.selectOption("#chkUse", "SNK");
    assert.ok(await page.locator(".w-check tr").count() >= 5, "a row per player");
    await page.focus("#chk-c1"); await type("15"); await press("Enter");
    await has("PASS", ".w-check");
    assert.match((await state()).log.slice(-1)[0].x, /Character 1: .*SUCCESS/);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "chk-c2", "moves to the next player");
    await page.locator('[data-a="chkGen"]').click();
    const m = await page.evaluate(() => ui.chk);
    assert.deepStrictEqual(m.res, {}); assert.ok(m.target > 0);
    await blur();
  });
  await ok("Item browser opens only as a window: search, details, give", async () => {
    await rail("items"); await type("Stimpak"); await page.waitForTimeout(20);
    await has("Stimpak", ".dialog");
    await press("Enter"); await has("effect", ".dialog");
    const n0 = (await state()).chars[0].inv.reduce((a, l) => a + l.q, 0);
    await page.locator('.dialog [data-a="brGive"]').first().click();
    assert.strictEqual((await state()).chars[0].inv.reduce((a, l) => a + l.q, 0), n0 + 1);
    await page.fill("#brQ", "");
    await page.selectOption("#brCat", "Weapons"); await page.fill("#brQ", "pipe pis"); await has("Pipe Pistol", ".dialog");
    await page.fill("#brQ", ""); await page.selectOption("#brCat", "All"); await blur();
    await press("Escape");
    assert.strictEqual(await page.locator(".dialog").count(), 0);
  });
  await ok("Encounter setup opens the map, and locations set the ranges", async () => {
    await blur(); await press("b");
    assert.strictEqual(await page.evaluate(() => S.combat), null, "B opens setup first, no fight yet");
    assert.strictEqual(await page.locator("#map .tok.pc").count(), 4, "party on the map");
    assert.strictEqual(await page.locator("#map .band").count(), 0, "no rings");
    const names = await page.locator("#mapId option").allTextContents();
    for (const n of ["Small room", "Medium room", "Big room", "Wilderness", "Tight forest", "Urban streets"]) assert.ok(names.some((x) => x.startsWith(n)), n);
    const farthest = () => page.evaluate(() => { const M = mapOf(); return bandFor(Math.hypot(M.w, M.h)); });
    await page.selectOption("#mapId", "smallRoom"); await page.waitForTimeout(30);
    assert.ok(await farthest() <= 5, "a small room can't reach long range");
    for (const c of ["c1", "c2", "c3", "c4"]) { const p = await page.evaluate((i) => posOf(i), c); assert.ok(Math.abs(p.x) <= 3 && Math.abs(p.y) <= 2.5, "party inside the room"); }
    await page.selectOption("#mapId", "forest"); await page.waitForTimeout(30);
    assert.ok((await state()).scene.objects.filter((o) => o.kind === "tree").length > 20, "forest has trees");
    await page.selectOption("#mapId", "custom"); await page.waitForTimeout(30); await page.fill("#mapW", "70"); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual((await state()).scene.map.w, 70, "custom size");
    await page.selectOption("#mapId", "wild"); await page.waitForTimeout(30);
    assert.ok(await farthest() === 10, "the wilderness reaches R10");
    const box = await page.locator("#map").boundingBox();
    assert.ok(box.width <= 600, `map stays a modest size: ${box.width}`);
    await page.locator('.w-enc [data-a="setupOpen"][data-v=""]').click();
    assert.strictEqual(await page.locator("#map").count(), 0, "Close hides the map");
    await blur();
  });
  await ok("Enemies list: add, count, range, random placement, darkness", async () => {
    await press("b"); await page.focus("#enemyQ");
    await type("gecko"); await press("Enter"); await press("Escape");
    assert.strictEqual(await page.locator("#map .tok.npc").count(), 1, "it's on the map right away");
    await page.locator('[data-a="pickQty"][data-v="Gecko|1"]').click();
    let s = await state();
    assert.deepStrictEqual(s.scene.npcs.map((n) => n.name), ["Gecko 1", "Gecko 2"]);
    await page.evaluate(() => { ui.open.encfx = true; render(); }); await page.locator('[data-a="fxDark"]').click();
    assert.strictEqual((await state()).scene.effects[0].hit, -0.1);
    await page.focus("#enemyQ"); await type("raider"); await press("Enter"); await press("Escape"); await page.waitForTimeout(30);
    const raider = (await state()).scene.npcs.find((n) => n.tmpl === "Raider");
    assert.ok(raider.weapons.length >= 1, "raider got weapons");
    await page.fill(`#rr-${raider.id}`, "3"); await press("Tab"); await page.waitForTimeout(30); await blur();
    assert.strictEqual(await page.evaluate((i) => rangeOf("c1", i), raider.id), 3, "typing a band moves it there");
    await page.locator('[data-a="scatter"]').click();
    const ps0 = await page.evaluate(() => { const M = mapOf(); return S.scene.npcs.map((n) => posOf(n.id)).every((p) => Math.abs(p.x) <= M.w / 2 && Math.abs(p.y) <= M.h / 2); });
    assert.ok(ps0, "stay on the map");
    await page.locator('[data-a="surround"]').click();
    const ps = await page.evaluate(() => S.scene.npcs.map((n) => posOf(n.id)));
    assert.ok(ps.every((p, i) => ps.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 1)), "spread out");
  });
  await ok("The new enemies are in the list and can be added", async () => {
    const r = await page.evaluate(() => { const before = S.scene.npcs.length; const e = addEnemy("Jackal Pack Leader"); const out = [e.name, e.faction, e.weapons.map((w) => w.n)]; S.scene.npcs = S.scene.npcs.filter((n) => n !== e); delete S.scene.pos[e.id]; render(); return [out, DATA.enemies.filter((x) => x.faction === "Unaligned").length > 50, before === S.scene.npcs.length]; });
    assert.match(r[0][0], /^Jackal Pack Leader - [^ ]/, "a gang name: " + r[0][0]);
    const leg = await page.evaluate(() => { const e = addEnemy("Legion Soldier"); const n = e.name; S.scene.npcs = S.scene.npcs.filter((x) => x !== e); delete S.scene.pos[e.id]; return n; });
    assert.match(leg, /^Legion Soldier - [A-Z][a-z]+$/, "not Legion Soldier 1"); assert.strictEqual(r[0][1], "Jackals"); assert.ok(r[0][2].includes(".357 Magnum revolver"), "their weapon"); assert.ok(r[1], "creatures are Unaligned"); assert.ok(r[2]);
  });
  await ok("The enemy picker shows every enemy and sorts by faction, tier or name", async () => {
    const total = await page.evaluate(() => allTemplates().length);
    const shown = await page.evaluate(() => { ui.enemyQ = ""; ui.enemyTier = ""; ui.enemySort = "faction"; ui.setup = true; const keep = S.scene.npcs; S.scene.npcs = []; const c = S.combat; S.combat = null; render(); const r = [document.querySelectorAll('[data-a="addPick"]').length, [...document.querySelectorAll(".grouphead")].map((x) => x.textContent)]; S.scene.npcs = keep; S.combat = c; return r; });
    assert.strictEqual(shown[0], total, "no cap on the list");
    assert.ok(shown[1].includes("NCR") && shown[1].includes("Fiends") && shown[1].includes("Jackals"), "faction headings");
    const order = (sort) => page.evaluate((s) => { ui.enemySort = s; const keep = S.scene.npcs; S.scene.npcs = []; const c = S.combat; S.combat = null; render(); const r = [...document.querySelectorAll('[data-a="addPick"]')].map((b) => [b.dataset.v, Number(b.querySelector(".tag").textContent.slice(1))]); S.scene.npcs = keep; S.combat = c; ui.enemySort = "faction"; render(); return r; }, sort);
    const az = await order("az"); assert.deepStrictEqual(az.map((x) => x[0]), [...az.map((x) => x[0])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    const tier = await order("tier"); assert.ok(tier.every((x, i) => i === 0 || tier[i - 1][1] <= x[1]), "tier order");
    const rowsShown = await page.evaluate(() => { ui.modal = { type: "dev", cat: "enemies" }; render(); const n = document.querySelectorAll(".dialog table.t tr").length - 1; ui.modal = null; render(); return n; });
    assert.strictEqual(rowsShown, await page.evaluate(() => DATA.enemies.length), "the Enemies table shows every row");
    await page.evaluate(() => { ui.setup = null; render(); });
  });
  await ok("Enemy names live in the enemy table, and Refresh loads edits", async () => {
    await page.evaluate(() => { ui.modal = { type: "dev", cat: "enemies" }; render(); });
    await has("Enemy names"); assert.ok(await page.locator("#np-raider").count());
    await page.fill("#np-raider", "Zed"); await page.locator("#np-raider").dispatchEvent("change"); await page.waitForTimeout(30);
    await page.evaluate(() => { ui.modal = null; render(); }); await page.locator(".devbar [data-a=refresh]").click(); assert.strictEqual(await page.locator("#toast").textContent(), "Lists refreshed");
    let n = await page.evaluate(() => { const e = addEnemy("Fiend"); S.scene.npcs = S.scene.npcs.filter((x) => x !== e); delete S.scene.pos[e.id]; return e.name; });
    assert.strictEqual(n, "Fiend - Zed");
    const err = await page.evaluate(() => importTable("enemies", { enemies: DATA.enemies, namePools: { ...S.rules.namePools, raider: "Yorick" }, nameStyles: S.rules.nameStyles }));
    assert.strictEqual(err, ""); n = await page.evaluate(() => { const e = addEnemy("Fiend"); S.scene.npcs = S.scene.npcs.filter((x) => x !== e); delete S.scene.pos[e.id]; return e.name; });
    assert.strictEqual(n, "Fiend - Yorick", "an enemies JSON brings its names");
    await click("undo"); await click("undo"); await click("undo"); await page.evaluate(() => { ui.modal = null; render(); });
    assert.match(await page.evaluate(() => S.rules.namePools.raider), /Razor/, "undo puts the names back: " + await page.evaluate(() => S.rules.namePools.raider.slice(0, 30) + " | " + undoStack.slice(-5).map((u) => u.label || u[0] || typeof u).join(";")));
  });
  await ok("Rooms: 2m grid everywhere, settings, randomize, city blocks stop walking", async () => {
    const sizes = await page.evaluate(() => Object.keys(S.rules.maps).length); assert.ok(sizes > 8);
    assert.match(await page.locator(".zoombar .scale").textContent(), /2m grid/);
    await page.selectOption("#mapId", "streets"); await page.waitForTimeout(30); assert.match(await page.locator(".zoombar .scale").textContent(), /2m grid/);
    await page.selectOption("#themeId", "city"); await page.waitForTimeout(30); await click("randomRoom");
    let s = await state(); assert.ok(s.scene.objects.some((o) => o.item === "building" && o.block), "concrete blocks");
    await page.selectOption("#mapId", "smallRoom"); await page.waitForTimeout(30); await page.selectOption("#themeId", "office"); await page.waitForTimeout(30); await click("randomRoom");
    s = await state(); assert.ok(s.scene.objects.every((o) => ["lDesk", "desk", "officeChair", "cabinet", "bookshelf", "copier", "cooler", "pottedPlant", "partition", "couch", "officeSafe"].includes(o.item)), "office furniture");
    await page.selectOption("#mapId", "forest"); await page.waitForTimeout(30);
    s = await state(); assert.ok(s.scene.objects.filter((o) => o.item === "tree").length > 60, "the forest is full of trees");
    assert.strictEqual(await page.locator("#map .obj .gly.canopy").first().evaluate((e) => getComputedStyle(e).opacity), "0.15", "leaves are faint");
    assert.strictEqual(await page.locator("#map .obj .gly.trunk").first().evaluate((e) => getComputedStyle(e).opacity), "0.3", "the trunk shows a bit more");
    // Zooming: objects stay real size, people stop shrinking at life size
    const size = (sel) => page.locator(sel).first().evaluate((e) => e.getBoundingClientRect().width);
    const treeSel = "#map .obj .gly.canopy"; const t0 = await size(treeSel), p0 = await size('[data-tok="c1"] path.b');
    for (let i = 0; i < 2; i++) await click("mapZoom", "1.5");
    await page.waitForTimeout(30);
    const t1 = await size(treeSel), p1 = await size('[data-tok="c1"] path.b');
    assert.ok(t1 > t0 * 2, `objects grow with zoom: ${t0} to ${t1}`); assert.ok(p1 < t1, "people stay smaller");
    assert.strictEqual(await page.evaluate(() => tokenScale(1000) > tokenScale(40)), true); assert.strictEqual(await page.evaluate(() => tokenScale(3)), 0.62, "life size up close");
    const box = await page.locator("#map").boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -300); await page.waitForTimeout(80);
    const zk = await page.evaluate(() => ui.zoom.k); assert.ok(zk > 2.25, "scrolling zooms in");
    await page.evaluate(() => { S.scene.objects = S.scene.objects.filter((o) => E.trunkOf(o, S.rules)); S.scene.objects.forEach((o) => { if (Math.hypot(o.x, o.y) < 8) o.x += 12; }); render(); });  // leaves are click-through, so only a trunk could catch this drag
    const v0 = await page.evaluate(() => mapView().x); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 3 }); await page.mouse.up(); assert.notStrictEqual(await page.evaluate(() => mapView().x), v0, "dragging the ground pans");
    await click("mapZoom", "0"); assert.strictEqual(await page.evaluate(() => ui.zoom), null, "Fit shows the whole map");
    await page.selectOption("#mapId", "wild"); await page.waitForTimeout(30);
  });
  let objCount = 0;
  await ok("Map: cover can be placed, moved and removed, tokens drag to set range", async () => {
    await click("surround");  // changing location scatters enemies, and one could land on the spot this step uses
    const n0 = (await state()).scene.objects.length;
    await page.locator('[data-a="mapPlace"][data-v="cover"]').click();
    let at = await onMap(30, -40); await page.mouse.click(at.x, at.y);
    assert.strictEqual((await state()).scene.objects.length, n0 + 1, "placed, even if a rock is there");
    await page.keyboard.press("Escape"); await page.evaluate(() => { S.scene.objects = []; render(); });
    await page.locator('[data-a="mapPlace"][data-v="cover"]').click(); await page.mouse.click(at.x, at.y);
    let s = await state(); assert.strictEqual(s.scene.objects.length, 1); const o = s.scene.objects[0]; assert.strictEqual(o.kind, "cover");
    await page.keyboard.press("Escape");
    await dragTo(await onMap(o.x, o.y), await onMap(-30, 50));
    s = await state(); assert.ok(Math.abs(s.scene.objects[0].x + 30) < 2, `cover at ${s.scene.objects[0].x}`);
    at = await onMap(s.scene.objects[0].x, s.scene.objects[0].y); await page.mouse.click(at.x, at.y, { button: "right" });
    assert.strictEqual((await state()).scene.objects.length, 0);
    const id = (await state()).scene.npcs[0].id; const c1 = await page.evaluate(() => posOf("c1"));
    await dragTo(await center(`[data-tok="${id}"]`), await onMap(c1.x + 20, c1.y));
    assert.strictEqual(await page.evaluate((i) => rangeOf("c1", i), id), 6, "20m is R6");
    await page.locator('[data-a="mapPlace"][data-v="hard"]').click(); at = await onMap(-30, -40); await page.mouse.click(at.x, at.y);
    await page.keyboard.press("Escape"); await blur();
    { const o = (await state()).scene.objects.slice(-1)[0]; const q = await onMap(o.x, o.y); await page.mouse.click(q.x, q.y); await page.waitForTimeout(30);
      assert.strictEqual(await page.locator(`[data-obj="${o.id}"] .rothandle`).count(), 1, "selected objects show a turn handle");
      { const hb = await page.locator(`[data-obj="${o.id}"] .rothandle`).boundingBox(); await dragTo({ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, { x: q.x + 60, y: q.y }); assert.strictEqual((await state()).scene.objects.slice(-1)[0].angle, 90, "dragging the handle turns it"); await page.fill("#objAngle", "0"); await press("Tab"); await page.waitForTimeout(30); }
      await click("objRotate", "15"); await click("objRotate", "15");
      assert.strictEqual((await state()).scene.objects.slice(-1)[0].angle, 30, "the buttons turn it");
      assert.match(await page.locator(`[data-obj="${o.id}"] .gly`).first().getAttribute("transform"), /rotate\(30\)/, "the drawing turns");
      await page.mouse.move(q.x, q.y); await page.keyboard.down("Shift"); await page.mouse.wheel(0, 100); await page.keyboard.up("Shift"); await page.waitForTimeout(40);
      assert.strictEqual((await state()).scene.objects.slice(-1)[0].angle, 45, "Shift+scroll turns it");
      await page.fill("#objAngle", "0"); await press("Tab"); await page.waitForTimeout(30); assert.strictEqual((await state()).scene.objects.slice(-1)[0].angle, 0); await blur(); }
    objCount = (await state()).scene.objects.length;
  });
  await ok("Begin with a stealth phase: the center grows into the fight", async () => {
    const pos = await page.evaluate(() => S.scene.npcs.map((n) => ({ ...posOf(n.id) })));
    const w0 = (await page.locator("#map").boundingBox()).width;
    await click("beginC", "1"); await has("Stealth phase");
    assert.strictEqual(await page.locator(".w-enc").count(), 0, "setup gives way to the fight");
    const arena = await page.locator(".arena").boundingBox(); const party = await page.locator(".w-party").boundingBox();
    assert.ok(arena.width > 700, `arena ${arena.width}`); assert.ok(party.width <= 275, `party compacts: ${party.width}`);
    assert.ok(w0 > 0);
    const s = await state(); assert.strictEqual(s.combat.phase, "stealth");
    assert.strictEqual(s.combat.npcs.length, 3);
    assert.ok(s.combat.npcs.find((n) => n.name === "Gecko 1") && s.combat.npcs.find((n) => n.name === "Gecko 2"));
    assert.ok(s.combat.npcs.find((n) => n.tmpl === "Raider").weapons.length >= 1, "raider kept its weapons");
    s.combat.npcs.forEach((n, i) => { const c = s.combat.cbs.find((x) => x.id === n.id); assert.ok(Math.abs(c.x - pos[i].x) < 0.01, "kept its place on the map"); });
    assert.strictEqual(s.scene.objects.length, objCount, "objects stay on the map");
  });
  await ok("Stealth: attack from hiding, then get caught", async () => {
    await press("a"); await page.fill("#roll", ""); await page.focus("#roll"); await type("50"); await press("Enter");
    assert.ok((await state()).log.some((l) => /Character 1 → /.test(l.x)));
    await page.fill("#stealthRoll", "20"); await page.focus("#stealthRoll"); await press("Enter");
    assert.strictEqual((await state()).combat.cbs.find((x) => x.id === "c1").caught, true);
  });
  await ok("Initiative: type player rolls, caught means minus 10", async () => {
    await press("Escape"); await page.locator('[data-a="toInit"]').click();
    await has("Roll initiative");
    const pcs = (await state()).combat.cbs.filter((c) => c.id.startsWith("c"));
    for (const [i, c] of pcs.entries()) await page.fill(`#init-${c.id}`, String(10 + i));
    await page.locator('[data-a="beginRounds"]').click();
    const s = await state();
    assert.strictEqual(s.combat.phase, "turns");
    assert.strictEqual(s.combat.cbs.find((c) => c.id === "c1").init, 8 + 10 - 10);
    assert.ok(s.combat.turnId);
  });
  const runTurnTo = async (id) => { await blur(); for (let i = 0; i < 14 && (await state()).combat.turnId !== id && (await state()).combat.phase === "turns"; i++) await press("n"); };
  await ok("The attack menu is up by itself on a turn, under End turn and a big name", async () => {
    await blur();
    await page.evaluate(() => { startTurn("c1"); render(); });
    assert.strictEqual(await page.locator(".w-action #roll").count(), 1, "roll box is ready");
    const y = async (q) => (await page.locator(q).first().boundingBox()).y;
    assert.ok(await y(".endturn") < await y(".body"), "End turn above the attack");
    const segs = await page.locator(".w-action .segh").allInnerTexts();
    for (const n of ["LOADOUT", "TARGET", "ROLL", "ACTIONS", "CONSUMABLES"]) assert.ok(segs.map((x) => x.toUpperCase()).includes(n), `${n} segment: ${segs}`);
    await has("Character 1", ".actname");
    assert.ok(Number((await page.locator(".actname").evaluate((e) => getComputedStyle(e).fontSize)).replace("px", "")) >= 26, "big name");
    assert.strictEqual(await page.locator('[data-card="c1"]').evaluate((e) => getComputedStyle(e).animationName), "turnblink", "blinking border");
    await has("Consumables", ".w-action");
    const red = await page.locator(".body").evaluate((e) => e.classList.contains("hostile"));
    assert.ok(red, "enemy target: bright red body");
    await page.evaluate(() => { const c = cbOf("c2"); c.y += 30; render(); });  // an earlier step parks an enemy on top of this ally
    { const p = await center('[data-tok="c2"]'); await page.mouse.click(p.x, p.y); await page.waitForTimeout(40); }
    assert.ok(await page.locator(".body").evaluate((e) => e.classList.contains("friendly")), "own side: bright green body");
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector(".body .bp-Body")).backgroundColor), "rgb(43, 255, 106)");
    const foe = await page.evaluate(() => targetsFor("c1").find((i) => sideOf(i) === "npc"));
    { const p = await center(`[data-tok="${foe}"]`); await page.mouse.click(p.x, p.y); await page.waitForTimeout(40); }
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector(".body .bp-Body")).backgroundColor), "rgb(255, 42, 42)");
    const stops = await page.locator("#aimg stop").evaluateAll((l) => l.map((x) => x.getAttribute("stop-color")));
    assert.ok(stops.length >= 2 && stops.every((c) => /^hsl/.test(c)), "the aim line is a gradient");
  });
  await ok("Cover: the line picks it up, and it changes hit and damage", async () => {
    const r = await page.evaluate(() => {
      startTurn("c1"); const t = targetsFor("c1").find((i) => sideOf(i) === "npc"); makeAttack("c1", t); const a = posOf("c1"), b = posOf(t);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const keep = S.scene.objects; S.scene.objects = [];
      const open = atkView(); S.scene.objects = [{ id: "z", kind: "cover", cover: "soft", x: mid.x, y: mid.y, w: 2, h: 2 }];
      const soft = atkView(); S.scene.objects = [{ id: "z", kind: "wall", cover: "impenetrable", x: mid.x, y: mid.y, w: 2, h: 2 }];
      const wall = atkView(); render(); const flag = document.querySelector(".covflag").innerText; S.scene.objects = keep; render();
      return { open: [open.cov.tier, open.hit], soft: [soft.cov.tier, soft.hit], wall: [wall.cov.tier, wall.hit], flag };
    });
    assert.strictEqual(r.open[0], "open"); assert.strictEqual(r.soft[0], "soft"); assert.ok(Math.abs(r.open[1] - r.soft[1] - 0.25) < 0.001, "-25% to hit"); assert.strictEqual(r.wall[0], "impenetrable"); assert.ok(r.wall[1] < 0); assert.match(r.flag, /Impenetrable/i);
  });
  await ok("Attack in three taps: A, roll, Enter", async () => {
    await blur(); await page.evaluate(() => { startTurn("c4"); S.combat.acted = { c4: true }; ui.focus = null; render(); }); const s0 = await state(); assert.strictEqual(s0.combat.turnId, "c4");
    await press("a"); await has("HIT "); await has("Jam ");
    assert.strictEqual(await page.locator("#map .aim").count(), 1, "the map shows who is aimed at");
    assert.strictEqual(await page.locator(".body .bp").count(), 6, "body mock-up: head, body, four limbs");
    await page.evaluate(() => { K().ranges[pairKey(ui.atk.att, ui.atk.tgt)] = 2; ui.atk.ov.cover = "open"; ui.focus = "#roll"; render(); });  // scattered enemies can be out of pistol range, where a 99 rightly misses
    const ap = (await state()).chars[3].ap; const mag = (await state()).chars[3].weapons[0].mag;
    await type("99"); await press("Enter");
    const s = await state();
    assert.ok(s.log.slice(-3).some((l) => /Character 4 → .*rolled 99: SUPER CRIT/.test(l.x)), "logged the shot");  // a kill logs a line after it
    assert.ok(s.chars[3].ap < ap, "AP was spent");
    assert.strictEqual(s.chars[3].weapons[0].mag, mag - 1, "ammo was spent");
    await has("SUPER CRIT");
  });
  await ok("Target remembered, jam blocks then clears for AP", async () => {
    await press("Escape"); await press("a");
    assert.ok((await state()).combat.last.c4.tgt, "last target stored");
    await type("00"); await press("Enter");
    let s = await state();
    assert.match(s.log[s.log.length - 1].x, /JAM/);
    assert.strictEqual(s.chars[3].weapons[0].jammed, true);
    await type("50"); await press("Enter"); await has("Jammed");
    const before = (await state()).chars[3].ap;
    await press("Escape"); await blur(); await click("clearJamBtn");
    s = await state();
    assert.ok(!s.chars[3].weapons[0].jammed, "cleared");
    const cost = await page.evaluate(() => { const c = S.chars[3]; return E.weaponView(c.weapons[0], c, der(c), ctx()).clearJam; });
    assert.strictEqual(s.chars[3].ap, before - cost, "clearing costs the weapon type's AP");
  });
  await ok("Undo and redo", async () => {
    const before = await state();
    await press("n");
    const mid = await state();
    await blur(); await press("Control+z");
    assert.strictEqual((await state()).combat.turnId, before.combat.turnId);
    await press("Control+y");
    assert.strictEqual((await state()).combat.turnId, mid.combat.turnId);
  });
  await ok("Clicking a body part sets the aim, clicking an enemy sets target and range", async () => {
    await blur(); await press("Escape");
    const me = (await state()).combat.turnId;
    const foes = await page.evaluate((m) => targetsFor(m).filter((id) => sideOf(id) !== sideOf(m)), me);
    await page.evaluate(() => { S.combat.ranges = {}; render(); });
    await page.locator(`[data-a="pick"][data-v="${foes[0]}"] .nm`).click();  // the turn may be a player's or an enemy's here
    assert.strictEqual(await page.evaluate(() => ui.atk.tgt), foes[0], "clicking in the enemy list starts an attack on it");
    await has(`R${await page.evaluate(([a, b]) => rangeOf(a, b), [me, foes[0]])}`, ".stats3");
    await has(`${await page.evaluate(([a, b]) => dist(posOf(a), posOf(b)).toFixed(1), [me, foes[0]])}m`, ".rng");
    await page.mouse.click(...Object.values(await center(`[data-tok="${foes[1]}"]`)));
    assert.strictEqual(await page.evaluate(() => ui.atk.tgt), foes[1], "clicking on the map changes target");
    const auto = await page.evaluate(([a, b]) => bandFor(dist(posOf(a), posOf(b))), [me, foes[1]]);
    assert.strictEqual(await page.evaluate(() => atkView().range), auto, "range comes from the map");
    await page.locator('[data-a="atkPart"][data-v="Head"]').click();
    assert.deepStrictEqual(await page.evaluate(() => [ui.atk.part, ui.atk.loc]), ["Head", "Head"]);
    const cost = await page.evaluate(() => atkView()); assert.strictEqual(cost.extra, 2, "aimed head shot costs extra AP");
    await page.locator('[data-a="atkPart"][data-v="LLeg"]').click();
    assert.deepStrictEqual(await page.evaluate(() => [ui.atk.part, ui.atk.loc]), ["LLeg", "Limb"]);
    await page.locator('[data-a="atkOvToggle"]').click(); assert.strictEqual(await page.locator("#ovHit").count(), 1); await page.locator('[data-a="atkOvToggle"]').click();
  });
  await ok("A crit to a limb applies the status by itself, and Undo takes it back", async () => {
    const tid = await page.evaluate(() => { const t = ent(ui.atk.tgt); t.hp = 500; t.ov = { hp: 500 }; ent(ui.atk.att).ap = 99; ui.atk.ov.hit = 50; S.combat.ranges[pairKey(ui.atk.att, ui.atk.tgt)] = 1; ui.focus = "#roll"; render(); return t.id; });
    await page.locator('[data-a="atkPart"][data-v="LLeg"]').click();
    await type("99"); await press("Enter");
    let t = await page.evaluate((i) => JSON.parse(JSON.stringify(ent(i))), tid);
    const st = t.statuses.find((x) => x.n.startsWith("Injured Limb"));
    assert.ok(st, "Injured Limb applied"); assert.strictEqual(st.tier, 2, "super crit is tier 2"); assert.deepStrictEqual(st.parts, ["LLeg"]);
    await has("Applied:", ".result");
    assert.strictEqual(await page.locator(".bp-LLeg.hurt").count(), 1, "the body shows it");
    assert.ok(await page.evaluate((i) => moveMult(ent(i)) > 1, tid), "a hurt leg makes walking dearer");
    await page.evaluate(() => undo());
    t = await page.evaluate((i) => JSON.parse(JSON.stringify(ent(i))), tid);
    assert.ok(!t.statuses.some((x) => x.n.startsWith("Injured Limb")), "Undo removes it");
    await page.evaluate((i) => { const m = E.resolve; ui.atk = null; ent(i).ov = {}; ent(i).hp = der(ent(i)).hp; render(); }, tid);
  });
  await ok("Weapon statuses roll their own chance", async () => {
    const r = await page.evaluate(() => { const T = S.combat.npcs[0]; const before = Math.random; Math.random = () => 0; T.hp = 100; const a = hitStatuses({ total: 5, outcome: "hit" }, T, { n: "Taser", status: "Electrocuted" }, "Body"); Math.random = () => 0.99; const b = hitStatuses({ total: 5, outcome: "hit" }, T, { n: "x", status: "Bleeding (20%) +3" }, "Body"); const c = hitStatuses({ total: 5, outcome: "hit" }, T, { n: "x", status: "Crit; Bleeding (100%) +1" }, "Body"); const d = hitStatuses({ total: 5, outcome: "hit" }, T, { n: "x", status: "Concuss" }, "Body"); Math.random = before; const out = { a, b, c, d, names: T.statuses.map((x) => x.n) }; T.statuses = []; T.hp = der(T).hp; return out; });
    assert.deepStrictEqual(r.a.auto, ["Electrocuted 1"]); assert.deepStrictEqual(r.b.auto, [], "20% missed"); assert.deepStrictEqual(r.c.auto, [], "crit-only skipped on a hit"); assert.strictEqual(r.d.manual, "Concuss", "unknown names stay a button");
  });
  await ok("No AP means no action and no move", async () => {
    await blur(); const me = (await state()).combat.turnId;
    const p0 = await page.evaluate((i) => ({ ...posOf(i) }), me); const logN = (await state()).log.length;
    await page.evaluate((i) => { ent(i).ap = 0; ent(i).activeW = 0; render(); }, me);
    assert.ok(await page.locator('[data-a="fire"].na').count() === 1, "Resolve is greyed out");
    await press("a"); await type("50"); await press("Enter");
    assert.match(await page.evaluate(() => ui.atk.err), /Not enough AP/);
    assert.strictEqual((await state()).log.length, logN, "nothing happened");
    await press("Escape"); await blur();
    const at = await onMap(p0.x + 20, p0.y); await dragTo(await center(`[data-tok="${me}"]`), at);
    const p1 = await page.evaluate((i) => ({ ...posOf(i) }), me);
    assert.deepStrictEqual(p1, p0, "the token stays put");
    await click("swap");
    const after = await state(); assert.strictEqual(after.log.length, logN, "swap and cover refused"); assert.strictEqual(await page.locator('[data-a="cover"]').count(), 0, "cover comes from the map now");
    await page.evaluate((i) => { ent(i).ap = der(ent(i)).ap; render(); }, me);
  });
  await ok("Party and enemies stand apart in a fight, boxes override numbers", async () => {
    await blur();
    assert.strictEqual(await page.locator(".w-enemies .foe").count(), 3); assert.strictEqual(await page.locator('.w-party [data-card]').count(), 4);
    const raider = (await state()).combat.npcs.find((n) => n.tmpl === "Raider");
    await page.fill(`#rh-${raider.id}`, "5"); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual((await state()).combat.npcs.find((n) => n.id === raider.id).hp, 5);
    await page.fill(`#rh-${raider.id}`, String(raider.hp)); await press("Tab"); await page.waitForTimeout(30);
    await page.fill(`#in-${raider.id}`, "50"); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual((await state()).combat.cbs.find((c) => c.id === raider.id).init, 50);
    await blur();
  });
  await ok("Edit an enemy copy: rename and Make Boss without touching the template", async () => {
    const raider = (await state()).combat.npcs.find((n) => n.tmpl === "Raider");
    await page.locator(`.foe[data-v="${raider.id}"] [data-a="edit"]`).click();
    await has("Changes only this one enemy");
    await page.fill(`[data-bind="${raider.id}:name"]`, "Raider Boss"); await press("Tab"); await page.waitForTimeout(30);
    await page.locator(`[data-a="makeBoss"][data-v="${raider.id}"]`).click();
    const e = (await state()).combat.npcs.find((n) => n.id === raider.id);
    assert.strictEqual(e.name, "Raider Boss"); assert.ok(e.boss); assert.ok(e.hpMult > 1.09); assert.ok(e.xp > raider.xp);
    await page.evaluate(() => { if (DATA.enemies.find((x) => x.n === "Raider").xp !== 10) throw new Error("template changed"); });
    await press("Escape");
  });
  await ok("Enemy turns work", async () => {
    await blur(); await page.evaluate(() => { startTurn(S.combat.npcs[0].id); render(); });  // initiative is random, so this enemy may have acted already
    const s0 = await state(); const npc = s0.combat.turnId;
    await press("a"); await type("80"); await press("Enter");
    const s = await state(); const nm = s.combat.npcs.find((n) => n.id === npc).name; assert.ok(s.log.slice(-3).some((l) => l.x.startsWith(nm)), "logged the attack");
    await press("Escape");
  });
  await ok("A player goes DBNO and stays in initiative", async () => {
    await blur(); await page.fill("#rh-c2", "0"); await press("Tab"); await page.waitForTimeout(30); await blur();
    const s = await state();
    assert.strictEqual(s.chars[1].dbno, true);
    assert.ok(s.combat.cbs.find((c) => c.id === "c2"), "still in initiative");
    await has("DBNO");
  });
  await ok("End of round prompts the saving throw, then Shock on getting up", async () => {
    for (let i = 0; i < 14 && (await state()).combat.phase === "turns"; i++) await press("n");
    assert.strictEqual((await state()).combat.phase, "roundEnd");
    await has("Saving throws");
    await page.focus("#save-c2"); await type("1"); await press("Enter");
    await has("PASS");
    await page.locator('[data-a="saveUp"][data-v="c2"]').click();
    const c = (await state()).chars[1];
    assert.strictEqual(c.dbno, false); assert.strictEqual(c.hp, 1); assert.strictEqual(c.timesRevived, 1);
    assert.ok(c.statuses.some((x) => x.n === "Shock"));
    await blur(); await press("Enter");
    assert.strictEqual((await state()).combat.round, 2);
  });
  await ok("Statuses change numbers", async () => {
    await blur();
    const id = (await state()).combat.turnId;
    const baseAp = await page.evaluate((i) => der(ent(i)).ap, id);
    await click("statusModal"); await page.fill("#stName", "Thirst"); await page.selectOption("#stTier", "3"); await page.focus("#stName"); await press("Enter");
    const ap2 = await page.evaluate((i) => der(ent(i)).ap, id);
    assert.ok(ap2 < baseAp, `AP should drop: ${baseAp} -> ${ap2}`);
  });
  await ok("Moving costs AP: the Move window, dragging, and whose turn it is", async () => {
    await blur(); const id = (await state()).combat.turnId; const tgt = await page.evaluate(() => targetsFor(S.combat.turnId)[0]);
    await page.evaluate(([i, t]) => { const a = cbOf(i), b = cbOf(t); b.x = 0; b.y = 0; a.x = 5; a.y = 0; S.combat.ranges = {}; ent(i).ap = 20; render(); }, [id, tgt]);
    await press("m"); await page.selectOption("#mvT", tgt); await page.waitForTimeout(20); await press("3");
    assert.strictEqual(await page.evaluate(([i, t]) => rangeOf(i, t), [id, tgt]), 3);
    assert.strictEqual(await page.evaluate((i) => ent(i).ap, id), 18, "2m is 2 AP");
    await page.evaluate((i) => { ent(i).ap = 20; render(); }, id);
    let p = await page.evaluate((i) => ({ ...posOf(i) }), id);
    await dragTo(await onMap(p.x, p.y), await onMap(p.x, p.y + 10));
    assert.strictEqual(await page.evaluate((i) => ent(i).ap, id), 20, "a drag is only a preview");
    await has("Move", ".moveconfirm"); await has("left", ".moveconfirm"); assert.strictEqual(await page.locator("#map .ghost").count(), 1, "a ghost shows where you'd end up");
    assert.deepStrictEqual(await page.evaluate((i) => ({ x: posOf(i).x, y: posOf(i).y }), id), { x: p.x, y: p.y }, "the token waits");
    await press("Escape"); assert.strictEqual(await page.locator(".moveconfirm").count(), 0, "Esc cancels"); assert.strictEqual(await page.evaluate((i) => ent(i).ap, id), 20);
    await dragTo(await onMap(p.x, p.y), await onMap(p.x, p.y + 10)); await press("Enter");
    assert.ok(/moves 4 AP/.test((await state()).log.slice(-1)[0].x), "10m is 4 AP");
    assert.strictEqual(await page.evaluate((i) => ent(i).ap, id), 16);
    const other = await page.evaluate((i) => S.combat.cbs.find((c) => c.id !== i && !c.dead).id, id);
    const q0 = await page.evaluate((i) => ({ ...posOf(i) }), other);
    await dragTo(await onMap(q0.x, q0.y), await onMap(q0.x + 25, q0.y));
    assert.deepStrictEqual(await page.evaluate((i) => ({ ...posOf(i) }), other), q0, "not their turn");
    await page.keyboard.down("Shift"); await dragTo(await onMap(q0.x, q0.y), await onMap(q0.x + 25, q0.y)); await page.keyboard.up("Shift");
    assert.ok(await page.evaluate(([i, x]) => Math.abs(posOf(i).x - x) > 10, [other, q0.x]), "Shift repositions for free");
    await page.evaluate(() => undo()); await page.evaluate(() => undo());
  });
  await ok("Clicking a token during an attack picks the target", async () => {
    await blur(); await press("a");
    const a = await page.evaluate(() => ui.atk); const other = await page.evaluate(() => targetsFor(ui.atk.att).find((x) => x !== ui.atk.tgt));
    const t = await page.locator(`[data-tok="${other}"]`).boundingBox();
    await page.mouse.click(t.x + t.width / 2, t.y + t.height / 2);
    assert.strictEqual(await page.evaluate(() => ui.atk.tgt), other); assert.ok(a.tgt !== other);
    await press("Escape");
  });
  await ok("Allies are blue and fight on the party's side", async () => {
    const foe = (await state()).combat.npcs.find((n) => n.tmpl === "Gecko");
    await click("toggleAlly", foe.id);
    assert.strictEqual(await page.locator(`#map [data-tok="${foe.id}"].ally`).count(), 1);
    assert.strictEqual(await page.evaluate((i) => sideOf(i), foe.id), "pc");
    const colors = await page.evaluate((i) => [getComputedStyle(document.querySelector('[data-tok="c1"] .b')).fill, getComputedStyle(document.querySelector(`[data-tok="${i}"] .b`)).fill, getComputedStyle(document.querySelector("#map .tok.npc .b")).fill], foe.id);
    assert.deepStrictEqual(colors, ["rgb(77, 255, 124)", "rgb(77, 166, 255)", "rgb(255, 77, 77)"], "green, blue, red");
    await click("toggleAlly", foe.id);
    const sh = await page.locator('[data-tok="c1"]').evaluate((g) => [g.querySelector("circle.b") != null, g.querySelector("path.b") != null]);
    assert.deepStrictEqual(sh, [true, true], "a circle head and half-oval body");
  });
  await ok("Ammo only comes from inventory", async () => {
    const me = await page.evaluate(() => { const c = S.chars.find((x) => x.weapons.some((w) => w.n === "Pipe Shotgun")); startTurn(c.id); c.activeW = c.weapons.findIndex((w) => w.n === "Pipe Shotgun"); c.ap = 99; render(); return c.id; });
    const mag = await page.evaluate((i) => { const c = ent(i); const s = c.weapons[c.activeW]; s.mag = 0; c.inv = c.inv.filter((l) => !/Gauge/.test(l.n)); render(); return s.mag; }, me);
    assert.strictEqual(mag, 0);
    await blur(); await press("r");
    assert.strictEqual(await page.evaluate((i) => { const c = ent(i); return c.weapons[c.activeW].mag; }, me), 0, "nothing to load");
    await press("a"); await has("In", ".wcards");
    const opts = await page.locator("#atkLoad option").allTextContents();
    assert.ok(opts.filter((x) => /Dam/.test(x)).length <= 1, `only held or loaded ammo: ${opts.join(" | ")}`);
    await press("Escape");
    await page.evaluate((i) => { const c = ent(i); const s = c.weapons[c.activeW]; addInv(c, s.ammo, 3, true); render(); }, me);
    await blur(); await press("r");
    const after = await page.evaluate((i) => { const c = ent(i); return [c.weapons[c.activeW].mag, (c.inv.find((l) => /Gauge/.test(l.n)) || { q: 0 }).q]; }, me);
    assert.ok(after[0] > 0, "reloaded"); assert.strictEqual(after[0] + after[1], 3, "the rounds moved, none appeared");
  });
  await ok("Review fixes: launcher ammo, last thrown item", async () => {
    const r = await page.evaluate(() => { const c = S.chars.find((x) => x.id === S.combat.turnId) || S.chars[0]; c.inv.push({ n: "Rocket - Junk", q: 3 }); const held = ammoHeld(c, "Rocket"); c.inv = c.inv.filter((l) => l.n !== "Rocket - Junk"); return held; });
    assert.strictEqual(r, 3, "a launcher finds its rockets");
    const err = await page.evaluate(() => { const c = S.chars[0]; startTurn("c1"); const keep = c.weapons; c.weapons = [{ n: "Dynamite" }]; c.activeW = 0; c.ap = 99; c.inv = c.inv.filter((l) => l.n !== "Dynamite"); openAttack("c1"); ui.atk.roll = "50"; fire(); const e = ui.atk.err; ui.atk = null; c.weapons = keep; render(); return e; });
    assert.match(err, /no Dynamite left/);
  });
  await ok("Only essential hotkeys are left", async () => {
    await blur(); const before = await state();
    const atk = await page.evaluate(() => !!ui.atk);
    for (const k of ["c", "s", "k", "t", "e", "j", "v", "z", "o", "q", "d", "1", "2"]) await press(k);
    await page.waitForTimeout(20);
    assert.strictEqual(await page.locator(".dialog").count(), 0, "no window opened");
    assert.deepStrictEqual((await state()).combat.phase, before.combat.phase);
    assert.strictEqual((await state()).log.length, before.log.length, "nothing happened");
  });
  await ok("Character windows still open mid-fight with Shift", async () => {
    await blur(); await click("openChar", "c1|inv"); await has("Adhesive", ".dialog"); await press("Escape");
    await click("check"); await has("Skill check", ".dialog"); await press("Escape");
  });
  await ok("After action: XP and loot", async () => {
    const ids = (await state()).combat.npcs.map((n) => n.id);
    for (const id of ids) await page.evaluate((i) => { const n = ent(i); n.hp = 0; syncDown(n, "c1"); render(); }, id);
    await has("All enemies are down");
    await click("endCombat"); await has("After Action");
    const xpBefore = (await state()).chars[0].xp;
    await page.fill("#exN", "Stimpak"); await page.fill("#exQ", "2"); await page.selectOption("#exTo", "c1"); await page.waitForTimeout(20); await click("endExAdd");
    await has("Added by DM", ".w-action");
    const stim0 = (await state()).chars[0].inv.filter((l) => l.n === "Stimpak").reduce((t, l) => t + l.q, 0);
    await page.selectOption("#lootAll", "c1"); await blur();
    await click("finishCombat");
    const s = await state();
    assert.strictEqual(s.combat, null);
    assert.ok(s.chars[0].xp > xpBefore, "XP arrived");
    // at least, not exactly: the fight's random loot can also hold Stimpaks
    const stim1 = s.chars[0].inv.filter((l) => l.n === "Stimpak").reduce((t, l) => t + l.q, 0);
    assert.ok(stim1 >= stim0 + 2, `the DM's added loot arrives: had ${stim0}, now ${stim1}`);
    assert.ok(s.chars[0].inv.length > 0);
    assert.strictEqual(await page.locator(".w-enc.closed").count(), 1, "back to the normal screen with no map");
    assert.deepStrictEqual(s.scene.npcs, []);
  });
  await ok("Vendor: tier, barter, buy and sell, no unique weapons", async () => {
    await page.evaluate(() => { S.chars[0].caps = 1000; S.chars[0].level = 1; ui.sel = "c1"; render(); });
    assert.strictEqual(await page.locator('.w-vendor [data-a="venBarter"]').count(), 8, "eight barter levels");
    await click("venTier", "3");
    let v = (await state()).vendor; assert.strictEqual(v.tier, 3);
    for (const l of v.stock) { const r = await page.evaluate((n) => { const it = E.get(ctx(), n); return [Number(it.o.tier), it.cat === "weapon" && E.isUnique(it.o)]; }, l.n); assert.ok(r[0] >= 2 && r[0] <= 3 && !r[1], `${l.n} tier ${r[0]}`); }
    const buyAt = async () => { const row = page.locator('.w-vendor tr', { has: page.locator('[data-a="venBuy"]') }).first(); return Number((await row.locator("td").nth(3).innerText()).replace("~", "")); };
    await click("venBarter", "100"); const dear = await buyAt();
    await click("venBarter", "10"); const cheap = await buyAt();
    assert.ok(dear > cheap, `barter changes price: ${dear} vs ${cheap}`);
    const caps0 = (await state()).chars[0].caps; const name = (await state()).vendor.stock[0].n;
    await page.locator('[data-a="venBuy"]').first().click();
    let s = await state(); assert.strictEqual(s.chars[0].caps, caps0 - cheap); assert.ok(s.chars[0].inv.some((l) => l.n === name), "item arrives");
    await click("venTab", "sell");
    const invN = s.chars[0].inv.reduce((t, l) => t + l.q, 0);
    await page.locator('[data-a="venSell"]').first().click();
    s = await state(); assert.strictEqual(s.chars[0].inv.reduce((t, l) => t + l.q, 0), invN - 1); assert.ok(s.chars[0].caps >= caps0 - cheap, "caps come back");
    await click("venTab", "buy"); await click("venRoll");
    await page.evaluate(() => undo());
  });
  await ok("Level up from the queue", async () => {
    await page.evaluate(() => { S.chars[0].xp = 100; render(); });
    await page.locator('[data-a="levelUp"][data-v="c1"]').click();
    await has("now level 2"); await has("SKILL POINTS TO ASSIGN", ".dialog"); await has("Pick a level perk", ".dialog");
    assert.strictEqual((await state()).chars[0].perkDue, 1, "an even level owes a perk");
    let s = await state(); const bank = s.chars[0].ptsBank; assert.ok(bank > 0);
    await page.locator('[data-a="spend"][data-v="c1|BG|1"]').click();
    s = await state(); assert.strictEqual(s.chars[0].ptsBank, bank - 1); assert.strictEqual(s.chars[0].spent.BG, 1);
    assert.strictEqual(await page.evaluate(() => der(S.chars[0]).skills.BG), 13, "tagged skill gets 2 per point");
    await page.locator('[data-a="spend"][data-v="c1|BAR|5"]').click();
    s = await state(); assert.strictEqual(s.chars[0].ptsBank, bank - 6, "+5 spends five");
    await page.fill("#lvlPerkAny", await page.evaluate(() => DATA.levelPerks.find((p) => p.n).n)); await press("Enter");
    assert.strictEqual((await state()).chars[0].perkDue, 0, "the perk is picked");
    await press("Escape");
    await has("Assign:", '[data-card="c1"]');
    await page.evaluate(() => { S.chars[0].level = 3; }); await page.evaluate(() => { S.chars[0].xp = 100000; render(); });
    await page.locator('[data-a="levelUp"][data-v="c1"]').click();
    assert.strictEqual((await state()).chars[0].perkDue || 0, 1, "level 4 owes another");
    await page.evaluate(() => undo()); await page.evaluate(() => { S.chars[0].level = 2; S.chars[0].xp = 100; render(); });
  });
  await ok("Defeat removes what the DM chooses", async () => {
    await blur(); await press("b"); await page.focus("#enemyQ"); await type("mole rat"); await press("Enter"); await press("Escape");
    await blur(); await press("b"); await page.locator('[data-a="beginRounds"]').click(); await blur();
    await click("defeat"); await has("Defeat");
    const n0 = (await state()).chars[0].inv.length;
    await page.locator('[data-a="defMark"][data-v="c1|all"]').click(); await blur();
    await click("finishDefeat");
    const s = await state();
    assert.strictEqual(s.chars[0].inv.length, 0); assert.ok(n0 > 0); assert.strictEqual(s.combat, null);
  });
  await ok("Notes: box at bottom left, old ones from the column, first 15 characters otherwise", async () => {
    await page.fill("#qnText", "Quick thought from the box"); await page.waitForTimeout(20);
    assert.strictEqual((await state()).notesList[0].text, "Quick thought from the box");
    await click("noteNew"); assert.strictEqual(await page.inputValue("#qnText"), "");
    await page.evaluate(() => { S.notesList = []; ui.noteId = null; render(); });
    await rail("notes"); await has("Recent", ".dialog");
    await type("The raiders at the dam owe someone money"); await page.waitForTimeout(20);
    await has("The raiders at ...", ".nlist");
    await page.locator('.dialog [data-a="noteNew"]').click();
    await page.fill("#noteSubj", "Quest hook"); await page.fill("#noteText", "Find the caravan"); await page.waitForTimeout(20);
    await has("Quest hook", ".nlist");
    assert.strictEqual((await state()).notesList.length, 2);
    await page.locator('.nlist [data-a="noteOpen"]').last().click();
    assert.match(await page.inputValue("#noteText"), /raiders at the dam/);
    await page.locator('[data-a="noteDel"]').click();
    assert.strictEqual((await state()).notesList.length, 1);
    await press("Escape"); await blur();
  });
  await ok("Search: arrows move, Enter opens", async () => {
    await press("/"); await type("stimp"); await page.waitForTimeout(30);
    await has("Stimpak", ".dialog"); await press("ArrowDown");
    assert.strictEqual(await page.evaluate(() => ui.modal.i), 1);
    await press("Enter"); assert.strictEqual(await page.evaluate(() => ui.modal.type), "detail"); await press("Escape");
  });
  await ok("Dev windows: every list opens as an editable table", async () => {
    for (const id of ["items", "weapons", "armor", "ammo", "mods", "materials", "recipes", "enemies", "traits", "perks", "statuses"]) {
      await page.locator(`[data-a="dev"][data-v="${id}"]`).click();
      assert.ok(await page.locator(".dialog table.t tr").count() > 2, `${id} has rows`);
      await press("Escape");
    }
    await page.locator('[data-a="dev"][data-v="weapons"]').click();
    await page.locator('[data-a="devClass"][data-v="EW"]').click();
    await page.fill("#devQ", "Pipe Flamer");
    await page.waitForTimeout(30);
    const box = page.locator('[data-ov="pipe flamer|dmg|num"]');
    await box.fill("99"); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual(await page.evaluate(() => E.get(ctx(), "Pipe Flamer").o.dmg), 99);
    await has("Reset", ".dialog"); await press("Escape");
  });
  await ok("Tables export, and import when the format matches", async () => {
    for (const id of ["items", "weapons", "armor", "ammo", "mods", "materials", "recipes", "enemies", "traits", "perks", "statuses", "loot"]) {
      await click("dev", id);
      assert.ok(await page.locator(`[data-a="tableExport"][data-v="${id}|csv"]`).count(), `${id} exports`);
      assert.ok(await page.locator("#tableFile").count(), `${id} imports`);
      await press("Escape");
    }
    await click("dev", "items");
    const [dl] = await Promise.all([page.waitForEvent("download"), click("tableExport", "items|csv")]);
    const csv = fs.readFileSync(await dl.path(), "utf8");
    const n = await page.evaluate(() => DATA.items.length);
    const back = await page.evaluate((t) => fromCsv(t), csv);
    assert.strictEqual(back.length, n, "a CSV round trip keeps every row");
    assert.deepStrictEqual(back.find((r) => r.n === "Bandage").use.reduces, { Bleeding: 1 }, "and the variables");
    const edited = csv.replace(/^Bandage,/m, "Super Bandage,");
    const file = path.join(require("os").tmpdir(), "fallout-items-test.csv"); fs.writeFileSync(file, edited);
    await page.setInputFiles("#tableFile", file); await page.waitForTimeout(120);
    assert.ok(await page.evaluate(() => DATA.items.some((i) => i.n === "Super Bandage")), "the replacement is live");
    assert.ok(await page.evaluate(() => !!E.get(ctx(), "Super Bandage")), "and usable");
    fs.writeFileSync(file, "n,nonsense\nThing,1\n"); const before = await page.evaluate(() => DATA.items.length);
    await page.setInputFiles("#tableFile", file); await page.waitForTimeout(120);
    assert.strictEqual(await page.evaluate(() => DATA.items.length), before, "a wrong format is refused");
    await click("tableReset", "items"); await page.waitForTimeout(30);
    assert.ok(await page.evaluate(() => DATA.items.some((i) => i.n === "Bandage")), "back to the workbook");
    await press("Escape");
    await click("dev", "variables"); await has("dmgTaken", ".dialog"); await has("Not converted", ".dialog"); await press("Escape");
  });
  await ok("Drugs apply statuses with the workbook's numbers, and hangovers follow", async () => {
    const r = await page.evaluate(() => {
      const c = S.chars[3]; c.statuses = []; c.effects = []; const base = der(c).sp.S;
      c.inv.push({ n: "Beer - 714 Beer", q: 1 }); ui.modal = { type: "item", who: c.id, tgt: c.id, sel: c.inv.length - 1 }; ACT.itemUse();
      const names = c.statuses.map((x) => x.n); const str = der(c).sp.S - base;
      ACT.rest(); const after = c.statuses.map((x) => x.n); c.statuses = []; render();
      return { names, str, after };
    });
    assert.deepStrictEqual(r.names, ["Loose", "Drunk"]); assert.strictEqual(r.str, 1, "+1 STR once, not twice"); assert.deepStrictEqual(r.after, ["Hangover"]);
    const noCover = await page.evaluate(() => !DATA.statuses.some((x) => x.n === "Cover")); assert.ok(noCover);
  });
  await ok("Accepted guesses and category defaults are applied", async () => {
    const r = await page.evaluate(() => { const by = (n) => DATA.items.find((i) => i.n === n).use.applies.map((a) => a.n); return [by("Whiskey"), by("Nuka Cola Cherry" in {} ? "x" : "Nuka Cherry"), by("Mentats")]; });
    assert.deepStrictEqual(r, [["Loose", "Drunk"], ["Caffenated"], ["Bliss"]]);
  });
  await ok("Energy weapons import with their AP and burst count", async () => {
    const w = await page.evaluate(() => DATA.weapons.find((x) => x.n === "Pipe Flamer"));
    assert.ok(w.ap > 0, "AP"); assert.ok(w.count >= 1, "Count"); assert.ok(w.ok, "has stats");
  });
  await ok("Loot tables, data report and raw state open", async () => {
    await page.locator('[data-a="dev"][data-v="loot"]').click(); await has("d20", ".dialog");
    await page.fill("#lt-19", "2"); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual((await state()).rules.lootTable[19][1], 2); await press("Escape");
    await page.locator('[data-a="dev"][data-v="report"]').click(); await has("Duplicate names", ".dialog"); await press("Escape");
    await page.locator('[data-a="dev"][data-v="state"]').click(); assert.ok((await page.inputValue("#rawState")).includes("Character 1")); await press("Escape");
  });
  await ok("Settings edit game rules", async () => {
    await rail("settings");
    await page.fill('[data-rule="maxHit"]', "90"); await press("Tab"); await page.waitForTimeout(30);
    assert.strictEqual((await state()).rules.maxHit, 0.9);
    await page.fill('[data-rule="maxHit"]', "95"); await press("Tab"); await page.waitForTimeout(30); await press("Escape");
  });
  await ok("Autosave window and interval", async () => {
    await rail("autoWin"); await page.selectOption("#pInt", "30"); await page.waitForTimeout(30);
    assert.strictEqual(await page.evaluate(() => prefs.interval), 30);
    await page.locator('[data-a="autoToggle"][data-v=""]').click();
    assert.strictEqual(await page.evaluate(() => prefs.autosave), false);
    await press("Escape"); await blur(); await click("rest");
    assert.ok(await page.locator("#railSave.dirty").count(), "the rail shows unsaved changes");
    await rail("saveNow");
    assert.strictEqual(await page.locator("#railSave.dirty").count(), 0);
    await rail("autoWin"); await page.locator('[data-a="autoToggle"][data-v="1"]').click(); await page.selectOption("#pInt", "0"); await page.waitForTimeout(30); await press("Escape");
  });
  await ok("Load save: slots save, load, rename and delete", async () => {
    await page.evaluate(() => { S.chars[0].name = "Slot Name"; render(); });
    await rail("saveNow");
    await page.evaluate(() => { S.chars[0].name = "Changed Later"; render(); });
    await rail("loadWin"); await has("Load save", ".dialog"); await has("Autosave", ".dialog");
    await page.locator('.dialog [data-a="slotLoad"]').first().click();
    assert.strictEqual((await state()).chars[0].name, "Slot Name");
    assert.strictEqual(await page.locator(".dialog").count(), 0, "the window closes");
    await page.evaluate(() => undo());
    assert.strictEqual((await state()).chars[0].name, "Changed Later", "undo goes back");
    await rail("loadWin"); await page.locator('[data-a="slotNew"]').click();
    assert.strictEqual(await page.evaluate(() => slots().length), 2);
    await page.locator('.dialog [data-a="slotDel"]').first().click();
    assert.strictEqual(await page.evaluate(() => slots().length), 1);
    await press("Escape");
    await page.evaluate(() => { S.chars[0].name = "Character 1"; render(); });
  });
  await ok("Wiki opens the game bible", async () => {
    const [popup] = await Promise.all([context.waitForEvent("page"), page.locator('.rail [data-v="wiki"]').click()]);
    assert.ok(popup.url().startsWith("blob:") || popup.url().endsWith(".pdf"), popup.url());
    await popup.close();
  });
  await ok("Autosave survives a reload", async () => {
    await page.evaluate(() => { act("t", () => {}); });
    await page.reload();
    const s = await state();
    assert.strictEqual(s.chars[0].level, 2);
    assert.ok(s.overrides["pipe flamer"]);
  });
  await ok("Save pack: a real zip with campaign and tables, and edits come back", async () => {
    await rail("loadWin");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('[data-a="exportSave"]').click()]);
    assert.match(dl.suggestedFilename(), /\.zip$/);
    const p = await dl.path(); const bytes = fs.readFileSync(p); assert.strictEqual(bytes.slice(0, 2).toString(), "PK");
    const files = await page.evaluate(async (b) => readZip(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer), bytes.toString("base64"));
    for (const n of ["readme.txt", "campaign.json", "rules.json", "tables/items.csv", "tables/weapons.csv", "tables/armor.csv", "tables/perks.csv", "tables/traits.csv", "tables/statuses.csv", "tables/effects.csv", "tables/enemies.csv"]) assert.ok(files[n], `pack has ${n}`);
    assert.strictEqual(JSON.parse(files["campaign.json"]).chars.length, 4);
    await page.evaluate(() => { S.chars[0].name = "Changed"; render(); });
    await page.setInputFiles("#importFile", p); await page.waitForTimeout(250);
    let s = await state(); assert.strictEqual(s.chars[0].name, "Character 1"); assert.deepStrictEqual(Object.keys(s.tables), [], "unedited tables aren't stored");
    // Edit a table the way someone would: change a value, re-compress with deflate as WinRAR or Windows would, load it.
    const zlib = require("zlib"); const edited = { ...files, "tables/items.csv": files["tables/items.csv"].replace(/^Bandage,/m, "Pack Bandage,") };
    const le = (n, z) => { const b = Buffer.alloc(z); b.writeUIntLE(n, 0, z); return b; }; const crc = require("zlib").crc32 || null;
    const parts = [], cen = []; let off = 0;
    for (const [name, text] of Object.entries(edited)) {
      const raw = Buffer.from(text), def = zlib.deflateRawSync(raw), nm = Buffer.from(name);
      const c = crc ? crc(raw) : 0; const common = Buffer.concat([le(20, 2), le(0, 2), le(8, 2), le(0, 2), le(0x21, 2), le(c, 4), le(def.length, 4), le(raw.length, 4), le(nm.length, 2), le(0, 2)]);
      const head = Buffer.concat([le(0x04034b50, 4), common, nm]); parts.push(head, def);
      cen.push(Buffer.concat([le(0x02014b50, 4), le(20, 2), common, le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), nm])); off += head.length + def.length;
    }
    const cd = Buffer.concat(cen); const n = Object.keys(edited).length;
    const zipFile = path.join(require("os").tmpdir(), "fallout-pack-test.zip");
    fs.writeFileSync(zipFile, Buffer.concat([...parts, cd, le(0x06054b50, 4), le(0, 2), le(0, 2), le(n, 2), le(n, 2), le(cd.length, 4), le(off, 4), le(0, 2)]));
    await page.setInputFiles("#importFile", zipFile); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => DATA.items.some((i) => i.n === "Pack Bandage")), "the edit from the pack is live");
    s = await state(); assert.deepStrictEqual(Object.keys(s.tables), ["items"], "only the edited table is kept");
    await page.evaluate(() => undo()); await page.waitForTimeout(50);
    assert.ok(await page.evaluate(() => !DATA.items.some((i) => i.n === "Pack Bandage")), "Undo reverses a pack");
    await page.evaluate(() => { ui.modal = null; render(); });
  });
  await ok("A save from before the map still opens", async () => {
    const old = await page.evaluate(() => { const o = JSON.parse(JSON.stringify(S)); o.scene = { time: "Daytime", weather: "Clear", env: "Grassland", effects: [], picks: [{ n: "Gecko", count: 2, range: 5 }], checks: {} }; return normalize(o); });
    assert.deepStrictEqual(old.scene.npcs, []); assert.strictEqual(old.scene.picks, undefined); assert.deepStrictEqual(old.scene.objects, []);
    const notes = await page.evaluate(() => { const o = JSON.parse(JSON.stringify(S)); o.notes = "old text"; o.notesList = undefined; return normalize(o).notesList; });
    assert.strictEqual(notes[0].text, "old text", "old notes carry over");
  });
  await ok("Tutorial opens from the column and pages through", async () => {
    await rail("guide"); await has("How to use this", ".dialog");
    const n = await page.locator('.dialog .opts [data-a="guideGo"]').count(); assert.ok(n >= 6);
    await press("Enter"); await has("Party cards", ".guide,.dialog");
    await press("Escape");
  });
  await ok("New campaign saves if asked, wipes everything, and walks through creating a character", async () => {
    await rail("newc"); await has("save the current campaign", ".dialog");
    await click("closeModal", ""); assert.strictEqual((await state()).chars.length, 4, "cancel changes nothing");
    await page.evaluate(() => { S.chars[0].name = "Old Run"; S.rules.maxHit = 0.5; S.overrides.stimpak = { lb: 9 }; S.notesList.push({ id: "n", subject: "x", text: "x", at: 1 }); S.vendor.tier = 6; render(); });
    await rail("newc"); await click("newStart", "save");
    const saved = await page.evaluate(() => slots()[0].id);
    assert.strictEqual(await page.evaluate((i) => JSON.parse(localStorage.getItem("fallout-dm-slot-" + i)).chars[0].name, saved), "Old Run", "the old campaign is in the save");
    let s = await state();
    assert.strictEqual(s.chars.length, 0); assert.strictEqual(s.rules.maxHit, 0.95, "rules reset"); assert.deepStrictEqual(s.overrides, {}, "item edits reset"); assert.deepStrictEqual(s.notesList, []); assert.strictEqual(s.vendor.tier, 1); assert.deepStrictEqual(s.log, []);
    await has("Archetype", ".dialog");
    assert.strictEqual(await page.locator(".dialog .arch").count(), 20, "twenty archetypes");
    await click("wizGo", "1"); assert.strictEqual(await page.evaluate(() => ui.wiz.step), 0, "must pick an archetype");
    await page.fill("#wizName", "Sarge"); await page.locator(".dialog .arch", { hasText: "Veteran Conscript" }).click();
    await click("wizGo", "1"); await has("POINTS LEFT", ".dialog");
    assert.deepStrictEqual(await page.evaluate(() => ui.wiz.special), [5, 5, 5, 5, 5, 5, 5]);
    for (let i = 0; i < 7; i++) await click("wizStat", "0|1");
    assert.strictEqual(await page.evaluate(() => ui.wiz.special.reduce((a, b) => a + b, 0)), 40, "capped at 40 in total");
    await click("wizGo", "2"); await has("Rolled for you", ".dialog");
    const r0 = await page.evaluate(() => ui.wiz.rolled);
    await click("wizReroll"); assert.notStrictEqual(await page.evaluate(() => ui.wiz.rolled), r0, "reroll changes it");
    assert.strictEqual(await page.locator('[data-a="wizReroll"]').count(), 0, "only one reroll");
    await click("wizGo", "3"); assert.strictEqual(await page.evaluate(() => ui.wiz.step), 2, "must pick two traits");
    const two = await page.evaluate(() => DATA.traits.filter((t) => t.code !== ui.wiz.rolled).slice(0, 2).map((t) => t.code));
    await page.selectOption("#wizP0", two[0]); await page.waitForTimeout(20); await page.selectOption("#wizP1", two[1]); await page.waitForTimeout(20);
    await click("wizGo", "3"); await has("Tag three skills", ".dialog");
    for (const k of ["SG", "MED", "SUR"]) await click("wizTag", k);
    await click("wizTag", "SNK"); assert.strictEqual((await page.evaluate(() => ui.wiz.tags)).length, 3, "only three");
    await click("wizGo", "4"); await has("Starting kit", ".dialog"); await has("Single Rifle", ".dialog");
    await click("wizAdd");
    s = await state(); const c = s.chars[0];
    assert.strictEqual(c.name, "Sarge"); assert.strictEqual(c.background, "Veteran Conscript"); assert.strictEqual(c.special.reduce((a, b) => a + b, 0), 40);
    assert.strictEqual(c.traits.length, 3); assert.strictEqual(c.tags.length, 3); assert.strictEqual(c.gear.vanity, "Field Hand Outfit");
    assert.strictEqual(c.weapons[0].n, "Single Rifle"); assert.strictEqual(c.weapons[1].n, "Basic Fighting");
    const rounds = (c.weapons[0].mag || 0) + c.inv.filter((l) => /5\.56/.test(l.n)).reduce((t, l) => t + l.q, 0);
    assert.strictEqual(rounds, 8, "kit ammo, nothing more"); assert.ok(c.inv.some((l) => l.n === "Bandage")); assert.ok(c.weapons[0].mag > 0, "starts loaded");
    assert.strictEqual(c.caps, 0, "poverty");
    await has("Party so far: 1", ".dialog"); await click("wizAnother"); assert.strictEqual(await page.evaluate(() => ui.wiz.step), 0); await press("Escape");
    await page.evaluate(() => undo()); await page.evaluate(() => undo());
    assert.strictEqual((await state()).chars.length, 4, "Undo brings the old campaign back");
    await page.evaluate(() => { S.chars[0].name = "Character 1"; S.rules.maxHit = 0.95; delete S.overrides.stimpak; ui.sel = "c1"; ui.modal = null; render(); });
  });
  await ok("Healing items don't stand up a downed character", async () => {
    const r = await page.evaluate(() => { const c = S.chars[1]; c.inv.push({ n: "Stimpak", q: 1 }); c.hp = 0; c.dbno = true; ui.modal = { type: "item", who: c.id, tgt: c.id, sel: c.inv.length - 1 }; render(); const warn = document.querySelector(".dialog").innerText; ACT.itemUse(); const out = [c.hp, c.dbno, /Revive/.test(warn)]; c.dbno = false; c.hp = der(c).hp; render(); return out; });
    assert.deepStrictEqual(r, [0, true, true]);
  });
  await ok("Keys list opens", async () => { await page.keyboard.press("?"); await has("End turn", ".dialog"); await press("Escape"); });
  await ok("Phones: every panel shows, panels fold, the map loads, Save offers a file", async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p2 = await ctx2.newPage();
    await p2.goto(APP); await p2.waitForTimeout(200);
    const hs = await p2.evaluate(() => [...document.querySelectorAll(".win")].map((w) => [w.className.split(" ")[1], w.getBoundingClientRect().height]));
    assert.ok(hs.every(([, h]) => h > 30), "no squeezed panels: " + JSON.stringify(hs));
    await p2.locator(".w-party .foldbtn").tap(); await p2.waitForTimeout(30);
    assert.ok(await p2.locator(".w-party.folded").count(), "tapping the fold button folds the panel");
    assert.ok((await p2.locator(".w-party").boundingBox()).height < 60);
    await p2.locator(".w-party .foldbtn").tap(); await p2.waitForTimeout(30);
    assert.strictEqual(await p2.locator(".w-party.folded").count(), 0, "and opens it again");
    await p2.locator(".w-notes .wt").tap({ position: { x: 120, y: 12 } }); await p2.waitForTimeout(30);
    assert.ok(await p2.locator(".w-notes.folded").count(), "tapping the header works too"); await p2.locator(".w-notes .foldbtn").tap();
    const pad = await p2.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    assert.ok(pad >= 90, "room under the last button for the browser toolbar: " + pad);
    assert.strictEqual(await p2.locator(".devlist").isVisible(), false, "Dev buttons start folded"); await p2.locator(".devtoggle").click(); assert.ok(await p2.locator(".devlist").isVisible());
    await p2.evaluate(() => { ui.setup = true; render(); });
    assert.ok((await p2.locator("#map").boundingBox()).height > 200, "the map has room");
    let asked = ""; p2.on("dialog", (d) => { asked = d.message(); d.dismiss(); });
    await p2.evaluate(() => ACT.saveNow()); await p2.waitForTimeout(50);
    assert.match(asked, /save a copy to your device/i);
    await ctx2.close();
  });
  await ok("UI size: six steps from the right column, remembered, and the layout keeps fitting", async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p2 = await ctx2.newPage(); await p2.goto(APP);
    await p2.locator('[data-a="railGo"][data-v="uiScale"]').click();
    assert.deepStrictEqual(await p2.locator('[data-a="setScale"]').allTextContents(), ["200%", "150%", "100%", "75%", "50%", "25%"]);
    await p2.locator('[data-a="setScale"][data-v="2"]').click(); await p2.waitForTimeout(50);
    assert.strictEqual(await p2.evaluate(() => getComputedStyle(document.documentElement).zoom), "2");
    assert.ok(await p2.evaluate(() => document.documentElement.classList.contains("lt1000")), "200% on a 1440 screen gets the stacked layout");
    assert.strictEqual(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scroll");
    await p2.reload(); assert.strictEqual(await p2.evaluate(() => prefs.uiScale), 2, "remembered after a reload");
    await p2.evaluate(() => ACT.setScale(0.5)); assert.ok(await p2.evaluate(() => !document.documentElement.classList.contains("lt1000")));
    const d = await p2.evaluate(() => document.querySelector(".dash").getBoundingClientRect().height); assert.ok(Math.abs(d - 900) < 4, "50% still fills the screen: " + d);
    await ctx2.close();
  });
  await ok("The hosted copy starts a fresh campaign on the wizard", async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p2 = await ctx2.newPage();
    await p2.goto("file:///" + path.resolve(__dirname, "../../index.html").replace(/\\/g, "/"));
    assert.deepStrictEqual(await p2.evaluate(() => [S.chars.length, ui.modal && ui.modal.type, S.log.length]), [0, "wizard", 0]);
    assert.match(await p2.locator(".dialog").innerText(), /archetype/i);
    await p2.reload(); assert.strictEqual(await p2.evaluate(() => S.chars.length), 0, "still opens after a reload"); await ctx2.close();
  });
  await browser.close();
  for (const r of results) console.log(r.join("  "));
  const fails = results.filter((r) => r[0] === "FAIL");
  console.log(`\n${results.length - fails.length}/${results.length} passed`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { for (const r of results) console.log(r.join("  ")); console.error(e); process.exit(2); });
