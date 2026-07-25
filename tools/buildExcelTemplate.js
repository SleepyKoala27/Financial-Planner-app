/* =============================================================================
 *  tools/buildExcelTemplate.js  —  generates "Property Data Collection Template.xlsx"
 * =============================================================================
 *
 *  A BUILD TOOL (not part of the app, not loaded by the page). Run with:
 *      node tools/buildExcelTemplate.js
 *
 *  It reads the SAME field schema + demo scenario the app uses, and writes an
 *  .xlsx whose labels (column B) / values (column C) round-trip through
 *  js/ui/excelImport.js. Tabs: README, EXAMPLE-Format, one per demo property.
 *
 *  The workbook is written with STORED (uncompressed) ZIP entries and inline
 *  strings, using only Node's built-ins — no libraries, matching the project's
 *  dependency-free rule. Excel opens it fine; the importer reads it back.
 *
 *  Everything here is FICTIONAL DEMO data (safe for this public repo).
 * ---------------------------------------------------------------------------*/
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

// ---- load the app's schema + demo data under a window shim -------------------
const sandbox = { Date, Math, Number, isFinite, isNaN, Array, Object, JSON, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
['js/params/taxParams2026.js', 'js/params/structuralFacts.js', 'js/inputs/fieldSchema.js', 'js/inputs/userInputs.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }));
const FP = sandbox.window.FP;

// ---- CRC-32 (for ZIP entries) ------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---- minimal ZIP writer (STORED entries) -------------------------------------
function zip(files) {
  // files: [{ name, data: Buffer }]
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const data = f.data;
    const crc = crc32(data);
    const nameBuf = Buffer.from(f.name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(0, 8);            // method 0 = stored
    local.writeUInt16LE(0, 10);           // mod time
    local.writeUInt16LE(0x21, 12);        // mod date (arbitrary valid: 1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // extra len
    chunks.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);      // central dir header signature
    cd.writeUInt16LE(20, 4);              // version made by
    cd.writeUInt16LE(20, 6);              // version needed
    cd.writeUInt16LE(0, 8);               // flags
    cd.writeUInt16LE(0, 10);              // method
    cd.writeUInt16LE(0, 12);              // mod time
    cd.writeUInt16LE(0x21, 14);           // mod date
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);              // extra len
    cd.writeUInt16LE(0, 32);              // comment len
    cd.writeUInt16LE(0, 34);             // disk number
    cd.writeUInt16LE(0, 36);             // internal attrs
    cd.writeUInt32LE(0, 38);             // external attrs
    cd.writeUInt32LE(offset, 42);        // local header offset
    central.push(Buffer.concat([cd, nameBuf]));

    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// ---- XML helpers -------------------------------------------------------------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function cellXml(ref, value) {
  if (value === null || value === undefined || value === '') return `<c r="${ref}"/>`;
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}
function sheetXml(rows) {
  // rows: array of arrays; each inner array is [colA, colB, colC, colD, ...]
  const cols = 'ABCDEFGHIJ'.split('');
  let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  rows.forEach((row, ri) => {
    const r = ri + 1;
    out += `<row r="${r}">`;
    row.forEach((val, ci) => { out += cellXml(cols[ci] + r, val); });
    out += '</row>';
  });
  out += '</sheetData></worksheet>';
  return out;
}

// ---- build the label/value rows for one property ----------------------------
// Percent fields are written as DECIMALS (0.05 = 5%), matching the scenario and
// how Excel stores a percent-formatted cell; the importer reads them as decimals.
const PERCENT = new Set(['annualDepreciationRate', 'capitalReservePctOfValue', 'vacancyAllowancePct',
  'mortgageRate', 'appreciationRate', 'sellingCostsPct', 'transferTaxRate',
  'seasonal.peakOccupancyPct', 'seasonal.offSeasonOccupancyPct']);

function unitFor(f, key) {
  if (PERCENT.has(key)) return 'decimal (0.05 = 5%)';
  if (f.type === 'currency') return 'dollars';
  if (f.type === 'date') return 'YYYY-MM-DD';
  if (f.type === 'year') return 'year or "hold"';
  if (f.type === 'boolean') return 'TRUE / FALSE';
  return '';
}
function valFor(p, key, isSeasonal) {
  const v = isSeasonal ? (p.seasonal || {})[key.split('.')[1]] : p[key];
  if (v === null || v === undefined) return '';
  return v;
}

function propertyRows(p, blank) {
  const rows = [];
  rows.push(['Tier', 'Field (do not edit labels in column B)', 'Value (enter in column C)', 'Units / notes']);

  const tierNames = FP.tierLabels;
  [0, 1, 2, 3].forEach(tier => {
    const fields = FP.propertyFieldSchema.filter(f => f.tier === tier);
    if (!fields.length) return;
    rows.push([tierNames[tier], '', '', '']);
    fields.forEach(f => {
      rows.push(['', f.label, blank ? '' : valFor(p, f.key, false), unitFor(f, f.key)]);
    });
    if (tier === 2) {
      rows.push(['Seasonal (short-term rental) detail', '', '', '']);
      FP.seasonalFieldSchema.forEach(f => {
        const key = 'seasonal.' + f.key;
        rows.push(['', f.label, blank ? '' : valFor(p, key, true), unitFor(f, key)]);
      });
    }
  });

  // Computed reference values (informational; the importer ignores these labels).
  rows.push(['Computed (reference only — not imported)', '', '', '']);
  if (blank) {
    rows.push(['', 'Adjusted cost basis (purchase + improvements − depreciation)', '', 'dollars']);
    rows.push(['', 'Equity (market value − mortgage)', '', 'dollars']);
  } else {
    const adjBasis = (p.purchasePrice || 0) + (p.capitalImprovements || 0) - (p.accumulatedDepreciation || 0);
    const equity = (p.marketValue || 0) - (p.mortgageBalance || 0);
    rows.push(['', 'Adjusted cost basis (purchase + improvements − depreciation)', adjBasis, 'dollars']);
    rows.push(['', 'Equity (market value − mortgage)', equity, 'dollars']);
  }
  return rows;
}

function readmeRows(blank) {
  return [
    ['Real-Estate Modeling Engine — ' + (blank ? 'Property Data Input (blank)' : 'Property Data Collection Template')],
    [''],
    ['How to use this workbook:'],
    ['1. There is one tab per property (Property 1, Property 2, …). Copy a property tab to add more.'],
    ['2. On each property tab, enter values in COLUMN C only. Do NOT change the labels in column B.'],
    ['3. Start by filling "Property name" and "State" at the top, then work down the tiers.'],
    ['4. Rates are DECIMALS: 0.05 means 5%. (In Excel you can format the cell as a percentage; the stored value is still the decimal.)'],
    ['5. Dates are YYYY-MM-DD text (e.g. 2019-06-01).'],
    ['6. Years are a 4-digit year, or the word "hold" for no sale / no conversion.'],
    ['7. TRUE/FALSE fields: type TRUE or FALSE.'],
    ['8. Peak vs off-season occupancy are separate — fill both if the property is a seasonal short-term rental.'],
    ['9. You can leave any field blank — the app fills a sensible default (e.g. 30-year mortgage term, 6% selling costs).'],
    [''],
    ['See the EXAMPLE-Format tab for a fully filled-in property you can copy the style from.'],
    [''],
    ['Importing:'],
    ['- In the app, open the Data tab and choose "Import from Excel (.xlsx)". The file is read on your device only; nothing is uploaded.'],
    ['- Only tabs that contain data are imported. Empty property tabs are skipped.'],
    ['- After importing, review the numbers, then use "Save scenario (JSON)" to keep them on your device.'],
    [''],
    ['The README, EXAMPLE-Format and any Portfolio-Summary tabs are ignored on import — only property tabs are read.'],
    [''],
    [blank
      ? 'NOTE: The property tabs are blank and ready for your data. The EXAMPLE-Format tab holds FICTIONAL demo values for reference only.'
      : 'NOTE: Every value already in this template is FICTIONAL DEMO data. Replace it with your own.']
  ];
}

// ---- assemble the workbook ---------------------------------------------------
// Modes:
//   node tools/buildExcelTemplate.js            -> demo-filled template
//   node tools/buildExcelTemplate.js --blank    -> blank input file (empty tabs)
//   ... --blank --tabs=6                         -> N blank property tabs (default 6)
const BLANK = process.argv.includes('--blank');
const tabsArg = (process.argv.find(a => a.indexOf('--tabs=') === 0) || '').split('=')[1];
const BLANK_TABS = Math.max(1, Math.min(30, parseInt(tabsArg, 10) || 6));

const scenario = FP.makeDefaultScenario();
const demoProps = scenario.properties;

const sheets = [];
sheets.push({ name: 'README', rows: readmeRows(BLANK) });
// A fully filled property is always kept as a visual reference (importer skips it).
sheets.push({ name: 'EXAMPLE-Format', rows: propertyRows(demoProps[0], false) });

if (BLANK) {
  for (let i = 0; i < BLANK_TABS; i++) {
    sheets.push({ name: 'Property ' + (i + 1), rows: propertyRows({}, true) });
  }
} else {
  demoProps.forEach((p, i) => {
    // Sheet names: keep short, strip characters Excel forbids in tab names.
    let nm = (p.name || ('Property ' + (i + 1))).replace(/[\[\]\:\*\?\/\\]/g, ' ').trim().slice(0, 28) || ('Property ' + (i + 1));
    sheets.push({ name: nm, rows: propertyRows(p, false) });
  });
}

// Parts.
const parts = [];
const contentOverrides = [];
const wbSheets = [];
const wbRels = [];
sheets.forEach((sh, i) => {
  const idx = i + 1;
  const partName = `xl/worksheets/sheet${idx}.xml`;
  parts.push({ name: partName, data: Buffer.from(sheetXml(sh.rows), 'utf8') });
  contentOverrides.push(`<Override PartName="/${partName}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  wbSheets.push(`<sheet name="${esc(sh.name)}" sheetId="${idx}" r:id="rId${idx}"/>`);
  wbRels.push(`<Relationship Id="rId${idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx}.xml"/>`);
});

const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
  + contentOverrides.join('') + '</Types>';

const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
  + '</Relationships>';

const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
  + '<sheets>' + wbSheets.join('') + '</sheets></workbook>';

const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + wbRels.join('') + '</Relationships>';

const files = [
  { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
  { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
  { name: 'xl/workbook.xml', data: Buffer.from(workbook, 'utf8') },
  { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels, 'utf8') },
  ...parts
];

const out = zip(files);
const outName = BLANK ? 'Property Data Input (blank).xlsx' : 'Property Data Collection Template.xlsx';
const outPath = path.join(ROOT, outName);
fs.writeFileSync(outPath, out);
console.log('Wrote', outPath, '(' + out.length + ' bytes, ' + files.length + ' parts, ' + sheets.length + ' sheets)');
void zlib; // (kept available if a future version wants deflate)
