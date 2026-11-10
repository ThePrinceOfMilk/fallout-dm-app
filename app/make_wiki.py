# Updates the game bible in place: each change goes into the chapter it changes, on lettered pages after it (15a, 15b),
# with the date and what it replaced. Updated chapters get a header note and a mark in the contents, and decided flags read RESOLVED.
# Run from app/: node dump_wiki.js, then python make_wiki.py (needs reportlab, pypdf and pymupdf), then python build.py.
# wiki_base.pdf is the original bible, so running this again rebuilds every update instead of stacking them.
# To record a new change: add an upd(...) line to the chapter it belongs to, with its date. Flags it settles go in flags=.
import json, os, re, shutil, tempfile
import fitz
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from xml.sax.saxutils import escape as esc

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
PDF = os.path.join(ROOT, "Fallout TTRPG Game Bible.pdf"); BASE = os.path.join(HERE, "wiki_base.pdf")
if not os.path.exists(BASE): shutil.copy(PDF, BASE)
D = json.load(open(os.path.join(HERE, "tests", "wiki.json"), encoding="utf8"))
R = D["rules"]
D8, D9, D10 = "8 Nov 2026", "9 Nov 2026", "10 Nov 2026"
LATEST = "10 November 2026"

# ---- the bible's own look: Segoe UI when Windows has it, else Helvetica
FONTS = "C:/Windows/Fonts"
REG, BOLD, REG_FILE, BOLD_FILE = "Helvetica", "Helvetica-Bold", None, None
if os.path.exists(f"{FONTS}/segoeui.ttf") and os.path.exists(f"{FONTS}/segoeuib.ttf"):
    pdfmetrics.registerFont(TTFont("SegoeUI", f"{FONTS}/segoeui.ttf")); pdfmetrics.registerFont(TTFont("SegoeUI-Bold", f"{FONTS}/segoeuib.ttf"))
    pdfmetrics.registerFontFamily("SegoeUI", normal="SegoeUI", bold="SegoeUI-Bold", italic="SegoeUI", boldItalic="SegoeUI-Bold")
    REG, BOLD, REG_FILE, BOLD_FILE = "SegoeUI", "SegoeUI-Bold", f"{FONTS}/segoeui.ttf", f"{FONTS}/segoeuib.ttf"
INK, GREY, AMBER, GREEN, HEAD, ZEBRA = "#20262b", "#5d6871", "#8a4b12", "#1f7a4a", "#2e3a42", "#f5f6f7"
H1 = ParagraphStyle("H1", fontName=BOLD, fontSize=18, leading=22, spaceAfter=4, textColor=INK)
H2 = ParagraphStyle("H2", fontName=BOLD, fontSize=12.5, leading=16, spaceBefore=10, spaceAfter=1, textColor=AMBER)
WHEN = ParagraphStyle("WHEN", fontName=REG, fontSize=8.2, leading=11, spaceAfter=4, textColor=GREY)
P = ParagraphStyle("P", fontName=REG, fontSize=9.6, leading=13.5, spaceAfter=5, textColor=INK)
BUL = ParagraphStyle("BUL", parent=P, leftIndent=12, bulletIndent=2, spaceAfter=3)
TS = ParagraphStyle("TS", fontName=REG, fontSize=8, leading=10.2, textColor=INK)
TH = ParagraphStyle("TH", parent=TS, fontName=BOLD, textColor=colors.white)

def p(t): return Paragraph(t, P)
def bl(*items): return [Paragraph(t, BUL, bulletText="•") for t in items]
def tbl(head, rows, widths):
    data = [[Paragraph(esc(str(x)), TH) for x in head]] + [[Paragraph(esc(str(x)), TS) for x in r] for r in rows]
    t = Table(data, colWidths=[w * 72 for w in widths], repeatRows=1, hAlign="LEFT")
    st = [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(HEAD)), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3), ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4)]
    st += [("BACKGROUND", (0, i), (-1, i), colors.HexColor(ZEBRA)) for i in range(2, len(data), 2)]
    t.setStyle(TableStyle(st)); return [t, Spacer(1, 5)]
def pct(x): return f"{round(x * 100):+d}%" if x else "none"
def fxText(fx): return ", ".join(f"{k} {v:+g}" if isinstance(v, (int, float)) else f"{k} {v}" for k, v in (fx or {}).items())
def whenText(w):
    if not w: return "always"
    return "; ".join(k if v is True else f"{k}: {', '.join(v) if isinstance(v, list) else v}" for k, v in w.items())

U = {}  # chapter number -> [(date, title, how, flowables, flags)]
def upd(ch, date, title, how, *body, flags=()):
    flat = []
    for b in body: flat += b if isinstance(b, list) else [b]
    U.setdefault(ch, []).append((date, title, how, flat, list(flags)))

# ---------------------------------------------------------------- the changes, chapter by chapter
upd(2, D9, "How changes are recorded", "Was: a separate Current Rules section at the front of the book. Now: each change sits in the chapter it changes.", bl(
    "A chapter that changed has lettered pages right after it, such as 15a and 15b. Its first page says UPDATED in the header, and the contents page marks it.",
    "Each change gives the date it was made and what it replaced. Where a lettered page and the original chapter disagree, the lettered page is current.",
    "A flag that has been decided reads RESOLVED, in its chapter and in the Open Items Register, with the page that decides it.",
    "Tables on lettered pages are generated from the app's own data, so they match what the app does."))

upd(6, D9, "Player and enemy HP", "Was: players gained 1 HP a level and enemy humans 6 a tier. Now:", bl(
    f"Players: HP = (15 + END x 2 + (level - 1) x {R['pcHpPerLevel']}) x {R['pcHpMul']}, rounded down. A level 1 character with END 5 has {int((15 + 10) * R['pcHpMul'])} HP.",
    f"Enemy humans: HP = 15 + END x 2 + (tier - 1) x {R['npcHpPerTier']}. Creatures keep their listed HP."))
_fl = R["armorFloors"]
upd(10, D9, "Armor sets the damage floor", "Was: a hit below DT always kept at least 20% of its damage. Now: the target's body armor sets that floor.",
    tbl(["Wearing", "Damage floor"], [["Clothing or nothing", f"{round(_fl['clothing'] * 100)}%"], ["Light armor", f"{round(_fl['light'] * 100)}%"], ["Medium armor", f"{round(_fl['medium'] * 100)}%"], ["Heavy armor", f"{round(_fl['heavy'] * 100)}%"], ["Power armor", f"{round(_fl['power'] * 100)}%"], ["Creatures", f"{round(R['damageFloor'] * 100)}%"]], [2.4, 1.2]),
    p("Pen at or above DT still does full damage. Below it, damage is cut to Pen / DT, but never below the floor. Heavier armor shrugs off more of what it stops."))
