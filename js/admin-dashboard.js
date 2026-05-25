/* ============================================================
   admin-dashboard.js — Mini-dashboard "santé du club" en haut de l'admin
   ------------------------------------------------------------
   Lit les CSV en local (sans token GitHub car lecture seule) et
   affiche :
   - Dernière actualité publiée (+ alerte si > 30 jours)
   - Prochain match Top 12 / N2
   - Total des licenciés
   - Alertes "données obsolètes"
   ============================================================ */

(function () {
  'use strict';

  function injectCSS() {
    if (document.getElementById('admin-dash-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-dash-css';
    s.textContent = `
      .ad-wrap{margin:0 0 28px;padding:22px;border-radius:18px;background:linear-gradient(135deg,#f6f8fd 0%,#eef3fb 100%);border:1px solid var(--line);color:var(--text);box-shadow:0 8px 24px rgba(10,25,136,.06)}
      .ad-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px}
      .ad-title{font-family:'Anton',sans-serif;font-weight:400;font-size:18px;letter-spacing:.04em;display:flex;align-items:center;gap:8px;color:var(--secondary)}
      .ad-title::before{content:'';display:inline-block;width:8px;height:8px;background:#16a34a;border-radius:50%;animation:adPulse 2s ease-in-out infinite}
      @keyframes adPulse{0%,100%{opacity:1}50%{opacity:.35}}
      .ad-sub{font-size:12px;color:var(--muted)}
      .ad-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
      .ad-tile{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:4px;transition:background .15s,border-color .15s}
      .ad-tile:hover{background:#fafbfd;border-color:rgba(10,25,136,.18)}
      .ad-tile-lbl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--secondary)}
      .ad-tile-val{font-family:'Anton',sans-serif;font-weight:400;font-size:22px;line-height:1.2;letter-spacing:.02em;color:var(--text)}
      .ad-tile-sub{font-size:11.5px;color:var(--muted);line-height:1.45}
      .ad-tile.warn{border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.06)}
      .ad-tile.warn .ad-tile-lbl{color:#b45309}
      .ad-tile.crit{border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.06)}
      .ad-tile.crit .ad-tile-lbl{color:#b91c1c}
      .ad-alerts{margin-top:14px;display:flex;flex-direction:column;gap:8px}
      .ad-alert{font-size:12.5px;display:flex;align-items:flex-start;gap:8px;padding:9px 12px;background:rgba(10,25,136,.04);border:1px solid var(--line);border-radius:9px;line-height:1.4;color:var(--text)}
      .ad-alert.warn{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.28);color:#7c2d12}
      .ad-alert.crit{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.28);color:#7f1d1d}
      .ad-alert::before{content:'⚠️';flex-shrink:0}
      .ad-alert.crit::before{content:'❗'}
      .ad-alert.info::before{content:'ℹ️'}
      .ad-alert a{color:var(--secondary);text-decoration:underline}
      .ad-loading{color:var(--muted);font-size:13px;font-style:italic;padding:14px 0}
      @media(max-width:640px){
        .ad-tile-val{font-size:18px}
        .ad-wrap{padding:18px}
      }
    `;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------
  // CSV parser minimal (réutilise BccoGithub si dispo, sinon fallback)
  // ---------------------------------------------------------------
  function parseCSV(text) {
    if (window.BccoGithub && BccoGithub.parseCSV) return BccoGithub.parseCSV(text);
    // Fallback minimal
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(l => {
      const cells = l.split(',');
      const o = {};
      headers.forEach((h, i) => o[h] = (cells[i] || '').trim());
      return o;
    });
    return { headers, rows };
  }

  async function fetchCSV(path, timeoutMs = 5000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(path + '?_=' + Date.now(), { cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) return null;
      return parseCSV(await r.text());
    } catch (_) {
      clearTimeout(timer);
      return null;
    }
  }

  // ---------------------------------------------------------------
  // Logique métier
  // ---------------------------------------------------------------
  function daysBetween(date1, date2) {
    return Math.floor((date2 - date1) / 86400000);
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function computeStats() {
    const today = new Date();
    const stats = {
      lastActu: null, lastActuDaysAgo: null, activeActuCount: 0,
      nextMatch: null, nextMatchDaysAway: null,
      licenciesCount: 0, top12Count: 0, n2Count: 0,
      alerts: []
    };

    // Actualités
    const actus = await fetchCSV('data/actualites.csv');
    if (actus && actus.rows.length) {
      const active = actus.rows.filter(r => (r.actif || '').toLowerCase() === 'x');
      stats.activeActuCount = active.length;
      // Plus récente par date
      const sorted = active.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (sorted.length) {
        const latest = sorted[0];
        stats.lastActu = latest;
        const d = new Date(latest.date);
        if (!isNaN(d)) stats.lastActuDaysAgo = daysBetween(d, today);
      }
      if (stats.lastActuDaysAgo > 30) {
        stats.alerts.push({ level: 'warn', msg: `Aucune actualité publiée depuis ${stats.lastActuDaysAgo} jours. Pense à mettre à jour la section Actualités.` });
      }
      if (active.length === 0) {
        stats.alerts.push({ level: 'crit', msg: 'Aucune actualité active sur le site. La home affiche probablement un état vide.' });
      }
    } else {
      stats.alerts.push({ level: 'crit', msg: `Impossible de lire <code>data/actualites.csv</code>.` });
    }

    // Rencontres
    const rencontres = await fetchCSV('data/rencontres.csv');
    if (rencontres && rencontres.rows.length) {
      const active = rencontres.rows.filter(r => (r.actif || '').toLowerCase() === 'x');
      // Prochain match à venir (date >= aujourd'hui)
      const todayIso = today.toISOString().slice(0, 10);
      const upcoming = active.filter(r => r.date && r.date >= todayIso)
                             .sort((a, b) => a.date.localeCompare(b.date));
      if (upcoming.length) {
        stats.nextMatch = upcoming[0];
        const d = new Date(stats.nextMatch.date);
        if (!isNaN(d)) stats.nextMatchDaysAway = daysBetween(today, d);
      } else if (active.length) {
        // Pas de match futur, prendre le plus récent passé
        const past = active.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        stats.nextMatch = past[0];
        stats.nextMatch._past = true;
        const d = new Date(stats.nextMatch.date);
        if (!isNaN(d)) stats.nextMatchDaysAway = -daysBetween(d, today);
        stats.alerts.push({ level: 'warn', msg: 'Aucun match à venir dans <code>data/rencontres.csv</code>. La saison est-elle finie ?' });
      }
    }

    // Effectifs
    const effectifs = await fetchCSV('data/effectifs.csv');
    if (effectifs && effectifs.rows.length) {
      const active = effectifs.rows.filter(r => (r.actif || '').toLowerCase() === 'x');
      stats.licenciesCount = active.length;
      stats.top12Count = active.filter(r => (r.equipe || '').toLowerCase().includes('top12')).length;
      stats.n2Count    = active.filter(r => /n2|nationale/i.test(r.equipe || '')).length;
    }

    return stats;
  }

  // ---------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------
  function tileClassByAge(days, warnDays = 30, critDays = 60) {
    if (days == null) return '';
    if (days > critDays) return 'crit';
    if (days > warnDays) return 'warn';
    return '';
  }

  function render(stats) {
    const wrap = document.getElementById('ad-wrap');
    if (!wrap) return;

    // Tuile dernière actu
    const actuTileClass = tileClassByAge(stats.lastActuDaysAgo, 30, 60);
    const actuVal = stats.lastActu
      ? `<div class="ad-tile-val" title="${stats.lastActu.titre || ''}">${escape(truncate(stats.lastActu.titre || '—', 40))}</div>
         <div class="ad-tile-sub">${stats.lastActuDaysAgo != null ? `il y a ${stats.lastActuDaysAgo} jour${stats.lastActuDaysAgo > 1 ? 's' : ''}` : '—'} · ${fmtDate(stats.lastActu.date)}</div>`
      : `<div class="ad-tile-val">—</div><div class="ad-tile-sub">Aucune actualité</div>`;

    // Tuile prochain match
    let matchVal;
    if (stats.nextMatch) {
      const m = stats.nextMatch;
      const past = m._past;
      const team = (m.equipe || '').toLowerCase().includes('top12') ? 'Top 12' : 'Nationale 2';
      const where = (m.domicile || '').toLowerCase() === 'x' ? 'Domicile' : 'Extérieur';
      matchVal = `
        <div class="ad-tile-val">${team} vs ${escape(m.adversaire || '—')}</div>
        <div class="ad-tile-sub">${past
          ? `dernier match · il y a ${Math.abs(stats.nextMatchDaysAway)} j`
          : `dans ${stats.nextMatchDaysAway} j · ${where}`} · ${fmtDate(m.date)}</div>`;
    } else {
      matchVal = `<div class="ad-tile-val">—</div><div class="ad-tile-sub">Aucun match programmé</div>`;
    }

    // Tuile licenciés
    const licVal = stats.licenciesCount
      ? `<div class="ad-tile-val">${stats.licenciesCount}</div>
         <div class="ad-tile-sub">${stats.top12Count} Top 12 · ${stats.n2Count} Nationale 2</div>`
      : `<div class="ad-tile-val">—</div><div class="ad-tile-sub">Effectifs non chargés</div>`;

    // Tuile actus actives
    const activeActuVal = `
      <div class="ad-tile-val">${stats.activeActuCount}</div>
      <div class="ad-tile-sub">visible${stats.activeActuCount > 1 ? 's' : ''} sur la home</div>`;

    wrap.innerHTML = `
      <div class="ad-head">
        <div>
          <div class="ad-title">Santé du club</div>
          <div class="ad-sub">Aperçu rapide de l'activité du site · ${new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
      <div class="ad-grid">
        <div class="ad-tile ${actuTileClass}">
          <span class="ad-tile-lbl">Dernière actualité</span>
          ${actuVal}
        </div>
        <div class="ad-tile">
          <span class="ad-tile-lbl">Actus en ligne</span>
          ${activeActuVal}
        </div>
        <div class="ad-tile">
          <span class="ad-tile-lbl">Prochain match</span>
          ${matchVal}
        </div>
        <div class="ad-tile">
          <span class="ad-tile-lbl">Licenciés actifs</span>
          ${licVal}
        </div>
      </div>
      ${stats.alerts.length ? `
        <div class="ad-alerts">
          ${stats.alerts.map(a => `<div class="ad-alert ${a.level}">${a.msg}</div>`).join('')}
        </div>` : ''}
    `;
  }

  function escape(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  // ---------------------------------------------------------------
  // Injection dans le DOM (avant les sections existantes)
  // ---------------------------------------------------------------
  function mount() {
    const dash = document.getElementById('dashboard');
    if (!dash) return false;
    if (document.getElementById('ad-wrap')) return true; // déjà monté

    injectCSS();

    const wrap = document.createElement('section');
    wrap.id = 'ad-wrap';
    wrap.className = 'ad-wrap';
    wrap.innerHTML = `<div class="ad-loading">Chargement de la santé du club…</div>`;
    dash.insertBefore(wrap, dash.firstChild);

    computeStats().then(render).catch(err => {
      wrap.innerHTML = `<div class="ad-loading">Impossible de calculer les stats : ${escape(err.message)}</div>`;
    });

    return true;
  }

  // Stratégie multi-niveau pour garantir le mounting :
  // 1. Immédiat si le dashboard est déjà visible
  // 2. MutationObserver sur les attributs (rapide quand login)
  // 3. Polling de secours toutes les 500ms (fallback si MO rate)
  // 4. Listener sur le login (event bcco-admin-ready, voir admin.js)
  function tryMount() {
    const dash = document.getElementById('dashboard');
    if (!dash) return false;
    if (dash.style.display === 'none') return false;
    if (document.getElementById('ad-wrap')) return true; // déjà fait
    return mount();
  }

  function setupAllStrategies() {
    // 1. Tentative immédiate
    if (tryMount()) return;

    // 2. MutationObserver
    const dash = document.getElementById('dashboard');
    let observer = null;
    if (dash) {
      observer = new MutationObserver(() => {
        if (tryMount()) {
          observer.disconnect();
          clearInterval(pollId);
        }
      });
      observer.observe(dash, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    // 3. Polling de secours (toutes les 500 ms pendant 60 s max)
    const pollId = setInterval(() => {
      if (tryMount()) {
        if (observer) observer.disconnect();
        clearInterval(pollId);
      }
    }, 500);
    setTimeout(() => clearInterval(pollId), 60000);

    // 4. Storage event (cross-tab login ou changement de session)
    window.addEventListener('storage', () => {
      if (sessionStorage.getItem('bcco_admin') === '1') {
        setTimeout(tryMount, 100);
      }
    });
  }

  function waitForDashboard() {
    const dash = document.getElementById('dashboard');
    if (!dash) { setTimeout(waitForDashboard, 200); return; }
    setupAllStrategies();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDashboard);
  } else {
    waitForDashboard();
  }

})();
