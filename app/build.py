#!/usr/bin/env python
"""Rebuild the DM app after rebalancing the workbook.

    python app/build.py ["path/to/workbook.xlsx"]

Reads the workbook, writes app/tests/fixtures.json and app/data_report.md, and inlines
data + src/* into "Fallout DM App.html". Never reads the tabs listed in SKIP.
Needs: pip install openpyxl
"""
import base64, datetime, glob, json, os, re, sys
from collections import Counter, defaultdict
import openpyxl
from openpyxl.utils import column_index_from_string as ci

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SKIP = {"(DO NOT LOOK) FIRST Q", "Mobs (OLD)", "(deprecated)Armor", "(deprecated) DAMAGE CALCULATOR"}
xlsx = sys.argv[1] if len(sys.argv) > 1 else sorted(glob.glob(os.path.join(ROOT, "Fallout*Spreadsheet*.xlsx")))[-1]
wb = openpyxl.load_workbook(xlsx, data_only=True)
issues = defaultdict(list)


def rows(tab, start, key):
    assert tab not in SKIP
    out = []
    for r in wb[tab].iter_rows(min_row=start):
        d = {c.column_letter: c.value for c in r if c.value not in (None, "") and not (isinstance(c.value, str) and c.value.startswith("#"))}
        if key in d:
            out.append(d)
    return out


def txt(v):
    if v is None:
        return ""
    if isinstance(v, datetime.datetime):  # Sheets turned "5-15" into May 15
        return f"{v.month}-{v.day}"
    return re.sub(r"\s+", " ", str(v).replace("￼", "")).strip()


def num(v, default=None):
    if isinstance(v, bool):
        return default
    if isinstance(v, str):  # some tabs store numbers as text
        try:
            return float(v.strip())
        except ValueError:
            return default
    return v if isinstance(v, (int, float)) else default


def name_of(tab, raw, seen):
    """Lookups are by exact name, so report anything that would make one miss."""
    if raw != raw.strip():
        issues["Names with stray spaces (trimmed by the app)"].append(f"{tab}: '{raw}'")
    n = txt(raw)
    if n.lower() in seen:
        issues["Duplicate names (first one wins)"].append(f"{n}: {seen[n.lower()]} and {tab}")
        return None
    seen[n.lower()] = tab
    return n


seen = {}
hit_cols = lambda first: [ci(first) + i for i in range(10)]


def hits(r, first):
    from openpyxl.utils import get_column_letter as gl
    return [num(r.get(gl(c))) for c in hit_cols(first)]


weapons = []
CAL_FIX = {"5.56mm": "5.56mm NATO"}  # the API load is filed under "5.56mm"
AMMO_ALIAS = {".308 win": ".308 WIN", ".45-70 govt": ".45-70 GOVT", ".50 cal ball": ".50 Ball", "nails": "Nail", "railway spikes": "Railway Spike", "40mm g": "40mm Shell", "25mm g": "25mm Shell"}
RESERVE = {"MFC": "Microfusion Cell", "EC": "Energy Cell", "ECP": "Electron Charge Pack", "Fuel": "Flamer Fuel", "Nitrogen": "Nitrogen Tank"}

for tab, code, skill in (("Small Guns", "SG", "SG"), ("Big Guns", "BG", "BG")):
    for r in rows(tab, 4, "E"):
        n = name_of(tab, r["E"], seen)
        if not n:
            continue
        ammo = txt(r.get("G"))
        weapons.append(dict(n=n, tab=code, skill=skill, tier=num(r.get("B"), 0), type=txt(r.get("F")), ammo=AMMO_ALIAS.get(ammo.lower(), ammo), auto=r.get("H") is True, mag=num(r.get("I")), reload=num(r.get("J")), ap=num(r.get("K")),
                            count=num(r.get("L")), crit=num(r.get("M")), jam=num(r.get("N")), str=num(r.get("O"), 0), req=num(r.get("P")), hit=hits(r, "R"), lb=num(r.get("C"), 0), val=num(r.get("D")), note=txt(r.get("AB"))))