upd(7, D8, "Difficulty scale", "Was: no difficulty scale was written down (UF-01). Now: six named difficulties.",
    tbl(["Difficulty", "Target"], [[k, v] for k, v in R["difficulty"].items()], [2, 1]),
    p(f"Roll a d20 and meet or beat the number needed: {R['checkBase']} - (skill - difficulty) / {R['checkStep']}, rounded toward zero. A SPECIAL check counts the stat x {R['specialAsSkill']} as its skill."), flags=["UF-01"])
upd(7, D9, "Fail and pass ranges", "Was: the number needed could fall below 1 or go past 20 (US-04). Now: it stays between 2 and 20, so a natural 1 always fails and a natural 20 always passes.",
    p("The check panel shows the result as ranges on the d20, for example <b>fail 1-12 / pass 13-20</b>. A target nobody can reach reads <b>fail 1-19 / pass 20</b>."),
    p("Every box that takes a dice roll has a small dice button beside it that rolls for you: a d20 for checks, initiative, stealth, saves and loot, a d100 for addiction."), flags=["US-04"])

upd(8, D8, "Accuracy, overskill and the cap", "Was: Perception and Strength penalties in the live formula, an overskill term that misbehaves (BG-02), and no cap (BG-03). Now:", bl(
    f"Accuracy is the weapon's base plus the skill. The Perception and Strength penalties are set to 0 for now. The sheet's values (0.05, 0.0125 and 0.05) can be put back in Settings.",
    f"Skill counts for at most {R['overskillCap']} in hit chance. Skill above that adds nothing.",
    f"Hit chance never goes past {round(R['maxHit'] * 100)}%."), flags=["BG-02", "BG-03"])
upd(8, D9, "Gun bonus, skill and melee base", "Was: hit = range value + (skill - requirement) / 200 for everything, with melee at 45%. Now:", bl(
    f"Every gun (Small Guns, Big Guns, Energy) gets +{round(R['gunHitAdd'] * 100)}% to hit at every range. Thrown weapons and melee don't.",
    f"Skill above or below a weapon's requirement counts {R['skillHitMul']}x: (skill - requirement) / 2 x {R['skillHitMul']}, rounded down, in percent.",
    f"Light melee and fists start at {round(R['meleeBase'] * 100)}%. Heavy two-handed melee (a base cost of {R['heavyMeleeAP']}+ AP, not fists) starts at {round(R['meleeHeavyBase'] * 100)}%. Heavy weapons hit harder and pierce more, so with enough skill they pass the light ones."))
upd(8, D8, "Cover", "Was: a Take Cover action and a Cover status. Now: cover is read from the map for every shot.",
    p("The line from shooter to target takes the worst tier it crosses. Something the shooter stands inside doesn't count. Damage changes apply after Damage Threshold."),
    tbl(["Tier", "Hit chance", "Damage"], [[c["n"], pct(c["hit"]), pct(c["dam"])] for c in R["cover"].values()], [2.4, 1.2, 1.2]))

_jam = {}
for k, v in R["clearJam"].items(): _jam.setdefault(v, []).append(k)
upd(9, D8, "Jams", "Was: nothing said what a jam does (UF-03). Now: the jam uses up the attack's AP, and clearing it costs AP by weapon type.",
    tbl(["AP to clear", "Weapon types"], [[k, ", ".join(v)] for k, v in sorted(_jam.items())] + [[R["clearJamDefault"], "anything not listed"]], [1, 6]), flags=["UF-03"])
upd(9, D8, "Bursts, burst damage and untargeted shots", "Was: two descriptions of burst hits (US-07), no word on whether DT applies per bullet (US-08), and no rule for untargeted shots (US-09). Now:", bl(
    "In a burst the hit band is cut into Count equal steps, and a higher roll lands more bullets, at least 1. A crit or super crit lands every bullet. (Replaced on 9 Nov: see Burst bullets by roll, below.)",
    "Each bullet's damage is worked out against DT on its own, then multiplied by the bullets that land.",
    f"A shot with no body part picked hits the Body. Aiming at a limb costs +{R['targetAP']['Limb']} AP, the head +{R['targetAP']['Head']}."), flags=["US-07", "US-08", "US-09"])
upd(9, D8, "Ammo", "Was: the sheet never counted rounds down (US-06). Now: every shot takes its rounds from the shooter's inventory, enemies included. No rounds, no shot.", flags=["US-06"])
upd(9, D9, "Burst bullets by roll", "Was: a crit landed the whole burst. Now: the roll decides how many bullets land, and only a super crit lands them all.",
    p("The hit band, from the lowest hit up to the super crit, is cut into Count - 1 steps, widest first. A higher roll lands more bullets. Only the first bullet of a crit or super crit gets the crit multiplier; the rest are plain hits."),
    tbl(["Roll (hit at 60+, super at 95, burst of 4)", "Bullets"], [["60-75", 1], ["76-87", 2], ["88-94", 3], ["95-99 (super crit)", 4]], [3.2, 1]))
upd(9, D9, "The combat log", "Was: a block of numbers for every attack. Now: one line that tells what happened, with the numbers a click away.", bl(
    "Each attack is one story line, such as <i>Spike takes 7 DMG as Aquilius shoots them</i>. Click it for the roll, the bands, the damage math and any status.",
    "Color shows the outcome: red for a miss, green for a hit, bright green for a crit, bright pink for a super crit.",
    "The verb follows the weapon: shotguns blast, long-range rifles snipe, blades stab and slash. A crit names the body part. Player characters never get the gory death lines.",
    "The roll bar shows the bands before the roll, and the band the roll lands in gets a thick border."))

upd(9, D9, "One sentence per attack", "Was: a story line could add extra sentences, such as a wound description, a remark about the ammo, a status, or an opener. Now: each attack is exactly one sentence with the damage, and nothing else.",
    p("Kills fold the outcome into that sentence, for example <i>Spike shoots Aquilius through the eye for 9 DMG, blowing their brains out the back</i>. A player who drops reads <i>..., and Spike goes down</i>. Grenades are one sentence too. The numbers and statuses are still in the details under each line."))
upd(11, D8, "AP costs and refresh", "Was: the Action AP tab had no costs (UF-07), and nothing said when AP comes back (US-10). Now:",
    tbl(["Action", "AP"], [["Attack", "the weapon's AP"], ["Aim at a limb / the head", f"+{R['targetAP']['Limb']} / +{R['targetAP']['Head']}"], ["Swap weapon", R["swapAP"]], ["Use an item", "the item's AP column"],
        ["Revive an ally", R["reviveAP"]], ["Clear a jam", "by weapon type (chapter 9)"], ["Throw a Frag Grenade", R["throwables"]["Frag Grenade"]["ap"]], ["Move", "by distance (below)"]], [3, 3]),
    p("AP refills in full at the start of each combatant's turn. Anything that costs AP is refused if it can't be paid. Tick Free under OVR, or hold Shift while dragging, to overrule that."), flags=["UF-07", "US-10"])
