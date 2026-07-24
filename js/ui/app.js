/* =============================================================================
 *  app.js  —  THE USER INTERFACE (the only file that touches the page)
 * =============================================================================
 *  Responsibilities:
 *    - hold the current scenario (your editable data),
 *    - build the input controls from the field schema,
 *    - call the headless engine and render tables + charts on every change,
 *    - save/load the scenario as a JSON file you download / upload.
 *
 *  The engine (realEstateEngine.js) never runs anything here — this file calls
 *  INTO it. That separation is what lets a Python backend replace the engine
 *  later without rewriting the screen.
 *
 *  NOTE: We deliberately do NOT use localStorage/sessionStorage (they are
 *  unreliable in this setup). Persistence is via JSON file download/upload.
 * ---------------------------------------------------------------------------*/

(function () {
  'use strict';

  // ----- application state ---------------------------------------------------
  var scenario = FP.makeDefaultScenario(); // start from the placeholder portfolio

  // Map a tax-params version string to the actual parameter object.
  function getTaxParams() {
    // Only 2026 exists today; extend this when you add taxParams2027.js etc.
    return FP.taxParams2026;
  }

  // The state codes a property can sit in: the four built-ins plus any the user
  // has defined in the Custom states section.
  function allStateCodes() {
    var base = ['CA', 'WA', 'CO', 'OR'];
    (scenario.customStates || []).forEach(function (s) {
      if (s && s.code && base.indexOf(s.code) === -1) base.push(s.code);
    });
    return base;
  }
  // Residency can be WA or CA (spec §8), plus any custom state (a future domicile).
  function residencyOptions() {
    var base = ['WA', 'CA'];
    (scenario.customStates || []).forEach(function (s) {
      if (s && s.code && base.indexOf(s.code) === -1) base.push(s.code);
    });
    return base;
  }

  // ----- small DOM helpers ---------------------------------------------------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  function byId(id) { return document.getElementById(id); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Debounce so we don't recompute on every keystroke frame.
  var recalcTimer = null;
  function scheduleRecalc() {
    clearTimeout(recalcTimer);
    recalcTimer = setTimeout(refreshOutputs, 120);
  }

  // ----- build one editable field bound to an object -------------------------
  // Percentages are stored as decimals but shown/edited as percents.
  function makeField(obj, item) {
    var id = 'f_' + Math.random().toString(36).slice(2);
    var input;

    if (item.type === 'boolean') {
      input = el('input', { type: 'checkbox', id: id });
      input.checked = !!obj[item.key];
      input.addEventListener('change', function () {
        obj[item.key] = input.checked; scheduleRecalc();
      });
    } else if (item.type === 'select') {
      input = el('select', { id: id });
      item.options.forEach(function (opt) {
        var o = el('option', { value: opt }, [opt]);
        if (obj[item.key] === opt) o.selected = true;
        input.appendChild(o);
      });
      input.addEventListener('change', function () {
        obj[item.key] = input.value; scheduleRecalc();
      });
    } else {
      var isPct = item.type === 'percent';
      var isNumeric = ['currency', 'percent', 'number'].indexOf(item.type) !== -1;
      var shown = obj[item.key];
      if (isPct && typeof shown === 'number') shown = +(shown * 100).toFixed(4);
      if (shown === null || shown === undefined) shown = '';
      input = el('input', {
        type: isNumeric ? 'number' : 'text', id: id, value: shown,
        step: isPct ? '0.001' : 'any', inputmode: isNumeric ? 'decimal' : 'text'
      });
      input.addEventListener('input', function () {
        var v = input.value;
        if (item.type === 'year') {
          obj[item.key] = (v === '' || v === 'hold') ? 'hold' : Number(v);
        } else if (isNumeric) {
          var n = parseFloat(v);
          obj[item.key] = isNaN(n) ? 0 : (isPct ? n / 100 : n);
        } else {
          obj[item.key] = v;
        }
        scheduleRecalc();
      });
    }

    var unit = item.type === 'percent' ? ' (%)' : item.type === 'currency' ? ' ($)' : '';
    var label = el('label', { for: id, class: 'fp-field' }, [
      el('span', { class: 'fp-field-label' }, [item.label + unit]),
      input
    ]);
    if (item.help) label.appendChild(el('span', { class: 'fp-field-help' }, [item.help]));
    return label;
  }

  // ----- build the property editor cards -------------------------------------
  function buildPropertyEditors() {
    var wrap = byId('propertyEditors');
    clear(wrap);

    scenario.properties.forEach(function (p, idx) {
      var card = el('div', { class: 'fp-card' });
      var header = el('div', { class: 'fp-card-head' }, [
        el('h3', {}, [p.name || ('Property ' + (idx + 1))]),
        p.isPlaceholder ? el('span', { class: 'fp-badge fp-badge-ph' }, ['PLACEHOLDER']) : el('span'),
        el('button', { class: 'fp-btn fp-btn-danger', type: 'button' }, ['Remove'])
      ]);
      header.querySelector('button').addEventListener('click', function () {
        scenario.properties.splice(idx, 1);
        buildPropertyEditors(); scheduleRecalc();
      });
      card.appendChild(header);

      // Group fields by tier.
      [0, 1, 2, 3].forEach(function (tier) {
        var fields = FP.propertyFieldSchema.filter(function (f) { return f.tier === tier; });
        // Hold-indefinitely properties model no sale, so hide the sale fields.
        if (tier === 3 && p.holdIndefinitely) {
          fields = fields.filter(function (f) { return f.showIf !== 'sale'; });
        }
        if (!fields.length) return;
        card.appendChild(el('h4', { class: 'fp-tier' }, [FP.tierLabels[tier]]));
        var grid = el('div', { class: 'fp-fieldgrid' });
        fields.forEach(function (f) {
          // The property's state can be any built-in or custom state.
          var item = (f.key === 'state') ? Object.assign({}, f, { options: allStateCodes() }) : f;
          var fieldEl = makeField(p, item);
          grid.appendChild(fieldEl);
          // Toggling hold-indefinitely shows/hides the sale fields — rebuild.
          if (f.key === 'holdIndefinitely') {
            fieldEl.querySelector('input').addEventListener('change', function () { buildPropertyEditors(); });
          }
        });
        card.appendChild(grid);

        // Seasonal sub-block sits under Tier 2.
        if (tier === 2) {
          card.appendChild(el('h4', { class: 'fp-tier' }, ['Seasonal (short-term rental) detail']));
          var sgrid = el('div', { class: 'fp-fieldgrid' });
          FP.seasonalFieldSchema.forEach(function (f) { sgrid.appendChild(makeField(p.seasonal, f)); });
          card.appendChild(sgrid);
        }
      });

      if (p.notes) card.appendChild(el('p', { class: 'fp-notes' }, ['Note: ' + p.notes]));
      wrap.appendChild(card);
    });
  }

  // ----- build global settings + residency editor ----------------------------
  function buildGlobalControls() {
    var g = byId('globalControls');
    clear(g);

    // Horizon.
    var horizon = makeField(scenario, { key: 'horizonYears', label: 'Projection horizon', type: 'number',
      help: 'Number of years to project (default 30).' });
    // Rebuild residency + recompute when horizon changes.
    horizon.querySelector('input').addEventListener('change', function () {
      resizeResidency(); buildResidencyEditor(); buildPropertyEditors(); scheduleRecalc();
    });
    g.appendChild(horizon);

    g.appendChild(makeField(scenario, { key: 'startYear', label: 'Start year', type: 'number' }));
    g.appendChild(makeField(scenario.assumptions, { key: 'revenueGrowthRate', label: 'Revenue growth', type: 'percent' }));
    g.appendChild(makeField(scenario.assumptions, { key: 'expenseGrowthRate', label: 'Expense growth', type: 'percent' }));
  }

  function resizeResidency() {
    var want = Math.max(1, Math.round(scenario.horizonYears));
    var arr = scenario.residencyByYear.slice(0, want);
    while (arr.length < want) arr.push(scenario.defaultResidency || 'CA');
    scenario.residencyByYear = arr;
  }

  function buildResidencyEditor() {
    var host = byId('residencyEditor');
    clear(host);

    var controls = el('div', { class: 'fp-residency-controls' }, [
      el('span', {}, ['Set all years to: ']),
      el('button', { class: 'fp-btn', type: 'button' }, ['WA']),
      el('button', { class: 'fp-btn', type: 'button' }, ['CA'])
    ]);
    var btns = controls.querySelectorAll('button');
    btns[0].addEventListener('click', function () { setAllResidency('WA'); });
    btns[1].addEventListener('click', function () { setAllResidency('CA'); });
    host.appendChild(controls);

    var grid = el('div', { class: 'fp-residency-grid' });
    scenario.residencyByYear.forEach(function (r, t) {
      var year = scenario.startYear + t;
      var sel = el('select', {});
      residencyOptions().forEach(function (opt) {
        var o = el('option', { value: opt }, [opt]);
        if (r === opt) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        scenario.residencyByYear[t] = sel.value; scheduleRecalc();
      });
      grid.appendChild(el('label', { class: 'fp-residency-cell' }, [
        el('span', {}, [String(year)]), sel
      ]));
    });
    host.appendChild(grid);
  }

  function setAllResidency(state) {
    for (var t = 0; t < scenario.residencyByYear.length; t++) scenario.residencyByYear[t] = state;
    buildResidencyEditor(); scheduleRecalc();
  }

  // ----- custom (pluggable) states -------------------------------------------
  // Add a source state or a future domicile with its own income-tax rate. These
  // merge into the state-tax table and appear in the state / residency pickers.
  function buildCustomStates() {
    var host = byId('customStatesEditor');
    if (!host) return;
    clear(host);
    if (!scenario.customStates) scenario.customStates = [];

    scenario.customStates.forEach(function (s, idx) {
      var row = el('div', { class: 'fp-fieldgrid fp-customstate' });
      row.appendChild(makeField(s, { key: 'code', label: 'Code (e.g. AZ)', type: 'text' }));
      row.appendChild(makeField(s, { key: 'name', label: 'Name', type: 'text' }));
      row.appendChild(makeField(s, { key: 'rate', label: 'Income-tax rate', type: 'percent' }));
      var rm = el('button', { class: 'fp-btn fp-btn-danger', type: 'button' }, ['Remove']);
      rm.addEventListener('click', function () {
        scenario.customStates.splice(idx, 1);
        buildCustomStates(); buildResidencyEditor(); buildPropertyEditors(); scheduleRecalc();
      });
      row.appendChild(el('label', { class: 'fp-field' }, [el('span', { class: 'fp-field-label' }, [' ']), rm]));
      // Changing a code changes which options exist elsewhere — rebuild pickers.
      row.querySelectorAll('input').forEach(function (inp) {
        inp.addEventListener('change', function () { buildResidencyEditor(); buildPropertyEditors(); });
      });
      host.appendChild(row);
    });
  }

  // ----- compute + render outputs --------------------------------------------
  function seriesPerProperty(result, field) {
    return result.properties.map(function (proj, idx) {
      return {
        name: proj.name,
        color: FP.charts.PALETTE[idx % FP.charts.PALETTE.length],
        points: proj.rows.filter(function (r) { return r[field] !== null && !r.alreadySold; })
          .map(function (r) { return { x: r.year, y: r[field] }; })
      };
    });
  }
  function portfolioSeries(result, field, name, color) {
    return { name: name, color: color,
      points: result.portfolio.map(function (r) { return { x: r.year, y: r[field] }; }) };
  }

  function refreshOutputs() {
    var result = FP.engine.runProjection(scenario, getTaxParams(), FP.structuralFacts, FP.taxInterface);

    // Headline metric cards (current year = year 1).
    var cards = byId('summaryCards');
    clear(cards);
    var y0 = result.portfolio[0];
    cards.appendChild(metricCard('Total equity (year 1)', FP.fmt.money(y0.equity)));
    cards.appendChild(metricCard('Total value (year 1)', FP.fmt.money(y0.marketValue)));
    cards.appendChild(metricCard('Total NOI (year 1)', FP.fmt.money(y0.noi), true));
    cards.appendChild(metricCard('Total cash flow (year 1)', FP.fmt.money(y0.cashFlow)));
    cards.appendChild(metricCard('Portfolio return on equity', FP.fmt.roe(y0.returnOnEquity), true));

    // Per-property headline row — NOI and ROE are the two decision metrics.
    var propCards = byId('propertyMetricCards');
    clear(propCards);
    result.properties.forEach(function (proj, idx) {
      var r0 = proj.rows[0];
      var line = 'NOI ' + FP.fmt.money(r0.noi) + ' · ROE ' + FP.fmt.roe(r0.returnOnEquity)
        + ' · CF ' + FP.fmt.money(r0.cashFlow);
      if (r0.belowMarketFinancingAnnual > 0) {
        line += ' · below-mkt financing ~' + FP.fmt.money(r0.belowMarketFinancingAnnual) + '/yr';
      }
      var c = metricCard(proj.name + (proj.holdIndefinitely ? ' (hold)' : ''), line);
      c.style.borderTopColor = FP.charts.PALETTE[idx % FP.charts.PALETTE.length];
      propCards.appendChild(c);
    });

    // Charts.
    var charts = byId('charts');
    clear(charts);
    charts.appendChild(chartBlock(FP.charts.lineChart({
      title: 'Market value by property', yFormat: FP.fmt.money,
      series: seriesPerProperty(result, 'marketValue') })));
    charts.appendChild(chartBlock(FP.charts.lineChart({
      title: 'Equity by property', yFormat: FP.fmt.money,
      series: seriesPerProperty(result, 'equity') })));
    charts.appendChild(chartBlock(FP.charts.lineChart({
      title: 'Cash flow by property', yFormat: FP.fmt.money,
      series: seriesPerProperty(result, 'cashFlow') })));
    charts.appendChild(chartBlock(FP.charts.lineChart({
      title: 'NOI by property', yFormat: FP.fmt.money,
      series: seriesPerProperty(result, 'noi') })));
    charts.appendChild(chartBlock(FP.charts.lineChart({
      title: 'Return on equity by property', yFormat: function (v) { return (v * 100).toFixed(0) + '%'; },
      series: seriesPerProperty(result, 'returnOnEquity') })));
    charts.appendChild(chartBlock(FP.charts.lineChart({
      title: 'Portfolio totals', yFormat: FP.fmt.money,
      series: [
        portfolioSeries(result, 'marketValue', 'Total value', FP.charts.PALETTE[0]),
        portfolioSeries(result, 'equity', 'Total equity', FP.charts.PALETTE[2]),
        portfolioSeries(result, 'totalRealEstateWealth', 'RE wealth (equity + sales)', FP.charts.PALETTE[3])
      ] })));

    // Tables.
    var pt = byId('portfolioTable');
    clear(pt); pt.innerHTML = FP.tables.portfolioTable(result.portfolio);

    var propTables = byId('propertyTables');
    clear(propTables);
    result.properties.forEach(function (proj) {
      var details = el('details', { class: 'fp-details' });
      details.appendChild(el('summary', {}, [proj.name + ' — yearly detail']));
      var box = el('div');
      box.innerHTML = FP.tables.propertyTable(proj);
      details.appendChild(box);
      propTables.appendChild(details);
    });

    // Disposition (sale-year tax) details.
    var disp = byId('dispositions');
    clear(disp);
    var anySale = false;
    result.properties.forEach(function (proj) {
      if (proj.disposition) {
        anySale = true;
        var box = el('div');
        box.innerHTML = FP.tables.dispositionDetail(proj.name, proj.disposition);
        disp.appendChild(box);
      }
    });
    if (!anySale) disp.appendChild(el('p', { class: 'fp-muted' }, ['No sales modeled in the horizon. Set a "Planned sale year" on a property to see sale-year tax detail.']));
  }

  function metricCard(label, value, highlight) {
    return el('div', { class: 'fp-metric' + (highlight ? ' fp-metric-hi' : '') }, [
      el('div', { class: 'fp-metric-value' }, [value]),
      el('div', { class: 'fp-metric-label' }, [label])
    ]);
  }
  function chartBlock(html) {
    var d = el('div', { class: 'fp-chartcard' }); d.innerHTML = html; return d;
  }

  // ----- save / load / reset -------------------------------------------------
  function saveScenario() {
    var data = JSON.stringify(scenario, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'real-estate-scenario.json' });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  function loadScenario(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        if (!obj.properties) throw new Error('Not a scenario file.');
        scenario = obj;
        if (!scenario.residencyByYear) { scenario.residencyByYear = []; resizeResidency(); }
        if (!scenario.customStates) scenario.customStates = [];
        if (!scenario.assumptions) scenario.assumptions = {};
        migrateScenario(scenario);
        rebuildEverything();
      } catch (e) {
        alert('Could not load that file: ' + e.message);
      }
    };
    reader.readAsText(file);
  }
  function resetScenario() {
    scenario = FP.makeDefaultScenario();
    rebuildEverything();
  }

  // Bring an older saved scenario up to the current schema so the editors show
  // sensible values. Currently: B4 split a single seasonal `occupancyPct` into
  // separate peak / off-season occupancy — carry the old value onto both.
  function migrateScenario(sc) {
    (sc.properties || []).forEach(function (p) {
      var s = p.seasonal;
      if (!s) return;
      if (s.occupancyPct !== undefined && s.occupancyPct !== null) {
        if (s.peakOccupancyPct === undefined || s.peakOccupancyPct === null) s.peakOccupancyPct = s.occupancyPct;
        if (s.offSeasonOccupancyPct === undefined || s.offSeasonOccupancyPct === null) s.offSeasonOccupancyPct = s.occupancyPct;
        delete s.occupancyPct;
      }
    });
  }

  function rebuildEverything() {
    buildGlobalControls();
    buildResidencyEditor();
    buildCustomStates();
    buildPropertyEditors();
    refreshOutputs();
  }

  // ----- tabs ----------------------------------------------------------------
  // Plain CSS/JS tabs: clicking a tab button shows its panel and hides the rest.
  // No libraries; the whole app is already loaded, so switching is instant.
  function setupTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.fp-tab'));
    function show(name) {
      tabs.forEach(function (btn) {
        var selected = btn.getAttribute('data-tab') === name;
        btn.setAttribute('aria-selected', selected ? 'true' : 'false');
        var panel = byId('panel-' + btn.getAttribute('data-tab'));
        if (panel) panel.hidden = !selected;
      });
      // Scroll back to the top of the content when switching tabs (nice on iPad).
      if (window.scrollTo) window.scrollTo(0, 0);
    }
    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () { show(btn.getAttribute('data-tab')); });
    });
    show('dashboard'); // default landing tab
  }

  // ----- wire up the page ----------------------------------------------------
  function init() {
    setupTabs();
    byId('btnSave').addEventListener('click', saveScenario);
    byId('btnReset').addEventListener('click', resetScenario);
    byId('fileLoad').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) loadScenario(e.target.files[0]);
      e.target.value = '';
    });
    byId('btnAddProperty').addEventListener('click', function () {
      var p = FP.makeDefaultScenario().properties[2]; // clone a simple rental
      p = JSON.parse(JSON.stringify(p));
      p.id = 'prop-' + Date.now();
      p.name = 'New property';
      scenario.properties.push(p);
      buildPropertyEditors(); scheduleRecalc();
    });
    var addState = byId('btnAddState');
    if (addState) addState.addEventListener('click', function () {
      if (!scenario.customStates) scenario.customStates = [];
      scenario.customStates.push({ code: '', name: '', rate: 0.05 });
      buildCustomStates();
    });
    rebuildEverything();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
