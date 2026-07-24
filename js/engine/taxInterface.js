/* =============================================================================
 *  taxInterface.js  —  FEDERAL TAX INTERFACE (stub implementation)
 * =============================================================================
 *
 *  WHY THIS FILE EXISTS
 *  --------------------
 *  Federal tax on a property sale really depends on your OTHER income for the
 *  year (which bracket you land in, whether NIIT applies, etc.). Phase 1 does
 *  not model that yet. So we hide the federal calculation behind this small
 *  "interface" with a clearly-labelled STUB. Later, a real federal engine (or a
 *  Python backend) can replace ONLY this file — the sale logic in
 *  realEstateEngine.js calls this interface and never needs to change.
 *
 *  This module is HEADLESS: it never touches the page (no `document`, no DOM).
 *  It takes plain numbers in and returns plain numbers out.
 *
 *  Everything it returns is marked `provisional: true` so the UI can flag it.
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {};

FP.taxInterface = {
  /*
   * computeFederalDispositionTax
   * ----------------------------
   * Provisional federal tax on the sale of one property.
   *
   * INPUTS (all dollars, already computed by the engine):
   *   parts.taxableCapitalGain  - long-term capital gain AFTER any §121 exclusion
   *   parts.depreciationRecapture - unrecaptured §1250 gain (taxed separately)
   *   taxParams                 - a taxParamsYYYY object (rates live there)
   *   structuralFacts           - filing status (for future threshold logic)
   *
   * RETURNS an object with a full breakdown and `provisional: true`.
   *
   * ASSUMPTIONS (per project decision):
   *   - Use the TOP long-term capital-gains rate (we don't know your bracket).
   *   - Assume you are above the NIIT threshold (top-rate assumption).
   *   These assumptions overstate tax for many situations on purpose, so the
   *   provisional number is a conservative ceiling, not a promise.
   */
  computeFederalDispositionTax: function (parts, taxParams, structuralFacts) {
    var fed = taxParams.federal;

    var capGain = Math.max(0, parts.taxableCapitalGain || 0);
    var recapture = Math.max(0, parts.depreciationRecapture || 0);

    // Long-term capital-gains tax at the assumed TOP rate.
    var capitalGainsTax = capGain * fed.longTermTopRate;

    // Depreciation recapture (unrecaptured §1250) at its own max rate (25%).
    var recaptureTax = recapture * fed.depreciationRecaptureRate;

    // Net Investment Income Tax (3.8%) on the gain, IF we assume you are above
    // the threshold. Both the capital gain and the recapture are investment
    // income for NIIT purposes.
    var niitBase = capGain + recapture;
    var niitTax = fed.assumeAboveNIITThreshold ? niitBase * fed.niitRate : 0;

    var total = capitalGainsTax + recaptureTax + niitTax;

    return {
      provisional: true, // <-- the UI shows a "PROVISIONAL" badge because of this
      assumptions: {
        rateUsed: fed.longTermTopRate,
        niitApplied: fed.assumeAboveNIITThreshold,
        filingStatus: structuralFacts ? structuralFacts.filingStatus : 'unknown',
        note: 'Federal tax assumes the top long-term rate and that NIIT applies. '
            + 'Real bracket depends on other income, which Phase 1 does not model.'
      },
      breakdown: {
        capitalGainsTax: capitalGainsTax,
        recaptureTax: recaptureTax,
        niitTax: niitTax
      },
      total: total
    };
  }
};
