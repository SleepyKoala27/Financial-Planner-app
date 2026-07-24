/* =============================================================================
 *  realEstateEngine.js  —  THE CALCULATION ENGINE (headless, no DOM)
 * =============================================================================
 *
 *  This file contains ALL the real-estate math. It never touches the web page:
 *  no `document`, no reading of input boxes. It takes a plain data object in and
 *  returns a plain results object out — so it can be swapped for a Python
 *  backend later. The UI is the only thing that knows about the screen.
 *
 *  PUBLIC ENTRY POINT:
 *      FP.engine.runProjection(scenario, taxParams, structuralFacts, taxInterface)
 *
 *  KEY DEFINITIONS:
 *    - Adjusted cost basis = purchase price + capital improvements
 *                            − accumulated depreciation.  (DERIVED, never typed.)
 *    - NOI = effective revenue − operating expenses, BEFORE debt service.
 *    - Cash flow = NOI − annual mortgage P&I.
 *    - Equity = market value − mortgage balance.
 *    - Return on equity = cash flow ÷ equity.  (Headline metric.)
 *    - On sale, gain splits into CAPITAL GAIN and DEPRECIATION RECAPTURE,
 *      taxed differently; §121 can exclude capital gain (never recapture) and
 *      is lost if a converted rental sells outside the use-test window.
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {};

FP.engine = (function () {
  'use strict';

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : 0; }
  function grow(base, r, years) { return num(base) * Math.pow(1 + num(r), years); }
  function yearNum(v) { return (v && v !== 'hold') ? Number(v) : null; }

  var DAYS_PER_MONTH = 30.42; // 365 / 12, documented constant (not a magic number)

  // ---------------------------------------------------------------------------
  //  MORTGAGE AMORTIZATION — year-by-year interest / principal / ending balance
  //  from the CURRENT balance, rate, and remaining term.
  // ---------------------------------------------------------------------------
  function buildAmortization(currentBalance, annualRate, remainingTermYears, horizonYears) {
    var schedule = [];
    var balance = num(currentBalance);
    var monthlyRate = num(annualRate) / 12;
    var monthsLeft = Math.max(0, Math.round(num(remainingTermYears) * 12));

    var monthlyPayment;
    if (balance <= 0 || monthsLeft <= 0) monthlyPayment = 0;
    else if (monthlyRate === 0) monthlyPayment = balance / monthsLeft;
    else monthlyPayment = balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -monthsLeft));

    var monthCounter = 0;
    for (var t = 0; t < horizonYears; t++) {
      var yi = 0, yp = 0, ypay = 0;
      for (var mo = 0; mo < 12; mo++) {
        if (monthCounter >= monthsLeft || balance <= 0.005) break;
        var interest = balance * monthlyRate;
        var principal = monthlyPayment - interest;
        if (principal > balance) principal = balance;
        balance -= principal;
        yi += interest; yp += principal; ypay += (interest + principal);
        monthCounter++;
      }
      schedule.push({ interest: yi, principal: yp, payment: ypay, endingBalance: Math.max(0, balance) });
    }
    return schedule;
  }

  // ---------------------------------------------------------------------------
  //  GROSS RENTAL REVENUE — flat annual, or built from seasonal STR detail.
  // ---------------------------------------------------------------------------
  function baseGrossRevenue(p) {
    if (p.seasonal && p.seasonal.enabled) {
      var s = p.seasonal, occ = num(s.occupancyPct);
      var peakNights = num(s.peakMonths) * DAYS_PER_MONTH;
      var offNights = (12 - num(s.peakMonths)) * DAYS_PER_MONTH;
      return num(s.peakNightlyRate) * peakNights * occ + num(s.offSeasonNightlyRate) * offNights * occ;
    }
    return num(p.grossRentalRevenue);
  }

  // ---------------------------------------------------------------------------
  //  DEPRECIATION SETUP
  //  Two cases:
  //   (a) Already a rental: placed-in-service date set, seed accumulated
  //       depreciation given; depreciable basis = purchase − land + improvements.
  //   (b) Primary→rental CONVERSION: depreciation starts at the conversion year
  //       on the LOWER of adjusted basis or FMV at conversion, net of land, and
  //       recapture on it is NOT sheltered by §121.
  //   Land value is given in dollars; we convert to a fraction to strip land out
  //   of the FMV-at-conversion figure too.
  // ---------------------------------------------------------------------------
  function depreciationPlan(p, startYear) {
    var landFraction = num(p.purchasePrice) > 0 ? num(p.landAllocation) / num(p.purchasePrice) : 0;
    var conv = yearNum(p.conversionYear);
    var rate = num(p.annualDepreciationRate);

    if (conv !== null) {
      // Conversion case. Adjusted basis at conversion (no prior depreciation on a
      // personal residence). Depreciable basis = lower of that or FMV, minus land.
      var adjBasisAtConv = num(p.purchasePrice) + num(p.capitalImprovements);
      var lower = Math.min(adjBasisAtConv, num(p.fmvAtConversion) || adjBasisAtConv);
      var deprBasis = lower * (1 - landFraction);
      return { inServiceStartYear: conv, depreciableBasisCap: deprBasis,
               annualDepreciation: rate * deprBasis, converted: true, conversionYear: conv };
    }

    var placed = p.placedInServiceDate ? new Date(p.placedInServiceDate).getFullYear() : null;
    if (placed !== null && rate > 0) {
      var stdBasis = num(p.purchasePrice) - num(p.landAllocation) + num(p.capitalImprovements);
      return { inServiceStartYear: Math.min(placed, startYear), depreciableBasisCap: stdBasis,
               annualDepreciation: rate * stdBasis, converted: false, conversionYear: null };
    }
    return { inServiceStartYear: null, depreciableBasisCap: 0, annualDepreciation: 0,
             converted: false, conversionYear: null };
  }

  // ---------------------------------------------------------------------------
  //  OPERATING EXPENSES for one year.
  //  capitalReservePctOfValue (if > 0) overrides the flat capitalReserve.
  //  nonResidentFilingCost is an accepted annual cost (CO/OR source filings).
  // ---------------------------------------------------------------------------
  function operatingExpenseLines(p, growthFactor, marketValue) {
    var capReserve = num(p.capitalReservePctOfValue) > 0
      ? marketValue * num(p.capitalReservePctOfValue)
      : num(p.capitalReserve) * growthFactor;
    return {
      propertyTax: num(p.propertyTax) * growthFactor,
      insurance: num(p.insurance) * growthFactor,
      hoa: num(p.hoa) * growthFactor,
      ownerPaidUtilities: num(p.ownerPaidUtilities) * growthFactor,
      managementFees: num(p.managementFees) * growthFactor,
      housekeepingTurnover: num(p.housekeepingTurnover) * growthFactor,
      routineMaintenance: num(p.routineMaintenance) * growthFactor,
      capitalReserve: capReserve,
      nonResidentFilingCost: num(p.nonResidentFilingCost) * growthFactor
    };
  }
  function sumLines(lines) { var t = 0; for (var k in lines) if (lines.hasOwnProperty(k)) t += lines[k]; return t; }

  // ---------------------------------------------------------------------------
  //  STATE TAX for a single state on a real-property gain.
  //  Reads the merged state table (base + any custom states).
  // ---------------------------------------------------------------------------
  function stateTaxForOneState(stateCode, taxableGain, isRealEstate, stateTable) {
    var cfg = stateTable[stateCode];
    if (!cfg) return { state: stateCode, tax: 0, note: 'no rule defined for ' + stateCode };
    if (cfg.type === 'capital-gains-excise') {
      if (isRealEstate && cfg.realEstateExempt) return { state: stateCode, tax: 0, note: 'WA excise exempts real estate' };
      var over = Math.max(0, taxableGain - num(cfg.standardExemption));
      return { state: stateCode, tax: over * cfg.rate, note: 'WA excise (non-real-estate)' };
    }
    return { state: stateCode, tax: Math.max(0, taxableGain) * cfg.rate, note: (cfg.name || stateCode) + ' income tax' };
  }

  // ---------------------------------------------------------------------------
  //  REAL-ESTATE TRANSFER / EXCISE TAX on a sale.
  //  Charged on the SALE PRICE (not the gain), by the state where the property
  //  sits (SOURCE state) — the resident-state credit never applies to it.
  //  A property's own `transferTaxRate` (a decimal, e.g. a city tax like LA's
  //  Measure ULA) is ADDED on top of the state/county rate.
  //  Reads taxParams.transferTax (dated + sourced in the params file).
  // ---------------------------------------------------------------------------
  function computeTransferTax(salePrice, stateCode, property, taxParams) {
    var table = (taxParams && taxParams.transferTax) || {};
    var cfg = table[stateCode];
    var price = Math.max(0, num(salePrice));

    var statePortion = 0, note;
    if (!cfg) {
      statePortion = price * num(table.defaultRate);
      note = 'No transfer-tax rule for ' + stateCode + '; default ' + (num(table.defaultRate) * 100) + '%.';
    } else if (cfg.type === 'graduated') {
      // Marginal graduated schedule (e.g. WA REET) + a flat local add-on.
      var lower = 0, graduated = 0;
      (cfg.brackets || []).forEach(function (b) {
        var ceil = (b.upTo === null || b.upTo === undefined) ? Infinity : b.upTo;
        if (price > lower) graduated += (Math.min(price, ceil) - lower) * num(b.rate);
        lower = ceil;
      });
      var local = price * num(cfg.localAddOnRate);
      statePortion = graduated + local;
      note = (cfg.name || stateCode) + ' (graduated'
        + (num(cfg.localAddOnRate) > 0 ? ' + ' + (num(cfg.localAddOnRate) * 100) + '% local' : '') + ').';
    } else {
      // Flat state/county rate.
      statePortion = price * num(cfg.rate);
      note = (cfg.name || stateCode) + ' (' + (num(cfg.rate) * 100) + '%).';
    }

    // Per-property city/local override, added on top of the state/county rate.
    var propRate = num(property && property.transferTaxRate);
    var propertyPortion = price * propRate;
    if (propRate > 0) note += ' Plus property-level ' + (propRate * 100) + '% (local/city).';

    return {
      total: statePortion + propertyPortion,
      statePortion: statePortion,
      propertyPortion: propertyPortion,
      stateCode: stateCode,
      note: note
    };
  }

  // ---------------------------------------------------------------------------
  //  DISPOSITION (a modeled sale).
  // ---------------------------------------------------------------------------
  function computeDisposition(p, ctx) {
    var tp = ctx.taxParams;
    var salePrice = ctx.marketValueAtSale;
    var sellingCosts = salePrice * num(p.sellingCostsPct);
    var amountRealized = salePrice - sellingCosts;

    var adjustedBasis = num(p.purchasePrice) + num(p.capitalImprovements) - ctx.accumulatedDepreciationAtSale;
    var totalGain = amountRealized - adjustedBasis;

    // Recapture (unrecaptured §1250) = depreciation taken, capped at the gain.
    var recapture = Math.max(0, Math.min(ctx.accumulatedDepreciationAtSale, totalGain));
    var rawCapitalGain = totalGain - recapture;

    // ---- §121 exclusion + use-test window ----
    var filing = ctx.filingStatus;
    var exclusionCap = (filing === 'Single') ? tp.federal.section121ExclusionSingle : tp.federal.section121ExclusionMFJ;
    var windowYears = num(tp.federal.section121UseTestWindowYears);
    var conv = yearNum(p.conversionYear);
    var section121Lost = false, section121Exclusion = 0, section121Note = '';
    if (p.section121Eligible) {
      if (conv !== null && ctx.saleYear > conv + windowYears) {
        // Converted to a rental and sold too late — exclusion forfeited.
        section121Lost = true;
        section121Note = 'Sale in ' + ctx.saleYear + ' is beyond the §121 use-test window (converted '
          + conv + ' + ' + windowYears + ' yrs = ' + (conv + windowYears)
          + '). Exclusion LOST — taxable gain rises accordingly.';
      } else {
        section121Exclusion = Math.min(exclusionCap, Math.max(0, rawCapitalGain));
        section121Note = (conv !== null)
          ? 'Within the §121 use-test window (converted ' + conv + '; must sell by ' + (conv + windowYears) + ').'
          : 'Primary-residence exclusion applied.';
      }
    }
    var taxableCapitalGain = Math.max(0, rawCapitalGain - section121Exclusion);

    // ---- Federal (provisional, via the swappable interface) ----
    var federal = ctx.taxInterface.computeFederalDispositionTax(
      { taxableCapitalGain: taxableCapitalGain, depreciationRecapture: recapture }, tp, ctx.structuralFacts);

    // ---- State (source vs resident, no double-count) ----
    var stateTaxableGain = Math.max(0, totalGain - section121Exclusion); // CA conforms to §121
    var sourceState = p.state, residentState = ctx.residentState;
    var sourceR = stateTaxForOneState(sourceState, stateTaxableGain, true, ctx.stateTable);
    var residentR = stateTaxForOneState(residentState, stateTaxableGain, true, ctx.stateTable);
    var stateTotal, stateExplanation, creditApplied = 0;
    if (sourceState === residentState) {
      stateTotal = sourceR.tax;
      stateExplanation = 'Property state and residence are the same (' + sourceState + '); taxed once.';
    } else {
      stateTotal = Math.max(sourceR.tax, residentR.tax);
      creditApplied = Math.min(sourceR.tax, residentR.tax);
      stateExplanation = 'Source ' + sourceState + ' ($' + Math.round(sourceR.tax) + ') and resident '
        + residentState + ' ($' + Math.round(residentR.tax) + '): resident credits the source tax, so you pay the higher.';
    }

    // ---- S-corp representation (attorney-verified in a later phase) ----
    var sCorp = null;
    if (p.ownershipEntity === 'S-Corp') {
      sCorp = {
        entityStockBasis: num(p.entityStockBasis),
        propertyInsideBasis: adjustedBasis,
        stockVsInsideDelta: adjustedBasis - num(p.entityStockBasis),
        note: 'Held in an S-corp: gain is recognized at the entity and passes through to the personal '
            + 'return in the sale year (the MAGI spike cannot be structured away — only timed). Stock basis '
            + 'vs property inside basis changes the true after-tax result and must be verified by a tax attorney '
            + '(also check built-in-gains exposure if ever a C-corp).'
      };
    }

    // ---- Real-estate transfer / excise tax (source-state; on the sale price) ----
    // Its own disposition line, separate from federal, state income tax, and
    // selling costs. No resident-state credit applies (it is a source-state tax).
    var transferTax = computeTransferTax(salePrice, sourceState, p, tp);

    var mortgagePayoff = ctx.mortgageBalanceAtSale;
    var netBeforeTax = salePrice - sellingCosts - mortgagePayoff;
    var totalTax = federal.total + stateTotal + transferTax.total;

    return {
      sold: true, saleYear: ctx.saleYear,
      salePrice: salePrice, sellingCosts: sellingCosts, amountRealized: amountRealized,
      adjustedBasis: adjustedBasis, accumulatedDepreciation: ctx.accumulatedDepreciationAtSale,
      totalGain: totalGain, depreciationRecapture: recapture, rawCapitalGain: rawCapitalGain,
      section121Eligible: !!p.section121Eligible, section121Exclusion: section121Exclusion,
      section121Lost: section121Lost, section121Note: section121Note,
      taxableCapitalGain: taxableCapitalGain,
      federal: federal,
      state: { sourceState: sourceState, residentState: residentState, sourceTax: sourceR.tax,
               residentTax: residentR.tax, creditApplied: creditApplied, total: stateTotal, explanation: stateExplanation },
      transferTax: transferTax,
      sCorp: sCorp,
      mortgagePayoff: mortgagePayoff, totalTax: totalTax,
      netBeforeTax: netBeforeTax, netAfterTax: netBeforeTax - totalTax,
      provisional: true
    };
  }

  // ---------------------------------------------------------------------------
  //  PROJECT ONE PROPERTY across the horizon.
  // ---------------------------------------------------------------------------
  function projectProperty(p, scenario, taxParams, structuralFacts, taxInterface, stateTable) {
    var startYear = scenario.startYear, horizon = scenario.horizonYears, a = scenario.assumptions;

    var originationYear = p.mortgageOriginationDate ? new Date(p.mortgageOriginationDate).getFullYear() : startYear;
    var remainingTerm = Math.max(0, num(p.mortgageTermYears) - Math.max(0, startYear - originationYear));
    var amort = buildAmortization(p.mortgageBalance, p.mortgageRate, remainingTerm, horizon);

    var dep = depreciationPlan(p, startYear);
    var accumulatedDepreciation = num(p.accumulatedDepreciation);

    var baseRevenue = baseGrossRevenue(p);
    var conv = yearNum(p.conversionYear);
    // Hold-indefinitely properties never model a sale.
    var saleYear = p.holdIndefinitely ? null : yearNum(p.plannedSaleYear);

    var prop13Cap = (taxParams.stateTax.CA && taxParams.stateTax.CA.prop13AnnualAssessmentCap) || 0;
    var benchmarkRate = num(a.benchmarkMortgageRate);

    var rows = [], disposition = null, soldOff = false;

    for (var t = 0; t < horizon; t++) {
      var calYear = startYear + t;
      var mort = amort[t] || { interest: 0, principal: 0, payment: 0, endingBalance: 0 };
      var marketValue = grow(p.marketValue, p.appreciationRate, t);

      if (soldOff) { rows.push(emptyRowAfterSale(calYear, t)); continue; }

      // Depreciation this year (only once in service, and only up to the cap).
      var thisYearDepr = 0;
      if (dep.inServiceStartYear !== null && calYear >= dep.inServiceStartYear
          && accumulatedDepreciation < dep.depreciableBasisCap) {
        thisYearDepr = Math.min(dep.annualDepreciation, dep.depreciableBasisCap - accumulatedDepreciation);
      }

      // Sale this year? Compute BEFORE advancing depreciation (recapture uses
      // depreciation taken through the prior year plus this year's is added after).
      if (saleYear === calYear) {
        disposition = computeDisposition(p, {
          saleYear: calYear,
          marketValueAtSale: marketValue,
          mortgageBalanceAtSale: (t > 0 ? amort[t - 1].endingBalance : num(p.mortgageBalance)),
          accumulatedDepreciationAtSale: accumulatedDepreciation,
          residentState: residencyForYear(scenario, t),
          taxParams: taxParams, structuralFacts: structuralFacts, taxInterface: taxInterface,
          filingStatus: structuralFacts.filingStatus, stateTable: stateTable
        });
      }

      // Rental revenue is zero before a primary→rental conversion.
      var rentalActive = (conv === null) || (calYear >= conv);
      var revenueFactor = Math.pow(1 + num(a.revenueGrowthRate), t);
      var expenseFactor = Math.pow(1 + num(a.expenseGrowthRate), t);

      var grossRevenue = rentalActive ? baseRevenue * revenueFactor : 0;
      var vacancyLoss = grossRevenue * num(p.vacancyAllowancePct);
      var effectiveRevenue = grossRevenue - vacancyLoss;

      var expLines = operatingExpenseLines(p, expenseFactor, marketValue);
      var totalOpex = sumLines(expLines);

      var noi = effectiveRevenue - totalOpex;
      var annualPI = mort.payment;
      var cashFlow = noi - annualPI;
      var equity = marketValue - mort.endingBalance;
      var returnOnEquity = (equity !== 0) ? cashFlow / equity : null;

      // Prop 13 assessed value (informational): capped-growth series.
      var prop13 = num(p.prop13AssessedValue) > 0 ? num(p.prop13AssessedValue) * Math.pow(1 + prop13Cap, t) : 0;
      // Below-market financing benefit (informational).
      var belowMarketAnnual = Math.max(0, mort.endingBalance * (benchmarkRate - num(p.mortgageRate)));

      accumulatedDepreciation += thisYearDepr;

      // B3: theoretical COST OF DIVESTITURE if this property were sold THIS year,
      // computed for every year (even hold-only) so the owner can see it. Per the
      // owner's decision this is the FULL cost: selling costs + transfer/excise
      // tax + capital-gains/recapture (income) tax — i.e. selling costs plus the
      // whole tax bill of a sale. It reuses the same disposition math as a modeled
      // sale. For the actual sale year we reuse the real `disposition` so the
      // columns agree with the sale-year tax detail below.
      var theo = (saleYear === calYear && disposition)
        ? disposition
        : computeDisposition(p, {
            saleYear: calYear,
            marketValueAtSale: marketValue,
            mortgageBalanceAtSale: mort.endingBalance,
            accumulatedDepreciationAtSale: accumulatedDepreciation,
            residentState: residencyForYear(scenario, t),
            taxParams: taxParams, structuralFacts: structuralFacts, taxInterface: taxInterface,
            filingStatus: structuralFacts.filingStatus, stateTable: stateTable
          });
      // totalTax already includes federal + state income tax + transfer tax.
      var salesCost = num(theo.sellingCosts) + num(theo.totalTax);
      var netEquity = equity - salesCost;

      rows.push({
        year: calYear, t: t,
        marketValue: marketValue, mortgageBalance: mort.endingBalance, equity: equity,
        grossRevenue: grossRevenue, vacancyLoss: vacancyLoss, effectiveRevenue: effectiveRevenue,
        rentalActive: rentalActive, expenseLines: expLines, totalOperatingExpenses: totalOpex,
        noi: noi, annualPI: annualPI, mortgageInterest: mort.interest, mortgagePrincipal: mort.principal,
        cashFlow: cashFlow, returnOnEquity: returnOnEquity,
        annualDepreciation: thisYearDepr, accumulatedDepreciation: accumulatedDepreciation,
        adjustedCostBasis: num(p.purchasePrice) + num(p.capitalImprovements) - accumulatedDepreciation,
        prop13AssessedValue: prop13, belowMarketFinancingAnnual: belowMarketAnnual,
        salesCost: salesCost, netEquity: netEquity,
        sold: false
      });

      if (saleYear === calYear) {
        rows[rows.length - 1].sold = true;
        rows[rows.length - 1].disposition = disposition;
        soldOff = true;
      }
    }

    return {
      id: p.id, name: p.name, state: p.state, ownershipEntity: p.ownershipEntity,
      holdIndefinitely: !!p.holdIndefinitely, converted: dep.converted, conversionYear: dep.conversionYear,
      isPlaceholder: !!p.isPlaceholder, rows: rows, disposition: disposition
    };
  }

  function residencyForYear(scenario, t) {
    var r = scenario.residencyByYear;
    if (Array.isArray(r) && r[t]) return r[t];
    return scenario.defaultResidency || 'CA';
  }

  function emptyRowAfterSale(calYear, t) {
    return { year: calYear, t: t, sold: true, alreadySold: true,
      marketValue: 0, mortgageBalance: 0, equity: 0, grossRevenue: 0, vacancyLoss: 0, effectiveRevenue: 0,
      expenseLines: {}, totalOperatingExpenses: 0, noi: 0, annualPI: 0, mortgageInterest: 0, mortgagePrincipal: 0,
      cashFlow: 0, returnOnEquity: null, annualDepreciation: 0, accumulatedDepreciation: 0, adjustedCostBasis: 0,
      prop13AssessedValue: 0, belowMarketFinancingAnnual: 0, salesCost: null, netEquity: null };
  }

  // Merge base state table with any user-defined custom states.
  function buildStateTable(taxParams, scenario) {
    var table = {};
    for (var k in taxParams.stateTax) if (taxParams.stateTax.hasOwnProperty(k)) table[k] = taxParams.stateTax[k];
    (scenario.customStates || []).forEach(function (s) {
      if (!s || !s.code) return;
      table[s.code] = { name: s.name || s.code, type: 'income', rate: num(s.rate), taxesNonResidentsOnSourceIncome: true };
    });
    return table;
  }

  // ---------------------------------------------------------------------------
  //  RUN THE WHOLE PORTFOLIO.  Public entry point.
  // ---------------------------------------------------------------------------
  function runProjection(scenario, taxParams, structuralFacts, taxInterface) {
    var horizon = scenario.horizonYears, startYear = scenario.startYear;
    var stateTable = buildStateTable(taxParams, scenario);

    var properties = scenario.properties.map(function (p) {
      return projectProperty(p, scenario, taxParams, structuralFacts, taxInterface, stateTable);
    });

    var portfolio = [], cumulativeSaleProceeds = 0;
    for (var t = 0; t < horizon; t++) {
      var tot = { year: startYear + t, t: t, marketValue: 0, mortgageBalance: 0, equity: 0,
                  noi: 0, cashFlow: 0, grossRevenue: 0, saleProceedsThisYear: 0 };
      properties.forEach(function (proj) {
        var row = proj.rows[t]; if (!row) return;
        tot.marketValue += num(row.marketValue); tot.mortgageBalance += num(row.mortgageBalance);
        tot.noi += num(row.noi); tot.cashFlow += num(row.cashFlow);
        tot.grossRevenue += num(row.grossRevenue);
        // B2: in the SALE year the property's value is realized as after-tax sale
        // proceeds (added below), so its equity must NOT also be counted in the
        // portfolio equity total — that was double-counting in RE wealth. A `sold`
        // row is either the sale year (equity still populated) or an already-sold
        // year (equity 0); skipping equity on any `sold` row is correct for both.
        if (!row.sold) tot.equity += num(row.equity);
        if (row.sold && row.disposition) tot.saleProceedsThisYear += num(row.disposition.netAfterTax);
      });
      cumulativeSaleProceeds += tot.saleProceedsThisYear;
      tot.cumulativeSaleProceeds = cumulativeSaleProceeds;
      tot.totalRealEstateWealth = tot.equity + cumulativeSaleProceeds;
      tot.returnOnEquity = (tot.equity !== 0) ? tot.cashFlow / tot.equity : null;
      portfolio.push(tot);
    }

    return {
      meta: { startYear: startYear, horizonYears: horizon, taxParamsVersion: taxParams.meta.version, anyProvisional: true },
      properties: properties, portfolio: portfolio
    };
  }

  return { runProjection: runProjection, _buildAmortization: buildAmortization, _computeDisposition: computeDisposition };
})();
