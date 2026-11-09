# Puts a "current rules" section, generated from the live data, at the front of the game bible.
# Run from app/: node dump_wiki.js, then python make_wiki.py (needs reportlab and pypdf), then python build.py.
# wiki_base.pdf is the original bible, so running this again replaces the section instead of adding another.
import json, os, shutil
import re
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from xml.sax.saxutils import escape as esc

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
PDF = os.path.join(ROOT, "Fallout TTRPG Game Bible.pdf"); BASE = os.path.join(HERE, "wiki_base.pdf")
if not os.path.exists(BASE): shutil.copy(PDF, BASE)
D = json.load(open(os.path.join(HERE, "tests", "wiki.json"), encoding="utf8"))
R = D["rules"]

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1x", parent=ss["Heading1"], fontName="Courier-Bold", fontSize=17, spaceBefore=6, spaceAfter=6, textColor=colors.HexColor("#0b5a2a"))
H2 = ParagraphStyle("H2x", parent=ss["Heading2"], fontName="Courier-Bold", fontSize=12, spaceBefore=9, spaceAfter=3, textColor=colors.HexColor("#0b5a2a"))
P = ParagraphStyle("Px", parent=ss["BodyText"], fontName="Courier", fontSize=9, leading=12, spaceAfter=4)
S = ParagraphStyle("Sx", parent=P, fontSize=7.5, leading=9.5, spaceAfter=0)
B = ParagraphStyle("Bx", parent=S, fontName="Courier-Bold")
BUL = ParagraphStyle("Bul", parent=P, leftIndent=11, bulletIndent=1, spaceAfter=2)
story = []; marks = []

class Doc(BaseDocTemplate):
    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and f.style.name == "H1x": marks.append((f.getPlainText(), self.page - 1))

def h1(t): story.append(Paragraph(esc(t), H1))
def h2(t): story.append(Paragraph(esc(t), H2))
def p(t): story.append(Paragraph(t, P))
def bl(items):
    for t in items: story.append(Paragraph(t, BUL, bulletText="•"))
def tbl(head, rows, widths):
    data = [[Paragraph(esc(str(x)), B) for x in head]] + [[Paragraph(esc(str(x)), S) for x in r] for r in rows]
    t = Table(data, colWidths=[w * inch for w in widths], repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d9efe0")), ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#9ab8a4")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2), ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
    story.append(t); story.append(Spacer(1, 6))
def pct(x): return f"{round(x * 100):+d}%" if x else "none"
def fxText(fx):
    lab = D["vars"]
    out = []
    for k, v in (fx or {}).items():
        out.append(f"{k} {v:+g}" if isinstance(v, (int, float)) else f"{k} {v}")
    return ", ".join(out)
def whenText(w):
    if not w: return "always"
    parts = []
    for k, v in w.items():
        parts.append(k if v is True else f"{k}: {', '.join(v) if isinstance(v, list) else v}")
    return "; ".join(parts)

h1("Current Rules: Read This First")
p(f"This section is generated from the app's live data, built {esc(D['builtAt'])}. <b>Where it disagrees with any later chapter, this section wins.</b> Later chapters are the original bible: they still explain the workbook and its unfinished items, but several flags in them have since been decided. Page numbers in the original contents refer to the original chapters, and this section is numbered separately as U-1, U-2 and so on.")
h2("What changed since the original chapters")
tbl(["Topic", "Now"], [
 ["Jams", "A jam costs AP to clear, set by weapon type. Listed in Settings."],
 ["Overskill", f"Skill counts for at most {R['overskillCap']} in hit chance."],
 ["Accuracy", "Weapon base plus skill. The Perception and Strength penalties are set to 0 for now and can be restored in Settings."],
 ["Range", "Real distance on a map. Bands reach " + ", ".join(f"R{i + 1} {m}m" for i, m in enumerate(R["bandMeters"])) + "."],
 ["Movement", "AP by distance walked: " + ", ".join(f"{m}m {a} AP" for m, a in zip(R["bandMeters"], R["moveAP"])) + ". On your turn a drag is a preview with cost shown, then Confirm or Cancel."],
 ["Cover", "A flag on every shot, from what the aiming line crosses. The old Take Cover action and the Cover status are gone."],
 ["Ammo", "Only what's in inventory, for enemies too."],
 ["Healing items", "They never stand up a downed character, except the Surgeon's Kit, whose text says it can. Otherwise use Revive."],
 ["Placeholders", "Empty-slot markers like (NO HEADGEAR) aren't items and don't drop."],
 ["Starting kit", "Comes from your archetype, not your tag skills."],
], [1.2, 6.1])

