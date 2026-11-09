// Writes "Fallout Enemies (for review).json": every workbook enemy with a faction, plus new New Vegas themed enemies.
// Already done: the reviewed result lives in src/enemies.json and build.py uses it. Edit that file to change enemies. This script is kept as a record.
if (require("fs").existsSync("./src/enemies.json")) { console.log("src/enemies.json already exists, so nothing was written."); process.exit(0); }
// Run from app/: node make_enemies.js
const fs = require("fs");
const E = require("./src/engine.js");
const { DEFAULT_RULES } = require("./src/rules.js");
const data = JSON.parse(fs.readFileSync("./tests/data.json", "utf8"));
const db = E.makeDb(data);
const c = { db, rules: DEFAULT_RULES, scene: {}, ov: {} };

// Factions for the workbook's enemies. Anything not listed is Unaligned.
const FACTION = [[/^Powder Ganger/, "Powder Gangers"], [/^Strong Fiend|^Fiend/, "Fiends"], [/^Legion|^Strong Legion/, "Caesar's Legion"], [/^(Strong )?(Recruit|Soldier|Veteran|Ranger)\b/, "NCR"], [/^(Strong )?PA /, "Brotherhood of Steel"], [/^(Strong )?(Gangster|Mobster)/, "Crime Families"], [/^(Strong )?Raider/, "Raiders"], [/^(Strong )?Tribal/, "Tribals"], [/^(Strong )?Supermutant/, "Super Mutants"], [/^Sunny Smiles|^Displaced Resident/, "Goodsprings"]];
const factionOf = (n) => (FACTION.find(([re]) => re.test(n)) || [null, "Unaligned"])[1];