upd(11, D8, "Movement", "Was: two unlabeled AP rows (US-12). Now: AP by distance walked.",
    tbl(["Walk up to", "AP"], [[f"{m} m", a] for m, a in zip(R["bandMeters"], R["moveAP"])], [1.5, 1]),
    p("On your turn, dragging your token shows the path and its cost first. Then Confirm or Cancel."), flags=["US-12"])
upd(11, D9, "Melee, punches and bursts", "Was: weapons cost their listed AP. Now:", bl(
    f"Melee weapons cost {R['meleeApMul']}x their listed AP, rounded up.",
    f"Punches (fists, gloves and other hand weapons) cost {R['punchAP']} AP for the first in a turn, then {R['punchStep']} more for each one after: 1, 2, 3...",
    f"A burst costs {R['burstAP']} more AP than the weapon lists. Creatures' own attacks keep their AP."))
upd(11, D9, "Throwing a grenade", "New.", p("Pick the grenade from Consumables or the item button. A dashed line runs from the thrower to the pointer, with the blast radius where it lands. Click to set the spot, check who's caught in it, then Throw or Cancel. Damage and range are in chapter 35."))

upd(12, D8, "Meters, not hexes", "Was: a hex distance picked a range column directly, so hexes had no fixed size (UX-11). Now: real distance on a map.",
    p(f"Every map uses a {R['gridM']} m grid. Range bands reach " + ", ".join(f"R{i + 1} {m} m" for i, m in enumerate(R["bandMeters"])) + ". A location sets the map's size, and so which ranges can happen."),
    tbl(["Location", "Width x height"], [[m["n"], "you choose" if k == "custom" else f"{m['w']} x {m['h']} m"] for k, m in R["maps"].items()], [3, 2]), flags=["UX-11"])
upd(12, D8, "Cover comes from the map", "Was: nothing said when cover ends or whether moving breaks it (UF-08). Now: cover is checked for every shot from where people stand, so moving changes it at once. The tiers are in chapter 8. The Take Cover action and the Cover status are gone.", flags=["UF-08"])
upd(12, D9, "Low objects are open", "Was: beds, campfires and other low things counted as soft cover. Now: anything that sits close to the floor gives no cover.",
    p("Open: " + ", ".join(sorted(i["n"] for i in R["mapItems"].values() if i["cover"] == "open")) + ". A kitchen table is concealment only."))
upd(12, D9, "Nobody stands inside things", "New.", p("A move, drag or placement that would put someone inside a wall, a piece of furniture or a tree trunk is refused. Random placement and Surround take the nearest free spot instead."))
upd(12, D9, "Turning objects", "New.", p("While dragging an object on the map, E turns it clockwise and Q counterclockwise, 15 degrees a press. Hold Shift for 5 degrees."))
upd(12, D9, "Room layouts", "Was: items scattered at random. Now: layouts follow how a place is used.", bl(
    "A building setting on open ground puts one building in the middle, furnished inside, with junk around its walls. The rest stays wilderness.",
    "On city streets, every block becomes a building of that setting. Cars and lamp posts stay in the street.",
    "Warehouses get parallel shelf rows with aisles. Factories get conveyor lines with presses on them, oil drums in rows and a boiler and generator corner. Offices put a chair at every desk and split desk pods with partitions. Homes get a kitchen strip, a bedroom and a bathroom. Police stations get a front counter and a row of cells. Camps put beds around the fire.",
    "Every piece can be walked up to, the floor stays in one piece, and each item has a maximum count."),
    p("Items placed = map area x density x a random 0.8 to 1.2, kept between the minimum and maximum. Higher weights come up more often."),
    tbl(["Setting", "Density per m2", "Min-max", "Items (weight)"], [[t["n"], t["density"], f"{t['min']}-{t['max']}", ", ".join(f"{R['mapItems'][k]['n']} ({v})" for k, v in t["items"].items())] for t in R["roomThemes"].values()], [1.1, 0.9, 0.6, 4.4]))
upd(12, D9, "Furniture and scenery", "The current list, from the app's data.",
    tbl(["Item", "Cover", "Size (m)"], [[i["n"], R["cover"][i["cover"]]["n"] + (", blocks walking" if i.get("block") else ""), f"{i['w']} x {i['h']}"] for i in R["mapItems"].values()], [2.8, 2.6, 1.2]))

upd(13, D8, "Effects as variables", "Was: effects written as text only. Now: items, statuses, perks, traits and armor store them as these variables, in their fx and use columns.",
    tbl(["Variable", "What it changes"], [[k, v] for k, v in D["vars"].items()], [1.4, 5.6]))
_rows = lambda src: [[n, fxText(x["fx"]), whenText(x.get("when"))] for n, lst in src.items() for x in lst]
upd(13, D8, "Rules with conditions", "Was: conditional effects written as text. Now: a condition turns a rule on for the shot in question: the weapon, the target's type, the range, the round, sneaking and so on.",
    p("Target types come from the enemy's name: " + ", ".join(R["enemyTypes"].keys()) + ", human."),
    tbl(["Level perk", "Variables", "When"], _rows(R["perkRules"]), [1.9, 2.4, 2.7]),
    tbl(["Trait", "Variables", "When"], _rows(R["traitRules"]), [1.9, 2.4, 2.7]),
    tbl(["Skill perk, accessory or mod", "Type", "Variables", "When"], [[r["n"], r.get("cat", ""), fxText(r.get("mods")), whenText(r["when"])] for r in D["sc"] if r.get("when")], [1.7, 0.9, 2, 2.4]))
upd(13, D9, "Cards show modified numbers", "Was: cards showed the base SPECIAL and skills. Now: they show the numbers after every modifier.",
    p("A number that's up is highlighted and one that's down is red. Hovering shows the base. The Character window writes out every SPECIAL and skill in full, with its base beside it."))

upd(16, D8, "Initiative", "Was: no rule picked between set and rolled initiative for enemies (UF-12). Now: everyone rolls.",
    p(f"Initiative = d20 + (AGL + PER) / 2. Players type their roll or press the dice button. Enemy rolls are filled in, and the DM can change them. A sneak attack starts with a stealth phase: each action gets a d20 stealth roll, and anyone caught takes {R['caughtInit']} initiative."), flags=["UF-12"])

