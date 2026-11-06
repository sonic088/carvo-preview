/* CARVO Seller ERP — interactive demo (no secrets, no APIs) */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const da = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('fr-FR') + ' DA');
  const sum = (a, fn) => a.reduce((s, x) => s + (fn ? fn(x) : x), 0);
  const stockOf = (p) => {
    const vals = (p.skus || []).map((s) => s.stock);
    if (!vals.length || vals.every((v) => v === null || v === '')) return null;
    return sum(vals.map((v) => Number(v) || 0));
  };
  const stockLabel = (p) => {
    const t = stockOf(p);
    if (t === null) return 'Inconnu';
    const low = (p.skus || []).filter((s) => s.stock !== null && s.stock !== '' && Number(s.stock) < 3).length;
    return low ? t + ' · ' + low + ' faible' : String(t);
  };

  const TREE = {
    Femme: {
      'Vêtements': ["Robes d'été", 'Robes casual', 'Robes longues', 'Robes de soirée', 'Ensembles · Deux pièces', 'Chemisiers'],
      'Lingerie & culottes': ['Ensembles', 'Nuisettes'],
      Accessoires: ['Écharpes', 'Ceintures']
    },
    Enfant: { Fille: ['Robes', 'Ensembles'], Garçon: ['T-shirts'] },
    Chaussures: { Femme: ['Sandales plates', 'Baskets'], Homme: ['Baskets'] },
    'Sacs & bagages': { Femme: ['Sacs bandoulière', 'Sacs à main'], Homme: ['Sacoches'] }
  };

  const ATTRS = {
    "Robes d'été": { 'Longueur de manches': ['Sans manches', 'Manches courtes', 'Manches longues'], Longueur: ['Mini', 'Midi', 'Maxi'], Matière: ['Coton', 'Viscose', 'Lin', 'Satin'], Coupe: ['Regular', 'Slim', 'Oversize'], Occasion: ['Quotidien', 'Soirée', 'Mariage'], Motif: ['Uni', 'Fleuri', 'Rayé'] },
    default: { Matière: ['Coton', 'Viscose', 'Cuir', 'Similicuir'], Motif: ['Uni', 'Imprimé'] }
  };

  const SUGGEST = [
    { leaf: "Femme › Vêtements › Robes d'été", pct: 92 },
    { leaf: 'Femme › Vêtements › Robes casual', pct: 46 },
    { leaf: 'Femme › Vêtements › Robes longues', pct: 38 }
  ];

  const seedProducts = () => [
    { id:'p1', title:'Lina Coton Bleu Fleuri Robe d’été longue', titleAr:'لينا قطن أزرق مورّد فستان صيفي طويل', leaf:"Femme › Vêtements › Robes d'été", price:3200, status:'en_ligne', badges:['COD','NEW'], source:'formulaire', color:'#7aa3c9', colors:[{name:'Bleu',hex:'#7aa3c9',photos:3},{name:'Blanc',hex:'#e8e4dc',photos:2}], skus:[{c:'Bleu',s:'S',stock:8},{c:'Bleu',s:'M',stock:12},{c:'Bleu',s:'L',stock:14},{c:'Bleu',s:'XL',stock:12}] },
    { id:'p2', title:'Lina Satin Noir Uni Robe de soirée longue', titleAr:'فستان سهرة ساتان أسود', leaf:'Femme › Vêtements › Robes de soirée', price:6900, status:'refuse', badges:[], source:'formulaire', color:'#1f1f1f', refuse:'Catégorie incorrecte → CARVO propose Robes › Robes de soirée', colors:[{name:'Noir',hex:'#1f1f1f',photos:2}], skus:[{c:'Noir',s:'S',stock:3},{c:'Noir',s:'M',stock:5},{c:'Noir',s:'L',stock:4}] },
    { id:'p3', title:'Lina Cuir Doré Uni Sandales plates', titleAr:'صندل جلد ذهبي مسطح', leaf:'Chaussures › Femme › Sandales plates', price:2400, status:'en_ligne', badges:['COD','Low stock'], source:'import 1688', color:'#e6c878', colors:[{name:'Doré',hex:'#e6c878',photos:3}], skus:[{c:'Doré',s:'36',stock:0},{c:'Doré',s:'37',stock:1},{c:'Doré',s:'38',stock:1},{c:'Doré',s:'39',stock:0}] },
    { id:'p4', title:'Lina Viscose Rouge Fleuri Robe d’été midi', titleAr:'فستان صيفي فيسكوز أحمر مورّد', leaf:"Femme › Vêtements › Robes d'été", price:3400, status:'brouillon', badges:[], source:'formulaire', color:'#e8b4b4', colors:[{name:'Rouge',hex:'#d96b6b',photos:1},{name:'Bleu',hex:'#7aa3c9',photos:0}], skus:[{c:'Rouge',s:'S',stock:null},{c:'Rouge',s:'M',stock:9},{c:'Rouge',s:'L',stock:null},{c:'Bleu',s:'S',stock:8},{c:'Bleu',s:'M',stock:12},{c:'Bleu',s:'L',stock:10}] },
    { id:'p5', title:'Lina Lin Beige Uni Ensemble deux pièces', titleAr:'طقم كتّان بيج قطعتين', leaf:'Femme › Vêtements › Ensembles · Deux pièces', price:4800, status:'en_controle', badges:['COD','Trends #lin'], source:'Excel', color:'#d9c7a8', colors:[{name:'Beige',hex:'#d9c7a8',photos:3}], skus:[{c:'Beige',s:'S',stock:7},{c:'Beige',s:'M',stock:10},{c:'Beige',s:'L',stock:8},{c:'Beige',s:'XL',stock:6}] },
    { id:'p6', title:'Lina Similicuir Camel Uni Sac bandoulière', titleAr:'حقيبة كتف جلد صناعي جملي', leaf:'Sacs & bagages › Femme › Sacs bandoulière', price:2150, status:'masque', badges:['COD','HOT #3'], source:'import 1688', color:'#c49a6c', colors:[{name:'Camel',hex:'#c49a6c',photos:2}], skus:[{c:'Camel',s:'Unique',stock:null}] },
    { id:'p7', title:'Lina Coton Blanc Uni Chemiser oversize', titleAr:'قميص قطن أبيض واسع', leaf:'Femme › Vêtements › Chemisiers', price:2900, status:'en_ligne', badges:['NEW'], source:'formulaire', color:'#f3efe6', colors:[{name:'Blanc',hex:'#f3efe6',photos:3},{name:'Noir',hex:'#222',photos:3}], skus:[{c:'Blanc',s:'S',stock:4},{c:'Blanc',s:'M',stock:6},{c:'Blanc',s:'L',stock:5},{c:'Noir',s:'S',stock:3},{c:'Noir',s:'M',stock:5},{c:'Noir',s:'L',stock:2}] },
    { id:'p8', title:'Lina Viscose Vert Sauge Robe midi plissée col V', titleAr:'فستان متوسط طيات أخضر حكيم', leaf:"Femme › Vêtements › Robes d'été", price:3900, status:'en_controle', badges:['1688'], source:'import 1688', color:'#7d9b7a', colors:[{name:'Vert sauge',hex:'#7d9b7a',photos:3},{name:'Noir',hex:'#222',photos:3}], skus:[{c:'Vert sauge',s:'S',stock:null},{c:'Vert sauge',s:'M',stock:null},{c:'Vert sauge',s:'L',stock:null},{c:'Noir',s:'S',stock:null},{c:'Noir',s:'M',stock:null},{c:'Noir',s:'L',stock:null}] }
  ];

  const seedOrders = () => [
    { id:'CV-10482', client:'Amina Benali', short:'Amina B.', phone:'05 •• •• •• 41', wilaya:'Alger · Bab Ezzouar', ship:'Domicile · 600 DA', items:[{n:'Robe d’été longue fleurie bleue',d:'Bleu · M · SKU LIN-RB-BL-M',p:3200,c:'#7aa3c9'},{n:'Sac bandoulière camel',d:'Unique · SKU LIN-SAC-CM',p:2100,c:'#c49a6c'}], total:5900, shipFee:600, status:'a_confirmer', delay:'à appeler avant 18 h', when:'aujourd’hui 10:42', note:'', risk:'' },
    { id:'CV-10481', client:'Nour Hamidi', short:'Nour H.', phone:'07 •• •• •• 19', wilaya:'Oran · Bir El Djir', ship:'Stop desk · 350 DA', items:[{n:'Robe d’été longue fleurie bleue',d:'Blanc · L',p:3200,c:'#e8e4dc'}], total:3200, shipFee:350, status:'a_confirmer', delay:'à appeler avant 16 h', when:'aujourd’hui 10:15', note:'', risk:'' },
    { id:'CV-10480', client:'Yasmine Kaci', short:'Yasmine K.', phone:'05 •• •• •• 73', wilaya:'Tizi Ouzou · Azazga', ship:'Domicile · 700 DA', items:[{n:'Ensemble lin beige',d:'Beige · M',p:4800,c:'#d9c7a8'}], total:4100, shipFee:700, status:'a_confirmer', delay:'risque · vérifier', when:'hier 21:30', note:'', risk:'2 refus de colis' },
    { id:'CV-10479', client:'Sarah Khelifi', short:'Sarah K.', phone:'06 •• •• •• 22', wilaya:'Sétif · Sétif', ship:'Domicile · 500 DA', items:[{n:'Robe midi plissée',d:'Vert sauge · M',p:3900,c:'#7d9b7a'},{n:'Sandales plates',d:'Doré · 38',p:2400,c:'#e6c878'},{n:'Chemiser oversize',d:'Blanc · M',p:2900,c:'#f3efe6'}], total:9750, shipFee:500, status:'confirmee', delay:'', when:'hier 18:02', note:'OK après 16 h', risk:'' },
    { id:'CV-10478', client:'Meriem Djoudi', short:'Meriem D.', phone:'05 •• •• •• 68', wilaya:'Annaba · El Bouni', ship:'Stop desk · 400 DA', items:[{n:'Robe de soirée noire',d:'Noir · M',p:6900,c:'#1f1f1f'},{n:'Sac camel',d:'Unique',p:2150,c:'#c49a6c'}], total:11300, shipFee:400, status:'a_confirmer', delay:'2ᵉ appel', when:'hier 16:40', note:'', risk:'' },
    { id:'CV-10477', client:'Khadidja Saadi', short:'Khadidja S.', phone:'07 •• •• •• 12', wilaya:'Béjaïa · Akbou', ship:'Domicile · 550 DA', items:[{n:'Robe d’été bleue',d:'Bleu · S',p:3200,c:'#7aa3c9'}], total:2400, shipFee:550, status:'a_confirmer', delay:'injoignable 1×', when:'hier 15:05', note:'', risk:'' },
    { id:'CV-10475', client:'Ikram Meziane', short:'Ikram M.', phone:'05 •• •• •• 90', wilaya:'Blida · Boufarik', ship:'Domicile · 450 DA', items:[{n:'Sandales plates',d:'Doré · 37',p:2400,c:'#e6c878'}], total:2400, shipFee:450, status:'expediee', delay:'', when:'4 nov. 14:10', note:'', risk:'' },
    { id:'CV-10471', client:'Lydia Toumi', short:'Lydia T.', phone:'06 •• •• •• 33', wilaya:'Constantine · El Khroub', ship:'Domicile · 650 DA', items:[{n:'Robe d’été bleue',d:'Bleu · L',p:3200,c:'#7aa3c9'},{n:'Chemiser',d:'Noir · M',p:2900,c:'#222'}], total:6100, shipFee:650, status:'livree', delay:'', when:'3 nov. 11:20', note:'', risk:'' },
    { id:'CV-10458', client:'Sara Bensalem', short:'Sara B.', phone:'05 •• •• •• 11', wilaya:'Alger · Hydra', ship:'Domicile · 600 DA', items:[{n:'Sac camel',d:'Unique',p:2150,c:'#c49a6c'}], total:3200, shipFee:600, status:'livree', delay:'', when:'3 nov.', note:'', risk:'' },
    { id:'CV-10492', client:'Ines Cherif', short:'Ines C.', phone:'07 •• •• •• 44', wilaya:'Oran · Es Senia', ship:'Stop desk · 350 DA', items:[{n:'Ensemble lin',d:'Beige · L',p:4800,c:'#d9c7a8'}], total:9750, shipFee:350, status:'livree', delay:'', when:'2 nov.', note:'', risk:'' },
    { id:'CV-10450', client:'Rania Mebarki', short:'Rania M.', phone:'05 •• •• •• 77', wilaya:'Batna', ship:'Domicile · 700 DA', items:[{n:'Robe soirée',d:'Noir · S',p:6900,c:'#1f1f1f'}], total:2400, shipFee:700, status:'retour', delay:'', when:'2 nov.', note:'colis refusé', risk:'' }
  ];

  const RELEVES = [
    { p:'1–7 nov. 2026', colis:27, ventes:142300, retours:4100, com:11050, liv:14750, net:112400, st:'en_cours', lab:'En cours · cash en remontée' },
    { p:'25–31 oct. 2026', colis:34, ventes:176800, retours:2400, com:13950, liv:18200, net:142250, st:'verse', lab:'Versé le 3 nov.' },
    { p:'18–24 oct. 2026', colis:41, ventes:219500, retours:8900, com:17000, liv:18550, net:175050, st:'verse', lab:'Versé le 27 oct.' },
    { p:'11–17 oct. 2026', colis:29, ventes:151200, retours:0, com:12100, liv:15400, net:123700, st:'verse', lab:'Versé le 20 oct.' }
  ];

  const CASH = [
    { id:'CV-10471', d:'3 nov.', amt:6100, st:'remonte', lab:'remonté à CARVO' },
    { id:'CV-10458', d:'3 nov.', amt:3200, st:'chez', lab:'chez le transporteur' },
    { id:'CV-10492', d:'2 nov.', amt:9750, st:'chez', lab:'chez le transporteur' },
    { id:'CV-10450', d:'2 nov.', amt:2400, st:'ko', lab:'colis refusé · retour' }
  ];

  const PST = {
    en_ligne: ['En ligne', 'ok'],
    en_controle: ['En contrôle', 'wa'],
    refuse: ['Refusé', 'ko'],
    brouillon: ['Brouillon', 'n'],
    masque: ['Masqué', 'n']
  };
  const OST = {
    a_confirmer: ['À confirmer', 'wa'],
    confirmee: ['Confirmée', 'ok'],
    expediee: ['Expédiée', 'bl'],
    livree: ['Livrée', 'ok'],
    retour: ['Retour', 'ko'],
    annulee: ['Annulée', 'ko']
  };

  const I18N = {
    fr: { dash:'Tableau de bord', produits:'Produits', ajouter:'Ajouter un produit', commandes:'Commandes', paiements:'Paiements', parametres:'Paramètres', fiche:'Fiche produit ERP', stock:'Stock & prix', import:'Import 1688' },
    ar: { dash:'لوحة القيادة', produits:'المنتجات', ajouter:'إضافة منتج', commandes:'الطلبات', paiements:'المدفوعات', parametres:'الإعدادات', fiche:'بطاقة المنتج', stock:'المخزون والأسعار', import:'استيراد 1688' },
    en: { dash:'Dashboard', produits:'Products', ajouter:'Add a product', commandes:'Orders', paiements:'Payouts', parametres:'Settings', fiche:'ERP product sheet', stock:'Stock & prices', import:'1688 import' }
  };

  const KEY = 'carvo.sellerErp.v1';
  const loadSet = () => {
    try { return Object.assign({ excel:true, formulaire:true, api:true, moteur1688:true, shop:'Boutique Lina', lang:'fr', nNew:true, nRef:true, nStock:true, nPay:false }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch { return { excel:true, formulaire:true, api:true, moteur1688:true, shop:'Boutique Lina', lang:'fr', nNew:true, nRef:true, nStock:true, nPay:false }; }
  };
  const saveSet = () => localStorage.setItem(KEY, JSON.stringify(S.set));

  const S = {
    products: seedProducts(),
    orders: seedOrders(),
    set: loadSet(),
    pFilter: 'tous',
    pQ: '',
    pSort: { k: null, d: 1 },
    oFilter: 'a_confirmer',
    oId: 'CV-10482',
    addStep: 1,
    add: blankAdd(),
    ficheTab: 'infos',
    ficheId: 'p8'
  };

  function blankAdd() {
    return { dept:'Femme', cat:'Vêtements', leaf:null, title:'', titleAr:'', desc:'', attrs:{}, colors:[{name:'Bleu',hex:'#7aa3c9',photos:0},{name:'Rouge',hex:'#d96b6b',photos:0}], sizes:['S','M','L','XL'], stocks:{}, price:'' };
  }

  const routes = {
    dash: { group:'seller' },
    produits: { group:'seller' },
    ajouter: { group:'seller' },
    commandes: { group:'seller' },
    paiements: { group:'seller' },
    parametres: { group:'seller' },
    fiche: { group:'erp' }
  };

  function route() {
    const h = (location.hash || '#/dash').replace(/^#\/?/, '').split(/[/?]/)[0];
    return routes[h] ? h : 'dash';
  }
  function go(r) { location.hash = '#/' + r; }

  function toast(msg, err) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' e' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function t(k) { return (I18N[S.set.lang] || I18N.fr)[k] || I18N.fr[k] || k; }

  function counts() {
    const pc = {};
    S.products.forEach((p) => { pc[p.status] = (pc[p.status] || 0) + 1; });
    const oc = {};
    S.orders.forEach((o) => { oc[o.status] = (oc[o.status] || 0) + 1; });
    return { pc, oc };
  }

  function navHtml() {
    const { pc, oc } = counts();
    const r = route();
    const item = (id, extra) => `<a href="#/${id}" class="${r===id?'on':''}">${esc(t(id))}${extra||''}</a>`;
    const actif = S.set.moteur1688 ? '<span class="badge">ACTIVÉ</span>' : '';
    return `
      ${item('dash')}
      ${item('produits', `<span class="badge">${S.products.length}</span>`)}
      ${item('commandes', oc.a_confirmer ? `<span class="badge am">${oc.a_confirmer}</span>` : '')}
      <a href="#/produits" data-stock="1">${esc(t('stock'))}</a>
      ${item('paiements')}
      <a href="#/dash" data-import="1">${esc(t('import'))}${actif}</a>
      ${item('parametres')}
      <div class="sep">ERP vendeur</div>
      ${item('fiche')}
    `;
  }

  function chipP(st) { const x = PST[st] || [st,'n']; return `<span class="chip ${x[1]}">${esc(x[0])}</span>`; }
  function chipO(st) { const x = OST[st] || [st,'n']; return `<span class="chip ${x[1]}">${esc(x[0])}</span>`; }

  /* ---------- pages ---------- */
  function viewDash() {
    const conf = S.orders.filter((o) => o.status === 'a_confirmer');
    const ref = S.products.filter((p) => p.status === 'refuse');
    const low = S.products.filter((p) => { const n = stockOf(p); return n !== null && (p.skus||[]).some((s) => s.stock !== null && Number(s.stock) < 3); });
    const online = S.products.filter((p) => p.status === 'en_ligne').length;
    const wait = S.products.filter((p) => p.status === 'en_controle').length;
    const brou = S.products.filter((p) => p.status === 'brouillon').length;
    const today = S.orders.filter((o) => /aujourd/.test(o.when)).length + conf.length; // display figure
    return `
      <h1>Bonjour, ${esc(S.set.shop)}</h1>
      <p class="sub">Vendredi 6 novembre 2026 · Validation manuelle (12 / 50 approbations propres avant le mode automatique)</p>
      <div class="row">
        <button class="btn" data-act="excel">Importer Excel</button>
        <button class="btn" data-act="imp1688">Importer depuis 1688</button>
        <a class="btn p" href="#/ajouter">+ Ajouter un produit</a>
      </div>
      <div class="kpis">
        <div class="card kpi"><small>Commandes aujourd’hui</small><b>14</b><span style="color:var(--amb)">${conf.length} à confirmer par téléphone →</span></div>
        <div class="card kpi"><small>Ventes 7 jours</small><b>186 400 DA</b><span style="color:var(--a)">+12 % vs semaine précédente</span></div>
        <div class="card kpi"><small>Produits en ligne</small><b>${online}</b><span>${wait} en contrôle · ${ref.length} refusés · ${brou} brouillons</span></div>
        <div class="card kpi"><small>Stock faible</small><b style="color:var(--amb)">${low.reduce((n,p)=>n+(p.skus||[]).filter(s=>s.stock!==null&&Number(s.stock)<3).length,0)} SKU</b><span>sous 3 unités · stock réel, pas d’estimation</span></div>
      </div>
      <div class="grid2">
        <div class="card">
          <div class="row"><h3 class="grow">Commandes récentes</h3><a href="#/commandes">Toutes les commandes →</a></div>
          <div class="tw"><table>
            <thead><tr><th>N°</th><th>Client</th><th>Wilaya</th><th>Art.</th><th class="r">Total COD</th><th>Statut</th></tr></thead>
            <tbody>${S.orders.slice(0,5).map((o)=>`<tr class="click" data-open-order="${o.id}"><td><b>${o.id}</b></td><td>${esc(o.short)}</td><td>${esc(o.wilaya)}</td><td>${o.items.length}</td><td class="r">${da(o.total)}</td><td>${chipO(o.status)}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div>
          <div class="card" style="margin-bottom:12px">
            <h3>À faire</h3>
            <a class="todo wa" href="#/commandes">${conf.length} commandes à confirmer par téléphone →</a>
            <a class="todo ko" href="#/produits" data-jump-filter="refuse">${ref.length} produits refusés · catégorie incorrecte →</a>
            <a class="todo wa" href="#/produits" data-stock="1">${low.length} produits avec stock faible →</a>
            <a class="todo n" href="#/ajouter">1 photo manquante · « Robe fleurie rouge » →</a>
          </div>
          <div class="card" style="margin-bottom:12px">
            <h3>Quota import 1688</h3>
            <p class="mu">${S.set.moteur1688 ? '212 / 500 produits importés · chemins autorisés : boutique 1688 #88213 · Daigou › Femme › Robes' : 'Porte moteur 1688 désactivée — activez-la dans Paramètres (démo).'}</p>
            <div class="bar"><i style="width:${S.set.moteur1688?42:0}%"></i></div>
            <p><a href="#/parametres">voir les permissions</a></p>
          </div>
          <div class="card kpi dark">
            <small>Prochain reversement</small>
            <b>142 300 DA</b>
            <span>le 7 novembre · COD encaissé chez le transporteur · commission 8 % déduite</span>
            <p><a href="#/paiements" style="color:#fff">Voir le relevé →</a></p>
          </div>
        </div>
      </div>`;
  }

  function filteredProducts() {
    let list = S.products.slice();
    if (S.pFilter !== 'tous') list = list.filter((p) => p.status === S.pFilter);
    if (S.pQ) {
      const q = S.pQ.toLowerCase();
      list = list.filter((p) => (p.title + p.leaf + p.id).toLowerCase().includes(q) || (p.skus||[]).some((s)=> (s.c+' '+s.s).toLowerCase().includes(q)));
    }
    if (S.pSort.k === 'price') list.sort((a,b) => (a.price-b.price)*S.pSort.d);
    if (S.pSort.k === 'stock') list.sort((a,b) => ((stockOf(a)??-1)-(stockOf(b)??-1))*S.pSort.d);
    if (S.pSort.k === 'title') list.sort((a,b) => a.title.localeCompare(b.title,'fr')*S.pSort.d);
    return list;
  }

  function viewProduits() {
    const { pc } = counts();
    const list = filteredProducts();
    const tabs = [
      ['tous','Tous', S.products.length],
      ['en_ligne','En ligne', pc.en_ligne||0],
      ['en_controle','En contrôle', pc.en_controle||0],
      ['refuse','Refusés', pc.refuse||0],
      ['brouillon','Brouillons', pc.brouillon||0],
      ['masque','Masqués', pc.masque||0]
    ];
    return `
      <h1>Produits</h1>
      <p class="sub">Tout ce qui se soumet passe par la validation CARVO avant d’être en ligne. Le stock vide = inconnu, jamais une estimation.</p>
      <div class="row">
        <button class="btn" data-act="excel">Importer Excel</button>
        <button class="btn" data-act="imp1688">Importer depuis 1688</button>
        <a class="btn p" href="#/ajouter">+ Ajouter un produit</a>
      </div>
      <div class="tabs">${tabs.map(([id,l,n])=>`<button data-pf="${id}" class="${S.pFilter===id?'on':''}">${l} ${n}</button>`).join('')}</div>
      <div class="row" style="margin:8px 0 12px">
        <input class="grow" type="search" id="pq" placeholder="Rechercher par titre, SKU, catégorie…" value="${esc(S.pQ)}" />
      </div>
      <div class="card" style="padding:0">
        <div class="tw"><table>
          <thead><tr>
            <th class="s" data-sort="title">Produit</th>
            <th>Feuille</th>
            <th class="s r" data-sort="price">Prix</th>
            <th class="s" data-sort="stock">Stock réel</th>
            <th>Badges</th>
            <th>Statut</th>
            <th></th>
          </tr></thead>
          <tbody>${list.map((p) => `
            <tr class="click" data-open-prod="${p.id}">
              <td><span class="thumb" style="background:${p.color}"></span><b>${esc(p.title)}</b><div class="mu">${(p.skus||[]).length} SKU · ${esc(p.source)}</div></td>
              <td class="mu">${esc(p.leaf)}</td>
              <td class="r">${da(p.price)}</td>
              <td>${esc(stockLabel(p))}</td>
              <td>${(p.badges||[]).map((b)=>`<span class="chip">${esc(b)}</span>`).join(' ')}</td>
              <td>${chipP(p.status)}${p.refuse?`<div class="mu" style="color:var(--red);max-width:220px">${esc(p.refuse)}</div>`:''}</td>
              <td>${p.status==='refuse'?'<button class="btn sm d" data-fix="'+p.id+'">Corriger</button>':p.status==='brouillon'?'<a class="btn sm p" href="#/ajouter">Compléter</a>':'<button class="btn sm" data-open-prod="'+p.id+'">Voir</button>'}</td>
            </tr>`).join('') || `<tr><td colspan="7" class="mu">Aucun produit pour ce filtre.</td></tr>`}
          </tbody>
        </table></div>
        <p class="mu" style="padding:10px 14px">${list.length} / ${S.products.length} produits</p>
      </div>`;
  }

  function viewAjouter() {
    const a = S.add;
    const cats = Object.keys(TREE[a.dept] || {});
    const leaves = (TREE[a.dept] || {})[a.cat] || [];
    const step1 = `
      <p class="sub">On choisit d’abord la feuille (rayon › catégorie › feuille). Jamais une catégorie parente.</p>
      <div class="card" style="margin-bottom:12px">
        <h3>Suggestions d’après votre titre et vos photos</h3>
        ${SUGGEST.map((s)=>`<button class="btn sm" style="margin:0 6px 6px 0" data-pick-leaf="${esc(s.leaf)}">${esc(s.leaf.split(' › ').pop())} · ${s.pct}%</button>`).join('')}
      </div>
      <div class="card">
        <div class="mu" style="margin-bottom:8px">Sélection : <b>${esc(a.dept)}</b> › ${esc(a.cat || '…')} ${a.leaf? '› <b>'+esc(a.leaf)+'</b>':''}</div>
        <div class="tree">
          <div><h4>Département</h4>${Object.keys(TREE).map((d)=>`<button class="${d===a.dept?'on':''}" data-dept="${esc(d)}">${esc(d)}</button>`).join('')}</div>
          <div><h4>Catégorie</h4>${cats.map((c)=>`<button class="${c===a.cat?'on':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          <div><h4>Feuille</h4>${leaves.map((l)=>`<button class="${l===a.leaf?'on':''}" data-leaf="${esc(l)}">${esc(l)}</button>`).join('') || '<p class="mu" style="padding:12px">Choisissez une catégorie.</p>'}</div>
        </div>
        ${a.leaf ? `<div class="card" style="background:var(--ambs);border-color:#f3e0b5;margin-top:12px">
          <b>Cette feuille exige</b>
          <ul class="check">
            <li>• Attributs (liste) : ${(ATTRS[a.leaf]||ATTRS.default) && Object.keys(ATTRS[a.leaf]||ATTRS.default).join(', ')}</li>
            <li>• Photos 3:4 par couleur · guide des tailles en cm</li>
            <li>• Stock réel par SKU — vide = inconnu, jamais 0 inventé</li>
          </ul>
        </div>` : `<p class="mu" style="margin-top:12px">Aucune feuille choisie — le bouton Continuer reste bloqué.</p>`}
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn" data-save-draft>Enregistrer le brouillon</button>
        <button class="btn p" data-to-details ${a.leaf?'':'disabled'}>Continuer → Détails & variantes</button>
      </div>`;

    const dict = ATTRS[a.leaf] || ATTRS.default;
    const skuRows = a.colors.map((c) => `<tr><td><span class="thumb" style="width:18px;height:18px;background:${c.hex};margin:0 6px 0 0"></span>${esc(c.name)}</td>${a.sizes.map((sz) => {
      const k = c.name+'|'+sz; const v = a.stocks[k];
      return `<td><input class="mini" type="number" min="0" placeholder="?" data-sku="${esc(k)}" value="${v==null||v===''?'':esc(v)}" /></td>`;
    }).join('')}<td class="r">${a.price?da(a.price):'—'}</td></tr>`).join('');

    const step2 = `
      <p class="sub">Feuille : <b>${esc(a.dept)} › ${esc(a.cat)} › ${esc(a.leaf)}</b> · attributs liste, photos 3:4, SKU stock réel (vide = inconnu).</p>
      <div class="grid2">
        <div>
          <div class="card" style="margin-bottom:12px">
            <div class="fg"><label class="f">Titre (FR)</label><input id="add-title" value="${esc(a.title)}" placeholder="Lina Viscose Rouge Fleuri Robe d’été midi" /></div>
            <div class="fg"><label class="f">Titre (AR) — généré / modifiable</label><input id="add-titleAr" dir="rtl" value="${esc(a.titleAr)}" placeholder="لينا فيسكوز أحمر مورّد فستان صيفي" /></div>
            <div class="fg"><label class="f">Description</label><textarea id="add-desc" rows="3">${esc(a.desc)}</textarea></div>
          </div>
          <div class="card" style="margin-bottom:12px">
            <h3>Attributs de la feuille « ${esc(a.leaf)} »</h3>
            <div class="row">${Object.entries(dict).map(([k,opts]) => `<div class="fg" style="min-width:160px;flex:1"><label class="f">${esc(k)}</label><select data-attr="${esc(k)}"><option value="">— choisir —</option>${opts.map((o)=>`<option ${a.attrs[k]===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`).join('')}</div>
          </div>
          <div class="card" style="margin-bottom:12px">
            <h3>Photos par couleur · ratio 3:4</h3>
            <div class="row">${a.colors.map((c,i)=>`
              <div>
                <div class="mu">${esc(c.name)} · ${c.photos}/3</div>
                <div class="photos">${[0,1,2].map((n)=>`<div class="ph ${n<c.photos?'f':''}" style="${n<c.photos?'background:'+c.hex:''}" data-photo="${i}">${n<c.photos?'ok':'+'}</div>`).join('')}</div>
              </div>`).join('')}
              <button class="btn sm" data-add-color>+ Ajouter une couleur</button>
            </div>
          </div>
          <div class="card" style="margin-bottom:12px">
            <h3>Variantes · couleur × taille = SKU</h3>
            <p class="mu">Stock réel par SKU. Vide = inconnu (ne sera pas masqué comme zéro).</p>
            <div class="tw"><table>
              <thead><tr><th>Couleur</th>${a.sizes.map((s)=>`<th>${esc(s)}</th>`).join('')}<th class="r">Prix DA</th></tr></thead>
              <tbody>${skuRows}</tbody>
            </table></div>
            <div class="row" style="margin-top:10px">
              <div class="fg" style="max-width:180px"><label class="f">Prix de vente (DA)</label><input id="add-price" type="number" min="0" value="${esc(a.price)}" /></div>
              <button class="btn sm" data-add-size>Ajouter une taille</button>
            </div>
          </div>
          <div class="card">
            <h3>Guide des tailles · cm</h3>
            <div class="tw"><table>
              <thead><tr><th>Taille</th><th>Poitrine</th><th>Taille</th><th>Hanches</th><th>Longueur</th></tr></thead>
              <tbody>
                <tr><td>S</td><td><input class="mini" value="86"></td><td><input class="mini" value="68"></td><td><input class="mini" value="92"></td><td><input class="mini" value="112"></td></tr>
                <tr><td>M</td><td><input class="mini" value="90"></td><td><input class="mini" value="72"></td><td><input class="mini" value="96"></td><td><input class="mini" value="113"></td></tr>
                <tr><td>L</td><td><input class="mini" value="94"></td><td><input class="mini" value="76"></td><td><input class="mini" value="100"></td><td><input class="mini" value="114"></td></tr>
                <tr><td>XL</td><td><input class="mini" value="98"></td><td><input class="mini" value="80"></td><td><input class="mini" value="104"></td><td><input class="mini" value="115"></td></tr>
              </tbody>
            </table></div>
          </div>
        </div>
        <div>
          <div class="card" style="margin-bottom:12px">
            <h3>Avant de soumettre</h3>
            <ul class="check">
              <li style="color:var(--a)">● Feuille choisie · ${esc(a.leaf)}</li>
              <li style="color:${a.title.trim().length>=5?'var(--a)':'var(--red)'}">● Titre · ${a.title.trim().length} / 5 car. min</li>
              <li>● Photos · ${sum(a.colors,c=>c.photos)} placées (placeholders 3:4)</li>
              <li>● SKU · ${a.colors.length} × ${a.sizes.length} = ${a.colors.length*a.sizes.length}</li>
            </ul>
            <button class="btn p" style="width:100%;margin-top:8px" data-submit-add>Soumettre à la validation</button>
            <button class="btn" style="width:100%;margin-top:6px" data-save-draft>Enregistrer le brouillon</button>
          </div>
          <div class="card preview">
            <div class="img" style="background:${(a.colors[0]||{}).hex||'#ddd'}"></div>
            <b>${esc(a.title || 'Titre de la carte')}</b>
            <div>${a.price?da(a.price):'— DA'}</div>
          </div>
        </div>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn" data-back-leaf>← Retour à la feuille</button></div>`;

    return `
      <h1>Ajouter un produit</h1>
      <div class="steps">
        <span class="step ${S.addStep===1?'on':(a.leaf?'done':'')}">1. Feuille</span>
        <span class="step ${S.addStep===2?'on':''}">2. Détails & variantes</span>
      </div>
      ${S.addStep===1?step1:step2}`;
  }

  function viewCommandes() {
    const { oc } = counts();
    const tabs = [
      ['tous','Toutes', S.orders.length],
      ['a_confirmer','À confirmer', oc.a_confirmer||0],
      ['confirmee','Confirmées · à préparer', oc.confirmee||0],
      ['expediee','Expédiées', oc.expediee||0],
      ['livree','Livrées', oc.livree||0],
      ['retour','Retours', oc.retour||0],
      ['annulee','Annulées', oc.annulee||0]
    ];
    const list = S.oFilter==='tous' ? S.orders : S.orders.filter((o)=>o.status===S.oFilter);
    const o = S.orders.find((x)=>x.id===S.oId) || list[0] || S.orders[0];
    if (o && S.oId !== o.id) S.oId = o.id;
    const detail = o ? `
      <div class="card">
        <div class="row"><b>${o.id}</b> ${chipO(o.status)}</div>
        <p class="mu">${esc(o.when)} · via l’application · stock réservé</p>
        <p><b>Client</b><br>${esc(o.client)}<br>${esc(o.phone)} · <button class="btn sm" data-reveal="${o.id}">afficher le numéro</button><br>${esc(o.wilaya)} · ${esc(o.ship)}${o.risk?`<br><span class="chip ko">${esc(o.risk)}</span>`:''}</p>
        <h3>Articles</h3>
        ${o.items.map((it)=>`<div class="row" style="margin-bottom:8px"><span class="thumb" style="background:${it.c}"></span><div class="grow">${esc(it.n)}<div class="mu">${esc(it.d)}</div></div><div>${da(it.p)}</div></div>`).join('')}
        <p>Sous-total ${da(sum(o.items,i=>i.p))}<br>Livraison ${da(o.shipFee)}<br><b>À encaisser (COD) ${da(o.total)}</b></p>
        <div class="fg"><label class="f">Note d’appel</label><textarea id="onote" rows="2" placeholder="Ex. : confirme, livraison l’après-midi">${esc(o.note)}</textarea></div>
        <button class="btn" style="width:100%;margin-bottom:8px" data-call="${o.id}">Appeler · WhatsApp</button>
        <div class="row">
          <button class="btn p grow" data-confirm="${o.id}" ${o.status!=='a_confirmer'?'disabled':''}>Confirmer → préparer</button>
          <button class="btn d" data-cancel="${o.id}" ${o.status==='annulee'||o.status==='livree'?'disabled':''}>Annuler (motif)</button>
        </div>
        <p class="mu">Après confirmation : bordereau du transporteur généré (démo). Annulation = stock libéré.</p>
      </div>` : '<p class="mu">Aucune commande.</p>';
    return `
      <h1>Commandes</h1>
      <p class="sub">Paiement à la livraison (COD). Une commande part seulement après confirmation téléphonique CARVO. Le stock est réservé dès la commande.</p>
      <div class="row"><button class="btn" data-act="export">Exporter (Excel)</button><button class="btn p" data-act="bord">Imprimer les bordereaux (${S.orders.filter(o=>o.status==='confirmee').length})</button></div>
      <div class="tabs">${tabs.map(([id,l,n])=>`<button data-of="${id}" class="${S.oFilter===id?'on':''}">${l} ${n}</button>`).join('')}</div>
      <div class="grid2">
        <div class="card" style="padding:0">
          <div class="tw"><table>
            <thead><tr><th>Commande</th><th>Client</th><th>Livraison</th><th class="r">Total COD</th><th>Délai</th></tr></thead>
            <tbody>${list.map((x)=>`<tr class="click ${x.id===S.oId?'sel':''}" data-sel-order="${x.id}">
              <td><b>${x.id}</b><div class="mu">${esc(x.when)} · ${x.items.length} art.</div></td>
              <td>${esc(x.short)}</td>
              <td>${esc(x.wilaya)}<div class="mu">${esc(x.ship)}</div></td>
              <td class="r">${da(x.total)}</td>
              <td>${x.delay?`<span class="chip wa">${esc(x.delay)}</span>`:chipO(x.status)}</td>
            </tr>`).join('') || `<tr><td colspan="5" class="mu">Aucune commande dans cet onglet.</td></tr>`}</tbody>
          </table></div>
        </div>
        ${detail}
      </div>`;
  }

  function viewPaiements() {
    return `
      <h1>Paiements</h1>
      <p class="sub">Le transporteur encaisse le COD, CARVO déduit sa commission 8 % et les frais, puis vous reverse le net.</p>
      <div class="row"><button class="btn" data-act="pdf">Télécharger le relevé (PDF)</button><button class="btn" data-act="export">Exporter (Excel)</button></div>
      <div class="kpis">
        <div class="card kpi"><small>COD chez le transporteur</small><b>142 300 DA</b><span>27 colis livrés, cash non encore remonté</span></div>
        <div class="card kpi"><small>Reversé en novembre</small><b>318 900 DA</b><span style="color:var(--a)">2 virements effectués</span></div>
        <div class="card kpi"><small>Commission CARVO · 8 %</small><b>27 500 DA</b><span>sur les ventes livrées du mois</span></div>
        <div class="card kpi dark"><small>Prochain reversement</small><b>7 nov.</b><span>≈ 112 400 DA net · vers CCP **** 2231</span></div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="row"><h3 class="grow">Relevés hebdomadaires</h3><span class="mu">net = ventes livrées − retours − commission − frais de livraison avancés</span></div>
        <div class="tw"><table>
          <thead><tr><th>Période</th><th>Colis</th><th>Ventes livrées</th><th>Retours</th><th>Commission 8 %</th><th>Livraison</th><th>Net</th><th>Statut</th></tr></thead>
          <tbody>${RELEVES.map((r)=>`<tr>
            <td>${esc(r.p)}</td><td>${r.colis}</td><td>${da(r.ventes)}</td>
            <td style="color:var(--red)">− ${da(r.retours)}</td><td>− ${da(r.com)}</td><td>− ${da(r.liv)}</td>
            <td><b>${da(r.net)}</b></td>
            <td><span class="chip ${r.st==='verse'?'ok':'wa'}">${esc(r.lab)}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="grid2">
        <div class="card">
          <h3>Suivi du cash COD · semaine en cours</h3>
          <div class="tw"><table>
            <thead><tr><th>Commande</th><th>Livrée le</th><th>Encaissé</th><th>Cash</th></tr></thead>
            <tbody>${CASH.map((c)=>`<tr><td><b>${c.id}</b></td><td>${c.d}</td><td>${da(c.amt)}</td><td><span class="chip ${c.st==='remonte'?'ok':c.st==='ko'?'ko':'wa'}">${esc(c.lab)}</span></td></tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div class="card">
          <h3>Compte de reversement</h3>
          <p>Titulaire<br><b>Boutique Lina EURL</b></p>
          <p>CCP / RIP<br>**** **** **** 2231 (CCP)</p>
          <p class="mu">Registre de commerce 16/00-••••• B 23<br>Rythme hebdomadaire · le lundi · minimum 10 000 DA</p>
          <button class="btn" data-act="compte">Modifier le compte (vérification CARVO)</button>
        </div>
      </div>`;
  }

  function viewParametres() {
    const s = S.set;
    const row = (key, code, title, desc, extra='') => `
      <div class="perm">
        <div class="grow"><code>${code}</code><div>${esc(title)}</div><div class="mu">${desc}</div>${extra}</div>
        <div class="st" style="color:${s[key]?'var(--a)':'var(--mu)'}">${s[key]?'ACTIVÉ':'OFF'}</div>
        <label class="sw"><input type="checkbox" data-door="${key}" ${s[key]?'checked':''} /><span></span></label>
      </div>`;
    return `
      <h1>Paramètres & permissions</h1>
      <p class="sub">En production, les portes sont accordées par CARVO. Ici (démo), vous pouvez les basculer — l’état est enregistré dans ce navigateur.</p>
      <div class="grid2">
        <div class="card">
          <div class="row"><h3 class="grow">Permissions · ${esc(s.shop)} · id 0042</h3><span class="chip ok">Vendeur de confiance</span></div>
          ${row('excel','doors.excel','Importer via Excel','Fichier catalogue · une ligne = un SKU.')}
          ${row('formulaire','doors.formulaire','Formulaire produit','Saisie feuille → détails depuis Ajouter un produit.')}
          ${row('api','doors.api','API vendeur','Clé API : ca_live_•••• 7f2a <button class="btn sm" data-act="regen">Régénérer</button>')}
          ${row('moteur1688','engine.import','Moteur 1688','Importer depuis des chemins attribués. Quota : 500 / mois · 212 utilisées.','<div class="mu">Chemins : boutique 1688 #88213 · Daigou › Femme › Robes</div>')}
          <p class="mu">engine.search (découvrir sur 1688 / Daigou) reste verrouillé — réservé aux comptes CARVO.</p>
          <div class="fg"><label class="f">Mode de validation</label><div class="bar"><i style="width:24%"></i></div><div class="mu">Manuel · passage automatique après 50 approbations propres · 12 / 50</div></div>
          <button class="btn" data-act="demande">Faire une demande à CARVO</button>
        </div>
        <div>
          <div class="card" style="margin-bottom:12px">
            <h3>Équipe & rôles</h3>
            <p><b>Lina M.</b> · lina@… <span class="chip ok">Propriétaire</span></p>
            <p><b>Samir A.</b> · stock · prix · import <span class="chip">Gestionnaire catalogue</span></p>
            <p><b>Wissam K.</b> · appels · préparation · bordereaux <span class="chip bl">Préparatrice commandes</span></p>
          </div>
          <div class="card">
            <h3>Boutique</h3>
            <div class="fg"><label class="f">Nom affiché dans l’application</label><input id="shop" value="${esc(s.shop)}" /></div>
            <div class="fg"><label class="f">Notifications</label>
              <label><input type="checkbox" data-n="nNew" ${s.nNew?'checked':''}/> Nouvelle commande · WhatsApp + application</label><br>
              <label><input type="checkbox" data-n="nRef" ${s.nRef?'checked':''}/> Produit refusé ou approuvé</label><br>
              <label><input type="checkbox" data-n="nStock" ${s.nStock?'checked':''}/> Stock faible (sous 3 unités)</label><br>
              <label><input type="checkbox" data-n="nPay" ${s.nPay?'checked':''}/> Reversement effectué · par e-mail</label>
            </div>
            <button class="btn p" data-save-shop>Enregistrer</button>
          </div>
        </div>
      </div>`;
  }

  function viewFiche() {
    const p = S.products.find((x)=>x.id===S.ficheId) || S.products[0];
    S.ficheId = p.id;
    const tabs = [['infos','Informations'],['couleurs','Couleurs & photos'],['sku','SKU & stock'],['guide','Guide des tailles'],['apercu','Aperçu'],['controle','Contrôle']];
    const photosOk = (p.colors||[]).every((c)=>c.photos>=1);
    const titleOk = (p.title||'').length>=5;
    const leafOk = !!p.leaf;
    const priceOk = p.price>0;
    const skuN = (p.skus||[]).length;
    const known = (p.skus||[]).filter((s)=>s.stock!==null&&s.stock!=='').length;
    const score = [leafOk,titleOk,photosOk,skuN>0,priceOk,true,true,p.status!=='refuse'].filter(Boolean).length;
    let body = '';
    if (S.ficheTab==='infos') body = `
      <div class="fg"><label class="f">Feuille</label><input value="${esc(p.leaf)}" readonly /></div>
      <div class="fg"><label class="f">Titre FR</label><input data-ft="title" value="${esc(p.title)}" /></div>
      <div class="fg"><label class="f">Titre AR</label><input dir="rtl" data-ft="titleAr" value="${esc(p.titleAr||'')}" /></div>
      <div class="row">
        <div class="fg grow"><label class="f">Prix de vente (DA)</label><input type="number" data-ft="price" value="${p.price}" /></div>
        <div class="fg grow"><label class="f">Source</label><input value="${esc(p.source)}" readonly /></div>
      </div>
      <p class="mu">Les données brutes 1688 ne sortent jamais de l’ERP. Seule la fiche validée part vers l’application.</p>`;
    if (S.ficheTab==='couleurs') body = `
      <p class="mu">Photos 3:4 par couleur. Cliquez un emplacement pour le remplir (démo).</p>
      ${(p.colors||[]).map((c,i)=>`<div style="margin-bottom:12px"><b>${esc(c.name)}</b>
        <div class="photos">${[0,1,2].map((n)=>`<div class="ph ${n<c.photos?'f':''}" style="${n<c.photos?'background:'+c.hex:''}" data-fphoto="${p.id}:${i}">${n<c.photos?'ok':'+'}</div>`).join('')}</div>
      </div>`).join('')}`;
    if (S.ficheTab==='sku') body = `
      <p class="mu">Stock réel par SKU. Laissez vide = inconnu (affiché tel quel, jamais transformé en 0).</p>
      <div class="tw"><table>
        <thead><tr><th>Couleur</th><th>Taille</th><th>Code SKU</th><th>Stock</th><th class="r">Prix DA</th></tr></thead>
        <tbody>${(p.skus||[]).map((s,i)=>`<tr>
          <td>${esc(s.c)}</td><td>${esc(s.s)}</td>
          <td class="mu">LIN-${esc(s.c.slice(0,3).toUpperCase())}-${esc(s.s)}</td>
          <td><input class="mini" type="number" min="0" placeholder="inconnu" data-fstock="${p.id}:${i}" value="${s.stock==null||s.stock===''?'':s.stock}" /></td>
          <td class="r">${da(p.price)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    if (S.ficheTab==='guide') body = `
      <p class="mu">Structure héritée de la feuille · mesures en cm, aucune valeur inventée par défaut au-delà du modèle.</p>
      <div class="tw"><table>
        <thead><tr><th>Taille</th><th>Poitrine (cm)</th><th>Taille (cm)</th><th>Hanches (cm)</th><th>Longueur (cm)</th></tr></thead>
        <tbody>
          <tr><td>S</td><td><input class="mini" value="86"></td><td><input class="mini" value="68"></td><td><input class="mini" value="92"></td><td><input class="mini" value="112"></td></tr>
          <tr><td>M</td><td><input class="mini" value="90"></td><td><input class="mini" value="72"></td><td><input class="mini" value="96"></td><td><input class="mini" value="113"></td></tr>
          <tr><td>L</td><td><input class="mini" value="94"></td><td><input class="mini" value="76"></td><td><input class="mini" value="100"></td><td><input class="mini" value="114"></td></tr>
        </tbody>
      </table></div>`;
    if (S.ficheTab==='apercu') body = `
      <div class="preview">
        <div class="img" style="background:${p.color}"></div>
        <div class="mu">COD · NEW</div>
        <b>${esc(p.title)}</b>
        <div>${da(p.price)}</div>
        <div class="row">${(p.colors||[]).map(c=>`<span class="thumb" style="width:18px;height:18px;background:${c.hex};margin:0"></span>`).join('')}</div>
      </div>
      <p class="mu">Aperçu carte application — le visuel suit le titre, le prix et la première couleur.</p>`;
    if (S.ficheTab==='controle') body = `
      <p><b>Contrôle avant envoi · ${score} / 8</b></p>
      <ul class="check">
        <li>${leafOk?'✓':'○'} Une feuille choisie · ${esc(p.leaf)}</li>
        <li>${titleOk?'✓':'○'} Titre 5 à 80 caractères</li>
        <li>${photosOk?'✓':'○'} ≥ 1 photo par couleur</li>
        <li>✓ Guide des tailles (modèle feuille)</li>
        <li>✓ Stock renseigné ou laissé inconnu (${known}/${skuN} connus)</li>
        <li>${priceOk?'✓':'○'} Prix de vente</li>
        <li>✓ Atelier prix — écart source non calculé en démo</li>
        <li>${p.status!=='refuse'?'✓':'○'} Motif de refus levé</li>
      </ul>
      <button class="btn p" data-send-ctrl="${p.id}">Envoyer au contrôle CARVO</button>`;

    return `
      <h1>Fiche produit ERP</h1>
      <p class="sub">Saisie complète côté vendeur / import 1688. Données brutes 1688 ne sortent jamais de l’ERP.</p>
      <div class="row" style="margin-bottom:10px">
        <select id="fiche-pick">${S.products.map((x)=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select>
        ${chipP(p.status)}
      </div>
      <div class="tabs">${tabs.map(([id,l])=>`<button data-ftab="${id}" class="${S.ficheTab===id?'on':''}">${l}</button>`).join('')}</div>
      <div class="card">${body}</div>`;
  }

  function pages() {
    return { dash: viewDash, produits: viewProduits, ajouter: viewAjouter, commandes: viewCommandes, paiements: viewPaiements, parametres: viewParametres, fiche: viewFiche };
  }

  function render() {
    const r = route();
    $('#nav').innerHTML = navHtml();
    $('#crumb').textContent = 'Seller Center · ' + t(r);
    $('#view').innerHTML = pages()[r]();
    document.documentElement.lang = S.set.lang === 'ar' ? 'ar' : (S.set.lang === 'en' ? 'en' : 'fr');
    $$('.langs button').forEach((b) => b.classList.toggle('on', b.textContent.toLowerCase() === S.set.lang));
    if (r === 'produits') {
      const inp = $('#pq');
      if (inp) {
        inp.addEventListener('input', () => { S.pQ = inp.value; render(); const n=$('#pq'); if(n){ n.focus(); n.setSelectionRange(S.pQ.length,S.pQ.length);} });
      }
    }
  }

  function openDrawer(html) {
    $('#drawerIn').innerHTML = '<button class="x" data-close-drawer>×</button>' + html;
    $('#drawer').classList.add('on');
  }
  function closeDrawer() { $('#drawer').classList.remove('on'); }

  function showProduct(id) {
    const p = S.products.find((x)=>x.id===id);
    if (!p) return;
    openDrawer(`
      <h2 style="margin:0 40px 6px 0;font-size:18px">${esc(p.title)}</h2>
      <p>${chipP(p.status)} · ${esc(p.leaf)} · ${da(p.price)}</p>
      ${p.refuse?`<p style="color:var(--red)">${esc(p.refuse)}</p>`:''}
      <p class="mu">${esc(p.titleAr||'')}</p>
      <h3>SKU & stock réel</h3>
      <div class="tw"><table>
        <thead><tr><th>Couleur</th><th>Taille</th><th>Stock</th></tr></thead>
        <tbody>${(p.skus||[]).map((s,i)=>`<tr>
          <td>${esc(s.c)}</td><td>${esc(s.s)}</td>
          <td><input class="mini" type="number" min="0" placeholder="inconnu" data-dstock="${p.id}:${i}" value="${s.stock==null||s.stock===''?'':s.stock}" /></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="mu">Total : ${esc(stockLabel(p))} · vide = inconnu</p>
      <div class="row">
        <a class="btn p" href="#/fiche" data-to-fiche="${p.id}">Ouvrir la fiche ERP</a>
        <button class="btn" data-close-drawer>Fermer</button>
      </div>`);
  }

  function promptMotif() {
    return window.prompt('Motif d’annulation (obligatoire) :');
  }

  function onClick(e) {
    const b = e.target.closest('[data-act],[data-pf],[data-of],[data-open-prod],[data-open-order],[data-sel-order],[data-confirm],[data-call],[data-cancel],[data-dept],[data-cat],[data-leaf],[data-pick-leaf],[data-to-details],[data-back-leaf],[data-save-draft],[data-submit-add],[data-add-color],[data-add-size],[data-photo],[data-fphoto],[data-ftab],[data-send-ctrl],[data-to-fiche],[data-fix],[data-jump-filter],[data-stock],[data-import],[data-reveal],[data-close-drawer],[data-save-shop],.burger,.scrim,.langs button,.drawer');
    if (!b) return;

    if (b.classList.contains('burger')) { $('#side').classList.add('on'); $('#scrim').classList.add('on'); return; }
    if (b.id === 'scrim' || b.classList.contains('scrim')) { $('#side').classList.remove('on'); $('#scrim').classList.remove('on'); return; }
    if (b.matches('.langs button')) { S.set.lang = b.textContent.toLowerCase(); saveSet(); render(); return; }
    if (b.hasAttribute('data-close-drawer') || (b.id==='drawer' && e.target.id==='drawer')) { closeDrawer(); return; }

    const act = b.getAttribute('data-act');
    if (act === 'excel') {
      if (!S.set.excel) return toast('Porte Excel désactivée — activez-la dans Paramètres.', true);
      return toast('Démo : import Excel non branché (aucune donnée envoyée).');
    }
    if (act === 'imp1688') {
      if (!S.set.moteur1688) return toast('Porte moteur 1688 désactivée — activez-la dans Paramètres.', true);
      return toast('Démo : import 1688 non branché. La méthode reste celle du dossier (D-034).');
    }
    if (act === 'export') return toast('Démo : export généré localement — aucun fichier réel.');
    if (act === 'bord') return toast('Démo : ' + S.orders.filter(o=>o.status==='confirmee').length + ' bordereau(x) à préparer.');
    if (act === 'pdf') return toast('Démo : relevé PDF de la semaine en cours.');
    if (act === 'compte') return toast('Démo : modification du CCP soumise à vérification CARVO.');
    if (act === 'regen') return toast('Démo : une nouvelle clé API serait affichée ici — aucune clé réelle.');
    if (act === 'demande') return toast('Démo : demande envoyée à l’équipe CARVO.');

    if (b.hasAttribute('data-import')) {
      e.preventDefault();
      if (!S.set.moteur1688) return toast('Porte moteur 1688 désactivée — activez-la dans Paramètres.', true);
      return toast('Démo : quota 212 / 500 · chemins Daigou › Femme › Robes. Import non branché.');
    }
    if (b.hasAttribute('data-stock')) { S.pFilter = 'tous'; /* keep */ }
    if (b.hasAttribute('data-jump-filter')) { S.pFilter = b.getAttribute('data-jump-filter'); }

    if (b.hasAttribute('data-pf')) { S.pFilter = b.getAttribute('data-pf'); render(); return; }
    if (b.hasAttribute('data-of')) { S.oFilter = b.getAttribute('data-of'); render(); return; }
    if (b.hasAttribute('data-open-prod')) { e.preventDefault(); e.stopPropagation(); showProduct(b.getAttribute('data-open-prod')); return; }
    if (b.hasAttribute('data-fix')) { S.addStep = 1; toast('Corrigez d’abord la feuille, puis les détails.'); go('ajouter'); return; }
    if (b.hasAttribute('data-open-order')) { S.oId = b.getAttribute('data-open-order'); S.oFilter = 'tous'; go('commandes'); return; }
    if (b.hasAttribute('data-sel-order')) { S.oId = b.getAttribute('data-sel-order'); render(); return; }

    if (b.hasAttribute('data-call')) {
      const o = S.orders.find((x)=>x.id===b.getAttribute('data-call'));
      return toast('Appel simulé · WhatsApp vers ' + o.short + ' (' + o.phone + ')');
    }
    if (b.hasAttribute('data-confirm')) {
      const o = S.orders.find((x)=>x.id===b.getAttribute('data-confirm'));
      if (!o || o.status !== 'a_confirmer') return;
      o.status = 'confirmee';
      const note = $('#onote'); if (note) o.note = note.value;
      toast('Commande ' + o.id + ' confirmée — à préparer. Stock réservé.');
      render(); return;
    }
    if (b.hasAttribute('data-cancel')) {
      const o = S.orders.find((x)=>x.id===b.getAttribute('data-cancel'));
      const motif = promptMotif();
      if (!motif || !motif.trim()) return toast('Annulation annulée : motif obligatoire.', true);
      o.status = 'annulee'; o.note = (o.note ? o.note + ' · ' : '') + motif.trim();
      toast('Commande ' + o.id + ' annulée · stock libéré.');
      render(); return;
    }
    if (b.hasAttribute('data-reveal')) return toast('Numéro masqué en démo : ' + S.orders.find(x=>x.id===b.getAttribute('data-reveal')).phone);

    if (b.hasAttribute('data-dept')) { S.add.dept = b.getAttribute('data-dept'); S.add.cat = Object.keys(TREE[S.add.dept]||{})[0] || ''; S.add.leaf = null; render(); return; }
    if (b.hasAttribute('data-cat')) { S.add.cat = b.getAttribute('data-cat'); S.add.leaf = null; render(); return; }
    if (b.hasAttribute('data-leaf')) { S.add.leaf = b.getAttribute('data-leaf'); render(); return; }
    if (b.hasAttribute('data-pick-leaf')) {
      const parts = b.getAttribute('data-pick-leaf').split(' › ');
      S.add.dept = parts[0]; S.add.cat = parts[1]; S.add.leaf = parts[2]; render(); return;
    }
    if (b.hasAttribute('data-to-details')) {
      if (!S.add.leaf) { toast('Choisissez d’abord une feuille (pas un parent).', true); return; }
      S.addStep = 2; render(); return;
    }
    if (b.hasAttribute('data-back-leaf')) { S.addStep = 1; render(); return; }
    if (b.hasAttribute('data-save-draft')) {
      if (!S.add.leaf) return toast('Impossible d’enregistrer : aucune feuille choisie.', true);
      pushDraft(false);
      return;
    }
    if (b.hasAttribute('data-submit-add')) {
      if (!S.add.leaf) return toast('Feuille obligatoire.', true);
      if ((S.add.title||'').trim().length < 5) { $('#add-title') && $('#add-title').classList.add('invalid'); return toast('Le titre FR doit faire au moins 5 caractères.', true); }
      pushDraft(true); return;
    }
    if (b.hasAttribute('data-add-color')) {
      const name = window.prompt('Nom de la couleur ?', 'Noir');
      if (!name) return;
      S.add.colors.push({ name: name.trim(), hex: '#444444', photos: 0 });
      render(); return;
    }
    if (b.hasAttribute('data-add-size')) {
      const name = window.prompt('Taille ?', 'XXL');
      if (!name) return;
      if (!S.add.sizes.includes(name.trim())) S.add.sizes.push(name.trim());
      render(); return;
    }
    if (b.hasAttribute('data-photo')) {
      const i = +b.getAttribute('data-photo');
      S.add.colors[i].photos = Math.min(3, S.add.colors[i].photos + 1);
      render(); return;
    }
    if (b.hasAttribute('data-fphoto')) {
      const [id, i] = b.getAttribute('data-fphoto').split(':');
      const p = S.products.find((x)=>x.id===id);
      p.colors[+i].photos = Math.min(3, p.colors[+i].photos + 1);
      render(); return;
    }
    if (b.hasAttribute('data-ftab')) { S.ficheTab = b.getAttribute('data-ftab'); render(); return; }
    if (b.hasAttribute('data-send-ctrl')) {
      const p = S.products.find((x)=>x.id===b.getAttribute('data-send-ctrl'));
      p.status = 'en_controle';
      toast(p.title.slice(0, 42) + '… envoyé au contrôle CARVO.');
      render(); return;
    }
    if (b.hasAttribute('data-to-fiche')) { S.ficheId = b.getAttribute('data-to-fiche'); closeDrawer(); }
    if (b.hasAttribute('data-save-shop')) {
      S.set.shop = ($('#shop') && $('#shop').value.trim()) || S.set.shop;
      saveSet(); toast('Boutique enregistrée · ' + S.set.shop); render(); return;
    }
  }

  function pushDraft(submit) {
    grabAddFields();
    const a = S.add;
    const skus = [];
    a.colors.forEach((c) => a.sizes.forEach((sz) => {
      const raw = a.stocks[c.name+'|'+sz];
      skus.push({ c: c.name, s: sz, stock: raw === '' || raw == null ? null : Number(raw) });
    }));
    const p = {
      id: 'p' + Date.now(),
      title: a.title.trim() || ('Brouillon · ' + a.leaf),
      titleAr: a.titleAr,
      leaf: a.dept + ' › ' + a.cat + ' › ' + a.leaf,
      price: Number(a.price) || 0,
      status: submit ? 'en_controle' : 'brouillon',
      badges: submit ? [] : [],
      source: 'formulaire',
      color: a.colors[0].hex,
      colors: a.colors.map((c)=>({...c})),
      skus
    };
    S.products.unshift(p);
    S.add = blankAdd();
    S.addStep = 1;
    toast(submit ? 'Produit soumis à la validation CARVO.' : 'Brouillon enregistré dans Produits.');
    go('produits');
    S.pFilter = p.status;
  }

  function grabAddFields() {
    const title = $('#add-title'); if (title) S.add.title = title.value;
    const ar = $('#add-titleAr'); if (ar) S.add.titleAr = ar.value;
    const desc = $('#add-desc'); if (desc) S.add.desc = desc.value;
    const price = $('#add-price'); if (price) S.add.price = price.value;
    $$('[data-attr]').forEach((el) => { S.add.attrs[el.getAttribute('data-attr')] = el.value; });
    $$('[data-sku]').forEach((el) => { S.add.stocks[el.getAttribute('data-sku')] = el.value; });
  }

  function onInput(e) {
    const el = e.target;
    if (el.id === 'add-title' || el.id === 'add-titleAr' || el.id === 'add-desc' || el.id === 'add-price') grabAddFields();
    if (el.hasAttribute('data-sku')) S.add.stocks[el.getAttribute('data-sku')] = el.value;
    if (el.hasAttribute('data-attr')) S.add.attrs[el.getAttribute('data-attr')] = el.value;
    if (el.hasAttribute('data-dstock')) {
      const [id, i] = el.getAttribute('data-dstock').split(':');
      const p = S.products.find((x)=>x.id===id);
      p.skus[+i].stock = el.value === '' ? null : Number(el.value);
    }
    if (el.hasAttribute('data-fstock')) {
      const [id, i] = el.getAttribute('data-fstock').split(':');
      const p = S.products.find((x)=>x.id===id);
      p.skus[+i].stock = el.value === '' ? null : Number(el.value);
    }
    if (el.dataset && el.dataset.ft) {
      const p = S.products.find((x)=>x.id===S.ficheId);
      if (!p) return;
      const k = el.getAttribute('data-ft');
      p[k] = k === 'price' ? Number(el.value) : el.value;
    }
  }

  function onChange(e) {
    const el = e.target;
    if (el.hasAttribute('data-door')) {
      const shop = document.getElementById('shop');
      if (shop && shop.value.trim()) S.set.shop = shop.value.trim();
      S.set[el.getAttribute('data-door')] = el.checked;
      saveSet();
      toast((el.checked ? 'Activé' : 'Désactivé') + ' · ' + el.getAttribute('data-door') + ' (enregistré).');
      render();
    }
    if (el.hasAttribute('data-n')) {
      S.set[el.getAttribute('data-n')] = el.checked;
      saveSet();
    }
    if (el.id === 'fiche-pick') { S.ficheId = el.value; render(); }
    if (el.hasAttribute('data-attr')) S.add.attrs[el.getAttribute('data-attr')] = el.value;
  }

  function onSort(e) {
    const th = e.target.closest('[data-sort]');
    if (!th) return;
    const k = th.getAttribute('data-sort');
    if (S.pSort.k === k) S.pSort.d *= -1; else { S.pSort.k = k; S.pSort.d = 1; }
    render();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('click', onSort);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  window.addEventListener('hashchange', () => { $('#side').classList.remove('on'); $('#scrim').classList.remove('on'); render(); });

  if (!location.hash) location.hash = '#/dash';
  render();
})();
