# Real-Estate Modeling Engine (Phase 1)

A small, dependency-free web app that projects a real-estate portfolio — market
value, equity, cash flow, NOI, return on equity, and the tax on a modeled sale
(capital gain vs depreciation recapture, §121, and state tax by residency) — with
numeric tables and inline-SVG charts. Everything runs in your browser; nothing is
uploaded.

**This repository is public. It contains only code and clearly-labelled FICTIONAL
demo data — no real financial information.** Enter your own figures in the app and
keep them in JSON files on your own device; never commit real data here.

## Live site

Enable once: **Settings → Pages → Build and deployment → Source: _Deploy from a
branch_ → Branch `main`, Folder `/ (root)` → Save.** Then open the URL it shows.

## Run / edit

No build step — plain HTML, CSS, and vanilla JavaScript. Open `index.html` in a
browser, or use the Pages URL. Tax rates/thresholds live in one dated, sourced
params file; the calculation engine is headless (no page references) so it could be
swapped for a backend later; federal tax on a sale is **PROVISIONAL** this phase
(top long-term rate + NIIT assumed) and isolated behind a small tax interface.

## Your data stays yours

- The app opens with fictional demo data (properties named "… — DEMO").
- Enter your figures in the UI, then **Save scenario** to download a JSON file you
  keep on your device. **Load scenario** brings it back. The app uses no browser
  storage, so that file is your only saved copy — and it must never be committed to
  this public repo.

## Contributing / continuing development

See **`HANDOFF.md`** for the full architecture, the design rules (no magic numbers,
headless engine, provisional federal tax, demo-data-only), and the current backlog.

## Not tax advice

A planning tool with approximate figures. Confirm anything important with a
qualified professional before acting on it.