upd(17, D8, "Taking a turn", "Now: the app runs the turn.", bl(
    "The action column opens with who is acting, their AP and End turn.",
    "<b>Loadout:</b> your weapons, with AP cost, magazine and ammo carried.",
    "<b>Target:</b> click anyone on the map or in a list. Range and cover fill in from the map. Click a body part.",
    "<b>The aim line</b> is colored by the weapon's accuracy at that distance: red at its worst band, green at its best.",
    "<b>Roll:</b> type the two-dice roll or press the dice button. The math line is there to read aloud.",
    "The card of whoever's turn it is has a thick flashing border."))
upd(17, D8, "Injuries from crits", "Was: injured limb tiers existed, but nothing said when they happen (UF-16). Now: a crit on a body part adds a status.",
    tbl(["Part hit", "Status", "Tier"], [["Head", R["critStatus"]["Head"], f"{R['critTier']['Crit']} on a crit, {R['critTier']['Super']} on a super crit"], ["Body", R["critStatus"]["Body"] or "none", ""], ["Arm or leg", R["critStatus"]["Leg"], f"{R['critTier']['Crit']} on a crit, {R['critTier']['Super']} on a super crit"]], [1.5, 2.6, 2.9]),
    p("Crippled parts show on the Health tab's body map (chapter 27)."), flags=["UF-16"])

upd(18, D8, "Healing items and Revive", "Was: unclear whether healing items stand up a downed character. Now: they don't, except the Surgeon's Kit, whose text says it can.",
    p(f"Otherwise use Revive: {R['reviveAP']} AP, back up at {R['reviveHP']} HP with Shock {R['reviveShockTier']}. Each revive lowers that character's save by {R['revivePenalty']}."))
upd(18, D8, "XP after a defeat", f"Was: undecided (UF-18). Now: a defeat gives {round(R['defeatXpPct'] * 100)}% of the XP. The DM can type a different number on the end screen.", flags=["UF-18"])

upd(19, D8, "Healing, loot and addiction", "Was: passive healing had no number (UF-14), and the addiction roll wasn't named (US-17). Now:", bl(
    f"Passive heal: {round(R['passiveHealPct'] * 100)}% of max HP after a fight and on each Rest. Downed characters don't heal this way.",
    f"Loot: each defeated enemy's gear is listed, with up to {R['genLootMax']} extra consumables each. Tick what the party takes, give it all to one person, or add items by hand.",
    "Addiction: for each addictive item used in the fight, roll a d100. At or under the item's addiction chance, the character is addicted.",
    "XP is worked out for each player (chapter 21), and can be changed before it's given."), flags=["UF-14", "US-17"])

_styles = R.get("nameStyles", {})
def _ranks(st):
    rk = st.get("ranks") or {}
    return "; ".join(f"T{t}: {', '.join(dict.fromkeys(x.strip() for x in v.split(',')))}" for t, v in rk.items()) or "-"
upd(20, D9, "Names and ranks", "Was: generic enemies were numbered, such as Raider 1. Now: each gets a name from its faction, such as Legion Recruit - Aquilius.",
    p("Military factions get ranks that fit the enemy's tier, so a low-tier trooper can be a private and a ranger never is. Higher tiers get nicknames or epithets. Gangs use raider-style nicknames. The name lists are tables in the enemy editor: edit them and press Refresh."),
    tbl(["Faction", "Style", "Ranks by tier"], [[f, st.get("style", ""), _ranks(st)] for f, st in _styles.items()], [1.5, 0.8, 4.7]))
upd(20, D9, "Enemy skills", "Was: enemies had no skill numbers. Now: from their tier, SPECIAL and weapon.", bl(
    "Each combat skill starts from what a typical weapon of that skill and tier needs (the 75th percentile requirement).",
    f"Add {R['npcSkillSpecial']} for each point the skill's two SPECIAL stats average above 5, then a random amount up to {R['npcSkillSpread']} either way.",
    f"A skill for a weapon the enemy carries never falls short of that weapon's requirement. Skills for weapons they don't carry start from {round(R['npcOffSkill'] * 100)}% instead.",
    "Skills stay between 0 and 100."))
upd(20, D9, "Creature attacks pierce", f"Was: creature attacks had no Pen, so any armor cut them to the damage floor. Now: a creature's attacks have Pen {R['creaturePen']} per tier (a tier 5 Deathclaw has 20).")
upd(20, D9, "Enemy toughness", f"Was: enemy humans gained 6 HP a tier. Now: {R['npcHpPerTier']} a tier, so HP = 15 + END x 2 + (tier - 1) x {R['npcHpPerTier']}.")
upd(20, D8, "Enemy gear", f"Was: human enemies had no weapons or armor (UF-20). Now: gear is picked for the enemy's tier, plus up to {R['genLootMax']} consumables. Unique weapons are never picked. Reroll on the enemy's card for a new set.", flags=["UF-20"])

upd(21, D8, "Who gets enemy XP", "Was: not stated (US-19). Now: every player gets the full XP of every enemy killed.",
    p(f"Each player's XP is scaled by INT: XP x (1 + (INT - 5) x {R['xpIntStep']}). Settings can switch the award to an even split or to the killer only."), flags=["US-19"])

def kit(a):
    bits = [a["w"]]
    if a.get("ammo"): bits.append(f"{a['ammo'][1]} x {a['ammo'][0]}")
    bits += a.get("wear", []) + [f"{q} x {n}" if q > 1 else n for n, q in a.get("items", [])]
    if a.get("caps"): bits.append(f"{a['caps']} caps")
    return ", ".join(bits)
upd(22, D8, "Building a character", "Was: backgrounds had no list (UX-15), and it was unclear whether level 1 spends skill points (US-20) or may reroll the third trait (US-22). Now: five steps.", bl(
    "Name and archetype. The archetype sets the starting kit.",
    f"SPECIAL: each starts at {R['startSpecial']}, with at most {R['startPool']} points in total.",
    "Traits: one is rolled, with a single reroll, then you pick two.",
    "Three tag skills, which gain 2 per point spent. No other skill points at level 1.",
    "Review, then the character joins the party."), flags=["UX-15", "US-20", "US-22"])
upd(22, D9, "Archetypes", f"Was: a short list with tag lines. Now: {len(R['archetypes'])} archetypes, each with a plain description and a kit that can defend itself and is dressed.",
    tbl(["Archetype", "Who they are", "Kit"], [[a["n"], a["d"], kit(a)] for a in R["archetypes"]], [1.3, 2.5, 3.2]))

_st = []
for s in D["statuses"]:
    tiers = [t for t in (fxText({k: v for k, v in f.items() if k != "turns"}) for f in s.get("fx", [])) if t]
    if tiers: _st.append([s["n"], s.get("tone", ""), " | ".join(dict.fromkeys(tiers))])
