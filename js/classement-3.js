
/* =================================================================
   CONFIGURATION — Sources de données Google Sheets
   -----------------------------------------------------------------
   Tout est piloté depuis Google Sheets (ou Excel).
   Aucune modification HTML n'est nécessaire pour changer de saison.

   [1] DATA_URL = URL publiée du 1er onglet (classement)
       Colonnes attendues :
       pool,team,J,G,N,P,F,B+,P-,Pts,chambly

   [2] META_URL = URL publiée du 2e onglet (méta)
       Colonnes attendues :
       key,value
       Avec les clés : season, officialUrl, subtitle
================================================================== */
const DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT3-ayE8HElh223upJFcBehISgF1EQHh4A9rY3bVH8T27yscS-rfQCS4yjDoe3LyZJLfMfo0e130Yz/pub?output=csv';
const META_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQT3-ayE8HElh223upJFcBehISgF1EQHh4A9rY3bVH8T27yscS-rfQCS4yjDoe3LyZJLfMfo0e130Yz/pub?gid=491953478&single=true&output=csv';

/* Valeurs par défaut (utilisées si META_URL vide ou si onglet méta inaccessible) */
const META_DEFAULTS = {
  season: '2025-2026',
  officialUrl: 'https://www.ffbad.org/pratiquer-competitions-top-12',
  subtitle: '2 poules de 6 équipes, 10 journées de championnat. Le BCCO évolue en <strong style="color:#A5EB78">Poule 2</strong>. Données mises à jour manuellement après chaque journée depuis le site officiel FFBaD.'
};

