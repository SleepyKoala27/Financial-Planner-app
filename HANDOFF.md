# HANDOFF — Real-Estate Modeling Engine (Phase 1)

> **Purpose:** This file lets a fresh Claude Code session (created on this repo,
> `SleepyKoala27/Financial-Planner-app`) continue the project with full context.
> Read it end-to-end before making changes. It contains **no real financial
> figures** — this repo is public and must stay that way.

---

## 1. What this is

A dependency-free, single-page web app that projects a real-estate portfolio over a
configurable horizon — market value, equity, NOI, cash flow, return on equity, and
the tax on a modeled sale (capital gain vs depreciation recapture, §121, state tax
by residency/source). It runs entirely in the browser; nothing is uploaded.

- **Live site:** GitHub Pages on this repo (`main` / root → `index.html`).
- It is **Phase 1** of a larger plan. Later phases (a full multi-layer federal tax
  engine, Roth-conversion optimizer, survivor/estate, stochastic layer) are
  specified in a **private** repo and are out of scope here.

## 2. Non-negotiable rules

1. **This repo is PUBLIC. Only code + clearly-labelled FICTIONAL demo data.** Never
   commit real names, figures, or identifying details. The current demo data lives
   in `userInputs.js` (`makeDefaultScenario`) and every property is named "… — DEMO".
2. **No magic numbers.** Every value that could change lives in a named, documented
   parameter. Tax-law values live in a **dated, sourced** params file
   (`taxParams2026.js`), each with a source + effective date. Copy the file to a new
   year to update law. **Verify every rate/threshold against current law at build
   time — do not trust figures in this doc from memory.**
3. **The engine is headless.** `realEstateEngine.js` takes data in, returns results
   out, and never touches the DOM. Only `app.js` touches the page. This keeps a
   Python backend swap possible later.
4. **Federal tax is PROVISIONAL** and isolated behind `taxInterface.js` (a stub
   assuming the top LT rate + NIIT). Keep it behind that interface so Phase 2 can
   replace it without rewriting sale logic. The UI shows a "PROVISIONAL" badge.
5. **Computed values are always derived, never user-editable** (adjusted basis, NOI,
   equity, gain). Only inputs are editable.

## 3. Current repo state & how to restore the multi-file structure

Right now the repo contains a **single inlined `index.html`** (all CSS + JS in one
file) because it had to be uploaded manually. **First task in the new session:
split it back into the proper multi-file structure** so it's maintainable.

The inlined `index.html` is self-describing:
- The CSS sits between `<style> … </style>`.
- Each original JS file is delimited by a comment marker:
  `/* ===== js/params/taxParams2026.js ===== */` … etc., in dependency order.

**Restore procedure:** extract the `<style>` block to `css/styles.css`; split the
single `<script>` block on the `/* ===== path ===== */` markers back into the files
below; rewrite `index.html` to load them with `<script src>` tags in the same order;
verify with `node --check` on each file and by running the engine under a `window`
shim in Node. Then commit and push (Pages redeploys automatically).

## 4. Intended file map (after restore)

```
index.html                 loads scripts in dependency order; app.js last
css/styles.css             all styling (tablet-friendly)
js/
├── params/
│   ├── taxParams2026.js     tax law — rates/thresholds, dated + sourced
│   └── structuralFacts.js   filing status, birth years (demo)
├── inputs/
│   ├── fieldSchema.js       editable-field definitions (labels/units/tiers)
│   └── userInputs.js        default scenario + DEMO properties
├── engine/
│   ├── taxInterface.js      provisional federal tax stub
│   └── realEstateEngine.js  ALL math — headless
└── ui/
    ├── format.js            number → text
    ├── charts.js            inline-SVG line charts (no libraries)
    ├── tables.js            HTML tables
    └── app.js               the only DOM code
```

Global namespace is `window.FP`; scripts load in the order above; `app.js` inits on
`DOMContentLoaded`. No ES modules, no bundler, no external libraries/CDN — plain
`<script>` tags only (must run as static files on GitHub Pages).

## 5. Data model (current schema — keep consistent across engine, schema, sample data, template, importer)

**Scenario:** `startYear`, `horizonYears`, `assumptions{revenueGrowthRate,
expenseGrowthRate, benchmarkMortgageRate}`, `defaultResidency`, `residencyByYear[]`
(per-year 'WA'/'CA'/custom), `customStates[]` ({code,name,rate}), `taxParamsVersion`,
`properties[]`.

