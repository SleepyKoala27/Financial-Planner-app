/* =============================================================================
 *  structuralFacts.js  —  STRUCTURAL FACTS
 * =============================================================================
 *
 *  Facts about the household that are stable and rarely change, but that the
 *  tax math needs. Kept separate from tax LAW (taxParams) and from the editable
 *  SCENARIO (userInputs) so each kind of input lives in exactly one place.
 *
 *  ⚠️ These values are FICTIONAL DEMO values. Set your own in the UI.
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {};

FP.structuralFacts = {
  // Filing status drives which §121 exclusion and NIIT threshold apply.
  // Allowed: 'MFJ' (married filing jointly) or 'Single'.
  filingStatus: 'MFJ',

  // Birth years — used by later phases (retirement timing). Not required by the
  // real-estate math, but kept here so there is a single home for such facts.
  birthYearSelf: 1965,     // DEMO
  birthYearSpouse: 1963,   // DEMO

  // A flag so the UI can remind you these are stand-in values.
  isPlaceholder: true
};
