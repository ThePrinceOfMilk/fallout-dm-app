# Fallout DM App

**DISCLOSURE: I made the UI and HTML with Claude Code, but all the elements with balancing, content and mechanics, are by myself and my friend's hands.**

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
| [data/](data/) | Every table as CSV and JSON, plus [rules.json](data/rules.json) and [variables.json](data/variables.json) |
| [Balance Report.html](Balance%20Report.html), [Balance Options.html](Balance%20Options.html) | Simulated fights used to tune the numbers |
| [app/](app/) | Source code, build scripts and tests (see "Code layout" below) |

## Shared table
Click **Open session** in the top bar on any device. A link appears; send it to whoever should join. Anyone who opens it gets the same DM screen, from any network, and changes show on every device within a second. The game is kept online (on a free Cloudflare relay, `app/relay/`) for 14 days after the last change, so the host's device can sleep or close. **Leave session** stops syncing on that device.
The link holds a secret token: anyone with it can edit your game, so only share it with your table.

No internet? `cd app && node table_server.js` serves the app to devices on the same Wi-Fi and prints their link. The first time, allow Node on **Private networks** when Windows Firewall asks.

Relay setup (once, already done for the hosted copy): `cd app/relay && npx wrangler deploy`, then put the printed address in `RELAY` in `app/src/ui/12-boot.js`.

## Editing the data

The app carries its data inside the HTML, so it works offline. The files in [data/](data/) are copies for reading and editing.

- **One table:** open its window in the app, then use Export CSV, Export JSON or Import at the top.
- **A whole campaign:** use **Save pack**, edit the CSV files inside the `.zip`, and use **Load pack**. Keep it a `.zip`, since browsers can't open `.rar`.

## Rebuilding

All paths are relative to the project folder. You need Python with `reportlab`, `pypdf` and `pymupdf`, and Node.

The app doesn't need the original Excel workbook: all its data is saved in `app/tests/data.json` (with the reviewed enemy list in `app/src/enemies.json`), and `build.py` builds from that. If a newer workbook is put beside the `app` folder, `build.py` reads it in first (that needs `openpyxl`); `python build.py --no-workbook` ignores it.

```bash
cd app
npm install
npm run bible        # rebuilds the bible, then builds both HTML files with it embedded
node export_data.js  # refreshes data/
npm test             # every offline test suite: engine, browser, pinch and touch, shared table, spectators
```

`npm run build` alone rebuilds the HTML after a code change. `npm run format` tidies the source with Prettier. `npm run test:online` adds the two suites that need the live relay. The browser tests use Edge or Chrome; the iPad and iPhone checks also need WebKit (`npx playwright install webkit`), and `E2E_BROWSER=webkit node tests/e2e.js` runs the browser tests in it.

## Code layout

Everything in `app/src/` is inlined into one HTML file by `app/build.py`.

| File | What it holds |
|---|---|
| `rules.js` | Every rule number (`DEFAULT_RULES`), the Settings editor's list (`RULE_SCHEMA`), and rule tables for statuses, traits, perks and implants |
| `engine.js` | The game math, with no screen code: hit chance, damage, AP, derived stats, effect parsing. Tested by `tests/engine.test.js` |
| `combat_text.js` | The combat log's wording |
| `icons.js` | Weapon and item icons |
| `ui/01-state.js` … `ui/12-boot.js` | The screen, split by topic. They run as one script in file-name order. Each file starts with a note on what it holds |
| `style.css`, `shell.html` | Styles (phone and tablet rules are in the `max-width` blocks) and the page around the app |

To add a button: give it `data-a="name" data-v="value"` in the HTML and add `ACT.name` in `ui/09-actions.js`. Wrap changes to the game state in `act(label, fn)` so Undo covers them. To add a rule number: put it in `DEFAULT_RULES` and a line in `RULE_SCHEMA` in `rules.js`, and it shows in Settings.
