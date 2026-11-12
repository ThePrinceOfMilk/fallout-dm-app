// ===== 05-fight-settings.js: FIGHT STAGES AND SETTINGS. Skill checks, stealth, initiative, the turn and attack panels, end of round, XP, loot and defeat,
// the item details, Settings (the rules editor), the side rail, UI size, auto turn options, save slots and load.
function checkBody() {
  const m = ui.chk;
  const k = K();
  const uses = [...E.SKILLS.map(([c, n]) => [c, n]), ...E.SPECIAL.map((c) => [c, E.SPECIAL_NAMES[c]])];
  const actor = k && k.turnId ? ent(k.turnId) : null;
  const who = actor && actor.kind === "npc" ? [actor, ...S.chars] : S.chars;
  const rows = who
    .map((e) => {
      const { v } = checkValue(e, m.use);
      const need = E.checkNeeded(v, num(m.target, 0), S.rules);
      const r = m.res[e.id];
      const used = S.scene.checks[e.id] || 0;
      return `<tr class="${e.dbno ? "faint" : ""}"><td class="${r ? "" : "bright"}">${h(e.name)}${!k && used >= S.rules.checksPerPlayer ? ` <span class="tag warn" title="Pre-combat checks used">${used}/${S.rules.checksPerPlayer}</span>` : ""}</td><td>${fmt(v)}</td><td class="bright nowrap">${checkRange(need)}</td><td class="faint">${E.checkOdds(need)}%</td><td style="width:74px" class="nowrap">${r ? `<span class="${r.pass ? "bright" : "warn"}">${r.roll}</span>` : numBox(`id="chk-${e.id}" maxlength="2" data-enter="chkRoll" data-id="${e.id}" placeholder="d20" aria-label="d20 for ${h(e.name)}"`, "", "cell")}${diceBtn(`chk-${e.id}`, "d20")}</td><td style="width:48px">${r ? `<span class="${r.pass ? "bright" : "warn"}">${r.pass ? "PASS" : "FAIL"}</span>${r.xp ? ` <span class="s dim" title="XP for passing">+${r.xp}</span>` : ""}` : ""}</td></tr>`;
    })
    .join("");
  const any = Object.keys(m.res).length;
  return `${m.revive && ent(m.revive) ? `<div class="banner s">Reviving ${h(ent(m.revive).name)}: type the medic's roll</div>` : ""}<div class="row wrap" style="margin-bottom:2px"><select id="chkUse" data-u="chk.use" title="Skill or SPECIAL">${options(uses, m.use)}</select><span class="s dim">VS</span><span style="width:34px">${numBox(`id="chkTarget" data-u="chk.target" title="NPC skill or difficulty"`, m.target, "cell")}</span>${Object.entries(
    S.rules.difficulty,
  )
    .map(
      ([n, x]) =>
        `<button class="opt ${num(m.target) === x ? "on" : ""}" data-a="chkPreset" data-v="${x}" title="${h(n)}">${h(n[0] === "V" ? "VH" : n[0] === "E" && n[1] === "x" ? "X" : n[0])}${x}</button>`,
    )
    .join("")}</div>
   <table class="t"><tr><th>Who</th><th>Has</th><th>d20: fail / pass</th><th>Odds</th><th>d20</th><th></th></tr>${rows}</table>
   ${any ? `<div class="row s dim" style="margin-top:2px">${btn("chkClear", "", "New check", "", "tiny")}<span class="spacer"></span>XP to passers ${numBox(`id="chkXp" style="width:36px" data-u="chk.xp" data-enter="chkXp"`, m.xp)}${btn("chkXp", "", "Add", "", "tiny")}</div>` : ""}`;
}
function stealthStage() {
  const id = actorId();
  const A = ent(id);
  const d = der(A);
  const c = cbOf(id);
  const n = Math.max(1, Math.floor(d.skills.SNK / S.rules.sneakDiv - S.rules.sneakSub));
  return `<div class="s dim" style="margin-bottom:3px">Pick a player on the left. Each action gets a d20 stealth roll. Caught means ${S.rules.caughtInit} initiative.</div>${ui.atk ? attackPanel() : ""}
   <div class="bright">${h(A.name)} <span class="tag">${c.caught ? "CAUGHT" : "HIDDEN"}</span> <span class="s dim">AP ${fmt(A.ap)}/${d.ap} · Sneak ${d.skills.SNK}</span></div>
   ${ui.atk ? "" : `<div class="acts">${btn("attack", "", "Attack", "A")}${btn("moveModal", "", "Move", "M")}${btn("itemModal", "", "Item", "I")}${btn("reload", "", "Reload", "R")}</div>`}
   ${!c.caught ? `<div class="rollrow"><span>Stealth: at or under <span class="bright">${n}</span> stays hidden <span class="tag warn" title="The Gameplay Loop says Sneak/5-5 without saying how to read it. Change it in Settings.">PROVISIONAL</span></span><input class="rollbox" id="stealthRoll" inputmode="numeric" maxlength="2" autocomplete="off" data-enter="stealthRoll" placeholder="d20" aria-label="Stealth d20 roll">${diceBtn("stealthRoll", "d20")}${btn("stealthRoll", "", "Roll", "", "tiny")}</div>` : ""}
   <div class="acts" style="margin-top:6px">${ui.atk ? "" : primary("toInit", "", "Roll initiative", "Enter")}${btn("endCombat", "", "Cancel fight")}</div>`;
}
function initStage() {
  const k = K();
  const rows = k.cbs
    .map((c) => {
      const e = ent(c.id);
      return `<tr><td>${h(e.name)}${c.caught ? ` <span class="tag bad">CAUGHT ${S.rules.caughtInit}</span>` : ""}</td><td>${fmt(c.base)}</td><td style="width:60px">${numBox(`id="init-${c.id}" data-initroll="${c.id}" data-enter="initNext" aria-label="d20 for ${h(e.name)}"`, c.roll, "cell")}${diceBtn(`init-${c.id}`, "d20")}${""}</td><td class="bright">${c.roll == null || c.roll === "" ? "-" : fmt(c.base + num(c.roll, 0))}</td></tr>`;
    })
    .join("");
  return `<div class="s dim" style="margin-bottom:3px">d20 + (AGL + PER) / 2. Type each player's roll. Enemy rolls are filled in, and you can change them.</div><table class="t"><tr><th>Who</th><th>Base</th><th>d20</th><th>Total</th></tr>${rows}</table><div class="acts" style="margin-top:6px">${primary("beginRounds", "", "Start round 1", "Enter")}${btn("rerollNpcInit", "", "Reroll enemies")}</div>`;
}
function apPips(cur, max) {
  const n = Math.min(Math.max(max, cur), 30);
  let r = "";
  for (let i = 0; i < n; i++) r += `<i class="${i < cur ? "on" : ""}"></i>`;
  return `<span class="pips" title="${fmt(cur)} of ${fmt(max)} AP">${r}</span>`;
}
const seg = (title, body, cls = "") => `<section class="seg ${cls}"><h4 class="segh">${title}</h4><div class="segb">${body}</div></section>`;
function turnStage() {
  const k = K();
  const A = ent(k.turnId);
  if (!A) return `<div class="empty">Nobody can act.</div>`;
  if (!ui.atk) makeAttack(k.turnId); // the attack menu is always up on a turn
  const d = der(A);
  const slot = (A.weapons || [])[A.activeW || 0];
  const v = slot ? E.weaponView(slot, A, d, ctx()) : null;
  const banners = [];
  if (!npcsAlive())
    banners.push(
      `<div class="banner bigend"><span>All enemies are down.</span><label class="s">Loot all to <select id="endLootTo" data-u="endLootTo" title="Who gets everything on the after-action screen. You can still change each item there.">${options([["", "Choose later"], ...S.chars.map((c) => [c.id, c.name])], ui.endLootTo || "")}</select></label><button class="btn primary big" data-a="endCombat" data-v="">${kbd("Q")}End the fight</button></div>`,
    );
  if (!partyUp())
    banners.push(
      `<div class="banner bigend bad"><span>The whole party is down.</span><button class="btn primary big" data-a="defeat" data-v="">${kbd("D")}Defeat</button></div>`,
    );
  const na = (cost) => (cost > (A.ap || 0) ? "na" : "");
  const free = (A.ap || 0) < 1 ? "na" : "";
  const cons = (A.inv || []).map((l, i) => ({ l, i, it: E.get(ctx(), l.n) })).filter((x) => x.it && x.it.cat === "item" && usable(x.it.o));
  const head = `<div class="turnhead ${A.kind === "pc" ? "" : A.ally ? "ally" : "foe"}"><div class="turnwho"><span class="turnlabel">ROUND ${k.round} // ACTING</span><span class="actname">${h(A.name)}</span></div><div class="turnap"><span class="turnlabel">ACTION POINTS</span><span class="apbig">${fmt(A.ap)}<small>/${d.ap}</small></span>${apPips(A.ap || 0, d.ap)}${ui.atk && atkView() ? `<span class="apafter">after this shot: ${fmt(Math.max(0, (A.ap || 0) - atkView().cost))}</span>` : ""}</div>${A.kind !== "pc" ? `<button class="btn autobtn" data-a="autoPlan" data-v="" title="Plan this turn for ${h(A.name)}: heal if hurt, move into range, shoot. You see the plan first, then Confirm.">Auto</button>` : ""}<button class="btn primary endturn" data-a="next" data-v="">${kbd("N")}End turn</button></div>`;
  const actions = `<div class="acts">${btn("reload", "", `Reload${v && v.usesAmmo ? ` ${fmt(v.reload)}` : ""}`, "R", v && v.usesAmmo ? na(v.reload) : "na")}${btn("swap", "", `Swap ${S.rules.swapAP}`, "", na(S.rules.swapAP))}${btn("moveModal", "", "Move", "M", free)}${slot && slot.jammed ? btn("clearJamBtn", "", `Clear jam ${v.clearJam}`, "", `primary ${na(v.clearJam)}`) : ""}${btn("check", "", "Skill check")}${btn("reviveChk", "", "Revive", "", S.chars.some((x) => x.dbno) ? "" : "na")}${btn("statusModal", "", "Status")}${d.m.inspire ? btn("inspire", "", "Inspire 2", "", na(2)) : ""}${canPray(A) ? btn("pray", "", `Pray (all ${fmt(A.ap || 0)} AP)`, "", (A.ap || 0) > 0 ? "" : "na", `Spend the rest of the turn in prayer: ${S.rules.prayer.status} for ${S.rules.prayer.rounds} rounds`) : ""}</div>`;
  const throws = (A.inv || []).filter((l) => (S.rules.throwables || {})[l.n]);
  const throwBtns = throws
    .map(
      (l) =>
        `<button class="opt" data-a="throwStart" data-v="${A.id}|${h(l.n)}" title="Throw it: pick where it lands on the map">${pix("bomb")} Throw ${h(l.n)} x${fmt(l.q)} <small>${S.rules.throwables[l.n].ap}AP</small></button>`,
    )
    .join("");
  const consBody =
    throwBtns +
      cons
        .map(
          (x) =>
            `<button class="opt consopt" data-a="useItemFrom" data-v="${A.id}|${x.i}" title="${h(x.it.o.effect || "")}"><span class="consn">${itemIcon(x.l.n)} ${h(x.l.n)} <b>x${fmt(x.l.q)}</b>${x.it.o.ap ? ` <small>${x.it.o.ap} AP</small>` : ""}</span><span class="consfx">${h(consText(x.it.o))}</span></button>`,
        )
        .join("") || `<span class="s dim">None carried.</span>`;
  return `${head}${autoBox(A)}${banners.join("")}<div class="segs">${ui.atk ? attackPanel() : seg("Attack", `<span class="s dim">${h(A.name)} has no weapon.</span>`)}${seg("Actions", actions, "half")}${seg("Consumables", `<div class="conslist">${consBody}</div>`, "half")}${d.notes.length ? seg(`For the DM <small>${d.notes.length}</small>`, fold(`rem:${A.id}`, "Reminders", d.notes.map((n) => `<div class="txt s">${h(n)}</div>`).join("")), "half") : ""}${(S.scene.effects || []).length ? seg("Carried over", S.scene.effects.map((f) => `<div class="txt s">${h(f.label)}${f.hit ? `: ${f.who} ${E.pct(f.hit)}% to hit` : ""}</div>`).join(""), "half") : ""}</div>`;
}
function bodyFig(a, T) {
  const hurt = new Set();
  for (const st of (T && T.statuses) || []) for (const p of st.parts || []) hurt.add(p);
  const b = (id, lab) => {
    const [name, loc] = PARTS[id];
    const x = S.rules.targetAP[loc];
    return `<button class="bp bp-${id} ${a.part === id ? "on" : ""} ${hurt.has(id) ? "hurt" : ""}" data-a="atkPart" data-v="${id}" aria-label="${name}" title="${name}: damage x${S.rules.loc[loc]}${(S.rules.locHit || {})[loc] && S.rules.locHit[loc] !== 1 ? `, hit chance x${S.rules.locHit[loc]}` : ""}${x ? `, +${x} AP` : ""}">${lab}</button>`;
  };
  const friendly = T && sideOf(a.att) === sideOf(T.id); // bright green for your own side, bright red for the other side
  return `<div class="body ${friendly ? "friendly" : "hostile"}">${b("Head", "H")}${b("LArm", "")}${b("Body", "B")}${b("RArm", "")}${b("LLeg", "")}${b("RLeg", "")}</div>`;
}
function attackPanel() {
  const p = atkView();
  if (!p) return "";
  const { a, A, T, v, range, hc, spans, warn } = p;
  const k = K();
  const live = /^\d{1,2}$/.test(String(a.roll).trim()) ? E.classify(Number(a.roll), p.b) : "";
  const weapons = A.weapons
    .map((s, i) => {
      const w = E.weaponView(s, A, p.dA, ctx());
      return `<button class="wcard ${a.w === i ? "on" : ""}" data-a="atkW" data-v="${i}" title="${h(s.n)}">${itemIcon(s.n)}<span class="nm">${h(s.n)}</span><small>${fmt(w.ap)}AP${w.usesAmmo ? ` ${s.mag || 0}/${w.cap} +${ammoHeld(A, w.reserve)}` : ""}${s.jammed ? " JAM" : ""}</small></button>`;
    })
    .join("");
  const loads = loadsHeld(A, v, p.slot);
  const bars = spans
    .map(
      (s) =>
        `<div class="${s.id} ${live === s.id ? "lit" : ""}" style="flex:${Math.max(s.to - s.from + 1, 1)} 0 0" title="${s.label} ${E.two(s.from)}-${E.two(s.to)}">${s.to - s.from >= 7 ? s.label : ""}</div>`,
    )
    .join("");
  const w = E.get(ctx(), v.n);
  const r = a.res;
  const hitPct = Math.round(E.pct(p.hit));
  const foe = T && sideOf(T.id) !== sideOf(A.id);
  const tgt = T
    ? `<div class="tgtcard ${foe ? "foe" : "friend"}"><span class="tgtside">${foe ? "ENEMY" : "ALLY"}</span><span class="nm grow">${h(T.name)}</span><span class="s">${fmt(T.hp)}/${p.dT.hp} HP · DT ${fmt(p.dT.dt)}</span></div>${hpBar(T.hp, p.dT.hp)}${chips(T)}`
    : `<div class="warnline">Click an enemy on the map or in the list.</div>`;
  const ovr = ui.atkOv
    ? `<div class="ovrow s">Hit%${numBox(`id="ovHit" data-u="atk.ov.hit"`, a.ov.hit)} Bullets${numBox(`id="ovB" data-u="atk.ov.bullets"`, a.ov.bullets)} Dmg${numBox(`id="ovD" data-u="atk.ov.dmg"`, a.ov.dmg)}<label class="chk"><input type="checkbox" id="ovFree" data-u="atk.ov.free"${a.ov.free ? " checked" : ""}>Free</label><select id="ovCover" data-u="atk.ov.cover" title="Cover on this shot"><option value="">Cover: from map</option>${options(
        Object.entries(S.rules.cover).map(([id, t]) => [id, t.n]),
        a.ov.cover || "",
      )}</select><select data-c="atkAs" id="atkAs" title="Acting as">${options(
        k.cbs.filter(alive).map((c) => [c.id, ent(c.id).name]),
        a.att,
      )}</select></div>`
    : "";
  // What each kind of attack with this weapon costs: aimed at body, a limb or the head, the other fire mode, plus swap and reload.
  const swapAP = a.w !== (A.activeW || 0) && !v.punch ? S.rules.swapAP : 0;
  const tAP = S.rules.targetAP || {};
  const modeAP = (mode) => E.weaponView(p.slot, A, p.dA, ctx(), mode).ap;
  const LH = S.rules.locHit || {};
  const apTypes = [
    ["Shot", v.ap + (tAP[a.loc] || 0)],
    ["Body", `x${LH.Body != null ? LH.Body : 1} hit`],
    ["Limb", `x${LH.Limb != null ? LH.Limb : 1} hit`],
    ["Head", `x${LH.Head != null ? LH.Head : 1} hit`],
    ...(v.hasSecondary ? [[`${a.mode === "se" ? "1st" : "2nd"} mode`, modeAP(a.mode === "se" ? "pr" : "se")]] : []),
    ...(swapAP ? [["Swap", `+${swapAP}`]] : []),
    ...(v.usesAmmo ? [["Reload", v.reload]] : []),
  ];
  const apRow = `<div class="aptypes">${apTypes.map(([n, c]) => `<span class="apt ${n === a.loc ? "on" : ""}"><b>${typeof c === "number" ? fmt(c) : c}</b>${h(n)}</span>`).join("")}</div>`;
  const loadout = `<div class="wcards">${kbd("W")}${weapons}</div>${apRow}
   ${v.hasSecondary ? `<div class="opts"><button class="opt ${a.mode !== "se" ? "on" : ""}" data-a="atkMode" data-v="pr">1st ${h(w.o.prName || "")}</button><button class="opt ${a.mode === "se" ? "on" : ""}" data-a="atkMode" data-v="se">2nd ${h(w.o.seName || "")}</button></div>` : ""}
   ${
     loads.length
       ? `<select id="atkLoad" style="width:100%" data-c="setLoad" data-id="${A.id}" data-i="${a.w}"><option value="">Choose ammo</option>${options(
           loads.map((x) => [
             x.n,
             `${x.load} (${x.n === p.slot.ammo ? `${p.slot.mag || 0} loaded, ` : ""}${ammoHeld(A, x.n)} held): Dam ${x.pellets ? x.dam + "x" + x.pellets : (x.dam ?? "?")} Pen ${x.pen ?? 0}`,
           ]),
           p.slot.ammo,
         )}</select>`
       : v.caliber
         ? `<div class="warnline">No ${h(v.caliber)} ammo in inventory.</div>`
         : ""
   }`;
  const tile = (lab, val, sub, cls = "", tip = "") =>
    `<div class="ttile ${cls}"${tip ? ` title="${h(tip)}"` : ""}><span class="tl">${lab}</span><b>${val}</b><small>${sub}</small></div>`;
  const tiles = `<div class="ttiles">${tile("Hit", `${hitPct}%`, num(a.ov.hit) != null ? "DM SET" : "chance", `hitt ${hitPct <= 0 ? "zero" : ""}`)}${tile("Aim", `x${S.rules.loc[a.loc]}`, `${h(PARTS[a.part][0])}${(S.rules.locHit || {})[a.loc] && S.rules.locHit[a.loc] !== 1 ? ` · hit x${S.rules.locHit[a.loc]}` : ""}`, "", "Damage multiplier for the part aimed at; limbs are easier to hit and the head harder. Click the body to change it.")}${tile("Cost", `${fmt(p.cost)} AP`, `${fmt(Math.max(0, (A.ap || 0) - p.cost))} left`, `costbig ${p.cost > (A.ap || 0) && !a.ov.free ? "over" : ""}`)}${tile("Cover", h(p.cov.n), `${p.cov.hit ? `${fmt(E.pct(p.cov.hit))}% hit` : "no penalty"}${p.cov.dam ? ` ${fmt(E.pct(p.cov.dam))}% dmg` : ""}`, `covflag tier-${p.cov.tier}`, p.cov.by ? "Blocked by: " + p.cov.by : "Nothing in the way")}${tile("Range", `<button class="xb" data-a="atkRange" data-v="-1" title="Closer">-</button>R${range}<button class="xb" data-a="atkRange" data-v="1" title="Farther">+</button>`, `${T ? `${dist(posOf(A.id), posOf(T.id)).toFixed(1)}m · ` : ""}${k.ranges[pairKey(a.att, a.tgt)] != null ? "DM set" : "from map"}`, "rng")}${tile("Damage", `${v.pellets ? `${fmt(v.base)}x${v.pellets}` : fmt(v.base)}`, `Pen ${fmt(v.pen)}${v.count > 1 ? ` · burst ${v.count}` : ""}`)}</div>`;
  const targeting = `<div class="atkmid">${T ? bodyFig(a, T) : ""}<div class="atkinfo">${tgt}${tiles}
     <div class="math">HIT ${h(E.hitLine(hc))}${num(a.ov.hit) != null ? ` <span class="warn">DM SET ${h(a.ov.hit)}%</span>` : ""}${p.extra || p.swap ? ` · AP ${fmt(v.ap)}${p.extra ? ` +${p.extra} aimed` : ""}${p.swap ? ` +${p.swap} swap` : ""}` : ""}</div></div></div>`;
  const short = {
    jam: (s) => `${E.two(s.to + 1)} -`,
    hit: (s) => `${E.two(s.from)} +`,
    crit: (s) => `${E.two(s.from)} ++`,
    super: (s) => `${E.two(s.from)} $$$`,
  };
  const bandShort =
    spans
      .filter((s) => short[s.id])
      .map((s) => `<span class="bs bs-${s.id}" title="${s.label}: ${E.two(s.from)}-${E.two(s.to)}">${h(short[s.id](s))}</span>`)
      .join("") || `<span class="bs bs-jam">No hit possible</span>`;
  const rolling = `<div class="bands">${bars}</div><div class="bandtext bandshort" title="${h(E.bandText(p.b))}">${bandShort}</div>
   <div class="rollrow"><input class="rollbox" id="roll" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="00" value="${h(a.roll)}" data-u="atk.roll" data-enter="fire" aria-label="Two-dice roll, 00 to 99">${diceBtn("roll", "2d10")}${btn("fire", "", "Resolve", "Enter", `primary ${p.cost > (A.ap || 0) && !a.ov.free ? "na" : ""}`)}<span class="spacer"></span><button class="btn tiny ${ui.atkOv ? "on" : ""}" data-a="atkOvToggle" data-v="" title="Overrides">OVR</button>${K().phase === "stealth" ? btn("closeAtk", "", "Close", "Esc", "tiny") : ""}</div>${ovr}
   ${a.err ? `<div class="errline">${h(a.err)}</div>` : ""}${warn.map((x) => `<div class="warnline">${h(x)}</div>`).join("")}
   ${
     r
       ? `<div class="result ${r.outcome}">${(() => {
           const facts = `${r.name}: ${h(r.head)}${r.math ? `<br>${h(r.math)}<br>${h(r.tName)} ${r.hp}/${r.max} HP${r.hp <= 0 ? " DOWN" : ""}` : ""}${r.ammoText ? ` · ${h(r.ammoText)}` : ""}${(r.auto || []).length ? `<br>Applied: ${h(r.auto.join(", "))}` : ""}`;
           return r.story
             ? `<details class="shotmore" data-k="atkres"${ui.open.atkres ? " open" : ""}><summary><span class="story">${h(r.story)}</span><span class="moretag">${ui.open.atkres ? "less" : "details"}</span></summary><div class="facts">${facts}</div></details>`
             : facts;
         })()}${r.outcome === "jam" ? `<br>Press J to clear the jam.` : ""}${r.status ? `<br>${btn("applyHitStatus", r.status, `Apply ${h(r.status)} to ${h(r.tName)}`, "", "tiny")}` : ""}${r.radius ? `<br><span class="warn">Blast radius ${r.radius}: apply damage to anyone else in it by typing their HP.</span>` : ""}</div>`
       : ""
   }`;
  return `${seg("Loadout", loadout, "full")}${seg("Target", targeting, "full")}${seg("Roll", rolling, "full hot")}`;
}
function roundEndStage() {
  const k = K();
  const down = S.chars.filter((c) => c.dbno);
  const rows = down
    .map((c) => {
      const d = der(c);
      const sv = (k.saves || {})[c.id];
      return `<div class="line"><span class="grow"><span class="bright">${h(c.name)}</span> <span class="s dim">save on ${saveNeed(d.save)} or more${c.timesRevived ? `, revived ${c.timesRevived}x` : ""}</span></span>${sv ? `<span class="${sv.pass ? "bright" : "warn"}">${sv.pass ? "PASS" : "FAIL"} rolled ${sv.roll}</span>${btn("saveUp", c.id, `Up at ${S.rules.reviveHP} HP with Shock`, "", sv.pass ? "tiny primary" : "tiny")}` : `<input class="rollbox" style="width:44px;height:22px;font-size:var(--fs)" id="save-${c.id}" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="d20" data-enter="saveRoll" data-id="${c.id}" aria-label="Saving throw for ${h(c.name)}">${diceBtn(`save-${c.id}`, "d20")}${btn("saveRollBtn", c.id, "Roll", "", "tiny")}`}</div>`;
    })
    .join("");
  const npcs = k.cbs.filter((c) => sideOf(c.id) === "npc" && alive(c));
  return `${down.length ? `<h3>Saving throws <span class="tag warn" title="What a passed save does is not decided yet, so you choose.">YOUR CALL</span></h3>${rows}<div class="s dim">Roll a d20: the number or more passes (20 is best). What a pass does isn't decided yet, so you choose.</div>` : ""}
   ${npcs.length ? fold("flee", "Enemies fleeing", npcs.map((c) => `<div class="line"><span class="grow">${h(ent(c.id).name)}</span>${btn("flee", c.id, "Fled", "", "tiny")}</div>`).join(""), { badge: npcs.length }) : ""}
   <div class="acts" style="margin-top:6px">${primary("nextRound", "", `Start round ${k.round + 1}`, "Enter")}</div>`;
}
function xpFor(pc) {
  const k = K();
  const dead = k.cbs
    .filter((c) => c.dead)
    .map((c) => ({ c, e: ent(c.id) }))
    .filter((x) => x.e && x.e.kind === "npc" && !x.e.ally);
  const total = dead.reduce((t, x) => t + (x.e.xp || 0), 0);
  const base =
    S.rules.xpAward === "each"
      ? total
      : S.rules.xpAward === "split"
        ? total / Math.max(1, S.chars.length)
        : dead.filter((x) => x.c.killer === pc.id).reduce((t, x) => t + (x.e.xp || 0), 0);
  return E.fix(E.xpGain(base, der(pc).sp.I, S.rules) * (1 + (der(pc).m.xpMul || 0)));
}
// Looting skill: Survival + lootLuck x Luck, from the best looter still standing. 100 Survival and 1 Luck equals 10 and 10.
function lootScore() {
  let best = { score: 0, who: null };
  for (const c of S.chars.filter((x) => !x.dbno)) {
    const d = der(c);
    const sc = (d.skills.SUR || 0) + (S.rules.lootLuck || 0) * (d.sp.L || 0);
    if (sc > best.score) best = { score: sc, who: c };
  }
  return best;
}
// Same body, same numbers every time the screen redraws.
const seeded = (str) => {
  let x = 2166136261;
  for (const ch of String(str)) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return () => {
    x = Math.imul(x ^ (x >>> 15), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    return ((x ^= x >>> 16) >>> 0) / 4294967296;
  };
};
function lootRows() {
  const rows = [];
  const score = lootScore().score;
  const share = clamp(score / (S.rules.lootFull || 1), 0, 1);
  const partyAmmo = [
    ...new Set(
      S.chars.flatMap((c) =>
        (c.weapons || []).map((sl) => sl.ammo || (E.get(ctx(), sl.n) || { o: {} }).o.ammo).filter((n) => n && n !== "N/A" && E.get(ctx(), n)),
      ),
    ),
  ];
  for (const c of K().cbs.filter((x) => x.dead)) {
    const e = ent(c.id);
    if (!e || e.kind !== "npc" || e.mob || e.ally) continue;
    const rng = seeded(e.id);
    // Weapons, the ammo they load and worn armor always come off the body.
    (e.weapons || []).forEach((s, i) => (E.get(ctx(), s.n) || { o: {} }).o.tier && rows.push({ key: `${e.id}:w${i}`, n: s.n, q: 1, from: e.name }));
    for (const g of ["head", "armor", "vanity"]) if (e.gear && e.gear[g]) rows.push({ key: `${e.id}:${g}`, n: e.gear[g], q: 1, from: e.name });
    const loaded = new Set((e.weapons || []).map((s) => E.low(s.ammo || (E.get(ctx(), s.n) || { o: {} }).o.ammo)));
    // Everything else depends on how well the party searches.
    (e.inv || []).forEach((l, i) => {
      const q = loaded.has(E.low(l.n)) ? l.q : Math.floor(l.q * share + rng());
      if (q > 0) rows.push({ key: `${e.id}:i${i}`, n: l.n, q, from: e.name });
    });
    const caps = Math.round((e.caps || 0) * share * (1 + Math.max(0, ...S.chars.map((x) => der(x).m.capsMul || 0))));
    if (caps) rows.push({ key: `${e.id}:caps`, n: "Caps", q: caps, from: e.name, caps: true });
    // Extra finds: mostly consumables and ammo, some junk. A higher score finds more, and better things.
    // a good d20 loot roll on the end screen adds a find or two to each body, a tier better
    const lr = num((ui.end || {}).lootRoll),
      LB = S.rules.lootRollBonus || {};
    const bonus = lr == null ? 0 : lr >= (LB.great || 20) ? 2 : lr >= (LB.good || 17) ? 1 : 0;
    const n = Math.min(S.rules.lootFindMax || 0, Math.floor(score * (S.rules.lootFind || 0) * (0.5 + rng() * 0.5))) + bonus;
    const cap = (e.tier || 1) + Math.floor(score / 100) + (bonus ? 1 : 0);
    const tries = 1 + Math.floor(score / 80);
    const best = (pool) => {
      let pick = null;
      for (let t = 0; t < tries && pool.length; t++) {
        const o = pool[Math.floor(rng() * pool.length)];
        if (!pick || E.valueOf(ctx(), o.n).val > E.valueOf(ctx(), pick.n).val) pick = o;
      }
      return pick;
    };
    const cons = DATA.items.filter(
      (i) => i.effect && Number(i.tier) && Number(i.tier) <= cap && ["Healing", "Chem/Drug", "Drink", "Food", "Alcohol"].includes(i.cat),
    );
    const junk = DATA.materials.filter((m) => !m.tier || Number(m.tier) <= cap);
    for (let i = 0; i < n; i++) {
      const r = rng();
      let it = null,
        q = 1;
      if (r < 0.45) it = best(cons);
      else if (r < 0.8 && partyAmmo.length) {
        it = { n: partyAmmo[Math.floor(rng() * partyAmmo.length)] };
        q = 3 + Math.floor(rng() * (score / 10));
      } else it = best(junk);
      if (it) rows.push({ key: `${e.id}:f${i}`, n: it.n, q, from: `${e.name}, ${i >= n - bonus ? "good roll" : "found"}` });
    }
  }
  return rows;
}
function endStage() {
  const k = K();
  const u = (ui.end = ui.end || { xp: {}, heal: {}, loot: {}, add: {}, lootRoll: "", extra: [], exN: "", exQ: 1, exTo: (S.chars[0] || {}).id });
  // picked on the End the fight banner: every item starts out going to them
  if (ui.endLootTo && !u.prefilled && ent(ui.endLootTo)) {
    u.prefilled = true;
    for (const l of lootRows()) u.loot[l.key] = ui.endLootTo;
  }
  u.extra = u.extra || [];
  const pcs = S.chars
    .map((c) => {
      const d = der(c);
      const x = u.xp[c.id] != null ? u.xp[c.id] : xpFor(c);
      const heal = u.heal[c.id] != null ? u.heal[c.id] : Math.round(d.hp * (c.dbno ? S.rules.downWinHeal || 0 : S.rules.passiveHealPct));
      return `<tr><td class="bright">${h(c.name)}${c.dbno ? ` <span class="tag bad">DBNO</span>` : ""}</td><td>${fmt(c.hp)}/${d.hp}</td><td style="width:70px">${numBox(`id="heal-${c.id}" data-u="end.heal.${c.id}" aria-label="Heal for ${h(c.name)}"`, heal, "cell")}</td><td style="width:70px">${numBox(`id="xp-${c.id}" data-u="end.xp.${c.id}" aria-label="XP for ${h(c.name)}"`, x, "cell")}</td></tr>`;
    })
    .join("");
  const loot = lootRows();
  const shift = num(u.lootRoll) != null ? (S.rules.lootTable.find((r) => r[0] === num(u.lootRoll)) || [0, 0])[1] : null;
  const who = S.chars.map((c) => [c.id, c.name]);
  const extras = u.extra
    .map(
      (l, i) =>
        `<tr><td class="bright">${itemIcon(l.n)} ${h(l.n)}</td><td>${fmt(l.q)}</td><td class="dim">Added by DM</td><td><select id="exTo-${i}" data-u="end.extra.${i}.to">${options([["", "Leave"], ...who], l.to || "")}</select> <button class="btn tiny" data-a="endExDel" data-v="${i}" title="Remove">X</button></td></tr>`,
    )
    .join("");
  const dropRows = loot
    .map(
      (l) =>
        `<tr><td class="bright">${l.caps ? pix("dot") : itemIcon(l.n)} ${h(l.n)}</td><td>${l.q}</td><td class="dim">${h(l.from)}</td><td><select id="loot-${h(l.key.replace(":", "-"))}" data-u="end.loot.${h(l.key)}">${options([["", "Leave"], ...who], u.loot[l.key] || "")}</select></td></tr>`,
    )
    .join("");
  const ls = lootScore();
  const lootNote = `<div class="s dim" style="margin-bottom:3px" title="Survival + ${S.rules.lootLuck} x Luck. Weapons, their ammo and armor always drop; the rest and extra finds depend on this.">Looting: ${ls.who ? h(ls.who.name) : "nobody"} scores ${fmt(ls.score)} of ${S.rules.lootFull}: ${Math.round(clamp(ls.score / (S.rules.lootFull || 1), 0, 1) * 100)}% of the rest on each body</div>`;
  const lootBody =
    lootNote +
    `<div class="row wrap" style="margin-bottom:3px"><label class="chk s">Give all to <select data-c="lootAll" id="lootAll" style="margin-left:4px"><option value="">Choose</option>${options(who, "")}</select></label><span class="spacer"></span><span class="s dim">Loot roll d20</span><span style="width:40px">${numBox(`id="lootRoll" data-u="end.lootRoll"`, u.lootRoll, "cell")}${diceBtn("lootRoll", "d20")}${""}</span>${shift != null ? `<span class="bright s">average tier ${shift >= 0 ? "+" : ""}${shift}</span>` : ""}</div>${dropRows || extras ? `<table class="t"><tr><th>Item</th><th>Qty</th><th>From</th><th>Goes to</th></tr>${dropRows}${extras}</table>` : `<div class="s dim">Nothing dropped.</div>`}
    <div class="row wrap lootadd"><input id="exN" class="grow" autocomplete="off" list="dl-all" placeholder="Add an item to the loot: type a name" data-u="end.exN" value="${h(u.exN)}" data-enter="endExAdd"><span style="width:40px">${numBox(`id="exQ" data-u="end.exQ" title="How many"`, u.exQ, "cell")}</span><select id="exTo" data-u="end.exTo" title="Goes to">${options(who, u.exTo)}</select>${btn("endExAdd", "", "Add", "", "tiny")}</div>`;
  const banner = `<div class="turnhead"><div class="turnwho"><span class="turnlabel">COMBAT OVER // ${k.round} ROUND${k.round === 1 ? "" : "S"}</span><span class="actname">After Action</span></div><span></span><button class="btn primary endturn" data-a="finishCombat" data-v="">Finish and apply</button></div>`;
  return `${banner}<div class="segs">${seg("XP and healing", `<table class="t"><tr><th>Who</th><th>HP</th><th title="Passive heal has no number in the sheet. Set it in Settings.">Heal</th><th title="Who earns enemy XP is not decided. Change it in Settings.">XP: ${h(S.rules.xpAward)}</th></tr>${pcs}</table>`)}${seg("Loot", lootBody)}${k.used.length ? seg("Addiction rolls", k.used.map((x, i) => `<div class="line"><span class="grow">${h(ent(x.who) ? ent(x.who).name : "")} used ${h(x.n)}: d100 at or under ${E.pct(x.addict)} = addicted</span><span style="width:44px">${numBox(`id="add-${i}" data-u="end.add.${i}" aria-label="d100"`, u.add[i], "cell")}${diceBtn(`add-${i}`, "d100")}${""}</span></div>`).join("")) : ""}</div>`;
}
function defeatStage() {
  const u = (ui.def = ui.def || { lose: {}, caps: {}, xp: {} });
  const blocks = S.chars
    .map((c) => {
      const lose = u.lose[c.id] || {};
      const count = Object.values(lose).filter(Boolean).length;
      return fold(
        `def:${c.id}`,
        h(c.name),
        `<div class="opts" style="margin-bottom:3px">${btn("defMark", `${c.id}|all`, "Mark all", "", "tiny")}${btn("defMark", `${c.id}|stowed`, "Mark stowed", "", "tiny")}${btn("defMark", `${c.id}|materials`, "Mark materials", "", "tiny")}${btn("defMark", `${c.id}|none`, "Clear", "", "tiny")}</div>${(c.inv || []).map((l, i) => `<label class="chk" style="display:flex"><input type="checkbox" data-u="def.lose.${c.id}.${i}"${lose[i] ? " checked" : ""} id="dl-${c.id}-${i}">${fmt(l.q)} x ${h(l.n)}</label>`).join("") || `<div class="dim">Empty.</div>`}<div class="grid" style="margin-top:3px">${field(`Caps lost (has ${fmt(c.caps)})`, numBox(`id="dc-${c.id}" data-u="def.caps.${c.id}"`, u.caps[c.id]))}${field("XP kept", numBox(`id="dx-${c.id}" data-u="def.xp.${c.id}"`, u.xp[c.id] != null ? u.xp[c.id] : E.fix(xpFor(c) * S.rules.defeatXpPct)))}</div>`,
        { badge: count ? `${count} lost` : "", open: true },
      );
    })
    .join("");
  return `<div class="s dim" style="margin-bottom:3px">The party lost. Nobody dies: choose what it costs them. Anyone who is down comes back up on ${E.pct(S.rules.downLossHeal || 0)}% of their HP.</div><div class="acts">${btn("finishDefeat", "", "Apply defeat", "F", "primary")}${btn("backToFight", "", "Back to the fight")}</div>${blocks}`;
}

