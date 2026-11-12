#!/usr/bin/env python
"""Rebuild the DM app.

    python app/build.py                          # from the workbook beside the app folder if there is one, else the saved data
    python app/build.py "path/to/workbook.xlsx"  # read this workbook in first
    python app/build.py --no-workbook            # from the saved game data only (app/tests/data.json)

With a workbook, read_workbook.py turns it into app/tests/data.json, app/tests/fixtures.json and app/data_report.md
(that needs openpyxl). Either way the game data and src/* are inlined into "Fallout DM App.html" and index.html.
"""
import base64, datetime, glob, json, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SKIP = {"(DO NOT LOOK) FIRST Q", "Mobs (OLD)", "(deprecated)Armor", "(deprecated) DAMAGE CALCULATOR"}
# The workbook is optional. Given one (or with one beside the app folder), it is read into the game data first;
# with none (or with --no-workbook) the app is built from the game data already saved in tests/data.json.
args = [a for a in sys.argv[1:] if a != "--no-workbook"]
books = [] if "--no-workbook" in sys.argv else sorted(glob.glob(os.path.join(ROOT, "Fallout*Spreadsheet*.xlsx")))
xlsx = args[0] if args else (books[-1] if books else None)
if xlsx:
    import runpy
    g = runpy.run_path(os.path.join(HERE, "read_workbook.py"), init_globals=dict(xlsx=xlsx, HERE=HERE, ROOT=ROOT, SKIP=SKIP))
    data, rep, weapons, issues = g["data"], g["rep"], g["weapons"], g["issues"]
else:
    data = json.load(open(os.path.join(HERE, "tests", "data.json"), encoding="utf8"))
    # the reviewed enemy list is edited in src/enemies.json, so a change there counts even with no workbook
    _enemies_file = os.path.join(HERE, "src", "enemies.json")
    if os.path.exists(_enemies_file):
        data["enemies"] = json.load(open(_enemies_file, encoding="utf8"))
        json.dump(data, open(os.path.join(HERE, "tests", "data.json"), "w", encoding="utf8"), ensure_ascii=False)
    _rp = os.path.join(HERE, "data_report.md")
    rep = open(_rp, encoding="utf8").read().split("\n") if os.path.exists(_rp) else ["# DM app data report", "", "Built from the saved game data (no workbook)."]
    weapons, issues = data["weapons"], {}
    print("no workbook: building from tests/data.json (built from " + str(data.get("builtFrom", "?")) + ")")

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
# The UI is split by topic into src/ui/NN-name.js; they run as one script, joined in file-name order.
ui_src = lambda: "".join(src(os.path.join("ui", f)) for f in sorted(os.listdir(os.path.join(HERE, "src", "ui"))) if f.endswith(".js"))
b64 = lambda p: base64.b64encode(open(p, "rb").read()).decode("ascii") if os.path.exists(p) else ""
data["report"] = "\n".join(rep)
if os.path.exists(os.path.join(HERE, "src", "shell.html")):
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/").replace("<!--", "<\\u0021--")
    html = src("shell.html").replace("/*STYLE*/", src("style.css")).replace("/*FONT*/", b64(os.path.join(HERE, "src", "fonts", "vt323.woff2"))).replace("/*FONT2*/", b64(os.path.join(HERE, "src", "fonts", "sharetech.woff2")))
    html = html.replace("/*RULES*/", src("combat_text.js") + "\n" + src("rules.js")).replace("/*ENGINE*/", src("engine.js")).replace("/*UI*/", src("icons.js") + "\n" + ui_src())
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
print("weapons", len(weapons), "with stats", sum(1 for w in weapons if w.get("ok")), "issues", {k: len(v) for k, v in issues.items()} if issues else "(not checked without a workbook)")
