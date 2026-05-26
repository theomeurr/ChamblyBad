/* =================================================================
   CLASSEMENT.JS — Hub "Classements & rencontres"
   -----------------------------------------------------------------
   Page : classement.html
   Affiche 6 onglets (Top 12 / N2 / R2 / ICD / D2 / D3).
   Chaque onglet = layout 2 colonnes : classement (gauche) + rencontres (droite).

   Sources :
   - data/classement.csv       (colonnes : equipe,pool,team,J,G,N,P,F,B+,P-,Pts,chambly)
   - data/classement-meta.csv  (colonnes : equipe,key,value — clés : label, subtitle, officialUrl)
   - data/rencontres.csv       (colonnes : equipe,date,date_affichage,journee,adversaire,
                                            domicile,tag,actif)

   Équipes sans données → placeholder "Données à venir" + lien officiel.
   Tab actif déterminé par window.location.hash (#top12, #n2, …) ou Top 12 par défaut.
================================================================== */

(async function loadCompetitionHub(){

  // Ordre des onglets + libellés courts (le label complet vient du meta CSV)
  const TEAMS = [
    { key: 'top12', short: 'Top 12',  sub: 'Nationale' },
    { key: 'n2',    short: 'N2',      sub: 'Nationale 2' },
    { key: 'r2',    short: 'R2',      sub: 'Régionale 2' },
    { key: 'icd',   short: 'ICD',     sub: 'Interclubs' },
    { key: 'd2',    short: 'Oise D2', sub: 'Départ.' },
    { key: 'd3',    short: 'Oise D3', sub: 'Départ.' },
  ];

  const META_DEFAULTS = {
    season: '2025-2026',
    labels: {
      top12: 'Top 12', n2: 'Nationale 2', r2: 'Régionale 2',
      icd: 'ICD Masculin', d2: 'Oise D2', d3: 'Oise D3',
    },
    officialUrl: 'https://www.ffbad.org/',
    subtitles: {
      top12: '2 poules de 6 équipes, 10 journées de championnat.',
      n2: 'Calendrier disponible. Classement à venir.',
      r2: 'Régionale 2 Île-de-France.',
      icd: 'Interclubs Départementaux.',
      d2: 'Oise Division 2.',
      d3: 'Oise Division 3.',
    },
  };

  const seasonEl = document.getElementById('rk-season');
  const updatedEl = document.getElementById('rk-updated');
  const tabsEl = document.getElementById('rk-team-tabs');
  const panelsEl = document.getElementById('rk-team-panels');

  /* ---------- Utils ---------- */
  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function toNumber(v){
    if (v === null || v === undefined) return 0;
    const cleaned = String(v).trim().replace(/\s/g,'').replace(',', '.').replace(/[^\d.\-+]/g,'');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
  function isFlag(v){ return /^(x|1|true|oui|yes)$/i.test(String(v ?? '').trim()); }

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

  async function fetchText(url){
    const busted = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    const res = await fetch(busted, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' on ' + url);
    return { text: await res.text(), lastModified: res.headers.get('last-modified') };
  }

  /* ---------- Chargement des 3 CSV en parallèle (tolérant) ---------- */
  let classementRes, metaRes, rencontresRes;
  try {
    [classementRes, metaRes, rencontresRes] = await Promise.all([
      fetchText('data/classement.csv').catch(e => { console.warn('classement.csv KO:', e); return null; }),
      fetchText('data/classement-meta.csv').catch(e => { console.warn('classement-meta.csv KO:', e); return null; }),
      fetchText('data/rencontres.csv').catch(e => { console.warn('rencontres.csv KO:', e); return null; }),
    ]);
  } catch (e) {
    panelsEl.innerHTML = `<div class="rk-state">Impossible de charger les données. <a href="https://www.ffbad.org/" target="_blank" rel="noopener">Site officiel FFBaD</a>.</div>`;
    return;
  }

  /* ---------- Parsing + structuration par équipe ---------- */
  const classementRows = classementRes ? parseCSV(classementRes.text) : [];
  const metaRows = metaRes ? parseCSV(metaRes.text) : [];
  const rencontresRows = rencontresRes ? parseCSV(rencontresRes.text) : [];

  // Meta par équipe (et globale)
  const meta = JSON.parse(JSON.stringify(META_DEFAULTS));
  for (const r of metaRows){
    const team = (r.equipe || '').trim().toLowerCase();
    const key = (r.key || '').trim();
    const value = (r.value || '').trim();
    if (!key) continue;
    if (!team) {
      // ligne globale (pas d'équipe = méta partagée, ex: season)
      meta[key] = value;
    } else {
      if (key === 'label') meta.labels[team] = value;
      else if (key === 'subtitle') meta.subtitles[team] = value;
      else if (key === 'officialUrl') {
        // stocké dans une map par équipe
        meta.officialUrls = meta.officialUrls || {};
        meta.officialUrls[team] = value;
      }
    }
  }

  // Classement groupé par équipe puis par poule
  // dataByTeam[teamKey] = { pools: Map<poolName, [standings]> }
  const dataByTeam = {};
  TEAMS.forEach(t => { dataByTeam[t.key] = { pools: new Map(), hasChambly: false }; });
  for (const r of classementRows){
    const team = (r.equipe || '').trim().toLowerCase();
    if (!dataByTeam[team]) continue; // ignore équipes inconnues
    const poolName = r.pool || 'Classement';
    if (!dataByTeam[team].pools.has(poolName)) dataByTeam[team].pools.set(poolName, []);
    const standing = {
      team: r.team,
      J: toNumber(r.J), G: toNumber(r.G), N: toNumber(r.N), P: toNumber(r.P),
      F: toNumber(r.F), Bplus: toNumber(r['B+']), Pminus: toNumber(r['P-']),
      Pts: toNumber(r.Pts),
      chambly: isFlag(r.chambly),
    };
    dataByTeam[team].pools.get(poolName).push(standing);
    if (standing.chambly) dataByTeam[team].hasChambly = true;
  }

  // Rencontres groupées par équipe
  const matchesByTeam = {};
  TEAMS.forEach(t => { matchesByTeam[t.key] = []; });
  function parseDate(s){
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2]-1, +m[3]);
    const m2 = String(s).match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/);
    if (m2) return new Date(+m2[3], +m2[2]-1, +m2[1]);
    return null;
  }
  for (const r of rencontresRows){
    const team = (r.equipe || '').trim().toLowerCase();
    if (!matchesByTeam[team]) continue;
    if (!isFlag(r.actif)) continue;
    const d = parseDate(r.date);
    matchesByTeam[team].push({
      date: d,
      dateLabel: r.date_affichage || (d ? d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : '—'),
      adversaire: r.adversaire || '—',
      domicile: isFlag(r.domicile),
      tag: r.tag || (isFlag(r.domicile) ? 'Domicile' : 'Extérieur'),
    });
  }
  // Tri chronologique (ASC) pour chaque équipe
  Object.values(matchesByTeam).forEach(arr => arr.sort((a,b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0)));

  /* ---------- Méta header ---------- */
  seasonEl.textContent = meta.season || '—';
  const lastDate = classementRes?.lastModified ? new Date(classementRes.lastModified) : new Date();
  updatedEl.textContent = lastDate.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  /* ---------- Rendu : tableau classement ---------- */
  function renderClassementTable(standings){
    if (!standings.length) return '';
    const rows = [...standings].sort((a,b) =>
      (b.Pts - a.Pts) || (b.G - a.G) || ((b.Bplus + b.Pminus) - (a.Bplus + a.Pminus))
    );
    const total = rows.length;
    return `
      <div class="rk-table-wrap">
        <table class="rk-table">
          <thead>
            <tr>
              <th>#</th>
              <th class="team-col">Équipe</th>
              <th title="Journées">J</th>
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

  /* ---------- Rendu : liste rencontres ---------- */
  function renderRencontresList(matches){
    if (!matches.length){
      return `<div class="rk-rencontres-empty">Aucune rencontre publiée pour cette équipe.</div>`;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const nextIdx = matches.findIndex(m => m.date && m.date >= today);
    return matches.map((m, i) => {
      const isPast = m.date && m.date < today;
      const isNext = i === nextIdx;
      const stateClass = [isPast ? 'is-past' : '', isNext ? 'is-next' : '', m.domicile ? 'is-home' : 'is-away']
        .filter(Boolean).join(' ');
      const opp = escapeHtml(m.adversaire);
      const line = m.domicile
        ? `Chambly <span class="rk-m-vs">vs</span> ${opp}`
        : `${opp} <span class="rk-m-vs">vs</span> Chambly`;
      return `
        <div class="rk-match ${stateClass}">
          <span class="rk-m-date">${escapeHtml(m.dateLabel)}</span>
          <span class="rk-m-opp">${line}</span>
          <span class="rk-m-tag">${escapeHtml(m.tag)}</span>
        </div>`;
    }).join('');
  }

  /* ---------- Rendu : panneau d'une équipe ---------- */
  function renderTeamPanel(teamKey){
    const data = dataByTeam[teamKey];
    const matches = matchesByTeam[teamKey] || [];
    const label = meta.labels[teamKey] || teamKey;
    const subtitle = meta.subtitles[teamKey] || '';
    const officialUrl = (meta.officialUrls && meta.officialUrls[teamKey]) || meta.officialUrl;

    const hasClassement = data.pools.size > 0;
    const hasRencontres = matches.length > 0;

    // Bandeau info équipe (sous-titre + lien officiel)
    const infoBlock = `
      <div class="rk-team-info">
        <p class="rk-team-subtitle">${subtitle}</p>
        <a class="rk-official" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener">
          Site officiel
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M8 7h9v9"/></svg>
        </a>
      </div>`;

    // Cas 1 : aucune donnée → placeholder
    if (!hasClassement && !hasRencontres){
      return `
        ${infoBlock}
        <div class="rk-no-data">
          <div class="rk-no-data-icon">📊</div>
          <h3>Données à venir</h3>
          <p>Le classement et le calendrier de l'équipe ${escapeHtml(label)} seront publiés bientôt. En attendant, consultez les informations officielles.</p>
          <a class="rk-official-btn" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener">
            Voir sur le site officiel
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>
          </a>
        </div>`;
    }

    // Construction colonne classement
    let classementCol = '';
    if (hasClassement){
      const pools = [...data.pools.entries()];
      const defaultPoolIdx = Math.max(0, pools.findIndex(([_, st]) => st.some(s => s.chambly)));
      const poolTabsHtml = pools.length > 1
        ? `<div class="rk-tabs" role="tablist" data-team="${teamKey}">
            ${pools.map(([name, standings], i) => {
              const isChambly = standings.some(s => s.chambly);
              return `<button type="button" class="rk-tab ${i === defaultPoolIdx ? 'active' : ''}" data-pool="${i}">
                ${escapeHtml(name)}
                ${isChambly ? '<span class="rk-tab-badge">BCCO</span>' : ''}
              </button>`;
            }).join('')}
          </div>`
        : '';
      const tablesHtml = pools.map(([_, standings], i) => `
        <div class="rk-pool ${i === defaultPoolIdx ? 'active' : ''}" data-pool="${i}">
          ${renderClassementTable(standings)}
        </div>`).join('');
      classementCol = `
        <section class="rk-col rk-col-classement">
          <h2 class="rk-col-title">Classement</h2>
          ${poolTabsHtml}
          ${tablesHtml}
          <div class="rk-legend" style="margin-top:14px">
            <span class="rk-legend-item"><span class="rk-legend-dot top"></span> Top 2</span>
            <span class="rk-legend-item"><span class="rk-legend-dot bot"></span> Relégation</span>
            <span class="rk-legend-item"><span class="rk-legend-dot cha"></span> BCCO</span>
          </div>
        </section>`;
    } else {
      classementCol = `
        <section class="rk-col rk-col-classement">
          <h2 class="rk-col-title">Classement</h2>
          <div class="rk-no-data" style="padding:28px 20px">
            <div class="rk-no-data-icon" style="width:46px;height:46px;font-size:20px">📊</div>
            <p style="margin-bottom:0">Classement à venir.</p>
          </div>
        </section>`;
    }

    // Construction colonne rencontres
    let rencontresCol;
    if (hasRencontres){
      rencontresCol = `
        <section class="rk-col rk-col-rencontres">
          <h2 class="rk-col-title">Calendrier (${matches.length})</h2>
          <div class="rk-rencontres-list">
            ${renderRencontresList(matches)}
          </div>
        </section>`;
    } else {
      rencontresCol = `
        <section class="rk-col rk-col-rencontres">
          <h2 class="rk-col-title">Calendrier</h2>
          <div class="rk-no-data" style="padding:28px 20px">
            <div class="rk-no-data-icon" style="width:46px;height:46px;font-size:20px">📅</div>
            <p style="margin-bottom:0">Calendrier à venir.</p>
          </div>
        </section>`;
    }

    return `${infoBlock}<div class="rk-grid">${classementCol}${rencontresCol}</div>`;
  }

  /* ---------- Rendu : tabs équipe ---------- */
  // Onglet par défaut : hash URL si valide, sinon Top 12
  const hashTeam = (location.hash.replace('#', '').toLowerCase());
  const defaultTeam = TEAMS.find(t => t.key === hashTeam) ? hashTeam : 'top12';

  tabsEl.innerHTML = TEAMS.map(t => {
    const isActive = t.key === defaultTeam;
    const isChambly = dataByTeam[t.key].hasChambly;
    return `<button type="button" role="tab" class="rk-team-tab ${isActive ? 'active' : ''} ${isChambly ? 'is-chambly-team' : ''}" data-team="${t.key}">
      <span>${escapeHtml(t.short)}</span>
      <span class="rk-team-tab-sub">${escapeHtml(t.sub)}</span>
    </button>`;
  }).join('');

  // Render tous les panels (cachés sauf l'actif)
  panelsEl.innerHTML = TEAMS.map(t => `
    <div class="rk-team-panel ${t.key === defaultTeam ? 'active' : ''}" data-team="${t.key}">
      ${renderTeamPanel(t.key)}
    </div>
  `).join('');

  /* ---------- Interactions ---------- */
  // Switch équipe
  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.rk-team-tab');
    if (!btn) return;
    const team = btn.dataset.team;
    tabsEl.querySelectorAll('.rk-team-tab').forEach(b => b.classList.toggle('active', b.dataset.team === team));
    panelsEl.querySelectorAll('.rk-team-panel').forEach(p => p.classList.toggle('active', p.dataset.team === team));
    history.replaceState(null, '', '#' + team);
  });

  // Switch poule (à l'intérieur d'un panel — délégué)
  panelsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.rk-tabs .rk-tab');
    if (!btn) return;
    const tabs = btn.parentElement;
    const panel = tabs.closest('.rk-team-panel');
    const idx = btn.dataset.pool;
    tabs.querySelectorAll('.rk-tab').forEach(b => b.classList.toggle('active', b.dataset.pool === idx));
    panel.querySelectorAll('.rk-col-classement .rk-pool').forEach(p => p.classList.toggle('active', p.dataset.pool === idx));
  });

  // Réagir aux changements de hash (navigation depuis menu / lien externe)
  window.addEventListener('hashchange', () => {
    const t = location.hash.replace('#', '').toLowerCase();
    if (!TEAMS.find(x => x.key === t)) return;
    tabsEl.querySelector(`.rk-team-tab[data-team="${t}"]`)?.click();
  });

})();