(async function loadStandings(){
  const tabsEl = document.getElementById('rk-tabs');
  const poolsEl = document.getElementById('rk-pools');
  const seasonEl = document.getElementById('rk-season');
  const updatedEl = document.getElementById('rk-updated');
  const officialEl = document.getElementById('rk-official');
  const subtitleEl = document.getElementById('rk-subtitle');

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  /* Parseur CSV minimal : gère les virgules entre quotes et le BOM UTF-8 */
  function parseCSV(text){
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let i = 0, field = '', row = [], inQuotes = false;
    while (i < text.length){
      const c = text[i];
      if (inQuotes){
        if (c === '"' && text[i+1] === '"'){ field += '"'; i += 2; continue; }
        if (c === '"'){ inQuotes = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"'){ inQuotes = true; i++; continue; }
      if (c === ','){ row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r'){
        if (field.length || row.length){ row.push(field); rows.push(row); }
        row = []; field = '';
        if (c === '\r' && text[i+1] === '\n') i += 2; else i++;
        continue;
      }
      field += c; i++;
    }
    if (field.length || row.length){ row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1)
      .filter(r => r.some(v => v && v.trim()))
      .map(r => {
        const o = {};
        headers.forEach((h, idx) => o[h] = (r[idx] || '').trim());
        return o;
      });
  }

  function toNumber(v){
    if (v === null || v === undefined) return 0;
    // Nettoie : enlève les caractères non-numériques sauf signe et virgule/point décimal
    const cleaned = String(v).trim().replace(/\s/g,'').replace(',', '.').replace(/[^\d.\-+]/g,'');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
  function isChamblyFlag(v){ return /^(x|1|true|oui|yes)$/i.test(String(v).trim()); }

  function renderTable(standings){
    // Tri officiel FFBaD : Points desc → Victoires desc → (B+ − P-) desc
    const rows = [...standings].sort((a,b) =>
      (b.Pts - a.Pts) ||
      (b.G - a.G) ||
      ((b.Bplus + b.Pminus) - (a.Bplus + a.Pminus))
    );
    const total = rows.length;

    return `
      <div class="rk-table-wrap">
        <table class="rk-table">
          <thead>
            <tr>
              <th>#</th>
              <th class="team-col">Équipe</th>
              <th title="Journées jouées">J</th>
              <th title="Gagnées">G</th>
              <th class="col-draws" title="Nulles">N</th>
              <th title="Perdues">P</th>
              <th class="col-forfeit" title="Forfaits">F</th>
              <th class="col-bonus" title="Bonus">B+</th>
              <th class="col-bonus" title="Pénalités">P-</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r,i) => {
              const pos = i + 1;
              const zoneClass = pos <= 2 ? 'zone-top' : (pos === total ? 'zone-bot' : '');
              const chamblyClass = r.chambly ? 'is-chambly' : '';
              const bplusClass = r.Bplus > 0 ? 'pos-diff' : 'zero-diff';
              const pminusClass = r.Pminus < 0 ? 'neg-diff' : 'zero-diff';
              return `
                <tr class="${zoneClass} ${chamblyClass}">
                  <td class="pos"><span class="pos-badge">${pos}</span></td>
                  <td class="team">${escapeHtml(r.team)}</td>
                  <td>${r.J}</td>
                  <td>${r.G}</td>
                  <td class="col-draws">${r.N}</td>
                  <td>${r.P}</td>
                  <td class="col-forfeit">${r.F}</td>
                  <td class="col-bonus ${bplusClass}">${r.Bplus}</td>
                  <td class="col-bonus ${pminusClass}">${r.Pminus}</td>
                  <td class="pts">${r.Pts}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // Fetch CSV avec timeout + retries (Google Sheets est parfois lent à régénérer son cache)
  async function fetchCSV(url, { timeout = 8000, retries = 2 } = {}){
    const busted = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++){
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(busted, { cache: 'no-cache', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return { text: await res.text(), lastModified: res.headers.get('last-modified') };
      } catch(e) {
        clearTimeout(timer);
        lastErr = e;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }
    throw lastErr || new Error('fetchCSV failed');
  }

  // Cache sessionStorage du dernier fetch réussi (last-known-good)
  const CACHE_KEY = 'bcco_classement_cache_v1';
  function saveCache(payload){
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, ts: Date.now() })); } catch(_) {}
  }
  function readCache(){
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(_) { return null; }
  }

  async function fetchCSVWithFallback(url, localUrl){
    try {
      return await fetchCSV(url);
    } catch(e) {
      console.warn('Google Sheets inaccessible, fallback local:', e);
      const cached = readCache();
      if (cached && cached.text) {
        console.info('Utilisation du cache session (classement).');
        return { text: cached.text, lastModified: cached.lastModified, fromCache: true };
      }
      const res = await fetch(localUrl + '?t=' + Date.now());
      if (!res.ok) throw new Error('Fallback HTTP ' + res.status);
      return { text: await res.text(), lastModified: null, fromLocal: true };
    }
  }

  // Charge la méta depuis Google Sheets (si configuré), sinon valeurs par défaut
  async function loadMeta(){
    const meta = { ...META_DEFAULTS };
    if (!META_URL) return meta;
    try {
      const { text } = await fetchCSV(META_URL);
      const rows = parseCSV(text);
      for (const r of rows){
        const key = (r.key || '').trim();
        const value = (r.value || '').trim();
        if (key && value) meta[key] = value;
      }
    } catch (e){
      console.warn('Méta Google Sheets inaccessible — valeurs par défaut utilisées.', e);
    }
    return meta;
  }

  try {
    const [meta, dataRes] = await Promise.all([
      loadMeta(),
      fetchCSVWithFallback(DATA_URL, 'data/top12.csv')
    ]);

    // Applique la méta (saison, sous-titre, URL officielle)
    seasonEl.textContent = meta.season || '—';
    subtitleEl.innerHTML = meta.subtitle || '';
    officialEl.href = meta.officialUrl || 'https://www.ffbad.org/';

    // Date de mise à jour depuis l'en-tête HTTP du classement
    const lastDate = dataRes.lastModified ? new Date(dataRes.lastModified) : new Date();
    updatedEl.textContent = lastDate.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    if (dataRes.fromLocal) {
      updatedEl.textContent += ' (données locales)';
    } else if (dataRes.fromCache) {
      updatedEl.textContent += ' (cache)';
    }

    // Sauvegarde le dernier résultat réussi (pour utilisation hors-ligne / Google Sheets lent)
    if (!dataRes.fromCache && !dataRes.fromLocal) {
      saveCache({ text: dataRes.text, lastModified: dataRes.lastModified });
    }

    const rows = parseCSV(dataRes.text);

    // Regroupement par poule (ordre d'apparition préservé)
    const poolMap = new Map();
    for (const r of rows){
      const poolName = r.pool || 'Classement';
      if (!poolMap.has(poolName)) poolMap.set(poolName, []);
      poolMap.get(poolName).push({
        team: r.team,
        J: toNumber(r.J),
        G: toNumber(r.G),
        N: toNumber(r.N),
        P: toNumber(r.P),
        F: toNumber(r.F),
        Bplus: toNumber(r['B+']),
        Pminus: toNumber(r['P-']),
        Pts: toNumber(r.Pts),
        chambly: isChamblyFlag(r.chambly)
      });
    }
    const pools = [...poolMap.entries()].map(([name, standings]) => ({ name, standings }));

    // Poule par défaut : celle qui contient Chambly
    const defaultIdx = Math.max(0, pools.findIndex(p => p.standings.some(s => s.chambly)));

    tabsEl.innerHTML = pools.map((p,i) => {
      const isChambly = p.standings.some(s => s.chambly);
      return `<button type="button" class="rk-tab ${i === defaultIdx ? 'active' : ''}" data-pool="${i}">
        ${escapeHtml(p.name)}
        ${isChambly ? '<span class="rk-tab-badge">BCCO</span>' : ''}
      </button>`;
    }).join('');

    poolsEl.innerHTML = pools.map((p,i) => `
      <div class="rk-pool ${i === defaultIdx ? 'active' : ''}" data-pool="${i}">
        ${renderTable(p.standings)}
      </div>
    `).join('');

    tabsEl.querySelectorAll('.rk-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.pool;
        tabsEl.querySelectorAll('.rk-tab').forEach(b => b.classList.toggle('active', b.dataset.pool === idx));
        poolsEl.querySelectorAll('.rk-pool').forEach(p => p.classList.toggle('active', p.dataset.pool === idx));
      });
    });
  } catch (err) {
    poolsEl.innerHTML = `<div class="rk-state">
      Impossible de charger le classement pour le moment.<br>
      <button type="button" id="rk-retry" style="margin-top:12px;padding:10px 18px;border-radius:10px;border:1px solid var(--secondary);background:var(--secondary);color:#fff;font-weight:600;cursor:pointer">Réessayer</button>
      <div style="margin-top:12px;font-size:13px">Ou consultez le <a href="${META_DEFAULTS.officialUrl}" target="_blank" rel="noopener">site officiel FFBaD</a>.</div>
    </div>`;
    const btn = document.getElementById('rk-retry');
    if (btn) btn.addEventListener('click', () => location.reload());
    console.error('Classement load error:', err);
  }
})();