upd(27, D8, "Statuses as variables", "Was: status effects written as text. Now: each tier sets variables (chapter 13).", tbl(["Status", "Tone", "Variables by tier"], _st, [1.5, 0.7, 4.8]))
upd(27, D9, "Body map", "New.", p("The Health tab shows a box body: head, arms, body and legs. A part with an injury reads CRIPPLED. The character's statuses are listed beside it."))

_c, _g, _q = R["vendorCounts"], R["vendorGrowth"], R["vendorQtyGrowth"]
_n = lambda k, t: round(_c[k] + _g[k] * (t - 1))
upd(29, D8, "Vendor prices", "Was: Stat Converter columns with no shop rules. Now:", p(f"A vendor has a tier and a barter level ({', '.join(str(x) for x in R['vendorBarter'])}). Buy price = value x the higher of 1 and vendor barter / your Barter. Sell price = value x the lower of 1 and your Barter / vendor barter. A vendor at 100 matches the sheet's formula. Prices marked ~ are placeholders, because the workbook has no value for ammo and most consumables."))
upd(29, D9, "Stock grows with tier", "Was: about the same stock at every tier. Now: higher tiers carry far more consumables and ammo, but still only a few guns and armor.",
    p("Guns and armor come from the vendor's tier and the one below. Consumables, ammo and materials can be anything up to the vendor's tier. Never unique weapons."),
    tbl(["Kind", "Lines at T1", "Lines at T6", "Quantity per tier"], [["Weapons", _n("weapon", 1), _n("weapon", 6), "-"], ["Armor", _n("armor", 1), _n("armor", 6), "-"], ["Accessories", _n("accessory", 1), _n("accessory", 6), "-"],
        ["Consumables", _n("item", 1), _n("item", 6), f"+{round(_q['item'] * 100)}%, medicine +{round(_q['med'] * 100)}%"], ["Ammo", "for the guns stocked", "for the guns stocked", "by kind, see Ammo follows the guns"], ["Materials", _n("material", 1), _n("material", 6), f"+{round(_q['material'] * 100)}%"]], [1.6, 1.1, 1.1, 2.6]))

_va = R["vendorAmmo"]; _vq = lambda k, t: max(0, round(_va[k][0] + _va[k][1] * (t - 1)))
upd(29, D9, "Ammo follows the guns", "Was: random ammo of any caliber. Now: a vendor carries ammo only for the guns on their shelf, and mostly the common loads.",
    p(f"Guns are picked so calibers vary: each gun already on the shelf in a caliber makes another one {round(R['vendorSameCaliber'] * 100)}% as likely, so two 9mm guns can happen but aren't the norm. For each caliber on the shelf, the vendor stocks its loads up to their tier, by kind (chapter 37):"),
    tbl(["Kind", "Rounds per line at T1", "At T3", "At T6"], [[k.capitalize(), _vq(k, 1), _vq(k, 3), _vq(k, 6)] for k in ["junk", "standard", "improved", "special", "best"]], [1.6, 1.6, 1, 1]),
    p("Each amount varies by 25% either way. Junk thins out and is gone by tier 5. Better vendors carry more lines of improved and special loads, and from tier 2 sometimes a few rounds of the caliber's best."))

_fg = R["throwables"]["Frag Grenade"]
upd(35, D9, "Frag Grenade", "New: the first throwable.",
    tbl(["Distance from the blast", "Damage"], [[f"up to {i + 1} m", f"{d} DMG"] for i, d in enumerate(_fg["dmg"])] + [[f"past {_fg['radius']} m", "0"]], [2.2, 1.2]),
    p(f"{_fg['ap']} AP. {_fg['lb']} lb. Thrown up to {_fg['range']} m. It hits everyone in the radius, the party included, and ignores DT and cover. One grenade is used per throw. How to throw is in chapter 11."))

_cp = R["ammoClassPrice"]
upd(37, D9, "Ammo kinds, prices and scarcity", "Was: every load priced the same, with no sense of rarity. Now: ammo is about scarcity and progression.",
    p("You start on junk and standard rounds because they're cheap and plentiful. Better ammo costs more and vendors stock less of it. Each load falls into a kind:"),
    tbl(["Kind", "Loads", "Price x"], [["Junk", "Junk, Salvaged", _cp["junk"]], ["Standard", "Standard, Basic, Musket Ball", _cp["standard"]], ["Improved", "Surplus, Hand Load, Mil-Spec, Match, +P', +P+, Proof Load, Olympic Quality: a bit better, and pricier or made by hand", _cp["improved"]], ["Special", "everything else: hollow points, AP, slugs, buckshot and so on", _cp["special"]], ["Best", "the caliber's top special load", _cp["best"]]], [1.1, 4.6, 0.8]),
    p(f"Ammo has no value in the workbook, so a round costs {R['ammoPrice']} cap x its tier x its kind's multiplier. The \"5.56mm - API\" load was filed under a caliber no gun uses; it is now 5.56mm NATO - API."))
upd(37, D8, "Ammo comes from inventory", "Was: the DM tracked rounds by hand. Now: shots take rounds from the shooter's inventory, enemies included. No rounds, no shot.")

_ap, _rd = [], []
for i in D["items"]:
    u = i.get("use") or {}
    if u.get("applies"): _ap.append([i["n"], ", ".join(f"{a['n']} {a['tier']}" for a in u["applies"]), fxText(u["applies"][0].get("fx")) or "status numbers", (u.get("after") or {}).get("n", "")])
    if u.get("reduces") or u.get("removes"): _rd.append([i["n"], ", ".join(f"{k} -{v}" for k, v in (u.get("reduces") or {}).items()), ", ".join(u.get("removes") or [])])
upd(40, D8, "Placeholders", "Was: empty-slot markers such as (NO HEADGEAR) were listed like items. Now: they aren't items and never drop.")
upd(40, D8, "What drugs, drinks and food apply", "Was: effects written as text. Now: each applies a status.",
    p("If the workbook gives an item numbers, it keeps those exact numbers under the status. If its text was blank, it uses the status tier's numbers. Rest ends them, and a hangover or comedown can follow."),
    tbl(["Item", "Status", "Numbers", "Afterward"], _ap, [2.2, 1.6, 2.2, 1]))
upd(40, D8, "Items that lower or remove statuses", "Now:", tbl(["Item", "Lowers", "Removes"], _rd, [2.6, 3, 1.4]))
upd(40, D8, "Healing items don't revive", "Now: they never stand up a downed character, except the Surgeon's Kit. See chapter 18.")

