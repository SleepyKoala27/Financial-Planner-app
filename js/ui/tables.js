/* =============================================================================
 *  tables.js  —  builds the numeric output tables (HTML strings)
 * =============================================================================
 *  Turns the engine's results object into HTML tables. Wrapped in a scrolling
 *  container so wide tables scroll sideways instead of breaking the layout on a
 *  tablet.
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {};

FP.tables = (function () {
  'use strict';
  var m = function (x) { return FP.fmt.money(x); };
  var roe = function (x) { return FP.fmt.roe(x); };

  function scroll(inner) { return '<div class="fp-tablescroll">' + inner + '</div>'; }

  // Per-property year-by-year table.
  function propertyTable(proj) {
    // "Sales cost" and "Net equity" are the theoretical cost of selling that year
    // (selling costs + transfer tax + capital-gains/recapture tax) and the equity
    // left after paying it. Shown for every year, including hold-only properties.
    var head = '<tr><th>Year</th><th>Market value</th><th>Mortgage</th><th>Equity</th>'
      + '<th title="If sold this year: selling costs + transfer tax + capital-gains/recapture tax">Sales cost (if sold)</th>'
      + '<th title="Equity minus the theoretical sales cost">Net equity</th>'
      + '<th>NOI</th><th>P&amp;I</th><th>Cash flow</th><th>Return on equity</th>'
      + '<th>Accum. deprec.</th><th>Adj. basis</th></tr>';
    var body = proj.rows.map(function (r) {
      if (r.alreadySold) {
        return '<tr class="fp-sold-row"><td>' + r.year + '</td>'
          + '<td colspan="11">— sold —</td></tr>';
      }
      var soldTag = r.sold ? ' <span class="fp-badge fp-badge-sale">SOLD</span>' : '';
      return '<tr>'
        + '<td>' + r.year + soldTag + '</td>'
        + '<td>' + m(r.marketValue) + '</td>'
        + '<td>' + m(r.mortgageBalance) + '</td>'
        + '<td>' + m(r.equity) + '</td>'
        + '<td>' + m(r.salesCost) + '</td>'
        + '<td>' + m(r.netEquity) + '</td>'
        + '<td>' + m(r.noi) + '</td>'
        + '<td>' + m(r.annualPI) + '</td>'
        + '<td class="' + (r.cashFlow < 0 ? 'fp-neg' : 'fp-pos') + '">' + m(r.cashFlow) + '</td>'
        + '<td>' + roe(r.returnOnEquity) + '</td>'
        + '<td>' + m(r.accumulatedDepreciation) + '</td>'
        + '<td>' + m(r.adjustedCostBasis) + '</td>'
        + '</tr>';
    }).join('');
    return scroll('<table class="fp-table">' + head + body + '</table>');
  }

  // Portfolio totals table.
  function portfolioTable(portfolio) {
    var head = '<tr><th>Year</th><th>Total value</th><th>Total mortgage</th>'
      + '<th>Total equity</th><th>Total NOI</th><th>Total cash flow</th>'
      + '<th>Sale proceeds (after-tax)</th><th>RE wealth (equity + sales)</th></tr>';
    var body = portfolio.map(function (r) {
      return '<tr>'
        + '<td>' + r.year + '</td>'
        + '<td>' + m(r.marketValue) + '</td>'
        + '<td>' + m(r.mortgageBalance) + '</td>'
        + '<td>' + m(r.equity) + '</td>'
        + '<td>' + m(r.noi) + '</td>'
        + '<td class="' + (r.cashFlow < 0 ? 'fp-neg' : 'fp-pos') + '">' + m(r.cashFlow) + '</td>'
        + '<td>' + (r.saleProceedsThisYear ? m(r.saleProceedsThisYear) : '—') + '</td>'
        + '<td>' + m(r.totalRealEstateWealth) + '</td>'
        + '</tr>';
    }).join('');
    return scroll('<table class="fp-table">' + head + body + '</table>');
  }

  // Sale-year tax detail for a single disposition.
  function dispositionDetail(name, d) {
    if (!d) return '';
    var f = d.federal;
    var rows = [
      ['Sale price', m(d.salePrice)],
      ['Selling costs', m(-d.sellingCosts)],
      ['Amount realized', m(d.amountRealized)],
      ['Adjusted cost basis', m(d.adjustedBasis)],
      ['— of which accumulated depreciation', m(d.accumulatedDepreciation)],
      ['TOTAL GAIN', m(d.totalGain)],
      ['Depreciation recapture (taxed ≤25%, NOT sheltered by §121)', m(d.depreciationRecapture)],
      ['Capital gain (before §121)', m(d.rawCapitalGain)],
      ['§121 exclusion applied', d.section121Eligible ? m(-d.section121Exclusion) : 'n/a'],
      ['Taxable capital gain', m(d.taxableCapitalGain)]
    ];
    var federalRows = [
      ['Federal capital-gains tax', m(f.breakdown.capitalGainsTax)],
      ['Federal recapture tax (25%)', m(f.breakdown.recaptureTax)],
      ['Federal NIIT (3.8%)', m(f.breakdown.niitTax)],
      ['Federal total (PROVISIONAL)', m(f.total)]
    ];
    var stateRows = [
      ['Source state (' + d.state.sourceState + ') tax', m(d.state.sourceTax)],
      ['Resident state (' + d.state.residentState + ') tax', m(d.state.residentTax)],
      ['Credit applied (no double tax)', m(d.state.creditApplied)],
      ['State total', m(d.state.total)]
    ];
    var tt = d.transferTax || { total: 0, statePortion: 0, propertyPortion: 0, note: '' };
    var transferRows = [
      [(tt.stateCode || d.state.sourceState) + ' transfer/excise tax (on sale price)', m(tt.statePortion)],
      ['Property-level (city/local) transfer tax', m(tt.propertyPortion)],
      ['Transfer tax total', m(tt.total)]
    ];
    var proceeds = [
      ['Net before tax (price − costs − payoff)', m(d.netBeforeTax)],
      ['Mortgage payoff', m(-d.mortgagePayoff)],
      ['Total tax (federal + state + transfer)', m(-d.totalTax)],
      ['NET AFTER-TAX PROCEEDS', m(d.netAfterTax)]
    ];

    function block(title, arr, cls) {
      return '<div class="fp-detail-block ' + (cls || '') + '"><h4>' + title + '</h4>'
        + '<table class="fp-kv">' + arr.map(function (kv) {
            return '<tr><td>' + kv[0] + '</td><td class="fp-num">' + kv[1] + '</td></tr>';
          }).join('') + '</table></div>';
    }

    // §121 window note (warning if the exclusion was lost).
    var s121 = '';
    if (d.section121Note) {
      s121 = '<p class="' + (d.section121Lost ? 'fp-warning' : 'fp-muted') + '">'
        + (d.section121Lost ? '⚠️ §121 LOST — ' : '§121: ') + d.section121Note + '</p>';
    }
    // S-corp pass-through note.
    var sCorp = '';
    if (d.sCorp) {
      sCorp = '<div class="fp-detail-block"><h4>S-corp ownership</h4>'
        + '<table class="fp-kv">'
        + '<tr><td>Property inside basis</td><td class="fp-num">' + m(d.sCorp.propertyInsideBasis) + '</td></tr>'
        + '<tr><td>Entity stock basis</td><td class="fp-num">' + m(d.sCorp.entityStockBasis) + '</td></tr>'
        + '<tr><td>Inside − stock basis delta</td><td class="fp-num">' + m(d.sCorp.stockVsInsideDelta) + '</td></tr>'
        + '</table><p class="fp-muted">' + d.sCorp.note + '</p></div>';
    }

    return '<div class="fp-disposition">'
      + '<h3>' + name + ' — sale in ' + d.saleYear + '</h3>'
      + '<p class="fp-provisional-note">⚠️ Federal tax is <strong>PROVISIONAL</strong>: '
      + f.assumptions.note + '</p>'
      + s121
      + '<div class="fp-detail-grid">'
      + block('Gain breakdown', rows)
      + block('Federal (provisional)', federalRows, 'fp-provisional')
      + block('State income tax — ' + d.state.explanation, stateRows)
      + block('Transfer / excise tax — ' + (tt.note || 'source-state tax on sale price; no resident credit'), transferRows)
      + block('Net proceeds', proceeds)
      + sCorp
      + '</div></div>';
  }

  return {
    propertyTable: propertyTable,
    portfolioTable: portfolioTable,
    dispositionDetail: dispositionDetail
  };
})();
