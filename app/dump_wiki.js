// Writes the live rules and standardized data for make_wiki.py. Run from app/: node dump_wiki.js
const fs = require("fs");
const E = require("./src/engine.js");
const { DEFAULT_RULES } = require("./src/rules.js");
const data = JSON.parse(fs.readFileSync("./tests/data.json", "utf8"));
const skipped = E.standardize(data, DEFAULT_RULES);
fs.writeFileSync("./tests/wiki.json", JSON.stringify({ builtAt: data.builtAt, rules: DEFAULT_RULES, vars: E.VARS, statuses: data.statuses, items: data.items, sc: data.sc, skipped, enemies: data.enemies.filter((e) => !e.test) }));
