/* ============================================================
   next-match-banner.js — Bandeau sticky "Prochain match"
   ------------------------------------------------------------
   Lit data/rencontres.csv et affiche un bandeau juste sous la nav
   si un match Top 12 ou N2 a lieu dans les 7 prochains jours.
   - Fermable (mémorise la fermeture par date de match)
   - Clic = scroll vers la section Équipes
   - Auto-rafraîchit à chaque chargement de page
   ============================================================ */

(function () {
  'use strict';

  const CSV_URL = 'data/rencontres.csv';
  const WINDOW_DAYS = 7;          // affiche les matchs dans les 7 prochains jours
  const LS_DISMISSED_KEY = 'bcco_nmb_dismissed_v1'; // dates fermées

  // ---------------------------------------------------------------
  // CSV parser minimal
  // ---------------------------------------------------------------
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = []; let i = 0, field = '', row = [], inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"' && text[i+1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { inQ = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (field.length || row.length) { row.push(field); rows.push(row); }
        row = []; field = '';
        if (c === '\r' && text[i+1] === '\n') i += 2; else i++;
        continue;
      }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).filter(r => r.some(v => v && v.trim())).map(r => {
      const o = {};
      headers.forEach((h, idx) => o[h] = (r[idx] || '').trim());
      return o;
    });
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(LS_DISMISSED_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function setDismissed(arr) {
    try { localStorage.setItem(LS_DISMISSED_KEY, JSON.stringify(arr)); } catch (_) {}
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function teamLabel(equipe) {
    const e = (equipe || '').toLowerCase();
    if (e === 'top12') return 'Top 12';
    if (e === 'n2')    return 'Nationale 2';
    return equipe || '—';
  }

  // ---------------------------------------------------------------
  // CSS du bandeau (injecté pour éviter de devoir modifier styles.css)
  // ---------------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('nmb-css')) return;
    const s = document.createElement('style');
    s.id = 'nmb-css';
    s.textContent = `
      .nmb {
        position: sticky;
        top: calc(var(--nav-h, 0px) + var(--ann-h, 0px));
        z-index: 90;
        background: linear-gradient(90deg, #020260 0%, #0A1988 100%);
        color: #fff;
        font-size: 13.5px;
        line-height: 1.4;
        padding: 0;
        overflow: hidden;
        animation: nmbSlideIn .4s cubic-bezier(.16,1,.3,1);
      }
      @keyframes nmbSlideIn {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }
      .nmb-inner {
        max-width: var(--container, 1200px);
        margin: 0 auto;
        padding: 10px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .nmb-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #A5EB78;
        flex-shrink: 0;
        animation: nmbPulse 1.8s ease-in-out infinite;
        box-shadow: 0 0 12px rgba(165,235,120,.6);
      }
      @keyframes nmbPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: .55; transform: scale(.85); }
      }
      .nmb-content {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .nmb-tag {
        background: rgba(165,235,120,.18);
        color: #A5EB78;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: .08em;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 6px;
        white-space: nowrap;
      }
      .nmb-text {
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex: 1;
      }
      .nmb-text strong { color: #A5EB78; font-weight: 700; }
      .nmb-link {
        color: rgba(255,255,255,.85);
        text-decoration: none;
        border-bottom: 1px solid rgba(165,235,120,.4);
        padding-bottom: 1px;
        font-weight: 600;
        white-space: nowrap;
        font-size: 12.5px;
        flex-shrink: 0;
      }
      .nmb-link:hover { color: #A5EB78; border-color: #A5EB78; }
      .nmb-close {
        background: transparent;
        border: none;
        color: rgba(255,255,255,.55);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 4px 8px;
        flex-shrink: 0;
        border-radius: 6px;
        transition: background .15s, color .15s;
      }
      .nmb-close:hover { background: rgba(255,255,255,.1); color: #fff; }

      @media (max-width: 640px) {
        .nmb { font-size: 12.5px; }
        .nmb-inner { padding: 9px 14px; gap: 8px; }
        .nmb-content { gap: 6px; }
        .nmb-tag { font-size: 9.5px; padding: 2px 6px; }
        .nmb-link { font-size: 11.5px; }
        .nmb-text { font-size: 12.5px; }
      }
      @media (max-width: 460px) {
        .nmb-link { display: none; } /* on garde juste le texte principal sur très petit */
      }
    `;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------
  // Fetch + sélection du prochain match
  // ---------------------------------------------------------------
  async function pickNextMatch() {
    try {
      const r = await fetch(CSV_URL + '?_=' + Date.now(), { cache: 'no-cache' });
      if (!r.ok) return null;
      const rows = parseCSV(await r.text());
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const limit = new Date(today.getTime() + WINDOW_DAYS * 86400000);

      const upcoming = rows
        .filter(row => (row.actif || '').toLowerCase() === 'x' && row.date)
        .map(row => ({ ...row, _date: new Date(row.date) }))
        .filter(m => !isNaN(m._date) && m._date >= today && m._date <= limit)
        .sort((a, b) => a._date - b._date);

      return upcoming[0] || null;
    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  function render(match) {
    if (!match) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dStr  = match._date;
    const days  = daysBetween(today, dStr);
    let when;
    if (days === 0)      when = "aujourd'hui";
    else if (days === 1) when = 'demain';
    else                 when = `dans ${days} jours`;

    const domicile  = (match.domicile || '').toLowerCase() === 'x';
    const lieu      = domicile ? 'à domicile' : 'à l\'extérieur';
    const adversaire = match.adversaire || '—';
    const team      = teamLabel(match.equipe);
    const dateStr   = match.date_affichage || dStr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    const banner = document.createElement('div');
    banner.className = 'nmb';
    banner.setAttribute('data-match-date', match.date);
    banner.innerHTML = `
      <div class="nmb-inner">
        <span class="nmb-dot" aria-hidden="true"></span>
        <span class="nmb-tag">${escapeHtml(team)}</span>
        <span class="nmb-content">
          <span class="nmb-text">Prochain match <strong>${when}</strong> · ${escapeHtml(dateStr)} · BCCO vs <strong>${escapeHtml(adversaire)}</strong> ${escapeHtml(lieu)}</span>
          <a href="#equipes" class="nmb-link">Voir →</a>
        </span>
        <button type="button" class="nmb-close" aria-label="Fermer le bandeau">&times;</button>
      </div>
    `;

    // Position : juste après l'annonce si présente, sinon juste après la nav
    const nav = document.getElementById('nav');
    const ann = document.querySelector('.ann');
    const anchor = ann || nav;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(banner, anchor.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    // Fermeture
    banner.querySelector('.nmb-close').addEventListener('click', () => {
      const dismissed = getDismissed();
      if (!dismissed.includes(match.date)) {
        dismissed.push(match.date);
        // Garde uniquement les 20 plus récents (anti-bloat localStorage)
        setDismissed(dismissed.slice(-20));
      }
      banner.style.animation = 'nmbSlideIn .25s cubic-bezier(.16,1,.3,1) reverse';
      setTimeout(() => banner.remove(), 220);
    });
  }

  // ---------------------------------------------------------------
  // Hauteur de la nav (fallback si annonce-banner.js ne tourne pas)
  // ---------------------------------------------------------------
  function ensureNavHeightVar() {
    const root = document.documentElement;
    if (root.style.getPropertyValue('--nav-h')) return; // déjà défini ailleurs
    function update() {
      const nav = document.getElementById('nav');
      const h = nav ? nav.getBoundingClientRect().height : 0;
      root.style.setProperty('--nav-h', h + 'px');
    }
    update();
    window.addEventListener('resize', update, { passive: true });
    const nav = document.getElementById('nav');
    if (nav && 'ResizeObserver' in window) {
      new ResizeObserver(update).observe(nav);
    }
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  async function init() {
    injectCSS();
    ensureNavHeightVar();
    const match = await pickNextMatch();
    if (!match) return;
    // Vérifie que le user n'a pas déjà fermé ce match
    if (getDismissed().includes(match.date)) return;
    render(match);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
