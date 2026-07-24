/* =============================================================================
 *  fieldSchema.js  —  describes every editable PROPERTY input
 * =============================================================================
 *
 *  This is documentation that the program can read. The UI builds its edit
 *  forms from this list, so every input box automatically gets a label, a unit,
 *  and help text — and there is a single place that defines what each field
 *  means. Adding a field here makes it appear in the UI.
 *
 *  `type` controls how the value is shown/edited:
 *    'currency' - dollars (whole numbers)
 *    'percent'  - stored as a DECIMAL (0.03) but shown/edited as a PERCENT (3)
 *    'number'   - a plain number (nights, months, years)
 *    'year'     - a 4-digit calendar year (or the word 'hold')
 *    'date'     - an ISO date string (YYYY-MM-DD)
 *    'text'     - free text
 *    'select'   - one of `options`
 *    'boolean'  - a checkbox
 *
 *  `tier` groups fields on screen:
 *    1 = Basis & tax, 2 = Operating, 3 = Disposition, 0 = Identity
 *
 *  `showIf` (optional) names a boolean field; the row is only shown/relevant
 *  when meaningful (the UI uses it to hide disposition fields on hold-only
 *  properties). It is advisory — the engine ignores hidden fields on its own.
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {};

FP.propertyFieldSchema = [
  // ---- Identity (tier 0) ----
  { key: 'name', label: 'Property name', type: 'text', tier: 0, help: 'A label you recognize.' },
  { key: 'state', label: 'State (where property sits)', type: 'select', tier: 0,
    options: ['CA', 'WA', 'CO', 'OR'], help: 'The SOURCE state for sale tax. Custom states added below also appear here.' },
  { key: 'ownershipEntity', label: 'Ownership entity', type: 'select', tier: 0,
    options: ['Individual', 'Joint Revocable Trust', 'S-Corp', 'LLC', 'Partnership'],
    help: 'How title is held. S-Corp constrains sale options (see notes).' },
  { key: 'entityStockBasis', label: 'Entity stock/interest basis', type: 'currency', tier: 0,
    help: 'S-Corp only: your basis in the entity. Differs from the property inside basis; both matter at sale.' },

  // ---- Tier 1 — Basis & tax ----
  { key: 'purchasePrice', label: 'Purchase price', type: 'currency', tier: 1 },
  { key: 'purchaseDate', label: 'Purchase date', type: 'date', tier: 1 },
  { key: 'landAllocation', label: 'Land allocation (value)', type: 'currency', tier: 1,
    help: 'The LAND portion of the purchase price in dollars (land is NOT depreciable).' },
  { key: 'capitalImprovements', label: 'Capital improvements', type: 'currency', tier: 1,
    help: 'Money spent improving the property (adds to basis).' },
  { key: 'accumulatedDepreciation', label: 'Accumulated depreciation (taken so far)', type: 'currency', tier: 1,
    help: 'Total depreciation already deducted. Drives 25% recapture at sale.' },
  { key: 'annualDepreciationRate', label: 'Annual depreciation rate', type: 'percent', tier: 1,
    help: 'e.g. residential = 1/27.5 ≈ 3.636%. Use 0% for a home not yet a rental.' },
  { key: 'placedInServiceDate', label: 'Placed-in-service date', type: 'date', tier: 1,
    help: 'When it first became a rental. Blank = never (no depreciation yet).' },
  { key: 'suspendedPassiveLosses', label: 'Suspended passive losses', type: 'currency', tier: 1,
    help: 'Form 8582 carryforward (informational in Phase 1).' },
  // Status-change (primary → rental) inputs — used by the CA primary case.
  { key: 'conversionYear', label: 'Primary→rental conversion year', type: 'year', tier: 1,
    help: 'Year a primary residence becomes a rental. Leave "hold" if it never converts. Depreciation starts here.' },
  { key: 'fmvAtConversion', label: 'FMV at conversion', type: 'currency', tier: 1,
    help: 'Market value when it converts to a rental. Depreciation basis = LOWER of adjusted basis or this.' },
  { key: 'prop13AssessedValue', label: 'Prop 13 assessed value (CA)', type: 'currency', tier: 1,
    help: 'CA only. Grows at a capped 2%/yr; a real asset lost on any rebuy. Tracked separately from market value.' },

  // ---- Tier 2 — Operating ----
  { key: 'grossRentalRevenue', label: 'Gross rental revenue (annual)', type: 'currency', tier: 2,
    help: 'Used when seasonal detail is OFF.' },
  { key: 'marketValue', label: 'Market value (current)', type: 'currency', tier: 2 },
  { key: 'assessedValue', label: 'Assessed value', type: 'currency', tier: 2,
    help: 'Tax-assessed value (informational).' },
  { key: 'propertyTax', label: 'Property tax (annual)', type: 'currency', tier: 2 },
  { key: 'insurance', label: 'Insurance (annual)', type: 'currency', tier: 2 },
  { key: 'hoa', label: 'HOA (annual)', type: 'currency', tier: 2 },
  { key: 'ownerPaidUtilities', label: 'Owner-paid utilities (annual)', type: 'currency', tier: 2 },
  { key: 'managementFees', label: 'Management fees (annual)', type: 'currency', tier: 2 },
  { key: 'housekeepingTurnover', label: 'Housekeeping / turnover (annual)', type: 'currency', tier: 2 },
  { key: 'routineMaintenance', label: 'Routine maintenance (annual)', type: 'currency', tier: 2 },
  { key: 'capitalReserve', label: 'Capital reserve (flat annual)', type: 'currency', tier: 2,
    help: 'Used only if the % field below is 0.' },
  { key: 'capitalReservePctOfValue', label: 'Capital reserve (% of value)', type: 'percent', tier: 2,
    help: 'Preferred: 1–2% of market value. If > 0, this overrides the flat amount above.' },
  { key: 'vacancyAllowancePct', label: 'Vacancy allowance', type: 'percent', tier: 2,
    help: 'Share of gross revenue lost to vacancy.' },
  { key: 'nonResidentFilingCost', label: 'Non-resident filing cost (annual)', type: 'currency', tier: 2,
    help: 'CO/OR etc.: accepted annual cost of a source-state filing. Counts as an operating expense.' },
  { key: 'mortgageBalance', label: 'Mortgage balance (current)', type: 'currency', tier: 2 },
  { key: 'mortgageRate', label: 'Mortgage rate', type: 'percent', tier: 2 },
  { key: 'mortgageTermYears', label: 'Mortgage term (years)', type: 'number', tier: 2 },
  { key: 'mortgageOriginationDate', label: 'Mortgage origination date', type: 'date', tier: 2 },

  // ---- Tier 3 — Disposition ----
  { key: 'holdIndefinitely', label: 'Hold indefinitely (no sale modeled)', type: 'boolean', tier: 3,
    help: 'For family-housing holds (CO/OR). When on, no sale is modeled and the fields below are ignored.' },
  { key: 'appreciationRate', label: 'Appreciation rate (annual)', type: 'percent', tier: 3, showIf: 'sale' },
  { key: 'sellingCostsPct', label: 'Selling costs', type: 'percent', tier: 3, showIf: 'sale',
    help: 'Agent + closing costs as a share of sale price (typically 6–8%).' },
  { key: 'transferTaxRate', label: 'Extra local/city transfer tax', type: 'percent', tier: 3,
    help: 'CITY or local real-estate transfer tax (e.g. LA Measure ULA), added ON TOP of the built-in state/county rate. Leave 0 if none. State rules (WA REET, CA county, etc.) apply automatically.' },
  { key: 'plannedSaleYear', label: 'Planned sale year', type: 'year', tier: 3, showIf: 'sale',
    help: 'A calendar year to model a sale, or "hold" to never sell.' },
  { key: 'section121Eligible', label: '§121 primary-residence exclusion applies', type: 'boolean', tier: 3, showIf: 'sale',
    help: 'Home-sale gain exclusion. If the home converted to a rental, it must sell within the use-test window (≈3 yrs) or the exclusion is lost.' }
];

// Seasonal sub-fields (shown only when seasonal.enabled is on).
FP.seasonalFieldSchema = [
  { key: 'enabled', label: 'Use seasonal (short-term rental) detail', type: 'boolean' },
  { key: 'peakNightlyRate', label: 'Peak nightly rate', type: 'currency' },
  { key: 'peakMonths', label: 'Peak months (count)', type: 'number' },
  { key: 'offSeasonNightlyRate', label: 'Off-season nightly rate', type: 'currency' },
  { key: 'occupancyPct', label: 'Occupancy', type: 'percent' }
];

// The three tiers, for section headings in the UI.
FP.tierLabels = {
  0: 'Identity & ownership',
  1: 'Tier 1 — Basis & tax',
  2: 'Tier 2 — Operating',
  3: 'Tier 3 — Disposition'
};
