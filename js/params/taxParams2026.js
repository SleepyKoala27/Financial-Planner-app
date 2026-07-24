/* =============================================================================
 *  taxParams2026.js  —  TAX-LAW PARAMETERS  (dated & versioned)
 * =============================================================================
 *
 *  WHAT THIS FILE IS
 *  -----------------
 *  Every number in here comes from tax law, not from your personal situation.
 *  It is deliberately kept in ONE place so that when a rate or threshold
 *  changes, you edit it here once — never inside a calculation function.
 *  (This is the project's "no magic numbers" rule.)
 *
 *  Each value carries:
 *    - a plain-English name,
 *    - a source (the law/agency it comes from),
 *    - an effective date / tax year it applies to.
 *
 *  IMPORTANT: These are approximate, rounded figures for planning. They are NOT
 *  tax advice. Confirm rates with a professional before making decisions.
 *
 *  VERSIONING: The filename ends in "2026". When you want a later year, COPY
 *  this file to taxParams2027.js, change the numbers, and point userInputs.js
 *  (or the UI) at the new version. Old versions stay as a record.
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {}; // shared namespace for the whole app

FP.taxParams2026 = {
  // Bookkeeping about this parameter set itself.
  meta: {
    version: '2026.1',
    taxYear: 2026,
    lastReviewed: '2026-07-24',
    note: 'Planning approximations. Not tax advice. Verify before relying on them.'
  },

  // ---- FEDERAL: long-term capital gains & related ----------------------------
  federal: {
    // Top long-term capital-gains rate. Source: IRC §1(h). The bracket you land
    // in depends on total taxable income (not modeled in Phase 1), so the
    // PROVISIONAL federal calc assumes the TOP rate (your instruction).
    longTermTopRate: 0.20,       // 20% — highest LTCG bracket
    longTermMidRate: 0.15,       // 15% — middle LTCG bracket (kept for later use)

    // Unrecaptured §1250 gain (depreciation recapture on real property) is taxed
    // at a maximum of 25%. Source: IRC §1(h)(1)(E).
    depreciationRecaptureRate: 0.25,

    // Net Investment Income Tax. Source: IRC §1411 (effective since 2013).
    // Thresholds are NOT indexed for inflation.
    niitRate: 0.038,             // 3.8%
    niitThresholdMFJ: 250000,    // married filing jointly
    niitThresholdSingle: 200000, // single
    // PROVISIONAL assumption: because we don't yet model your other income, we
    // assume you are above the NIIT threshold (consistent with the top-rate
    // assumption). taxInterface.js honors this flag.
    assumeAboveNIITThreshold: true,

    // §121 principal-residence gain exclusion. Source: IRC §121.
    section121ExclusionMFJ: 500000,
    section121ExclusionSingle: 250000,

    // §121 requires 2 of the last 5 years as a primary residence. If a home is
    // converted to a rental, that rule leaves roughly a 3-year window after you
    // stop living there in which a sale still qualifies for the full exclusion.
    // Source: IRC §121(a)/(b) (2-of-5 use test). See spec §11.1.
    section121UseTestWindowYears: 3
  },

  // ---- STATE tax treatment, keyed by two-letter state code -------------------
  // Only the states relevant to this portfolio are defined (WA, CA, CO, OR).
  // "residency" states the user can pick from are WA and CA (see userInputs.js).
  stateTax: {
    // WASHINGTON — no personal income tax. It DOES have a capital-gains excise
    // tax (RCW 82.87, effective 2022), BUT real estate is explicitly EXEMPT
    // (RCW 82.87.040). We still encode the 7% rate + exemption because it
    // applies to OTHER (non-real-estate) gains, which a later phase may model.
    WA: {
      name: 'Washington',
      type: 'capital-gains-excise',
      rate: 0.07,                   // 7% — RCW 82.87 (base tier)
      realEstateExempt: true,       // RCW 82.87.040 — real property gains exempt
      standardExemption: 270000,    // ~2026 inflation-adjusted exemption (approx)
      // NOTE: 2025 legislation added an extra tier on very large gains (>$1M).
      // Not encoded here because real estate is exempt anyway; add if you later
      // model non-real-estate gains.
      taxesResidentsOnAllIncome: false // WA has no income tax at all
    },

    // CALIFORNIA — taxes capital gains as ordinary income (no special CG rate).
    // Source: CA R&TC. Top marginal ≈ 13.3% (12.3% + 1% mental-health surcharge
    // over $1M). Phase 1 applies the TOP marginal rate to the whole gain, which
    // OVERSTATES tax on smaller gains — a documented simplification.
    CA: {
      name: 'California',
      type: 'income',
      rate: 0.133,                  // 13.3% top marginal (simplification)
      capitalGainsAsOrdinaryIncome: true,
      conformsToSection121: true,   // CA follows the federal §121 exclusion
      taxesResidentsOnAllIncome: true, // residents taxed on income wherever earned
      taxesNonResidentsOnSourceIncome: true, // and non-residents on CA-source income
      // Proposition 13 caps the annual increase in a property's ASSESSED value
      // at 2%/yr (until a change of ownership resets it to market). This is a
      // real, transferable-only-by-loss asset — tracked separately from market
      // value for display. Source: CA Const. Art. XIII A (Prop 13).
      prop13AnnualAssessmentCap: 0.02
    },

    // COLORADO — flat income tax. Source: CO DOR. 4.4% (2024).
    // Rental/real property here creates a NON-RESIDENT source filing regardless
    // of where you live.
    CO: {
      name: 'Colorado',
      type: 'income',
      rate: 0.044,                  // 4.4% flat
      taxesNonResidentsOnSourceIncome: true
    },

    // OREGON — graduated income tax; top ≈ 9.9%. Source: OR DOR.
    // Also a NON-RESIDENT source-filing state for property located there.
    OR: {
      name: 'Oregon',
      type: 'income',
      rate: 0.099,                  // 9.9% top marginal (simplification)
      taxesNonResidentsOnSourceIncome: true
    }
  },

  // ---- REAL-ESTATE TRANSFER / EXCISE taxes, keyed by state code --------------
  //  These are levied on the SALE PRICE of the property (NOT on the gain, and
  //  NOT the same thing as "selling costs %"). They are a SOURCE-STATE tax: they
  //  depend only on where the property sits, never on the seller's residency, so
  //  the resident-state credit logic does NOT apply to them.
  //
  //  A property may ALSO set its own `transferTaxRate` (a decimal) to capture a
  //  CITY/local tax that this table can't know in advance (e.g. Los Angeles
  //  "Measure ULA"). That per-property rate is ADDED on top of the state/county
  //  rate below. See realEstateEngine.computeTransferTax.
  transferTax: {
    // WASHINGTON — Real Estate Excise Tax (REET). GRADUATED on the sale price,
    // charged marginally by bracket. Source: RCW 82.45 / WAC 458-61A. The state
    // graduated rates + thresholds below are effective 2023-01-01 through
    // 2026-12-31 (thresholds are CPI-adjusted; verify at each new tax year).
    // https://dor.wa.gov/taxes-rates/other-taxes/real-estate-excise-tax
    WA: {
      name: 'Washington REET',
      type: 'graduated',
      // Marginal brackets: `rate` applies to the portion of sale price up to
      // `upTo` (null = no ceiling, i.e. the top bracket).
      brackets: [
        { upTo: 525000,  rate: 0.0110 },  // 1.10% on the first $525,000
        { upTo: 1525000, rate: 0.0128 },  // 1.28% on $525,000–$1,525,000
        { upTo: 3025000, rate: 0.0275 },  // 2.75% on $1,525,000–$3,025,000
        { upTo: null,    rate: 0.0300 }   // 3.00% above $3,025,000
      ],
      // LOCAL REET add-on (RCW 82.46): counties/cities may levy up to ~0.50%
      // combined (0.25% first quarter + 0.25% second quarter under GMA). Applied
      // as a flat rate on the whole sale price. Parameterized — adjust per county.
      localAddOnRate: 0.0050,           // 0.50% common combined local REET
      effectiveThroughYear: 2026,
      source: 'RCW 82.45/82.46; WA DOR graduated REET, thresholds eff. 2023-01-01..2026-12-31'
    },

    // CALIFORNIA — NO statewide transfer tax. Counties levy a documentary
    // transfer tax of $1.10 per $1,000 = 0.11%. Some CITIES add steep taxes
    // (e.g. LA "Measure ULA" 4–5.5% over high thresholds) — capture those with a
    // per-property `transferTaxRate`, not here. Source: CA R&TC §11911.
    CA: {
      name: 'CA county documentary transfer tax',
      type: 'flat',
      rate: 0.0011,                     // 0.11% county documentary ($1.10/$1,000)
      source: 'CA R&TC §11911 — $1.10 per $1,000 county documentary transfer tax'
    },

    // OREGON — essentially NONE. ORS 306.815 bars new real-estate transfer taxes;
    // only Washington County has a grandfathered ~0.1% tax. Default 0; set a
    // per-property `transferTaxRate` for a Washington County property.
    OR: {
      name: 'Oregon (no statewide transfer tax)',
      type: 'flat',
      rate: 0.0,
      source: 'ORS 306.815 prohibits transfer taxes; Washington County ~0.1% grandfathered'
    },

    // COLORADO — NO statewide transfer tax (CO Const. Art. X §3 bars them). A few
    // resort towns levy local "transfer assessments"; capture those per-property.
    CO: {
      name: 'Colorado (no statewide transfer tax)',
      type: 'flat',
      rate: 0.0,
      source: 'CO Const. Art. X §3 — statewide transfer taxes barred; resort-town assessments only'
    },

    // Fallback for any state without a rule above (including custom states):
    // charge nothing unless the property sets its own transferTaxRate.
    defaultRate: 0.0
  }
};
