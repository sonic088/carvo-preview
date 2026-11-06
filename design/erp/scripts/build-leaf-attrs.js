#!/usr/bin/env node
'use strict';
/**
 * Compact Seller ERP attribute payload from CARVO supplier templates.
 * Values and group names are copied verbatim from SHEIN captures.
 * Nothing is invented or renamed. Price Range (USD) stays a numeric price
 * field in the ERP form, not a choice list.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || '/workspace/carvo-sourcing';
const OUT = process.argv[3] || path.join(__dirname, '..', 'data', 'leaf-attrs.json');
const st = require(path.join(ROOT, 'src', 'supplier_template.js'));
const A = st.all();

const dict = [];
const dictIndex = new Map();
function vid(s) {
  const k = String(s);
  if (dictIndex.has(k)) return dictIndex.get(k);
  const i = dict.length;
  dict.push(k);
  dictIndex.set(k, i);
  return i;
}

const leaves = {};
let withFields = 0;
let empty = 0;
let excluded = 0;
let missing = 0;
let rwn = 0;
let noColor = 0;
let fieldCount = 0;
const groupSet = new Set();

for (const [id, x] of Object.entries(A.byId)) {
  const rec = { en: x.en };
  if (x.readiness.status === 'excluded') {
    rec.status = 'excluded';
    excluded += 1;
  } else if (x.readiness.status === 'missing') {
    rec.status = 'missing';
    missing += 1;
  } else if (x.readiness.with_note) {
    rec.status = 'ready_with_note';
    rwn += 1;
  }
  if (x.readiness.no_color) {
    rec.no_color = true;
    noColor += 1;
  }
  const notes = (x.readiness.notes || []).filter((n) => !/^(No Color for this leaf|Price ranges not captured)/.test(n));
  if (notes.length) rec.notes = notes;
  rec.fields = (x.fields || [])
    .filter((f) => f.kind === 'choice' && Array.isArray(f.values) && f.values.length)
    .map((f) => {
      groupSet.add(f.shein_group);
      fieldCount += 1;
      const row = { key: f.shein_group, values: f.values.map(vid) };
      if (f.required) row.required = true;
      if (f.multiple === false) row.multiple = false;
      return row;
    });
  if (rec.fields.length) withFields += 1;
  else empty += 1;
  leaves[id] = rec;
}

const payload = {
  version: 1,
  source: 'supplier_template.js + taxonomy/carvo/shein',
  leaves_total: Object.keys(leaves).length,
  groups: groupSet.size,
  fields: fieldCount,
  dict,
  leaves
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload));
const sample = leaves['CAT-SH1738'];
const sampleFields = sample ? sample.fields.map((f) => f.key + ':' + f.values.length) : [];
console.log(JSON.stringify({
  out: OUT,
  bytes: fs.statSync(OUT).size,
  leaves: payload.leaves_total,
  withFields,
  empty,
  excluded,
  missing,
  ready_with_note: rwn,
  no_color: noColor,
  groups: [...groupSet].sort(),
  groupCount: groupSet.size,
  fields: fieldCount,
  dict: dict.length,
  sample: sampleFields
}, null, 2));