h1("Starting a Campaign")
p(f"New campaign resets everything to the workbook. Then each character is built in five steps: name and archetype; SPECIAL, starting at {R['startSpecial']} each with at most {R['startPool']} points in total; traits, one rolled for you with a single reroll, then two you pick; three tag skills, which gain 2 per point spent; review.")
h2("Archetypes")
def kit(a):
    bits = [a["w"]]
    if a.get("ammo"): bits.append(f"{a['ammo'][1]} x {a['ammo'][0]}")
    bits += a.get("wear", []) + [f"{q} x {n}" if q > 1 else n for n, q in a.get("items", [])]
    if a.get("caps"): bits.append(f"{a['caps']} caps")
    return ", ".join(bits)
tbl(["Archetype", "Who they are", "Kit"], [[a["n"], a["d"], kit(a)] for a in R["archetypes"]], [1.3, 2.6, 3.4])

h1("Maps, Rooms and Cover")
p(f"Every map uses a {R['gridM']} meter grid. A location sets the size, and a setting sets what fills it.")
h2("Locations")
tbl(["Location", "Width x height"], [[m["n"], "you choose" if k == "custom" else f"{m['w']} x {m['h']} m"] for k, m in R["maps"].items()], [3, 2])
h2("Cover tiers")
p("The line from shooter to target picks up the worst tier it crosses. Something the shooter stands inside doesn't count. Damage changes apply after Damage Threshold.")
tbl(["Tier", "Hit chance", "Damage"], [[c["n"], pct(c["hit"]), pct(c["dam"])] for c in R["cover"].values()], [2.4, 1.2, 1.2])
h2("Room settings")
p("Items placed = map area x density x a random 0.8 to 1.2, kept between the minimum and maximum. Higher weights come up more often. City streets lays out concrete blocks first on maps at least 30 meters across, and those stop walking.")
tbl(["Setting", "Density per m2", "Min-max", "Items (weight)"], [[t["n"], t["density"], f"{t['min']}-{t['max']}", ", ".join(f"{R['mapItems'][k]['n']} ({v})" for k, v in t["items"].items())] for t in R["roomThemes"].values()], [1.1, 0.8, 0.6, 4.8])
h2("Furniture and scenery")
tbl(["Item", "Cover", "Size (m)"], [[i["n"], R["cover"][i["cover"]]["n"] + (", blocks walking" if i.get("block") else ""), f"{i['w']} x {i['h']}"] for i in R["mapItems"].values()], [2.8, 2.6, 1.2])

h1("Taking a Turn")
bl(["The action column opens with who is acting, their AP and End turn (N).", "<b>Loadout:</b> your weapons, with AP cost, magazine and ammo carried.", "<b>Target:</b> click anyone on the map or in a list. Range and cover fill in from the map. Click a body part. The body is red for the other side and green for your own.", "<b>The aim line</b> is colored by the selected weapon's accuracy: red at its worst band, green at its best.", "<b>Roll:</b> type the two-dice roll and press Enter. The math line is there to read aloud.", "<b>Actions</b> and <b>Consumables</b> are below. Everything that costs AP is refused if you can't afford it. Tick Free under OVR, or hold Shift when dragging, to overrule that."])
h2("Injuries from crits")
tbl(["Part hit", "Status", "Tier"], [["Head", R["critStatus"]["Head"], f"{R['critTier']['Crit']} on a crit, {R['critTier']['Super']} on a super crit"], ["Body", R["critStatus"]["Body"] or "none", ""], ["Arm or leg", R["critStatus"]["Leg"], f"{R['critTier']['Crit']} on a crit, {R['critTier']['Super']} on a super crit"]], [1.5, 2.6, 3.2])