for r in rows("Energy Weapons", 4, "E"):
    n = name_of("Energy Weapons", r["E"], seen)
    if not n:
        continue
    ammo = txt(r.get("H"))
    weapons.append(dict(n=n, tab="EW", skill="EW", tier=num(r.get("B"), 0), type=txt(r.get("F")).replace("Plama", "Plasma"), group=txt(r.get("G")), ammo=RESERVE.get(ammo, ammo), auto=r.get("I") is True, status=txt(r.get("J")), dmg=num(r.get("K")), pen=num(r.get("L")), perShot=num(r.get("M"), 1),
                        mag=num(r.get("N")), reload=num(r.get("O")), ap=num(r.get("P")), count=num(r.get("Q")), crit=num(r.get("R")), jam=num(r.get("S")), str=num(r.get("T"), 0), req=num(r.get("U")), hit=hits(r, "W"), lb=num(r.get("C"), 0), val=num(r.get("D")), note=txt(r.get("AG"))))
for r in rows("Explosives", 4, "E"):
    n = name_of("Explosives", r["E"], seen)
    if not n:
        continue
    t = txt(r.get("F"))
    ammo = txt(r.get("G"))
    weapons.append(dict(n=n, tab="EX", skill="EXP", tier=num(r.get("B"), 0), type=t, ammo=AMMO_ALIAS.get(ammo.lower(), ammo), mag=num(r.get("I")), reload=num(r.get("J")), ap=num(r.get("K")), count=num(r.get("L")), crit=num(r.get("M")), jam=num(r.get("N")), str=num(r.get("O"), 0), req=num(r.get("P")),
                        dmg=num(r.get("R")), pen=num(r.get("S")), radius=num(r.get("T")), fuze=num(r.get("U")), thrown=t in ("Grenade", "Mine/Trap"), hit=hits(r, "W"), lb=num(r.get("C"), 0), val=num(r.get("D")), note=txt(r.get("AG"))))
for r in rows("Melee Weapons", 2, "E"):
    n = name_of("Melee Weapons", r["E"], seen)
    if not n:
        continue
    weapons.append(dict(n=n, tab="MW", skill="MW", tier=num(r.get("B"), 0), type=txt(r.get("F")), prName=txt(r.get("H")), seName=txt(r.get("I")), crit=num(r.get("J")), jam=num(r.get("K")), str=num(r.get("L"), 0), req=num(r.get("M")),
                        dmg=num(r.get("O")), ap=num(r.get("P")), base=num(r.get("Q")), pen=num(r.get("R"), 0), dmg2=num(r.get("S")), ap2=num(r.get("T")), pen2=num(r.get("V"), 0), status=txt(r.get("W")), dotCh=txt(r.get("X")), lb=num(r.get("C"), 0), val=num(r.get("D")), note=txt(r.get("Y"))))
for w in weapons:
    need = ("dmg", "ap") if w["tab"] == "MW" else (("dmg", "pen", "ap", "crit", "jam", "req") if w["tab"] in ("EW", "EX") else ("ap", "crit", "jam", "req", "count"))
    w["ok"] = all(w.get(k) is not None for k in need) and (w["tab"] == "MW" or w["hit"][0] is not None)
weapons = [{k: v for k, v in w.items() if v not in (None, "", False)} for w in weapons]

ammo = []
for r in rows("Ammo", 2, "B"):
    n = name_of("Ammo", r["B"], seen)
    if not n:
        continue
    raw = r.get("E")
    cal = txt(r.get("C"))
    if cal in CAL_FIX:  # a caliber typed short in the workbook: file it under the real one
        n = n.replace(cal, CAL_FIX[cal], 1); cal = CAL_FIX[cal]
    a = dict(n=n, cal=cal, load=txt(r.get("D")), dam=num(raw), pen=num(r.get("F")), tier=num(r.get("G"), 1), lb=num(r.get("H"), 0), cls=txt(r.get("K")), note=txt(r.get("L")))
    if isinstance(raw, str) and "x" in raw.lower():  # "2x10" = 2 damage x 10 pellets
        a["dam"], a["pellets"] = [float(x) for x in raw.lower().split("x")[:2]]
    a["ok"] = a["dam"] is not None and a["pen"] is not None
    ammo.append({k: v for k, v in a.items() if v not in (None, "", False)})
