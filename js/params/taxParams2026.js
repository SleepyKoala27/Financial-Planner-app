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
  }
};