// ----- item browser
const BR_CATS = { All: null, Items: "item", Weapons: "weapon", Armor: "armor", Ammo: "ammo", Materials: "material", Mods: "mod" };
const BR_LIST = () => [
  ...DATA.items.map((o) => ["item", o]),
  ...DATA.weapons.filter((w) => w.tier).map((o) => ["weapon", o]),
  ...DATA.armor.filter((a) => a.tier && a.tier < 100).map((o) => ["armor", o]),
  ...DATA.ammo.map((o) => ["ammo", o]),
  ...DATA.materials.map((o) => ["material", o]),
  ...DATA.mods.map((o) => ["mod", o]),
];
function statText(c, o) {
  if (c === "weapon")
    return o.ok === false || !o.ok
      ? "blank stats"
      : o.tab === "MW"
        ? `Dam ${fmt(o.dmg)} Pen ${fmt(o.pen)} ${fmt(o.ap)}AP`
        : `${o.ammo || ""}${o.dmg != null ? ` Dam ${fmt(o.dmg)} Pen ${fmt(o.pen)}` : ""} ${fmt(o.ap)}AP${o.count > 1 ? ` x${o.count}` : ""}`;
  if (c === "ammo") return `Dam ${o.pellets ? o.dam + "x" + o.pellets : (o.dam ?? "?")} Pen ${o.pen ?? 0}`;
  if (c === "armor") return `${o.loc} DT ${o.dt || 0}${o.buffs ? " " + o.buffs : ""}`;
  if (c === "item") return o.effect || "no effect written";
  if (c === "mod") return `${o.loc || ""} ${o.effect || "no effect written"}`;
  return o.note || o.cat || "";
}
function itemsBody() {
  const cat = BR_CATS[ui.brCat];
  const merged = (o) => ({ ...o, ...(S.overrides[E.low(o.n)] || {}) });
  let rows = BR_LIST()
    .filter(([c]) => !cat || c === cat)
    .map(([c, o]) => [c, merged(o)])
    .filter(([, o]) => !ui.brTier || String(o.tier) === String(ui.brTier));
  const q = E.low(ui.brQ);
  if (q) {
    rows = rankByName(rows, q, (x) => x[1].n);
  } else {
    const key = ui.brSort;
    const dir = ui.brDir;
    rows = [...rows].sort((a, b) => {
      const x = key === "c" ? a[0] : a[1][key],
        y = key === "c" ? b[0] : b[1][key];
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""))) * dir;
    });
  }
  const shown = rows.slice(0, 60);
  const body = shown
    .map(([c, o], i) => {
      const open = ui.brOpen === o.n;
      return `<tr class="click" data-a="brToggle" data-v="${h(o.n)}"><td title="${h(c)}" style="width:20px">${itemIcon(o.n)}</td><td class="bright" title="${h(o.n)}">${h(o.n)}</td><td>${o.tier != null && o.tier !== "" ? h(o.tier) : "-"}</td><td title="${h(statText(c, o))}">${h(statText(c, o))}</td><td title="${fmt(o.lb)}">${Number((o.lb || 0).toFixed(2))}</td><td>${o.val != null ? fmt(o.val) : "-"}</td><td style="overflow:visible"><button class="btn tiny" data-a="brGive" data-v="${h(o.n)}" title="Give one">+</button></td></tr>${open ? `<tr><td class="open" colspan="7"><div style="padding:3px 0">${detailFields(o, E.low(o.n), BR_LIST().find(([, x]) => x.n === o.n)[1], `br${i}`)}</div></td></tr>` : ""}`;
    })
    .join("");
  const th = (k, l, w) => `<th style="width:${w}" data-a="brSortBy" data-v="${k}">${l}${ui.brSort === k && !q ? (ui.brDir > 0 ? " ^" : " v") : ""}</th>`;
  return `<div class="row wrap" style="margin-bottom:3px"><input id="brQ" class="grow" autocomplete="off" placeholder="Search items" data-u="brQ" value="${h(ui.brQ)}" data-enter="brEnter"><select id="brCat" data-u="brCat" title="Type">${options(Object.keys(BR_CATS), ui.brCat)}</select><select id="brTier" data-u="brTier" title="Tier">${options([["", "All T"], ...[1, 2, 3, 4, 5, 6].map((t) => [t, "T" + t])], ui.brTier)}</select><label class="chk s">+ GIVES TO <select id="brWho" data-u="sel" style="margin-left:4px">${options(
    S.chars.map((c) => [c.id, c.name]),
    ui.sel,
  )}</select></label></div>
    <div class="itab"><table class="t"><tr><th style="width:20px" data-a="brSortBy" data-v="c"></th>${th("n", "Name", "30%")}${th("tier", "T", "4%")}<th>Stats</th>${th("lb", "Lb", "7%")}${th("val", "Cap", "7%")}<th style="width:24px"></th></tr>${body}</table></div>${rows.length > shown.length ? `<div class="s dim">Showing ${shown.length} of ${rows.length}. Search to narrow it down.</div>` : ""}`;
}
const PCT_FIELDS = new Set(["crit", "jam", "base", "addict"]);
function detailFields(o, key, base, idp) {
  const rows = Object.entries(o)
    .filter(([k]) => k !== "n" && k !== "tab" && k !== "skill")
    .map(([k, v], i) => {
      if (Array.isArray(v) && k === "hit")
        return `<div class="full"><div class="s dim">BASE HIT % R1 TO R10</div><div class="hitgrid">${v.map((x, j) => numBox(`data-ov="${h(key)}|hit.${j}|pct" id="${idp}-h${j}" title="R${j + 1}"`, x == null ? "" : E.pct(x), "cell")).join("")}</div></div>`;
      if (Array.isArray(v)) return `<div class="full s dim">${h(k)}: ${h(JSON.stringify(v))}</div>`;
      if (typeof v === "boolean")
        return `<label class="chk s"><input type="checkbox" data-ov="${h(key)}|${k}|bool" id="${idp}-${i}"${v ? " checked" : ""}>${h(k)}</label>`;
      const isPct = PCT_FIELDS.has(k);
      return `<label class="f ${String(v).length > 28 ? "full" : ""}">${h(k)}${isPct ? " %" : ""}<input type="text" autocomplete="off" data-ov="${h(key)}|${k}|${isPct ? "pct" : typeof v === "number" ? "num" : "text"}" id="${idp}-${i}" value="${h(isPct ? E.pct(v) : v)}"></label>`;
    })
    .join("");
  return `<div class="kv">${rows}</div>${S.overrides[key] ? `<div class="s warn" style="margin-top:3px">Edited by you. ${btn("ovReset", key, "Back to workbook value", "", "tiny")}</div>` : ""}`;
}