cals = {a["cal"].lower() for a in ammo}
mats_seen = {txt(r["E"]).lower() for r in rows("Materials", 2, "E")}
for w in weapons:
    a = w.get("ammo", "")
    if w["tab"] in ("SG", "BG", "EX", "EW") and a and a != "N/A" and a.lower() not in cals and a.lower() not in mats_seen:
        issues["Weapon ammo with no matching ammo or material"].append(f"{w['n']}: {a}")

armor = []
realgear = lambda v: "" if (txt(v) or "").lower().startswith("(no ") else txt(v)
for r in rows("Armor", 2, "E"):
    n = name_of("Armor", r["E"], seen)
    if n:
        armor.append({k: v for k, v in dict(n=n, tier=num(r.get("B"), 0), lb=num(r.get("C"), 0), val=num(r.get("D")), type=txt(r.get("F")), loc=txt(r.get("G")), dt=num(r.get("I"), 0), buffs=txt(r.get("K")), nerfs=txt(r.get("L")), mech=txt(r.get("M")), faction=txt(r.get("N")), formal=num(r.get("O")), note=txt(r.get("P"))).items() if v not in (None, "")})
items = []
for r in rows("Items", 2, "E"):
    n = name_of("Items", r["E"], seen)
    if n:
        items.append({k: v for k, v in dict(n=n, tier=txt(r.get("B")), lb=num(r.get("C"), 0), val=num(r.get("D")), cat=txt(r.get("F")), req=txt(r.get("G")), ap=num(r.get("H")), uses=num(r.get("I")), effect=txt(r.get("J")), dur=num(r.get("M")), after=txt(r.get("N")), trigger=txt(r.get("P")), addict=num(r.get("R")), withdrawal=txt(r.get("S"))).items() if v not in (None, "")})
mats = []
for r in rows("Materials", 2, "E"):
    n = name_of("Materials", r["E"], seen)
    if n:
        mats.append({k: v for k, v in dict(n=n, tier=txt(r.get("B")), lb=num(r.get("C"), 0), val=num(r.get("D")), cat=txt(r.get("F")), note=txt(r.get("G"))).items() if v not in (None, "")})
mods = [{k: v for k, v in dict(n=txt(r["E"]), tier=num(r.get("B")), skill=txt(r.get("F")), group=txt(r.get("I")), loc=txt(r.get("J")), effect=txt(r.get("K")), applies=txt(r.get("L")), lb=num(r.get("C"), 0)).items() if v not in (None, "")} for r in rows("Weapon Mods", 2, "E")]
recipes = []
for r in rows("Crafting Recipes", 2, "B"):
    m = [[txt(r[a]), num(r.get(b))] for a, b in (("F", "H"), ("I", "K"), ("L", "N"), ("O", "Q"), ("R", "T")) if a in r]
    recipes.append(dict(n=txt(r["B"]), type=txt(r.get("A")), station=txt(r.get("C")), req=txt(r.get("D")), mats=m))

