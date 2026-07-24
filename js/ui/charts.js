/* =============================================================================
 *  charts.js  —  tiny inline-SVG line charts (NO external libraries)
 * =============================================================================
 *  Draws simple multi-series line charts as SVG markup strings. The UI drops
 *  the returned string into the page. SVG scales cleanly on a tablet because we
 *  use a viewBox and let CSS size the width to 100%.
 *
 *  Usage:
 *    FP.charts.lineChart({
 *      series: [{ name:'CA-Primary', color:'#3b6', points:[{x:2026,y:500000}, ...] }],
 *      yFormat: FP.fmt.money,   // how to label the Y axis
 *      title: 'Market value'
 *    })  ->  "<svg ...>...</svg>"
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {};

FP.charts = (function () {
  'use strict';

  // A colour-blind-friendly palette (used in order). Documented, not magic.
  var PALETTE = ['#2f7ed8', '#e07b39', '#3aab5c', '#a052c0', '#d24b6a', '#7f8c8d'];

  function niceMax(v) {
    if (v <= 0) return 1;
    var pow = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / pow;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nice * pow;
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function lineChart(cfg) {
    var series = cfg.series || [];
    var yFormat = cfg.yFormat || FP.fmt.int;

    // Drawing area in SVG user units (viewBox coordinates).
    var W = 720, H = 360;
    var padL = 84, padR = 16, padT = 16, padB = 44;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    // Collect x (years) and y ranges across all series.
    var allX = [], minY = 0, maxY = 0;
    series.forEach(function (s) {
      s.points.forEach(function (pt) {
        if (allX.indexOf(pt.x) === -1) allX.push(pt.x);
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      });
    });
    allX.sort(function (a, b) { return a - b; });
    if (allX.length === 0) return '<svg viewBox="0 0 ' + W + ' ' + H + '"></svg>';

    var xMin = allX[0], xMax = allX[allX.length - 1];
    var yTop = niceMax(maxY);
    var yBot = minY < 0 ? -niceMax(-minY) : 0;

    function sx(x) { return padL + (xMax === xMin ? 0 : (x - xMin) / (xMax - xMin) * plotW); }
    function sy(y) { return padT + (yTop === yBot ? 0 : (yTop - y) / (yTop - yBot) * plotH); }

    var svg = [];
    svg.push('<svg viewBox="0 0 ' + W + ' ' + H + '" class="fp-chart" '
      + 'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(cfg.title || 'chart') + '">');

    // Horizontal gridlines + Y labels (5 steps).
    var steps = 5;
    for (var i = 0; i <= steps; i++) {
      var yVal = yBot + (yTop - yBot) * i / steps;
      var y = sy(yVal);
      svg.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y
        + '" class="fp-grid"/>');
      svg.push('<text x="' + (padL - 8) + '" y="' + (y + 4) + '" class="fp-axislabel" '
        + 'text-anchor="end">' + esc(yFormat(yVal)) + '</text>');
    }

    // Zero baseline emphasized if range crosses zero.
    if (yBot < 0) {
      var y0 = sy(0);
      svg.push('<line x1="' + padL + '" y1="' + y0 + '" x2="' + (W - padR) + '" y2="' + y0
        + '" class="fp-zero"/>');
    }

    // X labels (about 6 evenly spaced years).
    var xStep = Math.max(1, Math.round(allX.length / 6));
    for (var j = 0; j < allX.length; j += xStep) {
      var xv = allX[j];
      svg.push('<text x="' + sx(xv) + '" y="' + (H - padB + 20) + '" class="fp-axislabel" '
        + 'text-anchor="middle">' + xv + '</text>');
    }

    // Each series as a polyline.
    series.forEach(function (s, idx) {
      var color = s.color || PALETTE[idx % PALETTE.length];
      var pts = s.points.slice().sort(function (a, b) { return a.x - b.x; })
        .map(function (pt) { return sx(pt.x) + ',' + sy(pt.y); }).join(' ');
      svg.push('<polyline points="' + pts + '" fill="none" stroke="' + color
        + '" stroke-width="2.5" />');
    });

    svg.push('</svg>');

    // Legend as HTML chips (outside the SVG so text stays crisp).
    var legend = '<div class="fp-legend">' + series.map(function (s, idx) {
      var color = s.color || PALETTE[idx % PALETTE.length];
      return '<span class="fp-legend-item"><span class="fp-swatch" style="background:'
        + color + '"></span>' + esc(s.name) + '</span>';
    }).join('') + '</div>';

    var titleHtml = cfg.title ? '<div class="fp-chart-title">' + esc(cfg.title) + '</div>' : '';
    return titleHtml + '<div class="fp-chart-wrap">' + svg.join('') + '</div>' + legend;
  }

  return { lineChart: lineChart, PALETTE: PALETTE };
})();