h1("Effects as Variables")
p("Items, statuses, perks, traits and armor store their effects as these names, in their fx and use columns.")
tbl(["Variable", "What it changes"], [[k, v] for k, v in D["vars"].items()], [1.4, 5.9])
h2("Status effects")
rows = []
for s in D["statuses"]:
    tiers = [fxText({k: v for k, v in f.items() if k != "turns"}) for f in s.get("fx", [])]
    tiers = [t for t in tiers if t]
    if tiers: rows.append([s["n"], s.get("tone", ""), " | ".join(dict.fromkeys(tiers))])
tbl(["Status", "Tone", "Variables by tier"], rows, [1.5, 0.7, 5.1])
h2("What drugs, drinks and food apply")
p("If the workbook gives an item numbers, it keeps those exact numbers under this status. If its text was blank, it uses the status tier's numbers. Rest ends them, and a hangover or comedown can follow.")
rows = []
for i in D["items"]:
    u = i.get("use") or {}
    if u.get("applies"): rows.append([i["n"], ", ".join(f"{a['n']} {a['tier']}" for a in u["applies"]), fxText(u["applies"][0].get("fx")) or "status numbers", (u.get("after") or {}).get("n", "")])
tbl(["Item", "Status", "Numbers", "Afterward"], rows, [2.3, 1.7, 2.3, 1])
h2("Items that lower or remove statuses")
rows = []
for i in D["items"]:
    u = i.get("use") or {}
    if u.get("reduces") or u.get("removes"): rows.append([i["n"], ", ".join(f"{k} -{v}" for k, v in (u.get("reduces") or {}).items()), ", ".join(u.get("removes") or [])])
tbl(["Item", "Lowers", "Removes"], rows, [2.8, 3.1, 1.4])

h1("Rules with Conditions")
p("Conditions turn a rule on for the shot in question: the shooter's weapon, the target's type, the range, the round, sneaking, and so on. Target types come from the enemy's name: " + ", ".join(R["enemyTypes"].keys()) + ", human.")
h2("Level perks")
rows = []
for n, lst in R["perkRules"].items():
    for x in lst: rows.append([n, fxText(x["fx"]), whenText(x.get("when"))])
tbl(["Perk", "Variables", "When"], rows, [1.9, 2.5, 2.9])
h2("Traits")
rows = []
for n, lst in R["traitRules"].items():
    for x in lst: rows.append([n, fxText(x["fx"]), whenText(x.get("when"))])
tbl(["Trait", "Variables", "When"], rows, [1.9, 2.5, 2.9])
h2("Skill perks, accessories and mods with conditions")
tbl(["Name", "Type", "Variables", "When"], [[r["n"], r.get("cat", ""), fxText(r.get("mods")), whenText(r["when"])] for r in D["sc"] if r.get("when")], [1.6, 0.9, 2.1, 2.7])

h1("Enemies by Faction")
p("Every enemy has a faction, and creatures and anyone non-specific are Unaligned. People's HP, AP and DT come from their SPECIAL and tier. Creatures have fixed numbers. Skills use the same short names as the character sheets.")
_g = {}
for e in D["enemies"]: _g.setdefault(e.get("faction", "Unaligned"), []).append(e)
for f in sorted(_g, key=lambda x: (x == "Unaligned", x)):
    h2(f"{f} ({len(_g[f])})")
    tbl(["Name", "Tier", "XP", "Caps", "Weapons"], [[e["n"], e.get("tier", ""), e.get("xp", ""), e.get("caps", "") or "-", ", ".join(dict.fromkeys(x for x in (e.get("w1"), e.get("w2")) if x)) or "generated by tier"] for e in sorted(_g[f], key=lambda x: (x.get("tier", 0), x["n"]))], [2.6, 0.5, 0.5, 0.8, 2.9])

h1("Vendors and Packs")
p("A vendor has a tier and a barter level (" + ", ".join(str(x) for x in R["vendorBarter"]) + "). Stock comes from that tier and the one below, never unique weapons. Buy price = value x the higher of 1 and vendor barter / your Barter. Sell price = value x the lower of 1 and your Barter / vendor barter. A vendor at 100 matches the sheet's formula. Prices marked ~ are placeholders, because the workbook has no value for ammo and most consumables.")
p("<b>Save pack</b> makes a .zip with campaign.json, rules.json and every table as tables/*.csv. Open it, edit it, zip it back and use <b>Load pack</b>. Keep it a .zip: WinRAR can save as zip, but browsers can't open .rar files. Change a written effect and the app reads it again on load, or change the fx and use columns to set the variables yourself.")

