/* =============================================================================
 *  userInputs.js  —  DEFAULT SCENARIO (editable) + demo properties
 * =============================================================================
 *
 *  This is the one file that holds the SCENARIO data (not tax law, not household
 *  facts). Everything here is editable in the UI, and the whole object can be
 *  saved to / loaded from a JSON file.
 *
 *  ⚠️ EVERY NUMBER BELOW IS FICTIONAL DEMO DATA — invented round numbers so the
 *  app has something to show. It does NOT represent any real person or portfolio.
 *  Enter your own figures in the UI and keep them in JSON files on your device;
 *  never commit real financial data to this public repository.
 *
 *  Percentages are stored as DECIMALS here (0.03 = 3%). The UI shows them as %.
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {};

FP.makeDefaultScenario = function () {
  var START_YEAR = 2026;
  var HORIZON = 30;

  var residencyByYear = [];
  for (var i = 0; i < HORIZON; i++) residencyByYear.push('CA'); // default all CA; editable per year

  return {
    schemaVersion: 2,
    label: 'Sample portfolio (fictional demo data)',
    isPlaceholder: true,

    startYear: START_YEAR,
    horizonYears: HORIZON,

    assumptions: {
      revenueGrowthRate: 0.03,      // rents grow 3%/yr (demo)
      expenseGrowthRate: 0.03,      // operating costs grow 3%/yr (demo)
      benchmarkMortgageRate: 0.07   // market mortgage rate, for the below-market-financing benefit
    },

    defaultResidency: 'CA',
    residencyByYear: residencyByYear,

    // User-defined extra states (source or future domicile). Merged into the
    // state-tax table. Example: { code:'AZ', name:'Arizona', rate:0.025 }
    customStates: [],

    taxParamsVersion: '2026.1',

    properties: [
      // ---------------------------------------------------------------------
      //  1) A home that CONVERTS from primary residence to a rental, then sells
      //     (demonstrates the §121 use-test window and conversion depreciation)
      // ---------------------------------------------------------------------
      {
        id: 'demo-ca-home', name: 'Sample Home (CA) — DEMO', state: 'CA',
        ownershipEntity: 'Joint Revocable Trust', entityStockBasis: 0,
        isPlaceholder: true,
        purchasePrice: 300000, purchaseDate: '2012-05-01',
        landAllocation: 75000, capitalImprovements: 0,
        accumulatedDepreciation: 0, annualDepreciationRate: 0.03636, // applies AFTER conversion
        placedInServiceDate: null, suspendedPassiveLosses: 0,
        conversionYear: 2033, fmvAtConversion: 650000, // primary → rental in 2033
        prop13AssessedValue: 450000,
        grossRentalRevenue: 30000, marketValue: 600000, assessedValue: 450000,
        propertyTax: 7000, insurance: 2000, hoa: 0, ownerPaidUtilities: 0,
        managementFees: 0, housekeepingTurnover: 0, routineMaintenance: 3000,
        capitalReserve: 2000, capitalReservePctOfValue: 0, vacancyAllowancePct: 0.03,
        nonResidentFilingCost: 0,
        mortgageBalance: 250000, mortgageRate: 0.04, mortgageTermYears: 30,
        mortgageOriginationDate: '2019-06-01',
        holdIndefinitely: false, appreciationRate: 0.035, sellingCostsPct: 0.06,
        plannedSaleYear: 2035, section121Eligible: true,
        seasonal: { enabled: false, peakNightlyRate: 0, peakMonths: 0, offSeasonNightlyRate: 0, occupancyPct: 0 },
        notes: 'DEMO. Converts primary→rental in 2033 and sells within the ~3-year §121 window. '
             + 'Post-conversion depreciation is recaptured and NOT sheltered by §121. Try moving the sale '
             + 'year to 2037 to see the §121 exclusion lost.'
      },

      // ---------------------------------------------------------------------
      //  2) A short-term rental held in an S-corp (seasonal revenue, recapture)
      // ---------------------------------------------------------------------
      {
        id: 'demo-wa-str', name: 'Sample STR (WA) — DEMO', state: 'WA',
        ownershipEntity: 'S-Corp', entityStockBasis: 300000,
        isPlaceholder: true,
        purchasePrice: 500000, purchaseDate: '2018-01-01',
        landAllocation: 100000, capitalImprovements: 50000,
        accumulatedDepreciation: 100000, annualDepreciationRate: 0.03636,
        placedInServiceDate: '2018-01-01', suspendedPassiveLosses: 25000,
        conversionYear: 'hold', fmvAtConversion: 0, prop13AssessedValue: 0,
        grossRentalRevenue: 0,
        marketValue: 1000000, assessedValue: 850000,
        propertyTax: 9000, insurance: 3000, hoa: 0, ownerPaidUtilities: 2000,
        managementFees: 8000, housekeepingTurnover: 4000, routineMaintenance: 3000,
        capitalReserve: 0, capitalReservePctOfValue: 0.01, // 1% of value (STR wear)
        vacancyAllowancePct: 0, // occupancy handles vacancy in seasonal detail
        nonResidentFilingCost: 0,
        mortgageBalance: 250000, mortgageRate: 0.05, mortgageTermYears: 30,
        mortgageOriginationDate: '2018-01-01',
        holdIndefinitely: false, appreciationRate: 0.04, sellingCostsPct: 0.06,
        plannedSaleYear: 2033, section121Eligible: false,
        seasonal: { enabled: true, peakNightlyRate: 400, peakMonths: 4, offSeasonNightlyRate: 150, occupancyPct: 0.60 },
        notes: 'DEMO. Held in an S-corp — gain flows through to the personal return in the sale year; the MAGI '
             + 'spike can be timed, not structured away. Washington exempts real estate from its capital-gains excise.'
      },

      // ---------------------------------------------------------------------
      //  3) A single-family rental in an income-tax state, held indefinitely
      // ---------------------------------------------------------------------
      {
        id: 'demo-co-rental', name: 'Sample Rental (CO) — DEMO', state: 'CO',
        ownershipEntity: 'Individual', entityStockBasis: 0,
        isPlaceholder: true,
        purchasePrice: 200000, purchaseDate: '2016-04-01',
        landAllocation: 40000, capitalImprovements: 10000,
        accumulatedDepreciation: 50000, annualDepreciationRate: 0.03636,
        placedInServiceDate: '2016-04-01', suspendedPassiveLosses: 0,
        conversionYear: 'hold', fmvAtConversion: 0, prop13AssessedValue: 0,
        grossRentalRevenue: 18000, marketValue: 260000, assessedValue: 230000,
        propertyTax: 2200, insurance: 1000, hoa: 0, ownerPaidUtilities: 0,
        managementFees: 1800, housekeepingTurnover: 0, routineMaintenance: 2000,
        capitalReserve: 1500, capitalReservePctOfValue: 0, vacancyAllowancePct: 0.05,
        nonResidentFilingCost: 400, // accepted cost of the non-resident filing
        mortgageBalance: 150000, mortgageRate: 0.04, mortgageTermYears: 30,
        mortgageOriginationDate: '2016-04-01',
        holdIndefinitely: true, appreciationRate: 0.03, sellingCostsPct: 0.06,
        plannedSaleYear: 'hold', section121Eligible: false,
        seasonal: { enabled: false, peakNightlyRate: 0, peakMonths: 0, offSeasonNightlyRate: 0, occupancyPct: 0 },
        notes: 'DEMO. Indefinite hold (no sale modeled). A non-resident source-state filing is an accepted cost.'
      },

      // ---------------------------------------------------------------------
      //  4) Another indefinite-hold single-family rental in a second tax state
      // ---------------------------------------------------------------------
      {
        id: 'demo-or-rental', name: 'Sample Rental (OR) — DEMO', state: 'OR',
        ownershipEntity: 'Individual', entityStockBasis: 0,
        isPlaceholder: true,
        purchasePrice: 210000, purchaseDate: '2017-08-01',
        landAllocation: 42000, capitalImprovements: 8000,
        accumulatedDepreciation: 45000, annualDepreciationRate: 0.03636,
        placedInServiceDate: '2017-08-01', suspendedPassiveLosses: 0,
        conversionYear: 'hold', fmvAtConversion: 0, prop13AssessedValue: 0,
        grossRentalRevenue: 18500, marketValue: 270000, assessedValue: 240000,
        propertyTax: 2400, insurance: 1100, hoa: 0, ownerPaidUtilities: 0,
        managementFees: 1850, housekeepingTurnover: 0, routineMaintenance: 2100,
        capitalReserve: 1500, capitalReservePctOfValue: 0, vacancyAllowancePct: 0.05,
        nonResidentFilingCost: 400, // accepted cost of the non-resident filing
        mortgageBalance: 160000, mortgageRate: 0.0425, mortgageTermYears: 30,
        mortgageOriginationDate: '2017-08-01',
        holdIndefinitely: true, appreciationRate: 0.03, sellingCostsPct: 0.06,
        plannedSaleYear: 'hold', section121Eligible: false,
        seasonal: { enabled: false, peakNightlyRate: 0, peakMonths: 0, offSeasonNightlyRate: 0, occupancyPct: 0 },
        notes: 'DEMO. Indefinite hold (no sale modeled). A non-resident source-state filing is an accepted cost.'
      }
    ]
  };
};
