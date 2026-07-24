/* =============================================================================
 *  format.js  —  number formatting helpers for the UI
 * =============================================================================
 *  Small, dependency-free helpers to turn raw numbers into readable strings.
 *  These are display-only; they never affect calculations.
 * ---------------------------------------------------------------------------*/

window.FP = window.FP || {};

FP.fmt = {
  // Whole-dollar currency, e.g. 1234567 -> "$1,234,567". Negatives in ( ).
  money: function (x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    var n = Math.round(x);
    var neg = n < 0;
    var s = Math.abs(n).toLocaleString('en-US');
    return neg ? '($' + s + ')' : '$' + s;
  },

  // Percent from a DECIMAL, e.g. 0.0364 -> "3.6%".
  pct: function (x, digits) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    var d = (digits === undefined) ? 1 : digits;
    return (x * 100).toFixed(d) + '%';
  },

  // Return-on-equity can be null (no equity). Show 1 decimal percent.
  roe: function (x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    return (x * 100).toFixed(1) + '%';
  },

  // A plain number with no decimals.
  int: function (x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    return Math.round(x).toLocaleString('en-US');
  }
};
