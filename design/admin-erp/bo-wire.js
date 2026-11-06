/* CARVO Admin ERP prototype — data wiring only (no layout/CSS changes).
 * Reads the read-only /bo/api/* routes (same origin as carvo-admin-dev; Cloudflare Access JWT added by Access).
 * Rules: NULL -> « — inconnu »; prototype example figures are never shown on wired screens; no writes;
 * no secrets in the page (D-039); no publish path (D-036). Optional base: window.CARVO_BO_BASE (default '').
 */
(function () {
  'use strict';
  var BASE = (window.CARVO_BO_BASE || '').replace(/\/+$/, '');
  var UNK = '— inconnu';
  var KEEP = {};                        // sentinel: leave the template cell as-is (checkbox / action button)
  var NUMERIC = /^[\s\u00a0\u202f]*[-−+]?[\d][\d\s\u00a0\u202f.,]*(\s?(DA|%|j|h|min|k))?[\s\u00a0\u202f]*$/;

  var n = function (v) { return v == null ? null : v; };
  var da = function (v) { return v == null ? null : Number(v).toLocaleString('fr-FR') + ' DA'; };
  var ts = function (v) { return v == null ? null : String(v).replace('T', ' ').replace(/\.\d+/, '').replace(/Z$/, ' UTC'); };
  var join = function () { var a = [].slice.call(arguments).filter(function (x) { return x != null && x !== ''; }); return a.length ? a.join(' · ') : null; };

  function get(path) {
    return fetch(BASE + '/bo/api' + path, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) { throw new Error(r.status + (b && b.error ? ' · ' + b.error : '')); });
        return r.json();
      });
  }

  // Set text on the innermost single-child element so the prototype's own styling is kept.
  function setCell(td, v) {
    if (v === KEEP) return;
    var el = td;
    var ownText = function (x) { return [].some.call(x.childNodes, function (c) { return c.nodeType === 3 && c.nodeValue.trim(); }); };
    while (el.children.length === 1 && !ownText(el) && el.children[0].tagName !== 'INPUT' && el.children[0].tagName !== 'BUTTON') el = el.children[0];
    el.textContent = v == null || v === '' ? UNK : String(v);
  }
  function fillTable(table, rows, emptyMsg) {
    var tb = table.tBodies[0]; if (!tb || !tb.rows.length) return;
    var tpl = tb.rows[0].cloneNode(true); tpl.removeAttribute('style');
    tb.innerHTML = '';
    if (!rows.length) {
      var r0 = tpl.cloneNode(true);
      [].forEach.call(r0.cells, function (td, i) { if (i === 0) { td.textContent = emptyMsg || 'Aucune ligne'; td.colSpan = r0.cells.length; } });
      while (r0.cells.length > 1) r0.deleteCell(1);
      tb.appendChild(r0); return;
    }
    rows.forEach(function (vals) {
      var tr = tpl.cloneNode(true);
      [].forEach.call(tr.cells, function (td, i) { setCell(td, i < vals.length ? vals[i] : null); });
      tb.appendChild(tr);
    });
  }
  // Replace example figures (KPIs, counters) outside tables with « — inconnu »; text only, no structure change.
  function scrubNumbers(root, short) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), t, list = [];
    while ((t = w.nextNode())) {
      if (t.parentElement.closest('table,script,style,svg,kbd')) continue;
      if (NUMERIC.test(t.nodeValue) && /\d/.test(t.nodeValue)) list.push(t);
    }
    list.forEach(function (x) { x.nodeValue = short ? '—' : UNK; });
  }
  function stamp(view, env) {
    var src = [].filter.call(view.querySelectorAll('span'), function (s) { return /^Source\s*:/.test(s.textContent) && !s.children.length; })[0];
    if (src && env) src.textContent = 'Source : ' + (env.source || UNK) + ' · lu ' + (ts(env.computed_at) || UNK);
  }
  function fail(view, e) {
    var tables = view.querySelectorAll('table');
    [].forEach.call(tables, function (t) { fillTable(t, [], 'Données indisponibles (' + e.message + ')'); });
  }

  var BIND = {
    commandes: ['/commandes', function (d) { return [d.items.map(function (o) {
      return [KEEP, n(o.order_number), n(o.customer_phone_masked), n(o.wilaya_code), n(o.seller_id), n(o.confirmation), da(o.total_cod_dzd),
        o.parcel ? join(o.parcel.carrier, o.parcel.tracking_no, o.parcel.status) : null,
        ts(o.cancelled_at || o.returned_at || o.delivered_at || o.shipped_at || o.confirmed_at || o.placed_at)];
    })]; }],
    risque: ['/risque', function (d) { return [
      d.items.map(function (r) { return [r.phone_masked, n(r.refused_parcels), n(r.cancellations), n(r.no_answers), ts(r.last_at), r.blacklist ? 'liste noire' : 'signalé', KEEP]; }),
      d.items.filter(function (r) { return r.blacklist; }).map(function (r) { return [r.phone_masked, n(r.blacklist.reason), n(r.blacklist.added_by), ts(r.blacklist.since)]; }),
    ]; }],
    audit: ['/audit', function (d) { return [d.items.map(function (a) {
      var keys = Object.keys(Object.assign({}, a.before || {}, a.after || {}));
      return [ts(a.at), n(a.actor), n(a.action), n(a.entity), n(a.entity_id), keys.length ? keys.slice(0, 6).join(', ') : null, KEEP];
    })]; }],
    produits: ['/produits', function (d) { return [d.items.map(function (p) {
      var badges = [p.cod ? 'COD' : null, p.is_new ? 'Nouveau' : null].filter(Boolean).join(' · ');
      return [n(p.title_fr), n(p.seller_id), n(p.status), null, n(p.stock),
        p.review_count ? join(p.rating_avg, p.review_count + ' avis') : null, badges || null];
    })]; }],
    tailles: ['/tailles', function (d) { return [d.items.map(function (t) {
      return [n(t.leaf_name_fr || t.name), null, null, Array.isArray(t.measures) ? t.measures.join(', ') : n(t.measures)];
    })]; }],
    vendeurs: ['/vendeurs', function (d) { return [d.items.map(function (s) {
      var doors = [s.engine_import ? 'import' : null, s.engine_search ? 'recherche' : null].filter(Boolean).join(' · ');
      return [n(s.display_name), n(s.trust_level), null, s.commission_pct == null ? null : s.commission_pct + ' %', doors || null,
        join(s.review_mode, s.auto_send_eligible ? 'auto possible (D-037)' : 'manuel')];
    })]; }],
    releves: ['/releves', function (d) { return [d.statements.map(function (s) {
      return [join(s.seller_id, s.period_start && s.period_end ? s.period_start + ' → ' + s.period_end : null), da(s.gross_dzd), da(s.returns_dzd),
        da(s.commission_dzd), da(s.delivery_dzd), da(s.net_dzd), n(s.status), KEEP];
    })]; }],
    transporteurs: ['/transporteurs', function (d) {
      var per = {}; (d.routing || []).forEach(function (r) { per[r.carrier] = (per[r.carrier] || 0) + 1; });
      return [null, null, d.carriers.map(function (c) {
        return [n(c.code), n(c.api_base), null, per[c.code] == null ? null : per[c.code], c.enabled == null ? null : (c.enabled ? 'activé' : 'désactivé'), KEEP];
      })];
    }],
    argent: ['/argent', function (d) { return [d.items.map(function (m) {
      return [n(m.label_en || m.key), m.value_num == null ? null : m.value_num + ' ' + (m.unit || '') + ' · [' + m.min_num + '–' + m.max_num + ']',
        n(m.source), n(m.updated_by), null, KEEP];
    })]; }],
    confirmation: ['/confirmation/queue', function (d) { return [d.items.map(function (o) {
      return [n(o.order_number), join(o.customer_name, o.customer_phone_masked), join(o.wilaya_code, o.delivery_type), da(o.total_cod_dzd),
        join(o.risk, o.attempts == null ? null : o.attempts + ' appel(s)'), ts(o.routed_at)];
    })]; }],
    jobs: ['/jobs', function (d) { return [(Array.isArray(d) ? d : []).map(function (j) {
      var l = j.last || {};
      return [n(j.job), j.never_run ? 'jamais exécuté' : l.ok === true ? 'ok' : l.ok === false ? 'échec' : null,
        (j.runs || []).length || null, ts(l.started_at), l.error ? String(l.error).slice(0, 160) : null, n(j.schedule), KEEP];
    })]; }],
  };

  var done = {};
  function wire() {
    var k = location.hash.slice(1);
    var b = BIND[k]; if (!b || done[k]) return;
    var view = document.querySelector('main[data-view="' + k + '"][data-app="admin"]'); if (!view) return;
    done[k] = true;
    scrubNumbers(view, false);
    var tables = view.querySelectorAll('table');
    get(b[0]).then(function (env) {
      var sets = b[1](env.data || {});
      [].forEach.call(tables, function (t, i) {
        if (sets[i]) fillTable(t, sets[i], 'Aucune ligne');
        else fillTable(t, [], 'à venir — pas encore branché');
      });
      stamp(view, env);
    }).catch(function (e) { done[k] = false; fail(view, e); });
  }
  // Nav counters are prototype examples: show « — » until a real count exists.
  var nav = document.getElementById('nav'); if (nav) [].forEach.call(nav.querySelectorAll('.cnt'), function (c) { c.textContent = '—'; });
  addEventListener('hashchange', wire); wire();
  window.CARVO_BO_WIRE = { BIND: Object.keys(BIND) };
})();
