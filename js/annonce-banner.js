/* ============================================================
   annonce-banner.js — Bandeau d'annonce administrable
   ------------------------------------------------------------
   Affiche un bandeau sous la nav (au-dessus du bandeau "prochain
   match" si présent) à partir de data/annonce.json.
   - Édité depuis l'admin (section "Annonce du site")
   - 4 types de couleurs : info / success / warning / alert
   - Lien optionnel + bouton fermer (mémoire localStorage par hash)
   - Disparition auto après date_fin
   ============================================================ */

(function () {
  'use strict';

  const JSON_URL = 'data/annonce.json';
  const LS_DISMISSED_KEY = 'bcco_ann_dismissed_v1';

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(LS_DISMISSED_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function setDismissed(arr) {
    try { localStorage.setItem(LS_DISMISSED_KEY, JSON.stringify(arr.slice(-10))); } catch (_) {}
  }
  // Empreinte courte du contenu (pour mémoriser la fermeture d'UNE version précise)
  function fingerprint(a) {
    const s = (a.type || '') + '|' + (a.tag || '') + '|' + (a.texte || '') + '|' + (a.lien_url || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return 'a' + (h >>> 0).toString(36);
  }

  // ---------------------------------------------------------------
  // CSS injecté
  // ---------------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('ann-css')) return;
    const s = document.createElement('style');
    s.id = 'ann-css';
    s.textContent = `
      /* Les bandeaux se positionnent juste sous la nav (qui est sticky top:0 z-index:100).
         --nav-h est calculé en JS (voir updateNavHeight). --ann-h est la hauteur de l'annonce.
         Le bandeau next-match (.nmb) lit lui-même ces variables (voir next-match-banner.js). */

      .ann {
        position: sticky;
        top: var(--nav-h, 0px);
        z-index: 99; /* sous la nav (z-index 100) */
        color: #fff;
        font-size: 13.5px;
        line-height: 1.4;
        padding: 0;
        overflow: hidden;
        animation: annSlideIn .4s cubic-bezier(.16,1,.3,1);
      }
      @keyframes annSlideIn {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }
      .ann.t-info    { background: linear-gradient(90deg, #1d3fc7 0%, #0A1988 100%); }
      .ann.t-success { background: linear-gradient(90deg, #16a34a 0%, #15803d 100%); }
      .ann.t-warning { background: linear-gradient(90deg, #d97706 0%, #b45309 100%); }
      .ann.t-alert   { background: linear-gradient(90deg, #dc2626 0%, #991b1b 100%); }

      .ann-inner {
        max-width: var(--container, 1200px);
        margin: 0 auto;
        padding: 10px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .ann-icon {
        width: 20px; height: 20px;
        flex-shrink: 0;
        stroke: rgba(255,255,255,.95);
        fill: none;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .ann-content {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .ann-tag {
        background: rgba(255,255,255,.18);
        color: #fff;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: .08em;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 6px;
        white-space: nowrap;
      }
      .ann-text {
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex: 1;
        font-weight: 500;
      }
      .ann-link {
        color: #fff;
        text-decoration: none;
        border-bottom: 1px solid rgba(255,255,255,.5);
        padding-bottom: 1px;
        font-weight: 700;
        white-space: nowrap;
        font-size: 12.5px;
        flex-shrink: 0;
      }
      .ann-link:hover { border-color: #fff; opacity: .9; }
      .ann-close {
        background: transparent;
        border: none;
        color: rgba(255,255,255,.7);
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        padding: 4px 8px;
        flex-shrink: 0;
        border-radius: 6px;
        transition: background .15s, color .15s;
      }
      .ann-close:hover { background: rgba(255,255,255,.15); color: #fff; }

      @media (max-width: 640px) {
        .ann { font-size: 12.5px; }
        .ann-inner { padding: 9px 14px; gap: 8px; }
        .ann-content { gap: 8px; }
        .ann-tag { font-size: 9.5px; padding: 2px 6px; }
        .ann-link { font-size: 11.5px; }
        .ann-text { font-size: 12.5px; white-space: normal; }
      }
      @media (max-width: 460px) {
        .ann-icon { display: none; }
      }
    `;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------
  // Icônes par type
  // ---------------------------------------------------------------
  function iconFor(type) {
    switch (type) {
      case 'success':
        return '<svg class="ann-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      case 'warning':
        return '<svg class="ann-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      case 'alert':
        return '<svg class="ann-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      default: // info
        return '<svg class="ann-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
  }

  // ---------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------
  async function fetchAnnonce() {
    try {
      const r = await fetch(JSON_URL + '?_=' + Date.now(), { cache: 'no-cache' });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------------------------
  // Validité (actif + pas expirée)
  // ---------------------------------------------------------------
  function isValid(a) {
    if (!a || !a.actif) return false;
    if (!a.texte || !a.texte.trim()) return false;
    if (a.date_fin) {
      const fin = new Date(a.date_fin);
      if (!isNaN(fin)) {
        fin.setHours(23, 59, 59, 999);
        if (Date.now() > fin.getTime()) return false;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  function render(a) {
    const type = ['info', 'success', 'warning', 'alert'].includes(a.type) ? a.type : 'info';
    const fingerprint_ = fingerprint(a);
    const fermable = a.fermable !== false; // par défaut fermable

    const banner = document.createElement('div');
    banner.className = 'ann t-' + type;
    banner.setAttribute('data-ann-fp', fingerprint_);
    banner.innerHTML = `
      <div class="ann-inner">
        ${iconFor(type)}
        ${a.tag ? `<span class="ann-tag">${escapeHtml(a.tag)}</span>` : ''}
        <span class="ann-content">
          <span class="ann-text">${escapeHtml(a.texte)}</span>
          ${a.lien_url && a.lien_texte ? `<a href="${escapeHtml(a.lien_url)}" class="ann-link" target="${/^https?:/.test(a.lien_url) ? '_blank' : '_self'}" rel="noopener">${escapeHtml(a.lien_texte)} →</a>` : ''}
        </span>
        ${fermable ? '<button type="button" class="ann-close" aria-label="Fermer l\'annonce">&times;</button>' : ''}
      </div>
    `;

    // Insertion : avant le bandeau next-match s'il est déjà là, sinon juste après la nav
    const nav = document.getElementById('nav');
    const nmb = document.querySelector('.nmb');
    if (nmb && nmb.parentNode) {
      nmb.parentNode.insertBefore(banner, nmb);
    } else if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(banner, nav.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    // Met à jour --ann-h pour pousser le bandeau "prochain match" si présent
    function updateHeight() {
      const h = banner.offsetHeight;
      document.documentElement.style.setProperty('--ann-h', h + 'px');
    }
    updateHeight();
    window.addEventListener('resize', updateHeight, { passive: true });
    if ('ResizeObserver' in window) {
      new ResizeObserver(updateHeight).observe(banner);
    }

    // Fermeture
    const closeBtn = banner.querySelector('.ann-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const dismissed = getDismissed();
        if (!dismissed.includes(fingerprint_)) {
          dismissed.push(fingerprint_);
          setDismissed(dismissed);
        }
        banner.style.animation = 'annSlideIn .25s cubic-bezier(.16,1,.3,1) reverse';
        setTimeout(() => {
          banner.remove();
          document.documentElement.style.setProperty('--ann-h', '0px');
        }, 220);
      });
    }
  }

  // ---------------------------------------------------------------
  // Hauteur de la nav (pour que les bandeaux sticky se placent juste en dessous)
  // S'exécute toujours, même sans annonce, pour que .nmb (next-match-banner) en profite aussi.
  // ---------------------------------------------------------------
  function updateNavHeight() {
    const nav = document.getElementById('nav');
    const h = nav ? nav.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--nav-h', h + 'px');
  }
  function watchNavHeight() {
    updateNavHeight();
    window.addEventListener('resize', updateNavHeight, { passive: true });
    window.addEventListener('load', updateNavHeight, { once: true });
    const nav = document.getElementById('nav');
    if (nav && 'ResizeObserver' in window) {
      new ResizeObserver(updateNavHeight).observe(nav);
    }
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  async function init() {
    injectCSS();
    watchNavHeight();
    const a = await fetchAnnonce();
    if (!isValid(a)) return;
    if (getDismissed().includes(fingerprint(a))) return;
    render(a);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
