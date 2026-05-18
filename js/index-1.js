
/* =================================================================
   ACTUALITÉS — Chargement depuis Google Sheets
   -----------------------------------------------------------------
   Colonnes attendues (onglet "actualites") :
     date,date_affichage,titre,resume,image,tag,tag_label,lien,actif
   - date           : YYYY-MM-DD (tri chronologique, à venir d'abord)
   - date_affichage : texte libre ("Samedi 28 mars · 16h00", "Mai 2026"…)
   - titre          : titre de la carte
   - resume         : texte descriptif
   - image          : URL (Imgur / wp-content / Cloudinary / Drive publique…)
   - tag            : match | tournoi | event  (détermine la couleur)
   - tag_label      : libellé du tag ("Match Top 12", "Tournoi"…)
   - lien           : URL optionnelle (bouton "En savoir plus")
   - actif          : "x" pour publier / vide = brouillon (pas affiché)
   Laisser ACTUS_URL vide → utilisera data/actualites.csv en local.
================================================================== */
const ACTUS_URL = ''; // données locales — éditer data/actualites.csv
const ACTUS_FALLBACK = 'data/actualites.csv';

(async function loadActus(){
  const grid = document.getElementById('actus-grid');
  const voirPlus = document.getElementById('actus-voir-plus');

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function parseCSV(text){
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = []; let i=0, field='', row=[], inQ=false;
    while (i < text.length){
      const c = text[i];
      if (inQ){
        if (c === '"' && text[i+1] === '"'){ field+='"'; i+=2; continue; }
        if (c === '"'){ inQ=false; i++; continue; }
        field+=c; i++; continue;
      }
      if (c === '"'){ inQ=true; i++; continue; }
      if (c === ','){ row.push(field); field=''; i++; continue; }
      if (c === '\n' || c === '\r'){
        if (field.length || row.length){ row.push(field); rows.push(row); }
        row=[]; field='';
        if (c === '\r' && text[i+1] === '\n') i+=2; else i++;
        continue;
      }
      field+=c; i++;
    }
    if (field.length || row.length){ row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).filter(r => r.some(v => v && v.trim())).map(r => {
      const o = {}; headers.forEach((h, idx) => o[h] = (r[idx] || '').trim()); return o;
    });
  }
  // Fetch avec timeout + retries (Google Sheets est parfois lent à répondre)
  async function fetchCSV(url, { timeout = 7000, retries = 2 } = {}){
    const busted = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++){
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(busted, { cache: 'no-cache', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      } catch(e) {
        clearTimeout(timer);
        lastErr = e;
        if (attempt < retries) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastErr;
  }
  const ACTUS_CACHE_KEY = 'bcco_actus_cache_v1';
  async function loadData(){
    const urls = [];
    if (ACTUS_URL) urls.push(ACTUS_URL);
    if (ACTUS_FALLBACK) urls.push(ACTUS_FALLBACK);
    for (const url of urls){
      try {
        const text = await fetchCSV(url);
        const rows = parseCSV(text);
        if (rows.length) {
          if (url === ACTUS_URL) {
            try { sessionStorage.setItem(ACTUS_CACHE_KEY, text); } catch(_) {}
          }
          return rows;
        }
      }
      catch (e){ console.warn('Actus source inaccessible :', url, e); }
    }
    // Dernier recours : cache sessionStorage
    try {
      const cached = sessionStorage.getItem(ACTUS_CACHE_KEY);
      if (cached) { console.info('Actus : utilisation du cache session.'); return parseCSV(cached); }
    } catch(_) {}
    return [];
  }

  const CAL_ICON  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  let _actusItems = [];

  window.openActuModal = function(idx) {
    const it = _actusItems[idx];
    if (!it) return;
    const overlay = document.getElementById('actu-modal-overlay');
    const imgDiv  = document.getElementById('actu-modal-img');
    const imgEl   = document.getElementById('actu-modal-imgEl');
    if (it.image) { imgEl.src = it.image; imgDiv.style.display = ''; }
    else imgDiv.style.display = 'none';
    const tagEl = document.getElementById('actu-modal-tag');
    tagEl.className = 'actu-tag ' + it.tag;
    tagEl.textContent = it.tag_label;
    const dateEl = document.getElementById('actu-modal-date');
    if (it.date_affichage) { dateEl.innerHTML = CAL_ICON + escapeHtml(it.date_affichage); dateEl.style.display = ''; }
    else dateEl.style.display = 'none';
    document.getElementById('actu-modal-title').textContent = it.titre;
    document.getElementById('actu-modal-desc').textContent  = it.resume;
    const linkDiv = document.getElementById('actu-modal-link');
    if (it.lien) { document.getElementById('actu-modal-linkEl').href = it.lien; linkDiv.style.display = ''; }
    else linkDiv.style.display = 'none';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.closeActuModal = function(e, el) {
    if (e && el && e.target !== el) return;
    document.getElementById('actu-modal-overlay').style.display = 'none';
    document.body.style.overflow = '';
  };

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') window.closeActuModal();
  });

  function isActive(v){ return /^(x|1|true|oui|yes)$/i.test(String(v || '').trim()); }
  function allowedTag(t){
    const v = String(t || '').toLowerCase().trim();
    return ['match','tournoi','event','blue','orange'].includes(v) ? v : 'event';
  }
  function parseSortDate(s){
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2]-1, +m[3]);
    const m2 = String(s).match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/);
    if (m2) return new Date(+m2[3], +m2[2]-1, +m2[1]);
    const d = new Date(s); return isNaN(d) ? null : d;
  }

  try {
    const raw = await loadData();
    const today = new Date(); today.setHours(0,0,0,0);
    const items = raw
      .filter(r => {
        if ('actif' in r && r.actif !== undefined && r.actif !== '') return isActive(r.actif);
        return true;
      })
      .map(r => ({
        date: parseSortDate(r.date),
        titre: r.titre || '',
        resume: r.resume || r['résumé'] || '',
        date_affichage: r.date_affichage || r['date affichage'] || '',
        image: r.image || '',
        tag: allowedTag(r.tag),
        tag_label: r.tag_label || r.tag || '',
        lien: r.lien || r.link || r.url || ''
      }))
      // Tri : à venir d'abord (plus proches en premier), passées après (plus récentes d'abord)
      .sort((a, b) => {
        const da = a.date, db = b.date;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        const aFuture = da >= today, bFuture = db >= today;
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;
        if (aFuture && bFuture) return da - db;
        return db - da;
      });

    if (!items.length){
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:14px;padding:40px 0">Aucune actualité pour le moment. Reviens bientôt !</p>`;
      voirPlus.style.display = 'none';
      return;
    }

    _actusItems = items;
    grid.innerHTML = items.map((it, idx) => {
      const extra = idx >= 2 ? 'actu-extra' : '';
      const imgHtml = it.image
        ? `<div class="actu-img"><img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.titre)}" loading="lazy"/></div>`
        : '';
      const tagHtml = it.tag_label
        ? `<span class="actu-tag ${it.tag}">${escapeHtml(it.tag_label)}</span>`
        : '';
      const dateHtml = it.date_affichage
        ? `<div class="actu-date">${CAL_ICON}${escapeHtml(it.date_affichage)}</div>`
        : '';
      return `
        <div class="actu-card ${extra}" data-tag="${it.tag}" onclick="openActuModal(${idx})" style="cursor:pointer">
          ${imgHtml}
          <div class="actu-body">
            ${tagHtml}
            ${dateHtml}
            <h3>${escapeHtml(it.titre)}</h3>
            <p>${escapeHtml(it.resume)}</p>
          </div>
        </div>`;
    }).join('');

    voirPlus.style.display = (items.length > 2 && window.innerWidth <= 640) ? '' : 'none';

    // Filtre par catégorie — visible seulement si plusieurs tags distincts
    const filterDiv = document.getElementById('actus-filters');
    const uniqueTags = [...new Set(items.map(it => it.tag))];
    if (uniqueTags.length > 1) {
      filterDiv.style.display = '';
      filterDiv.querySelectorAll('.actu-filter').forEach(btn => {
        btn.addEventListener('click', () => {
          filterDiv.querySelectorAll('.actu-filter').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const f = btn.dataset.filter;
          grid.querySelectorAll('.actu-card').forEach(card => {
            if (f === 'all') {
              card.style.display = ''; // restitue le contrôle au CSS
            } else {
              card.style.display = card.dataset.tag === f ? 'flex' : 'none';
            }
          });
          voirPlus.style.display = f === 'all' && items.length > 2 && window.innerWidth <= 640 ? '' : 'none';
        });
      });
    }
  } catch (err) {
    console.error('Erreur chargement actus :', err);
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:14px;padding:40px 0">Impossible de charger les actualités. Rendez-vous sur <a href="https://www.facebook.com/ChamblyBad" target="_blank" rel="noopener" style="color:var(--secondary);font-weight:600">Facebook</a>.</p>`;
    voirPlus.style.display = 'none';
  }
})();