armor = [a for a in armor if not a["n"].lower().startswith("(no ")]  # "(NO HEADGEAR)" and friends are empty-slot markers, not items
names = {x["n"].lower() for x in weapons + armor}
SK = dict(BAR="R", EW="S", EXP="T", SG="U", BG="V", LPK="W", MED="X", MW="Y", REP="Z", SCI="AA", SNK="AB", SPE="AC", SUR="AD")
enemies = []
for r in rows("Enemies", 2, "E"):
    mob = r.get("D") == "Mob"
    e = dict(n=txt(r["E"]), tier=num(r.get("B"), 1), mob=mob, test=r.get("C") == "TEST", xp=num(r.get("F"), 0), caps=txt(r.get("G")), faction=txt(r.get("H")), special=[num(r.get(k)) for k in "JKLMNOP"], skills={k: num(r.get(c)) for k, c in SK.items() if num(r.get(c)) is not None},
             head=realgear(r.get("AF")), armor=realgear(r.get("AG")), vanity=realgear(r.get("AH")), w1=txt(r.get("AJ")), w2=txt(r.get("AK")))
    if mob:
        e.update(hp=num(r.get("AM")), dt=num(r.get("AN"), 0), ap=num(r.get("AO")), pri=num(r.get("AQ"), 0))
    for f in ("w1", "w2", "head", "armor", "vanity"):
        if e[f] and e[f].lower() not in names:
            issues["Enemy gear that does not exist"].append(f"{e['n']}: {e[f]}")
    enemies.append({k: v for k, v in e.items() if v not in (None, "", False)})

traits = [{k: v for k, v in dict(code=txt(r.get("B")), cat=txt(r.get("C")), n=txt(r["D"]), desc=txt(r.get("E")), ben=txt(r.get("F")), draw=txt(r.get("G")), evo=txt(r.get("I")), evoDesc=txt(r.get("J")), evoBonus=txt(r.get("K")), evoTrig=txt(r.get("L")), fail=txt(r.get("M")), rep=txt(r.get("O")), repDesc=txt(r.get("P")), repBonus=txt(r.get("Q"))).items() if v} for r in rows("Traits", 2, "D")]

skillperks, group = [], ""
for r in wb["Skill Perks"].iter_rows(min_row=3, max_row=115, min_col=2, max_col=8, values_only=True):
    group = txt(r[0]) or group
    for rank, nm, ef, need in (("Proficiency", r[1], r[2], 60), ("Expertise", r[3], r[4], 80), ("Mastery", r[5], r[6], 100)):
        if nm and not str(nm).startswith("^"):
            skillperks.append(dict(n=txt(nm), group=group, rank=rank, need=need, effect=txt(ef)))
levelperks = [dict(n=txt(r["D"]), level=txt(r.get("B")), group=txt(r.get("C")), effect=txt(r.get("E")), req=txt(r.get("F"))) for r in rows("Level Perks", 2, "D")]
statuses = [{k: v for k, v in dict(n=txt(r["D"]), mp=txt(r.get("C")), tone=txt(r.get("E")), src=txt(r.get("F")), desc=txt(r.get("G")), tiers=[txt(r.get(c)) for c in "JKLMN"], counters=txt(r.get("O")), note=txt(r.get("P"))).items() if v} for r in rows("Status Effects", 2, "D")]

# Stat Converter: same live columns the sheet reads; everything else stays a reminder.
scws = wb["Stat Converter"]
head = {c.column_letter: c.value for c in scws[1] if c.value}
LIVE = {"M": "S", "N": "P", "O": "E", "P": "C", "Q": "I", "R": "A", "S": "L", **{c: k for k, c in dict(BAR="U", EW="V", EXP="W", SG="X", BG="Y", LPK="Z", MED="AA", MW="AB", REP="AC", SCI="AD", SNK="AE", SPE="AF", SUR="AG").items()},
        "AI": "hpMul", "AJ": "hp", "AK": "dt", "AL": "ap", "AM": "apMul", "AN": "carry", "AO": "carryMul", "AP": "pri", "AQ": "save", "AR": "pts", "AT": "acc", "AU": "r1", "AV": "r2", "AW": "r3", "AX": "r4", "AY": "r5", "AZ": "r6", "BA": "r7", "BB": "r8", "BC": "r9", "BD": "r10", "BE": "enemyAcc", "BG": "dam", "BH": "crit", "BK": "apCost", "BM": "reload", "BO": "pen"}