**Per property — Tier 1 (basis/tax):** purchasePrice, purchaseDate, **landAllocation
(dollars)**, capitalImprovements, accumulatedDepreciation, annualDepreciationRate,
placedInServiceDate, suspendedPassiveLosses, conversionYear ('hold' or year),
fmvAtConversion, prop13AssessedValue, ownershipEntity, entityStockBasis.
**Tier 2 (operating):** grossRentalRevenue, marketValue, assessedValue, propertyTax,
insurance, hoa, ownerPaidUtilities, managementFees, housekeepingTurnover,
routineMaintenance, capitalReserve, capitalReservePctOfValue, vacancyAllowancePct,
nonResidentFilingCost, mortgageBalance, mortgageRate, mortgageTermYears,
mortgageOriginationDate, seasonal{enabled, peakNightlyRate, peakMonths,
offSeasonNightlyRate, occupancyPct}.
**Tier 3 (disposition):** holdIndefinitely, appreciationRate, sellingCostsPct,
plannedSaleYear ('hold' or year), section121Eligible.

**Derived (never editable):** adjustedCostBasis = purchase + improvements −
accumulatedDepreciation; NOI = effectiveRevenue − opex (before debt service);
cashFlow = NOI − P&I; equity = marketValue − mortgageBalance; returnOnEquity =
cashFlow ÷ equity.

## 6. Tax logic already implemented — PRESERVE exactly

- **State sourcing matrix (verified):** a real-property gain can be claimed by the
  **source** state (where it sits) and the **resident** state (that year's residency).
  If source == resident → taxed once. If different → pay **max(source, resident)**
  (resident credits the source tax; never sum). WA's **capital-gains excise EXEMPTS
  real estate** (rate encoded for non-real-estate gains only). CA taxes gains as
  ordinary income at its top rate; CO/OR flat/top rates; residency options are WA/CA
  plus any custom state.
- **Gain split:** total gain = amount realized − adjusted basis; **depreciation
  recapture** = min(accumulated depreciation, gain) taxed at 25% federally and NOT
  sheltered by §121; the remainder is capital gain.
- **§121 + use-test window:** exclusion (500k MFJ / 250k single) applies to capital
  gain only. If a property converted to a rental (`conversionYear`), it must sell by
  `conversionYear + section121UseTestWindowYears` (=3) or the exclusion is LOST
  (surfaced as a warning; taxable gain jumps).
- **CA primary status change:** primary→rental→sale; depreciation starts at
  conversion on the LOWER of adjusted basis or FMV at conversion (net of land); Prop
  13 assessed value tracked at 2%/yr; below-market mortgage shown informationally.
- **CO/OR hold-only:** `holdIndefinitely` suppresses sale modeling; non-resident
  filing cost is an operating expense.
- **taxParams2026.js current values (VERIFY at build):** federal LT top 0.20 / mid
  0.15; recapture 0.25; NIIT 0.038, thresholds 250k MFJ / 200k single, assumed to
  apply; §121 500k/250k, window 3 yrs. State: WA excise 0.07 (real-estate exempt),
  exemption ~270k; CA 0.133 + prop13 cap 0.02; CO 0.044; OR 0.099.

---

## 7. BACKLOG — the owner's notes for THIS iteration (do in order; UI last)

### B1. Add real-estate TRANSFER / EXCISE taxes on a sale (WA REET, and others if applicable)
Distinct from capital-gains tax and from "selling costs %". A transfer/excise tax is
levied on the **sale price**.
- **WA Real Estate Excise Tax (REET):** graduated on sale price. Encode the schedule
  in `taxParams` (dated + sourced) and **verify current brackets at build**. Known
  structure to verify (state portion, recent): 1.10% ≤ $525,000; 1.28% $525,000–
  $1,525,000; 2.75% $1,525,000–$3,025,000; 3.00% above; **plus a local REET** (often
  ~0.25–0.50%) — make the local add-on a parameter. This is a *state* tax and applies
  regardless of the seller's residency (source-state).
- **Other states:** research and add where real. Known landscape to verify: **CA** has
  no statewide transfer tax but county documentary transfer tax (~0.11%) and steep
  **city** taxes in places (e.g. LA "Measure ULA" 4–5.5% over high thresholds). **OR**
  has essentially none statewide (one county ~0.1%). **CO** has none statewide (local
  "transfer assessments" only in some resort towns). Recommended design: encode WA
  REET as a graduated schedule; add a generic **per-property `transferTaxRate`** (or a
  small per-state schedule table) so local/city taxes can be captured, defaulting to
  reasonable county rates and 0 where none. Put all rates in `taxParams` with sources.
- **Where it flows:** add to the sale-year disposition as its own line (separate from
  federal, state income tax, and selling costs); include it in `totalTax`/net proceeds.
  Show it in the disposition detail. It is a source-state tax — the resident-state
  credit logic does NOT apply to it.

### B2. Fix double-counting in Portfolio "RE Wealth" in the sale year
Today `totalRealEstateWealth = portfolio equity + cumulative after-tax sale proceeds`.
In the **sale year**, the sold property still contributes its equity to the portfolio
equity total AND its net proceeds are added to cumulative proceeds → double count.
**Fix:** in the portfolio aggregation, when a property row `sold` in that year, do NOT
add that property's equity to the portfolio equity total (its value is realized as
proceeds instead). Result: RE Wealth transitions smoothly through the sale year (it
should step down only by the taxes + selling/transfer costs paid, not jump). Verify
the sale-year total ≈ prior-year RE wealth minus (tax + selling + transfer costs).

