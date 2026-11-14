// ===== 04-tokens.js: MORE MAP TOKENS (12 Nov). New and redrawn icons for players, people, factions, creatures and robots,
// added to TOKEN_ICONS from 04-sheet-map.js, and the groups the icon picker sorts them into. Every icon is drawn in the same
// box as the default person (x -0.75 to 0.75, y -1.05 to 0.45, feet at the bottom). "b" parts take the side's color and
// "cut" parts are dark details. Creatures face right. Which enemy gets which icon is in rules.js: roleIcons, factionIcons
// and creatureIcons.

// mirror(d): the same path flipped left to right, for symmetric parts. Handles M L H V Q C T S Z, absolute or relative
// (a relative x step flips the same way). Arcs (A) aren't handled: don't mirror a path with one.
function mirror(d) {
  const xs = { M: [0], L: [0], T: [0], H: [0], V: [], Q: [0, 2], C: [0, 2, 4], S: [0, 2] };
  const size = { M: 2, L: 2, T: 2, H: 1, V: 1, Q: 4, C: 6, S: 4, Z: 0 };
  return d.replace(/([MLHVQCTSZ])([^MLHVQCTSZ]*)/gi, (_, c, args) => {
    const n = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    const C = c.toUpperCase();
    const k = size[C];
    const out = n.map((v, i) => (k && xs[C].includes(i % k) ? -v : v));
    return c + (out.length ? " " + out.join(" ") : "");
  });
}
const sym = (d, cls = "b") => `<path class="${cls}" d="${d} ${mirror(d)}"/>`;
const P = (d, cls = "b") => `<path class="${cls}" d="${d}"/>`;
const E2 = (cx, cy, rx, ry, cls = "b") => `<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
// a coat that flares at the hem, wider than BODY
const COAT = P("M-.46 .4 Q-.5 -.1 -.3 -.16 H.3 Q.5 -.1 .46 .4 H.08 L0 .12 L-.08 .4Z");
// a four-legged body facing right: [body path, legs]
const LEGS4 = (y0, y1, xs) => xs.map((x) => `M${x} ${y0} H${(x + 0.09).toFixed(2)} V${y1} H${x}Z`).join(" ");

Object.assign(TOKEN_ICONS, {
  // ---- party
  vault: [
    "Vault dweller",
    `${HEAD}${P("M-.27 -.5 Q-.26 -.74 0 -.72 Q.24 -.74 .28 -.52 Q.1 -.64 -.27 -.5Z")}${BODY}${P("M-.04 -.14 H.04 V.4 H-.04Z M-.2 -.16 L0 -.02 L.2 -.16 L.16 -.18 L0 -.08 L-.16 -.18Z", "cut")}${P("M-.62 .06 H-.44 V.2 H-.62Z")}${P("M-.58 .1 H-.48 V.16 H-.58Z", "cut")}`,
  ],
  wanderer: [
    "Wanderer",
    `${HEAD}${P("M-.62 -.56 Q0 -.46 .62 -.56 Q.4 -.62 .24 -.62 Q.22 -.84 0 -.84 Q-.22 -.84 -.24 -.62 Q-.4 -.62 -.62 -.56Z")}${COAT}${P("M-.2 -.32 H.2 V-.2 Q0 -.1 -.2 -.2Z", "cut")}`,
  ],
  courier: [
    "Courier",
    `${HEAD}${P("M-.28 -.48 Q-.3 -.74 0 -.74 Q.3 -.74 .28 -.48 Q.14 -.58 -.28 -.48Z")}${COAT}${P("M-.3 -.16 L-.1 -.16 L-.04 .04 L-.24 .02Z M.3 -.16 L.1 -.16 L.04 .04 L.24 .02Z", "cut")}${P("M.34 -.02 L.6 -.5 L.66 -.47 L.42 .02Z")}`,
  ],
  doctor: [
    "Doctor",
    `${HEAD}${E2(0, -0.66, 0.1, 0.07)}${E2(0, -0.66, 0.05, 0.035, "cut")}${BODY}${P("M-.12 -.14 L-.04 .4 M.12 -.14 L.04 .4", "cut")}${P("M-.18 -.12 Q-.24 .16 0 .2 Q.24 .16 .18 -.12 L.13 -.12 Q.18 .12 0 .14 Q-.18 .12 -.13 -.12Z", "cut")}`,
  ],
  engineer: [
    "Engineer",
    `${HEAD}${P("M-.4 -.52 H.4 V-.47 H-.4Z M-.3 -.52 Q-.3 -.84 0 -.84 Q.3 -.84 .3 -.52Z")}${P("M-.03 -.84 H.03 V-.52 H-.03Z", "cut")}${BODY}${P("M.44 -.3 L.62 .06 L.56 .09 L.38 -.27Z M.32 -.4 Q.36 -.48 .46 -.44 L.42 -.36 L.48 -.3 L.54 -.36 Q.56 -.24 .44 -.22 Q.36 -.24 .32 -.4Z")}`,
  ],
  merchant: [
    "Merchant",
    `${P("M-.42 -.4 H.42 V.16 H-.42Z")}${P("M-.34 -.32 H.34 V-.26 H-.34Z M-.34 -.04 H.34 V.02 H-.34Z", "cut")}${E2(0, -0.42, 0.33, 0.33, "cut")}${HEAD}${P("M-.36 -.56 H.36 V-.5 H-.36Z M-.22 -.56 L-.2 -.78 H.2 L.22 -.56Z")}${BODY}`,
  ],
  hunter: [
    "Hunter",
    `${P("M-.3 -.3 Q-.36 -.7 0 -.98 Q.36 -.7 .3 -.3Z")}${E2(0, -0.42, 0.18, 0.18, "cut")}${BODY}${P("M.5 -.62 Q.82 -.2 .5 .26 L.46 .22 Q.74 -.2 .46 -.58Z")}${P("M.48 -.6 V.24", "cut")}`,
  ],
  preacher: [
    "Preacher",
    `${HEAD}${P("M-.5 -.56 H.5 V-.5 H-.5Z M-.24 -.56 V-.84 H.24 V-.56Z")}${COAT}${P("M-.06 -.16 H.06 V-.08 H-.06Z", "cut")}${P("M-.24 .02 H.04 V.28 H-.24Z")}${P("M-.12 .06 H-.08 V.24 H-.12Z M-.18 .12 H-.02 V.16 H-.18Z", "cut")}`,
  ],
  merc: [
    "Mercenary",
    `${HEAD}${P("M-.3 -.52 Q-.36 -.76 .02 -.78 Q.42 -.78 .4 -.6 Q.2 -.56 -.3 -.52Z")}${BODY}${P("M-.38 -.06 L.26 .38 L.34 .32 L-.3 -.12Z", "cut")}${P("M-.22 .03 h.06 v.06 h-.06Z M-.06 .14 h.06 v.06 h-.06Z M.1 .25 h.06 v.06 h-.06Z")}`,
  ],
  cyborg: [
    "Cyborg",
    `${HEAD}${P("M0 -.69 A.27 .27 0 0 1 0 -.15Z", "cut")}${E2(0.12, -0.44, 0.06, 0.06)}${BODY}${P("M.04 -.14 H.46 V.4 H.04Z", "cut")}${P("M.12 -.06 H.38 V.0 H.12Z M.12 .1 H.38 V.16 H.12Z")}`,
  ],
  // ---- people the party meets
  farmer: [
    "Farmer",
    `${HEAD}${P("M-.62 -.5 L0 -.86 L.62 -.5 Q0 -.58 -.62 -.5Z")}${BODY}${P("M.5 -.7 H.56 V.4 H.5Z M.4 -.86 H.44 V-.7 H.62 V-.86 H.66 V-.66 H.4Z")}${P("M-.12 -.14 H-.06 V.2 H-.12Z M.06 -.14 H.12 V.2 H.06Z", "cut")}`,
  ],
  scavenger: [
    "Scavenger",
    `${P("M-.4 -.34 H.4 V.06 H-.4Z M-.36 -.62 H-.26 V-.34 H-.36Z M.26 -.62 H.36 V-.34 H.26Z")}${HEAD}${E2(-0.1, -0.6, 0.09, 0.07, "cut")}${E2(0.1, -0.6, 0.09, 0.07, "cut")}${BODY}${P("M-.24 -.22 H.24 V-.12 Q0 -.04 -.24 -.12Z", "cut")}`,
  ],
  ranger: [
    "NCR Ranger",
    `${P("M-.3 -.36 Q-.34 -.82 0 -.82 Q.34 -.82 .3 -.36 L.16 -.2 H-.16Z")}${E2(-0.12, -0.5, 0.08, 0.08, "cut")}${E2(0.12, -0.5, 0.08, 0.08, "cut")}${P("M-.08 -.34 H.08 V-.22 H-.08Z", "cut")}${COAT}${P("M-.46 -.08 L-.62 -.16 L-.6 -.02Z M.46 -.08 L.62 -.16 L.6 -.02Z")}`,
  ],
  centurion: [
    "Centurion",
    `${HEAD}${P("M-.3 -.42 Q-.3 -.76 0 -.76 Q.3 -.76 .3 -.42Z")}${P("M-.46 -.66 Q0 -1.12 .46 -.66 H.36 Q0 -.94 -.36 -.66Z")}${P("M-.3 -.44 V-.22 H-.22 V-.44Z M.3 -.44 V-.22 H.22 V-.44Z")}${P("M-.56 .4 V-.04 Q-.56 -.18 -.34 -.18 H.34 Q.56 -.18 .56 -.04 V.4Z")}${P("M-.4 -.04 H.4 V.02 H-.4Z M-.4 .12 H.4 V.18 H-.4Z M-.4 .28 H.4 V.34 H-.4Z", "cut")}`,
  ],
  pyro: [
    "Pyro",
    `${P("M-.4 -.44 H-.22 V.1 H-.4Z")}${HEAD}${E2(-0.1, -0.48, 0.07, 0.07, "cut")}${E2(0.1, -0.48, 0.07, 0.07, "cut")}${P("M-.08 -.36 H.08 L.12 -.2 H-.12Z", "cut")}${BODY}${P("M.2 .04 L.62 -.08 L.64 -.02 L.22 .1Z")}${P("M.62 -.06 Q.74 -.24 .7 -.38 Q.66 -.22 .6 -.2 Q.62 -.32 .56 -.42 Q.54 -.18 .66 -.04Z")}`,
  ],
  chemist: [
    "Chem cook",
    `${HEAD}${E2(-0.1, -0.5, 0.08, 0.07, "cut")}${E2(0.1, -0.5, 0.08, 0.07, "cut")}${BODY}${P("M.42 -.42 H.5 V-.24 L.62 .02 Q.64 .1 .56 .1 H.36 Q.28 .1 .3 .02 L.42 -.24Z")}${P("M.34 -.02 H.58 L.6 .06 H.32Z", "cut")}`,
  ],
  paladin: [
    "Paladin",
    `${P("M-.28 -.24 Q-.36 -.8 0 -.82 Q.36 -.8 .28 -.24Z")}${P("M-.22 -.54 H.22 V-.46 H-.22Z", "cut")}${P("M-.05 -.82 H.05 V-.6 H-.05Z", "cut")}${P("M-.68 .4 V-.06 Q-.68 -.28 -.44 -.28 H.44 Q.68 -.28 .68 -.06 V.4Z")}${P("M-.68 -.02 H-.4 V.06 H-.68Z M.4 -.02 H.68 V.06 H.4Z M-.08 -.2 H.08 V.4 H-.08Z", "cut")}`,
  ],
  chairman: [
    "Chairman",
    `${HEAD}${P("M-.28 -.5 Q-.34 -.86 .06 -.9 Q.44 -.9 .3 -.6 Q.2 -.76 -.28 -.5Z")}${BODY}${P("M-.12 -.16 L0 -.06 L.12 -.16 L.12 -.04 L0 -.1 L-.12 -.04Z", "cut")}${P("M-.3 -.14 L-.06 .1 L-.04 .4 M.3 -.14 L.06 .1 L.04 .4", "cut")}`,
  ],
  warlord: [
    "Warlord",
    `${HEAD}${P("M-.06 -.68 L0 -1.02 L.06 -.68Z M-.16 -.64 L-.14 -.92 L-.04 -.68Z M.16 -.64 L.14 -.92 L.04 -.68Z")}${BODY}${P("M-.58 -.1 L-.7 -.42 L-.5 -.2 L-.56 -.5 L-.4 -.22 L-.3 -.16Z")}${P(mirror("M-.58 -.1 L-.7 -.42 L-.5 -.2 L-.56 -.5 L-.4 -.22 L-.3 -.16Z"))}${P("M-.1 -.12 L0 .02 L.1 -.12Z", "cut")}`,
  ],
  sniper: [
    "Sharpshooter",
    `${P("M-.3 -.32 Q-.36 -.74 0 -.86 Q.36 -.74 .3 -.32Z")}${E2(0, -0.42, 0.18, 0.17, "cut")}${BODY}${P("M-.62 .14 L.7 -.36 L.72 -.3 L-.6 .2Z")}${P("M.04 -.2 H.3 V-.14 H.04Z M.12 -.26 H.22 V-.2 H.12Z")}`,
  ],
  heavy: [
    "Heavy gunner",
    `${HEAD}${P("M-.62 .4 Q-.66 -.06 -.42 -.2 H.42 Q.66 -.06 .62 .4Z")}${P("M-.2 -.02 H.72 V.18 H-.2Z")}${P("M.3 .02 H.72 V.06 H.3Z M.3 .1 H.72 V.14 H.3Z M-.12 .02 H.14 V.14 H-.12Z", "cut")}`,
  ],
  // ---- redrawn: a brute with a small head low between huge shoulders
  mutant: [
    "Super mutant",
    `<circle class="b" cy="-.42" r=".2"/>${P("M-.12 -.48 H.12 V-.42 H-.12Z", "cut")}${P("M-.7 .4 Q-.76 -.06 -.5 -.28 Q-.24 -.36 0 -.26 Q.24 -.36 .5 -.28 Q.76 -.06 .7 .4Z")}${P("M-.3 -.1 Q-.16 0 0 -.06 Q.16 0 .3 -.1 M-.04 -.06 V.3", "cut")}${P("M-.5 .02 H-.42 V.36 H-.5Z M.42 .02 H.5 V.36 H.42Z", "cut")}`,
  ],
  glowone: ["Glowing One", `<path class="b" fill-rule="evenodd" d="M0 -1 A.72 .72 0 1 1 -.001 -1Z M0 -.9 A.62 .62 0 1 0 .001 -.9Z"/>${TOKEN_ICONS.ghoul[1]}`],
  // ---- creatures, facing right
  dog: [
    "Dog",
    `${P("M-.56 -.02 Q-.58 -.2 -.36 -.2 H.2 L.3 -.4 Q.44 -.48 .54 -.4 L.68 -.3 L.64 -.22 L.44 -.2 L.36 -.04 Q.34 .06 .26 .06 L.28 .38 H.2 L.14 .1 H-.26 L-.3 .38 H-.38 L-.4 .06 Q-.54 .06 -.56 -.02Z")}${P("M.32 -.42 L.36 -.56 L.44 -.44Z")}${P("M-.56 -.1 Q-.7 -.2 -.66 -.4 Q-.6 -.24 -.52 -.18Z")}${P("M.5 -.34 h.05 v.05 h-.05Z", "cut")}`,
  ],
  coyote: [
    "Coyote",
    `${P("M-.48 -.04 Q-.46 -.2 -.28 -.18 H.18 L.3 -.36 Q.4 -.42 .5 -.34 L.72 -.24 L.7 -.2 L.46 -.18 L.34 -.04 Q.3 .04 .22 .04 L.26 .38 H.19 L.13 .08 H-.2 L-.24 .38 H-.31 L-.33 .06 Q-.46 .06 -.48 -.04Z")}${P("M.3 -.38 L.32 -.6 L.4 -.4Z M.38 -.38 L.44 -.58 L.47 -.36Z")}${P("M-.46 -.08 Q-.74 -.02 -.72 .26 Q-.64 .1 -.44 .02Z")}${P("M.48 -.3 h.05 v.04 h-.05Z", "cut")}`,
  ],
  nightstalker: [
    "Nightstalker",
    `${P("M-.42 -.04 Q-.4 -.2 -.22 -.18 H.2 L.32 -.36 Q.42 -.42 .52 -.34 L.7 -.24 L.68 -.2 L.46 -.18 L.36 -.04 Q.32 .04 .24 .04 L.28 .38 H.21 L.15 .08 H-.16 L-.2 .38 H-.27 L-.29 .06 Q-.4 .06 -.42 -.04Z")}${P("M.32 -.38 L.34 -.56 L.42 -.4Z")}${P("M-.42 -.1 Q-.66 -.12 -.62 -.4 Q-.58 -.62 -.4 -.66 Q-.3 -.66 -.28 -.58 L-.4 -.56 Q-.52 -.5 -.52 -.36 Q-.52 -.2 -.38 -.18Z")}${P("M-.3 -.6 h.04 v.04 h-.04Z M.49 -.3 h.05 v.04 h-.05Z", "cut")}`,
  ],
  cyberdog: [
    "Cyberdog",
    `${P("M-.56 -.02 Q-.58 -.2 -.36 -.2 H.2 L.3 -.4 Q.44 -.48 .54 -.4 L.68 -.3 L.64 -.22 L.44 -.2 L.36 -.04 Q.34 .06 .26 .06 L.28 .38 H.2 L.14 .1 H-.26 L-.3 .38 H-.38 L-.4 .06 Q-.54 .06 -.56 -.02Z")}${P("M.26 -.42 Q.28 -.66 .44 -.66 Q.58 -.64 .56 -.42Z")}${P("M.32 -.48 Q.36 -.6 .44 -.6 Q.52 -.58 .5 -.48Z M-.3 -.14 H.1 V-.08 H-.3Z", "cut")}`,
  ],
  molerat: [
    "Mole rat",
    `${P("M-.62 .2 Q-.6 -.12 -.24 -.16 Q.16 -.2 .34 -.08 Q.6 -.08 .66 .1 Q.6 .2 .44 .2 L.42 .36 H.34 L.32 .22 H-.24 L-.26 .36 H-.34 L-.36 .22 Q-.6 .26 -.62 .2Z")}${P("M.56 .14 L.6 .3 L.52 .3Z M.62 .12 L.68 .26 L.6 .26Z")}${P("M-.62 .16 Q-.74 .1 -.72 -.08 L-.68 -.08 Q-.68 .06 -.6 .1Z")}${P("M.4 -.04 h.05 v.05 h-.05Z", "cut")}`,
  ],
  radroach: [
    "Radroach",
    `${E2(0, 0, 0.24, 0.34)}${E2(0, -0.42, 0.13, 0.1)}${P("M-.02 -.34 V.32", "cut")}${P("M-.06 -.5 Q-.2 -.8 -.5 -.96 L-.48 -.99 Q-.16 -.84 -.02 -.52Z")}${P(mirror("M-.06 -.5 Q-.2 -.8 -.5 -.96 L-.48 -.99 Q-.16 -.84 -.02 -.52Z"))}${sym("M-.22 -.16 L-.5 -.3 L-.52 -.26 L-.22 -.1Z M-.24 .04 L-.56 .04 L-.56 .09 L-.24 .1Z M-.2 .2 L-.46 .38 L-.43 .41 L-.18 .26Z")}`,
  ],
  mantis: [
    "Mantis",
    `${P("M.32 -.84 L.56 -.74 L.36 -.6Z")}${P("M.32 -.68 L.18 -.2 L.24 -.18 L.4 -.64Z")}${P("M.2 -.4 L.52 -.46 L.62 -.24 L.56 -.22 L.48 -.38 L.24 -.32Z M.48 -.38 L.38 -.2 L.44 -.18Z")}${P("M.24 -.24 Q-.2 -.3 -.62 .02 Q-.2 .02 .24 -.12Z")}${P("M.12 -.18 L0 .4 H.05 L.18 -.14Z M-.1 -.12 L-.3 .4 H-.24 L-.04 -.08Z")}`,
  ],
  bloatfly: [
    "Bloatfly",
    `${E2(-0.12, 0.06, 0.4, 0.3)}${P("M-.4 -.04 Q-.12 .02 .1 -.08 M-.44 .14 Q-.12 .2 .14 .1", "cut")}${E2(0.36, -0.12, 0.14, 0.13)}${P("M.48 -.1 L.72 0 L.48 -.04Z")}${P("M.06 -.2 Q-.1 -.74 .28 -.62 Q.32 -.4 .16 -.2Z M-.06 -.2 Q-.42 -.66 -.04 -.68 Q.1 -.44 .02 -.2Z")}${P("M.38 -.16 h.05 v.05 h-.05Z", "cut")}`,
  ],
  lakelurk: [
    "Lakelurk",
    `${P("M-.62 .38 Q-.66 -.2 -.2 -.36 Q.3 -.46 .56 -.2 Q.7 -.06 .64 .1 Q.5 .2 .3 .14 L.36 .38 H.24 L.14 .16 H-.24 L-.3 .38Z")}${P("M-.4 -.28 L-.34 -.62 L-.2 -.4 L-.12 -.7 L0 -.42 L.1 -.66 L.18 -.4Z")}${P("M.3 .02 Q.5 .1 .62 .02", "cut")}${P("M.4 -.18 h.06 v.06 h-.06Z", "cut")}`,
  ],
  bighorner: [
    "Bighorner",
    `${P("M-.62 -.02 Q-.62 -.24 -.36 -.24 H.18 L.34 -.34 Q.52 -.36 .6 -.24 L.62 -.12 L.42 -.08 L.36 .04 L.38 .38 H.29 L.24 .08 H-.36 L-.4 .38 H-.49 L-.5 .06 Q-.62 .06 -.62 -.02Z")}${P("M.3 -.3 Q.08 -.66 .3 -.78 Q.56 -.84 .58 -.56 Q.56 -.4 .42 -.42 Q.5 -.56 .4 -.64 Q.26 -.66 .3 -.5 Q.34 -.4 .4 -.36Z")}${P("M.5 -.24 h.05 v.05 h-.05Z", "cut")}`,
  ],
  brahmin: [
    "Brahmin",
    `${P("M-.56 .4 V-.04 Q-.56 -.22 -.36 -.22 H.36 Q.56 -.22 .56 -.04 V.4 H.44 V.12 H-.44 V.4Z")}${E2(-0.24, -0.4, 0.17, 0.19)}${E2(0.24, -0.4, 0.17, 0.19)}${sym("M-.36 -.5 Q-.56 -.56 -.56 -.74 Q-.46 -.6 -.3 -.6Z M-.14 -.54 Q-.08 -.72 .02 -.76 Q-.02 -.62 -.08 -.52Z")}${sym("M-.3 -.44 h.05 v.05 h-.05Z M-.18 -.44 h.05 v.05 h-.05Z", "cut")}`,
  ],
  boar: [
    "Boar",
    `${P("M-.6 .02 Q-.62 -.26 -.24 -.32 L-.14 -.42 L-.06 -.32 L.04 -.42 L.12 -.3 Q.4 -.26 .52 -.1 L.68 -.02 L.66 .08 L.42 .1 L.34 .14 L.36 .38 H.27 L.22 .16 H-.34 L-.38 .38 H-.47 L-.48 .12 Q-.6 .12 -.6 .02Z")}${P("M.5 .06 Q.62 -.06 .56 -.2 L.6 -.2 Q.68 -.02 .54 .1Z", "cut")}${P("M.38 -.14 h.05 v.05 h-.05Z", "cut")}`,
  ],
  centaur: [
    "Centaur",
    `${P("M-.56 .3 Q-.66 -.2 -.26 -.34 Q.16 -.46 .4 -.24 Q.58 -.06 .5 .3 Q.3 .4 0 .34 Q-.3 .4 -.56 .3Z")}${E2(0.42, -0.44, 0.16, 0.14)}${P("M.42 -.5 h.06 v.06 h-.06Z M.38 -.38 H.54 V-.34 H.38Z", "cut")}${P("M-.5 .2 Q-.74 .3 -.72 .44 L-.66 .44 Q-.66 .32 -.46 .26Z M-.2 .34 L-.24 .44 H-.16 L-.12 .34Z M.2 .34 L.18 .44 H.26 L.28 .32Z")}${P("M-.4 -.28 Q-.6 -.56 -.44 -.76 Q-.4 -.56 -.3 -.38Z M-.1 -.38 Q-.14 -.72 .04 -.82 Q.02 -.6 .02 -.4Z")}`,
  ],
  // ---- robots
  protectron: [
    "Protectron",
    `${P("M-.26 -.56 Q-.26 -.96 0 -.96 Q.26 -.96 .26 -.56Z")}${E2(0, -0.74, 0.16, 0.13, "cut")}${E2(0, -0.74, 0.06, 0.05)}${P("M-.3 -.56 H.3 V.04 H-.3Z")}${P("M-.2 -.46 H.2 V-.38 H-.2Z M-.2 -.3 H.2 V-.22 H-.2Z", "cut")}${P("M-.46 -.5 H-.34 V-.02 H-.46Z M.34 -.5 H.46 V-.02 H.34Z M-.24 .04 H-.1 V.36 H-.24Z M.1 .04 H.24 V.36 H.1Z M-.32 .34 H.32 V.42 H-.32Z")}`,
  ],
  handy: [
    "Mr. Handy",
    `${E2(0, -0.3, 0.34, 0.32)}${P("M-.24 -.4 H.24 V-.34 H-.24Z", "cut")}${sym("M-.14 -.58 L-.24 -.86 L-.18 -.88 L-.08 -.6Z")}${E2(-0.24, -0.9, 0.07, 0.07)}${E2(0.24, -0.9, 0.07, 0.07)}${P("M-.03 -.6 H.03 V-.94 H-.03Z")}${E2(0, -0.98, 0.07, 0.07)}${sym("M-.3 -.14 L-.6 .04 L-.56 .1 L-.26 -.06Z")}${P("M-.03 .0 H.03 V.22 H-.03Z")}${P("M-.12 .24 L0 .44 L.12 .24 Q0 .3 -.12 .24Z")}`,
  ],
  sentrybot: [
    "Sentry Bot",
    `${P("M-.42 -.4 Q-.42 -.66 0 -.66 Q.42 -.66 .42 -.4 V.1 H-.42Z")}${E2(0, -0.46, 0.12, 0.08, "cut")}${sym("M-.42 -.36 H-.72 V-.16 H-.42Z")}${sym("M-.72 -.3 H-.56 V-.22 H-.72Z", "cut")}${P("M-.5 .1 H.5 Q.6 .1 .6 .24 Q.6 .4 .46 .4 H-.46 Q-.6 .4 -.6 .24 Q-.6 .1 -.5 .1Z")}${P("M-.4 .2 H.4 V.3 H-.4Z", "cut")}`,
  ],
  securitron: [
    "Securitron",
    `${P("M-.36 -.98 H.36 V-.34 H-.36Z")}${P("M-.28 -.9 H.28 V-.42 H-.28Z", "cut")}${P("M-.14 -.74 h.06 v.08 h-.06Z M.08 -.74 h.06 v.08 h-.06Z M-.14 -.56 Q0 -.48 .14 -.56 L.14 -.53 Q0 -.45 -.14 -.53Z")}${sym("M-.36 -.3 H-.62 V-.1 H-.36Z")}${P("M-.22 -.34 H.22 V.1 H-.22Z")}${E2(0, 0.26, 0.17, 0.17)}${E2(0, 0.26, 0.07, 0.07, "cut")}`,
  ],
  assaultron: [
    "Assaultron",
    `${P("M-.16 -.66 Q-.16 -.86 0 -.86 Q.16 -.86 .16 -.66 Q.16 -.5 0 -.5 Q-.16 -.5 -.16 -.66Z")}${P("M-.12 -.7 H.12 V-.64 H-.12Z", "cut")}${P("M-.3 -.44 H.3 L.18 -.08 H-.18Z M-.08 -.08 H.08 V.06 H-.08Z M-.2 .06 H.2 L.12 .2 H-.12Z")}${sym("M-.3 -.42 L-.54 -.06 L-.6 .2 L-.54 .2 L-.48 -.04 L-.26 -.34Z")}${P("M-.12 .2 L-.18 .42 H-.1 L-.04 .2Z M.12 .2 L.18 .42 H.1 L.04 .2Z")}`,
  ],
  robobrain: [
    "Robobrain",
    `${P("M-.3 -.46 Q-.3 -.92 0 -.92 Q.3 -.92 .3 -.46Z")}${P("M-.2 -.6 Q-.12 -.78 0 -.66 Q.12 -.8 .2 -.6 M-.16 -.5 Q0 -.6 .16 -.5", "cut")}${P("M-.34 -.46 H.34 V.06 H-.34Z")}${P("M-.12 -.36 H.12 V-.28 H-.12Z", "cut")}${sym("M-.34 -.36 L-.56 -.14 L-.5 -.1 L-.34 -.24Z")}${P("M-.42 .06 H.42 Q.5 .06 .5 .2 Q.5 .38 .36 .38 H-.36 Q-.5 .38 -.5 .2 Q-.5 .06 -.42 .06Z")}${P("M-.34 .16 H.34 V.26 H-.34Z", "cut")}`,
  ],
  robot: [
    "Robot",
    `${P("M-.24 -.86 H.24 V-.5 H-.24Z")}${P("M-.16 -.76 h.1 v.1 h-.1Z M.06 -.76 h.1 v.1 h-.1Z", "cut")}${P("M-.03 -.98 H.03 V-.86 H-.03Z")}${E2(0, -1, 0.05, 0.05)}${P("M-.38 -.46 H.38 V.12 H-.38Z")}${P("M-.12 -.34 H.12 V-.1 H-.12Z", "cut")}${sym("M-.38 -.42 H-.56 V.02 H-.38Z")}${P("M-.26 .12 H-.1 V.4 H-.26Z M.1 .12 H.26 V.4 H.1Z")}`,
  ],
});
// Which group each icon sits in, in the icon picker. Icons not listed go under Other.
const ICON_GROUPS = [
  [
    "Party",
    [
      "person",
      "vault",
      "wanderer",
      "courier",
      "doctor",
      "medic",
      "engineer",
      "scientist",
      "merchant",
      "hunter",
      "preacher",
      "merc",
      "cyborg",
      "cowboy",
      "gunslinger",
      "sniper",
      "heavy",
      "muscle",
      "ninja",
      "king",
      "hood",
      "armored",
      "power",
      "soldier",
    ],
  ],
  ["People", ["farmer", "scavenger", "chemist", "pyro", "warlord", "skull"]],
  [
    "Factions",
    ["raider", "fiend", "khan", "convict", "bandit", "tribal", "ncr", "ranger", "legion", "centurion", "paladin", "mobster", "chairman", "greaser", "pilot"],
  ],
  [
    "Creatures",
    [
      "dog",
      "coyote",
      "nightstalker",
      "cyberdog",
      "rat",
      "molerat",
      "ant",
      "radroach",
      "mantis",
      "scorpion",
      "wasp",
      "bloatfly",
      "deathclaw",
      "lizard",
      "lakelurk",
      "beast",
      "bighorner",
      "brahmin",
      "boar",
      "plant",
      "paw",
    ],
  ],
  ["Mutants and ghouls", ["mutant", "centaur", "ghoul", "glowone"]],
  ["Robots", ["robot", "protectron", "handy", "sentrybot", "securitron", "assaultron", "robobrain", "eyebot"]],
];
// 13 Nov: more detail on the plainest tokens: collars, belts, rivets, visors, claws, teeth ("cl" parts are fine dark lines).
const TOKEN_MORE = {
  person: `<path class="cl" d="M-.13 -.13 L0 0 L.13 -.13M-.4 .2 H.4"/>`,
  armored: `<circle class="cut" cx="-.36" cy="-.04" r=".03"/><circle class="cut" cx=".36" cy="-.04" r=".03"/><path class="cl" d="M-.44 .22 H-.14M.14 .22 H.44"/>`,
  power: `<path class="cl" d="M-.3 -.3 H.3M-.46 .06 H-.24M.24 .06 H.46M-.32 .28 H.32"/><circle class="cut" cx="-.24" cy="-.62" r=".035"/><circle class="cut" cx=".24" cy="-.62" r=".035"/>`,
  paw: `<path class="cut" d="M-.36 -.32 l.03 -.08 l.03 .08Z M-.15 -.53 l.03 -.08 l.03 .08Z M.09 -.53 l.03 -.08 l.03 .08Z M.3 -.32 l.03 -.08 l.03 .08Z"/><path class="cl" d="M-.12 .12 Q0 .2 .12 .12"/>`,
  skull: `<path class="cut" d="M-.04 -.3 L0 -.36 L.04 -.3Z"/><path class="cl" d="M-.12 -.12 V-.06M0 -.12 V-.06M.12 -.12 V-.06"/>`,
  vault: `<path class="cl" d="M-.36 .3 H.36"/>`,
  wanderer: `<path class="cl" d="M-.3 .05 L-.1 .35M.3 .05 L.1 .35"/>`,
  muscle: `<path class="cl" d="M-.3 .2 Q0 .28 .3 .2"/>`,
  ghoul: `<path class="cl" d="M.16 -.62 l.06 .06M-.2 -.58 l-.05 .05"/>`,
  medic: `<path class="cl" d="M-.13 -.13 L0 -.04 L.13 -.13"/>`,
  dog: `<circle class="cut" cx=".28" cy="-.26" r=".03"/>`,
  lizard: `<circle class="cut" cx=".38" cy="-.08" r=".025"/>`,
};
for (const [k, extra] of Object.entries(TOKEN_MORE)) if (TOKEN_ICONS[k]) TOKEN_ICONS[k][1] += extra;
