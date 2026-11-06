(function () {
  'use strict';

  var STORE = 'carvo.sellerErp.mcp.v1';
  var PROTOCOL = '2024-11-05';
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
        suggestions: (function () { var pk = (args && args.packet) || loadState().packet; return pk && pk.leaf_id ? [{ id: pk.leaf_id, confidence: pk.confidence == null ? 1 : pk.confidence }] : []; })()
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
    var src = {};
    var given = pk.attributes || pk.attrs || {};
    Object.keys(given).forEach(function (k) { src[k] = given[k]; });
    if (src.Color == null) { var pc = packetColors(pk).map(function (c) { return c.name; }); if (pc.length) src.Color = pc; }
    if (src.Size == null) { var ps = packetSizes(pk); if (ps.length) src.Size = ps; }
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

  var GUIDE_KEY = {
    chest: 'chest', bust: 'chest', bust_size: 'chest', bust_circ: 'chest', chest_circ: 'chest', chest_circumference: 'chest', poitrine: 'chest',
    waist: 'waist', waistline: 'waist', waist_circ: 'waist', waist_circumference: 'waist', taille: 'waist',
    hip: 'hip', hips: 'hip', hip_circ: 'hip', hip_circumference: 'hip', hanches: 'hip',
    length: 'length', skirt_length: 'length', pants_length: 'length', trouser_length: 'length',
    dress_length: 'length', garment_length: 'length', clothes_length: 'length', clothing_length: 'length',
    total_length: 'length', body_length: 'length', robe_length: 'length', longueur: 'length'
  };
  function normGuideKey(k) {
    return String(k || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/_cm$/g, '').replace(/_range$/g, '').replace(/[\s-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function fillGuide(chart) {
    var res = { filled_cells: 0, sizes_missing_in_ui: [], keys_not_in_ui: [] };
    if (!chart || !Array.isArray(chart.rows)) return res;
    if (chart.unit && chart.unit !== 'cm') { res.error = 'unit_not_cm'; return res; }
    chart.rows.forEach(function (r) {
      var size = String(r.size || '').trim();
      if (!size) return;
      if (!document.querySelector('[data-guide^="' + cssAttr(size + '|') + '"]')) { res.sizes_missing_in_ui.push(size); return; }
      var usedLen = false;
      Object.keys(r).forEach(function (k) {
        if (k === 'size') return;
        var base = normGuideKey(k);
        var col = GUIDE_KEY[base];
        if (!col) { if (res.keys_not_in_ui.indexOf(base) < 0) res.keys_not_in_ui.push(base); return; }
        if (col === 'length') { if (usedLen) return; usedLen = true; }
        var txt = cellText(r[k]);
        var inp = document.querySelector('[data-guide="' + cssAttr(size + '|' + col) + '"]');
        if (txt != null && inp) { setVal(inp, txt); res.filled_cells++; }
      });
    });
    return res;
  }

  function packetSizes(pk) {
    var out = [];
    function add(v) { v = String(v == null ? '' : v).trim(); if (v && out.indexOf(v) < 0) out.push(v); }
    (pk.sizes || []).forEach(add);
    (pk.skus || []).forEach(function (s) { add(s.size); });
    ((pk.size_chart && pk.size_chart.rows) || []).forEach(function (r) { add(r.size); });
    return out;
  }
  function packetColors(pk) {
    var out = [], seen = {};
    function add(c) {
      var name = String((c && c.name) || c || '').trim();
      if (name && !seen[name]) { seen[name] = 1; out.push({ name: name, hex: (c && c.hex) || '' }); }
    }
    (pk.colors || []).forEach(add);
    (pk.skus || []).forEach(function (s) { add(s.color); });
    return out;
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
    if (!pk || !pk.leaf_id) {
      return { ok: false, action: 'keep_review', reason: 'no_engine_packet', submitted: false, published: false };
    }
    if (pk.keep_review || pk.action === 'keep_review') {
      return { ok: false, action: 'keep_review', reason: 'packet_keep_review', submitted: false, published: false };
    }
    var c = pk.confidence == null ? 1 : Number(pk.confidence);
    var pick = { id: String(pk.leaf_id), confidence: isFinite(c) ? c : 0 };
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
      if (window.CARVO_SELLER_ADD && window.CARVO_SELLER_ADD.setVariants) {
        window.CARVO_SELLER_ADD.setVariants(packetColors(pk), packetSizes(pk));
        await wait(120);
      }
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
    if (!document.querySelector('[data-sku]')) { result.reason = 'no_packet_variants'; return result; }
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



  /* Live catalog reads (products API). Never publish. Seller POST /seller/v1/products is not live — local queue only. */
  var PRODUCTS_API = 'https://carvo-products.abdeslam-gh17.workers.dev';
  var FORBIDDEN_WRITE = ['/import/publish', 'import.publish', 'auto.publish', 'POST /import/publish'];
  var catNameCache = {};
  var searchTimer = null;
  var lastSearchQ = '';
  var catalogLoading = false;

  function titleOf(item) {
    var t = item && item.title;
    if (!t) return '';
    if (typeof t === 'string') return t;
    return t.fr || t.en || t.ar || '';
  }
  function titleArOf(item) {
    var t = item && item.title;
    if (!t || typeof t === 'string') return '';
    return t.ar || '';
  }
  function badgesOf(item) {
    var out = [];
    var b = item && item.card_badges;
    if (!b) return out;
    if (b.cod) out.push('COD');
    if (b.bar === 'hot_pick' || b.hot_top) out.push(b.top_seller_rank ? ('HOT #' + b.top_seller_rank) : 'HOT');
    if (b.chip === 'trends' || item.trends) out.push(b.chip_text ? ('Trends ' + b.chip_text) : 'Trends');
    if (item.discount_pct) out.push('-' + item.discount_pct + '%');
    return out.slice(0, 3);
  }
  function mapCard(item) {
    var colors = (item.colors || []).map(function (c) {
      return {
        name: c.name || c.value || (c.name_i18n && (c.name_i18n.fr || c.name_i18n.en)) || '—',
        hex: c.hex || '#dddddd',
        photos: (c.image || (item.images && item.images.length)) ? 1 : 0
      };
    });
    if (!colors.length && item.images && item.images.length) {
      colors = [{ name: '—', hex: '#dddddd', photos: Math.min(3, item.images.length) }];
    }
    var hex = (colors[0] && colors[0].hex) || '#dddddd';
    var catId = item.category || null;
    var leafLabel = (catId && catNameCache[catId]) || catId || '';
    return {
      id: String(item.id),
      code: item.code || null,
      title: titleOf(item),
      titleAr: titleArOf(item),
      leaf: leafLabel,
      leafId: catId,
      price: item.price_da != null ? Number(item.price_da) : 0,
      status: 'en_ligne',
      badges: badgesOf(item),
      source: item.store_name || item.store || 'catalogue',
      color: hex,
      colors: colors,
      skus: [],
      refuse: null,
      local: false,
      published: true,
      submitted: true,
      live: true,
      detailLoaded: false
    };
  }
  function mapDetailOnto(p, detail) {
    if (!p || !detail) return p;
    var colors = (detail.colors || []).map(function (c) {
      return {
        name: c.name || c.value || (c.name_i18n && (c.name_i18n.fr || c.name_i18n.en)) || '—',
        hex: c.hex || '#dddddd',
        photos: c.image ? 1 : 0
      };
    });
    if (colors.length) {
      p.colors = colors;
      p.color = colors[0].hex || p.color;
    }
    p.skus = (detail.skus || []).map(function (s) {
      return {
        c: s.color || s.color_value || '—',
        s: s.size || s.size_value || '—',
        stock: s.stock == null ? null : Number(s.stock)
      };
    });
    if (detail.size_chart) p.sizeChart = detail.size_chart;
    if (detail.path) p.leaf = Array.isArray(detail.path) ? detail.path.join(' › ') : String(detail.path);
    else if (detail.category) {
      p.leafId = detail.category;
      p.leaf = catNameCache[detail.category] || detail.category;
    }
    p.title = titleOf(detail) || p.title;
    p.titleAr = titleArOf(detail) || p.titleAr;
    if (detail.price_da != null) p.price = Number(detail.price_da);
    p.badges = badgesOf(detail);
    p.detailLoaded = true;
    return p;
  }
  function assertNoPublish(url) {
    var u = String(url || '');
    var i;
    for (i = 0; i < FORBIDDEN_WRITE.length; i++) {
      if (u.indexOf(FORBIDDEN_WRITE[i]) !== -1) throw new Error('forbidden_publish_path');
    }
    if (/\/import\/publish/i.test(u)) throw new Error('forbidden_publish_path');
  }
  async function fetchJson(url) {
    assertNoPublish(url);
    var r = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('http_' + r.status);
    return r.json();
  }
  async function resolveCategoryNames(ids) {
    var missing = [];
    var i;
    for (i = 0; i < ids.length; i++) {
      if (ids[i] && !catNameCache[ids[i]]) missing.push(ids[i]);
    }
    missing = missing.filter(function (id, idx, arr) { return arr.indexOf(id) === idx; }).slice(0, 40);
    await Promise.all(missing.map(async function (id) {
      try {
        var node = await fetchJson(PRODUCTS_API + '/v1/categories/' + encodeURIComponent(id));
        var label = (node.name_i18n && (node.name_i18n.fr || node.name_i18n.en)) || node.name || id;
        catNameCache[id] = label;
      } catch (e) {
        catNameCache[id] = id;
      }
    }));
  }
  function applyCatNames(items) {
    return items.map(function (p) {
      if (p.leafId && catNameCache[p.leafId]) p.leaf = catNameCache[p.leafId];
      return p;
    });
  }
  async function loadCatalogPages(maxPages, onPage) {
    var items = [];
    var cursor = '0';
    var pages = 0;
    var limit = 40;
    maxPages = maxPages || 40;
    while (pages < maxPages) {
      var url = PRODUCTS_API + '/v1/products?offset=' + encodeURIComponent(cursor) + '&limit=' + limit;
      var data = await fetchJson(url);
      var batch = (data && data.items) || [];
      var mapped = batch.map(mapCard);
      items = items.concat(mapped);
      pages += 1;
      if (typeof onPage === 'function') onPage(items.slice(), pages);
      if (!data || !data.next_cursor || !batch.length) break;
      cursor = String(data.next_cursor);
    }
    return { items: items, pages: pages, api: PRODUCTS_API };
  }
  function waitForData(timeout) {
    var t0 = Date.now();
    return new Promise(function (resolve, reject) {
      (function tick() {
        var data = window.CARVO_SELLER_DATA;
        if (data && typeof data.setCatalog === 'function') return resolve(data);
        if (Date.now() - t0 > (timeout || 8000)) return reject(new Error('no_CARVO_SELLER_DATA'));
        setTimeout(tick, 50);
      })();
    });
  }
  async function reloadCatalog() {
    if (catalogLoading) return null;
    catalogLoading = true;
    try {
      var data = await waitForData(8000);
      var res = await loadCatalogPages(40, function (partial) {
        if (String(lastSearchQ || '').trim()) return; // live search owns the list
        data.setCatalog(partial, {
          source: 'carvo-products',
          api: PRODUCTS_API,
          count: partial.length,
          loading: true,
          sellerWrite: 'missing: POST /seller/v1/products (contract only — local en_controle queue)'
        });
      });
      var ids = res.items.map(function (p) { return p.leafId; }).filter(Boolean);
      await resolveCategoryNames(ids);
      res.items = applyCatNames(res.items);
      if (!String(lastSearchQ || '').trim()) {
        data.setCatalog(res.items, {
          source: 'carvo-products',
          api: PRODUCTS_API,
          count: res.items.length,
          pages: res.pages,
          loading: false,
          sellerWrite: 'missing: POST /seller/v1/products (contract only — local en_controle queue)'
        });
      }
      return res;
    } catch (e) {
      var data2 = window.CARVO_SELLER_DATA;
      if (data2 && data2.setCatalog) {
        data2.setCatalog([], { source: 'carvo-products', error: String(e && e.message || e), api: PRODUCTS_API });
      }
      return null;
    } finally {
      catalogLoading = false;
    }
  }
  async function searchCatalog(q) {
    var data = window.CARVO_SELLER_DATA;
    if (!data || typeof data.setCatalog !== 'function') return null;
    q = String(q || '').trim();
    if (!q) return reloadCatalog();
    try {
      var url = PRODUCTS_API + '/v1/search?q=' + encodeURIComponent(q.slice(0, 80)) + '&limit=40';
      var raw = await fetchJson(url);
      var items = ((raw && raw.items) || []).map(mapCard);
      var ids = items.map(function (p) { return p.leafId; }).filter(Boolean);
      await resolveCategoryNames(ids);
      items = applyCatNames(items);
      data.setCatalog(items, {
        source: 'carvo-products-search',
        api: PRODUCTS_API,
        q: q,
        count: items.length,
        sellerWrite: 'missing: POST /seller/v1/products (contract only — local en_controle queue)'
      });
      return items;
    } catch (e) {
      return null;
    }
  }
  function onProductSearchInput(ev) {
    var el = ev.target;
    if (!el || el.id !== 'pq') return;
    var q = el.value || '';
    lastSearchQ = q;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      if (lastSearchQ !== q) return;
      if (!String(q).trim()) reloadCatalog();
      else if (String(q).trim().length >= 2) searchCatalog(q);
    }, 320);
  }
  async function ensureDetail(id) {
    var data = window.CARVO_SELLER_DATA;
    if (!data || !data.getProducts) return null;
    var list = data.getProducts();
    var p = null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) { p = list[i]; break; }
    }
    if (!p || p.local || p.detailLoaded) return p;
    var detail = await fetchJson(PRODUCTS_API + '/v1/products/' + encodeURIComponent(id));
    if (detail.category) await resolveCategoryNames([detail.category]);
    mapDetailOnto(p, detail);
    return p;
  }

  function sellerApiBase() {
    var data = window.CARVO_SELLER_DATA;
    if (data && data.sellerApiBase) return String(data.sellerApiBase).replace(/\/+$/, '');
    try {
      var v = localStorage.getItem('carvo.sellerErp.sellerApiBase');
      if (v) return String(v).replace(/\/+$/, '');
    } catch (e) { /* */ }
    return '';
  }
  function toSellerPayload(p) {
    if (!p) return null;
    var titleFr = p.title || '';
    var titleAr = p.titleAr || '';
    var colors = (p.colors || []).map(function (c) {
      var skus = (p.skus || []).filter(function (s) { return s.c === c.name; }).map(function (s) {
        return {
          sku_code: String(p.id) + '-' + String(c.name || 'x') + '-' + String(s.s || 'u'),
          size_label: String(s.s || 'Unique'),
          price_dzd: Number(p.price) || 0,
          old_price_dzd: null,
          stock: s.stock == null || s.stock === '' ? null : Number(s.stock)
        };
      });
      if (!skus.length) {
        skus = [{ sku_code: String(p.id) + '-' + String(c.name || 'x') + '-U', size_label: 'Unique', price_dzd: Number(p.price) || 0, old_price_dzd: null, stock: null }];
      }
      return {
        name: c.name || '—',
        hex: c.hex || undefined,
        images: [],
        skus: skus
      };
    });
    if (!colors.length) {
      colors = [{ name: '—', images: [], skus: [{ sku_code: String(p.id) + '-U', size_label: 'Unique', price_dzd: Number(p.price) || 0, stock: null }] }];
    }
    var size_chart = null;
    if (p.sizeChart && Array.isArray(p.sizeChart.rows) && p.sizeChart.rows.length) {
      size_chart = {
        sizes: p.sizeChart.rows.map(function (r) {
          var measures = {};
          Object.keys(r).forEach(function (k) {
            if (k === 'size') return;
            var v = r[k];
            if (Array.isArray(v)) measures[k + '_cm'] = v[0];
            else if (v != null && v !== '') measures[k + '_cm'] = v;
          });
          return { size_label: String(r.size), measures: measures };
        })
      };
    }
    return {
      external_id: String(p.code || p.id),
      leaf_id: p.leafId || p.leaf || null,
      title: { fr: titleFr, ar: titleAr || undefined },
      description: p.desc ? { fr: p.desc } : undefined,
      attributes: p.attrs && typeof p.attrs === 'object' ? p.attrs : {},
      colors: colors,
      size_chart: size_chart || undefined,
      cod: true,
      source: { door: 'formulaire', erp: 'seller-center' }
    };
  }
  async function enqueueProduct(p, opts) {
    opts = opts || {};
    if (!p) return { ok: false, reason: 'no_product' };
    var submit = !!opts.submit;
    // Contract stamps
    if (submit) {
      p.submitted = true;
      p.published = false;
      p.status = 'en_controle';
    } else {
      p.submitted = false;
      p.published = false;
      if (!p.status) p.status = 'brouillon';
    }
    p.local = true;
    p.sellerPayload = toSellerPayload(p);
    p.sellerWrite = {
      contract: 'POST /seller/v1/products',
      mode: 'local_queue',
      reason: 'seller_api_not_live',
      submitted: !!p.submitted,
      published: false
    };
    if (!submit) {
      if (window.CARVO_SELLER_DATA && window.CARVO_SELLER_DATA.persistLocal) window.CARVO_SELLER_DATA.persistLocal();
      return { ok: true, mode: 'local_draft', product: p };
    }
    var base = sellerApiBase();
    if (!base) {
      if (window.CARVO_SELLER_DATA && window.CARVO_SELLER_DATA.persistLocal) window.CARVO_SELLER_DATA.persistLocal();
      return { ok: true, mode: 'local_queue', reason: 'seller_api_base_unset', product: p };
    }
    // Optional: when a stub/dev base is configured (never default prod)
    try {
      if (/publish/i.test(base)) throw new Error('forbidden_publish_base');
      var url = base + '/seller/v1/products';
      if (/\/import\/publish/i.test(url)) throw new Error('forbidden_publish_path');
      var res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': String(p.id),
          'Authorization': 'Bearer ' + (localStorage.getItem('carvo.sellerErp.sellerKey') || 'dev-stub')
        },
        body: JSON.stringify(p.sellerPayload)
      });
      var body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (body && JSON.stringify(body).indexOf('daigou') !== -1) {
        p.sellerWrite = { mode: 'rejected', reason: 'token_leak_guard' };
        if (window.CARVO_SELLER_DATA && window.CARVO_SELLER_DATA.persistLocal) window.CARVO_SELLER_DATA.persistLocal();
        return { ok: false, reason: 'token_leak_guard' };
      }
      if (res.status === 202 || res.status === 200) {
        var row = body && body.results && body.results[0];
        p.sellerWrite = {
          contract: 'POST /seller/v1/products',
          mode: 'stub_or_api',
          http: res.status,
          external_id: row && row.external_id,
          api_status: row && row.status,
          submitted: true,
          published: false
        };
        p.submitted = true;
        p.published = false;
        p.status = 'en_controle';
      } else {
        p.sellerWrite = {
          contract: 'POST /seller/v1/products',
          mode: 'local_queue_fallback',
          http: res.status,
          reason: (body && body.errors && body.errors[0] && body.errors[0].code) || ('http_' + res.status),
          submitted: true,
          published: false
        };
      }
    } catch (e) {
      p.sellerWrite = {
        contract: 'POST /seller/v1/products',
        mode: 'local_queue_fallback',
        reason: String(e && e.message || e),
        submitted: true,
        published: false
      };
    }
    if (window.CARVO_SELLER_DATA && window.CARVO_SELLER_DATA.persistLocal) window.CARVO_SELLER_DATA.persistLocal();
    return { ok: true, mode: p.sellerWrite.mode, product: p };
  }

  window.CARVO_SELLER_CATALOG = {
    apiBase: PRODUCTS_API,
    reload: reloadCatalog,
    search: searchCatalog,
    ensureDetail: ensureDetail,
    toSellerPayload: toSellerPayload,
    enqueueProduct: enqueueProduct,
    sellerApiBase: sellerApiBase
  };

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
    document.addEventListener('input', onProductSearchInput, true);
    setTimeout(sync, 0);
    setTimeout(function () { reloadCatalog(); }, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
