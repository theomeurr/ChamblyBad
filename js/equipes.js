
(async function effectifsApp(){
  // === CONFIG ===
  const EFFECTIFS_URL = ''; // données locales — éditer data/effectifs.csv
  const EFFECTIFS_FALLBACK = 'data/effectifs.csv';

  // Ordre + métadonnées des équipes
  const TEAMS = [
    { key: 'top12', anchor: 'top12', name: 'BCC060-1 · Top 12',        sub: 'Championnat de France par équipes — Pro A',      level: 'Top 12',     badges: ['Samedi','National'] },
    { key: 'n2',    anchor: 'n2',    name: 'BCC060-1 · Nationale 2',    sub: 'Nationale 2 · Poule 4',                          level: 'Nationale 2', badges: ['Samedi','National'] },
    { key: 'r2',    anchor: 'r2',    name: 'BCC060-1 · Régionale 2',    sub: 'Interclubs Régionaux Hauts-de-France 25-26',     level: 'Régionale 2', badges: ['Dimanche','Régional'] },
    { key: 'icd',   anchor: 'icd',   name: 'BCC060-1 · ICD Masculin',   sub: 'Interclubs Comité 60 D1 Masculin',               level: 'D1 Comité',   badges: ['Masculin','Départemental'] },
    { key: 'd2',    anchor: 'd2',    name: 'BCC060-4 · Oise D2',        sub: 'Interclubs Oise D2',                             level: 'D2 Oise',     badges: ['Départemental'] },
    { key: 'd3',    anchor: 'd3',    name: 'BCC060-5 · Oise D3',        sub: 'Interclubs Oise D3',                             level: 'D3 Oise',     badges: ['Départemental'] },
  ];

  // === HELPERS ===
  function parseCSV(text){
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = []; let i=0, field='', row=[], inQ=false;
    while (i<text.length){
      const c=text[i];
      if (inQ){
        if (c==='"' && text[i+1]==='"'){ field+='"'; i+=2; continue; }
        if (c==='"'){ inQ=false; i++; continue; }
        field+=c; i++; continue;
      }
      if (c==='"'){ inQ=true; i++; continue; }
      if (c===','){ row.push(field); field=''; i++; continue; }
      if (c==='\n' || c==='\r'){
        if (field.length || row.length){ row.push(field); rows.push(row); }
        row=[]; field='';
        if (c==='\r' && text[i+1]==='\n') i+=2; else i++;
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
  async function fetchCSV(url, { timeout = 7000, retries = 2 } = {}){
    const busted = url + (url.includes('?')?'&':'?') + 't=' + Date.now();
    let lastErr;
    for (let attempt=0; attempt<=retries; attempt++){
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(busted, { cache: 'no-cache', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP '+res.status);
        return { text: await res.text(), lastModified: res.headers.get('last-modified') };
      } catch(e){
        clearTimeout(timer);
        lastErr = e;
        if (attempt<retries) await new Promise(r => setTimeout(r, 400*(attempt+1)));
      }
    }
    throw lastErr;
  }
  async function fetchWithFallback(url, localUrl){
    try { return await fetchCSV(url); }
    catch(e){
      console.warn('Effectifs Google Sheets inaccessible, fallback local:', e);
      const res = await fetch(localUrl + '?t=' + Date.now());
      if (!res.ok) throw new Error('Fallback HTTP '+res.status);
      return { text: await res.text(), lastModified: null, fromLocal: true };
    }
  }
  function isActive(v){ return /^(x|1|true|oui|yes)$/i.test(String(v||'').trim()); }
  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // Détecte la catégorie d'un classement pour choisir la pastille
  function rankCategory(r){
    const s = String(r||'').trim().toUpperCase();
    if (!s) return 'nc';
    const c = s[0];
    if (c === 'N') return 'n';
    if (c === 'R') return 'r';
    if (c === 'D') return 'd';
    if (c === 'P') return 'p';
    return 'nc';
  }
  function renderPill(r){
    const raw = String(r||'').trim();
    if (!raw) return `<span class="rank-pill nc">—</span>`;
    const cat = rankCategory(raw);
    return `<span class="rank-pill ${cat}">${escapeHtml(raw.toUpperCase())}</span>`;
  }

  // === CHARGEMENT ===
  const tabsEl = document.getElementById('eq-tabs');
  const dropdownEl   = document.getElementById('eq-dropdown');
  const dropdownMenu = document.getElementById('eq-dropdown-menu');
  const dropdownLabel= document.getElementById('eq-dropdown-label');
  const dropdownCount= document.getElementById('eq-dropdown-count');
  const poolsEl = document.getElementById('eq-pools');
  const updatedEl = document.getElementById('eq-updated');
  const totalEl = document.getElementById('eq-total');

  let payload;
  try {
    payload = EFFECTIFS_URL
      ? await fetchWithFallback(EFFECTIFS_URL, EFFECTIFS_FALLBACK)
      : await (async () => {
          const res = await fetch(EFFECTIFS_FALLBACK + '?t=' + Date.now());
          if (!res.ok) throw new Error('Fallback HTTP '+res.status);
          return { text: await res.text(), lastModified: null, fromLocal: true };
        })();
  } catch (err) {
    poolsEl.innerHTML = `<div class="eq-state">Impossible de charger les effectifs pour le moment. Réessayez plus tard.</div>`;
    console.error('Effectifs load error:', err);
    return;
  }

  const rows = parseCSV(payload.text).filter(r => isActive(r.actif));

  // Regroupe par équipe (on suit l'ordre TEAMS)
  const byTeam = new Map(TEAMS.map(t => [t.key, []]));
  for (const r of rows){
    const k = (r.equipe || '').toLowerCase();
    if (byTeam.has(k)) byTeam.get(k).push(r);
  }

  // Tri : capitaine en premier, puis par nom
  for (const [k, arr] of byTeam){
    arr.sort((a,b) => {
      const ac = isActive(a.capitaine) ? 0 : 1;
      const bc = isActive(b.capitaine) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return (a.nom||'').localeCompare(b.nom||'', 'fr');
    });
  }

  // Date + total
  const lastDate = payload.lastModified ? new Date(payload.lastModified) : new Date();
  updatedEl.textContent = lastDate.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
    + (payload.fromLocal ? ' (données locales)' : '');
  totalEl.textContent = rows.length;

  // === RENDU TABS + SELECT ===
  tabsEl.innerHTML = TEAMS.map(t => {
    const count = (byTeam.get(t.key) || []).length;
    return `<button type="button" class="eq-tab" data-team="${t.key}">
      ${escapeHtml(t.level)}
      <span class="count">${count}</span>
    </button>`;
  }).join('');

  // Dropdown custom
  dropdownMenu.innerHTML = TEAMS.map(t => {
    const count = (byTeam.get(t.key) || []).length;
    return `<div class="eq-dropdown-item" data-key="${t.key}" role="option">
      ${escapeHtml(t.level)}
      <span class="item-count">${count}</span>
    </div>`;
  }).join('');
  dropdownMenu.querySelectorAll('.eq-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      activate(item.dataset.key);
      closeDropdown();
    });
  });
  function openDropdown(){
    dropdownEl.classList.add('open');
    dropdownEl.setAttribute('aria-expanded','true');
  }
  function closeDropdown(){
    dropdownEl.classList.remove('open');
    dropdownEl.setAttribute('aria-expanded','false');
  }
  dropdownEl.addEventListener('click', () => dropdownEl.classList.contains('open') ? closeDropdown() : openDropdown());
  dropdownEl.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); dropdownEl.classList.contains('open')?closeDropdown():openDropdown(); }});
  document.addEventListener('click', e => { if(!dropdownEl.closest('.eq-select-wrap').contains(e.target)) closeDropdown(); });

  // === RENDU POOLS ===
  poolsEl.innerHTML = TEAMS.map(t => {
    const players = byTeam.get(t.key) || [];
    const body = players.length ? players.map(p => {
      const cap = isActive(p.capitaine);
      return `
        <tr class="${cap?'team-cap':''}">
          <td class="name">${cap?'<span class="star" title="Capitaine">⭐</span>':''}${escapeHtml((p.prenom||'') + ' ' + (p.nom||'').toUpperCase())}</td>
          <td>${renderPill(p.simple)}</td>
          <td>${renderPill(p.double)}</td>
          <td>${renderPill(p.mixte)}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="4" class="eq-state" style="padding:32px">Aucun joueur inscrit pour l'instant.</td></tr>`;

    return `
      <div class="eq-pool" data-team="${t.key}" id="team-${t.anchor}">
        <div class="eq-team-header">
          <div>
            <div class="eq-team-title">${escapeHtml(t.name)}</div>
            <div class="eq-team-sub">${escapeHtml(t.sub)}</div>
          </div>
          <div class="eq-team-badges">
            ${t.badges.map(b => `<span class="eq-team-badge">${escapeHtml(b)}</span>`).join('')}
          </div>
        </div>
        <div class="eq-table-wrap">
          <table class="eq-table">
            <thead>
              <tr>
                <th class="name-col">Joueur</th>
                <th>Simple</th>
                <th>Double</th>
                <th>Mixte</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  // === NAVIGATION TABS + DROPDOWN + ANCRE ===
  function activate(key, push = true){
    tabsEl.querySelectorAll('.eq-tab').forEach(b => b.classList.toggle('active', b.dataset.team === key));
    poolsEl.querySelectorAll('.eq-pool').forEach(p => p.classList.toggle('active', p.dataset.team === key));
    // Sync dropdown
    const t = TEAMS.find(t => t.key === key);
    const count = t ? (byTeam.get(key)||[]).length : 0;
    if(dropdownLabel) dropdownLabel.textContent = t ? t.level : '';
    if(dropdownCount) dropdownCount.textContent = count + ' joueur' + (count>1?'s':'');
    dropdownMenu.querySelectorAll('.eq-dropdown-item').forEach(i => i.classList.toggle('selected', i.dataset.key === key));
    if (push) history.replaceState(null, '', '#' + key);
  }
  tabsEl.querySelectorAll('.eq-tab').forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.team));
  });

  // Onglet par défaut : hash URL si valide, sinon la 1ère équipe
  const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
  const validKeys = TEAMS.map(t => t.anchor);
  const initial = validKeys.includes(hash) ? hash : TEAMS[0].key;
  activate(initial, false);

  // Écoute les changements de hash (navigation depuis index.html)
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (validKeys.includes(h)) activate(h, false);
  });

  // Burger mobile
  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');
  if (burger && navLinks){
    burger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      burger.setAttribute('aria-expanded', navLinks.classList.contains('open'));
    });
  }
})();
