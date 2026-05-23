/* ============================================================
   admin-image-converter.js — Convertisseur JPEG/PNG → WebP
   ------------------------------------------------------------
   Section dans l'admin pour optimiser des images avant upload :
   - Drag & drop multiple
   - Décode via canvas et re-encode en WebP
   - Slider qualité (0.5 → 0.95)
   - Option resize max-width (par défaut 1600px)
   - Affiche les gains de poids (avant/après)
   - 2 actions : "Télécharger" (zip si plusieurs) ou "Uploader sur GitHub"
   ============================================================ */

(function () {
  'use strict';

  const MEDIA_DIR_DEFAULT = 'media/';
  let pending = []; // [{file, blob, dataUrl, name, savings}]

  function injectCSS() {
    if (document.getElementById('admin-imgconv-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-imgconv-css';
    s.textContent = `
      .ic-section { margin-top: 32px; }
      .ic-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 22px; box-shadow: 0 10px 30px rgba(10,25,136,.06); }
      .ic-config { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
      .ic-field { display: flex; flex-direction: column; gap: 6px; }
      .ic-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
      .ic-field input[type=range] { width: 100%; accent-color: #0A1988; }
      .ic-field-row { display: flex; align-items: center; gap: 10px; }
      .ic-quality-val { font-family: 'Anton', sans-serif; font-size: 18px; color: #0A1988; min-width: 50px; text-align: right; }
      .ic-field input[type=number] { padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; font-family: inherit; outline: none; max-width: 100px; }
      .ic-field-toggle { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: #f7f7fa; border-radius: 8px; cursor: pointer; }
      .ic-field-toggle input { accent-color: #16a34a; width: 16px; height: 16px; }
      .ic-field-toggle span { font-size: 13px; }

      .ic-drop { border: 2px dashed rgba(10,25,136,.18); border-radius: 14px; padding: 28px 22px; text-align: center; background: #fafbff; transition: all .15s; cursor: pointer; position: relative; display: block; overflow: hidden; }
      .ic-drop:hover, .ic-drop.drag { border-color: #0A1988; background: rgba(10,25,136,.04); }
      .ic-drop input[type=file] { position: absolute !important; left: -9999px !important; width: 1px !important; height: 1px !important; opacity: 0 !important; pointer-events: none !important; }
      .ic-drop-icon { font-size: 32px; margin-bottom: 6px; line-height: 1; }
      .ic-drop-text { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
      .ic-drop-sub { font-size: 12px; color: var(--muted); }

      .ic-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
      .ic-item { display: flex; align-items: center; gap: 14px; padding: 12px; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
      .ic-item img { width: 64px; height: 48px; object-fit: cover; border-radius: 8px; flex-shrink: 0; background: #f0f3fa; }
      .ic-item-info { flex: 1; min-width: 0; }
      .ic-item-name { font-weight: 600; font-size: 13.5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ic-item-meta { font-size: 12px; color: var(--muted); margin-top: 2px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .ic-item-savings { color: #15803d; font-weight: 700; }
      .ic-item-savings.warn { color: #b45309; }
      .ic-item-remove { background: transparent; border: 1px solid var(--line); color: #ef4444; padding: 5px 9px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; }
      .ic-item-remove:hover { background: rgba(239,68,68,.06); }

      .ic-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
      .ic-btn { padding: 11px 16px; border-radius: 10px; border: 1px solid var(--line); background: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; color: var(--text); display: inline-flex; align-items: center; gap: 6px; transition: all .15s; }
      .ic-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(10,25,136,.08); }
      .ic-btn:disabled { opacity: .5; cursor: not-allowed; }
      .ic-btn.primary { background: linear-gradient(135deg, #A5EB78, #7ed957); color: #0A1988; border: none; }
      .ic-btn.secondary { background: linear-gradient(135deg, #0A1988, #020260); color: #fff; border: none; }
      .ic-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

      .ic-empty { padding: 14px; text-align: center; color: var(--muted); font-size: 12px; font-style: italic; }

      .ic-summary { background: linear-gradient(135deg, rgba(165,235,120,.12), rgba(10,25,136,.06)); border-radius: 10px; padding: 12px 16px; margin-top: 12px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
      .ic-summary strong { color: #15803d; font-size: 15px; }

      @media (max-width: 640px) {
        .ic-config { grid-template-columns: 1fr; }
        .ic-item img { width: 50px; height: 38px; }
        .ic-actions { flex-direction: column; }
        .ic-actions .ic-btn { width: 100%; justify-content: center; }
      }
    `;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------
  // Conversion (canvas)
  // ---------------------------------------------------------------
  function resizeAndConvert(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width: w, height: h } = img;
          if (maxDim && Math.max(w, h) > maxDim) {
            const ratio = maxDim / Math.max(w, h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          c.toBlob(blob => {
            if (!blob) return reject(new Error('Échec conversion WebP'));
            resolve({ blob, w, h });
          }, 'image/webp', quality);
        };
        img.onerror = () => reject(new Error('Image illisible'));
        img.src = e.target.result;
      };
      fr.onerror = () => reject(new Error('Lecture fichier échouée'));
      fr.readAsDataURL(file);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    });
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' ko';
    return (bytes / 1024 / 1024).toFixed(2) + ' Mo';
  }

  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ---------------------------------------------------------------
  // UI mounting
  // ---------------------------------------------------------------
  function mount() {
    const dash = document.getElementById('dashboard');
    if (!dash || document.getElementById('ic-section')) return false;

    injectCSS();

    const section = document.createElement('section');
    section.id = 'ic-section';
    section.className = 'ic-section';
    section.innerHTML = `
      <h3 class="section-title">🖼️ Convertisseur JPEG/PNG → WebP</h3>
      <p class="section-sub">
        Réduis le poids des images avant de les uploader (gain typique : <strong>-60 à -70%</strong> sans perte visible).
        Tout se passe dans ton navigateur, aucune image ne quitte ton PC.
      </p>

      <div class="ic-card">
        <div class="ic-config">
          <div class="ic-field">
            <label for="ic-quality">Qualité WebP</label>
            <div class="ic-field-row">
              <input type="range" id="ic-quality" min="50" max="95" step="5" value="85" />
              <span class="ic-quality-val" id="ic-quality-val">85%</span>
            </div>
          </div>
          <div class="ic-field">
            <label>Largeur max (px)</label>
            <div class="ic-field-row">
              <input type="number" id="ic-maxdim" value="1600" min="200" max="4000" step="100" />
              <label class="ic-field-toggle" style="flex:1;margin:0">
                <input type="checkbox" id="ic-resize" checked />
                <span>Redimensionner</span>
              </label>
            </div>
          </div>
        </div>

        <label class="ic-drop" id="ic-drop">
          <input type="file" id="ic-files" accept="image/jpeg,image/jpg,image/png,image/webp" multiple />
          <div class="ic-drop-icon">🖼️</div>
          <div class="ic-drop-text">Glisser des images JPEG/PNG ici ou cliquer pour parcourir</div>
          <div class="ic-drop-sub">Plusieurs fichiers à la fois · conversion 100% locale</div>
        </label>

        <div class="ic-list" id="ic-list">
          <div class="ic-empty">Aucune image pour l'instant.</div>
        </div>

        <div id="ic-summary"></div>

        <div class="ic-actions">
          <button type="button" class="ic-btn" id="ic-clear" disabled>Tout vider</button>
          <button type="button" class="ic-btn primary" id="ic-download" disabled>
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Télécharger (.webp)
          </button>
          <button type="button" class="ic-btn secondary" id="ic-upload" disabled>
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Uploader sur GitHub
          </button>
        </div>
      </div>
    `;

    // Insertion : avant le bouton diagnostic
    const diagBtn = document.getElementById('dg-btn-wrap');
    if (diagBtn) dash.insertBefore(section, diagBtn);
    else dash.appendChild(section);

    // ----- Listeners -----
    const qSlider = document.getElementById('ic-quality');
    const qVal    = document.getElementById('ic-quality-val');
    qSlider.addEventListener('input', () => { qVal.textContent = qSlider.value + '%'; });

    const drop      = document.getElementById('ic-drop');
    const fileInput = document.getElementById('ic-files');
    fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) handleFiles(files);
    });

    document.getElementById('ic-clear').addEventListener('click', () => { pending = []; renderList(); });
    document.getElementById('ic-download').addEventListener('click', downloadAll);
    document.getElementById('ic-upload').addEventListener('click', uploadAll);

    return true;
  }

  // ---------------------------------------------------------------
  // Handle files (multi)
  // ---------------------------------------------------------------
  async function handleFiles(files) {
    const imgs = files.filter(f => f.type && f.type.startsWith('image/'));
    if (!imgs.length) {
      if (window.BccoGithub) BccoGithub.toast('Aucune image valide', 'err');
      return;
    }

    const quality = parseInt(document.getElementById('ic-quality').value, 10) / 100;
    const maxDim  = document.getElementById('ic-resize').checked
      ? parseInt(document.getElementById('ic-maxdim').value, 10) || 1600
      : 0;

    if (window.BccoGithub) BccoGithub.toast(`Conversion de ${imgs.length} image${imgs.length > 1 ? 's' : ''}…`, 'info');

    for (const file of imgs) {
      try {
        const { blob, w, h } = await resizeAndConvert(file, maxDim, quality);
        const dataUrl = await blobToDataUrl(blob);
        const savings = ((1 - blob.size / file.size) * 100);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        pending.push({
          file,
          blob,
          dataUrl,
          name: baseName + '.webp',
          origSize: file.size,
          newSize: blob.size,
          w, h,
          savings
        });
      } catch (e) {
        if (window.BccoGithub) BccoGithub.toast(`Erreur ${file.name} : ${e.message}`, 'err');
      }
    }
    renderList();
  }

  // ---------------------------------------------------------------
  // Render list
  // ---------------------------------------------------------------
  function renderList() {
    const list = document.getElementById('ic-list');
    const summary = document.getElementById('ic-summary');
    const downloadBtn = document.getElementById('ic-download');
    const uploadBtn   = document.getElementById('ic-upload');
    const clearBtn    = document.getElementById('ic-clear');

    if (!pending.length) {
      list.innerHTML = `<div class="ic-empty">Aucune image pour l'instant.</div>`;
      summary.innerHTML = '';
      downloadBtn.disabled = true;
      uploadBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }

    list.innerHTML = pending.map((p, i) => {
      const cls = p.savings >= 30 ? '' : 'warn';
      const sign = p.savings >= 0 ? '−' : '+';
      return `
        <div class="ic-item">
          <img src="${p.dataUrl}" alt="" />
          <div class="ic-item-info">
            <div class="ic-item-name">${escape(p.name)}</div>
            <div class="ic-item-meta">
              <span>${fmtSize(p.origSize)} → <strong>${fmtSize(p.newSize)}</strong></span>
              <span class="ic-item-savings ${cls}">${sign}${Math.abs(p.savings).toFixed(0)}%</span>
              <span>${p.w}×${p.h}px</span>
            </div>
          </div>
          <button type="button" class="ic-item-remove" data-rm="${i}">Retirer</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.rm, 10);
        pending.splice(idx, 1);
        renderList();
      });
    });

    const totalOrig = pending.reduce((s, p) => s + p.origSize, 0);
    const totalNew  = pending.reduce((s, p) => s + p.newSize, 0);
    const totalSavings = ((1 - totalNew / totalOrig) * 100);
    summary.innerHTML = `
      <div class="ic-summary">
        <span>📦 <strong>${pending.length}</strong> image${pending.length > 1 ? 's' : ''} · ${fmtSize(totalOrig)} → ${fmtSize(totalNew)}</span>
        <span>💾 Économie : <strong>${totalSavings >= 0 ? '−' : '+'}${Math.abs(totalSavings).toFixed(0)}%</strong> (${fmtSize(Math.abs(totalOrig - totalNew))})</span>
      </div>
    `;

    downloadBtn.disabled = false;
    uploadBtn.disabled = !window.BccoGithub;
    clearBtn.disabled = false;
  }

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------
  function downloadAll() {
    pending.forEach((p) => {
      const url = URL.createObjectURL(p.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = p.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 500);
    });
    if (window.BccoGithub) BccoGithub.toast(`✓ ${pending.length} fichier${pending.length > 1 ? 's' : ''} téléchargé${pending.length > 1 ? 's' : ''}`, 'ok');
  }

  async function uploadAll() {
    if (!window.BccoGithub) return;
    const subdir = prompt('Sous-dossier dans media/ (laisser vide = racine media/) :', 'galerie/');
    if (subdir === null) return; // user cancelled
    const dir = MEDIA_DIR_DEFAULT + (subdir || '').replace(/^\/+|\/+$/g, '');
    const finalDir = dir.endsWith('/') ? dir : dir + '/';

    const btn = document.getElementById('ic-upload');
    btn.disabled = true;
    const orig = btn.innerHTML;
    let done = 0;
    try {
      for (const p of pending) {
        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Upload ${done + 1}/${pending.length}…`;
        // BccoGithub.uploadImage attend un File ; on en construit un depuis le blob
        const fileForUpload = new File([p.blob], p.name, { type: 'image/webp' });
        const path = finalDir + p.name;
        // On ne re-redimensionne pas côté BccoGithub (déjà fait ici) ; on appelle uploadImage
        // qui resize à nouveau si > 1600px, mais notre image est déjà bien dimensionnée.
        await BccoGithub.uploadImage(fileForUpload, path, `Upload WebP optimisé : ${p.name}`, { maxDim: 3000, quality: 0.95 });
        done++;
      }
      BccoGithub.toast(`✓ ${done} image${done > 1 ? 's' : ''} uploadée${done > 1 ? 's' : ''} dans ${finalDir}`, 'ok');
      pending = [];
      renderList();
    } catch (e) {
      BccoGithub.toast(`Erreur upload : ${e.message}`, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  // ---------------------------------------------------------------
  // Init (attend que le dashboard soit visible)
  // ---------------------------------------------------------------
  function init() { mount(); }

  function waitForDashboard() {
    const dash = document.getElementById('dashboard');
    if (!dash) { setTimeout(waitForDashboard, 200); return; }
    if (dash.style.display !== 'none') { init(); return; }
    const obs = new MutationObserver(() => {
      if (dash.style.display !== 'none') { obs.disconnect(); init(); }
    });
    obs.observe(dash, { attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDashboard);
  } else {
    waitForDashboard();
  }

})();