FIRST_TYPE = ci("CM")
sc = []
for r in rows("Stat Converter", 6, "F"):
    m, off = {}, []
    for col, v in r.items():
        if col not in head or ci(col) < ci("M") or v in (0, False):
            continue
        if col in LIVE and isinstance(v, (int, float)):
            m[LIVE[col]] = v
        elif ci(col) < FIRST_TYPE:
            off.append(f"{head[col]} {v}")
    only = [head[c] for c in r if c in head and ci(c) >= FIRST_TYPE and r[c] not in (0, False)]
    note = "; ".join(x for x in (txt(r.get("I")), ", ".join(off) and "Not automated: " + ", ".join(off), only and "Meant only for: " + ", ".join(only)) if x)
    sc.append({k: v for k, v in dict(n=txt(r["F"]), cat=txt(r.get("G")), sub=txt(r.get("H")), mods=m, note=note).items() if v})

# Starting party, from the live sheet
ps, sh, cs, invws = wb["Player Sheets"], wb["START HERE"], wb["Combat Sheet"], wb["Inventory"]
party = []
SKILL_ORDER = ["BAR", "EW", "EXP", "SG", "BG", "LPK", "MED", "MW", "REP", "SCI", "SNK", "SPE", "SUR"]
inv_blocks, cur = {}, None
for r in invws.iter_rows(min_row=2, values_only=True):
    if r[1] and r[2] is None and isinstance(r[3], (int, float)) and not isinstance(r[3], bool):  # a character's header row
        cur = txt(r[1]); inv_blocks[cur] = []
    elif cur and r[1] and r[2] and "(NO " not in str(r[1]) and txt(r[1]) != "Money":
        inv_blocks[cur].append(dict(n=txt(r[1]), q=r[2], active=r[3] is True))
fixtures = dict(players=[], source=os.path.basename(xlsx))
for i, (sr, pr) in enumerate(((2, 2), (3, 34), (4, 66), (5, 98))):
    off = i * 10
    cell = lambda col, row: cs.cell(row=row, column=ci(col) + off).value
    nm = txt(sh[f"A{sr}"].value)
    gear = dict(head=txt(ps[f"AB{pr}"].value), armor=txt(ps[f"AC{pr}"].value), vanity=txt(ps[f"AD{pr}"].value), acc=[txt(ps[f"{c}{pr}"].value) for c in ("AE", "AF", "AG")])
    w1, w2 = txt(cell("I", 17)), txt(cell("I", 25))
    gun_names = {w1, w2}
    # the load cell moved between blocks; take the first text that names an ammo row
    known = {a["n"] for a in ammo}
    load1 = next((txt(cs.cell(row=18, column=ci("I") + off + j).value) for j in range(10) if txt(cs.cell(row=18, column=ci("I") + off + j).value) in known), "")
    if next((w for w in weapons if w["n"] == w1), {}).get("tab") not in ("SG", "BG"):
        load1 = ""  # energy and melee weapons ignore the sheet's leftover ammo cell
    c = dict(id=f"c{i+1}", kind="pc", name=nm, background="", spec="", special=[sh[f"{x}{sr}"].value for x in "DEFGHIJ"], tags=[k for k, col in zip(SKILL_ORDER, "L M N O P Q R S T U V W X".split()) if sh[f"{col}{sr}"].value is True],
             traits=[txt(ps[f"{c_}{pr}"].value) for c_ in ("AQ", "AS", "AU")], level=1, xp=0, caps=num(ps[f"D{pr}"].value, 0), gear=gear,
             weapons=[dict(n=w1, ammo=load1), dict(n=w2)], inv=[x for x in inv_blocks.get(nm, []) if x["n"] not in gun_names and x["n"] not in gear.values()], perks=[], spent={}, variants=[])
    party.append(c)
    fixtures["players"].append(dict(
        name=nm, effective=[ps[f"{x}{pr}"].value for x in "FGHIJKL"], skills={k: ps[f"{col}{pr}"].value for k, col in zip(SKILL_ORDER, "N O P Q R S T U V W X Y Z".split())},
        hp=ps[f"AI{pr}"].value, dt=ps[f"AJ{pr}"].value, ap=ps[f"AK{pr}"].value, carry=ps[f"AL{pr}"].value, pri=ps[f"AM{pr}"].value, save=ps[f"AN{pr}"].value, pts=ps[f"AO{pr}"].value,
        w1=w1, w2=w2, load=load1, hit1=[cell(gl_, 24) for gl_ in "I J K L M N O P Q R".split()], hit2=[cell(gl_, 32) for gl_ in "I J K L M N O P Q R".split()],
        range=cell("M", 14), critAt=cell("I", 6), hitAt=cell("K", 6), failAt=cell("O", 6), cond=cell("I", 22), finalDmg=cell("M", 9)))
