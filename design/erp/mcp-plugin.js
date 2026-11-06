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
    publish: 1,
    import_start: 1,
    import_secrets: 1,
    'daigou-token': 1,
    'daigou-login': 1,
    engines_health: 1
  };
  var TOOLS = [
    {
      name: 'import_placement',
      description: 'ai_place: two voices, min_confidence 0.8, else keep_review. invents_leaf false.'
    },
    {
      name: 'read_measurements',
      description: 'Read real leaf attribute groups. Does not invent values or fill the size guide.'
    },
    {
      name: 'arrange_product',
      description: 'Drive Seller ERP Ajouter using a suggested leaf at or above 0.8.'
    },
    {
      name: 'import_status',
      description: 'Read-only reminder that import stays on the independent engine (D-034).'
    }
  ];

  var I18N = {
    fr: {
      mcp: 'MCP Connect',
      intro: 'Le moteur d’import reste indépendant : import 1688, lecture des mesures, méthode D-034. L’ERP a une case plugin. Une fois branché, l’IA du moteur range les produits et pilote l’écran vendeur — sans secrets de plateforme et sans publication automatique.',
      engineTitle: 'Moteur indépendant',
      engineP1: 'Rien n’est réécrit dans le moteur. L’import 1688 reste sur sa porte existante (D-034). Les mesures viennent des attributs réels de chaque feuille SHEIN, pas de valeurs inventées.',
      engineP2: 'Seuil de placement : deux voix, confiance minimale 0,8. En dessous, le produit reste en revue. Aucune feuille n’est inventée.',
      slotTitle: 'Case plugin · MCP Connect',
      pluginName: 'Moteur d’import CARVO',
      protocol: 'Protocole MCP 2024-11-05',
      connected: 'Branché',
      disconnected: 'Non branché',
      connect: 'Brancher le plugin',
      disconnect: 'Détacher',
      toolsTitle: 'L’IA pilote le Seller ERP',
      arrange: 'Ranger le produit',
      measure: 'Lire les mesures',
      place: 'Règles de placement',
      importSt: 'État de l’import',
      arrangeHint: 'Ouvre Ajouter, choisit la feuille au-dessus de 0,8, puis les détails. Les champs de mesures restent vides.',
      noInvent: 'Aucune valeur de mesure n’est écrite. Le plugin ne fait que lire les choix capturés.',
      importHint: 'L’import reste dans le moteur indépendant. Ce plugin ne lance pas d’import et ne publie pas.',
      forbidden: 'Pas de jeton Daigou, pas de secrets, pas de publish dans cette case.',
      log: 'Journal MCP',
      needConnect: 'Branche d’abord le plugin.',
      keepReview: 'Confiance sous 0,8 — le produit reste en revue.',
      arranged: 'Le moteur a ouvert la feuille proposée dans Ajouter.',
      measured: 'Mesures lues depuis les groupes réels de la feuille.',
      noLeaf: 'Aucune feuille choisie. Range d’abord un produit, ou ouvre une feuille dans Ajouter.',
      toastOk: 'Plugin branché. L’IA peut ranger les produits dans le Seller ERP.',
      toastOff: 'Plugin détaché. Le moteur reste indépendant.',
      crumb: 'Seller Center · MCP Connect'
    },
    ar: {
      mcp: 'ربط MCP',
      intro: 'المحرك يبقى مستقل: استيراد 1688 وقراءة المقاسات وطريقة D-034. في الـ ERP كاين خانة إضافة. ملي تربط الإضافة، الذكاء الاصطناعي ديال المحرك كيرتب المنتجات وكيسوق شاشة البائع — بلا أسرار المنصة وبلا نشر تلقائي.',
      engineTitle: 'المحرك المستقل',
      engineP1: 'ما بدّلناش المحرك. استيراد 1688 يبقى في بابه الموجود (D-034). المقاسات كتجي من صفات الورقة الحقيقية، ما كايناش قيم مخترعة.',
      engineP2: 'الترتيب: صوتان، عتبة الثقة 0.8. تحت العتبة المنتوج كيبقى في المراجعة. ما كايناش ورقة مخترعة.',
      slotTitle: 'خانة الإضافة · MCP Connect',
      pluginName: 'محرك الاستيراد CARVO',
      protocol: 'بروتوكول MCP 2024-11-05',
      connected: 'مربوط',
      disconnected: 'غير مربوط',
      connect: 'ربط الإضافة',
      disconnect: 'فصل',
      toolsTitle: 'الذكاء الاصطناعي كيسوق Seller ERP',
      arrange: 'رتّب المنتوج',
      measure: 'اقرأ المقاسات',
      place: 'قواعد الترتيب',
      importSt: 'حالة الاستيراد',
      arrangeHint: 'كيمشي لـ Ajouter وكيدير الورقة فوق 0.8، من بعد التفاصيل. خانات المقاسات كيبقاو فارغين.',
      noInvent: 'ما كيتكتبو والو في المقاسات. الإضافة كتقرا غير الاختيارات المصوّرة.',
      importHint: 'الاستيراد يبقى في المحرك المستقل. هاد الإضافة ما كتشغّلش الزحف وما كتنشرش.',
      forbidden: 'ما كاينش توكن Daigou، ما كاينش أسرار، ما كاينش نشر في هاد الخانة.',
      log: 'سجل MCP',
      needConnect: 'ربط الإضافة أولاً.',
      keepReview: 'الثقة تحت 0.8 — المنتوج كيبقى في المراجعة.',
      arranged: 'المحرك حل الورقة المقترحة في Ajouter.',
      measured: 'تقراو المقاسات من مجموعات الورقة الحقيقية.',
      noLeaf: 'ما كايناش ورقة مختارة. رتّب منتوج أولاً، أولا حل ورقة في Ajouter.',
      toastOk: 'الإضافة تربطات. الذكاء الاصطناعي يقدر يرتب المنتجات في Seller ERP.',
      toastOff: 'الإضافة تفصلات. المحرك يبقى مستقل.',
      crumb: 'Seller Center · ربط MCP'
    },
    en: {
      mcp: 'MCP Connect',
      intro: 'The import engine stays independent: 1688 import, reading measurements, D-034. The ERP has a plugin slot. Once plugged in, the engine’s AI arranges products and drives the seller screens — without platform secrets and without auto-publish.',
      engineTitle: 'Independent engine',
      engineP1: 'The engine is not rewritten. 1688 import stays on its existing door (D-034). Measurements come from each leaf’s real attributes, never invented values.',
      engineP2: 'Placement: two voices, minimum confidence 0.8. Below that the product stays in review. No leaf is invented.',
      slotTitle: 'Plugin slot · MCP Connect',
      pluginName: 'CARVO import engine',
      protocol: 'MCP protocol 2024-11-05',
      connected: 'Connected',
      disconnected: 'Not connected',
      connect: 'Connect plugin',
      disconnect: 'Disconnect',
      toolsTitle: 'AI drives Seller ERP',
      arrange: 'Arrange product',
      measure: 'Read measurements',
      place: 'Placement rules',
      importSt: 'Import status',
      arrangeHint: 'Opens Ajouter, picks the leaf at or above 0.8, then details. Measurement fields stay empty.',
      noInvent: 'No measurement values are written. The plugin only reads captured choices.',
      importHint: 'Import stays on the independent engine. This plugin does not start a crawl and does not publish.',
      forbidden: 'No Daigou token, no secrets, and no publish in this slot.',
      log: 'MCP log',
      needConnect: 'Connect the plugin first.',
      keepReview: 'Confidence below 0.8 — the product stays in review.',
      arranged: 'The engine opened the suggested leaf in Ajouter.',
      measured: 'Measurements read from the leaf’s real groups.',
      noLeaf: 'No leaf selected. Arrange a product first, or open a leaf in Ajouter.',
      toastOk: 'Plugin connected. AI can arrange products in Seller ERP.',
      toastOff: 'Plugin detached. The engine stays independent.',
      crumb: 'Seller Center · MCP Connect'
    }
  };

  var attrCache = null;
  var logLines = [];

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
    setTimeout(function () { el.remove(); }, 4200);
  }
  function addLog(line) {
    logLines.unshift(new Date().toISOString() + '  ' + line);
    if (logLines.length > 40) logLines.pop();
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
    if (method === 'notifications/initialized') {
      return null;
    }
    if (method === 'tools/list') {
      return rpcResult(id, { tools: TOOLS });
    }
    if (method === 'tools/call') {
      var name = req.params && req.params.name;
      var args = (req.params && req.params.arguments) || {};
      var out = await callTool(name, args);
      return rpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(out, null, 2) }]
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

  function decodeLeaf(data, id) {
    var rec = data && data.leaves && data.leaves[id];
    if (!rec) return null;
    var dict = data.dict || [];
    return {
      id: id,
      en: rec.en,
      status: rec.status || 'ready',
      notes: rec.notes || [],
      no_color: !!rec.no_color,
      fields: (rec.fields || []).map(function (f) {
        return {
          key: f.key,
          required: !!f.required,
          multiple: f.multiple !== false,
          values: (f.values || []).map(function (i) {
            return typeof i === 'number' ? (dict[i] != null ? dict[i] : String(i)) : String(i);
          })
        };
      })
    };
  }

  function detectLeafFromDom() {
    var selected = document.querySelector('[data-leaf].on, [data-pick-leaf].on, [aria-current="true"][data-leaf]');
    if (selected) {
      return selected.getAttribute('data-leaf') || selected.getAttribute('data-pick-leaf');
    }
    return null;
  }

  async function callTool(name, args) {
    if (FORBIDDEN[name]) {
      return { ok: false, error: 'tool_forbidden', name: name };
    }
    if (name === 'import_placement') {
      return {
        ok: true,
        policy: {
          voices: 2,
          min_confidence: MIN_CONF,
          below_threshold: 'keep_review',
          invents_leaf: false
        },
        suggestions: SUGGEST
      };
    }
    if (name === 'import_status') {
      return {
        ok: true,
        independent: true,
        method: 'D-034',
        starts_import: false,
        publishes: false,
        note: 'Import remains on the independent engine. This Seller ERP plugin does not crawl 1688 or publish.'
      };
    }
    if (name === 'read_measurements') {
      var id = (args && args.leaf_id) || loadState().lastLeaf || detectLeafFromDom();
      if (!id) return { ok: false, error: 'no_leaf' };
      var data = await loadAttrs();
      var leaf = decodeLeaf(data, id);
      if (!leaf) return { ok: false, error: 'unknown_leaf', leaf_id: id };
      return {
        ok: true,
        leaf_id: id,
        invents_values: false,
        fills_size_guide: false,
        leaf: leaf
      };
    }
    if (name === 'arrange_product') {
      return arrangeProduct(args && args.leaf_id);
    }
    return { ok: false, error: 'unknown_tool', name: name };
  }

  async function arrangeProduct(wantedId) {
    var pick = null;
    var i;
    if (wantedId) {
      for (i = 0; i < SUGGEST.length; i++) {
        if (SUGGEST[i].id === wantedId) pick = SUGGEST[i];
      }
      if (!pick) pick = { id: wantedId, confidence: 0 };
    } else {
      for (i = 0; i < SUGGEST.length; i++) {
        if (SUGGEST[i].confidence >= MIN_CONF) { pick = SUGGEST[i]; break; }
      }
    }
    if (!pick || pick.confidence < MIN_CONF) {
      return {
        ok: false,
        action: 'keep_review',
        reason: 'below_min_confidence',
        min_confidence: MIN_CONF,
        suggestions: SUGGEST
      };
    }
    location.hash = '#/ajouter';
    try {
      var btn = await waitFor(function () {
        return document.querySelector('[data-pick-leaf="' + pick.id + '"], [data-leaf="' + pick.id + '"]');
      }, 6000);
      btn.click();
      await wait(180);
      var next = document.querySelector('[data-to-details]');
      if (next) next.click();
    } catch (e) {
      return { ok: false, error: 'ajouter_not_ready', leaf_id: pick.id };
    }
    var st = loadState();
    st.lastLeaf = pick.id;
    saveState(st);
    return {
      ok: true,
      action: 'opened_details',
      leaf_id: pick.id,
      confidence: pick.confidence,
      invents_leaf: false,
      filled_measurements: false
    };
  }

  async function connectPlugin() {
    var init = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    var listed = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    var names = ((listed.result && listed.result.tools) || []).map(function (x) { return x.name; });
    var st = loadState();
    st.connected = true;
    st.connectedAt = new Date().toISOString();
    st.protocol = init.result && init.result.protocolVersion;
    st.tools = names;
    saveState(st);
    addLog('initialize ' + st.protocol + ' · tools ' + names.join(', '));
    toast(t('toastOk'));
  }

  function disconnectPlugin() {
    var st = loadState();
    st.connected = false;
    saveState(st);
    addLog('disconnect');
    toast(t('toastOff'));
  }

  async function runNamed(name) {
    var st = loadState();
    if (!st.connected) {
      toast(t('needConnect'));
      addLog('blocked ' + name + ' (not connected)');
      return;
    }
    var res = await handleRpc({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: name, arguments: {} }
    });
    var parsed = null;
    try {
      parsed = JSON.parse(res.result.content[0].text);
    } catch (e) {
      parsed = res;
    }
    addLog(name + ' → ' + JSON.stringify(parsed));
    if (name === 'arrange_product') {
      if (parsed && parsed.action === 'keep_review') toast(t('keepReview'));
      else if (parsed && parsed.ok) toast(t('arranged'));
      else toast((parsed && parsed.error) || name);
      return;
    }
    if (name === 'read_measurements') {
      if (parsed && parsed.ok) toast(t('measured'));
      else toast(t('noLeaf'));
    }
    if (isMcp()) renderMcpPage();
  }

  function pageHtml() {
    var st = loadState();
    var on = !!st.connected;
    var tools = '';
    if (on) {
      tools =
        '<article class="card">' +
          '<div class="hd">' + esc(t('toolsTitle')) + '</div>' +
          '<p class="mcp-note">' + esc(t('arrangeHint')) + ' ' + esc(t('noInvent')) + '</p>' +
          '<div class="mcp-tools">' +
            '<button type="button" class="ok" data-mcp-act="arrange_product">' + esc(t('arrange')) + '</button>' +
            '<button type="button" data-mcp-act="read_measurements">' + esc(t('measure')) + '</button>' +
            '<button type="button" class="ghost" data-mcp-act="import_placement">' + esc(t('place')) + '</button>' +
            '<button type="button" class="ghost" data-mcp-act="import_status">' + esc(t('importSt')) + '</button>' +
          '</div>' +
          '<p class="mcp-note">' + esc(t('importHint')) + '</p>' +
          '<div class="hd">' + esc(t('log')) + '</div>' +
          '<pre class="mcp-log">' + esc(logLines.join('\n') || '—') + '</pre>' +
        '</article>';
    }
    return (
      '<section data-mcp-page class="mcp-wrap">' +
        '<p class="mcp-intro">' + esc(t('intro')) + '</p>' +
        '<div class="mcp-cols">' +
          '<article class="card">' +
            '<div class="hd">' + esc(t('engineTitle')) + '</div>' +
            '<div class="mcp-body">' +
              '<p>' + esc(t('engineP1')) + '</p>' +
              '<p>' + esc(t('engineP2')) + '</p>' +
            '</div>' +
          '</article>' +
          '<article class="card">' +
            '<div class="hd">' + esc(t('slotTitle')) + '</div>' +
            '<div class="mcp-body">' +
              '<div class="mcp-plugin' + (on ? ' is-on' : '') + '">' +
                '<div class="mcp-kicker">' + esc(t('protocol')) + '</div>' +
                '<h3>' + esc(t('pluginName')) +
                  '<span class="mcp-status">' + esc(on ? t('connected') : t('disconnected')) + '</span>' +
                '</h3>' +
                '<p>' + esc(t('forbidden')) + '</p>' +
                '<div class="mcp-actions">' +
                  (on
                    ? '<button type="button" class="ghost" data-mcp-act="disconnect">' + esc(t('disconnect')) + '</button>'
                    : '<button type="button" class="ok" data-mcp-act="connect">' + esc(t('connect')) + '</button>') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</article>' +
        '</div>' +
        tools +
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
    if (isMcp()) {
      a.classList.add('on');
    } else {
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