h1("Left for the DM")
p("These stay as reminders because they need a judgment call, a story decision, or something the game doesn't track, such as NPC reactions, crafting, romance, or what resisting a status means.")
groups = {}
for t, n, w in D["skipped"]: groups.setdefault(t, []).append((n, w))
names = {"Item": "Consumables", "Status": "Statuses", "Armor": "Armor", "Level perk": "Level perks", "Skill Perk": "Skill perks", "Trait": "Traits", "Trait Evolution": "Trait evolutions", "Accessory": "Accessories", "Weapon Mod": "Weapon mods", "Weapon mod": "Weapon mods, text only"}
for k, rows in groups.items():
    h2(f"{names.get(k, k)} ({len(rows)})")
    tbl(["Name", "Note"], [[n, w] for n, w in dict.fromkeys(rows)], [2.2, 5.1])

front = os.path.join(HERE, "wiki_front.tmp.pdf")
def foot(c, d):
    c.saveState(); c.setFont("Courier", 8); c.setFillColor(colors.grey); c.drawString(0.6 * inch, 0.4 * inch, "Fallout TTRPG Game Bible: Current Rules"); c.drawRightString(letter[0] - 0.6 * inch, 0.4 * inch, f"U-{d.page}"); c.restoreState()
doc = Doc(front, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.65 * inch, title="Fallout TTRPG Game Bible")
doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f", leftPadding=0, rightPadding=0)], onPage=foot)])
doc.build(story)

# ---- Fallout terminal look: black pages, green text. Every color in the PDF is swapped as it's drawn, so the layout doesn't change.
BG = (0.008, 0.02, 0.008)
def terminal(r, g, b):
    L = (r + g + b) / 3; dark = 1 - L; chroma = max(r, g, b) - min(r, g, b)
    if chroma > 0.25:  # warnings and accents keep a color of their own
        warm = r >= b
        base = (1, 0.82, 0.25) if warm else (0.45, 1, 0.8)
        k = 0.6 + 0.4 * dark
    else:
        base = (0.3, 1, 0.49); k = dark
    # the palest backgrounds become black-green, text becomes bright
    return tuple(max(bgc, c * k) for c, bgc in zip(base, BG))
NUM = r"(-?[\d.]+)"
TOKEN = re.compile(r"\((?:\\.|[^\\()])*\)|" + NUM + r" " + NUM + r" " + NUM + r" (rg|RG)\b|" + NUM + r" (g|G)\b", re.S)
def recolor(page, writer):
    def swap(m):
        if m.group(4):
            c = terminal(float(m.group(1)), float(m.group(2)), float(m.group(3))); return "%.3f %.3f %.3f %s" % (*c, m.group(4))
        if m.group(6):
            v = float(m.group(5)); c = terminal(v, v, v); return "%.3f %.3f %.3f %s" % (*c, "rg" if m.group(6) == "g" else "RG")
        return m.group(0)
    data = page.get_contents().get_data().decode("latin1")
    W_, H_ = float(page.mediabox.width), float(page.mediabox.height)
    head = "q %.3f %.3f %.3f rg 0 0 %.2f %.2f re f Q 0.3 1 0.49 rg 0.3 1 0.49 RG\n" % (*BG, W_, H_)
    st = DecodedStreamObject(); st.set_data((head + TOKEN.sub(swap, data)).encode("latin1"))
    page[NameObject("/Contents")] = writer._add_object(st.flate_encode())
a = PdfReader(front); b = PdfReader(BASE); w = PdfWriter()
for pg in a.pages: w.add_page(pg)
for pg in b.pages: w.add_page(pg)
for pg in w.pages: recolor(pg, w)
parent = w.add_outline_item("Current Rules (read first)", 0)
for t, pg in marks: w.add_outline_item(t, pg, parent=parent)
w.add_outline_item("Original bible", len(a.pages))
w.add_metadata({"/Title": "Fallout TTRPG Game Bible"})
with open(PDF, "wb") as f: w.write(f)
os.remove(front)
print(f"{len(a.pages)} current-rules pages + {len(b.pages)} original = {len(a.pages) + len(b.pages)}")
