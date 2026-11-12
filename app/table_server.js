// Shared DM table: serves the app and keeps every open copy in sync. Plain Node, no packages.
// Usage: node table_server.js            (same Wi-Fi only)
// Env: PORT (default 7777), TABLE_STATE (default ./table_state.json), TABLE_TOKEN (default random).
"use strict";
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 7777;
const STATE_FILE = process.env.TABLE_STATE || path.join(__dirname, "table_state.json");
const APP_FILE = path.join(__dirname, "..", "Fallout DM App.html");
const TOKEN = process.env.TABLE_TOKEN || crypto.randomBytes(16).toString("hex");
const SPEC = process.env.TABLE_SPEC || crypto.randomBytes(16).toString("hex"); // spectator links: read the game and send asks, never write it
const MAX_BODY = 200e6;

let rev = 0,
  S = null;
try {
  ({ rev, S } = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")));
} catch (e) {
  /* no saved table yet */
}
const streams = new Set();
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFile(STATE_FILE, JSON.stringify({ rev, S }), () => {}), 2000);
}
function broadcast(msg) {
  const data = "data: " + JSON.stringify({ ...msg, n: streams.size }) + "\n\n";
  for (const r of streams) r.write(data);
}
const links = (t = TOKEN) => [...lanIps().map((ip) => `http://${ip}:${PORT}`)].map((u) => `${u}/?t=${t}`);
function lanIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}
function json(res, code, o) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(o));
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "GET" && (u.pathname === "/" || u.pathname === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return fs.createReadStream(APP_FILE).pipe(res);
  }
  if (!u.pathname.startsWith("/sync/")) return json(res, 404, { error: "not found" });
  const role = u.searchParams.get("t") === TOKEN ? "dm" : u.searchParams.get("t") === SPEC ? "spec" : "";
  if (!role) return json(res, 403, { error: "bad token" });

  if (u.pathname === "/sync/hello")
    return json(res, 200, { rev, hasState: !!S, n: streams.size, role, ...(role === "dm" ? { links: links(), s: SPEC, specLinks: links(SPEC) } : {}) });

  if (u.pathname === "/sync/ask" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 2000) req.destroy();
    });
    req.on("end", () => {
      let ask;
      try {
        ask = JSON.parse(body);
      } catch (e) {
        return json(res, 400, { error: "bad json" });
      }
      if (!ask || typeof ask.a !== "string" || typeof ask.id !== "string") return json(res, 400, { error: "bad ask" });
      broadcast({ rev, from: ask.from || "", ask });
      json(res, 200, { ok: true });
    });
    return;
  }

  if (u.pathname === "/sync/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.write("retry: 2000\n\n");
    streams.add(res);
    if (S) res.write("data: " + JSON.stringify({ rev, from: "", S, n: streams.size }) + "\n\n");
    broadcast({ rev, from: "", n: streams.size }); // device count only, no S
    const beat = setInterval(() => res.write(": beat\n\n"), 20000);
    req.on("close", () => {
      clearInterval(beat);
      streams.delete(res);
      broadcast({ rev, from: "" });
    });
    return;
  }

  if (u.pathname === "/sync/state" && req.method === "POST") {
    if (role !== "dm") return json(res, 403, { error: "spectators can't change the game" });
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) return req.destroy();
      chunks.push(c);
    });
    req.on("end", () => {
      let msg;
      try {
        msg = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch (e) {
        return json(res, 400, { error: "bad json" });
      }
      if (!msg || !msg.S || !Array.isArray(msg.S.chars)) return json(res, 400, { error: "not a save" });
      if (msg.baseRev !== rev) return json(res, 409, { rev, S });
      S = msg.S;
      rev++;
      broadcast({ rev, from: msg.from, S });
      saveSoon();
      json(res, 200, { ok: true, rev });
    });
    return;
  }
  json(res, 404, { error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Table open${S ? ` (resuming saved table, rev ${rev})` : ""}.`);
  console.log(`  You (this PC):   http://localhost:${PORT}/?t=${TOKEN}`);
  for (const ip of lanIps()) console.log(`  Same Wi-Fi:      http://${ip}:${PORT}/?t=${TOKEN}`);
  for (const ip of lanIps()) console.log(`  Spectators:      http://${ip}:${PORT}/?t=${SPEC}`);
  console.log("If a phone can't connect: allow Node.js on Private networks when Windows Firewall asks (or in Windows Security > Firewall > Allow an app).");
  console.log("For players on other networks, use Open session in the app instead.");
});
