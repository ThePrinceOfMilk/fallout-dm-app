// Writes every game table to ../data/ as CSV and JSON, using relative paths only. These are copies for reading and editing.
// The app carries its own built-in copy, and a save pack is how edits get back in. Run from app/: node export_data.js
const fs = require("fs"), path = require("path");
const E = require("./src/engine.js");
const { DEFAULT_RULES } = require("./src/rules.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "tests", "data.json"), "utf8"));
E.standardize(data, DEFAULT_RULES);
const OUT = path.join(__dirname, "..", "data"); fs.mkdirSync(OUT, { recursive: true });
const cell = (v) => { const t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const csv = (rows) => { const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]; return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n"); };
const TABLES = { items: data.items, armor: data.armor, weapons: data.weapons, ammo: data.ammo, mods: data.mods, materials: data.materials, recipes: data.recipes, enemies: data.enemies, traits: data.traits, statuses: data.statuses, effects: data.sc, perks: [...data.levelPerks.map((p) => ({ kind: "Level", ...p })), ...data.skillPerks.map((p) => ({ kind: "Skill", ...p }))], loot: data.loot.map(([roll, shift]) => ({ roll, shift })) };
for (const [k, rows] of Object.entries(TABLES)) { fs.writeFileSync(path.join(OUT, k + ".csv"), csv(rows)); fs.writeFileSync(path.join(OUT, k + ".json"), JSON.stringify(k === "enemies" ? { enemies: rows, namePools: DEFAULT_RULES.namePools, nameStyles: DEFAULT_RULES.nameStyles } : rows, null, 1)); }
fs.writeFileSync(path.join(OUT, "rules.json"), JSON.stringify(DEFAULT_RULES, null, 1));
fs.writeFileSync(path.join(OUT, "variables.json"), JSON.stringify(E.VARS, null, 1));
console.log(Object.keys(TABLES).length, "tables written to data/");
