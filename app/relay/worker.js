// Cloud relay for the shared DM table. Same /sync protocol as app/table_server.js, one Durable Object per session.
// POST /new                      -> { room, t }   (makes a session)
// GET  /s/ROOM/sync/hello?t=     -> { rev, hasState, n }
// GET  /s/ROOM/sync/events?t=    -> Server-Sent Events: { rev, from, S?, n }
// POST /s/ROOM/sync/state?t=     <- { baseRev, from, S }
// Deploy: cd app/relay && npx wrangler deploy
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const CHUNK = 500000; // a stored value can be at most 2 MB; a long campaign is several
const IDLE_MS = 14 * 864e5; // a session nobody touches for 14 days is deleted

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (u.pathname === "/new" && req.method === "POST") {
      const room = rand(6),
        t = rand(16);
      await env.ROOMS.get(env.ROOMS.idFromName(room)).fetch("https://room/init", { method: "POST", body: t });
      return json({ room, t });
    }
    const m = u.pathname.match(/^\/s\/([0-9a-f]{12})(\/sync\/[a-z]+)$/);
    if (!m) return json({ error: "not found" }, 404);
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(new Request("https://room" + m[2] + u.search, req));
  },
};

export class Room {
  constructor(state) {
    this.state = state;
    this.store = state.storage;
    this.streams = new Set();
    this.meta = null; // { t, rev, parts }
    this.S = null;
  }
  async load() {
    if (this.meta) return;
    this.meta = (await this.store.get("meta")) || null;
    if (this.meta && this.meta.parts) {
      const keys = Array.from({ length: this.meta.parts }, (_, i) => "s" + i);
      const got = await this.store.get(keys);
      this.S = JSON.parse(keys.map((k) => got.get(k)).join(""));
    }
  }
  async persist() {
    const str = JSON.stringify(this.S);
    const parts = Math.ceil(str.length / CHUNK);
    const put = { meta: { ...this.meta, parts } };
    for (let i = 0; i < parts; i++) put["s" + i] = str.slice(i * CHUNK, (i + 1) * CHUNK);
    await this.store.put(put);
    this.meta.parts = parts;
  }
  send(w, o) {
    w.write(new TextEncoder().encode("data: " + JSON.stringify({ ...o, n: this.streams.size }) + "\n\n")).catch(() => this.drop(w));
  }
  drop(w) {
    if (this.streams.delete(w)) for (const s of this.streams) this.send(s, { rev: this.meta.rev, from: "" });
  }
  async alarm() {
    await this.store.deleteAll();
    this.meta = null;
    this.S = null;
  }
  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === "/init") {
      this.meta = { t: await req.text(), rev: 0, parts: 0 };
      await this.store.put("meta", this.meta);
      await this.store.setAlarm(Date.now() + IDLE_MS);
      return json({ ok: true });
    }
    await this.load();
    if (!this.meta) return json({ error: "That session has ended or the link is wrong." }, 404);
    if (u.searchParams.get("t") !== this.meta.t) return json({ error: "bad token" }, 403);
    const { rev } = this.meta;

    if (u.pathname === "/sync/hello") return json({ rev, hasState: !!this.S, n: this.streams.size });

    if (u.pathname === "/sync/events") {
      const { readable, writable } = new TransformStream();
      const w = writable.getWriter();
      this.streams.add(w);
      w.write(new TextEncoder().encode("retry: 2000\n\n"));
      if (this.S) this.send(w, { rev, from: "", S: this.S });
      for (const s of this.streams) this.send(s, { rev, from: "" }); // device count
      if (!this.beat)
        this.beat = setInterval(() => {
          for (const s of this.streams) s.write(new TextEncoder().encode(": beat\n\n")).catch(() => this.drop(s));
          if (!this.streams.size) this.beat = clearInterval(this.beat);
        }, 20000);
      return new Response(readable, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
    }

    if (u.pathname === "/sync/state" && req.method === "POST") {
      let msg;
      try {
        msg = await req.json();
      } catch (e) {
        return json({ error: "bad json" }, 400);
      }
      if (!msg || !msg.S || !Array.isArray(msg.S.chars)) return json({ error: "not a save" }, 400);
      if (msg.baseRev !== rev) return json({ rev, S: this.S }, 409);
      this.S = msg.S;
      this.meta.rev = rev + 1;
      for (const s of this.streams) this.send(s, { rev: this.meta.rev, from: msg.from, S: this.S });
      await this.persist(); // leftover chunks from a bigger state are ignored (meta.parts) and go with the idle alarm
      await this.store.setAlarm(Date.now() + IDLE_MS);
      return json({ ok: true, rev: this.meta.rev });
    }
    return json({ error: "not found" }, 404);
  }
}
