// LINE ICONS (11 Nov): 24 x 24 drawings in the side's color, for S.P.E.C.I.A.L., skills, weapon kinds and items.
// Lines take the text color; "f" parts are filled. Drawn with vicon(name).
const VICON = {
  // ---- S.P.E.C.I.A.L.
  S: `<path d="M2.5 21.5V15c3.5-3.8 8.5-4.6 11.5-1.8L10.8 7.4c-.8-1.6-.3-3.4 1.2-4.2l2.3-1c1.6-.6 3.1.3 3.5 1.8L17 6.5l3.6 7.8c1.3 3.8-1.4 7.2-5.1 7.2z"/><path d="M14 13.2c.8 1.4.8 3-.2 4.3"/><path d="M12.4 4.6l2.4-.8"/>`,
  P: `<path d="M2 12c2.6-4.2 6-6.3 10-6.3S19.4 7.8 22 12c-2.6 4.2-6 6.3-10 6.3S4.6 16.2 2 12z"/><circle cx="12" cy="12" r="3.3"/><circle class="f" cx="12" cy="12" r="1.3"/><path d="M12 1.5v2.2M4.6 3.8l1.4 1.8M19.4 3.8 18 5.6M12 20.3v2.2M4.6 20.2l1.4-1.8M19.4 20.2 18 18.4"/>`,
  E: `<path d="M12 21s-8.5-5.2-8.5-11.2C3.5 6.6 5.8 4.5 8.4 4.5c1.6 0 2.9.8 3.6 2 .7-1.2 2-2 3.6-2 2.6 0 4.9 2.1 4.9 5.3C20.5 15.8 12 21 12 21z"/><path d="M5.4 12h3.2l1.5-3 2.2 6 1.7-4.2 1 1.2h3.6"/>`,
  C: `<path d="M3.5 10.5c2.2 1.4 5 2.1 8.5 2.1s6.3-.7 8.5-2.1c-.6 4.7-4 7.8-8.5 7.8s-7.9-3.1-8.5-7.8z"/><path d="M6.5 12.6c1.6 1.6 3.4 2.3 5.5 2.3s3.9-.7 5.5-2.3"/><path d="M4 6.5 2.6 4.6M8.2 5.2 7.6 3M15.8 5.2l.6-2.2M20 6.5l1.4-1.9"/>`,
  I: `<path d="M12 4.3c-.9-1.2-2.4-1.8-3.9-1.5-1.8.3-3 1.9-3 3.7-1.6.6-2.6 2.2-2.4 4 .1 1 .6 1.9 1.3 2.5-.6 1.4-.3 3.1.9 4.1.8.7 1.9 1 2.9.8.5 1.6 2 2.7 3.7 2.6.2 0 .4 0 .5-.1V4.3z"/><path d="M12 4.3c.9-1.2 2.4-1.8 3.9-1.5 1.8.3 3 1.9 3 3.7 1.6.6 2.6 2.2 2.4 4-.1 1-.6 1.9-1.3 2.5.6 1.4.3 3.1-.9 4.1-.8.7-1.9 1-2.9.8-.5 1.6-2 2.7-3.7 2.6-.2 0-.4 0-.5-.1"/><path d="M8.3 8.5c1 0 1.8.8 1.8 1.8M5.8 13.5c1.2-.6 2.6-.3 3.4.8M15.7 8.5c-1 0-1.8.8-1.8 1.8M18.2 13.5c-1.2-.6-2.6-.3-3.4.8M9.4 18c.2-1 1-1.8 2.1-2M14.6 18c-.2-1-1-1.8-2.1-2"/>`,
  A: `<path d="M12 3.5 16.5 8 13 12.5"/><path d="M12 3.5 8 9.5l-4.5 3"/><path d="M13 12.5h2.5M3.5 12.5l-1 2"/><path d="M5 18.5v3M9.5 16.5v5M14 18.5v3"/><path d="M19 3.5l2-1.5M19.5 7h2.5"/>`,
  L: `<rect x="2.5" y="8.5" width="10" height="10" rx="2" transform="rotate(-12 7.5 13.5)"/><rect x="11.5" y="5.5" width="10" height="10" rx="2" transform="rotate(14 16.5 10.5)"/><circle class="f" cx="5.4" cy="11.4" r="1.1"/><circle class="f" cx="9.3" cy="15.6" r="1.1"/><circle class="f" cx="7.4" cy="13.5" r="1.1"/><circle class="f" cx="14.6" cy="8" r="1.1"/><circle class="f" cx="18.6" cy="9" r="1.1"/><circle class="f" cx="14.4" cy="12.1" r="1.1"/><circle class="f" cx="18.4" cy="13.1" r="1.1"/>`,
  // ---- skills
  BAR: `<path d="M9 2l1.4 1.5 2-.6.6 2 2 .6-.6 2L16 9l-1.6 1.5.6 2-2 .6-.6 2-2-.6L9 16l-1.4-1.5-2 .6-.6-2-2-.6.6-2L2 9l1.6-1.5-.6-2 2-.6.6-2 2 .6z"/><circle cx="9" cy="9" r="3.2"/><path d="M14.5 18h7.5M19 15.5l3 2.5-3 2.5M17.5 22.5"/>`,
  EW: `<path d="M2.5 9h12.5l2 2h4.5v3H17l-2 2H9.5l-1 4.5H5l1-4.5H2.5z"/><path d="M21.5 6.5l-2.5 2M22.5 11.5h-1M21.5 17l-2.5-2"/><path d="M5 12h6"/>`,
  EXP: `<circle cx="10" cy="14.5" r="7"/><path d="M14.5 9.2l2-2"/><path d="M16 6.5c1-2 3-2.6 4.8-1.6"/><path d="M20.5 1.5v1.6M23 3.8h-1.6M22.3 1.9l-1.1 1.1"/><path d="M6.5 13a4 4 0 0 1 3-3"/>`,
  SG: `<path d="M2.5 7.5h17l1.5 1.5v2H10.5l-1 1.5-.5 2.5c-.2 1.3-1.1 2-2.3 2H5.3l1.4-6.5H2.5z"/><path d="M10.5 11h-2.8"/><path d="M8.2 13.6c.9.1 1.5-.3 1.6-1.1"/>`,
  BG: `<rect x="5" y="8" width="7" height="8" rx="1"/><path d="M12 9.2h10M12 11.2h10M12 13.2h10M12 15.2h10"/><path d="M7 16v3.5h4M5 11H2.5"/><path d="M7.5 8V5.5h3V8"/>`,
  LPK: `<rect x="4" y="10" width="13" height="11" rx="1.5"/><path d="M7 10V6.5a3.5 3.5 0 0 1 7 0V10"/><circle class="f" cx="10.5" cy="14.5" r="1.4"/><path d="M10.5 15.5v2.5"/><path d="M14 17.5l8-5.5M20 13.5l1.5 1.8"/>`,
  MED: `<rect x="3" y="3" width="18" height="18" rx="3"/><path class="f" d="M10 6.5h4v3.5h3.5v4H14v3.5h-4V14H6.5v-4H10z"/>`,
  MW: `<path d="M20.5 3.5 9.5 14.5l-1.4-1.4L19.1 2.1z"/><path d="M20.5 3.5 21 2.6l-1.9.5"/><path d="M6.4 11.4l6.2 6.2M8.5 15.5l-4.3 4.3M3 18.6l2.4 2.4"/>`,
  REP: `<path d="M14.7 6.3a4.5 4.5 0 0 0 5.6 5.6L21 11l-1.6-1.6-2 .2-.5-2.1L18.6 5 17 3.4l-.7.7A4.5 4.5 0 0 0 14.7 6.3z"/><path d="M15 9.5 4.5 20a2 2 0 0 1-2.9-2.8L12 6.7"/><circle class="f" cx="3.6" cy="18.4" r=".9"/>`,
  SCI: `<circle class="f" cx="12" cy="12" r="1.8"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/>`,
  SNK: `<path d="M2 11.5c2.8-3.3 6.1-5 10-5s7.2 1.7 10 5"/><path d="M4.4 9.3 2.7 7M8.4 7.3 7.6 4.7M15.6 7.3l.8-2.6M19.6 9.3 21.3 7"/><path class="f" d="M7 15.5c0-1.4.9-2.4 2-2.4s2 1 2 2.4-.9 4-2 4-2-2.6-2-4zM13 17.5c0-1.4.9-2.4 2-2.4s2 1 2 2.4-.9 4-2 4-2-2.6-2-4z"/>`,
  SPE: `<path d="M3 4.5h18v11H11l-5 4.5v-4.5H3z"/><path d="M7 8.5h10M7 11.5h7"/>`,
  SUR: `<path d="M12 2.5c1 3.2 4.5 4.6 4.5 8.6a4.5 4.5 0 0 1-9 0c0-2 1-3.2 2.2-4.2-.1 1.7.7 2.6 1.8 2.9-.3-2.6-.2-5 .5-7.3z"/><path d="M3 21.5 21 16M3 16l18 5.5"/>`,
  // ---- weapon kinds
  pistol: `<path d="M2.5 7.5h17l1.5 1.5v2H10.5l-1 1.5-.5 2.5c-.2 1.3-1.1 2-2.3 2H5.3l1.4-6.5H2.5z"/><path d="M10.5 11h-2.8"/>`,
  revolver: `<path d="M2 8.5h9.5"/><path d="M11.5 7h9.5v3h-6"/><rect x="11" y="8.5" width="5" height="4" rx="1.2"/><path d="M11 11.5H8.8L6.5 19H3l2.5-8.5"/><path d="M12.5 12.5v1.5c0 .8-.7 1.5-1.5 1.5H9.5"/><path d="M2 8.5v2"/>`,
  smg: `<path d="M1.5 9h4l1-1.5h11l1 1.5h4v2.5h-4v1.5H11l-.5 1.5h-2L8 12.5H5.5v-1H1.5z"/><path d="M12 13v7h2.5l.5-7"/><path d="M8.5 14.5l-1 4H5"/>`,
  rifle: `<path d="M1 10.5 6 9h16.5v2H15l-1 1.3h-2.5L10 14H7.5L1 13.8z"/><path d="M12.5 12.3l-.5 3.7h2l.8-3.7"/><path d="M15 9V7.5h3V9"/>`,
  sniper: `<path d="M1 11.5 6 10h16.5v1.8H14l-1.5 1.2H8L1 14.5z"/><rect x="9" y="6" width="7" height="2.5" rx="1"/><path d="M10.5 8.5V10M14.5 8.5V10M18 11.8l1.5 6M19 11.8l-1.5 6"/>`,
  shotgun: `<path d="M1 11.5 6 10h16.5v1H16v2H9l-1.2 1.5H6L1 14.5z"/><path d="M10 11h5.5v2"/><path d="M6 10V9h16.5"/>`,
  heavy: `<rect x="4.5" y="7.5" width="8" height="8" rx="1.5"/><path d="M12.5 8.5h10M12.5 10.8h10M12.5 13.1h10M12.5 15.4h10"/><path d="M8.5 15.5v5M6 20.5h5M4.5 10H1.5v3h3"/>`,
  bow: `<path d="M8 2.5c5.5 2.5 8.5 6 8.5 9.5S13.5 19 8 21.5"/><path d="M8 2.5v19"/><path d="M3 12h18M18.5 9.8 21 12l-2.5 2.2M3 12l-1.5-1.5M3 12l-1.5 1.5"/>`,
  laser: `<path d="M3 8.5h11l1.5 1.5H19v3h-3.5L14 14.5H9.5l-1 5H5l1.2-5H3z"/><path d="M20 11.5h3"/><path d="M5.5 11.5h6"/><circle class="f" cx="16.8" cy="11.5" r=".9"/>`,
  plasma: `<path d="M3 9.5h10l1 1h2.5v2.5H14l-1 1H9.5l-1 5H5l1.2-5H3z"/><circle cx="19.5" cy="11.8" r="2.6"/><circle class="f" cx="19.5" cy="11.8" r="1.1"/><path d="M5 12h5"/>`,
  zap: `<path class="f" d="M13.5 1.5 4.5 13.5h6l-2 9 10-12.5h-6.2z"/>`,
  grenade: `<path d="M8.5 7.5h6.5v3H8.5z"/><path d="M15 9h3.5a2.5 2.5 0 0 1 0 5"/><circle cx="17.8" cy="5" r="2"/><path d="M6.2 10.5h10.6c.8 1.5 1.2 3.1 1.2 4.7a6.3 6.3 0 0 1-13 0c0-1.6.4-3.2 1.2-4.7z"/><path d="M7 14h9.5M7.3 17.5h8.9"/>`,
  launcher: `<rect x="5" y="7.5" width="16" height="6" rx="1"/><path d="M21 8.5h2v4h-2M5 9.5H1.5v2H5"/><path d="M10 13.5l-.8 6H12l.8-6M15 13.5v3"/><circle cx="18" cy="10.5" r="1.6"/>`,
  missile: `<path d="M2 12 6 8h11.5l4.5 4-4.5 4H6z"/><path d="M6 8 3.5 4.5H7L10 8M6 16l-2.5 3.5H7L10 16"/><path d="M13.5 10.2v3.6"/>`,
  mine: `<ellipse cx="12" cy="15.5" rx="9.5" ry="4"/><path d="M2.5 15.5v-2c0-2.2 4.3-4 9.5-4s9.5 1.8 9.5 4v2"/><path d="M12 9.5v-3M10 6.5h4"/><circle class="f" cx="12" cy="13" r="1.2"/>`,
  blunt: `<rect x="12.5" y="2.5" width="9" height="6" rx="1" transform="rotate(45 17 5.5)"/><path d="M14.3 10.1 3.5 20.9 2.1 19.5l10.8-10.8"/>`,
  blade: `<path d="M21.5 2.5c-2.3 6.2-6.3 11.4-11.6 13.6L7.9 14.1C10.1 8.8 15.3 4.8 21.5 2.5z"/><path d="M6.2 11.7l6.1 6.1M8.4 16.3l-5 5M2 20l2 2"/>`,
  spear: `<path d="M3 21 15.5 8.5"/><path d="M15.5 8.5 14 7l7.5-5.5L16 9z"/><path d="M5.5 16.5l2 2M12.5 9l2.5 2.5"/>`,
  fist: `<path d="M6 10.5V6.8c0-1 .8-1.8 1.8-1.8s1.7.8 1.7 1.8v3.7M9.5 9.8V5.3c0-1 .8-1.8 1.8-1.8s1.7.8 1.7 1.8v4.5M13 9.8V6c0-1 .8-1.8 1.8-1.8s1.7.8 1.7 1.8v4.3M16.5 10.3V8.2c0-1 .8-1.7 1.7-1.7s1.8.7 1.8 1.7v6.3c0 4-2.8 6.9-6.8 6.9h-1.8c-3.1 0-5.4-1.8-6.5-4.6l-1.3-3.3c-.4-1 .1-2 1-2.3 1-.4 2 .1 2.4 1l.9 2.3"/>`,
  // ---- item kinds (for the inventory)
  ammo: `<path d="M5 9.5 6.5 4l1.5 5.5v11H5zM10.5 9.5 12 4l1.5 5.5v11h-3zM16 9.5 17.5 4 19 9.5v11h-3z"/><path d="M5 17.5h3M10.5 17.5h3M16 17.5h3"/>`,
  armor: `<path d="M8.5 3 12 5l3.5-2 5 2.5-2 5.5-1.5-.8V21h-10V10.2L5.5 11l-2-5.5z"/><path d="M8.5 3c.3 2 1.5 3.5 3.5 3.5S15.2 5 15.5 3M7 14.5h10M7 17.5h10"/>`,
  helmet: `<path d="M3 15.5c0-5.5 4-9.5 9-9.5s9 4 9 9.5z"/><path d="M1.5 15.5h21v2h-21z"/><path d="M12 6v9.5M7.5 8.5c-1 2-1.5 4.3-1.5 7M16.5 8.5c1 2 1.5 4.3 1.5 7"/>`,
  ring: `<circle cx="12" cy="14" r="6.5"/><circle cx="12" cy="14" r="4.3"/><path d="M9.5 7.6 12 3.5l2.5 4.1"/>`,
  stim: `<path d="M17.5 2.5l4 4M19.5 4.5l-3 3"/><path d="M16.5 7.5l-1.5-1.5-9.5 9.5 3 3L18 9z"/><path d="M5.5 15.5l-3 6 6-3M9 12l1.5 1.5M11.5 9.5 13 11"/>`,
  bottle: `<path d="M10 2.5h4v3.5l1.5 2.5V21a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V8.5L10 6z"/><path d="M8.5 12.5h7v5h-7z"/>`,
  food: `<path d="M5 7h14l-1 3.5H6z"/><path d="M6 10.5h12v9.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M9 14h6M9 17h6M7 4.5h10"/>`,
  book: `<path d="M3 4.5c3-.8 6-.3 9 1.5 3-1.8 6-2.3 9-1.5v14c-3-.8-6-.3-9 1.5-3-1.8-6-2.3-9-1.5z"/><path d="M12 6v14"/>`,
  smoke: `<rect x="2.5" y="14" width="16" height="4" rx="1"/><path d="M15 14v4"/><path d="M20.5 14v4M20 11c0-1.5-1.5-2-1.5-3.5S20 5 20 3.5M22.5 11c0-1.2-1-1.7-1-2.8"/>`,
  skull: `<path d="M12 2.5c-4.8 0-8 3.3-8 7.6 0 2.6 1.2 4.4 2.9 5.4V19h10.2v-3.5c1.7-1 2.9-2.8 2.9-5.4 0-4.3-3.2-7.6-8-7.6z"/><circle class="f" cx="8.7" cy="10.5" r="2"/><circle class="f" cx="15.3" cy="10.5" r="2"/><path d="M10 19v2.5M14 19v2.5M12 13.5l-1 2h2z"/>`,
  tool: `<path d="M14.7 6.3a4.5 4.5 0 0 0 5.6 5.6L21 11l-1.6-1.6-2 .2-.5-2.1L18.6 5 17 3.4l-.7.7A4.5 4.5 0 0 0 14.7 6.3z"/><path d="M15 9.5 4.5 20a2 2 0 0 1-2.9-2.8L12 6.7"/>`,
  nut: `<path d="M12 2.5l8.3 4.8v9.4L12 21.5l-8.3-4.8V7.3z"/><circle cx="12" cy="12" r="3.5"/>`,
  mod: `<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>`,
  shield: `<path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10.5-4.6-1.9-8-5.5-8-10.5v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>`,
  item: `<rect x="3.5" y="7" width="17" height="13" rx="1.5"/><path d="M8.5 7V4.5h7V7M3.5 12.5h17M10.5 11v3h3v-3"/>`,
};
// Which drawing a weapon gets, by its table and type.
function weaponIcon(o) {
  const t = (o && o.type) || "";
  if (!o) return "item";
  if (o.tab === "MW") return t === "Hand" ? "fist" : t[0] === "B" ? "blunt" : t[0] === "S" ? "blade" : "spear";
  if (o.tab === "EX") return t === "Grenade" ? "grenade" : t === "Launcher" ? "launcher" : t === "Missile" ? "missile" : "mine";
  if (o.tab === "EW") return /Laser/.test(t) ? "laser" : /Plasma/.test(t) ? "plasma" : "zap";
  if (/Shotgun/.test(t)) return "shotgun";
  if (/bow/i.test(t)) return "bow";
  if (/Revolver/.test(t)) return "revolver";
  if (/Pistol|Special/.test(t)) return "pistol";
  if (/SMG|PDW/.test(t)) return "smg";
  if (/Sniper|DMR|Anti-Mat/.test(t)) return "sniper";
  if (/LMG|Heavy/.test(t)) return "heavy";
  return "rifle";
}
// 12 Nov: hazard and trap icons (h_<kind>), drawn on the map and in the review sheet, and disposition icons (d_<key>) for enemy cards.
Object.assign(VICON, {
  h_fire: `<path d="M12 22c-4.2 0-7-2.8-7-6.6 0-3.4 2.3-5.6 3.6-8 .5 1.8 1.4 3 2.6 3.6C11 7.4 12.6 4.4 15.2 2c-.3 3.6 1.6 5.6 2.9 7.6 1 1.6 1.9 3.4 1.9 5.8 0 3.8-3.2 6.6-8 6.6z"/><path d="M12 22c-1.8 0-3-1.2-3-2.9 0-1.8 1.4-2.8 2.4-4.5.9 1.6 3.6 2.6 3.6 4.6 0 1.6-1.2 2.8-3 2.8z"/>`,
  h_rads: `<circle class="f" cx="12" cy="12" r="1.9"/><path class="f" d="M12 9.2 8.4 3a10 10 0 0 1 7.2 0zM14.4 13.4l7.1 0a10 10 0 0 1-3.6 6.2zM9.6 13.4 6.1 19.6a10 10 0 0 1-3.6-6.2z"/>`,
  h_gas: `<path d="M6.5 18.5h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.3A4.7 4.7 0 0 0 6.5 18.5z"/><path d="M9 14.5c1 .8 2 .8 3 0s2-.8 3 0"/><path d="M4 22h4M11 22h6"/>`,
  h_acid: `<path d="M8 3c-2.4 3.2-3.6 5.4-3.6 7a3.6 3.6 0 0 0 7.2 0C11.6 8.4 10.4 6.2 8 3z"/><path d="M16.5 8.5c-1.8 2.4-2.7 4-2.7 5.2a2.7 2.7 0 0 0 5.4 0c0-1.2-.9-2.8-2.7-5.2z"/><path d="M3 21c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0"/>`,
  h_wires: `<path d="M2 6c3 0 4 3 7 3"/><path d="M22 6c-3 0-4 3-7 3"/><path class="f" d="M13.4 7.5 8.6 14h3l-1.6 6.5 5.4-7.6h-3.1z"/>`,
  h_mines: `<circle cx="12" cy="13" r="5"/><path d="M12 8V4.5M12 4.5h-2M12 4.5h2M7.2 9.5 5 7.3M16.8 9.5 19 7.3M7 13H3.5M17 13h3.5"/><circle class="f" cx="12" cy="13" r="1.6"/>`,
  h_spikes: `<path d="M2 20h20"/><path d="M3 20 5.5 9 8 20M8 20l2.5-13L13 20M13 20l2.5-10L18 20M18 20l2-7 1.5 7"/>`,
  h_water: `<path d="M2 8c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0"/><path d="M2 13c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0"/><path d="M2 18c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0"/>`,
  h_shallow: `<path d="M2 12c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0"/><path d="M5 17h3M11 17h3M17 17h2"/>`,
  h_bearTrap: `<path d="M3 13a9 9 0 0 1 18 0"/><path d="M3 13a9 6 0 0 0 18 0"/><path d="M6 9.2 7.6 12l1.6-3.6L11 12l1-3.6L13.6 12l1.4-3.6L16.4 12 18 9.2"/><path d="M12 19v3M9 22h6"/>`,
  h_tripwire: `<path d="M2 15h13"/><path d="M2 12v6M22 12v6"/><rect x="15" y="10" width="5" height="9" rx="1.2"/><path d="M17.5 10V7.5l2-1.5"/><path d="M15 15l-2-1"/>`,
  h_landmine: `<ellipse cx="12" cy="15" rx="8" ry="3.2"/><path d="M4 15v1.5c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V15"/><path d="M12 11.8V8M9.5 8h5M3 6l2 2M21 6l-2 2M12 3v1.5"/>`,
  h_dartPlate: `<rect x="4" y="13" width="16" height="7" rx="1"/><path d="M7 13V6M12 13V4M17 13V6"/><path class="f" d="M5.6 6.4 7 3.6l1.4 2.8zM10.6 4.4 12 1.6l1.4 2.8zM15.6 6.4 17 3.6l1.4 2.8z"/>`,
  h_snare: `<path d="M12 2v6"/><ellipse cx="12" cy="15" rx="7" ry="5"/><path d="M12 8c-1.4 2-1.4 3 0 2.6 1.4.4 1.4-.6 0-2.6"/><path d="M5 15h-2.5M19 15h2.5"/>`,
  // dispositions
  d_craven: `<path d="M6 22V3"/><path d="M6 4c3-1.4 5 1.4 8 0s4-.6 5 0v8c-1-.6-2-1.4-5 0s-5-1.4-8 0"/>`,
  d_reckless: `<path d="M3 5l7 7-7 7M11 5l7 7-7 7"/><path class="f" d="M19 9.5h2.5v5H19z"/>`,
  d_marksman: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6"/>`,
  d_tactician: `<path d="M2 21h20"/><path d="M3 21v-7h7v7M3 17.5h7M6.5 14v3.5M6.5 17.5v3.5"/><circle cx="16" cy="7" r="2"/><path d="M16 9v6l-2.5 6M16 15l2.5 6M13 11.5l3-1.5 3 2"/>`,
  d_flanker: `<rect x="9.5" y="8" width="5" height="8"/><path d="M4 18c-2-6 2-13 10-13.5"/><path d="M11.5 2.5 14 4.5l-2.5 2.2"/><circle class="f" cx="19" cy="16" r="2"/>`,
  d_bully: `<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/><path d="M12 9v7M9 13l3 3 3-3"/>`,
  d_vulture: `<path d="M12 3c-2.8 4-4.4 6.8-4.4 9a4.4 4.4 0 0 0 8.8 0C16.4 9.8 14.8 7 12 3z"/><circle cx="12" cy="12.5" r="1.8"/><path d="M12 17v4M8 20h8"/>`,
  d_zealot: `<path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z"/><circle class="f" cx="12" cy="12" r="1.8"/>`,
  d_mercenary: `<path d="M12 2.5l1.6 1.6 2.2-.6.6 2.2 2.2.6-.6 2.2 1.6 1.6-1.6 1.6.6 2.2-2.2.6-.6 2.2-2.2-.6L12 17.5l-1.6-1.6-2.2.6-.6-2.2-2.2-.6.6-2.2L4.4 10l1.6-1.6-.6-2.2 2.2-.6.6-2.2 2.2.6z"/><path d="M13.6 7.6c-.6-.6-3.4-.8-3.4.8 0 1.8 3.6 1 3.6 3 0 1.4-2.8 1.4-3.8.6M12 6v1.4M12 12.6V14"/><path d="M8 20l4 2 4-2"/>`,
  d_hothead: `<path d="M3 9c3 0 5-2 5-5M21 9c-3 0-5-2-5-5M3 15c3 0 5 2 5 5M21 15c-3 0-5 2-5 5"/><path class="f" d="M12.8 6 9 13h2.6l-1.2 5 4.4-7h-2.6z"/>`,
  d_bodyguard: `<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><circle cx="12" cy="10" r="2.2"/><path d="M8 17c.8-2.4 2.2-3.6 4-3.6s3.2 1.2 4 3.6"/>`,
  d_feral: `<path d="M5 3c1 6 3 11 8 16M10 2.5c1 5.5 3 10 7.5 14M15.5 3c.6 4 2 7.5 5 10.5"/>`,
  d_packHunter: `<ellipse cx="12" cy="16" rx="4.2" ry="3.6"/><circle cx="5.5" cy="11" r="1.9"/><circle cx="9.5" cy="6.5" r="1.9"/><circle cx="14.5" cy="6.5" r="1.9"/><circle cx="18.5" cy="11" r="1.9"/>`,
  d_skittish: `<path d="M14 3v11"/><circle class="f" cx="14" cy="19" r="1.6"/><path d="M3 7h6M2 12h6M4 17h5"/>`,
  d_territorial: `<circle cx="12" cy="12" r="9.5" stroke-dasharray="2.5 2.5"/><path d="M10 17V6"/><path d="M10 6.5l6 2-6 2.5"/><path d="M8 17h5"/>`,
  d_protocol: `<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 6V2.5M12 6V2.5M15 6V2.5M9 18v3.5M12 18v3.5M15 18v3.5M6 9H2.5M6 12H2.5M6 15H2.5M18 9h3.5M18 12h3.5M18 15h3.5"/>`,
  d_sentry: `<path d="M5 9h11l3 2.5L16 14H5z"/><circle class="f" cx="10" cy="11.5" r="1.4"/><path d="M10 14v3M10 17l-5 5M10 17l5 5M10 17v5"/><path d="M19.5 11.5H23"/>`,
});
const vicon = (name, cls = "") => `<svg class="vic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${VICON[name] || VICON.item}</svg>`;
