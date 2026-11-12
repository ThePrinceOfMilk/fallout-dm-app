// ===== 13-tutorial.js: THE INTERACTIVE TOUR (12 Nov). Help > Start the tour. Each step lights up the thing to use, says what
// to do, and ticks itself off when the app sees it done; then it moves on. The tour plays on a practice campaign: the real
// one is kept aside in memory and comes back when the tour ends, and nothing is saved while it runs (save() checks tut),
// so closing the page mid-tour leaves the real campaign as it was. Not offered to spectators or in a shared session.
// To add a step: { title, text, at: () => CSS selector of what to light up (or null), done: (t) => true once it's done,
// start: (t) => {} to set things up or remember where things stood (t.base) }. A step with no done has a Next button.

var tut = null; // var, not let: save() (in 01-state.js) reads it, and runs before this file during start-up
const pcId = () => (S.chars[0] || {}).id;
const TUT_STEPS = [
  {
    title: "Welcome",
    text: "This tour runs on a practice campaign, so try anything: your own campaign comes back when it ends. Each step lights up what to use and ticks itself off when you've done it.",
  },
  {
    title: "Your party",
    text: "Each card shows a character's health, AP and stats. Open the first character's inventory: tap INVENTORY on their card.",
    at: () => `.w-party [data-a="openChar"][data-v="${pcId()}|inv"]`,
    done: () => ui.modal && ui.modal.type === "char",
  },
  {
    title: "The inventory",
    text: "Gear on the body, weapons, and everything carried, sorted into tabs. Close it with Esc or CLOSE.",
    at: () => `.dialog [data-a="closeModal"]`,
    done: () => !ui.modal,
  },
  {
    title: "A skill check: difficulty",
    text: "Pick how hard the check is. Tap H60 (hard).",
    at: () => `.w-check [data-a="chkPreset"][data-v="60"]`,
    done: () => num(ui.chk.target) === 60,
  },
  {
    title: "A skill check: the roll",
    text: "Type the first character's d20 roll in their box and press Enter, or tap the dice beside it.",
    at: () => `#chk-${pcId()}`,
    done: () => !!(ui.chk.res || {})[pcId()],
  },
  {
    title: "Reading the outcome",
    text: "The strip under each name shows what every face of the d20 means for them, from Total Failure to Perfect, and the roll is marked. Better outcomes pay more XP.",
    at: () => `.w-check .tierrow`,
  },
  {
    title: "Rewards: what kind",
    text: "Tick Weapons and Ammo to make a weapons-and-ammo crate. You can tick as many kinds as you like.",
    at: () => `.w-reward [data-a="rewardFocus"][data-v="ammo"]`,
    done: () => {
      const k = (ui.reward || {}).kinds || [];
      return k.includes("weapons") && k.includes("ammo");
    },
  },
  {
    title: "Rewards: roll it",
    text: "Tap GENERATE. The result opens in its own window.",
    at: () => `.w-reward [data-a="rewardGen"]`,
    done: () => ui.modal && ui.modal.type === "reward",
  },
  {
    title: "Rewards: hand it out",
    text: "Pick who gets each item (or All to...) and tap GIVE OUT. Or close the window to keep the roll for later.",
    at: () => `.dialog [data-a="rewardGive"]`,
    done: () => !ui.modal,
  },
  {
    title: "Set up a fight",
    text: "Tap SET UP ENCOUNTER (or press B). The map opens, with the party on it.",
    at: () => `[data-a="setupOpen"][data-v="1"]`,
    done: () => setupOpen(),
  },
  {
    title: "Add an enemy",
    text: "Tap any enemy in the list on the right to add it to the map.",
    at: () => `.w-enemies .results`,
    done: () => S.scene.npcs.length > 0,
  },
  {
    title: "Begin combat",
    text: "Tap BEGIN COMBAT.",
    at: () => `[data-a="beginC"][data-v=""]`,
    done: () => !!K(),
  },
  {
    title: "Initiative",
    text: "Enemy rolls are filled in. Type each player's d20 (or tap the dice), then tap START ROUND 1.",
    at: () => `[data-a="beginRounds"]`,
    done: () => !!K() && K().phase === "turns",
  },
  {
    title: "Pick a target",
    text: "It's the first character's turn and the attack menu is open. Click the enemy on the map (the red diamond) to target it.",
    start: () => {
      const k = K();
      if (k && k.turnId !== pcId() && cbOf(pcId())) startTurn(pcId());
      if (!ui.atk && K()) ACT.attack();
      if (ui.atk) ui.atk.tgt = null;
    },
    at: () => `#map .tok.npc`,
    done: () => !!(ui.atk && ui.atk.tgt),
  },
  {
    title: "Aim",
    text: "Tap the head on the body figure. A head shot is harder to hit but does double damage; aiming costs no AP.",
    at: () => `[data-a="atkPart"][data-v="Head"]`,
    done: () => !!(ui.atk && ui.atk.part === "Head"),
  },
  {
    title: "Roll and resolve",
    text: "Type a two-dice roll from 00 to 99 (or tap the dice) and press Enter or RESOLVE. The bar above shows what each roll does.",
    start: (t) => (t.base = S.log.length),
    at: () => `#roll`,
    done: (t) => S.log.length > t.base && !!(ui.atk && ui.atk.res), // the attack has a result and the log has its line
  },
  {
    title: "End the turn",
    text: "Tap END TURN (or press N). The next one in the order acts.",
    start: (t) => (t.base = K() && K().turnId),
    at: () => `[data-a="next"]`,
    done: (t) => !K() || K().turnId !== t.base,
  },
  {
    title: "Skill tree",
    text: "Perks branch by skill. Open the SKILL TREE from the rail on the right.",
    at: () => `.rail [data-v="skillTree"]`,
    done: () => ui.modal && ui.modal.type === "skillTree",
  },
  {
    title: "That's the loop",
    text: "Checks, rewards, fights and perks. The Help window has notes on everything else. End the tour to get your own campaign back.",
  },
];
function tutStep(i) {
  tut.i = clamp(i, 0, TUT_STEPS.length - 1);
  tut.ok = false;
  tut.scrolled = false;
  const s = TUT_STEPS[tut.i];
  tut.starting = true; // a redraw while the step sets itself up must not tick it off
  if (s.start) s.start(tut);
  tut.starting = false;
  render();
}
// After every redraw: tick the step off if it's done, and put the light and the coach card in place.
function tutAfter() {
  let box = document.getElementById("tut");
  if (!tut) {
    if (box) box.remove();
    return;
  }
  if (!box) {
    box = document.createElement("div");
    box.id = "tut";
    document.body.appendChild(box);
  }
  const s = TUT_STEPS[tut.i];
  if (!tut.ok && !tut.starting && s.done && s.done(tut)) {
    tut.ok = true;
    const at = tut.i;
    setTimeout(() => tut && tut.i === at && tut.ok && tutStep(at + 1), 900);
  }
  const el = s.at ? document.querySelector(s.at()) : null;
  const r = el && el.getBoundingClientRect();
  const seen = r && r.width > 0 && r.height > 0;
  if (seen && !tut.scrolled) {
    tut.scrolled = true;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  const R = seen ? el.getBoundingClientRect() : null;
  const last = tut.i === TUT_STEPS.length - 1;
  const status = !s.done ? "" : tut.ok ? `<div class="tutok">DONE</div>` : `<div class="tutwait">Your turn: do it on the screen.</div>`;
  const ring = R
    ? `<div class="tutring" style="left:${R.left - 6}px;top:${R.top - 6}px;width:${R.width + 12}px;height:${R.height + 12}px"></div>`
    : `<div class="tutshade"></div>`;
  // the card sits under what's lit when there's room, else above it, else in the middle
  const W = Math.min(360, innerWidth - 20);
  let x = innerWidth / 2 - W / 2,
    y = innerHeight / 2 - 90;
  if (R) {
    x = clamp(R.left + R.width / 2 - W / 2, 10, innerWidth - W - 10);
    y = R.bottom + 16 + 190 < innerHeight ? R.bottom + 16 : R.top - 16 - 190 > 0 ? R.top - 16 - 190 : innerHeight - 200;
  }
  box.innerHTML = `${ring}<div class="tutcard" role="dialog" aria-live="polite" style="left:${x}px;top:${y}px;width:${W}px"><div class="tuthead"><span>TOUR · STEP ${tut.i + 1} OF ${TUT_STEPS.length}</span><button class="btn tiny" data-a="tutEnd" data-v="">End tour</button></div><h4>${h(s.title)}</h4><p>${h(s.text)}</p>${status}${R || !s.at ? "" : `<div class="s dim">(It's not on the screen right now: close any open window.)</div>`}<div class="row tutbtns">${tut.i ? btn("tutGo", String(tut.i - 1), "Back", "", "tiny") : ""}<span class="spacer"></span>${
    last
      ? btn("tutEnd", "", "Finish", "", "primary tiny")
      : s.done && !tut.ok
        ? btn("tutGo", String(tut.i + 1), "Skip", "", "tiny")
        : btn("tutGo", String(tut.i + 1), "Next", "", "primary tiny")
  }</div></div>`;
}
Object.assign(ACT, {
  tutStart() {
    if (table.on) return toast("Leave the shared session first: the tour uses a practice campaign.");
    if (tut) return;
    const backup = JSON.stringify(S);
    S = fresh();
    applyData();
    undoStack.length = redoStack.length = undoChars = 0;
    Object.assign(ui, { modal: null, atk: null, setup: null, sel: pcId(), zoom: null });
    tut = { i: 0, ok: false, backup };
    tutStep(0);
  },
  tutGo(v) {
    if (tut) tutStep(Number(v));
  },
  tutEnd() {
    if (!tut) return;
    const backup = tut.backup;
    tut = null;
    S = normalize(JSON.parse(backup));
    applyData();
    undoStack.length = redoStack.length = undoChars = 0;
    Object.assign(ui, { modal: null, atk: null, setup: null, sel: pcId(), zoom: null });
    render();
    toast("Tour over: your campaign is back.");
  },
});
addEventListener("resize", () => tut && tutAfter());
