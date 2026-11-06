(function () {
  'use strict';

  var STORE = 'carvo.sellerErp.mcp.v1';
  var PROTOCOL = '2024-11-05';
  var SUGGEST = [
    { id: 'CAT-SH12478', confidence: 0.92 },
    { id: 'CAT-SH12476', confidence: 0.46 },
    { id: 'CAT-SH1727', confidence: 0.38 }
  ];
  var MIN_CONF = 0.8;
  var FORBIDDEN = {
    import_publish: 1,
    'import.publish': 1,
    'auto.publish': 1,
    'POST /import/publish': 1,
    publish: 1,
    import_start: 1,
    import_secrets: 1,
    'daigou-token': 1,
    'daigou-login': 1,
    engines_health: 1
  };
  var TOOLS = [
    { name: 'import_placement', description: 'Place a product (ai_place, min_confidence 0.8).' },
    { name: 'read_measurements', description: 'Read required leaf fields only.' },
    { name: 'arrange_product', description: 'Fill Ajouter from the engine packet; submit to CARVO control only when confidence >= 0.8. Never publishes.' },
    { name: 'import_status', description: 'Independent engine status.' }
  ];

  var I18N = {
    fr: {
      mcp: 'MCP Connect',
      crumb: 'Seller Center · MCP Connect',
      pluginName: 'Moteur d’import CARVO',
      connected: 'Connecté',
      disconnected: 'Déconnecté',
      connect: 'Connecter',
      disconnect: 'Retirer',
      arrange: 'Ranger',
      measure: 'Mesures',
      needConnect: 'Connectez le plugin.',
      keepReview: 'Revue requise.',
      arranged: 'Produit rangé.',
      measured: 'Mesures lues.',
      noLeaf: 'Aucune feuille sélectionnée.',
      toastOk: 'Connecté.',
      toastOff: 'Retiré.',
      required: 'Champs requis',
      emptyReq: 'Aucun champ requis.'
    },
    ar: {
      mcp: 'ربط MCP',
      crumb: 'Seller Center · ربط MCP',
      pluginName: 'محرك الاستيراد CARVO',
      connected: 'مربوط',
      disconnected: 'غير مربوط',
      connect: 'ربط',
      disconnect: 'فصل',
      arrange: 'ترتيب',
      measure: 'المقاسات',
      needConnect: 'اربط الإضافة أولاً.',
      keepReview: 'يحتاج مراجعة.',
      arranged: 'تم ترتيب المنتوج.',
      measured: 'تمّت قراءة المقاسات اللازمة.',
      noLeaf: 'ما كايناش ورقة مختارة.',
      toastOk: 'تم الربط.',
      toastOff: 'تم الفصل.',
      required: 'الحقول اللازمة',
      emptyReq: 'ما كايناش حقول لازمة.'
    },
    en: {
      mcp: 'MCP Connect',
      crumb: 'Seller Center · MCP Connect',
      pluginName: 'CARVO import engine',
      connected: 'Connected',
      disconnected: 'Disconnected',
      connect: 'Connect',
      disconnect: 'Disconnect',
      arrange: 'Arrange',
      measure: 'Measurements',
      needConnect: 'Connect the plugin first.',
      keepReview: 'Review required.',
      arranged: 'Product arranged.',
      measured: 'Required measurements read.',
      noLeaf: 'No leaf selected.',
      toastOk: 'Connected.',
      toastOff: 'Disconnected.',
      required: 'Required fields',
      emptyReq: 'No required fields.'
    }
  };

  var attrCache = null;
  var lastRead = null;

  function lang() {
    var l = document.documentElement.lang || 'fr';
    return I18N[l] ? l : 'fr';
  }
  function t(k) {
    return (I18N[lang()] || I18N.fr)[k] || k;
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch (e) { return {}; }
  }
  function saveState(s) {
    localStorage.setItem(STORE, JSON.stringify(s));
  }
  function isMcp() {
    return location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] === 'mcp';
  }
  function toast(msg) {
    var host = document.getElementById('toasts');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }
  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }
  function waitFor(fn, timeout) {
    var t0 = Date.now();
    return new Promise(function (resolve, reject) {
      (function tick() {
        var el = fn();
        if (el) return resolve(el);
        if (Date.now() - t0 > (timeout || 5000)) return reject(new Error('timeout'));
        requestAnimationFrame(tick);
      })();
    });
  }

  function rpcResult(id, result) {
    return { jsonrpc: '2.0', id: id, result: result };
  }
  function rpcError(id, code, message) {
    return { jsonrpc: '2.0', id: id, error: { code: code, message: message } };
  }

  async function handleRpc(req) {
    var method = req && req.method;
    var id = req && 'id' in req ? req.id : null;
    if (method === 'initialize') {
      return rpcResult(id, {
        protocolVersion: PROTOCOL,
        serverInfo: { name: 'carvo-import-engine', version: '1' },
        capabilities: { tools: {} }
      });
    }
    if (method === 'notifications/initialized') return null;
    if (method === 'tools/list') return rpcResult(id, { tools: TOOLS });
    if (method === 'tools/call') {
      var name = req.params && req.params.name;
      var args = (req.params && req.params.arguments) || {};
      var out = await callTool(name, args);
      return rpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(out) }]
      });
    }
    return rpcError(id, -32601, 'Method not found');
  }

  async function loadAttrs() {
    if (attrCache) return attrCache;
    var r = await fetch('data/leaf-attrs.json');
    if (!r.ok) throw new Error('leaf-attrs');
    attrCache = await r.json();
    return attrCache;
  }

  function detectLeafFromDom() {
    var selected = document.querySelector('[data-leaf].on, [data-pick-leaf].on, [aria-current="true"][data-leaf]');
    if (selected) {
      return selected.getAttribute('data-leaf') || selected.getAttribute('data-pick-leaf');
    }
    return null;
  }

  function leafRecord(data, id) {
    var rec = data && data.leaves && data.leaves[id];
    if (!rec) return null;
    var dict = data.dict || [];
    function vals(f) {
      return (f.values || []).map(function (i) {
        return typeof i === 'number' ? (dict[i] != null ? dict[i] : String(i)) : String(i);
      });
    }
    var required = (rec.fields || []).filter(function (f) { return !!f.required; });
    return {
      id: id,
      name: rec.en || id,
      required: required.map(function (f) { return { key: f.key, values: vals(f) }; })
    };
  }

  function requiredOnly(data, id) {
    var rec = leafRecord(data, id);
    if (!rec) return null;
    return {
      ok: true,
      leaf_id: rec.id,
      name: rec.name,
      required: rec.required.map(function (f) { return f.key; })
    };
  }

  function cssAttr(sel) {
    if (window.CSS && CSS.escape) return CSS.escape(sel);
    return String(sel).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  async function callTool(name, args) {
    if (FORBIDDEN[name]) return { ok: false, error: 'tool_forbidden', name: name };
    if (name === 'import_placement') {
      return {
        ok: true,
        policy: { voices: 2, min_confidence: MIN_CONF, below_threshold: 'keep_review', invents_leaf: false },
        suggestions: SUGGEST
      };
    }
    if (name === 'import_status') {
      return { ok: true, independent: true, starts_import: false, publishes: false };
    }
    if (name === 'read_measurements') {
      var id = (args && args.leaf_id) || loadState().lastLeaf || detectLeafFromDom();
      if (!id) return { ok: false, error: 'no_leaf' };
      var data = await loadAttrs();
      var leaf = requiredOnly(data, id);
      if (!leaf) return { ok: false, error: 'unknown_leaf', leaf_id: id };
      lastRead = leaf;
      return leaf;
    }
    if (name === 'arrange_product') {
      var pk = (args && args.packet) || (args && (args.leaf_id || args.titles || args.size_chart) ? args : null) || loadState().packet || null;
      return arrangeProduct(pk);
    }
    return { ok: false, error: 'unknown_tool', name: name };
  }

  async function pickSuggested(wantedId) {
    var pick = null;
    var i;
    if (wantedId) {
      for (i = 0; i < SUGGEST.length; i++) {
        if (SUGGEST[i].id === wantedId) pick = SUGGEST[i];
      }
      if (!pick) pick = { id: wantedId, confidence: 1 };
    } else {
      for (i = 0; i < SUGGEST.length; i++) {
        if (SUGGEST[i].confidence >= MIN_CONF) { pick = SUGGEST[i]; break; }
      }
    }
    return pick;
  }

  async function openAjouterPicker() {
    var back = document.querySelector('[data-back-leaf]');
    if (back) {
      back.click();
      await wait(160);
    }
    if (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] !== 'ajouter') {
      location.hash = '#/ajouter';
    }
    await waitFor(function () {
      return document.querySelector('[data-pick-leaf], [data-leaf], [data-dept], #cat-search');
    }, 8000);
  }

  async function selectLeafInPicker(id, name) {
    var sel = '[data-pick-leaf="' + id + '"], [data-leaf="' + id + '"]';
    var btn = document.querySelector(sel);
    if (!btn) {
      var search = document.getElementById('cat-search');
      if (search && name) {
        search.focus();
        search.value = name;
        search.dispatchEvent(new Event('input', { bubbles: true }));
        btn = await waitFor(function () {
          return document.querySelector('#picker-results [data-pick-leaf="' + id + '"], ' + sel);
        }, 6000);
      }
    }
    if (!btn) throw new Error('leaf_not_visible');
    btn.click();
    await wait(220);
  }

  async function fillKnownArrangement(id) {
    var filled = [];
    var left = [];
    var data = await loadAttrs();
    var rec = leafRecord(data, id);
    var title = document.getElementById('add-title');
    if (title && rec && rec.name && !title.value.trim()) {
      title.value = rec.name;
      title.dispatchEvent(new Event('input', { bubbles: true }));
      title.dispatchEvent(new Event('change', { bubbles: true }));
    }
    try {
      await waitFor(function () {
        return document.querySelector('[data-attr-toggle], [data-save-draft]');
      }, 8000);
    } catch (e) {}
    var fields = (rec && rec.required) || [];
    var i, f, chip;
    for (i = 0; i < fields.length; i++) {
      f = fields[i];
      if (f.values.length === 1) {
        chip = document.querySelector('[data-attr-toggle="' + cssAttr(f.key) + '"][data-val="' + cssAttr(f.values[0]) + '"]');
        if (chip && !chip.classList.contains('on')) chip.click();
        if (chip) filled.push(f.key);
        else left.push(f.key);
      } else {
        left.push(f.key);
      }
    }
    return { title: rec ? rec.name : id, filled: filled, left: left };
  }

  var GUIDE_COLS = { chest: 1, waist: 2, hip: 3, length: 4, skirt_length: 4, pants_length: 4 };
  var FAKE_STOCK = { 99: 1, 999: 1, 9999: 1 };

  function setVal(el, v) {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function pickText(o, keys) {
    if (!o) return '';
    if (typeof o === 'string') return o.trim();
    for (var i = 0; i < keys.length; i++) {
      if (o[keys[i]] != null && String(o[keys[i]]).trim()) return String(o[keys[i]]).trim();
    }
    return '';
  }
  function num(v) {
    if (v === null || v === '' || v === undefined) return null;
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : null;
  }
  function cellText(v) {
    if (Array.isArray(v) && v.length === 2 && num(v[0]) != null && num(v[1]) != null) return v[0] + '-' + v[1];
    var n = num(v);
    return n == null ? null : String(n);
  }

  function fillTexts(pk) {
    var out = [];
    var tt = pk.titles || pk.title || {};
    var dd = pk.descriptions || pk.description || {};
    var pairs = [
      ['add-title', pickText(tt, ['fr', 'en'])],
      ['add-titleAr', pickText(tt, ['ar'])],
      ['add-desc', pickText(dd, ['fr', 'en', 'ar'])]
    ];
    pairs.forEach(function (p) {
      var el = document.getElementById(p[0]);
      if (el && p[1]) { setVal(el, p[1]); out.push(p[0]); }
    });
    var price = num(pk.price);
    var pe = document.getElementById('add-price');
    if (pe && price != null) { setVal(pe, String(price)); out.push('add-price'); }
    return out;
  }

  function allFields(data, id) {
    var rec = data && data.leaves && data.leaves[id];
    if (!rec) return [];
    var dict = data.dict || [];
    return (rec.fields || []).map(function (f) {
      return {
        key: f.key,
        required: !!f.required,
        multiple: f.multiple !== false,
        values: (f.values || []).map(function (i) { return typeof i === 'number' ? (dict[i] != null ? dict[i] : String(i)) : String(i); })
      };
    });
  }

  function chipFor(key, val) {
    return document.querySelector('[data-attr-toggle="' + cssAttr(key) + '"][data-val="' + cssAttr(val) + '"]');
  }

  function fillAttrs(fields, pk) {
    var src = pk.attributes || pk.attrs || {};
    var filled = [], skipped = [], left = [];
    fields.forEach(function (f) {
      var want = src[f.key];
      if (want == null && f.required && f.values.length === 1) want = [f.values[0]];
      var list = (Array.isArray(want) ? want : (want == null || want === '' ? [] : [want])).map(String);
      var ok = list.filter(function (v) { return f.values.indexOf(v) >= 0; });
      if (!ok.length) { if (f.required) left.push(f.key); return; }
      if (!f.multiple && ok.length > 1) { skipped.push(f.key); if (f.required) left.push(f.key); return; }
      var done = 0;
      ok.forEach(function (v) {
        var c = chipFor(f.key, v);
        if (c) { if (!c.classList.contains('on')) c.click(); done++; }
      });
      if (done) filled.push(f.key); else if (f.required) left.push(f.key);
    });
    return { filled: filled, skipped: skipped, left: left };
  }

  function guideTable() {
    var cards = document.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      var h = cards[i].querySelector('h3');
      if (h && /Guide des tailles/i.test(h.textContent)) return cards[i].querySelector('tbody');
    }
    return null;
  }

  function fillGuide(chart) {
    var body = guideTable();
    var res = { filled_cells: 0, sizes_missing_in_ui: [], keys_not_in_ui: [] };
    if (!body) { res.error = 'guide_not_found'; return res; }
    var rows = {};
    Array.prototype.forEach.call(body.querySelectorAll('tr'), function (tr) {
      var td = tr.querySelector('td');
      if (td) rows[td.textContent.trim().toUpperCase()] = tr.querySelectorAll('input');
    });
    // Demo centimetres are not source data: clear every cell, then write packet numbers only.
    Object.keys(rows).forEach(function (k) {
      Array.prototype.forEach.call(rows[k], function (inp) { setVal(inp, ''); inp.placeholder = '?'; });
    });
    if (!chart || !Array.isArray(chart.rows) || (chart.unit && chart.unit !== 'cm')) {
      if (chart && chart.unit && chart.unit !== 'cm') res.error = 'unit_not_cm';
      return res;
    }
    var lenKey = ['length', 'skirt_length', 'pants_length'];
    chart.rows.forEach(function (r) {
      var size = String(r.size || '').trim().toUpperCase();
      var inputs = rows[size];
      if (!inputs) { if (size) res.sizes_missing_in_ui.push(size); return; }
      var usedLen = false;
      Object.keys(r).forEach(function (k) {
        if (k === 'size') return;
        var base = k.replace(/_range$/, '');
        var col = GUIDE_COLS[base];
        if (!col) { if (res.keys_not_in_ui.indexOf(base) < 0) res.keys_not_in_ui.push(base); return; }
        if (lenKey.indexOf(base) >= 0) { if (usedLen) return; usedLen = true; }
        var txt = cellText(r[k]);
        var inp = inputs[col - 1];
        if (txt != null && inp) { setVal(inp, txt); res.filled_cells++; }
      });
    });
    return res;
  }

  function fillSkus(pk) {
    var n = 0, unknown = 0;
    (pk.skus || []).forEach(function (s) {
      var key = s.key || ((s.color || '') + '|' + (s.size || ''));
      var el = document.querySelector('[data-sku="' + cssAttr(key) + '"]');
      if (!el) return;
      var v = s.stock;
      var real = v !== null && v !== '' && v !== undefined && isFinite(Number(v)) && Number(v) >= 0 && Math.floor(Number(v)) === Number(v) && !FAKE_STOCK[Number(v)];
      if (real) { setVal(el, String(Number(v))); n++; } else { setVal(el, ''); unknown++; }
    });
    return { filled: n, unknown: unknown };
  }

  async function arrangeProduct(pk) {
    pk = pk || {};
    if (pk.keep_review || pk.action === 'keep_review') {
      return { ok: false, action: 'keep_review', reason: 'packet_keep_review', submitted: false, published: false };
    }
    var pick;
    if (pk.leaf_id) {
      var c = pk.confidence == null ? 1 : Number(pk.confidence);
      pick = { id: String(pk.leaf_id), confidence: isFinite(c) ? c : 0 };
    } else {
      pick = await pickSuggested(null);
    }
    if (!pick || pick.confidence < MIN_CONF) {
      return { ok: false, action: 'keep_review', reason: 'below_min_confidence', min_confidence: MIN_CONF, submitted: false, published: false };
    }
    var data = null, name = pick.id;
    try { data = await loadAttrs(); } catch (e) {}
    if (data && !(data.leaves && data.leaves[pick.id])) {
      return { ok: false, action: 'keep_review', reason: 'leaf_not_in_list', leaf_id: pick.id, submitted: false, published: false };
    }
    var rec = data ? leafRecord(data, pick.id) : null;
    if (rec) name = rec.name;
    var texts, attrs, skus, guide;
    try {
      await openAjouterPicker();
      await selectLeafInPicker(pick.id, name);
      var next = document.querySelector('[data-to-details]');
      if (next) { next.click(); await wait(220); }
      await waitFor(function () { return document.getElementById('add-title'); }, 6000);
      try { await waitFor(function () { return document.querySelector('[data-attr-toggle], .attr-miss'); }, 8000); } catch (e) {}
      texts = fillTexts(pk);
      attrs = fillAttrs(allFields(data, pick.id), pk);
      skus = fillSkus(pk);
      guide = fillGuide(pk.size_chart);
    } catch (e) {
      return { ok: false, error: 'ajouter_not_ready', leaf_id: pick.id, submitted: false, published: false };
    }
    var st = loadState();
    st.lastLeaf = pick.id;
    saveState(st);
    lastRead = { ok: true, leaf_id: pick.id, name: name, required: attrs.filled.concat(attrs.left) };
    var result = {
      ok: true,
      action: 'arranged',
      leaf_id: pick.id,
      confidence: pick.confidence,
      title: name,
      texts_filled: texts,
      attrs_filled: attrs.filled,
      attrs_skipped_ambiguous: attrs.skipped,
      required_left: attrs.left,
      skus: skus,
      size_guide: guide,
      filled_measurements: guide.filled_cells > 0,
      submitted: false,
      published: false
    };
    var title = document.getElementById('add-title');
    if (attrs.left.length || !title || title.value.trim().length < 5) {
      result.reason = attrs.left.length ? 'required_left' : 'title_missing';
      return result;
    }
    var btn = document.querySelector('[data-submit-add]');
    if (!btn) { result.reason = 'submit_not_found'; return result; }
    btn.click();
    await wait(260);
    result.submitted = !document.querySelector('[data-submit-add]');
    result.status = result.submitted ? 'en_controle' : null;
    if (!result.submitted) result.reason = 'submit_rejected_by_form';
    return result;
  }

  async function connectPlugin() {
    await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    var st = loadState();
    st.connected = true;
    st.connectedAt = new Date().toISOString();
    saveState(st);
    toast(t('toastOk'));
  }

  function disconnectPlugin() {
    var st = loadState();
    st.connected = false;
    saveState(st);
    lastRead = null;
    toast(t('toastOff'));
  }

  async function runNamed(name) {
    var st = loadState();
    if (!st.connected) {
      toast(t('needConnect'));
      return;
    }
    var res = await handleRpc({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: name, arguments: {} }
    });
    var parsed = null;
    try { parsed = JSON.parse(res.result.content[0].text); }
    catch (e) { parsed = res; }
    if (name === 'arrange_product') {
      if (parsed && parsed.action === 'keep_review') toast(t('keepReview'));
      else if (parsed && parsed.submitted) toast(t('arranged'));
      else if (parsed && parsed.ok) toast(t('keepReview'));
      return;
    }
    if (name === 'read_measurements') {
      toast(parsed && parsed.ok ? t('measured') : t('noLeaf'));
      if (isMcp()) renderMcpPage();
    }
  }

  function readHtml() {
    if (!lastRead || !lastRead.ok) return '';
    var keys = lastRead.required || [];
    var items = keys.length
      ? keys.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('')
      : '<li>' + esc(t('emptyReq')) + '</li>';
    return (
      '<article class="card">' +
        '<div class="hd">' + esc(lastRead.name) + '</div>' +
        '<div class="mcp-read">' +
          '<h4>' + esc(t('required')) + '</h4>' +
          '<ul>' + items + '</ul>' +
        '</div>' +
      '</article>'
    );
  }

  function pageHtml() {
    var st = loadState();
    var on = !!st.connected;
    var tools = '';
    if (on) {
      tools =
        '<div class="mcp-tools">' +
          '<button type="button" class="ok" data-mcp-act="arrange_product">' + esc(t('arrange')) + '</button>' +
          '<button type="button" data-mcp-act="read_measurements">' + esc(t('measure')) + '</button>' +
        '</div>';
    }
    return (
      '<section data-mcp-page class="mcp-wrap">' +
        '<article class="card">' +
          '<div class="mcp-plugin' + (on ? ' is-on' : '') + '">' +
            '<h3>' + esc(t('pluginName')) +
              '<span class="mcp-status">' + esc(on ? t('connected') : t('disconnected')) + '</span>' +
            '</h3>' +
            '<div class="mcp-actions">' +
              (on
                ? '<button type="button" class="ghost" data-mcp-act="disconnect">' + esc(t('disconnect')) + '</button>'
                : '<button type="button" class="ok" data-mcp-act="connect">' + esc(t('connect')) + '</button>') +
            '</div>' +
            tools +
          '</div>' +
        '</article>' +
        (on ? readHtml() : '') +
      '</section>'
    );
  }

  function renderMcpPage() {
    var view = document.getElementById('view');
    if (!view) return;
    view.innerHTML = pageHtml();
    var crumb = document.getElementById('crumb');
    if (crumb) crumb.textContent = t('crumb');
    document.title = 'CARVO — ' + t('mcp');
    var root = view.querySelector('[data-mcp-page]');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mcp-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-mcp-act');
      if (act === 'connect') {
        connectPlugin().then(function () { if (isMcp()) renderMcpPage(); });
        return;
      }
      if (act === 'disconnect') {
        disconnectPlugin();
        renderMcpPage();
        return;
      }
      runNamed(act);
    });
  }

  function injectNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var a = nav.querySelector('[data-mcp-nav]');
    if (!a) {
      a = document.createElement('a');
      a.href = '#/mcp';
      a.setAttribute('data-mcp-nav', '1');
      var params = Array.prototype.find.call(nav.querySelectorAll('a'), function (el) {
        return (el.getAttribute('href') || '').indexOf('parametres') !== -1;
      });
      if (params) nav.insertBefore(a, params);
      else nav.appendChild(a);
    }
    a.textContent = t('mcp');
    var links = nav.querySelectorAll('a');
    var i;
    for (i = 0; i < links.length; i++) links[i].classList.remove('on');
    if (isMcp()) a.classList.add('on');
    else {
      var r = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'dash';
      var cur = nav.querySelector('a[href="#/' + r + '"]');
      if (cur) cur.classList.add('on');
    }
  }

  function sync() {
    injectNav();
    if (isMcp()) renderMcpPage();
  }

  function boot() {
    var view = document.getElementById('view');
    var nav = document.getElementById('nav');
    if (view) {
      new MutationObserver(function () {
        injectNav();
        if (isMcp() && view && !view.querySelector('[data-mcp-page]')) renderMcpPage();
      }).observe(view, { childList: true });
    }
    if (nav) {
      new MutationObserver(function () {
        if (!nav.querySelector('[data-mcp-nav]')) injectNav();
      }).observe(nav, { childList: true });
    }
    window.addEventListener('hashchange', function () { setTimeout(sync, 0); });
    setTimeout(sync, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