xp_by = {}
xw = wb["XP Count"]
for r in xw.iter_rows(min_row=2, values_only=True):
    if r[0] and r[0] != "CHECKS":
        xp_by[txt(r[0])] = num(r[2], 0)
for c in party:
    c["xp"] = xp_by.get(c["name"], 0)

# The reviewed enemy list replaces the workbook's: same enemies with factions, plus the New Vegas additions. Edit src/enemies.json to change it.
_enemies_file = os.path.join(HERE, "src", "enemies.json")
if os.path.exists(_enemies_file):
    enemies = json.load(open(_enemies_file, encoding="utf8"))
data = dict(weapons=weapons, ammo=ammo, armor=armor, items=items, materials=mats, mods=mods, recipes=recipes, enemies=enemies, traits=traits, skillPerks=skillperks, levelPerks=levelperks, statuses=statuses, sc=sc, party=party,
            loot=[r for r in [[num(a), num(b)] for a, b in ((wb["Roadmap"][f"J{i}"].value, wb["Roadmap"][f"K{i}"].value) for i in range(13, 33))]],
            builtFrom=os.path.basename(xlsx), builtAt=datetime.date.today().isoformat())

os.makedirs(os.path.join(HERE, "tests"), exist_ok=True)
json.dump(fixtures, open(os.path.join(HERE, "tests", "fixtures.json"), "w", encoding="utf8"), indent=1)
json.dump(data, open(os.path.join(HERE, "tests", "data.json"), "w", encoding="utf8"), ensure_ascii=False)

# Review list: automate / reminder / ignore
sc_by = defaultdict(list)
for r in sc:
    sc_by[r["n"].lower()].append(r)
def classify(name):
    hits_ = sc_by.get(name.lower(), []) + [r for k, v in sc_by.items() if k.startswith(name.lower() + " (") for r in v]
    a = any(r.get("mods") for r in hits_)
    n_ = any(r.get("note") for r in hits_)
    return "Automate + reminder" if a and n_ else "Automate" if a else "Reminder"
rep = ["# DM app data report", "", f"Built from `{os.path.basename(xlsx)}` on {data['builtAt']}.", "",
       f"Weapons {len(weapons)} ({sum(1 for w in weapons if w.get('ok'))} with full stats), ammo {len(ammo)}, armor {len(armor)}, items {len(items)}, materials {len(mats)}, mods {len(mods)}, recipes {len(recipes)}, enemies {len(enemies)}, traits {len(traits)}, skill perks {len(skillperks)}, level perks {len(levelperks)}, statuses {len(statuses)}.", "",
       "## Name and link problems", ""]
for k, v in issues.items():
    rep += [f"### {k} ({len(v)})", ""] + [f"- {x}" for x in v] + [""]
rep += ["## Automate, reminder or ignore (for review)", "", "Automate = changes numbers through the Stat Converter's live columns. Reminder = shown to the DM, who applies it. Weapon-type limits on modifiers are not enforced, matching the sheet.", ""]
for title, lst in (("Traits", [t["n"] for t in traits]), ("Trait evolutions", [t["evo"] for t in traits if t.get("evo")]), ("Skill perks", [p["n"] for p in skillperks]), ("Level perks", [p["n"] for p in levelperks])):
    groups = defaultdict(list)
    for n in lst:
        groups[classify(n)].append(n)
    rep += [f"### {title}", ""] + [f"- **{k} ({len(v)}):** {', '.join(v)}" for k, v in sorted(groups.items())] + [""]