// Stat lines by role: SPECIAL, then skills. [STR PER END CHA INT AGL LCK].
const ROLE = {
  thug: { special: [5, 4, 5, 3, 3, 5, 4], skills: (t) => ({ SG: 15 + t * 8, MW: 25 + t * 8, BG: 10 + t * 5, SNK: 10 + t * 4 }) },
  gunner: { special: [4, 6, 4, 3, 4, 6, 4], skills: (t) => ({ SG: 30 + t * 9, MW: 15 + t * 5, BG: 15 + t * 6, SNK: 15 + t * 4 }) },
  bruiser: { special: [7, 3, 6, 2, 2, 5, 4], skills: (t) => ({ MW: 35 + t * 9, SG: 10 + t * 5, BG: 20 + t * 6 }) },
  boss: { special: [6, 6, 6, 6, 5, 6, 5], skills: (t) => ({ SG: 35 + t * 9, MW: 30 + t * 8, BG: 25 + t * 7, SPE: 40 + t * 5 }) },
  sneak: { special: [4, 6, 4, 4, 5, 7, 5], skills: (t) => ({ SG: 25 + t * 8, MW: 25 + t * 7, SNK: 35 + t * 8 }) },
  heavy: { special: [8, 4, 7, 3, 3, 3, 4], skills: (t) => ({ BG: 40 + t * 9, SG: 20 + t * 6, MW: 25 + t * 6 }) },
  sapper: { special: [4, 6, 4, 3, 6, 5, 4], skills: (t) => ({ EXP: 35 + t * 9, SG: 25 + t * 7, MW: 15 + t * 4 }) },
  tech: { special: [3, 6, 4, 3, 8, 5, 4], skills: (t) => ({ EW: 35 + t * 9, SG: 20 + t * 6, SCI: 40 + t * 6 }) },
};
const XP = [0, 5, 10, 20, 35, 55, 80]; const CAPS = ["", "3-12", "8-25", "15-45", "30-90", "60-180", "120-350"];
//  name, faction, tier, role, weapon 1, weapon 2, clothing or armor
const NEW = [
  ["Jackal Pup", "Jackals", 1, "thug", "Pipe Pistol", "Knife"], ["Jackal Hanger-On", "Jackals", 1, "thug", "Hatchet", "Basic Fighting"], ["Jackal Gang Member", "Jackals", 1, "gunner", "Pipe Rifle", "Prison Shiv"], ["Jackal Pack Leader", "Jackals", 2, "boss", ".357 Magnum revolver", "Lead Pipe"], ["Jackal Dog Handler", "Jackals", 2, "bruiser", "Baseball Bat", "Basic Fighting"],
  ["Viper Cutthroat", "Vipers", 1, "sneak", "Switchblade", "Pipe Pistol"], ["Viper Gunslinger", "Vipers", 2, "gunner", "Lever Action Rifle", "Knife"], ["Viper Snake Handler", "Vipers", 2, "sneak", "Straight Razor", "Basic Fighting"], ["Viper Road Warrior", "Vipers", 2, "bruiser", "Tire Iron", "Pipe Shotgun"], ["Viper Gang Leader", "Vipers", 3, "boss", "Cowboy repeater", "War Club"],
  ["Fiend Junkie", "Fiends", 2, "thug", "Lead Pipe", "Pipe Pistol"], ["Fiend Stoner", "Fiends", 2, "gunner", "9mm Auto Pistol (Glock)", "Tire Iron"], ["Fiend Psycho", "Fiends", 3, "bruiser", "Sledgehammer", "Basic Fighting"], ["Fiend Enforcer", "Fiends", 3, "gunner", "Battle rifle", "War Club"], ["Fiend Chem Cook", "Fiends", 3, "sapper", "Compact 10mm SMG (Uzi)", "Knife"], ["Fiend Warlord", "Fiends", 4, "boss", "Handmade Rifle (AK47)", "Mace"], ["Fiend Pyro", "Fiends", 3, "tech", "Pipe Flamer", "Lead Pipe"],
  ["Rogue Scavenger", "Rogue Scavengers", 1, "thug", "Pipe Rifle", "Pipe Wrench"], ["Scav Picker", "Rogue Scavengers", 1, "sneak", "Knife", "Pipe Pistol"], ["Scav Salvager", "Rogue Scavengers", 2, "gunner", "10mm Carbine", "Crowbar"], ["Scav Tinkerer", "Rogue Scavengers", 2, "tech", "Taser", "Hammer"], ["Scav Crew Boss", "Rogue Scavengers", 3, "boss", "Marksman carbine", "Shovel"],
  ["Highwayman Lookout", "Highwaymen", 1, "gunner", "Varmint rifle", "Knife"], ["Highwayman Bandit", "Highwaymen", 2, "thug", "RSC SMG", "Tire Iron"], ["Highwayman Sharpshooter", "Highwaymen", 3, "gunner", "Marksman carbine", "Knife"], ["Highwayman Toll Collector", "Highwaymen", 2, "bruiser", "Shovel", ".45 Auto pistol"], ["Highwayman Captain", "Highwaymen", 4, "boss", "Trail carbine", "Mace"],
  ["City Mugger", "City Muggers", 1, "thug", "Switchblade", "Basic Fighting"], ["Back-Alley Mugger", "City Muggers", 1, "sneak", "Straight Razor", ".32 Pistol"], ["Pickpocket Crew Lookout", "City Muggers", 1, "sneak", "Knife", "Basic Fighting"], ["Street Tough", "City Muggers", 2, "bruiser", "Lead Pipe", "Brass Knuckles"], ["Corner Boss", "City Muggers", 3, "boss", "Burst Pistol", "Police Baton"],
  ["Omerta Thug", "Omertas", 2, "thug", ".45 Auto pistol", "Police Baton"], ["Omerta Button Man", "Omertas", 3, "gunner", "Compact 10mm SMG (Uzi)", "Knife"], ["Omerta Capo", "Omertas", 4, "boss", "Silenced Mercenary Rifle", "Rebar Club"],
  ["Garret Bouncer", "Garrets", 2, "bruiser", "Baseball Bat", ".45 Auto pistol"], ["Garret Enforcer", "Garrets", 3, "gunner", "Burst Pistol", "Pool Cue"],
  ["Chairman Greeter", "Chairmen", 2, "gunner", "9mm Auto Pistol (Glock)", "Knife"], ["Chairman Hitman", "Chairmen", 3, "sneak", "Burst Pistol", "Switchblade"], ["Chairman Boss", "Chairmen", 4, "boss", "Silenced Mercenary Rifle", "Rebar Club"],
  ["White Glove Attendant", "White Glove Society", 2, "sneak", "Silenced .22 pistol", "Knife"], ["White Glove Butcher", "White Glove Society", 3, "bruiser", "Cleaver", "Burst Pistol"],
  ["King Greaser", "The Kings", 2, "thug", ".357 Magnum revolver", "Switchblade"], ["King Lieutenant", "The Kings", 3, "boss", "Police Carbine (M1Carbine)", "Tire Iron"],
  ["Great Khan Raider", "Great Khans", 2, "thug", "Pipe Shotgun", "Baseball Bat"], ["Great Khan Armorer", "Great Khans", 3, "heavy", "Battle rifle", "Sledgehammer"], ["Great Khan Warlord", "Great Khans", 4, "boss", "Brush gun", "War Hammer"],
  ["Boomer Spotter", "Boomers", 3, "sapper", "Battle rifle", "Knife"], ["Van Graff Thug", "Van Graffs", 4, "tech", "Radium Rifle", "Mace"], ["Crimson Caravan Guard", "Crimson Caravan", 2, "gunner", "Lever Action Rifle", "Knife"],
];
const warn = [];
const has = (n) => { const it = E.get(c, n); return it && it.cat === "weapon"; };
const added = NEW.map(([n, faction, tier, role, w1, w2, wear]) => {
  if (!has(w1)) warn.push(`${n}: no weapon "${w1}"`);
  if (w2 && !has(w2)) warn.push(`${n}: no weapon "${w2}"`);
  const R = ROLE[role];
  const e = { n, tier, xp: XP[tier], caps: CAPS[tier], faction, special: [...R.special], skills: R.skills(tier), w1, w2 };
  if (wear) e.vanity = wear;
  return e;
});
const existing = data.enemies.filter((e) => !e.test).map((e) => ({ ...e, faction: e.faction === "Powder Gang" ? "Powder Gangers" : e.faction && e.faction !== "Goodsprings" ? e.faction : factionOf(e.n) }));
const clash = added.filter((a) => existing.some((x) => x.n === a.n)); if (clash.length) warn.push("Name clash: " + clash.map((a) => a.n).join(", "));
const tests = data.enemies.filter((e) => e.test);
const out = [...tests, ...existing, ...added];
// Every new enemy must really spawn with working gear.
for (const a of added) { const s = E.spawn(a, "x", c, Math.random); if (!s.hp || !s.weapons.length) warn.push(`${a.n} didn't spawn properly`); }
fs.writeFileSync("../Fallout Enemies (for review).json", JSON.stringify(out, null, 1));
const count = {}; for (const e of out) count[e.faction || "(test row)"] = (count[e.faction || "(test row)"] || 0) + 1;
console.log(`${out.length} rows: ${existing.length} workbook enemies, ${added.length} new, ${tests.length} test rows`);
console.log(Object.entries(count).map(([k, v]) => `${k} ${v}`).join("; "));
console.log("warnings:", warn.length ? warn.join(" | ") : "none");
