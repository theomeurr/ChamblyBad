/* ============================================================
   galerie-load.js — Chargement dynamique de la galerie photos
   ------------------------------------------------------------
   Lit data/galerie.csv et injecte les items dans #gallery.
   Tri par "ordre" croissant, filtre sur "actif=x".
   Tailles possibles : "" (normal), "wide", "tall", "wide-tall".
   ============================================================ */

(function () {
  'use strict';

  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = []; let i = 0, field = '', row = [], inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { inQ = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (field.length || row.length) { row.push(field); rows.push(row); }
        row = []; field = '';
        if (c === '\r' && text[i + 1] === '\n') i += 2; else i++;
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

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function classesFor(taille) {
    const t = (taille || '').toLowerCase().trim();
    if (t === 'wide') return 'wide';
    if (t === 'tall') return 'tall';
    if (t === 'wide-tall' || t === 'large') return 'wide tall';
    return '';
  }

  async function load() {
    const grid = document.getElementById('gallery');
    if (!grid) return;
    try {
      const r = await fetch('data/galerie.csv?_=' + Date.now(), { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const rows = parseCSV(await r.text());
      const items = rows
        .filter(x => (x.actif || '').toLowerCase() === 'x' && x.image)
        .sort((a, b) => {
          const oa = parseInt(a.ordre || '999999', 10);
          const ob = parseInt(b.ordre || '999999', 10);
          return oa - ob;
        });
      if (!items.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999">Pas encore de photos publiées.</div>';
        grid.setAttribute('aria-busy', 'false');
        return;
      }
      grid.innerHTML = items.map(it => {
        const cls = classesFor(it.taille);
        return `<div class="gitem ${cls}" data-src="${escapeHtml(it.image)}">
          <img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.alt || '')}" loading="lazy"/>
        </div>`;
      }).join('');
      grid.setAttribute('aria-busy', 'false');
    } catch (e) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999">Impossible de charger la galerie (${escapeHtml(e.message)}).</div>`;
      grid.setAttribute('aria-busy', 'false');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