rep += ["### Statuses", "", "Tier text is parsed for numbers (AP, DT, SPECIAL, hit chance, initiative, damage per round). Anything else is shown as a reminder.", "", "- **Ignore (no tier text):** " + ", ".join(s["n"] for s in statuses if not any(s.get("tiers", []))), ""]
open(os.path.join(HERE, "data_report.md"), "w", encoding="utf8").write("\n".join(rep))

# The bible's text by chapter (and each chapter's change pages), compressed, so Search can find words inside the rules.
def bible_index():
    p = os.path.join(ROOT, "Fallout TTRPG Game Bible.pdf")
    try:
        import fitz, zlib
    except ImportError:
        return ""
    if not os.path.exists(p):
        return ""
    d = fitz.open(p)
    toc = sorted([(pg, lvl, t) for lvl, t, pg in d.get_toc() if lvl in (2, 3)])
    out, parent = [], ""
    for i, (pg, lvl, t) in enumerate(toc):
        end = toc[i + 1][0] - 1 if i + 1 < len(toc) else d.page_count
        if lvl == 2:
            parent = t
        name = t if lvl == 2 else f"{parent}: changes"
        text = " ".join(d[j].get_text("text") for j in range(pg - 1, max(pg, end)))
        text = re.sub(r"Fallout Homebrew TTRPG · Game Bible", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        out.append([name, d[pg - 1].get_label() or str(pg), text])
    z = zlib.compressobj(9, zlib.DEFLATED, -15)  # raw deflate: the app's own unzip reads it
    raw = z.compress(json.dumps(out, ensure_ascii=False).encode("utf8")) + z.flush()
    return base64.b64encode(raw).decode("ascii")

# Inline everything into one file
src = lambda f: open(os.path.join(HERE, "src", f), encoding="utf8").read()
b64 = lambda p: base64.b64encode(open(p, "rb").read()).decode("ascii") if os.path.exists(p) else ""
data["report"] = "\n".join(rep)
if os.path.exists(os.path.join(HERE, "src", "shell.html")):
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").replace("<!--", "<\\u0021--")
    html = src("shell.html").replace("/*STYLE*/", src("style.css")).replace("/*FONT*/", b64(os.path.join(HERE, "src", "fonts", "vt323.woff2"))).replace("/*FONT2*/", b64(os.path.join(HERE, "src", "fonts", "sharetech.woff2")))
    html = html.replace("/*RULES*/", src("combat_text.js") + "\n" + src("rules.js")).replace("/*ENGINE*/", src("engine.js")).replace("/*UI*/", src("icons.js") + "\n" + src("ui.js"))
    html = html.replace("/*DATA*/", blob)
    html = html.replace('"/*BIBLETXT*/"', json.dumps(bible_index()))  # the bible's text, for Search
    hosted = html.replace("/*WIKI*/", "")  # the hosted page opens the PDF that sits beside it, so it doesn't carry a copy
    html = html.replace("/*WIKI*/", b64(os.path.join(ROOT, "Fallout TTRPG Game Bible.pdf")))
    out = os.path.join(ROOT, "Fallout DM App.html")
    open(out, "w", encoding="utf8").write(html)
    print("wrote", out, round(len(html) / 1e6, 2), "MB")
    # index.html is the same app, but it opens on a fresh campaign. This is the copy GitHub Pages serves.
    assert "/*FRESH*/false" in hosted
    open(os.path.join(ROOT, "index.html"), "w", encoding="utf8").write(hosted.replace("/*FRESH*/false", "true"))
print("weapons", len(weapons), "with stats", sum(1 for w in weapons if w.get("ok")), "issues", {k: len(v) for k, v in issues.items()})
