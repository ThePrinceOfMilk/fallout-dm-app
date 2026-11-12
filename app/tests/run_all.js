// Runs every offline test suite one after another and prints one summary. Run from app/: npm test
// The relay suites need internet and the live Cloudflare relay, so they only run with --online.
// In a folder with no node_modules (the public copy), point NODE_PATH at one that has playwright-core.
const { spawnSync } = require("child_process");
const path = require("path");
const APP = path.join(__dirname, "..");
const suites = [
  ["engine", ["--test", "tests/engine.test.js"]],
  ["browser", ["tests/e2e.js"]],
  ["pinch and touch", ["tests/pinch.e2e.js"]],
  ["shared table", ["tests/table.e2e.js"]],
  ["spectators", ["tests/spec.e2e.js"]],
  ["spectator self-service", ["tests/specself.e2e.js"]],
];
if (process.argv.includes("--online")) suites.push(["relay", ["tests/relay.e2e.js"]], ["relay spectator", ["tests/relayspec.e2e.js"]]);
try {
  require.resolve("playwright-core", { paths: [APP, ...(process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean)] });
} catch (e) {
  console.error("playwright-core is missing: run npm install here, or set NODE_PATH to a node_modules that has it.");
  process.exit(1);
}
const results = [];
for (const [name, args] of suites) {
  const t = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: APP, encoding: "utf8", env: process.env, maxBuffer: 64 << 20 });
  const out = (r.stdout || "") + (r.stderr || "");
  const fails = out.split("\n").filter((l) => /^(FAIL|not ok)\b|^\s+not ok\b/.test(l));
  results.push({ name, ok: r.status === 0, secs: Math.round((Date.now() - t) / 1000), fails });
  console.log(`${r.status === 0 ? "PASS" : "FAIL"}  ${name} (${results.at(-1).secs}s)`);
  for (const l of fails.slice(0, 10)) console.log("      " + l.trim());
  if (r.status !== 0 && !fails.length) console.log(out.split("\n").slice(-15).join("\n"));
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} suites passed`);
process.exit(bad.length ? 1 : 0);