_fac = {}
for e in D["enemies"]: _fac.setdefault(e.get("faction", "Unaligned"), []).append(e)
_ft = []
for f in sorted(_fac, key=lambda x: (x == "Unaligned", x)):
    _ft += [Paragraph(f"<b>{esc(f)}</b> ({len(_fac[f])})", P)]
    _ft += tbl(["Name", "Tier", "XP", "Caps", "Weapons"], [[e["n"], e.get("tier", ""), e.get("xp", ""), e.get("caps", "") or "-", ", ".join(dict.fromkeys(x for x in (e.get("w1"), e.get("w2")) if x)) or "generated by tier"] for e in sorted(_fac[f], key=lambda x: (x.get("tier", 0), x["n"]))], [2.6, 0.5, 0.5, 0.8, 2.6])
upd(43, D8, "Enemies by faction", "Was: one list. Now: every enemy has a faction, and creatures and anyone non-specific are Unaligned. People's HP, AP and DT come from their SPECIAL and tier. Creatures have fixed numbers.", _ft)

_skip = {}
for t, n, w in D["skipped"]: _skip.setdefault(t, []).append((n, w))
_names = {"Item": "Consumables", "Status": "Statuses", "Armor": "Armor", "Level perk": "Level perks", "Skill Perk": "Skill perks", "Trait": "Traits", "Trait Evolution": "Trait evolutions", "Accessory": "Accessories", "Weapon Mod": "Weapon mods", "Weapon mod": "Weapon mods, text only"}
_left = []
for k, rows in _skip.items():
    _left += [Paragraph(f"<b>{esc(_names.get(k, k))}</b> ({len(rows)})", P)] + tbl(["Name", "Note"], [[n, w] for n, w in dict.fromkeys(rows)], [2.2, 4.8])
upd(45, D8, "Left for the DM", "These effects stay as written reminders, because they need a judgment call, a story decision or something the game doesn't track, such as NPC reactions, crafting, romance, or what resisting a status means.", _left)

upd(47, D8, "Save packs", "New.", p("<b>Save pack</b> makes a .zip with campaign.json, rules.json and every table as tables/*.csv. Open it, edit it, zip it back and use <b>Load pack</b>. Keep it a .zip: WinRAR can save as zip, but browsers can't open .rar files. Change a written effect and the app reads it again on load, or change the fx and use columns to set the variables yourself."))
upd(47, D9, "Saving to a file", "Was: Save wrote to the browser only. Now: Save asks where.", bl(
    "Save to the file you last saved to or loaded, to a new location, or download a copy. The session remembers the file, and loading a save remembers its path.",
    "On phones and tablets, Save opens the share sheet so the file can go to Files, or downloads a copy."))

# ---------------------------------------------------------------- where each chapter sits in the original book
base = fitz.open(BASE)
# ---------------------------------------------------------------- 10 Nov 2026
upd(7, D10, "Passing a check pays XP", "Was: the DM typed an XP amount for the players who passed. Now: a pass pays XP by itself, by difficulty.", bl(
    f"XP = the check's target x {R['checkXpMul']}, then the INT bonus on top (the same bonus as enemy XP). Trivial 10 pays {round(10 * R['checkXpMul'], 2)}, Average 40 pays {round(40 * R['checkXpMul'], 2)}, Extreme 100 pays {round(100 * R['checkXpMul'], 2)}.",
    "Revive checks pay nothing. The old box for extra XP to everyone who passed is still there.",
    "Settings > XP and healing > Skill check XP per point of difficulty."))
upd(9, D10, "Weapon familiarity", "New.", bl(
    "Each player counts the rounds they have fired with each weapon. A melee swing or a throw counts as 1. A jam counts nothing.",
    f"A crit or super crit counts {R['famCritMul']} times the rounds fired.",
    "The count shows as one word on the weapon, in the inventory and on the weapon slot: " + ", ".join(f"{w} from {n}" for n, w in R['famBands']) + ".",
    "The DM can type a new count next to the word. For now familiarity is a label only: it changes no numbers."))
upd(11, D10, "Fists never cost a swap", "Was: after shooting, the first punch cost 1 AP more, the weapon swap. Now: punching never pays to swap, because fists are always ready.")
upd(12, D10, "Cover has health", "New.", bl(
    "When a shot goes through cover, the cover takes the damage it stopped. Soft cover stops 10% of a hit, so it takes that 10%; hard cover stops half.",
    "Each tier lasted a set number of 5.56 Standard rounds (11 damage each): soft 15, hard 60, impenetrable 400. Its health was that many rounds of the damage it stops, so soft cover had 17 HP and hard cover 330.",
    "Open ground and concealment stop no damage, so they never break.",
    f"Explosives hit objects for {R['objBlastMul']}x their blast damage at that distance.",
    "Damaged cover shows a small health bar. At 0 it is destroyed and taken off the map. Settings > Cover health and familiarity."))
upd(12, D10, "Flimsy cover wears out faster, and protects less as it does", "Was: cover took the damage it stopped, so hard cover took the most and concealment never broke. Now: it is the other way round.", bl(
    "A hit through cover hurts it by the shot's damage before cover, times a share for its tier: " + ", ".join(f"{t} x{x}" for t, x in R['coverTake'].items()) + ". Misses and jams leave it alone.",
    f"Each tier still lasts a set number of 5.56 Standard rounds: " + ", ".join(f"{t} {n}" for t, n in R['coverRounds'].items()) + f". So its health is rounds x {R['coverRound']} x its share: " + ", ".join(f"{t} {round(n * R['coverRound'] * R['coverTake'][t])} HP" for t, n in R['coverRounds'].items()) + ".",
    "Concealment and soft cover protect in proportion to the health they have left: at half health a bush gives half its hit penalty and soft cover half its damage cut. The attack panel shows the percent left. Hard cover and impenetrable protect fully until they break.",
    f"Explosives still hit objects for {R['objBlastMul']}x, times the same share."))
upd(9, D10, "Roll ranges in short form", "Was: a list such as Jam 00-09 · Miss 10-62 · Hit 63-96. Now: only where each result starts.", bl(
    "Red 10 - means a jam on anything below 10. White 63 + means a hit from 63 up. Green 97 ++ is a crit, blue 99 $$$ a super crit. Anything not covered is a miss.",
    "The rolls are 00 to 99, so a 5% jam reads 05 - (00 to 04). The full ranges show when you point at the line."))
upd(17, D10, "Rounds roll on", "Was: every round ended on a screen with a Start round button. Now: when the last turn ends, the next round starts by itself.", p("The end-of-round screen only stops play when someone is down and has a saving throw to roll."))
upd(12, D10, "Square or hex grid", "Was: a 2m square grid. Now: the map can show 2m squares, hexes 12.5m across, or no grid.", p("The buttons are next to the zoom. The grid is only a picture: ranges are still measured in meters."))
upd(12, D10, "Chests", "New, for testing.", bl(
    "Tick Chest next to Randomize room and a chest of ammo for the party's guns is placed a few meters in front of them.",
    "A chest opens for whoever starts a turn, or finishes a move, within R1 of it. Its loot goes into their pack and the log says what was inside."))