### B3. Per-property "Sales Cost" and "Net Equity" columns (cost of divestiture)
Add two columns to each **per-property detail table**, computed for **every year**
(even hold-only, since the point is to see the theoretical cost):
- **Sales Cost** (theoretical, if sold that year) = `marketValue × sellingCostsPct`.
  (Decision to confirm with owner: whether to also include estimated transfer tax
  (B1) and/or capital-gains tax here as a fuller "divestiture cost". Default to
  selling costs only, matching the owner's literal definition, and note the option.)
- **Net Equity** = `equity − Sales Cost`.
Add to the engine per-year row and render in `tables.propertyTable`.

### B4. Short-term rental: separate PEAK vs OFF-SEASON occupancy
Split `seasonal.occupancyPct` into `seasonal.peakOccupancyPct` and
`seasonal.offSeasonOccupancyPct`. Update: `baseGrossRevenue` (peak nights × peak rate
× peak occ) + (off nights × off rate × off occ); `fieldSchema` seasonal list; sample
data; the Excel template; and the importer mapping. Keep a migration default (if an
old scenario has only `occupancyPct`, use it for both).

### B5. UI/UX rework (do AFTER B1–B4)
Current UI is usable but requires too much scrolling. Rework from a UI/UX
perspective. **Minimum requirement: move settings/inputs to a separate tab.**
Suggested: a tabbed layout — e.g. **Dashboard** (headline metrics + charts),
**Detail** (portfolio + per-property tables + sale-year tax), **Inputs** (settings,
residency, custom states, property editors), and **Data** (save/load + Excel import).
Keep it touch-friendly and readable at iPad width; tables scroll horizontally. No
libraries — plain CSS/JS tabs. Preserve all existing functionality.

### B6. Update the Excel template + build an in-browser Excel importer
- **Template:** update `Property Data Collection Template.xlsx` to match the current
  schema (land in dollars, conversionYear, fmvAtConversion, prop13AssessedValue,
  holdIndefinitely, nonResidentFilingCost, capitalReservePctOfValue, **peak/off-season
  occupancy split**, and any new transfer-tax fields). One tab per property; keep the
  label-in-B / value-in-C layout and the computed NOI/equity/ROE. The owner's husband
  keeps the data on a **laptop in Excel (.xlsx)** — so the importer must read `.xlsx`.
- **Importer (in-browser, no libraries, on-device):** add an "Import from Excel"
  control. An `.xlsx` is a ZIP of XML. Parse client-side with vanilla JS: read the ZIP
  entries (local file headers / central directory) and inflate each with the browser's
  `DecompressionStream('deflate-raw')`; then parse `xl/workbook.xml`,
  `xl/worksheets/sheetN.xml`, and `xl/sharedStrings.xml` to read each property tab's
  label→value pairs; map them onto the scenario schema; default anything the template
  doesn't cover (residency, horizon, growth). The file must **never** be uploaded —
  read it with a `<input type="file">` + `FileReader`/`arrayBuffer()` only. After
  import, the user hits **Save scenario** to keep the JSON on their device.
  If robust `.xlsx` parsing proves too fragile in-browser, fall back to a documented
  `.xlsm`→ no; instead confirm with the owner before switching formats.

---

## 8. Data-collection template mapping (for B6)

The template (in the private repo, `templates/Property Data Collection Template.xlsx`)
has tabs: README, EXAMPLE-Format, one per property, Portfolio-Summary. Each property
tab lists Tier 1/2/3 items as label (col B) / value (col C) / units (D) / notes (E),
and computes adjusted basis, NOI, equity, ROE. Map its labels to the scenario field
keys in §5. Note the template already uses **dollars for land** and expresses
depreciation as improvement basis ÷ 27.5 (equivalent to the app's rate). The new
session will need the owner to provide the updated template (or the session
regenerates it) — the template is NOT in this public repo.

## 9. Workflow going forward

- In this new session you have **native push** to this repo — commit and push
  directly; Pages redeploys. No more manual `index.html` re-uploads.
- Keep the repo demo-data-only. Do the multi-file restore (§3) first, then B1→B6.
- Batch related changes; open PRs if the owner wants review, or push to `main` if they
  prefer direct (confirm their preference).
- The owner is a **beginner on iPad**; her husband is on a **laptop with Excel**.
  Explain changes plainly. For the importer, remember he can run it on the laptop
  where the data lives.

## 10. Phase 2 (not now)

The private repo holds the full rebuild spec (needs-based withdrawals, multi-layer
federal tax engine, Roth-conversion optimizer, survivor/estate, stochastic layer).
It contains real figures, so it is not here. When Phase 2 begins, bring in sanitized
spec excerpts or arrange access to the private repo then. Phase 1's provisional
federal tax is the seam where Phase 2 plugs in (`taxInterface.js`).
