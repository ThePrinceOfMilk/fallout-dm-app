// Writes the list of everything the effect standardizer could not turn into variables, for review.
// Run from app/: node report_effects.js
const fs = require("fs");
const E = require("./src/engine.js");
const { DEFAULT_RULES } = require("./src/rules.js");
const data = JSON.parse(fs.readFileSync("./tests/data.json", "utf8"));
const list = E.standardize(data, DEFAULT_RULES);
const groups = {};
for (const [t, n, w] of list) (groups[t] = groups[t] || []).push([n, w]);
const order = ["Guess", "Item", "Status", "Armor", "Level perk", "Skill Perk", "Trait", "Trait Evolution", "Accessory", "Weapon Mod", "Weapon mod", "Effect", "Situation", "Row"];
const title = { Guess: "Guesses I made: please check these", Item: "Consumables left as text", Status: "Statuses without numbers", Armor: "Armor text left for the DM", "Level perk": "Level perks left as reminders", "Skill Perk": "Skill perks left as reminders", Trait: "Traits with nothing automatic", "Trait Evolution": "Trait evolutions left as reminders", Accessory: "Accessories left as reminders", "Weapon Mod": "Weapon mod reminders", "Weapon mod": "Weapon mods left as text", Effect: "Effects left as reminders", Situation: "Situations left as reminders", Row: "Other" };
let out = `# Skipped and unsure\n\nGenerated from the workbook by app/report_effects.js. ${list.length} entries. Nothing here was changed, unless it says it's a guess.\n`;
for (const k of [...order, ...Object.keys(groups).filter((x) => !order.includes(x))]) { const r = groups[k]; if (!r) continue; const seen = new Set(); out += `\n## ${title[k] || k} (${r.length})\n\n`; for (const [n, w] of r) { const l = `- **${n}**: ${w}`; if (!seen.has(l)) { seen.add(l); out += l + "\n"; } } }
fs.writeFileSync("../Skipped and Unsure.md", out);
console.log(Object.entries(groups).map(([k, v]) => k + ":" + v.length).join(" "));
const fx = data.statuses.filter((s) => s.fx.some((f) => Object.keys(f).filter((k) => k !== "turns").length)).length;
console.log("statuses with variables", fx, "of", data.statuses.length, "| items with use", data.items.filter((i) => i.use.heal || i.use.applies.length || Object.keys(i.use.reduces).length || i.use.removes.length || Object.keys(i.use.fx).length).length, "of", data.items.length, "| armor fx", data.armor.filter((a) => a.fx).length, "| level perks fx", data.levelPerks.filter((p) => p.fx).length, "of", data.levelPerks.filter((p) => p.effect).length);