// ----- settings column
function settingsBody() {
  const r = S.rules;
  const input = ([path, label, type, flag]) => {
    const val = getPath(r, path);
    const star = flag ? ` <span class="warn" title="Picked for this draft because the sheet and the brief leave it open.">*</span>` : "";
    if (type === "bool")
      return `<label class="rr"><span>${h(label)}${star}</span><input type="checkbox" data-rule="${path}" id="r-${path}"${val ? " checked" : ""}></label>`;
    if (Array.isArray(type))
      return `<label class="rr"><span>${h(label)}${star}</span><select data-rule="${path}" id="r-${path}">${options(type, val)}</select></label>`;
    if (type === "text")
      return `<label class="rr"><span>${h(label)}${star}</span><input type="text" autocomplete="off" list="dl-status" data-rule="${path}" id="r-${path}" value="${h(val)}"></label>`;
    const shown = type === "pct" ? E.pct(val) : val;
    const rec = RULE_RANGE[path]; // a guide, never enforced: the DM decides
    const recText = rec
      ? ` <span class="s ${shown < rec[0] || shown > rec[1] ? "warn" : "dim"}" title="Recommended range. Nothing stops you going outside it.">${rec[0]} to ${rec[1]}</span>`
      : "";
    return `<label class="rr"><span>${h(label)}${type === "pct" ? " %" : ""}${star}${recText}</span>${numBox(`data-rule="${path}" data-rt="${type}" id="r-${path}"`, shown)}</label>`;
  };
  const groups = RULE_SCHEMA.map(([g, items], i) => fold(`rule:${g}`, h(g), items.map(input).join(""), { open: i === 0 })).join("");
  const types = [...new Set(DATA.weapons.map((w) => w.type).filter(Boolean))].sort();
  const jam = fold(
    "rule:jam",
    "Jam clear AP *",
    `<div class="cols2">${types.map((t) => `<label class="rr"><span>${h(t)}</span>${numBox(`data-rule="clearJam.${h(t)}" data-rt="num" id="r-cj-${h(t)}"`, r.clearJam[t] != null ? r.clearJam[t] : r.clearJamDefault)}</label>`).join("")}</div>`,
  );
  const move = fold(
    "rule:move",
    "Range bands: meters and walking AP *",
    r.moveAP
      .map(
        (v, i) =>
          `<div class="rr"><span>R${i + 1}</span>${numBox(`data-rule="bandMeters.${i}" data-rt="num" id="r-bm-${i}" title="Band reaches this many meters" style="width:50px"`, r.bandMeters[i])}<span class="s dim">m</span></div>`,
      )
      .join(""),
  );
  const diff = fold(
    "rule:diff",
    "Difficulty presets *",
    Object.keys(r.difficulty)
      .map((k) => `<label class="rr"><span>${h(k)}</span>${numBox(`data-rule="difficulty.${h(k)}" data-rt="num" id="r-df-${h(k)}"`, r.difficulty[k])}</label>`)
      .join(""),
  );
  const disp = fold(
    "rule:display",
    "Display",
    `<label class="rr"><span>Font</span><select id="pFont" data-pref="face">${options(
      [
        ["term", "Terminal (readable)"],
        ["pixel", "Pixel (VT323)"],
        ["code", "Code (Consolas)"],
      ],
      prefs.face,
    )}</select></label><label class="rr"><span>CRT shimmer and scanlines</span><input type="checkbox" id="pScan" data-pref="scan"${prefs.scan ? " checked" : ""}></label>`,
  );
  return `${groups}${jam}${move}${diff}${disp}<div class="row wrap" style="margin-top:4px">${btn("resetRules", "", "Reset rules", "", "tiny")}</div><div class="s dim" style="margin-top:3px"><span class="warn">*</span> placeholder picked for the draft. Data: ${h(DATA.builtFrom)}, ${h(DATA.builtAt)}.</div>`;
}
const RAIL = [
  ["newc", "New", "dot"],
  ["settings", "Set", "gear"],
  ["saveNow", "Save", "floppy"],
  ["loadWin", "Load", "folder"],
  ["uiScale", "Size", "sliders"],
  ["autoWin", "Auto", "clock"],
  ["wiki", "Wiki", "book"],
  ["log", "Log", "log"],
  ["items", "Item", "box"],
  ["notes", "Note", "pencil"],
  ["vendor", "Shop", "box"],
  ["skillTree", "Skill tree", "dna"],
  ["levelPerks", "Level perks", "star"],
  ["guide", "Help", "star"],
];
function rail() {
  return `<nav class="rail ${ui.railMore ? "more" : ""}">${RAIL.map(([id, n, ic]) => `<button class="railb ${RAIL_MAIN.includes(id) ? "" : "sec"} ${id === "saveNow" && dirty ? "dirty" : ""} ${id === "autoWin" && !prefs.autosave ? "off" : ""} ${(ui.modal && ui.modal.type === id) || (id === "log" && ui.logOpen) ? "on" : ""}" ${id === "saveNow" ? 'id="railSave"' : ""} data-a="railGo" data-v="${id}" title="${h(RAIL_TITLE[id])}">${pix(ic)}<span>${id === "autoWin" ? (prefs.autosave ? "ON" : "OFF") : n}</span></button>`).join("")}<button class="railb railmore ${ui.railMore ? "on" : ""}" data-a="railMore" data-v="" aria-expanded="${!!ui.railMore}" title="More">${pix("dot")}<span>${ui.railMore ? "Less" : "More"}</span></button></nav>`;
}
const RAIL_MAIN = ["saveNow", "loadWin", "log", "notes", "items"]; // the phone tab bar's five; the rest sit behind More
const RAIL_TITLE = {
  uiScale: "UI size: make everything bigger or smaller",
  newc: "New campaign",
  guide: "How to use this: tutorial",
  settings: "Settings: game rules",
  saveNow: "Save",
  loadWin: "Load save",
  autoWin: "Autosave",
  wiki: "Wiki: the game bible",
  log: "Log",
  items: "Item browser",
  notes: "Old notes",
  vendor: "Vendor: buy and sell",
  skillTree: "Skill tree: proficiency, expertise and mastery perks for each skill",
  levelPerks: "Level perks: the perks unlocked by level",
};
const UI_SCALES = [2, 1.5, 1, 0.75, 0.5, 0.25];
// Zooming in makes the page narrower in CSS pixels, but breakpoints only see the real screen.
// So the narrow-screen rules are copied under html.lt1000 / html.lt600 and switched on from the zoomed width.
function mirrorNarrowRules() {
  if (document.getElementById("narrowRules")) return;
  let css = "";
  for (const sh of document.styleSheets) {
    let rules;
    try {
      rules = sh.cssRules;
    } catch (e) {
      continue;
    }
    for (const r of rules) {
      const q = r.media ? r.media.mediaText : "";
      const cls = /max-width:\s*1000px/.test(q) ? "lt1000" : /max-width:\s*599px/.test(q) ? "lt600" : null;
      if (cls && !/pointer|prefers/.test(q)) css += `html.${cls} { ${[...r.cssRules].map((x) => x.cssText).join("\n")} }\n`;
    }
  }
  const st = document.createElement("style");
  st.id = "narrowRules";
  st.textContent = css;
  document.head.appendChild(st);
}
const RING_OP = 0.3; // 12 Nov: the accuracy ring's fill, dimmer than the old 0.55 so it doesn't pull the eye; the Size window has a slider
function applyScale() {
  const z = prefs.uiScale || 1;
  const root = document.documentElement;
  root.style.zoom = z === 1 ? "" : z;
  root.style.setProperty("--z", z);
  root.style.setProperty("--ringop", prefs.ringOp != null ? prefs.ringOp : RING_OP);
  if (z > 1) mirrorNarrowRules();
  const w = innerWidth / z; // the width the layout actually gets
  root.classList.toggle("lt1000", z > 1 && w <= 1000);
  root.classList.toggle("lt600", z > 1 && w < 600);
}
// Sizes follow the screen, so a turned phone or a resized window redraws.
let resizeQueued = false;
addEventListener("resize", () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    applyScale();
    render();
  });
});
function scaleBody() {
  const cur = prefs.uiScale || 1;
  const sp = prefs.spStyle || "symbols";
  const ring = Math.round((prefs.ringOp != null ? prefs.ringOp : RING_OP) * 100);
  return `<div class="s dim" style="margin-bottom:6px">Everything gets bigger or smaller together. This browser remembers it.</div><div class="scalegrid">${UI_SCALES.map((z) => `<button class="btn ${z === cur ? "on" : ""}" data-a="setScale" data-v="${z}" aria-pressed="${z === cur}">${z * 100}%</button>`).join("")}</div>
  <h3 style="margin-top:12px">Party cards: S.P.E.C.I.A.L.</h3><div class="opts">${[
    ["symbols", "Symbols"],
    ["text", "Letters"],
    ["both", "Both"],
  ]
    .map(([v, n]) => `<button class="btn ${sp === v ? "on" : ""}" data-a="setSpStyle" data-v="${v}" aria-pressed="${sp === v}">${n}</button>`)
    .join("")}</div>
  <h3 style="margin-top:12px">Accuracy ring</h3><label class="row" style="align-items:center;gap:8px"><span class="s">Faint</span><input type="range" id="ringOp" min="10" max="80" step="5" value="${ring}" data-c="setRingOp" aria-label="Accuracy ring brightness"><span class="s">Bright</span><b class="s">${ring}%</b></label>`;
}
function autoBody() {
  const iv = prefs.interval;
  const presets = [
    [0, "Every change"],
    [15, "15 sec"],
    [30, "30 sec"],
    [60, "1 min"],
    [120, "2 min"],
    [300, "5 min"],
    [600, "10 min"],
  ];
  return `<div class="row"><span class="grow">AUTOSAVE</span><button class="btn tiny ${prefs.autosave ? "on" : ""}" data-a="autoToggle" data-v="1">ON</button><button class="btn tiny ${prefs.autosave ? "" : "on"}" data-a="autoToggle" data-v="">OFF</button></div><label class="rr"><span>Interval</span><select id="pInt" data-pref="interval">${options(presets.some(([v]) => v === iv) ? presets : [...presets, [iv, iv + " sec"]], iv)}</select></label><label class="rr"><span>Or seconds</span>${numBox(`id="pSec" data-pref="seconds"`, iv || "")}</label><div class="stat" id="saveStat">${h(statusText())}</div>`;
}
const SLOTS_KEY = "fallout-dm-slots-v1";
const slots = () => readJson(SLOTS_KEY) || [];
function writeSlot(id, name) {
  try {
    localStorage.setItem("fallout-dm-slot-" + id, JSON.stringify(S));
    const list = slots().filter((x) => x.id !== id);
    list.unshift({ id, name, at: new Date().toISOString(), info: S.combat ? `In a fight, round ${S.combat.round}` : `${S.chars.length} characters` });
    localStorage.setItem(SLOTS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}
function loadBody() {
  const list = slots();
  const auto = readJson(SAVE_KEY);
  const when = (t) => new Date(t).toLocaleString();
  let used = 0;
  for (let i = 0; i < localStorage.length; i++) used += localStorage.key(i).length + localStorage.getItem(localStorage.key(i)).length;
  const mb = used / 1048576; // browsers allow about 5 MB a site; the exact figure is theirs to choose
  return `<div class="stat" id="saveStat" style="text-align:left;margin-bottom:3px">${h(statusText())}</div><div class="s ${mb > 4 ? "warn" : "dim"}" id="storeUse" style="margin-bottom:3px" title="Autosave and named saves share this. When it fills up, saving fails: delete old saves or keep them as packs.">Browser storage: ${mb.toFixed(1)} of about 5 MB used${mb > 4 ? ". Nearly full: delete old saves or save a pack." : ""}</div><div class="acts">${btn("slotNew", "", "Save as new", "", "primary")}${btn("exportSave", "", "Save pack (.zip)")}${btn("importSave", "", "Load pack")}</div>
   <table class="t"><tr><th>Save</th><th>When</th><th>State</th><th></th></tr>${list.map((x, i) => `<tr class="${prefs.slot === x.id ? "cursl" : ""}"><td><input type="text" autocomplete="off" class="cell left" id="sl-${i}" data-c="slotRename" data-v="${x.id}" value="${h(x.name)}"></td><td class="dim">${h(when(x.at))}</td><td class="dim">${h(x.info)}</td><td style="white-space:nowrap">${btn("slotLoad", x.id, "Load", "", "tiny")} ${btn("slotDel", x.id, "X", "", "tiny danger", "Delete this save")}</td></tr>`).join("")}${auto ? `<tr><td class="bright">Autosave</td><td class="dim">${lastSaved ? h(lastSaved.toLocaleString()) : "this browser"}</td><td class="dim">${auto.combat ? `In a fight, round ${auto.combat.round}` : `${(auto.chars || []).length} characters`}</td><td>${btn("slotLoad", "auto", "Load", "", "tiny")}</td></tr>` : ""}</table>${list.length ? "" : `<div class="s dim" style="margin-top:4px">No saves yet. The Save button makes the first one, and keeps updating it until you load or start another.</div>`}<div class="s dim" style="margin-top:4px">Saves live in this browser. A pack is a .zip with your campaign, rules and every table: edit it, share it, load it back.</div>`;
}
function pwBody() {
  const m = ui.pw;
  const list = m.side === "enemies" ? foes() : S.chars;
  const ACTS = [
    ["addItem", "Add item"],
    ["removeItem", "Remove item"],
    ["addStatus", "Add status"],
    ["removeStatus", "Remove status"],
    ["hp", "Change HP by"],
    ["ap", "Change AP by"],
    ["caps", "Change caps by"],
    ["xp", "Change XP by"],
    ["heal", "Full heal"],
    ["clear", "Clear all statuses"],
  ];
  const needsName = ["addItem", "removeItem", "addStatus", "removeStatus"].includes(m.act);
  const isStatus = m.act === "addStatus" || m.act === "removeStatus";
  const needsVal = !["heal", "clear", "addStatus", "removeStatus"].includes(m.act);
  return `<div class="grid" style="grid-template-columns:1.2fr 1.6fr .6fr">${field("Do this", `<select id="pwAct" data-u="pw.act">${options(ACTS, m.act)}</select>`)}${needsName ? field(isStatus ? "Status" : "Item", `<input id="pwName" autocomplete="off" list="${isStatus ? "dl-status" : "dl-all"}" data-u="pw.name" value="${h(m.name)}">`) : "<span></span>"}${needsVal ? field(needsName ? "How many" : "Amount (+ or -)", numBox(`id="pwVal" data-u="pw.val"`, m.val)) : m.act === "addStatus" ? field("Tier", `<select id="pwTier" data-u="pw.tier">${options([1, 2, 3, 4, 5], m.tier)}</select>`) : "<span></span>"}</div>
   <h3>To <button class="opt" data-a="pwWho" data-v="1">All</button> <button class="opt" data-a="pwWho" data-v="">None</button></h3><div class="row wrap">${list.map((e) => `<label class="chk"><input type="checkbox" id="pw-${e.id}" data-u="pw.who.${e.id}"${m.who[e.id] !== false ? " checked" : ""}>${h(e.name)}</label>`).join(" ") || `<span class="dim">Nobody here.</span>`}</div><div class="acts" style="margin-top:6px">${primary("pwApply", "", "Apply", "Enter")}</div>`;
}
