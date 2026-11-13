// ===== 09-actions.js: EVERY BUTTON. ACT holds one function per data-a name; a button with data-a="x" data-v="y" calls ACT.x("y").
// To add a button: give it data-a and data-v in the HTML, and add the function here. Wrap changes to S in act(label, fn) so Undo works.
// ---------- actions
const splitV = (v) => String(v).split("|");
const ACT = {
  noop() {},
  undo,
  redo,
  help() {
    ui.modal = { type: "help" };
    render();
  },
  table() {
    ui.modal = { type: "table" };
    render();
  },
  async openSession() {
    toast("Opening a session...");
    let j;
    try {
      j = await (await fetch(RELAY + "/new", { method: "POST" })).json();
    } catch (e) {
      return toast("Could not reach the session server. Check the internet connection.");
    }
    history.replaceState(null, "", `?room=${j.room}&t=${j.t}`); // a reload rejoins
    await tableJoin();
    ACT.table();
  },
  leaveSession() {
    location.href = location.pathname; // this device keeps the campaign in its own autosave
  },
  tableCopy(v) {
    const el = document.getElementById("tableLink" + v);
    el.select();
    // navigator.clipboard needs https, and the Wi-Fi link is plain http
    toast(document.execCommand("copy") ? "Link copied" : "Select the link and copy it");
  },
  search(v) {
    ui.modal = { type: "search", q: v || "", i: 0 };
    ui.focus = "#searchQ";
    render();
  },
  dev(v) {
    ui.modal = { type: "dev", cat: v, q: "", page: 0, sort: null, dir: 1, cls: "SG", raw: v === "state" ? JSON.stringify(S, null, 1) : "" };
    ui.focus = v === "state" ? "#rawState" : v === "variables" ? null : "#devQ";
    render();
  },
  devClass(v) {
    Object.assign(ui.modal, { cls: v, page: 0, sort: null });
    render();
  },
  devPage(v) {
    ui.modal.page = (ui.modal.page || 0) + Number(v);
    render();
  },
  devSort(v) {
    const m = ui.modal;
    if (m.sort === v) m.dir = -(m.dir || 1);
    else {
      m.sort = v;
      m.dir = 1;
    }
    render();
  },
  rawReload() {
    ui.modal.raw = JSON.stringify(S, null, 1);
    render();
  },
  rawApply() {
    let p;
    try {
      p = normalize(JSON.parse(ui.modal.raw));
    } catch (e) {
      return toast(e.message || "That isn't valid JSON.");
    }
    act("Edit raw state", () => {
      S = p;
      ui.modal = null;
    });
    toast("Raw state applied");
  },
  closeModal() {
    const hadAtk = ui.atk;
    ui.modal = (ui.modal && ui.modal.back) || null;
    if (hadAtk && K()) ui.focus = "#roll";
    render();
  },
  saveNow() {
    let list = slots();
    let cur = list.find((x) => x.id === prefs.slot);
    if (!cur) {
      cur = { id: "s" + Date.now().toString(36), name: `Save ${list.length + 1}` };
      prefs.slot = cur.id;
      savePrefs();
    }
    const ok = writeSlot(cur.id, cur.name);
    save();
    toast(ok && !saveFailed ? `Saved: ${cur.name}` : "Save failed. Browser storage may be full. Save a pack.");
    // then ask where else to keep it: the file this session saves to, a new place, or nowhere
    ui.modal = { type: "saveTo", slot: cur.name, ok: ok && !saveFailed };
    render();
  },
  autoToggle(v) {
    prefs.autosave = !!v;
    savePrefs();
    if (prefs.autosave && dirty && !prefs.interval) save();
    render();
  },
  wiki() {
    const b = document.getElementById("wiki").textContent.trim();
    if (!b || b.startsWith("/*")) return void window.open("Fallout TTRPG Game Bible.pdf", "_blank");
    // one copy of the bible for the whole session: every click opens the same link
    if (!ACT.wiki.url) ACT.wiki.url = URL.createObjectURL(new Blob([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))], { type: "application/pdf" }));
    window.open(ACT.wiki.url, "_blank");
  },
  exportSave() {
    // A pack: a normal .zip you can open, edit and pass around. Campaign and rules as JSON, every table as a spreadsheet.
    const blob = new Blob([makeZip(packFiles())], { type: "application/zip" });
    const name = `fallout-pack-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.zip`;
    const download = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      toast("Pack saved");
    };
    // the share sheet is how iOS and Android offer "Save to Files"; desktops just download
    const file = typeof File === "function" ? new File([blob], name, { type: "application/zip" }) : null;
    if (file && matchMedia("(pointer: coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).then(
        () => toast("Pack saved"),
        (err) => {
          if (err && err.name !== "AbortError") download();
        },
      );
      return;
    }
    download();
  },
  importSave() {
    // where the browser allows it, open with a picker so later saves can go back to the same file
    if (typeof window.showOpenFilePicker !== "function") return document.getElementById("importFile").click();
    window
      .showOpenFilePicker({ types: [{ description: "Fallout DM pack or backup", accept: { "application/zip": [".zip"], "application/json": [".json"] } }] })
      .then(
        async ([fh]) => readImport(await fh.getFile(), fh),
        (err) => {
          if (err && err.name !== "AbortError") document.getElementById("importFile").click();
        },
      );
  },
  saveToFile(v) {
    if (v === "same" && packFile) {
      writePack(packFile).then(
        () => toast(`Saved to ${packFile.name}`),
        (err) => toast(err.message || "Couldn't write that file."),
      );
      ui.modal = null;
      return render();
    }
    if (!matchMedia("(pointer: coarse)").matches && typeof window.showSaveFilePicker === "function") {
      window
        .showSaveFilePicker({ suggestedName: packName(), types: [{ description: "Fallout DM pack", accept: { "application/zip": [".zip"] } }] })
        .then((fh) => {
          packFile = fh;
          return writePack(fh);
        })
        .then(
          () => toast(`Saved to ${packFile.name}. This session will save there.`),
          (err) => {
            if (err && err.name !== "AbortError") toast(err.message || "Couldn't save there.");
          },
        );
    } else ACT.exportSave();
    ui.modal = null;
    render();
  },
  throwStart(v) {
    const [id, item] = splitV(v);
    ui.throwing = { id, item, at: null };
    ui.modal = null;
    toast(`Click the map where the ${item} lands`);
    render();
  },
  throwCancel() {
    ui.throwing = null;
    render();
  },
  throwConfirm() {
    const T = ui.throwing;
    if (!T || !T.at) return;
    const A = ent(T.id);
    const t = S.rules.throwables[T.item];
    const k = K();
    const line = (A.inv || []).find((l) => l.n === T.item);
    if (!line) {
      ui.throwing = null;
      return toast(`${A.name} has no ${T.item} left.`);
    }
    if (k && fightPhase() && !canPay(A, t.ap, `throw the ${T.item}`)) return;
    const thrown = dist(posOf(A.id), T.at);
    if (t.range && thrown > t.range) return toast(`Too far: a ${T.item} reaches ${t.range}m.`);
    // it lands anywhere inside the spread around the spot picked, every point as likely as any other
    const spread = throwSpread(A),
      turn = Math.random() * 2 * Math.PI,
      off = spread * Math.sqrt(Math.random());
    const land = inMap({ x: E.fix(T.at.x + Math.cos(turn) * off), y: E.fix(T.at.y + Math.sin(turn) * off) });
    const from = { ...posOf(A.id) };
    const hits = blastHits(land, t);
    act(`Throw: ${T.item}`, () => {
      if (k && fightPhase()) A.ap = Math.max(0, (A.ap || 0) - t.ap);
      line.q--;
      if (line.q <= 0) A.inv = A.inv.filter((x) => x !== line);
      const start = S.log.length;
      log(
        "hit o-hit",
        `${A.name} throws ${T.item} ${thrown.toFixed(1)}m · lands ${dist(land, T.at).toFixed(1)}m off · ${t.ap} AP · ${hits.map((x) => `${x.e.name} ${fmt(x.d)}m: ${x.dmg}`).join(", ") || "nobody in the blast"}`,
      );
      for (const x of hits) {
        x.e.hp = Math.max(0, (x.e.hp || 0) - x.dmg);
        syncDown(x.e, A.id);
        log("hit", `${x.e.name} ${x.e.hp}/${der(x.e).hp} HP after the blast`);
        if (t.bleed && x.dmg > 0 && x.e.hp > 0 && db.status.has("bleeding")) {
          const ring = Math.max(0, Math.ceil(x.d - 1e-9) - 1); // 0 in the innermost meter
          const tier = clamp((S.rules.blastBleedMax || 5) - ring, 1, 5);
          const cur = (x.e.statuses || []).find((q) => q.n === "Bleeding");
          keepFull(x.e, () => addStatus(x.e, "Bleeding", Math.max(tier, cur ? cur.tier : 0)));
          const now = (x.e.statuses || []).find((q) => q.n === "Bleeding");
          if (now) log("status", `${x.e.name} gains Bleeding ${now.tier}: shrapnel ${fmt(x.d)}m from the blast.`);
        }
      }
      for (const o of [...S.scene.objects]) {
        const d = Math.max(0, dist(o, land) - Math.max(o.w || 1, o.h || 1) / 2);
        hurtObj(o, E.fix(E.blastDamage(t, d) * (S.rules.objBlastMul || 1) * coverTake(o)), `the ${T.item}`);
      } // explosives wreck cover
      if (S.rules.storyLog) {
        const nm = (e) => (e.kind !== "pc" && / - /.test(e.name) ? e.name.split(" - ").slice(1).join(" - ") : e.name);
        const list = hits.map((x) => `${nm(x.e)} for ${x.dmg} DMG`);
        const tail = hits.filter((x) => x.e.hp <= 0).map((x) => `${nm(x.e)} ${x.e.kind === "pc" ? "goes down" : "is torn apart"}`);
        const story = hits.length
          ? `${nm(A)}'s ${T.item} hits ${list.length > 1 ? list.slice(0, -1).join(", ") + " and " + list[list.length - 1] : list[0]}${tail.length ? `, and ${tail.join(" and ")}` : ""}.`
          : `${nm(A)} throws a ${T.item}, but the blast catches nobody.`;
        const more = S.log.splice(start).map((l) => l.x);
        S.log.push({ k: `story o-${hits.length ? "hit" : "miss"}`, x: story, r: k ? k.round : 0, id: S.seq++, more });
      }
    });
    addFx({ type: "throw", from, aim: { ...T.at }, to: land, spread, radius: t.radius, dur: 1400 });
    ui.throwing = null;
    render();
  },
  pick(v) {
    const e = ent(v);
    if (!e) return;
    const cb = cbOf(v);
    if (ui.atk) {
      if (v !== ui.atk.att && (!cb || alive(cb))) {
        ui.atk.tgt = v;
        ui.atk.err = "";
        ui.atk.res = null;
        ui.focus = "#roll";
        return render();
      }
    } else if (fightPhase() && actorId() && actorId() !== v && sideOf(v) !== sideOf(actorId()) && cb && alive(cb)) return openAttack(actorId(), v);
    ACT.select(v);
  },
  select(v) {
    const e = ent(v);
    if (!e) return;
    ui.rowSel = v;
    if (e.kind === "pc") ui.sel = v;
    ui.mapSel = null;
    render();
  },
  setupOpen(v) {
    ui.setup = !!v;
    if (v) ensureMap();
    render();
  },
  setMapId(val) {
    act("Change location", () => applyMap(val));
  },
  setMapSize(val, el) {
    const t = num(val);
    if (t == null || t <= 0) return render();
    const M = mapOf();
    act("Map size", () => {
      applyMap("custom", el.dataset.k === "w" ? t : M.w, el.dataset.k === "h" ? t : M.h);
    });
  },
  noteNew() {
    ui.noteId = null;
    ui.focus = ui.modal ? "#noteText" : "#qnText";
    render();
  },
  refresh() {
    applyData();
    render();
    toast("Lists refreshed");
  },
  devToggle() {
    ui.devOpen = !ui.devOpen;
    render();
  },
  railMore() {
    ui.railMore = !ui.railMore;
    render();
  },
  rollDice(v) {
    const [id, kind] = splitV(v);
    const el = document.getElementById(id);
    if (!el) return;
    const n = kind === "d100" ? 1 + Math.floor(Math.random() * 100) : kind === "2d10" ? Math.floor(Math.random() * 100) : 1 + Math.floor(Math.random() * 20);
    const val = kind === "2d10" ? String(n).padStart(2, "0") : String(n);
    const enter = el.dataset.enter;
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    toast(`Rolled ${val}`);
    if (enter && ACT[enter]) ACT[enter](val, el); // the same as typing it and pressing Enter
  },
  setSpStyle(v) {
    prefs.spStyle = v === "symbols" ? undefined : v; // unset is symbols
    savePrefs();
    render();
  },
  setRingOp(v) {
    prefs.ringOp = clamp(Number(v) / 100, 0.1, 0.8);
    savePrefs();
    applyScale();
    render();
  },
  setScale(v) {
    prefs.uiScale = Number(v) || 1;
    savePrefs();
    applyScale();
    render();
    toast(`UI size ${Math.round(prefs.uiScale * 100)}%`);
  },
  fold(v) {
    prefs.fold = { ...(prefs.fold || {}), [v]: !(prefs.fold || {})[v] };
    savePrefs();
    render();
  },
  setNamePool(v, el) {
    const k = el.dataset.k,
      next = v
        .split(/[,\n]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .join(",");
    if (next === S.rules.namePools[k]) return;
    act(`Edit ${k} names`, () => {
      S.rules.namePools[k] = next;
    });
  },
  tableExport(v) {
    const [id] = splitV(v);
    const rows = tableRows(id);
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fallout-${id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast(`Exported ${rows.length} rows`);
  },
  tableReset(v) {
    act(`Reset ${v}`, () => {
      if (v === "perks") {
        delete S.tables.levelPerks;
        delete S.tables.skillPerks;
      } else delete S.tables[TABLE_IO[v]];
      S.tableRev = (S.tableRev || 0) + 1;
    });
    toast("Back to the workbook's table");
  },
  sheetTab(v) {
    ui.modal.tab = v;
    render();
  },
  guideGo(v) {
    ui.guide = Number(v);
    render();
  },
  newStart(v) {
    if (v) ACT.saveNow();
    act("New campaign", () => {
      S = fresh();
      S.chars = [];
      ui.sel = null;
      ui.rowSel = null;
      ui.atk = null;
      ui.end = null;
      ui.def = null;
      ui.setup = null;
      ui.noteId = null;
      ui.wiz = newWiz();
      ui.modal = { type: "wizard" };
      ui.focus = "#wizName";
    });
    prefs.slot = null;
    savePrefs();
    toast("New campaign started. Undo goes back.");
  },
  wizGo(v) {
    const w = ui.wiz;
    const to = Number(v);
    if (to > w.step) {
      if (w.step === 0 && w.arch == null && !w.custom) return toast("Pick an archetype, or build custom gear.");
      if (w.step === 1 && w.special.reduce((t, x) => t + x, 0) > S.rules.startPool) return toast(`SPECIAL can't total more than ${S.rules.startPool}.`);
      if (w.step === 2 && (!w.pick[0] || !w.pick[1])) return toast("Pick two traits.");
      if (w.step === 3 && w.tags.length !== 3) return toast("Tag exactly three skills.");
    }
    w.step = to;
    ui.focus = to === 0 ? "#wizName" : null;
    render();
  },
  wizArch(v) {
    ui.wiz.arch = Number(v);
    ui.wiz.custom = null;
    render();
  },
  wizStat(v) {
    const [i, d] = splitV(v);
    const w = ui.wiz;
    const next = w.special[i] + Number(d);
    if (next < 1 || next > 10) return;
    if (Number(d) > 0 && w.special.reduce((t, x) => t + x, 0) >= S.rules.startPool)
      return toast(`All ${S.rules.startPool} points are spent. Lower another stat first.`);
    w.special[i] = next;
    render();
  },
  wizReroll() {
    const w = ui.wiz;
    if (w.rerolled) return;
    w.rolled = rollTrait([w.rolled, ...w.pick]);
    w.rerolled = true;
    log("status", `Trait reroll: ${db.traitByCode.get(w.rolled).n}.`);
    render();
  },
  wizTag(v) {
    const w = ui.wiz;
    if (w.tags.includes(v)) w.tags = w.tags.filter((x) => x !== v);
    else if (w.tags.length < 3) w.tags.push(v);
    else return toast("Three tags. Untag one first.");
    render();
  },
  wizAdd() {
    const w = ui.wiz;
    act(`Create ${w.name || "character"}`, () => {
      const c = buildChar(w);
      S.chars.push(c);
      ui.sel = c.id;
      log("status", `${c.name} joins the party: ${c.background}. Traits ${c.traits.map((x) => db.traitByCode.get(x).n).join(", ")}.`);
      w.step = 5;
    });
  },
  wizAnother() {
    ui.wiz = newWiz();
    ui.focus = "#wizName";
    render();
  },
  wizSample() {
    act("Sample party", () => {
      S.chars = fresh().chars;
      ui.sel = (S.chars[0] || {}).id;
      ui.wiz = null;
      ui.modal = null;
    });
  },
  toggleAlly(v) {
    const e = ent(v);
    act(`Ally: ${e.name}`, () => {
      e.ally = !e.ally;
      log("status", `${e.name} is now ${e.ally ? "an ally" : "an enemy"}.`);
      if (ui.atk && ui.atk.tgt === v) ui.atk.tgt = targetsFor(ui.atk.att)[0] || null;
    });
  },
  gearSlot(v) {
    const m = ui.modal;
    m.pick = m.pick === v ? null : v;
    m.pq = "";
    if (m.pick) ui.focus = "#gearQ";
    render();
  },
  gearEquip(name) {
    const m = ui.modal;
    const e = ent(m.id);
    const s = m.pick;
    if (!e || !s) return;
    act(name ? `Equip ${name}` : "Unequip", () => {
      keepFull(e, () => {
        const take = () => {
          const l = (e.inv || []).find((x) => E.low(x.n) === E.low(name));
          if (l) {
            l.q--;
            if (l.q <= 0) e.inv = e.inv.filter((x) => x !== l);
          }
        };
        if (s[0] === "w") {
          const i = Number(s[1]);
          const old = e.weapons[i];
          if (old) {
            const w = E.get(ctx(), old.n);
            const res = old.ammo || (w && w.o.ammo);
            if (old.mag && res && res !== "N/A") addInv(e, res, old.mag, true);
            if (old.n !== "Basic Fighting") addInv(e, old.n, 1);
          }
          if (name) {
            take();
            const w = E.get(ctx(), name);
            const next = { n: w.o.n, mag: 0 };
            if (old) e.weapons[i] = next;
            else e.weapons.push(next);
          } else if (old) e.weapons.splice(i, 1);
          if ((e.activeW || 0) >= e.weapons.length) e.activeW = 0;
        } else {
          if (name && s.startsWith("acc") && der(e).m.noAccessories) {
            log("status", `${e.name}'s armor can't take accessories.`);
            return;
          }
          const cur = slotName(e, s);
          if (cur) addInv(e, cur, 1);
          if (name) take();
          setSlot(e, s, name);
        }
      });
      log("status", name ? `${e.name} equips ${name}.` : `${e.name} takes off a piece of gear.`);
      m.pick = null;
    });
  },
  venTier(v) {
    act("Vendor tier", () => {
      S.vendor.tier = Number(v);
      S.vendor.stock = E.vendorStock(ctx(), S.vendor.tier);
    });
  },
  venBarter(v) {
    act("Vendor barter", () => {
      S.vendor.barter = Number(v);
    });
  },
  venRoll() {
    act("Restock vendor", () => {
      S.vendor.stock = E.vendorStock(ctx(), S.vendor.tier);
    });
  },
  venTab(v) {
    ui.venTab = v;
    render();
  },
  rewardTier(v) {
    const r = ui.reward,
      t = Number(v);
    r.tiers = r.tiers.includes(t) ? (r.tiers.length > 1 ? r.tiers.filter((x) => x !== t) : r.tiers) : [...r.tiers, t].sort();
    render();
  },
  // General stands alone; any other kind toggles on and off, and with none left it falls back to General.
  rewardFocus(v) {
    const r = rewardState();
    if (v === "general") r.kinds = ["general"];
    else {
      const k = r.kinds.filter((x) => x !== "general");
      r.kinds = k.includes(v) ? k.filter((x) => x !== v) : [...k, v];
      if (!r.kinds.length) r.kinds = ["general"];
    }
    render();
  },
  rewardGen() {
    const r = rewardState();
    r.items = rewardRoll(r.kinds, r.tiers, clamp(Math.round(num(r.n, 5)), 1, 30));
    r.to = {};
    r.all = "";
    if (!r.items.length) return toast("Nothing of that kind at those tiers.");
    ui.modal = { type: "reward" };
    render();
  },
  rewardShow() {
    ui.modal = { type: "reward" };
    render();
  },
  rewardClear() {
    Object.assign(rewardState(), { items: [], to: {}, all: "" });
    if (ui.modal && ui.modal.type === "reward") ui.modal = null;
    render();
  },
  rewardGive() {
    const r = ui.reward;
    const plan = r.items.map((l, i) => ({ ...l, to: r.all || r.to[i] })).filter((l) => ent(l.to));
    if (!plan.length) return toast("Pick who gets what, or All to.");
    act("Give rewards", () => {
      for (const l of plan) {
        const e = ent(l.to);
        keepFull(e, () => addInv(e, l.n, l.q));
        log("status", `${e.name} gets ${l.q} x ${l.n}.`);
      }
    });
    const given = new Set(plan.map((l) => l.n));
    r.items = r.items.filter((l, i) => !(r.all || ent(r.to[i])) || !given.has(l.n));
    r.to = {};
    r.all = "";
    if (!r.items.length && ui.modal && ui.modal.type === "reward") ui.modal = null;
    render();
  },
  rewardCache() {
    const r = ui.reward;
    if (!r.items.length) return;
    act("Leave a cache", () => {
      const o = makeChest();
      o.loot = r.items.map((l) => ({ n: l.n, q: l.q }));
      o.label = "Cache";
      S.scene.objects.push(o);
      log("status", `A cache is left on the map: ${o.loot.map((l) => `${l.q} x ${l.n}`).join(", ")}.`);
    });
    Object.assign(r, { items: [], to: {}, all: "" });
    if (ui.modal && ui.modal.type === "reward") ui.modal = null;
    render();
  },
  venPublic(v, el) {
    act(el.checked ? "Vendor open to players" : "Vendor closed to players", () => {
      S.vendor.public = !!el.checked;
    });
  },
  venBuy(v) {
    const e = ent(ui.sel);
    const l = S.vendor.stock[Number(v)];
    if (!e || !l) return;
    const f = priceFactors(e, S.vendor.barter);
    const price = Math.max(1, Math.ceil(E.valueOf(ctx(), l.n).val * f.buy));
    if ((e.caps || 0) < price) return toast(`${e.name} needs ${price} caps, has ${fmt(e.caps)}.`);
    act(`Buy ${l.n}`, () => {
      e.caps = E.fix(e.caps - price);
      keepFull(e, () => addInv(e, l.n, 1));
      l.q--;
      if (l.q <= 0) S.vendor.stock.splice(Number(v), 1);
      log("status", `${e.name} buys ${l.n} for ${price} caps.`);
    });
  },
  venSell(v) {
    const e = ent(ui.sel);
    const l = e && (e.inv || [])[Number(v)];
    if (!l) return;
    const f = priceFactors(e, S.vendor.barter);
    const price = Math.floor(E.valueOf(ctx(), l.n).val * f.sell);
    act(`Sell ${l.n}`, () => {
      const name = l.n;
      keepFull(e, () => {
        l.q--;
        if (l.q <= 0) e.inv.splice(Number(v), 1);
      });
      e.caps = E.fix((e.caps || 0) + price);
      S.vendor.stock = S.vendor.stock || [];
      const st = S.vendor.stock.find((x) => x.n === name);
      if (st) st.q++;
      else S.vendor.stock.push({ n: name, q: 1 });
      log("status", `${e.name} sells ${name} for ${price} caps.`);
    });
  },
  noteOpen(v) {
    ui.noteId = v;
    ui.focus = "#noteText";
    render();
  },
  noteDel(v) {
    act("Delete note", () => {
      S.notesList = S.notesList.filter((n) => n.id !== v);
      ui.noteId = null;
    });
  },
  setGrid(v) {
    act("Map grid", () => {
      S.rules.gridMode = v;
    });
  },
  iconPick(v) {
    ui.modal = { type: "icon", id: v };
    render();
  },
  iconSet(v) {
    const [id, ic] = splitV(v);
    const e = ent(id);
    if (!e) return;
    act(`Icon: ${e.name}`, () => {
      e.icon = ic === "person" ? undefined : ic;
    });
    ui.modal = null;
    render();
  },
  invTab(v) {
    ui.invTab = v;
    render();
  },
  invSort(v) {
    ui.invSort = v;
    render();
  },
  invDir() {
    ui.invDir = -(ui.invDir || 1);
    render();
  },
  setFam(val, el) {
    const e = ent(el.dataset.id);
    const t = num(val);
    if (!e || t == null || t < 0) return render();
    act("Familiarity", () => {
      e.fam = { ...(e.fam || {}), [E.low(el.dataset.n)]: t };
    });
  },
  treeSkill(v) {
    ui.treeSkill = v || null;
    render();
    const w = document.querySelector("[data-scroll=ttree]");
    if (w) {
      w.scrollTop = 0;
      w.scrollLeft = (w.scrollWidth - w.clientWidth) / 2; // the root sits in the middle
    }
  },
  treeZoom(v) {
    const z = treeZ();
    ui.treeZoom = Number(v) === 0 ? 1 : clamp(Math.round((z + Number(v) * 0.15) * 100) / 100, 0.4, 1.75);
    render();
  },
  treeTab(v) {
    ui.treeId = v;
    render();
  },
  wizMode(v) {
    ui.wiz.custom = v ? ui.wiz.custom || { bg: "", items: [], caps: 0, n: "", q: 1 } : null;
    if (v) ui.wiz.arch = null;
    render();
  },
  wizKitAdd() {
    const k = ui.wiz.custom;
    const n = String(k.n || "").trim();
    const it = E.get(ctx(), n);
    if (!it) {
      ui.focus = "#wizKitN";
      render();
      return toast("No item by that name. Pick one from the list.");
    }
    const q = Math.max(1, num(k.q, 1));
    const had = k.items.find((x) => x[0] === it.o.n);
    if (had) had[1] += q;
    else k.items.push([it.o.n, q]);
    k.n = "";
    k.q = 1;
    ui.focus = "#wizKitN";
    render();
  },
  wizKitDel(v) {
    ui.wiz.custom.items.splice(Number(v), 1);
    render();
  },
  railGo(v) {
    ui.railMore = false;
    if (v === "vendor" && !isSpec() && !(S.vendor.stock || []).length)
      act("Stock vendor", () => {
        S.vendor.stock = E.vendorStock(ctx(), S.vendor.tier);
      });
    if (isSpec() && !specRail().includes(v)) return;
    if (v === "wiki") return ACT.wiki();
    if (v === "saveNow") return ACT.saveNow();
    if (v === "log") return ACT.toggleLog();
    if (ui.modal && ui.modal.type === v) return ACT.closeModal();
    ui.modal = { type: v };
    ui.focus = v === "items" ? "#brQ" : v === "notes" ? "#noteText" : null;
    render();
  },
  clearLog(v) {
    const keep = { combat: (l) => !(l.r > 0), recent: (l) => l.r > 0, all: () => false }[v];
    if (!keep) return;
    act(v === "combat" ? "Clear combat log" : v === "recent" ? "Clear recent events" : "Clear log", () => {
      S.log = S.log.filter(keep);
    });
  },
  toggleLog() {
    ui.logOpen = !ui.logOpen;
    render();
  },
  openChar(v) {
    const [id, s] = splitV(v);
    ui.sel = id;
    ui.rowSel = id;
    ui.modal = s === "inv" ? { type: "char", id, sect: s, q: "", pick: null } : s === "sheet" ? { type: "sheet", id, tab: "stats" } : { type: "health", id };
    render();
  },
  pwOpen(v) {
    ui.pw.side = v || "party";
    ui.pw.who = {};
    ui.modal = { type: "pwide", side: ui.pw.side };
    ui.focus = "#pwAct";
    render();
  },
  pwWho(v) {
    for (const e of ui.pw.side === "enemies" ? foes() : S.chars) ui.pw.who[e.id] = !!v;
    render();
  },
  pwApply() {
    const m = ui.pw;
    const list = (m.side === "enemies" ? foes() : S.chars).filter((e) => m.who[e.id] !== false);
    const needsName = ["addItem", "removeItem", "addStatus", "removeStatus"].includes(m.act);
    const n = String(m.name).trim();
    if (needsName && !n) return toast("Name it first.");
    if (!list.length) return toast("Nobody is ticked.");
    const val = num(m.val, 0);
    if (m.act === "addStatus" && !db.status.has(E.low(n))) return toast("No status by that name.");
    act("Party-wide change", () => {
      for (const e of list)
        keepFull(e, () => {
          if (m.act === "addItem") {
            const it = E.get(ctx(), n);
            addInv(e, it ? it.o.n : n, val || 1, true);
          }
          if (m.act === "removeItem") {
            const l = (e.inv || []).find((x) => E.low(x.n) === E.low(n));
            if (l) {
              l.q -= val || 1;
              if (l.q <= 0) e.inv = e.inv.filter((x) => x !== l);
            }
          }
          if (m.act === "addStatus") addStatus(e, n, num(m.tier, 1));
          if (m.act === "removeStatus") e.statuses = (e.statuses || []).filter((s) => E.low(s.n) !== E.low(n));
          if (m.act === "caps") e.caps = Math.max(0, (e.caps || 0) + val);
          if (m.act === "xp") e.xp = Math.max(0, E.fix((e.xp || 0) + val));
          if (m.act === "clear") {
            e.statuses = [];
            e.effects = [];
          }
        });
      for (const e of list) {
        if (m.act === "hp") {
          e.hp = clamp(e.hp + val, 0, der(e).hp);
          syncDown(e);
        }
        if (m.act === "ap") e.ap = Math.max(0, (e.ap || 0) + val);
        if (m.act === "heal") {
          e.hp = der(e).hp;
          syncDown(e);
        }
      }
      log(
        "status",
        `All (${list.map((e) => e.name).join(", ")}): ${m.act}${n ? " " + n : ""}${val && m.act !== "addStatus" && m.act !== "removeStatus" ? " " + val : ""}.`,
      );
      ui.modal = null;
    });
  },
  legendToggle() {
    ui.legend = !ui.legend;
    render();
  },
  mapPlace(v) {
    if (ui.place !== v) ui.placeItem = null;
    ui.place = ui.place === v ? null : v;
    ui.mapSel = null;
    render();
  },
  keyMoveStart() {
    const id = actorId();
    const e = ent(id);
    if (!e || !fightPhase()) return;
    const me = posOf(id);
    const foe = targetsFor(id)
      .filter((x) => sideOf(x) !== sideOf(id))
      .sort((x, y) => dist(posOf(x), me) - dist(posOf(y), me))[0];
    const t = foe ? posOf(foe) : { x: me.x + 1, y: me.y };
    ui.keyMove = { id, ang: Math.round((Math.atan2(t.y - me.y, t.x - me.x) * 180) / Math.PI / 15) * 15, steps: 0 };
    keyMovePlan();
    render();
  },
  moveConfirm() {
    const m = ui.pendingMove;
    const k = K();
    if (!m || !k) return;
    const c = cbOf(m.id),
      e = ent(m.id);
    ui.pendingMove = null;
    if (!canPay(e, m.cost, "move there")) return render();
    act("Move token", () => {
      for (const key of Object.keys(k.ranges)) if (key.split("|").includes(m.id)) delete k.ranges[key];
      e.ap = Math.max(0, (e.ap || 0) - m.cost);
      c.moved = true;
      if (k.phase === "stealth") k.stealthDue = e.id;
      log("status", `${e.name} moves ${fmt(m.cost)} AP: ${moveHow(e, m).text}. ${e.ap} left.`);
      walkTo(e, m); // traps, mines and live wires on the way go off now
      touchObjects(e.id);
      ui.focus = "#roll";
    });
  },
  pray() {
    const id = actorId();
    const e = ent(id);
    const pr = S.rules.prayer || {};
    if (!e || !canPray(e)) return;
    if (!(e.ap > 0)) return toast(`${e.name} has no AP left to pray with.`);
    act(`${e.name} prays`, () => {
      const spent = e.ap;
      e.ap = 0;
      e.statuses = (e.statuses || []).filter((s) => s.n !== "Damnation");
      keepFull(e, () => addStatus(e, pr.status || "Prayer", 1, pr.rounds || 3));
      log("status", `${e.name} spends ${fmt(spent)} AP in prayer and gains ${pr.status || "Prayer"} for ${pr.rounds || 3} rounds.`);
    });
  },
  partyMove(v) {
    const [id, d] = splitV(v);
    const i = S.chars.findIndex((c) => c.id === id),
      j = i + Number(d);
    if (i < 0 || j < 0 || j >= S.chars.length) return;
    act("Party order", () => {
      [S.chars[i], S.chars[j]] = [S.chars[j], S.chars[i]];
      // outside a fight the party lines up again in the new order; in a fight they stay where they are
      if (!K()) {
        for (const c of S.chars) delete S.scene.pos[c.id];
        partySpots();
      }
    });
  },
  inspire() {
    const id = actorId();
    const e = ent(id);
    if (!e || !canPay(e, 2, "inspire")) return;
    act("Inspire", () => {
      e.ap -= 2;
      for (const c of S.chars) {
        c.effects = c.effects || [];
        c.effects.push({ label: "Inspired", mods: { acc: 0.1 }, turns: 1, text: "+10 to hit" });
      }
      log("status", `${e.name} inspires the party: +10 to hit next turn.`);
    });
  },
  moveCancel() {
    ui.pendingMove = null;
    ui.focus = "#roll";
    render();
  },
  mapZoom(v) {
    const f = Number(v);
    if (!f) ui.zoom = null;
    else setZoom((ui.zoom ? ui.zoom.k : 1) * f);
    render();
  },
  setTheme(val) {
    act("Room setting", () => {
      S.scene.theme = val;
      const cm = customMap(mapOf().id);
      if (val === "asBuilt" && cm) S.scene.objects = builtObjects(cm); // back to the map as it was drawn
    });
  },
  randomRoom() {
    act("Randomize room", () => {
      const party = S.chars.map((c) => posOf(c.id));
      const foesAt = foes().map((e) => posOf(e.id));
      const cm = customMap(mapOf().id);
      if (cm && S.scene.theme === "asBuilt") S.scene.objects = builtObjects(cm);
      else {
        // on a drawn map the out-of-bounds blocks stay, and nothing new lands on them
        const keep = cm ? builtObjects(cm).filter((o) => o.voidBlock) : [];
        // Clutter scales every setting's density; sparse also thins the fixed furniture of indoor plans by about a third
        const mul = { sparse: 0.55, cluttered: 1.6 }[S.scene.density] || 1;
        const r2 =
          mul === 1
            ? S.rules
            : {
                ...S.rules,
                roomThemes: Object.fromEntries(
                  Object.entries(S.rules.roomThemes).map(([k, t]) => [
                    k,
                    { ...t, density: t.density * mul, min: Math.round((t.min || 0) * Math.min(1, mul)), max: Math.round((t.max || 60) * mul) },
                  ]),
                ),
              };
        let made = E.generateRoom(cm ? { ...mapOf(), id: "custom" } : mapOf(), S.scene.theme, r2, Math.random, [...party, ...foesAt], () => "o" + S.seq++);
        if (S.scene.density === "sparse") made = made.filter((o) => o.block || o.door || /wall|building|void/i.test(o.item || "") || Math.random() > 0.35);
        const corners = (o) =>
          [
            [0, 0],
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([a, b]) => ({ x: o.x + (a * o.w) / 2, y: o.y + (b * o.h) / 2 }));
        S.scene.objects = [...keep, ...made.filter((o) => !keep.some((v) => corners(o).some((q) => E.inside(q, v))))];
      }
      if (ui.roomChest) {
        const ch = makeChest();
        S.scene.objects = S.scene.objects.filter((o) => dist(o, ch) > 1.5);
        S.scene.objects.push(ch);
      }
      log("status", `Room: ${mapOf().n}, ${(S.rules.roomThemes[S.scene.theme] || { n: "as built" }).n}, ${S.scene.objects.length} objects.`);
    });
  },
  clearRoom() {
    act("Clear room", () => {
      S.scene.objects = [];
      ui.mapSel = null;
    });
  },
  objRotate(v) {
    const o = S.scene.objects.find((x) => x.id === ui.mapSel);
    if (o)
      act("Rotate", () => {
        o.angle = ((((o.angle || 0) + Number(v)) % 360) + 360) % 360;
      });
  },
  setObjAngle(val) {
    const t = num(val);
    const o = S.scene.objects.find((x) => x.id === ui.mapSel);
    if (o && t != null)
      act("Rotate", () => {
        o.angle = ((t % 360) + 360) % 360;
      });
    else render();
  },
  setObjCover(val) {
    const o = S.scene.objects.find((x) => x.id === ui.mapSel);
    if (o)
      act("Cover tier", () => {
        o.cover = val;
      });
  },
  objBlock(v, el) {
    const o = S.scene.objects.find((x) => x.id === v);
    const on = el.checked;
    if (o)
      act("Blocks walking", () => {
        o.block = on;
      });
  },
  setObjLabel(val) {
    const o = S.scene.objects.find((x) => x.id === ui.mapSel);
    if (o)
      act("Label", () => {
        o.label = val;
      });
  },
  dispNext(v) {
    const e = ent(v);
    if (!e) return;
    const kind = E.dispositionKind(e, S.rules);
    const list = Object.keys(S.rules.dispositions || {}).filter((k) => S.rules.dispositions[k].who === kind);
    if (!list.length) return;
    act("Disposition", () => {
      e.disp = list[(list.indexOf(e.disp) + 1) % list.length];
      ui.autoPlan = null;
      log("status", `${e.name} is now ${S.rules.dispositions[e.disp].n}.`);
    });
  },
  objDoor(v) {
    const o = S.scene.objects.find((x) => x.id === v);
    if (o)
      act(o.open ? "Shut door" : "Open door", () => {
        o.open = !o.open;
        log("status", `The ${(S.rules.mapItems[o.item] || {}).n || "door"} is ${o.open ? "open" : "shut"}.`);
      });
  },
  setRads(val, el) {
    const e = ent(el.dataset.id);
    const t = num(val);
    if (!e || t == null) return render();
    act("Rads", () => setRads(e, t));
  },
  objDel(v) {
    act("Remove from map", () => {
      S.scene.objects = S.scene.objects.filter((o) => o.id !== v);
      ui.mapSel = null;
    });
  },
  mmOpen(v) {
    mmNew(v || null);
    ui.modal = { type: "mapmaker" };
    ui.focus = "#mmName";
    render();
  },
  mmTool(v) {
    ui.mm.tool = v;
    if (v !== "select") ui.mm.sel = null;
    render();
  },
  mmPick(val) {
    ui.mm.item = val;
    ui.mm.tool = "item";
    scheduleRender();
  },
  mmShape(val) {
    ui.mm.shape = val;
    scheduleRender();
  },
  mmSize(val, el) {
    const t = num(val),
      g = S.rules.gridM || 2,
      m = ui.mm;
    if (t == null || t < 4) return scheduleRender();
    m[el.dataset.k] = Math.min(400, Math.ceil(t / g) * g); // whole grid squares, like every other location
    m.objects = m.objects.filter((o) => Math.abs(o.x) <= m.w / 2 && Math.abs(o.y) <= m.h / 2); // anything left outside the new edge goes
    scheduleRender();
  },
  mmObjSize(val, el) {
    const o = ui.mm.objects.find((x) => x.id === ui.mm.sel),
      t = num(val);
    if (o && t > 0) o[el.dataset.k] = E.fix(Math.min(t, 400));
    scheduleRender();
  },
  mmTurn() {
    const o = ui.mm.objects.find((x) => x.id === ui.mm.sel);
    if (!o) return;
    [o.w, o.h] = [o.h, o.w];
    if (o.rot) delete o.rot;
    else o.rot = 90;
    render();
  },
  mmDel() {
    const m = ui.mm;
    if (!m || !m.sel) return;
    m.objects = m.objects.filter((o) => o.id !== m.sel);
    m.sel = null;
    render();
  },
  mmClear() {
    ui.mm.objects = [];
    ui.mm.sel = null;
    render();
  },
  mmSave() {
    const m = ui.mm,
      name = String(m.name).trim();
    if (!name) {
      ui.focus = "#mmName";
      render();
      return toast("Name the map first.");
    }
    const id = m.id || "m" + Date.now().toString(36);
    const objs = mmAll().map(({ id: _drop, ...o }) => o);
    act(`Save map: ${name}`, () => {
      S.customMaps = S.customMaps || {};
      S.customMaps[id] = { n: name, w: m.w, h: m.h, shape: m.shape, objs };
      if (!S.combat) {
        applyMap("cm:" + id);
        ui.setup = true;
      }
      ui.modal = null;
    });
    toast(`${name} saved, ${m.w} x ${m.h} m. It is under Location from now on.`);
  },
  mmRemove() {
    const m = ui.mm;
    if (!m.id || !confirm(`Delete the map "${m.name}"? Undo brings it back.`)) return;
    act(`Delete map: ${m.name}`, () => {
      delete S.customMaps[m.id];
      if (!S.combat && mapOf().id === "cm:" + m.id) applyMap(S.rules.sceneDefaults.map);
      ui.modal = null;
    });
  },
  setDensity(val) {
    act("Room clutter", () => {
      S.scene.density = val === "normal" ? "" : val;
    });
    toast("Clutter set. It applies the next time you press Randomize room."); // never throws away what the DM placed
  },
  setSpawn(val) {
    act("Enemy distance", () => {
      S.scene.spawn = val;
      for (const e of S.scene.npcs) delete S.scene.pos[e.id];
      for (const e of S.scene.npcs) S.scene.pos[e.id] = freeSpot();
    });
  },
  scatter() {
    act("Scatter enemies", () => {
      for (const e of S.scene.npcs) delete S.scene.pos[e.id];
      for (const e of S.scene.npcs) S.scene.pos[e.id] = freeSpot();
    });
  },
  surround() {
    act("Surround", () => {
      const M = mapOf();
      const ps = S.chars.map((c) => posOf(c.id));
      const cx = ps.reduce((t, p) => t + p.x, 0) / (ps.length || 1),
        cy = ps.reduce((t, p) => t + p.y, 0) / (ps.length || 1);
      const r = Math.min(M.w, M.h) * 0.35;
      const n = S.scene.npcs.length;
      S.scene.npcs.forEach((e, i) => {
        const t = (i / Math.max(n, 1)) * Math.PI * 2;
        let p = inMap({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
        if (standBlocked(p)) p = freeSpot();
        S.scene.pos[e.id] = { x: E.fix(p.x), y: E.fix(p.y) };
      });
    });
  },
  setBand(val, el) {
    const t = num(val);
    if (t == null) return render();
    act("Move enemy", () => {
      const c = posOf(ui.sel),
        p = posOf(el.dataset.id);
      const d = dist(c, p) || 1;
      const m = S.rules.bandMeters[clamp(t, 1, 10) - 1];
      const q = inMap({ x: c.x + ((p.x - c.x) / d) * m, y: c.y + ((p.y - c.y) / d) * m });
      S.scene.pos[el.dataset.id] = { x: E.fix(q.x), y: E.fix(q.y) };
    });
  },
  slotNew() {
    const id = "s" + Date.now().toString(36);
    const name = `Save ${slots().length + 1}`;
    if (!writeSlot(id, name)) return toast("Browser storage is full. Save a pack.");
    prefs.slot = id;
    savePrefs();
    save();
    render();
    toast(`${name} saved`);
  },
  slotRename(val, el) {
    const list = slots();
    const x = list.find((y) => y.id === el.dataset.v);
    if (x) {
      x.name = val;
      try {
        localStorage.setItem(SLOTS_KEY, JSON.stringify(list));
      } catch (e) {
        /* the name just won't stick */
      }
    }
  },
  slotLoad(v) {
    let p;
    try {
      p = normalize(readJson(v === "auto" ? SAVE_KEY : "fallout-dm-slot-" + v));
    } catch (e) {
      return toast("That save can't be read.");
    }
    act("Load save", () => {
      S = p;
      ui.sel = (S.chars[0] || {}).id;
      ui.rowSel = null;
      ui.atk = null;
      ui.modal = null;
      ui.end = null;
      ui.def = null;
    });
    if (v !== "auto") {
      prefs.slot = v;
      savePrefs();
    }
    toast("Save loaded. Undo goes back.");
  },
  slotDel(v) {
    if (!confirm("Delete this save? This can't be undone.")) return;
    try {
      localStorage.removeItem("fallout-dm-slot-" + v);
      localStorage.setItem(SLOTS_KEY, JSON.stringify(slots().filter((x) => x.id !== v)));
    } catch (e) {
      /* nothing to clean up */
    }
    if (prefs.slot === v) {
      prefs.slot = null;
      savePrefs();
    }
    render();
  },
  newChar() {
    ui.wiz = ui.wiz && ui.wiz.step < 5 ? ui.wiz : newWiz();
    ui.modal = { type: "wizard" };
    ui.focus = "#wizName";
    render();
  },
  edit(v) {
    const id = v || (K() ? ui.rowSel || actorId() : ui.rowSel && ent(ui.rowSel) ? ui.rowSel : ui.sel);
    if (!ent(id)) return;
    ui.modal = { type: "edit", id };
    render();
  },
  delChar(v) {
    const e = ent(v);
    if (!confirm(`Delete ${e.name}?`)) return;
    act(`Delete ${e.name}`, () => {
      S.chars = S.chars.filter((c) => c.id !== v);
      ui.modal = null;
      ui.sel = (S.chars[0] || {}).id;
      const k = S.combat;
      if (!k) return;
      k.cbs = k.cbs.filter((c) => c.id !== v);
      if (ui.atk && (ui.atk.att === v || ui.atk.tgt === v)) ui.atk = null;
      if (k.turnId === v) {
        const nx = order().find((c) => canAct(c) && !k.acted[c.id]);
        if (nx) startTurn(nx.id);
        else enterRoundEnd();
      } // it was their turn: pass it on, as removing an enemy does
    });
  },
  toggleTag(v) {
    const [id, k] = splitV(v);
    const e = ent(id);
    act("Change tags", () => {
      keepFull(e, () => {
        e.tags = e.tags.includes(k) ? e.tags.filter((x) => x !== k) : [...e.tags, k];
      });
    });
  },
  setOv(val, el) {
    const e = ent(el.dataset.id);
    const k = el.dataset.k;
    act(`Override ${k}: ${e.name}`, () => {
      keepFull(e, () => {
        e.ov = e.ov || {};
        const t = num(val);
        e.ov[k] = t != null && (k === "hp" || k === "ap") ? Math.max(0, t) : t;
      });
    });
  },
  setSpecial(val, el) {
    const e = ent(el.dataset.id);
    const i = Number(el.dataset.i);
    const k = E.SPECIAL[i];
    const t = num(val);
    if (t == null) return render();
    act(`${SP_LABEL[k]}: ${e.name}`, () => {
      keepFull(e, () => {
        e.special[i] = t - (der(e).m[k] || 0);
      });
    });
  },
  setSkill(val, el) {
    const e = ent(el.dataset.id);
    const k = el.dataset.k;
    const t = num(val);
    act(`${k}: ${e.name}`, () => {
      keepFull(e, () => {
        e.skills = e.skills || {};
        if (t == null) delete e.skills[k];
        else e.skills[k] = t - (der(e).m[k] || 0) - ((e.spent || {})[k] || 0) * ((e.tags || []).includes(k) ? 2 : 1);
      });
    });
  },
  setSuper(val, el) {
    const e = ent(el.dataset.id);
    const t = num(val);
    act(`Super crit: ${e.name}`, () => {
      e.superCrit = t == null ? null : t / 100;
    });
  },
  setQty(val, el) {
    const e = ent(el.dataset.id);
    const i = Number(el.dataset.i);
    const t = num(val, 0);
    act("Inventory", () => {
      keepFull(e, () => {
        e.inv[i].q = Math.max(0, t);
        if (!e.inv[i].q) e.inv.splice(i, 1);
      });
    });
  },
  setInit(val, el) {
    const c = cbOf(el.dataset.id);
    const t = num(val);
    if (t == null) return render();
    act("Change initiative", () => {
      c.init = t;
      log("turn", `${ent(c.id).name}'s initiative set to ${t}.`);
    });
  },
  setRange(val, el) {
    const a = actorId();
    const t = num(val);
    if (!a || t == null) return render();
    act("Change range", () => {
      K().ranges[pairKey(a, el.dataset.id)] = clamp(t, 1, 10);
    });
  },
  toggleVariant(v, el) {
    const [id, n] = splitV(v);
    const e = ent(id);
    const on = el.checked;
    act(`${e.name}: ${n}`, () => {
      keepFull(e, () => {
        e.variants = (e.variants || []).filter((x) => x !== n);
        if (on) e.variants.push(n);
      });
    });
  },
  delPerk(v) {
    const [id, p] = splitV(v);
    const e = ent(id);
    act(`Remove perk: ${p}`, () => {
      keepFull(e, () => {
        e.perks = e.perks.filter((x) => x !== p);
      });
    });
  },
  addPerk(v, el) {
    const n = el.value.trim();
    if (!n) return;
    const e = ent(el.dataset.id);
    const i = perkInfo(n);
    if (!i) return toast("No perk by that name.");
    ui.focus = `#${el.id}`;
    act(`Perk: ${n}`, () => {
      keepFull(e, () => {
        e.perks = [...(e.perks || []), i.n];
      });
      if (el.id === "lvlPerkAny" && e.perkDue) e.perkDue--;
      log("status", `${e.name} takes the perk ${i.n}.`);
    });
  },
  addItem(v, el) {
    const n = el.value.trim();
    if (!n) return;
    const e = ent(el.dataset.id);
    ui.focus = `#${el.id}`;
    act(`Add item: ${n}`, () => {
      const it = E.get(ctx(), n);
      keepFull(e, () => addInv(e, it ? it.o.n : n, 1, true));
    });
  },
  invActive(v, el) {
    const [id, i] = splitV(v);
    const e = ent(id);
    const on = el.checked;
    act("Inventory", () => {
      keepFull(e, () => {
        e.inv[i].active = on;
      });
    });
  },
  invDel(v) {
    const [id, i] = splitV(v);
    const e = ent(id);
    act("Inventory", () => {
      keepFull(e, () => {
        e.inv.splice(i, 1);
      });
    });
  },
  useSelf(v) {
    const [id, i] = splitV(v);
    const back = ui.modal && ui.modal.type === "char" ? ui.modal : null;
    ui.modal = { type: "item", who: id, tgt: id, sel: Number(i), back };
    ACT.itemUse(); // if it can't be used (AP, a perk), the usual window stays up and says why
    render();
  },
  useItemFrom(v) {
    const [id, i] = splitV(v);
    const back = ui.modal && ui.modal.type === "char" ? ui.modal : null;
    ui.modal = { type: "item", who: id, tgt: id, sel: Number(i), back };
    render();
  },
  setWeapon(val, el) {
    const e = ent(el.dataset.id);
    const i = Number(el.dataset.i);
    const n = String(val).trim();
    if (!n) return;
    act(`Weapon: ${n}`, () => {
      keepFull(e, () => {
        const w = E.get(ctx(), n);
        e.weapons[i] = { n: w ? w.o.n : n, mag: w ? w.o.mag || 0 : 0 };
      });
    });
  },
  setLoad(val, el) {
    const e = ent(el.dataset.id);
    const i = Number(el.dataset.i);
    act("Change ammo", () => {
      const s = e.weapons[i];
      if (s.mag && s.ammo) addInv(e, s.ammo, s.mag, true);
      s.ammo = val;
      s.mag = 0;
      log("status", `${e.name} unloads ${s.n} and picks ${val || "no ammo"}. Reload to fill it.`);
    });
  },
  addWeapon(v, el) {
    const n = el.value.trim();
    if (!n) return;
    const e = ent(el.dataset.id);
    const w = E.get(ctx(), n);
    if (!w || w.cat !== "weapon") return toast("No weapon by that name.");
    act(`Add weapon: ${n}`, () => {
      keepFull(e, () => {
        e.weapons.push({ n: w.o.n, mag: w.o.mag || 0 });
      });
    });
  },
  delWeapon(v) {
    const [id, i] = splitV(v);
    const e = ent(id);
    act("Remove weapon", () => {
      keepFull(e, () => {
        e.weapons.splice(i, 1);
        e.activeW = 0;
      });
    });
  },
  reloadSlot(v) {
    const [id, i] = splitV(v);
    reloadWeapon(id, Number(i));
  },
  clearSlot(v) {
    const [id, i] = splitV(v);
    clearJam(id, Number(i));
  },
  setTrait(val, el) {
    const e = ent(el.dataset.id);
    const i = Number(el.dataset.i);
    const code = String(val).trim().slice(0, 3);
    if (val && !db.traitByCode.has(code)) return toast("Trait not found. Use its three-digit code or pick from the list.");
    act("Change trait", () => {
      keepFull(e, () => {
        e.traits = e.traits || ["", "", ""];
        e.traits[i] = val ? code : "";
      });
    });
  },
  addStatusFromInput(v, el) {
    const n = el.value.trim();
    if (!n) return;
    const e = ent(el.dataset.id);
    ui.focus = `#${el.id}`;
    act(`Status: ${n}`, () => {
      keepFull(e, () => addStatus(e, n, 1));
      log("status", `${e.name} gains ${n}.`);
    });
  },
  implantIn(v) {
    const [id, i, how] = splitV(v);
    const e = ent(id),
      I = S.rules.implants,
      im = I.list[Number(i)];
    const d = der(e),
      self = how === "self";
    const have = e.implants || [];
    if (!im || have.length >= E.implantSlots(e, d, S.rules) || fightPhase()) return;
    const line = self ? (e.inv || []).find((l) => E.low(l.n) === E.low(im.n) && l.q > 0) : null;
    if (self ? !line : (e.caps || 0) < im.cost) return;
    const p = E.implantOdds(e, d, S.rules, self);
    if (!p) return;
    act(`Implant: ${im.n}`, () => {
      const roll = Math.floor(Math.random() * 100);
      const need = Math.round(p * 100);
      if (roll < need) {
        e.implants = [...have, im.n];
        if (self) {
          line.q--;
          if (line.q <= 0) e.inv = e.inv.filter((l) => l !== line);
        } else e.caps -= im.cost;
        log("check", `${e.name}: ${im.n} ${self ? "self-installed" : "put in by a doctor"} (rolled ${roll}, needed under ${need}). ${im.text}.`);
      } else {
        addStatus(e, I.failStatus, 1, null);
        log(
          "check",
          `${e.name}: the ${im.n} surgery fails (rolled ${roll}, needed under ${need}). ${self ? "The implant is kept" : "The caps are refunded"}; ${I.failStatus} until fixed.`,
        );
      }
    });
  },
  implantOut(v) {
    const [id, i] = splitV(v);
    const e = ent(id),
      im = S.rules.implants.list[Number(i)];
    act(`Remove implant: ${im.n}`, () => {
      e.implants = (e.implants || []).filter((n) => E.low(n) !== E.low(im.n));
    });
  },
  surgeryFix(id) {
    const e = ent(id),
      I = S.rules.implants;
    if ((e.caps || 0) < I.doctorFix) return;
    act(`${I.failStatus} fixed`, () => {
      e.caps -= I.doctorFix;
      e.statuses = (e.statuses || []).filter((s) => s.n !== I.failStatus);
      log("check", `A doctor fixes ${e.name}'s failed surgery for ${I.doctorFix} caps.`);
    });
  },
  delStatus(v) {
    const [id, i] = splitV(v);
    const e = ent(id);
    act("Remove status", () => {
      keepFull(e, () => {
        const st = e.statuses.splice(i, 1)[0];
        log("status", `${st.n} removed from ${e.name}.`);
      });
    });
  },
  delEffect(v) {
    const [id, i] = splitV(v);
    const e = ent(id);
    act("Remove effect", () => {
      keepFull(e, () => {
        e.effects.splice(i, 1);
      });
    });
  },
  rest() {
    if (K()) return toast("No resting in the middle of a fight.");
    act("Rest", () => {
      for (const c of S.chars) {
        const d = der(c);
        if (!c.dbno) c.hp = Math.min(d.hp, c.hp + Math.round(d.hp * S.rules.passiveHealPct));
        c.statuses = (c.statuses || []).filter((s) => s.n !== "Shock");
        keepFull(c, () => {
          c.effects = (c.effects || []).filter((f) => /^Addicted/.test(f.label));
          const ended = (c.statuses || []).filter((q) => q.from);
          c.statuses = (c.statuses || []).filter((q) => !q.from && !q.aftermath);
          for (const q of ended) endSubstance(c, q);
        });
        c.ap = der(c).ap;
      }
      log("status", `The party rests: +${E.pct(S.rules.passiveHealPct)}% HP, Shock and item effects cleared.`);
    });
  },
  levelUp(v) {
    const e = ent(v);
    act(`${e.name} levels up`, () => {
      keepFull(e, () => {
        e.level++;
      });
      const gain = der(e).pts;
      e.ptsBank = (e.ptsBank || 0) + gain;
      const perk = S.rules.perkEvery > 0 && e.level % S.rules.perkEvery === 0;
      if (perk) e.perkDue = (e.perkDue || 0) + 1;
      log("status", `${e.name} reaches level ${e.level}: ${gain} skill points${perk ? " and a level perk" : ""}.`);
      ui.modal = { type: "level", id: e.id };
    });
  },
  spendPts(v) {
    ui.modal = { type: "level", id: v };
    render();
  },
  spend(v) {
    const [id, k, d] = splitV(v);
    const e = ent(id);
    const delta = Number(d) > 0 ? Math.min(Number(d), e.ptsBank || 0) : -Math.min(-Number(d), (e.spent || {})[k] || 0); // never take back more than was spent
    if (Number(d) > 0 && !delta) return toast("No points left.");
    if (delta < 0 && !(e.spent || {})[k]) return;
    act("Spend point", () => {
      keepFull(e, () => {
        e.spent = e.spent || {};
        e.spent[k] = (e.spent[k] || 0) + delta;
        e.ptsBank -= delta;
      });
    });
  },
  levelPerk(v) {
    const [id, n, kind] = splitV(v);
    const e = ent(id);
    act(`Perk: ${n}`, () => {
      keepFull(e, () => {
        e.perks = [...(e.perks || []), n];
      });
      if (kind === "level" && e.perkDue) e.perkDue--;
      log("status", `${e.name} takes the perk ${n}.`);
    });
  },
  check() {
    const k = K();
    const id = k && k.turnId ? k.turnId : ui.sel;
    if (k) ui.modal = { type: "check" };
    ui.focus = `#chk-${id}`;
    render();
    if (!document.activeElement || document.activeElement.id !== `chk-${id}`) {
      focusSoft(document.getElementById("chkTarget"));
    }
  },
  chkPreset(v) {
    Object.assign(ui.chk, { target: Number(v), res: {} });
    render();
  },
  chkClear() {
    Object.assign(ui.chk, { res: {}, xp: "", revive: null });
    render();
  },
  chkGen() {
    const pick = (l) => l[Math.floor(Math.random() * l.length)];
    Object.assign(ui.chk, { use: pick(E.SKILLS)[0], target: pick(Object.values(S.rules.difficulty)), res: {}, xp: "", revive: null });
    log("check", `Generated check: ${SKILL_NAME[ui.chk.use]} vs ${ui.chk.target}.`);
    render();
  },
  chkRoll(val, el) {
    const m = ui.chk;
    const id = el.dataset.id;
    const r = num(val);
    if (r == null || r < 1 || r > 20) return toast("Type the d20 roll, 1 to 20.");
    const e = ent(id);
    if (m.revive && S.combat && K().turnId === e.id && !canPay(e, S.rules.reviveAP, "revive")) return;
    const { v, label } = checkValue(e, m.use);
    const need = E.checkNeeded(v, num(m.target, 0), S.rules);
    const tier = E.checkTier(r, need, S.rules);
    const res = { pass: tier.pass, why: r === 1 ? "natural 1" : r === 20 ? "natural 20" : "", tier: tier.id };
    const next = S.chars.find((c) => c.id !== id && !m.res[c.id]);
    ui.focus = next ? `#chk-${next.id}` : null;
    act(`Check: ${e.name}`, () => {
      log("check", `${e.name}: ${label} vs ${m.target} needs ${need}+, rolled ${r}${res.why ? ` (${res.why})` : ""}: ${tier.n.toUpperCase()}. ${tier.desc}`);
      m.res[id] = { ...res, roll: r };
      // Every outcome pays XP by difficulty (the target times checkXpMul) times its tier: 0.1x for a Total Failure up to 2x for Perfect.
      const base = num(m.target, 0) * (S.rules.checkXpMul || 0) * (tier.xp || 0);
      if (e.kind === "pc" && !m.revive && base > 0) {
        const g = E.xpGain(E.fix(base), der(e).sp.I, S.rules);
        e.xp = E.fix((e.xp || 0) + g);
        m.res[id].xp = g;
        log("check", `${e.name} gains ${g} XP for a ${tier.n} on a ${m.target} check.`);
      }
      if (!S.combat && e.kind === "pc") S.scene.checks[e.id] = (S.scene.checks[e.id] || 0) + 1;
      if (m.revive) {
        if (S.combat && K().turnId === e.id) e.ap = Math.max(0, (e.ap || 0) - S.rules.reviveAP);
        if (res.pass) revive(ent(m.revive), `${e.name}'s Medicine`);
        m.revive = null;
      }
    });
  },
  chkXp() {
    const m = ui.chk;
    const x = num(m.xp);
    if (x == null) return;
    const list = Object.entries(m.res)
      .filter(([, r]) => r.pass)
      .map(([id]) => ent(id))
      .filter((e) => e && e.kind === "pc");
    if (!list.length) return toast("Nobody passed.");
    act("Check XP", () => {
      for (const e of list) {
        const g = E.xpGain(x, der(e).sp.I, S.rules);
        e.xp = E.fix((e.xp || 0) + g);
        log("check", `${e.name} gains ${g} XP for the check (${x} with INT bonus).`);
      }
      m.xp = "";
    });
  },
  reviveChk(v) {
    const down = S.chars.filter((c) => c.dbno);
    if (v && ent(v)) {
      const medic = K() && K().turnId && sideOf(K().turnId) === "pc" ? K().turnId : (S.chars.find((c) => !c.dbno && c.id !== v) || ent(v)).id;
      Object.assign(ui.chk, { use: "MED", target: S.rules.difficulty.Average, res: {}, revive: v });
      if (K()) ui.modal = { type: "check" };
      ui.focus = `#chk-${medic}`;
      return render();
    }
    if (!down.length) return toast("Nobody is down.");
    ACT.reviveChk(ui.rowSel && ent(ui.rowSel) && ent(ui.rowSel).dbno ? ui.rowSel : down[0].id);
  },
  // encounter
  addPick(v) {
    ui.enemyQ = "";
    if (!K()) ui.setup = true;
    act(`Add ${v}`, () => {
      addEnemy(v);
    });
  },
  addFirstEnemy() {
    const t = rankByName(allTemplates(), ui.enemyQ).find((x) => !ui.enemyTier || String(x.tier) === String(ui.enemyTier));
    if (t) {
      ui.focus = "#enemyQ";
      ACT.addPick(t.n);
    }
  },
  pickQty(v) {
    const [t, d] = splitV(v);
    act("Enemy count", () => {
      if (Number(d) > 0) {
        addEnemy(t);
        return;
      }
      const same = S.scene.npcs.filter((n) => n.tmpl === t);
      const last = same[same.length - 1];
      S.scene.npcs = S.scene.npcs.filter((n) => n !== last);
      delete S.scene.pos[last.id];
      renumber(S.scene.npcs, t);
    });
  },
  beginC(v) {
    if (!setupOpen()) return ACT.setupOpen("1");
    beginCombat(!!v);
  },
  fxDark() {
    act("Effect: Darkness", () => {
      S.scene.effects.push({ label: "Darkness", who: "enemies", hit: -0.1 });
      log("check", "Carries into combat: Darkness, enemies -10% to hit.");
    });
  },
  addFx() {
    if (!ui.fxLabel.trim()) {
      ui.focus = "#fxLabel";
      render();
      return toast("Name the effect first.");
    }
    act("Add effect", () => {
      S.scene.effects.push({ label: ui.fxLabel.trim(), who: ui.fxWho, hit: num(ui.fxHit, 0) / 100 });
      log("check", `Carries into combat: ${ui.fxLabel.trim()}.`);
      ui.fxLabel = "";
      ui.fxHit = "";
    });
  },
  delEffectScene(v) {
    act("Remove effect", () => {
      S.scene.effects.splice(Number(v), 1);
    });
  },
  // fight
  attack() {
    if (!K() || !["turns", "stealth"].includes(K().phase)) return;
    if (ui.atk) {
      ui.focus = "#roll";
      return render();
    }
    openAttack();
  },
  closeAtk() {
    ui.atk = null;
    render();
  },
  fire,
  atkW(v) {
    ui.atk.w = Number(v);
    ui.atk.mode = "pr";
    ui.atk.err = "";
    ui.focus = "#roll";
    render();
  },
  atkPart(v) {
    setPart(ui.atk, v);
    ui.focus = "#roll";
    render();
  },
  atkOvToggle() {
    ui.atkOv = !ui.atkOv;
    render();
  },
  atkMode(v) {
    ui.atk.mode = v;
    ui.focus = "#roll";
    render();
  },
  atkRange(v) {
    const a = ui.atk;
    if (!a.tgt) return;
    ui.focus = "#roll";
    act("Change range", () => {
      K().ranges[pairKey(a.att, a.tgt)] = clamp(rangeOf(a.att, a.tgt) + Number(v), 1, 10);
    });
  },
  atkAs(val) {
    const last = K().last[val] || {};
    const A = ent(val);
    ui.atk = { ...ui.atk, att: val, w: A.activeW || 0, mode: last.mode || "pr", tgt: targetsFor(val)[0], res: null, err: "" };
    ui.focus = "#roll";
    render();
  },
  applyHitStatus(v) {
    const r = ui.atk && ui.atk.res;
    if (!r) return;
    ui.modal = { type: "status", id: r.tgt, name: v, tier: 1, turns: "" };
    ui.focus = "#stTier";
    render();
  },
  next() {
    if (!K() || K().phase !== "turns") return;
    nextTurn();
  },
  reload() {
    const id = actorId();
    if (id) reloadWeapon(id, ui.atk ? ui.atk.w : null);
  },
  swap() {
    const id = actorId();
    const e = ent(id);
    if (!e || !(e.weapons || []).length) return;
    if (e.weapons.length < 2) return toast(`${e.name} only has one weapon.`);
    const nextW = E.get(ctx(), (e.weapons[((e.activeW || 0) + 1) % e.weapons.length] || {}).n);
    const tmv = turnMods(e);
    const swapCost =
      tmv.swapFree || (tmv.swapFreeMelee && nextW && nextW.o.tab === "MW") || (tmv.swapFreePistol && nextW && /pistol|revolver/i.test(nextW.o.type || ""))
        ? 0
        : S.rules.swapAP;
    if (!canPay(e, swapCost, "swap")) return;
    act(`Swap: ${e.name}`, () => {
      e.activeW = ((e.activeW || 0) + 1) % e.weapons.length;
      e.ap = Math.max(0, (e.ap || 0) - swapCost);
      log("status", `${e.name} swaps to ${e.weapons[e.activeW].n}, ${swapCost} AP. ${e.ap} left.`);
      if (ui.atk) ui.atk.w = e.activeW;
    });
  },
  clearJamBtn() {
    const id = actorId();
    if (id) clearJam(id);
  },
  moveModal() {
    const id = actorId();
    if (!id) return;
    const a = ui.atk;
    const ts = targetsFor(id);
    const tgt = (a && a.tgt) || (K().last[id] || {}).tgt || ts[0];
    if (!tgt) return toast("Nobody to move relative to.");
    ui.modal = { type: "move", att: id, tgt: ts.includes(tgt) ? tgt : ts[0] };
    render();
  },
  moveTo(v) {
    const m = ui.modal;
    const r = Number(v);
    const cur = rangeOf(m.att, m.tgt);
    const A = ent(m.att);
    const to = moveSpot(m.att, m.tgt, r);
    if (r !== cur && bandFor(dist(to, posOf(m.tgt))) !== r) return toast(`R${r} doesn't fit this location.`);
    const cost = r === cur ? 0 : moveCost(posOf(m.att), to, A);
    if (cost === Infinity) return toast(`${A.name} can't walk: a shattered leg.`);
    if (!canPay(A, cost, "move there")) return;
    if (E.pathBlocked(posOf(m.att), to, S.scene.objects, S.rules))
      return toast("Something in the way would have to be vaulted, or a door is shut. Drag around it on the map.");
    if (r !== cur && standBlocked(to)) return toast("That spot is inside something. Drag to a clear spot on the map.");
    act(`Move: ${A.name}`, () => {
      const a = cbOf(m.att);
      a.moved = true;
      for (const k of Object.keys(K().ranges)) if (k.split("|").includes(m.att)) delete K().ranges[k];
      A.ap = Math.max(0, (A.ap || 0) - cost);
      log("status", `${A.name} moves to R${r} of ${ent(m.tgt).name}, ${cost} AP. ${A.ap} left.`);
      walkTo(A, to);
      if (K().phase === "stealth") K().stealthDue = A.id;
      ui.modal = null;
      if (ui.atk) ui.focus = "#roll";
    });
  },
  itemModal() {
    const id = actorId() || ui.sel;
    if (!id) return;
    ui.modal = { type: "item", who: id, tgt: id, sel: null };
    render();
  },
  itemPick(v) {
    ui.modal.sel = Number(v);
    ui.modal.heal = null;
    render();
  },
  itemUse() {
    const m = ui.modal;
    const A = ent(m.who);
    const l = A.inv[m.sel];
    if (!l) return;
    const it = E.get(ctx(), l.n).o;
    const T = ent(m.tgt) || A;
    const healDefault = E.healAmount(it.effect, der(A), der(T));
    const healBoost = E.forShot(der(A), A, { round: K() ? K().round : 1, range: 1, item: it.n, itemCat: it.cat }, ctx()).m.healOut || 0; // New World Methods and similar
    const healVal = T.dbno ? 0 : num(m.heal, Math.round(healDefault * (1 + (healDefault > 0 ? healBoost : 0)))); // only a revive stands someone up
    if (S.combat && der(A).m.noItems) return toast(`${A.name} can't use items in a fight.`);
    const tm = E.forShot(der(A), A, { round: K() ? K().round : 1, range: 1, item: it.n, itemCat: it.cat }, ctx()).m;
    const itemCost = tm.itemFree
      ? 0
      : Math.max(0, (it.ap || 0) + (tm.itemAP || 0) + (it.cat === "Counter" ? tm.counterAP || 0 : 0) + (it.cat === "Drink" ? tm.drinkAP || 0 : 0));
    if (itemCost && !canPay(A, itemCost, `use ${it.n}`)) return;
    act(`Use ${l.n}`, () => {
      l.q--;
      if (l.q <= 0) A.inv.splice(m.sel, 1);
      if (S.combat && itemCost) A.ap = Math.max(0, (A.ap || 0) - itemCost);
      // Standardized use: the item says which statuses to apply, which to lower or remove, and any numbers of its own.
      const u = it.use || { applies: [], reduces: {}, removes: [], fx: {} };
      const my = der(A).m;
      const chem = ["Chem/Drug", "Alcohol"].includes(it.cat);
      // Chemist makes chems last longer, and Chem Eff makes their numbers stronger or weaker.
      const turns = it.dur != null ? Math.round(it.dur * (chem ? 1 + (my.chemDur || 0) : 1)) : null;
      const eff = chem ? 1 + (my.chemEff || 0) : 1;
      const strength = (fx) => (fx && eff !== 1 ? Object.fromEntries(Object.entries(fx).map(([k, v]) => [k, E.fix(v * eff)])) : fx);
      if (u.gives) addInv(A, u.gives[0], u.gives[1], true);
      if (u.revive && T.dbno) revive(T, it.n);
      if (u.numb) T.numbed = turns || 1; // Numbing Salve
      if (u.repairDiv) {
        const slot = (A.weapons || [])[A.activeW || 0];
        if (slot) {
          slot.cond = Math.min(10, (slot.cond != null ? slot.cond : 10) + Math.floor((der(A).skills.REP || 0) / u.repairDiv));
          log("status", `${A.name} repairs ${slot.n}: condition ${slot.cond}.`);
        }
      }
      keepFull(T, () => {
        for (const a of u.applies) applySubstance(T, a.fx ? { ...a, fx: strength(a.fx) } : a, turns, u.after, it.n, it.effect);
        for (const [n, x] of Object.entries(u.reduces)) {
          const st = (T.statuses || []).find((q) => q.n === n);
          if (st) {
            if (n === "Irradiated" && T.rads) T.rads = Math.max(0, T.rads - x * (S.rules.radStep || 200)); // RadAway flushes the rads with the tier
            st.tier -= x;
            if (st.tier < 1) T.statuses = T.statuses.filter((q) => q !== st);
          }
        }
        T.statuses = (T.statuses || []).filter((q) => !u.removes.includes(q.n));
        if (Object.keys(u.fx).length) {
          T.effects = T.effects || [];
          T.effects.push({ label: it.n, mods: strength(u.fx), turns, text: it.effect });
        }
      });
      if (healVal) {
        T.hp = Math.max(0, Math.min(der(T).hp, T.hp + healVal));
        syncDown(T);
      }
      if (S.combat && it.addict) K().used.push({ who: A.id, n: it.n, addict: Math.max(0, it.addict * (1 + (my.addict || 0))) });
      log(
        "status",
        `${A.name} uses ${it.n}${T !== A ? ` on ${T.name}` : ""}: ${it.effect || "no effect written"}${healVal ? `. ${healVal > 0 ? "+" : ""}${healVal} HP, now ${T.hp}/${der(T).hp}` : ""}.${it.addict && !S.combat ? ` Roll addiction: d100 at or under ${E.pct(it.addict)}.` : ""}`,
      );
      if (S.combat && K().phase === "stealth") K().stealthDue = A.id;
      ui.modal = m.back || null;
      addFx({ type: "float", id: T.id, icon: ITEM_VICON[it.cat] || "item", dur: 1500 });
      if (ui.atk) ui.focus = "#roll";
    });
  },
  statusModal() {
    const id = ui.rowSel || actorId();
    if (!id || !ent(id)) return;
    ui.modal = { type: "status", id, name: "", tier: 1, turns: "" };
    ui.focus = "#stName";
    render();
  },
  stAdd() {
    const m = ui.modal;
    const n = String(m.name).trim();
    if (!n) return toast("Name a status.");
    const e = ent(m.id);
    act(`Status: ${n}`, () => {
      keepFull(e, () => addStatus(e, n, num(m.tier, 1), num(m.turns)));
      log("status", `${e.name} gains ${n} ${m.tier}.`);
      ui.modal = null;
      if (ui.atk) ui.focus = "#roll";
    });
  },
  stealthRoll() {
    const k = K();
    const el = document.getElementById("stealthRoll");
    const r = num(el && el.value);
    const id = actorId();
    const e = ent(id);
    if (r == null || r < 1 || r > 20) return toast("Type the d20 roll, 1 to 20.");
    const n = Math.max(1, Math.floor(der(e).skills.SNK / S.rules.sneakDiv - S.rules.sneakSub));
    const pass = r <= n;
    act(`Stealth: ${e.name}`, () => {
      if (!pass) cbOf(id).caught = true;
      k.stealthDue = null;
      log("check", `${e.name} stealth roll: ${r} vs at or under ${n}: ${pass ? "still hidden" : `CAUGHT, ${S.rules.caughtInit} initiative`}.`);
    });
  },
  toInit() {
    act("Roll initiative", () => {
      prepInit();
      ui.atk = null;
    });
  },
  initNext(v, el) {
    const k = K();
    if (el.value !== "") {
      const c = cbOf(el.dataset.initroll);
      if (c) c.roll = num(el.value);
    }
    const blank = k.cbs.find((c) => (c.roll == null || c.roll === "") && `init-${c.id}` !== el.id);
    if (blank) {
      ui.focus = `#init-${blank.id}`;
      render();
    } else beginRounds();
  },
  beginRounds,
  rerollNpcInit() {
    act("Reroll enemy initiative", () => {
      for (const c of K().cbs) if (ent(c.id).kind === "npc") c.roll = 1 + Math.floor(Math.random() * 20);
    });
  },
  saveRoll(v, el) {
    const id = el.dataset.id;
    const r = num(el.value);
    if (r == null || r < 1 || r > 20) return toast("Type the d20 roll, 1 to 20.");
    const e = ent(id);
    const n = saveNeed(der(e).save);
    const pass = r >= n;
    act(`Save: ${e.name}`, () => {
      K().saves[id] = { roll: r, pass };
      log("check", `${e.name} saving throw: ${r} vs ${n} or more: ${pass ? "PASS" : "FAIL"}.`);
      const nx = S.chars.find((c) => c.dbno && !K().saves[c.id]);
      ui.focus = nx ? `#save-${nx.id}` : null;
    });
  },
  saveRollBtn(v) {
    const el = document.getElementById(`save-${v}`);
    if (el) ACT.saveRoll("", el);
  },
  saveUp(v) {
    const e = ent(v);
    act(`${e.name} gets up`, () => revive(e, "saving throw"));
  },
  flee(v) {
    const e = ent(v);
    act(`${e.name} flees`, () => {
      cbOf(v).fled = true;
      log("status", `${e.name} flees.`);
    });
  },
  nextRound,
  endCombat() {
    if (!K()) return;
    act("End combat", () => {
      const k = K();
      ui.atk = null;
      ui.end = null;
      if (k.phase === "init" || k.phase === "stealth") {
        S.scene.npcs = k.npcs;
        for (const c of k.cbs) S.scene.pos[c.id] = { x: c.x, y: c.y };
        S.combat = null;
        log("turn", "The fight never started.");
        return;
      }
      k.phase = "end";
      k.turnId = null;
    });
  },
  endExAdd() {
    const u = ui.end;
    const n = String(u.exN || "").trim();
    if (!n) return toast("Type an item name.");
    const it = E.get(ctx(), n);
    if (!it) return toast("No item by that name. Pick one from the list.");
    u.extra.push({ n: it.o.n, q: Math.max(1, num(u.exQ, 1)), to: u.exTo });
    u.exN = "";
    u.exQ = 1;
    ui.focus = "#exN";
    render();
  },
  endExDel(v) {
    ui.end.extra.splice(Number(v), 1);
    render();
  },
  lootAll(val) {
    const u = ui.end;
    for (const l of lootRows()) u.loot[l.key] = val;
    render();
  },
  finishCombat() {
    const u = ui.end || { xp: {}, heal: {}, loot: {}, add: {}, extra: [] };
    ui.endLootTo = ""; // 'Loot all to' is for this fight only
    act("Finish combat", () => {
      const k = K();
      const rows = lootRows();
      const gained = [];
      for (const c of S.chars) {
        const x = num(u.xp[c.id], xpFor(c));
        const d = der(c);
        const heal = num(u.heal[c.id], Math.round(d.hp * (c.dbno ? S.rules.downWinHeal || 0 : S.rules.passiveHealPct)));
        c.xp = E.fix((c.xp || 0) + x);
        if (!c.dbno) c.hp = Math.max(0, Math.min(d.hp, c.hp + heal + Math.floor(d.hp * (d.m.endHeal || 0))));
        else if (heal > 0) {
          // down when the party won: back on their feet with a share of max HP
          c.dbno = false;
          c.hp = Math.min(d.hp, heal);
        }
        /* Bounceback */ c.effects = c.effects || [];
        gained.push(`${c.name} +${x} XP, +${heal} HP`);
      }
      for (const l of u.extra || []) {
        const c = ent(l.to);
        if (c) {
          keepFull(c, () => addInv(c, l.n, l.q));
          log("status", `${c.name} takes ${l.q} x ${l.n}.`);
        }
      }
      for (const l of rows) {
        const to = u.loot[l.key];
        if (!to) continue;
        const c = ent(to);
        if (l.caps) c.caps = (c.caps || 0) + l.q;
        else keepFull(c, () => addInv(c, l.n, l.q));
        log("status", `${c.name} takes ${l.q} x ${l.n}.`);
      }
      k.used.forEach((x, i) => {
        const r = num(u.add[i]);
        const c = ent(x.who);
        if (r != null && r <= E.pct(x.addict) && c) {
          c.effects.push({ label: `Addicted: ${x.n}`, mods: {}, turns: null, text: (E.get(ctx(), x.n) || { o: {} }).o.withdrawal || "" });
          log("status", `${c.name} is now addicted to ${x.n}.`);
        }
      });
      log("turn", `Combat over after ${k.round} round${k.round === 1 ? "" : "s"}. ${gained.join("; ")}.`);
      for (const c of S.chars) c.ap = der(c).ap;
      S.combat = null;
      S.scene = freshScene(S.rules);
      ui.setup = null;
      ui.end = null;
      ui.atk = null;
    });
  },
  defeat() {
    if (!K()) return;
    act("Defeat", () => {
      K().phase = "defeat";
      K().turnId = null;
      ui.atk = null;
      ui.def = null;
    });
  },
  backToFight() {
    act("Back to the fight", () => {
      const k = K();
      k.phase = "roundEnd";
      k.saves = k.saves || {};
      ui.def = null;
    });
  },
  defMark(v) {
    const [id, how] = splitV(v);
    const c = ent(id);
    ui.def = ui.def || { lose: {}, caps: {}, xp: {} };
    const lose = (ui.def.lose[id] = {});
    (c.inv || []).forEach((l, i) => {
      const it = E.get(ctx(), l.n);
      if (how === "all" || (how === "stowed" && !l.active) || (how === "materials" && it && it.cat === "material")) lose[i] = true;
    });
    render();
  },
  finishDefeat() {
    const u = ui.def || { lose: {}, caps: {}, xp: {} };
    act("Apply defeat", () => {
      const k = K();
      const notes = [];
      for (const c of S.chars) {
        const lose = u.lose[c.id] || {};
        const gone = (c.inv || []).filter((_, i) => lose[i]);
        keepFull(c, () => {
          c.inv = (c.inv || []).filter((_, i) => !lose[i]);
        });
        const caps = num(u.caps[c.id], 0);
        c.caps = Math.max(0, (c.caps || 0) - caps);
        const x = num(u.xp[c.id], E.fix(xpFor(c) * S.rules.defeatXpPct));
        c.xp = E.fix((c.xp || 0) + x);
        if (c.dbno) {
          c.dbno = false;
          c.hp = Math.max(S.rules.reviveHP, Math.round(der(c).hp * (S.rules.downLossHeal || 0))); // down when the party lost: a smaller share
        }
        notes.push(
          `${c.name} loses ${gone.map((l) => `${fmt(l.q)} x ${l.n}`).join(", ") || "no items"}${caps ? ` and ${caps} caps` : ""}${x ? `, keeps ${x} XP` : ""}`,
        );
      }
      log("down", `Defeat after ${k.round} round${k.round === 1 ? "" : "s"}. ${notes.join("; ")}.`);
      S.combat = null;
      S.scene = freshScene(S.rules);
      ui.setup = null;
      ui.def = null;
      ui.atk = null;
    });
  },
  reroll(v) {
    const e = ent(v);
    if (e.mob) return toast("Mobs use their natural attacks.");
    act(`Reroll: ${e.name}`, () => {
      e.keepTemplateGear = false;
      E.gearUp(e, ctx(), Math.random);
      log("status", `${e.name} rerolled at tier ${e.tier}: ${e.weapons.map((w) => w.n).join(", ")}.`);
    });
  },
  makeBoss(v) {
    const e = ent(v);
    act(`Make Boss: ${e.name}`, () => {
      const r = E.makeBoss(e, ctx(), Math.random);
      log(
        "status",
        `${e.name} is now a boss: HP +${Math.round(r.hp * 100)}%, damage +${Math.round(r.dm * 100)}%, weapons up a tier, XP ${e.xp}. Weapons: ${e.weapons.map((w) => w.n).join(", ")}.`,
      );
    });
  },
  saveNamed(v) {
    const e = ent(v);
    act(`Save named NPC: ${e.name}`, () => {
      const saved = clone(e);
      delete saved.id;
      S.npcs = S.npcs.filter((n) => E.low(n.n) !== E.low(e.name));
      S.npcs.push({ n: e.name, tier: e.tier, mob: e.mob, xp: e.xp, saved });
      log("status", `${e.name} saved as a named NPC. Find them in the Enemies list.`);
    });
    toast(`${e.name} saved`);
  },
  removeNpc(v) {
    const e = ent(v);
    act(`Remove ${e.name}`, () => {
      const k = K();
      if (!k) {
        S.scene.npcs = S.scene.npcs.filter((n) => n.id !== v);
        delete S.scene.pos[v];
        ui.modal = null;
        return;
      }
      k.npcs = k.npcs.filter((n) => n.id !== v);
      k.cbs = k.cbs.filter((c) => c.id !== v);
      ui.modal = null;
      if (ui.atk && (ui.atk.tgt === v || ui.atk.att === v)) ui.atk = null;
      if (k.turnId === v) {
        const nx = order().find((c) => canAct(c) && !k.acted[c.id]);
        if (nx) startTurn(nx.id);
        else enterRoundEnd();
      }
    });
  },
  // browser
  brToggle(v) {
    ui.brOpen = ui.brOpen === v ? null : v;
    render();
  },
  brSortBy(v) {
    if (ui.brSort === v) ui.brDir = -ui.brDir;
    else {
      ui.brSort = v;
      ui.brDir = 1;
    }
    render();
  },
  brGive(v) {
    const e = ent(ui.sel);
    if (!e) return toast("Pick a character first.");
    act(`Give ${v}`, () => {
      keepFull(e, () => addInv(e, v, 1, true));
      log("status", `${e.name} gets ${v}.`);
    });
    toast(`${v} given to ${e.name}`);
  },
  brEnter() {
    const list = BR_LIST().filter(([c, o]) => (!BR_CATS[ui.brCat] || c === BR_CATS[ui.brCat]) && (!ui.brSub || brTags(c, o).includes(ui.brSub)));
    const top = rankByName(list, ui.brQ, (x) => x[1].n)[0];
    if (top) {
      ui.brOpen = top[1].n;
      render();
    }
  },
  ovReset(v) {
    act("Back to workbook value", () => {
      delete S.overrides[v];
    });
  },
  searchPick(v) {
    const hits = searchHits(ui.modal.q);
    if (!hits[Number(v)]) return;
    ui.modal = { type: "detail", hit: hits[Number(v)], q: ui.modal.q };
    render();
  },
  searchOpen() {
    const m = ui.modal;
    if (searchHits(m.q).length) ACT.searchPick(m.i || 0);
  },
  detailAdd(v) {
    const [, o] = ui.modal.hit;
    const sel = ent(K() && ui.rowSel ? ui.rowSel : ui.sel);
    if (v === "inv")
      act(`Add ${o.n}`, () => {
        keepFull(sel, () => addInv(sel, o.n, 1, true));
        log("status", `${sel.name} gets ${o.n}.`);
        ui.modal = null;
      });
    if (v === "perk")
      act(`Perk: ${o.n}`, () => {
        keepFull(sel, () => {
          sel.perks = [...(sel.perks || []), o.n];
        });
        log("status", `${sel.name} takes the perk ${o.n}.`);
        ui.modal = null;
      });
    if (v === "status")
      act(`Status: ${o.n}`, () => {
        keepFull(sel, () => addStatus(sel, o.n, 1));
        log("status", `${sel.name} gains ${o.n}.`);
        ui.modal = null;
      });
    if (v === "enemy" || v === "enemyNow") {
      ui.modal = null;
      ACT.addPick(o.n);
    }
  },
  // settings
  resetRules() {
    if (!confirm("Put every rule back to its default?")) return;
    act("Reset rules", () => {
      S.rules = mergeRules(DEFAULT_RULES, { lootTable: clone(DATA.loot) });
    });
  },
};