upd(12, D10, "Range ring and range snapping", "New.", bl(
    "On anyone's turn a ring around them shows their hit chance with the weapon in hand at every range band: clear where they can't hit, light red at low odds through yellow, green only above 65%, brighter as it rises.",
    "The ring leaves out the target's own modifiers and cover.",
    "Hold Ctrl while dragging on a turn and the token snaps to the middle of the range band from the target (or the nearest enemy)."))
upd(19, D10, "Survival and Luck decide loot", "Was: every item on a body was looted. Now: how much the party finds depends on its best looter.", bl(
    f"Looting score = Survival + {R['lootLuck']} x Luck, from the best player still standing. Survival 100 with Luck 1 scores the same as Survival 10 with Luck 10.",
    "Weapons, the ammo loaded for them and worn armor always come off the body.",
    f"Everything else, caps included, comes off in proportion to the score: all of it at {R['lootFull']} or more.",
    f"Each body also gives extra finds: about {R['lootFind']} per score point, at most {R['lootFindMax']}. They are mostly consumables and ammo for the party's guns, with some junk. A higher score finds better things and reaches a tier higher for every 100 points.",
    "Fists and natural attacks are no longer listed as loot. Settings > Looting."))
upd(29, D10, "Unique weapons stay out of shops, gear and loot", "Was: only weapons with no Value on the Small Guns and Melee tabs were treated as unique. Now: 140 named one-offs are flagged unique too.", bl(
    "A unique weapon never appears on a vendor's shelf, in an enemy's generated gear or in found loot. An enemy whose sheet names a unique weapon still carries it.",
    "Named means a proper name or an odd, specific name, such as Lucky, Ratslayer, That Gun, Big Boomer or Mjolnir. Generic descriptors stay ordinary even with brackets, such as Service 9mm Pistol (Beretta). Homemade weapons stay ordinary.",
    "The list is uniques in rules.js, so the DM can add or remove names."))

starts, parts, titles = {}, [], {}
for b in base[1].get_text("dict")["blocks"]:
    for l in b.get("lines", []):
        s = "".join(x["text"] for x in l["spans"]).strip(); x0 = l["bbox"][0]
        m = re.match(r"^(\d+)\. (.+)$", s)
        if m and x0 > 60: titles[int(m.group(1))] = (m.group(2), l["bbox"])
        elif re.match(r"^\d+$", s) and x0 > 500: starts.setdefault("_nums", []).append((l["bbox"][1], int(s)))
        elif s.startswith("Part "): parts.append((s, l["bbox"]))
nums = dict(starts.pop("_nums"))
first = {ch: nums[min(nums, key=lambda y: abs(y - bb[1]))] for ch, (t, bb) in titles.items()}
partPage = [(t, nums[min(nums, key=lambda y: abs(y - bb[1]))]) for t, bb in parts]
allStarts = sorted(set(first.values()) | {pg for _, pg in partPage})
last = {ch: (min([s for s in allStarts if s > pg], default=base.page_count + 1) - 1) for ch, pg in first.items()}
assert first[12] == 22 and first[45] == 147 and last[45] == 154, (first, last)
assert set(U) <= set(first), set(U) - set(first)

# ---------------------------------------------------------------- render the lettered pages for each chapter
tmp = tempfile.mkdtemp()
labels, upd_docs = {}, {}
for ch in sorted(U):
    lab = str(last[ch])
    def deco(c, d, lab=lab):
        c.saveState(); c.setFont(REG, 7.6); c.setFillColor(colors.HexColor(GREY))
        c.drawString(54, 792 - 27.6, "Fallout Homebrew TTRPG · Game Bible"); c.drawRightString(558, 792 - 770.6, f"{lab}{chr(96 + d.page)}")
        c.setStrokeColor(colors.HexColor("#dfe3e6")); c.setLineWidth(0.6); c.line(54, 792 - 31, 558, 792 - 31); c.restoreState()
    story = [Paragraph(f"{ch}. {esc(titles[ch][0])}: changes", H1), Paragraph(f"Changes since the bible was compiled, oldest first. Where this page and {f'page {first[ch]}' if first[ch] == last[ch] else f'pages {first[ch]}-{last[ch]}'} disagree, this page is current.", WHEN)]
    for date, title, how, body, flags in U[ch]:
        head = [Paragraph(esc(title), H2), Paragraph(f"<font color='{GREEN}'><b>CHANGED {date.upper()}</b></font>  {how}" + (f"  <font color='{GREEN}'>Resolves {', '.join(flags)}.</font>" if flags else ""), WHEN)]
        # a heading stays with a following paragraph; a long table would leave a blank page, so it just follows
        story += [KeepTogether(head + body[:1])] + body[1:] if body and isinstance(body[0], Paragraph) else head + body
    path = os.path.join(tmp, f"u{ch}.pdf")
    doc = BaseDocTemplate(path, pagesize=(612, 792), leftMargin=54, rightMargin=54, topMargin=44, bottomMargin=48, title="updates")
    doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(54, 48, 504, 792 - 44 - 48, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=deco)])
    doc.build(story)
    upd_docs[ch] = fitz.open(path)
    labels[ch] = [f"{lab}{chr(97 + i)}" for i in range(upd_docs[ch].page_count)]

# ---------------------------------------------------------------- mark the original pages
def font(bold):
    ff = BOLD_FILE if bold else REG_FILE
    return ff, ("SegB" if bold else "Seg") if ff else ("hebo" if bold else "helv")
def tlen(text, size, bold=False):
    ff, name = font(bold); return (fitz.Font(fontfile=ff) if ff else fitz.Font(name)).text_length(text, size)
def put(page, x, y, text, size, bold=False, color=GREEN, right=False):  # y is the baseline, from the top
    ff, name = font(bold)
    if right: x -= tlen(text, size, bold)
    page.insert_text((x, y), text, fontsize=size, fontname=name, fontfile=ff, color=tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)))

newest = lambda ch: max((u[0] for u in U[ch]), key=[D8, D9, D10].index)
put(base[0], 54, 570.5, f"Updated {LATEST}. Changes sit in the chapters they affect, on lettered pages such as {labels[12][0]}.", 8.2, color=GREY)
for ch in U:
    pg = base[first[ch] - 1]
    put(pg, 558, 27.6, f"UPDATED {newest(ch).upper()}  ·  CHANGES ON {labels[ch][0]}" + (f"-{labels[ch][-1]}" if len(labels[ch]) > 1 else ""), 7.6, bold=True, right=True)
    t, bb = titles[ch]
    put(base[1], bb[2] + 7, bb[3] - 1.6, f"updated {newest(ch)}, see {labels[ch][0]}", 7.4)

