# Fallout DM App

A campaign manager for the DM of a homebrew Fallout tabletop game. It runs in one HTML file with nothing to install. Keeping the unfun complexity in this and streamlining the DM experience: map and range bands, cover, hit chance, damage, AP, ammo, status effects, XP, level-ups, loot and vendors.

This is a fan project and isn't affiliated with Bethesda or Obsidian.

## Use it

- **In your browser:** open the [live app](https://theprinceofmilk.github.io/fallout-dm-app/). It starts a fresh campaign with the character creator.
- **Offline:** [download everything as a zip](https://github.com/ThePrinceOfMilk/fallout-dm-app/archive/refs/heads/main.zip), unzip it and double-click `index.html`, or `Fallout DM App.html` to start with the sample party.

Your campaign autosaves in that browser. To keep a copy or move it, use **Load > Save pack**, which makes a `.zip`.

## What's here

| Path | What it is |
|---|---|
| [index.html](index.html) | The app, starting on a fresh campaign |
| [Fallout DM App.html](Fallout%20DM%20App.html) | The same app, starting with the sample party |
| [Fallout TTRPG Game Bible.pdf](Fallout%20TTRPG%20Game%20Bible.pdf) | The rules. The app's Wiki button opens this |
| [Fallout Spreadsheet(4).xlsx](Fallout%20Spreadsheet(4).xlsx) | The source workbook, with people's names and four old tabs removed |
| [data/](data/) | Every table as CSV and JSON, plus [rules.json](data/rules.json) and [variables.json](data/variables.json) |
| [Fallout Enemies (for review).pdf](Fallout%20Enemies%20(for%20review).pdf) | All enemies by faction |
| [Skipped and Unsure.md](Skipped%20and%20Unsure.md) | Effects that still need a DM's judgment |
| [app/](app/) | Source code, build scripts and tests |

## Editing the data

The app carries its data inside the HTML, so it works offline. The files in [data/](data/) are copies for reading and editing.

- **One table:** open its window in the app, then use Export CSV, Export JSON or Import at the top.
- **A whole campaign:** use **Save pack**, edit the CSV files inside the `.zip`, and use **Load pack**. Keep it a `.zip`, since browsers can't open `.rar`.

## Rebuilding

All paths are relative to the project folder. You need Python with `openpyxl`, `reportlab` and `pypdf`, and Node.

```bash
cd app
npm install
python build.py
node dump_wiki.js
python make_wiki.py
python build.py
node export_data.js
node --test tests/engine.test.js
node tests/e2e.js
```

`build.py` writes both HTML files. Run it again after `make_wiki.py` so the new Wiki gets embedded.
