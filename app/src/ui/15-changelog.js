// CHANGELOG (13 Nov): what changed, version by version, newest first. Opened from the Changelog button at the top right.
// Keep it up to date: every round that changes the bible or HANDOFF.md adds or extends an entry here (CLAUDE.md says so).
// ver: the public commit, once pushed ("" until then). items: plain words, one line each.
var CHANGELOG = [
  {
    date: "13 Nov 2026",
    ver: "a45bdee",
    title: "Changelog",
    items: ["A Changelog button at the top right lists every version of the app and what it changed."],
  },
  {
    date: "13 Nov 2026",
    ver: "306f64a",
    title: "Map art: terrain, natural water, resizing, turn lock",
    items: [
      "Terrain under every map by setting, map and environment: grass, sand, dirt, asphalt, concrete, wooden planks, tile, metal plates, rock.",
      "A building on open ground lays its own floor inside its walls (wood, concrete or tile by setting).",
      "Lakes, ponds, shallows, the rad lake and placed water or acid get a natural outline, a new one every time; the outline is the water for walking and wading.",
      "Objects lit from the top left with soft shadows; hazards as tinted zones with an icon badge; shaded trees and water; object names drawn above everything.",
      "Crates, cars, shelves, desks, barrels, rocks, sandbags, roofs, beds, couches, bushes, trees, dumpsters and doors redrawn with more detail.",
      "Any map object can be resized: drag its corner handle, or type its width and height.",
      "In a fight only the token whose turn it is takes clicks, and it's drawn on top (everyone while the attack panel is open; Shift lets the DM grab anyone).",
    ],
  },
  {
    date: "12 Nov 2026",
    ver: "771c980",
    title: "Factions, faction dispositions, auto turns that don't stall",
    items: [
      "Factions window on the rail: the New Vegas factions and their leaders to start, standing toward the party, members killed (counted from fights), and an editable org chart of each hierarchy.",
      "New factions get a naming theme (military, political, raider gang, crime family, tribe, humanitarian, religious, merchant, Legion) and Generate hierarchy.",
      "Dispositions are weighted by faction: the Legion is almost never Craven, Fiends are often in a drug-fueled rage.",
      "New disposition: Drug-fueled rage.",
      "Automated turns search one or two walks for a place to fire from, or close in, instead of standing still; empty guns are set aside.",
    ],
  },
  {
    date: "12 Nov 2026",
    ver: "d46220a",
    title: "Doors, vaulting, rads, hazards and traps, water, dispositions",
    items: [
      "Doors in every generated doorway: wood is concealment, iron soft cover, steel hard cover; shut doors block walking and sight; open and shut them from the map.",
      "Anything that would have to be vaulted stops a walk; open and walk-through things don't.",
      "Rad counter on party cards (0 to 1200, one Irradiated tier every 200); radioactive barrels and rad lakes.",
      "Hazards act at the end of a turn and on confirmed walks: fire, radiation, gas, acid, live wires, spikes; mines explode in a small blast.",
      "Hidden traps placed with +Trap (bear trap, tripwire, buried landmine, dart plate, snare); players see them only with a trap perk.",
      "Water: lakes on big outdoor maps, ponds in small woods; deep water can't be entered, shallow water costs a quarter more per meter.",
      "General store and clinic settings.",
      "17 dispositions rolled by the gear each enemy carries, with icons on enemy cards; automated turns flee, avoid hazards, pick targets, use cover, flank, throw grenades, aim and duck back.",
    ],
  },
  {
    date: "12 Nov 2026",
    ver: "fa1b900",
    title: "Near misses are failures",
    items: [
      "The two outcomes just below the roll a check needs (now Partial Progress and Near Miss) fail with a little progress; a check is done only at Success or better.",
    ],
  },
  {
    date: "12 Nov 2026",
    ver: "2043a08",
    title: "Interactive tour",
    items: ["Help > Start the interactive tour: 19 steps through a skill check, rewards and a fight, on a practice campaign that never touches the real one."],
  },
  {
    date: "12 Nov 2026",
    ver: "2833403",
    title: "Aiming, familiarity, check outcomes, perk tree, new tokens",
    items: [
      "Aiming costs no AP; the part changes the hit chance (head x0.5, limbs x1.25) and the damage (head x2, limbs x0.75).",
      "Weapon familiarity adds crit and hit chance for the party.",
      "Skill checks land on nine outcome tiers scaled to the roll needed, with XP for each.",
      "Skill perks form a real branching tree, with a view per skill.",
      "Fight loadout shows the weapon in use in full; consumables show their numbers; item browser subcategories; rewards take several kinds.",
      "45 new or redrawn map tokens; the app builds without the workbook.",
    ],
  },
  {
    date: "12 Nov 2026",
    ver: "2d48ffa",
    title: "Housekeeping: pinch zoom, spectator party board, Safari taps",
    items: [
      "Two-finger pinch and double-tap zoom on the map; a cancelled touch no longer freezes updates.",
      "Spectators see a big Party board until the initiative screen.",
      "Touch screens never pop the keyboard unless a box is tapped; taps work in Safari on iPhone and iPad.",
      "Tablet and phone layout fixes.",
    ],
  },
  {
    date: "12 Nov 2026",
    ver: "85e5cb7",
    title: "Statuses and traits match their words",
    items: [
      "Blinded by Rage, FEV Infection and Craving Satisfaction apply numbers; several traits fixed to match their text.",
      "The map shows a queued move's length; the move bar and log say how the character moves.",
    ],
  },
  {
    date: "12 Nov 2026",
    ver: "d0feeb3",
    title: "Implants",
    items: ["Nine New Vegas implants in Health: 4 slots, install odds by doctor or self, Failed Surgery on a failure, Monocyte Breeder heals in fights."],
  },
  {
    date: "12 Nov 2026",
    ver: "fe01b1b",
    title: "Walking by Agility, players run their own characters, rewards",
    items: [
      "Walking: 5 m per AP at Agility 1 to 8 m at 10; keyboard walking.",
      "Saving throws are rolled high; DT is a whole number; Prayer action.",
      "Spectators level up, equip, use, drop and shop by themselves.",
      "Rewards tool; tokens at real size with a magnifier when zoomed out.",
      "Every ammo load +20% damage; worn armor -15% DT; tier-1 weapons +10% to hit.",
    ],
  },
  {
    date: "11 Nov 2026",
    ver: "ce12c5a",
    title: "Auto enemy turns, bleeding countdown, enemy kits, bible search",
    items: [
      "Auto button on enemy and ally turns plans and plays the turn as one log line and one undo.",
      "Bleeding drops a tier each round; tier 1 lasts 5 rounds.",
      "Enemy humans carry real kits and pay encumbrance; a high loot roll finds extra.",
      "Search finds rules inside the bible.",
    ],
  },
  {
    date: "11 Nov 2026",
    ver: "45c97db",
    title: "Spectator links",
    items: ["Open session links for spectators: the map, the party and the combat log, with no DM tools; phone-sideways and tablet layouts."],
  },
  {
    date: "11 Nov 2026",
    ver: "aed0a42",
    title: "Aimed-part odds, buckshot spread, layered cover",
    items: [
      "Limbs are easier to hit, the head harder; buckshot lands pellets by roll and range.",
      "Layered cover; shot boxes slightly smaller so grazing shots pass.",
      "Skill tree as a real tree; Clear buttons on the logs.",
    ],
  },
  {
    date: "11 Nov 2026",
    ver: "04836cc",
    title: "Review round: aim ring, combat effects, new map art",
    items: [
      "Fights end by themselves when a side has nobody left; Loot all to.",
      "Aim ring shows line of sight through cover and the target's own modifiers.",
      "Grenades and knives cause Bleeding; grenades scatter by Explosives.",
      "Tracers, hit flashes and grenade bursts; objects colored by material; 31 new objects, 6 new settings, map key.",
      "Redesigned Health, inventory and character windows.",
    ],
  },
  {
    date: "11 Nov 2026",
    ver: "6bbc9fd",
    title: "Open session",
    items: ["Share a link and play on several DM screens from any network."],
  },
  {
    date: "10 Nov 2026",
    ver: "2c9ef6a",
    title: "Map creator",
    items: ["Draw your own maps; 46 new map objects, 8 new settings and 7 new locations; whole names on tokens; phones and tablets fit the screen."],
  },
  {
    date: "10 Nov 2026",
    ver: "9593db7",
    title: "Enemy map icons",
    items: ["Enemies get icons by faction and creature; the encounter panel takes the middle."],
  },
  {
    date: "10 Nov 2026",
    ver: "c5ede81",
    title: "Downed heal rule, spawn distance, smaller saves",
    items: ["Downed characters come back on 50% HP after a win, 10% after a loss; enemies spawn close, mid or far; tables export as CSV; smaller saves."],
  },
  {
    date: "10 Nov 2026",
    ver: "54a1ba1",
    title: "QA pass",
    items: ["Two crashes fixed, table imports and save loading fixed; the app file is 62% smaller."],
  },
  {
    date: "10 Nov 2026",
    ver: "76690de",
    title: "Cover wears by tier",
    items: ["Cover takes damage by tier and protects less as it wears; clearer combat panel; rounds roll on by themselves."],
  },
  {
    date: "10 Nov 2026",
    ver: "e53cd3c",
    title: "Map, inventory, perk trees, looting, cover health",
    items: [
      "Unique named weapons kept out of shops and loot; skill checks pay XP; weapon familiarity.",
      "Cover breaks; looting by Survival and Luck; square, hex or no grid; accuracy ring.",
    ],
  },
  {
    date: "9 Nov 2026",
    ver: "a24bb38",
    title: "Long campaigns",
    items: ["The log and undo memory are capped, so long campaigns stay fast."],
  },
  {
    date: "9 Nov 2026",
    ver: "1d60087",
    title: "One-sentence combat log",
    items: ["Each attack is one sentence with the damage, no commentary."],
  },
  {
    date: "9 Nov 2026",
    ver: "97cd533",
    title: "Balance pass",
    items: [
      "Guns +12% to hit; skill counts 1.5x; heavy melee 35%; melee and burst AP; bullets by roll.",
      "Creature Pen; damage floors by armor; player and enemy HP; vendor ammo by caliber.",
    ],
  },
  {
    date: "9 Nov 2026",
    ver: "044c2ad",
    title: "Grenades, body map, dice buttons, vendors",
    items: [
      "Frag grenade throws with a blast preview; stats on cards after modifiers; Health body map.",
      "Dice buttons on every roll; save to a file you choose; vendors stock by tier; bible changes by chapter.",
    ],
  },
  {
    date: "9 Nov 2026",
    ver: "64a7c18",
    title: "Room layouts and the combat log",
    items: ["Room layouts by setting and location; Q/E turns objects; one-line combat log with details on click."],
  },
  {
    date: "9 Nov 2026",
    ver: "77a4fbc",
    title: "Descriptive combat log, archetypes",
    items: ["Combat log colored by outcome; 40 archetypes with full kits."],
  },
  {
    date: "9 Nov 2026",
    ver: "fbb7315",
    title: "Phones, tablets and UI size",
    items: [
      "UI size from 200% to 25%; phone tab bar and touch targets; encounter setup in groups.",
      "Enemy skills from tier, SPECIAL and weapon; enemies named by faction with NCR and Legion ranks.",
    ],
  },
  {
    date: "8 Nov 2026",
    ver: "4f2908e",
    title: "First version",
    items: ["The DM app, the game bible, the data and the sources."],
  },
];
function changelogBody() {
  let last = "";
  return `<div class="s dim" style="margin-bottom:6px">Every version of the app, newest first. The game bible has the rule changes in full, chapter by chapter.</div>${CHANGELOG.map(
    (c) => {
      const day = c.date !== last ? `<h4 class="cldate">${h(c.date)}</h4>` : "";
      last = c.date;
      return `${day}<div class="clentry"><div><b class="bright">${h(c.title)}</b>${c.ver ? ` <span class="tag">${h(c.ver)}</span>` : ` <span class="tag hi">NEW</span>`}</div><ul>${c.items.map((t) => `<li>${h(t)}</li>`).join("")}</ul></div>`;
    },
  ).join("")}`;
}