# flags: flag -> the lettered page that decides it
decided = {f: labels[ch][0] for ch in U for u in U[ch] for f in u[4]}
REG_PAGES = range(first[45] - 1, last[45])
def redact(page, rects):
    for r in rects: page.add_redact_annot(r + (0.5, 1, -0.5, -1), fill=False)  # inset, so neighbouring text survives
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
found = {f: 0 for f in decided}
for i in range(base.page_count):
    page = base[i]; spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]]
    todo = []
    for s in spans:
        txt = s["text"].strip(); m = re.match(r"^(UNFINISHED|UNSURE|UNEXPLAINED|BUG|CONFLICT) ((?:UF|BG|US|UX|CF)-\d\d)$", txt)
        if m and m.group(2) in decided and i not in REG_PAGES:
            todo.append(("callout", s, m.group(2)))
        elif i in REG_PAGES and txt in decided and s["bbox"][0] < 50:
            todo.append(("row", s, txt))
    if not todo: continue
    adds, rects = [], []
    for kind, s, fl in todo:
        found[fl] += 1; bb = fitz.Rect(s["bbox"])
        if kind == "callout":
            rects.append(bb); adds.append((bb.x0, s["origin"][1], f"RESOLVED {fl}", s["size"], True))
            box = [d["rect"] for d in page.get_drawings() if d.get("fill") and d["rect"].contains(bb) and d["rect"].width > 100]
            bar = [d["rect"] for d in page.get_drawings() if d.get("fill") and d["rect"].width <= 5 and d["rect"].y0 <= bb.y0 and d["rect"].y1 >= bb.y1 and d["rect"].x1 <= bb.x0]
            for r in bar[:1]: page.draw_rect(r, color=None, fill=(0.12, 0.48, 0.29))
            if box:
                r = box[0]; tag = f"DECIDED, SEE {decided[fl]}"; w = tlen(tag, 6.6, True)
                t = fitz.Rect(r.x1 - w - 14, r.y0 - 8.5, r.x1 - 6, r.y0 + 1.5); adds.append(("tag", t, tag))  # sits on the box's top edge, clear of its text
        else:  # a register row: ID, kind and page cells on the same line
            line = [x for x in spans if abs(x["bbox"][1] - bb.y0) < 1.5]
            kindS = next((x for x in line if 65 < x["bbox"][0] < 120), None); pageS = next((x for x in line if 120 < x["bbox"][0] < 160), None)
            rects.append(bb); adds.append((bb.x0, s["origin"][1], fl, s["size"], True))
            if kindS:  # "Resolved 18a", shrunk to fit before the Page column
                txt = f"Resolved {decided[fl]}"; room = (pageS["bbox"][0] if pageS else 126) - 3 - kindS["bbox"][0]
                size = min(kindS["size"], kindS["size"] * room / tlen(txt, kindS["size"]))
                rects.append(fitz.Rect(kindS["bbox"])); adds.append((kindS["bbox"][0], kindS["origin"][1], txt, size, False))
    redact(page, rects)
    for a in adds:
        if a[0] == "tag":
            _, t, tag = a; page.draw_rect(t, color=None, fill=(0.12, 0.48, 0.29)); put(page, t.x0 + 4, t.y1 - 2.6, tag, 6.6, bold=True, color="#ffffff")
        else: put(page, a[0], a[1], a[2], a[3], bold=a[4])
missing = [f for f, n in found.items() if n < 2]
assert not missing, f"flags not found in both their chapter and the register: {missing}"

# ---------------------------------------------------------------- insert the lettered pages, back to front so earlier positions hold
for ch in sorted(U, key=lambda c: -last[c]): base.insert_pdf(upd_docs[ch], start_at=last[ch])
shift = lambda pg: pg - 1 + sum(len(labels[c]) for c in U if last[c] < pg)  # original page -> 0-based position now
labels_rules = [{"startpage": 0, "prefix": "", "style": "D", "firstpagenum": 1}]
for ch in sorted(U, key=lambda c: last[c]):
    at = shift(last[ch]) + 1
    for k, lab in enumerate(labels[ch]): labels_rules.append({"startpage": at + k, "prefix": lab, "style": "", "firstpagenum": 1})
    labels_rules.append({"startpage": at + len(labels[ch]), "prefix": "", "style": "D", "firstpagenum": last[ch] + 1})
labels_rules = [r for r in labels_rules if r["startpage"] < base.page_count]
base.set_page_labels(labels_rules)
toc = []
items = sorted([(pg, 1, t) for t, pg in partPage] + [(first[c], 2, f"{c}. {titles[c][0]}") for c in titles], key=lambda x: (x[0], x[1]))
toc.append([1, "Cover and contents", 1])
for pg, lvl, t in items:
    toc.append([lvl, t, shift(pg) + 1])
    ch = int(t.split(".")[0]) if lvl == 2 else None
    if ch in U: toc.append([3, f"Changes ({labels[ch][0]}" + (f"-{labels[ch][-1]})" if len(labels[ch]) > 1 else ")"), shift(last[ch]) + 2])
base.set_toc(toc)
base.subset_fonts()  # each inserted page brought its own full copy of the fonts: keep only the letters used, a quarter of the size
mid = os.path.join(tmp, "mid.pdf"); base.save(mid, garbage=4, deflate=True)

# ---- Fallout terminal look: black pages, green text. Every color in the PDF is swapped as it's drawn, so the layout doesn't change.
BG = (0.008, 0.02, 0.008)
def terminal(r, g, b):
    L = (r + g + b) / 3; dark = 1 - L; chroma = max(r, g, b) - min(r, g, b)
    if chroma > 0.25:  # warnings and accents keep a color of their own
        warm = r >= b
        base_ = (1, 0.82, 0.25) if warm else (0.45, 1, 0.8)
        k = 0.6 + 0.4 * dark
    else:
        base_ = (0.3, 1, 0.49); k = dark
    # the palest backgrounds become black-green, text becomes bright
    return tuple(max(bgc, c * k) for c, bgc in zip(base_, BG))
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
w = PdfWriter(clone_from=mid)
for pg in w.pages: recolor(pg, w)
w.add_metadata({"/Title": "Fallout TTRPG Game Bible"})
with open(PDF, "wb") as f: w.write(f)
# The recolored file carries leftovers from every step. One clean re-save halves it again; pages, text and contents stay the same.
tidy = fitz.open(PDF); tidy.save(PDF + ".tmp.pdf", garbage=4, deflate=True); tidy.close(); os.replace(PDF + ".tmp.pdf", PDF)
for d in upd_docs.values(): d.close()
base.close(); shutil.rmtree(tmp, ignore_errors=True)
print(f"{len(U)} chapters updated, {sum(len(v) for v in labels.values())} lettered pages, {len(decided)} flags resolved, {len(w.pages)} pages")
