/* ============================================================
   admin-galerie.js — Gestion complète de la galerie photos
   ------------------------------------------------------------
   - Liste visuelle des photos (thumbnails)
   - Upload multiple via drag & drop (redimensionnement auto)
   - Édition inline : alt, taille (wide/tall/large), ordre, actif
   - Réorganisation (boutons haut/bas)
   - Suppression
   - Persistence via data/galerie.csv commit GitHub
   ============================================================ */

(function () {
  'use strict';

  const CSV_PATH = 'data/galerie.csv';
  const HEADERS  = ['image', 'alt', 'taille', 'ordre', 'actif'];
  const MEDIA_DIR = 'media/galerie/';

  let state = {
    headers: HEADERS.slice(),
    rows: [],
    sha: null
  };

  function injectCSS() {
    if (document.getElementById('admin-gal-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-gal-css';
    s.textContent = `
      .gl-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
      .gl-btn{padding:10px 16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;color:var(--text)}
      .gl-btn:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(10,25,136,.08)}
      .gl-btn.primary{background:linear-gradient(135deg,#A5EB78,#7ed957);border:none;color:#0A1988;font-weight:700}
      .gl-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .gl-status{font-size:12px;color:var(--muted);font-style:italic;margin-left:auto}

      .gl-dropzone{
        position:relative;display:block;isolation:isolate;
        border:2px dashed rgba(10,25,136,.18);border-radius:14px;
        padding:32px 24px;text-align:center;background:#fafbff;
        transition:all .15s;cursor:pointer;margin-bottom:18px;
        overflow:hidden;
      }
      .gl-dropzone:hover,.gl-dropzone.drag{border-color:#0A1988;background:rgba(10,25,136,.04)}
      /* Masquage 100% bulletproof de l'input file (Safari-safe) */
      .gl-dropzone input[type="file"]{
        position:absolute !important;
        left:-9999px !important;top:auto !important;
        width:1px !important;height:1px !important;
        padding:0 !important;margin:-1px !important;
        overflow:hidden !important;
        clip:rect(0,0,0,0) !important;
        white-space:nowrap !important;
        border:0 !important;
        opacity:0 !important;
        pointer-events:none !important;
      }
      .gl-dropzone-icon{font-size:36px;margin-bottom:8px;line-height:1}
      .gl-dropzone-text{font-size:14px;color:var(--text);font-weight:600;margin-bottom:4px}
      .gl-dropzone-sub{font-size:12px;color:var(--muted)}

      .gl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
      .gl-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;position:relative;transition:transform .15s,box-shadow .15s}
      .gl-card:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(10,25,136,.12)}
      .gl-card.inactif{opacity:.55}
      .gl-card-img-wrap{position:relative;width:100%;aspect-ratio:4/3;background:#f0f3fa;overflow:hidden}
      .gl-card-img{width:100%;height:100%;object-fit:cover;display:block}
      .gl-card-order{position:absolute;top:8px;left:8px;background:rgba(11,17,48,.78);color:#fff;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.05em}
      .gl-card-size{position:absolute;top:8px;right:8px;background:rgba(165,235,120,.95);color:#0A1988;padding:3px 9px;border-radius:6px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
      .gl-card-draft{position:absolute;bottom:8px;left:8px;background:rgba(245,158,11,.95);color:#fff;padding:3px 9px;border-radius:6px;font-size:10.5px;font-weight:700;letter-spacing:.05em}
      .gl-card-body{padding:12px 14px;flex:1;display:flex;flex-direction:column;gap:8px}
      .gl-card-body input,.gl-card-body select{padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px;font-family:inherit;outline:none;background:#fff;color:var(--text);transition:border-color .15s,box-shadow .15s}
      .gl-card-body input:focus,.gl-card-body select:focus{border-color:#0A1988;box-shadow:0 0 0 3px rgba(10,25,136,.08)}
      .gl-card-row{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .gl-card-foot{display:flex;gap:5px;padding:10px 12px;border-top:1px solid var(--line);background:#fafbff}
      .gl-card-foot button{flex:1;padding:6px 8px;border-radius:7px;border:1px solid var(--line);background:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:4px;color:var(--text)}
      .gl-card-foot button:hover{border-color:#0A1988;color:#0A1988}
      .gl-card-foot button.danger:hover{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.05)}
      .gl-card-foot button:disabled{opacity:.4;cursor:not-allowed}
      .gl-card-foot svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2}

      .gl-actif-toggle{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted);cursor:pointer}
      .gl-actif-toggle input{accent-color:#16a34a}

      .gl-uploading{display:none;align-items:center;gap:10px;margin-bottom:14px;padding:12px 16px;border-radius:10px;background:rgba(10,25,136,.06);font-size:13px;color:#0A1988}
      .gl-uploading.show{display:flex}
      .gl-uploading .bar{flex:1;height:6px;background:rgba(10,25,136,.12);border-radius:999px;overflow:hidden}
      .gl-uploading .bar-fill{height:100%;background:#0A1988;border-radius:999px;transition:width .3s}
      .gl-uploading .count{font-weight:700;font-variant-numeric:tabular-nums}

      .gl-empty{grid-column:1/-1;padding:40px 20px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px;background:var(--surface)}

      @media(max-width:640px){
        .gl-grid{grid-template-columns:repeat(2,1fr);gap:10px}
      }
    `;
    document.head.appendChild(s);
  }

  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ----------------------------------------------------------------
  // Mount UI
  // ----------------------------------------------------------------
  function mountSection() {
    const dash = document.getElementById('dashboard');
    if (!dash || document.getElementById('gl-section')) return false;

    injectCSS();

    const section = document.createElement('section');
    section.id = 'gl-section';
    section.innerHTML = `
      <h3 class="section-title" style="margin-top:32px">Galerie photos</h3>
      <p class="section-sub">
        Gestion des photos affichées sur la page <code>galerie.html</code>. Les nouvelles images sont
        redimensionnées à 1600 px max puis commitées dans <code>${MEDIA_DIR}</code>.
      </p>

      <div class="gl-toolbar">
        <button type="button" class="gl-btn" id="gl-reload">
          <svg viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Recharger
        </button>
        <span class="gl-status" id="gl-status">Chargement…</span>
      </div>

      <label class="gl-dropzone" id="gl-drop">
        <input type="file" id="gl-files" accept="image/*" multiple />
        <div class="gl-dropzone-icon">📷</div>
        <div class="gl-dropzone-text">Glisser des photos ici ou cliquer pour parcourir</div>
        <div class="gl-dropzone-sub">JPG ou PNG · plusieurs fichiers à la fois</div>
      </label>

      <div class="gl-uploading" id="gl-uploading">
        <span class="count" id="gl-upload-count">0/0</span>
        <div class="bar"><div class="bar-fill" id="gl-upload-bar"></div></div>
      </div>

      <div class="gl-grid" id="gl-grid">
        <div class="gl-empty">Chargement de la galerie…</div>
      </div>
    `;

    const diagBtn = document.getElementById('dg-btn-wrap');
    if (diagBtn) dash.insertBefore(section, diagBtn);
    else dash.appendChild(section);

    // Listeners
    document.getElementById('gl-reload').addEventListener('click', reload);

    const drop = document.getElementById('gl-drop');
    const fileInput = document.getElementById('gl-files');
    fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) handleFiles(files);
    });

    return true;
  }

  function setStatus(msg) {
    const el = document.getElementById('gl-status');
    if (el) el.textContent = msg;
  }

  // ----------------------------------------------------------------
  // Charger / sauver
  // ----------------------------------------------------------------
  async function reload() {
    try {
      setStatus('Chargement depuis GitHub…');
      const f = await BccoGithub.readFile(CSV_PATH);
      const parsed = BccoGithub.parseCSV(f.content);
      state.headers = parsed.headers.length ? parsed.headers : HEADERS.slice();
      state.rows = parsed.rows;
      state.sha = f.sha;
      renderList();
      setStatus(`${state.rows.length} photo${state.rows.length > 1 ? 's' : ''} chargée${state.rows.length > 1 ? 's' : ''}`);
    } catch (e) {
      setStatus('');
      BccoGithub.toast('Erreur : ' + e.message, 'err');
    }
  }

  async function commit(message) {
    // Renormaliser les "ordre" (1, 2, 3, …)
    state.rows.forEach((r, i) => { r.ordre = String(i + 1); });
    const csv = BccoGithub.serializeCSV(state.rows, state.headers);
    setStatus('Publication en cours…');
    const res = await BccoGithub.writeFile(CSV_PATH, csv, message, state.sha);
    state.sha = res.content && res.content.sha;
    setStatus('Publié ! ' + new Date().toLocaleTimeString('fr-FR'));
  }

  // ----------------------------------------------------------------
  // Rendu liste
  // ----------------------------------------------------------------
  function renderList() {
    const grid = document.getElementById('gl-grid');
    if (!grid) return;

    // Tri par ordre asc
    state.rows.sort((a, b) => (parseInt(a.ordre || '999999', 10) - parseInt(b.ordre || '999999', 10)));

    if (!state.rows.length) {
      grid.innerHTML = `<div class="gl-empty">Aucune photo. Glisse-en pour commencer.</div>`;
      return;
    }

    grid.innerHTML = state.rows.map((r, i) => {
      const actif = (r.actif || '').toLowerCase() === 'x';
      const taille = (r.taille || '').toLowerCase();
      const sizeLabel = taille === 'wide-tall' || taille === 'large' ? 'XL'
                      : taille === 'wide' ? 'WIDE'
                      : taille === 'tall' ? 'TALL' : 'NORM';
      return `
        <div class="gl-card ${actif ? '' : 'inactif'}" data-idx="${i}">
          <div class="gl-card-img-wrap">
            <img class="gl-card-img" src="${escape(r.image)}" alt="${escape(r.alt || '')}" loading="lazy"
                 nopin="nopin" data-pin-nopin="true"
                 onerror="this.style.display='none';this.parentNode.style.background='repeating-linear-gradient(45deg,#fee,#fee 8px,#fcc 8px,#fcc 16px)';">
            <span class="gl-card-order">#${i + 1}</span>
            <span class="gl-card-size">${sizeLabel}</span>
            ${!actif ? '<span class="gl-card-draft">Brouillon</span>' : ''}
          </div>
          <div class="gl-card-body">
            <input type="text" placeholder="Légende (alt)" value="${escape(r.alt || '')}" data-field="alt" data-idx="${i}" />
            <div class="gl-card-row">
              <select data-field="taille" data-idx="${i}">
                <option value="" ${!taille ? 'selected' : ''}>Normal</option>
                <option value="wide" ${taille === 'wide' ? 'selected' : ''}>Large</option>
                <option value="tall" ${taille === 'tall' ? 'selected' : ''}>Haute</option>
                <option value="wide-tall" ${taille === 'wide-tall' || taille === 'large' ? 'selected' : ''}>XL (2x2)</option>
              </select>
              <label class="gl-actif-toggle">
                <input type="checkbox" data-field="actif" data-idx="${i}" ${actif ? 'checked' : ''} />
                <span>Publiée</span>
              </label>
            </div>
          </div>
          <div class="gl-card-foot">
            <button type="button" data-move="up" data-idx="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">
              <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button type="button" data-move="down" data-idx="${i}" ${i === state.rows.length - 1 ? 'disabled' : ''} title="Descendre">
              <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button type="button" data-save="${i}">
              <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/></svg>
              Enregistrer
            </button>
            <button type="button" class="danger" data-del="${i}" title="Supprimer">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Listeners
    grid.querySelectorAll('[data-save]').forEach(b =>
      b.addEventListener('click', () => saveCard(parseInt(b.dataset.save, 10))));
    grid.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => deleteCard(parseInt(b.dataset.del, 10))));
    grid.querySelectorAll('[data-move]').forEach(b =>
      b.addEventListener('click', () => moveCard(parseInt(b.dataset.idx, 10), b.dataset.move === 'up' ? -1 : 1)));
  }

  function readCardForm(index) {
    const grid = document.getElementById('gl-grid');
    const card = grid.querySelector(`.gl-card[data-idx="${index}"]`);
    if (!card) return null;
    return {
      alt:    card.querySelector('[data-field="alt"]').value.trim(),
      taille: card.querySelector('[data-field="taille"]').value.trim(),
      actif:  card.querySelector('[data-field="actif"]').checked ? 'x' : ''
    };
  }

  async function saveCard(index) {
    const data = readCardForm(index);
    if (!data) return;
    const r = state.rows[index];
    if (!r) return;
    Object.assign(r, data);
    try {
      await commit(`Mise à jour photo galerie : ${r.alt || r.image}`);
      BccoGithub.toast('Photo mise à jour', 'ok');
      renderList();
    } catch (e) {
      BccoGithub.toast('Erreur : ' + e.message, 'err');
    }
  }

  async function deleteCard(index) {
    const r = state.rows[index];
    if (!r) return;
    if (!confirm(`Supprimer cette photo de la galerie ?\n\n"${r.alt || r.image}"\n\nL'image elle-même reste dans le repo (tu peux la retirer manuellement).`)) return;
    state.rows.splice(index, 1);
    try {
      await commit(`Suppression photo galerie : ${r.alt || r.image}`);
      BccoGithub.toast('Photo retirée de la galerie', 'ok');
      renderList();
    } catch (e) {
      state.rows.splice(index, 0, r);
      BccoGithub.toast('Erreur : ' + e.message, 'err');
      renderList();
    }
  }

  async function moveCard(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.rows.length) return;
    const tmp = state.rows[index];
    state.rows[index] = state.rows[newIndex];
    state.rows[newIndex] = tmp;
    try {
      await commit('Réordonnancement galerie');
      renderList();
    } catch (e) {
      // rollback
      state.rows[newIndex] = state.rows[index];
      state.rows[index] = tmp;
      BccoGithub.toast('Erreur : ' + e.message, 'err');
      renderList();
    }
  }

  // ----------------------------------------------------------------
  // Upload multiple
  // ----------------------------------------------------------------
  async function handleFiles(files) {
    const imgs = files.filter(f => f.type && f.type.startsWith('image/'));
    if (!imgs.length) {
      BccoGithub.toast('Aucune image valide sélectionnée', 'err');
      return;
    }

    const uploadingEl = document.getElementById('gl-uploading');
    const countEl = document.getElementById('gl-upload-count');
    const barEl = document.getElementById('gl-upload-bar');
    uploadingEl.classList.add('show');
    barEl.style.width = '0%';

    let done = 0;
    const newRows = [];

    try {
      for (const file of imgs) {
        countEl.textContent = `${done + 1}/${imgs.length} · ${file.name}`;
        const slug = BccoGithub.slugify(file.name.replace(/\.[^.]+$/, '') || 'photo');
        const ext  = file.type === 'image/png' ? 'png' : 'jpg';
        const ts   = Date.now() + '-' + Math.floor(Math.random() * 1000);
        const path = `${MEDIA_DIR}${ts}-${slug}.${ext}`;
        const uploaded = await BccoGithub.uploadImage(file, path, `Upload galerie : ${file.name}`, { maxDim: 1800, quality: 0.85 });

        const row = {};
        state.headers.forEach(h => row[h] = '');
        row.image = uploaded.localUrl;
        row.alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        row.taille = '';
        row.ordre = String(state.rows.length + newRows.length + 1);
        row.actif = 'x';
        newRows.push(row);

        done++;
        barEl.style.width = `${Math.round((done / imgs.length) * 100)}%`;
      }

      state.rows = state.rows.concat(newRows);
      await commit(`Ajout de ${newRows.length} photo${newRows.length > 1 ? 's' : ''} à la galerie`);
      BccoGithub.toast(`${newRows.length} photo${newRows.length > 1 ? 's ajoutées' : ' ajoutée'} à la galerie !`, 'ok');
      renderList();
    } catch (e) {
      BccoGithub.toast('Erreur upload : ' + e.message, 'err');
    } finally {
      uploadingEl.classList.remove('show');
      barEl.style.width = '0%';
      countEl.textContent = '0/0';
      // reset input pour permettre de re-uploader les mêmes fichiers
      document.getElementById('gl-files').value = '';
    }
  }

  // ----------------------------------------------------------------
  // Init
  // ----------------------------------------------------------------
  function init() {
    if (!mountSection()) return false;
    reload();
    return true;
  }

  function waitForDashboard() {
    const dash = document.getElementById('dashboard');
    if (!dash) { setTimeout(waitForDashboard, 300); return; }
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
