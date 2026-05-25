/* ============================================================
   admin-top12.js — Gestion des photos & titres de l'effectif Top 12
   ------------------------------------------------------------
   Édite data/palmares.csv (filtré sur equipe=top12) :
   - Liste des 18 joueurs avec photo + titre actuels
   - Upload d'une nouvelle photo (recadrée 900x1200 portrait 3:4)
   - Modification du titre (headline) inline
   - Publication via commit GitHub API + cache-bust automatique
   ============================================================ */

(function () {
  'use strict';

  const CSV_PATH = 'data/palmares.csv';
  // Headers attendus dans palmares.csv (avec la nouvelle colonne photo)
  const HEADERS = ['equipe', 'nom', 'prenom', 'nationalite', 'palmares', 'headline', 'photo'];

  let state = {
    headers: HEADERS.slice(),
    rows: [],
    sha: null,
    pendingPhotos: {} // index → { blob, dataUrl, file, slug }
  };

  // ----------------------------------------------------------------
  // CSS (préfixe .at-)
  // ----------------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('admin-top12-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-top12-css';
    s.textContent = `
      .at-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
      .at-btn{padding:10px 16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;color:var(--text)}
      .at-btn:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(10,25,136,.08)}
      .at-btn.primary{background:linear-gradient(135deg,#A5EB78,#7ed957);border:none;color:#0A1988;font-weight:700}
      .at-btn:disabled{opacity:.55;cursor:wait}
      .at-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .at-status{font-size:12px;color:var(--muted);font-style:italic;margin-left:auto}

      .at-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
      .at-card{background:var(--surface);border:1px solid var(--line);border-radius:11px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s,box-shadow .2s}
      .at-card:hover{border-color:rgba(10,25,136,.25)}
      .at-card.modified{border-color:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.18)}

      .at-photo-wrap{position:relative;background:#f0f3fa;aspect-ratio:3/4;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center}
      .at-photo-wrap img{width:100%;height:100%;object-fit:cover;display:block}
      .at-photo-wrap .at-noimg{font-size:11px;color:var(--muted);font-style:italic;text-align:center;padding:10px}
      .at-photo-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,25,136,.85),rgba(10,25,136,.0) 55%);opacity:0;transition:opacity .2s;display:flex;align-items:flex-end;justify-content:center;padding:10px;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;pointer-events:none}
      .at-photo-wrap:hover .at-photo-overlay{opacity:1}
      .at-photo-overlay svg{width:13px;height:13px;margin-right:5px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .at-photo-wrap input[type=file]{display:none}
      .at-photo-wrap.dragover{outline:3px dashed #A5EB78;outline-offset:-4px}
      .at-pending-tag{position:absolute;top:6px;left:6px;background:#f59e0b;color:#fff;font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 6px;border-radius:5px;box-shadow:0 3px 8px rgba(245,158,11,.4)}

      .at-card-body{padding:9px 10px 10px;display:flex;flex-direction:column;gap:5px;flex:1}
      .at-card-name{font-family:'Anton',sans-serif;font-weight:400;font-size:13.5px;color:var(--text);line-height:1.15;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .at-card-flag{font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:rgba(10,25,136,.08);color:var(--secondary);letter-spacing:.03em}
      .at-card-label{font-size:9.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:1px}
      .at-headline-input{width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-size:12px;font-family:inherit;outline:none;background:#fff;color:var(--text);transition:border-color .15s,box-shadow .15s;resize:vertical;min-height:44px;line-height:1.35}
      .at-headline-input:focus{border-color:#0A1988;box-shadow:0 0 0 2px rgba(10,25,136,.08)}
      .at-headline-input.changed{border-color:#f59e0b;background:#fffbeb}
      .at-card-hint{font-size:9.5px;color:var(--muted);line-height:1.35;word-break:break-word}
      .at-card-hint code{font-size:9px}

      @media(max-width:540px){
        .at-grid{grid-template-columns:repeat(2,1fr);gap:8px}
        .at-card-body{padding:8px 9px 9px}
        .at-card-name{font-size:12.5px}
        .at-headline-input{font-size:11.5px;min-height:40px}
      }
      @media(min-width:1200px){
        .at-grid{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}
      }
    `;
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'joueur';
  }
  function photoPathFor(row) {
    // Slug basé sur le prénom (1er mot) — cohérent avec les fichiers existants media/top12/eva.webp, etc.
    const firstName = (row.prenom || '').split(' ')[0] || row.nom || 'joueur';
    return `media/top12/${slugify(firstName)}.webp`;
  }

  // ----------------------------------------------------------------
  // Replace UI
  // ----------------------------------------------------------------
  function replaceUI() {
    const slot = document.getElementById('top12Slot');
    if (!slot) return false;

    slot.innerHTML = `
      <div class="at-toolbar">
        <button type="button" class="at-btn primary" id="at-save-all" disabled>
          <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Publier les changements
        </button>
        <button type="button" class="at-btn" id="at-reload">
          <svg viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Recharger
        </button>
        <span class="at-status" id="at-status">Chargement…</span>
      </div>
      <div id="at-grid" class="at-grid"></div>
    `;

    document.getElementById('at-reload').addEventListener('click', reload);
    document.getElementById('at-save-all').addEventListener('click', saveAll);
    return true;
  }

  function setStatus(msg) {
    const el = document.getElementById('at-status');
    if (el) el.textContent = msg;
  }

  // ----------------------------------------------------------------
  // Chargement palmarès filtré sur Top 12
  // ----------------------------------------------------------------
  async function reload() {
    try {
      setStatus('Chargement depuis GitHub…');
      const f = await BccoGithub.readFile(CSV_PATH);
      const parsed = BccoGithub.parseCSV(f.content);
      // Force les headers attendus, même si la colonne photo n'existait pas
      const hs = parsed.headers.length ? parsed.headers.slice() : HEADERS.slice();
      if (!hs.includes('photo')) hs.push('photo');
      state.headers = hs;
      state.rows = parsed.rows.map(r => {
        const o = {};
        hs.forEach(h => o[h] = r[h] != null ? r[h] : '');
        return o;
      });
      state.sha = f.sha;
      state.pendingPhotos = {};
      // Backup pour détecter les changements
      state._initialHeadlines = state.rows.map(r => r.headline || '');
      renderGrid();
      const top12Count = state.rows.filter(r => (r.equipe || '').toLowerCase().trim() === 'top12').length;
      setStatus(`${top12Count} joueur${top12Count > 1 ? 's' : ''} Top 12 chargé${top12Count > 1 ? 's' : ''}`);
      updateSaveButton();
    } catch (e) {
      BccoGithub.toast('Erreur : ' + e.message, 'err');
      setStatus('');
    }
  }

  // ----------------------------------------------------------------
  // Rendu de la grille
  // ----------------------------------------------------------------
  function renderGrid() {
    const grid = document.getElementById('at-grid');
    if (!grid) return;

    const indexed = state.rows
      .map((r, i) => ({ r, i }))
      .filter(x => (x.r.equipe || '').toLowerCase().trim() === 'top12');

    if (!indexed.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px;background:var(--surface)">
        <p style="font-size:14px">Aucun joueur Top 12 dans <code>data/palmares.csv</code>.</p>
      </div>`;
      return;
    }

    grid.innerHTML = indexed.map(({ r, i }) => {
      const fullName = `${(r.prenom || '').trim()} ${(r.nom || '').trim()}`.trim();
      const photo = r.photo || photoPathFor(r);
      const pendingPhoto = state.pendingPhotos[i] ? state.pendingPhotos[i].dataUrl : null;
      const displaySrc = pendingPhoto || photo;
      const isModified = !!state.pendingPhotos[i] || (state._initialHeadlines && state._initialHeadlines[i] !== (r.headline || ''));

      return `
        <article class="at-card ${isModified ? 'modified' : ''}" data-idx="${i}">
          <label class="at-photo-wrap" data-photo-idx="${i}">
            <input type="file" accept="image/*" data-file-idx="${i}"/>
            ${pendingPhoto ? `<span class="at-pending-tag">À publier</span>` : ''}
            <img src="${escapeHtml(displaySrc)}" alt="${escapeHtml(fullName)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
            <div class="at-noimg" style="display:none">Photo introuvable<br><small style="opacity:.7">Cliquer pour ajouter</small></div>
            <div class="at-photo-overlay">
              <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              Changer la photo
            </div>
          </label>
          <div class="at-card-body">
            <div class="at-card-name" title="${escapeHtml(photoPathFor(r))}">${escapeHtml(fullName)}${r.nationalite ? ` <span class="at-card-flag">${escapeHtml(r.nationalite)}</span>` : ''}</div>
            <textarea class="at-headline-input" data-headline-idx="${i}" placeholder="Titre affiché sur la home…" rows="2">${escapeHtml(r.headline || '')}</textarea>
          </div>
        </article>
      `;
    }).join('');

    // Listeners
    grid.querySelectorAll('input[type=file]').forEach(input => {
      input.addEventListener('change', e => handleFile(parseInt(input.dataset.fileIdx, 10), e.target.files[0]));
    });
    grid.querySelectorAll('.at-headline-input').forEach(ta => {
      ta.addEventListener('input', () => {
        const i = parseInt(ta.dataset.headlineIdx, 10);
        state.rows[i].headline = ta.value;
        const initial = state._initialHeadlines && state._initialHeadlines[i];
        ta.classList.toggle('changed', ta.value !== initial);
        const card = ta.closest('.at-card');
        if (card) {
          const modified = !!state.pendingPhotos[i] || ta.value !== initial;
          card.classList.toggle('modified', modified);
        }
        updateSaveButton();
      });
    });

    // Drag & drop sur les photos
    grid.querySelectorAll('.at-photo-wrap').forEach(zone => {
      ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragover'); }));
      ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('dragover'); }));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleFile(parseInt(zone.dataset.photoIdx, 10), f);
      });
    });
  }

  // ----------------------------------------------------------------
  // Gestion upload photo (preview + recadrage 900x1200)
  // ----------------------------------------------------------------
  async function handleFile(idx, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      BccoGithub.toast('Fichier non reconnu comme image', 'err');
      return;
    }
    try {
      const blob = await BccoGithub.resizeImage(file, { targetWidth: 900, targetHeight: 1200, quality: 0.85 });
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('Lecture impossible'));
        fr.readAsDataURL(blob);
      });
      state.pendingPhotos[idx] = { file, blob, dataUrl };
      renderGrid();
      updateSaveButton();
    } catch (e) {
      BccoGithub.toast('Erreur : ' + e.message, 'err');
    }
  }

  function updateSaveButton() {
    const btn = document.getElementById('at-save-all');
    if (!btn) return;
    const hasPhotos = Object.keys(state.pendingPhotos).length > 0;
    const hasHeadlines = state._initialHeadlines && state.rows.some((r, i) => r.headline !== state._initialHeadlines[i]);
    btn.disabled = !(hasPhotos || hasHeadlines);
    const count = (hasPhotos ? Object.keys(state.pendingPhotos).length : 0) + (hasHeadlines ? state.rows.filter((r,i) => r.headline !== state._initialHeadlines[i]).length : 0);
    btn.innerHTML = (hasPhotos || hasHeadlines)
      ? `<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Publier (${count} modif${count>1?'s':''})`
      : `<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Publier les changements`;
  }

  // ----------------------------------------------------------------
  // Publication : upload photos pendantes + commit palmares.csv
  // ----------------------------------------------------------------
  async function saveAll() {
    const btn = document.getElementById('at-save-all');
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Publication…';

    try {
      const photoIdxs = Object.keys(state.pendingPhotos).map(n => parseInt(n, 10));
      let uploadedCount = 0;

      // 1. Upload de chaque photo pendante
      for (const idx of photoIdxs) {
        const pending = state.pendingPhotos[idx];
        const row = state.rows[idx];
        const targetPath = photoPathFor(row);
        const fileForUpload = new File([pending.blob], targetPath.split('/').pop(), { type: pending.blob.type });
        setStatus(`Upload photo ${row.prenom || ''} ${row.nom || ''} (${uploadedCount + 1}/${photoIdxs.length})…`);
        await BccoGithub.uploadImage(fileForUpload, targetPath, `Photo Top 12 : ${(row.prenom || '').trim()} ${(row.nom || '').trim()}`);
        // Cache-bust dans la colonne photo (pour que roster.js force le reload navigateur)
        row.photo = `${targetPath}?v=${Date.now().toString(36)}`;
        uploadedCount++;
      }

      // 2. Commit du CSV mis à jour
      setStatus('Mise à jour du fichier palmares.csv…');
      const csv = BccoGithub.serializeCSV(state.rows, state.headers);
      const headlineChanges = state.rows.filter((r, i) => r.headline !== state._initialHeadlines[i]).length;
      const msgParts = [];
      if (uploadedCount) msgParts.push(`${uploadedCount} photo${uploadedCount > 1 ? 's' : ''}`);
      if (headlineChanges) msgParts.push(`${headlineChanges} titre${headlineChanges > 1 ? 's' : ''}`);
      const msg = `Effectif Top 12 : ${msgParts.join(' + ')}`;
      const res = await BccoGithub.writeFile(CSV_PATH, csv, msg, state.sha);
      state.sha = res.content && res.content.sha;

      state.pendingPhotos = {};
      state._initialHeadlines = state.rows.map(r => r.headline || '');

      BccoGithub.toast('Effectif Top 12 publié !', 'ok');
      setStatus('Publié ! ' + new Date().toLocaleTimeString('fr-FR'));
      renderGrid();
      updateSaveButton();
    } catch (e) {
      BccoGithub.toast('Erreur : ' + e.message, 'err');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  // ----------------------------------------------------------------
  // Init
  // ----------------------------------------------------------------
  function init() {
    injectCSS();
    const ok = replaceUI();
    if (!ok) return false;
    reload();
    return true;
  }

  function waitForDashboard() {
    const dash = document.getElementById('dashboard');
    if (!dash) {
      setTimeout(waitForDashboard, 300);
      return;
    }
    if (dash.style.display !== 'none' && document.getElementById('top12Slot')) {
      init();
      return;
    }
    const obs = new MutationObserver(() => {
      if (dash.style.display !== 'none' && document.getElementById('top12Slot')) {
        obs.disconnect();
        init();
      }
    });
    obs.observe(dash, { attributes: true, attributeFilter: ['style'] });
    setTimeout(() => {
      if (document.getElementById('top12Slot') && dash.style.display !== 'none') {
        obs.disconnect();
        init();
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDashboard);
  } else {
    waitForDashboard();
  }

})();
