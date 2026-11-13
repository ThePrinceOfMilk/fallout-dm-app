// FACTIONS (12 Nov): the Factions window on the right-hand rail. One tab per faction: its name, naming theme, the party's standing with it,
// how many of its members the party has killed (counted by itself when an enemy of that faction dies), and its hierarchy as an org chart
// of boxes (leader at the top, then co-leaders, underbosses and so on), each with an editable title and name, and a Dead mark.
// Every campaign starts with the New Vegas factions; tabs can be added and deleted. "Generate hierarchy" fills a chart from the theme's ranks.

// Standing with the party, worst to best (Fallout: New Vegas words).
var FAC_ATT = ["Vilified", "Hated", "Disliked", "Neutral", "Accepted", "Liked", "Idolized"];
// Naming themes: a rank tree [title, ...children] and where the names come from.
// names: "full" (first and last), "single" (one name), "gang" (a street name), "latin" (a Latin name and epithet), "tribal".
var FAC_THEMES = {
  normal: { n: "No theme", names: "full", ranks: ["Leader", ["Second", ["Member"], ["Member"]], ["Second", ["Member"], ["Member"]]] },
  military: {
    n: "Military organization",
    names: "full",
    ranks: ["General", ["Colonel", ["Captain", ["Sergeant"]], ["Captain", ["Sergeant"]]], ["Colonel", ["Captain", ["Sergeant"]], ["Captain", ["Sergeant"]]]],
  },
  political: {
    n: "Political system",
    names: "full",
    ranks: [
      "President",
      ["Vice President", ["Minister of Defense", ["Official"]], ["Minister of Trade", ["Official"]], ["Minister of the Interior", ["Official"]]],
    ],
  },
  raider: { n: "Raider gang", names: "gang", ranks: ["Boss", ["Lieutenant", ["Enforcer"], ["Enforcer"]], ["Lieutenant", ["Enforcer"], ["Enforcer"]]] },
  criminal: {
    n: "Organized criminal group",
    names: "full",
    ranks: ["Don", ["Underboss", ["Caporegime", ["Soldier"], ["Soldier"]], ["Caporegime", ["Soldier"], ["Soldier"]]], ["Consigliere"]],
  },
  tribe: { n: "Tribe", names: "tribal", ranks: ["Chief", ["Shaman", ["Acolyte"]], ["War Chief", ["Brave"], ["Brave"], ["Hunter"]]] },
  humanitarian: {
    n: "Humanitarian",
    names: "full",
    ranks: ["Director", ["Head Doctor", ["Doctor"], ["Medic"]], ["Coordinator", ["Volunteer"], ["Volunteer"]]],
  },
  religious: { n: "Religious order", names: "single", ranks: ["High Priest", ["Priest", ["Acolyte"], ["Acolyte"]], ["Priest", ["Acolyte"], ["Acolyte"]]] },
  merchant: { n: "Merchant company", names: "full", ranks: ["Owner", ["Partner", ["Caravan Master", ["Guard"], ["Guard"]]], ["Quartermaster", ["Clerk"]]] },
  legion: {
    n: "Legion (Latin)",
    names: "latin",
    ranks: ["Dictator", ["Legate", ["Centurion", ["Decanus"], ["Decanus"]], ["Centurion", ["Decanus"], ["Decanus"]]], ["Frumentarius"]],
  },
};
// The New Vegas factions every campaign starts with: [name, theme, [title, name, ...children]].
var NV_FACTIONS = [
  [
    "NCR",
    "military",
    ["President", "Aaron Kimball", ["General", "Lee Oliver", ["Colonel", "James Hsu"], ["Colonel", "Cassandra Moore"], ["Ranger Chief", "Hanlon"]]],
  ],
  [
    "Caesar's Legion",
    "legion",
    ["Caesar", "Caesar", ["Legate", "Lanius", ["Centurion", "Dead Sea"]], ["Frumentarius", "Vulpes Inculta"], ["Praetorian", "Lucius"]],
  ],
  ["Brotherhood of Steel", "military", ["Elder", "McNamara", ["Head Paladin", "Hardin"], ["Paladin", "Ramos"]]],
  ["Mr. House", "political", ["Owner of the Strip", "Robert House", ["Head of Security", "Victor"]]],
  ["Great Khans", "tribe", ["Khan", "Papa Khan", ["Advisor", "Regis"], ["Khan", "Karl"], ["Khan", "Jessup"]]],
  ["Powder Gangers", "raider", ["Boss", "Eddie", ["Lieutenant", "Joe Cobb"], ["Lieutenant", "Cooke"]]],
  ["Fiends", "raider", ["Boss", "Motor-Runner", ["Lieutenant", "Cook-Cook"], ["Lieutenant", "Violet"], ["Lieutenant", "Driver Nephi"]]],
  ["Boomers", "military", ["Leader", "Mother Pearl", ["Second", "Loyal"], ["Captain", "Raquel"]]],
  ["Omertas", "criminal", ["Boss", "Big Sal", ["Underboss", "Nero"], ["Accountant", "Cachino"]]],
  ["Chairmen", "criminal", ["Boss", "Benny", ["Second", "Swank"]]],
  ["White Glove Society", "criminal", ["Manager", "Marjorie", ["Head Chef", "Mortimer"]]],
  ["The Kings", "raider", ["The King", "The King", ["Lieutenant", "Pacer"]]],
  ["Followers of the Apocalypse", "humanitarian", ["Director", "Julie Farkas", ["Doctor", "Arcade Gannon"], ["Doctor", "Usanagi"]]],
  ["Van Graffs", "merchant", ["Head", "Gloria Van Graff", ["Partner", "Jean-Baptiste Cutting"]]],
  ["Crimson Caravan", "merchant", ["Owner", "Alice McLafferty", ["Manager", "Janet"]]],
];
var facSeq = 0;
function facId() {
  return "f" + Date.now().toString(36) + (facSeq++).toString(36);
}
/** The campaign's factions, seeded with the New Vegas list the first time they're needed. */
function facState() {
  if (!S.factions || !Array.isArray(S.factions.list)) S.factions = seedFactions();
  return S.factions;
}
// A tree [title, name, ...children] (or [title, ...children] with no name) as a flat list of boxes with parents.
function facNodes(tree, named = true, parent = null, out = []) {
  const [title, ...rest] = tree;
  const name = named ? rest.shift() : "";
  const node = { id: facId(), title, name: name || "", parent, dead: false };
  out.push(node);
  for (const kid of rest) facNodes(kid, named, node.id, out);
  return out;
}
/** The factions a new campaign starts with. */
function seedFactions() {
  return {
    list: NV_FACTIONS.map(([n, theme, tree]) => ({ id: facId(), n, theme, builtin: true, att: "Neutral", killed: 0, nodes: facNodes(tree) })),
    tab: null,
  };
}
// A name in the theme's style, not already used in this faction. Factions with a name style of their own (NCR, the Legion, gangs) use it.
function facName(f, used) {
  const th = FAC_THEMES[f.theme] || FAC_THEMES.normal;
  const pools = S.rules.namePools || {};
  const pool = (k) =>
    String(pools[k] || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  const any = (l) => l[Math.floor(Math.random() * l.length)] || "";
  const st = (S.rules.nameStyles || {})[f.n];
  const kind = st ? (st.style === "latin" ? "latin" : st.style === "gang" ? "gang" : "full") : th.names;
  for (let i = 0; i < 40; i++) {
    const nm =
      kind === "latin"
        ? `${any(pool("latin"))}${Math.random() < 0.4 ? " " + any(pool("latinEpithet")) : ""}`
        : kind === "gang"
          ? any(pool("raider"))
          : kind === "tribal"
            ? any(pool("tribal"))
            : kind === "single"
              ? any(pool("american"))
              : `${any(pool("american"))} ${any(pool("americanLast"))}`;
    if (nm && !used.has(nm)) {
      used.add(nm);
      return nm;
    }
  }
  return "";
}
/** A whole hierarchy from the faction's theme: its ranks as the tree, a fresh name in every box. */
function facGenerate(f) {
  const th = FAC_THEMES[f.theme] || FAC_THEMES.normal;
  const nodes = facNodes(th.ranks, false);
  const used = new Set();
  for (const n of nodes) n.name = facName(f, used);
  return nodes;
}
const facOf = (id) => (facState().list || []).find((f) => f.id === id);
// The faction an enemy belongs to, by name, for the kill count.
const facByName = (n) => (n ? (facState().list || []).find((f) => E.low(f.n) === E.low(n)) : null);
/** An enemy has died (or come back): its faction's kill count follows. Called from syncDown. */
function facKill(e, cb, dead) {
  const f = facByName(e.faction);
  if (!f) return;
  if (dead && !cb.facCounted) {
    f.killed = (f.killed || 0) + 1;
    cb.facCounted = f.id;
  } else if (!dead && cb.facCounted) {
    f.killed = Math.max(0, (f.killed || 0) - 1);
    cb.facCounted = null;
  }
}
// ----- the window
function facBox(f, node, kids) {
  const ch = kids(node.id);
  return `<li><div class="fnode ${node.dead ? "dead" : ""}"><input class="ftitle" aria-label="Title" placeholder="Title" data-c="facSet" data-f="${f.id}" data-n="${node.id}" data-k="title" value="${h(node.title)}"><input class="fname" aria-label="Name" placeholder="Name" data-c="facSet" data-f="${f.id}" data-n="${node.id}" data-k="name" value="${h(node.name)}"><div class="frow"><label class="chk s"><input type="checkbox" data-a="facDead" data-v="${f.id}|${node.id}"${node.dead ? " checked" : ""}>Dead</label><button class="btn tiny" data-a="facAdd" data-v="${f.id}|${node.id}" title="Add someone under ${h(node.title || "this one")}">+ Under</button><button class="btn tiny" data-a="facDel" data-v="${f.id}|${node.id}" title="Remove this box and everyone under it">X</button></div></div>${ch.length ? `<ul>${ch.map((c) => facBox(f, c, kids)).join("")}</ul>` : ""}</li>`;
}
function factionsBody() {
  const F = facState();
  const list = F.list || [];
  const f = facOf(F.tab) || list[0];
  const tabs = list
    .map(
      (x) =>
        `<button class="opt ${f && x.id === f.id ? "on" : ""}" data-a="facTab" data-v="${x.id}" aria-pressed="${!!(f && x.id === f.id)}">${h(x.n || "Unnamed")}</button>`,
    )
    .join("");
  const head = `<div class="factabs">${tabs}<button class="btn tiny primary" data-a="facNew" data-v="">+ New faction</button></div>`;
  if (!f) return `${head}<div class="dim">No factions. Add one.</div>`;
  const kids = (pid) => f.nodes.filter((n) => n.parent === pid);
  const roots = kids(null);
  const dead = f.nodes.filter((n) => n.dead).length;
  const theme = f.builtin
    ? `<span class="s dim">Names: ${h((FAC_THEMES[f.theme] || FAC_THEMES.normal).n)}</span>`
    : `<label class="f">Naming theme<select data-c="facTheme" data-f="${f.id}">${options(
        Object.entries(FAC_THEMES).map(([k, t]) => [k, t.n]),
        f.theme || "normal",
      )}</select></label>`;
  return `${head}<div class="facbar"><label class="f grow">Faction<input data-c="facName" data-f="${f.id}" value="${h(f.n)}" aria-label="Faction name"></label>${theme}<label class="f">Toward the party<select data-c="facAtt" data-f="${f.id}">${options(FAC_ATT, f.att || "Neutral")}</select></label><label class="f" title="Counted by itself when an enemy of this faction dies in a fight; type to change it">Members killed${numBox(`data-c="facKilled" data-f="${f.id}"`, f.killed || 0, "cell")}</label></div>
    <div class="facbar"><button class="btn tiny" data-a="facAdd" data-v="${f.id}|">+ Leader</button><button class="btn tiny" data-a="facGen" data-v="${f.id}" title="A hierarchy from the naming theme's ranks, with fresh names. Replaces the boxes here (Undo brings them back).">Generate hierarchy</button><span class="s dim">${f.nodes.length} in the hierarchy${dead ? `, ${dead} dead` : ""}</span><span class="spacer"></span><button class="btn tiny" data-a="facDelete" data-v="${f.id}">Delete faction</button></div>
    <div class="facchart">${roots.length ? `<ul class="ptree">${roots.map((r) => facBox(f, r, kids)).join("")}</ul>` : `<div class="dim">No one yet. Add a leader, or generate a hierarchy.</div>`}</div>`;
}
const FAC_ACT = {
  facTab(v) {
    S.factions.tab = v; // which tab is open isn't worth an undo step
    render();
  },
  facNew() {
    act("New faction", () => {
      const f = { id: facId(), n: "New faction", theme: "normal", att: "Neutral", killed: 0, nodes: [] };
      facState().list.push(f);
      S.factions.tab = f.id;
    });
  },
  facDelete(v) {
    const f = facOf(v);
    if (f)
      act(`Delete faction: ${f.n}`, () => {
        S.factions.list = S.factions.list.filter((x) => x !== f);
        S.factions.tab = (S.factions.list[0] || {}).id || null;
      });
  },
  facName(val, el) {
    const f = facOf(el.dataset.f);
    if (f) act("Faction name", () => (f.n = String(val).trim() || f.n));
  },
  facTheme(val, el) {
    const f = facOf(el.dataset.f);
    if (f) act("Naming theme", () => (f.theme = val));
  },
  facAtt(val, el) {
    const f = facOf(el.dataset.f);
    if (f) act("Faction standing", () => (f.att = val));
  },
  facKilled(val, el) {
    const f = facOf(el.dataset.f);
    const n = num(val);
    if (f && n != null) act("Members killed", () => (f.killed = Math.max(0, Math.round(n))));
    else render();
  },
  facSet(val, el) {
    const f = facOf(el.dataset.f);
    const node = f && f.nodes.find((n) => n.id === el.dataset.n);
    if (node) act(el.dataset.k === "title" ? "Rank title" : "Name", () => (node[el.dataset.k] = String(val)));
  },
  facDead(v, el) {
    const [fid, nid] = splitV(v);
    const node = (facOf(fid) || { nodes: [] }).nodes.find((n) => n.id === nid);
    if (node) act(el.checked ? "Marked dead" : "Marked alive", () => (node.dead = el.checked));
  },
  facAdd(v) {
    const [fid, pid] = splitV(v);
    const f = facOf(fid);
    if (!f) return;
    act(pid ? "Add under" : "Add leader", () => {
      const th = FAC_THEMES[f.theme] || FAC_THEMES.normal;
      // a sensible title: the theme's rank one level down from the parent's, if the parent's title is one of its ranks
      const depth = (id) => (id ? 1 + depth((f.nodes.find((n) => n.id === id) || {}).parent) : 0);
      const ranks = [];
      const walk = (t, d) => {
        ranks[d] = ranks[d] || t[0];
        for (const c of t.slice(1)) walk(c, d + 1);
      };
      walk(th.ranks, 0);
      f.nodes.push({
        id: facId(),
        title: ranks[depth(pid || null)] || "Member",
        name: facName(f, new Set(f.nodes.map((n) => n.name))),
        parent: pid || null,
        dead: false,
      });
    });
  },
  facDel(v) {
    const [fid, nid] = splitV(v);
    const f = facOf(fid);
    if (!f) return;
    act("Remove from hierarchy", () => {
      const gone = new Set([nid]);
      let more = true;
      while (more) {
        more = false;
        for (const n of f.nodes) if (!gone.has(n.id) && gone.has(n.parent)) gone.add(n.id), (more = true);
      }
      f.nodes = f.nodes.filter((n) => !gone.has(n.id));
    });
  },
  facGen(v) {
    const f = facOf(v);
    if (f)
      act(`Generate hierarchy: ${f.n}`, () => {
        f.nodes = facGenerate(f);
      });
  },
};
Object.assign(ACT, FAC_ACT);
