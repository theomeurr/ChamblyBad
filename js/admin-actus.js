/* ============================================================
   admin-actus.js — Édition directe des actualités depuis l'admin
   ------------------------------------------------------------
   Remplace le bouton "Modifier sur GitHub" par un vrai éditeur :
   - Liste des actus existantes
   - Création / édition / suppression
   - Upload d'image avec redimensionnement
   - Mode aperçu fidèle au rendu home
   - Publication via commit GitHub API
   ============================================================ */

(function () {
  'use strict';

  const CSV_PATH = 'data/actualites.csv';
  const ACTU_HEADERS = ['date', 'date_affichage', 'titre', 'resume', 'image', 'tag', 'tag_label', 'lien', 'actif'];

  // État local
  let state = {
    headers: ACTU_HEADERS.slice(),
    rows: [],
    sha: null,
    editingIndex: -1,
    isDirty: false
  };

  // ----------------------------------------------------------------
  // Injection CSS (toutes les classes commencent par .ae- ou .ap-)
  // ----------------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('admin-actus-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-actus-css';
    s.textContent = `
      /* Toolbar éditeur */
      .ae-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
      .ae-btn{padding:10px 16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;color:var(--text)}
      .ae-btn:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(10,25,136,.08)}
      .ae-btn.primary{background:linear-gradient(135deg,#A5EB78,#7ed957);border:none;color:#0A1988;font-weight:700}
      .ae-btn.danger{border-color:#ef4444;color:#ef4444}
      .ae-btn.danger:hover{background:rgba(239,68,68,.06)}
      .ae-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .ae-status{font-size:12px;color:var(--muted);font-style:italic;margin-left:auto}

      /* Grille des actus en mode admin */
      .ae-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
      .ae-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s}
      .ae-card:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(10,25,136,.12)}
      .ae-card-img{width:100%;aspect-ratio:4/5;background:#f0f3fa;object-fit:cover;display:block}
      .ae-card-noimg{width:100%;aspect-ratio:4/5;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e8edff,#f7f7fa);color:var(--muted);font-size:11px;letter-spacing:.06em}
      .ae-card-body{padding:14px;display:flex;flex-direction:column;gap:6px;flex:1}
      .ae-card-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:6px;width:fit-content;background:rgba(165,235,120,.16);color:#15803d}
      .ae-card-tag.match{background:rgba(165,235,120,.16);color:#15803d}
      .ae-card-tag.tournoi{background:rgba(245,158,11,.14);color:#b45309}
      .ae-card-tag.event{background:rgba(10,25,136,.08);color:#0A1988}
      .ae-card-date{font-size:11.5px;color:var(--muted);font-weight:500}
      .ae-card-title{font-family:'Anton',sans-serif;font-weight:400;font-size:16px;color:var(--text);line-height:1.2}
      .ae-card-resume{font-size:12.5px;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .ae-card-foot{display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--line);background:#fafbff}
      .ae-card-foot button{flex:1;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:#fff;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:5px;color:var(--text)}
      .ae-card-foot button:hover{border-color:#0A1988;color:#0A1988}
      .ae-card-foot button.danger:hover{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.04)}
      .ae-card-foot svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2}
      .ae-card.inactif{opacity:.55}
      .ae-card.scheduled{outline:2px solid rgba(245,158,11,.4);outline-offset:-2px}
      .ae-card-badge-draft{position:absolute;top:8px;left:8px;background:rgba(11,17,48,.85);color:#fff;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
      .ae-card-badge-scheduled{position:absolute;top:8px;left:8px;background:rgba(245,158,11,.95);color:#fff;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;display:inline-flex;align-items:center;gap:4px}
      .ae-card-badge-scheduled::before{content:'⏰';font-size:11px}
      .ae-card-img-wrap{position:relative}

      /* Modal éditeur */
      .ae-modal-bg{position:fixed;inset:0;background:rgba(11,17,48,.6);backdrop-filter:blur(4px);z-index:400;display:none;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
      .ae-modal-bg.show{display:flex}
      .ae-modal{background:#fff;border-radius:20px;max-width:680px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.3)}
      .ae-modal-head{padding:22px 26px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-start;gap:14px;position:sticky;top:0;background:#fff;border-radius:20px 20px 0 0;z-index:2}
      .ae-modal-head h3{font-family:'Anton',sans-serif;font-weight:400;font-size:20px;color:var(--text)}
      .ae-modal-head p{font-size:12px;color:var(--muted);margin-top:4px}
      .ae-modal-close{background:none;border:none;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:18px;line-height:1}
      .ae-modal-close:hover{background:#f0f3fa;color:var(--text)}
      .ae-modal-body{padding:20px 26px}
      .ae-modal-foot{padding:16px 26px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;position:sticky;bottom:0;background:#fff;border-radius:0 0 20px 20px}

      /* Form fields */
      .ae-field{margin-bottom:14px}
      .ae-field label{display:block;font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase}
      .ae-field label .opt{text-transform:none;font-weight:500;font-style:italic;opacity:.7}
      .ae-field input[type=text],.ae-field input[type=date],.ae-field input[type=url],.ae-field select,.ae-field textarea{
        width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;background:#fff;color:var(--text);
      }
      .ae-field textarea{min-height:90px;resize:vertical;line-height:1.5}
      .ae-field input:focus,.ae-field select:focus,.ae-field textarea:focus{border-color:#0A1988;box-shadow:0 0 0 3px rgba(10,25,136,.08)}
      .ae-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .ae-hint{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4}

      /* Image drop zone */
      .ae-imgzone{border:2px dashed rgba(10,25,136,.18);border-radius:14px;padding:18px;text-align:center;background:#fafbff;transition:all .15s;cursor:pointer}
      .ae-imgzone:hover,.ae-imgzone.drag{border-color:#0A1988;background:rgba(10,25,136,.04)}
      .ae-imgzone input[type=file]{display:none}
      .ae-imgzone-text{font-size:13px;color:var(--text);font-weight:600;margin-bottom:4px}
      .ae-imgzone-sub{font-size:11.5px;color:var(--muted)}
      .ae-imgpreview{display:none;align-items:center;gap:14px;padding:12px;background:#f7f7fa;border-radius:12px;margin-top:10px}
      .ae-imgpreview.show{display:flex}
      .ae-imgpreview img{width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0;background:#e8edff}
      .ae-imgpreview .info{flex:1;min-width:0}
      .ae-imgpreview .info strong{display:block;font-size:13px;color:var(--text);margin-bottom:2px;word-break:break-all}
      .ae-imgpreview .info span{font-size:11.5px;color:var(--muted)}
      .ae-imgpreview button{background:none;border:1px solid #ef4444;color:#ef4444;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}

      /* Checkbox actif */
      .ae-checkbox{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f7f7fa;border-radius:10px;cursor:pointer;border:1px solid transparent}
      .ae-checkbox:hover{background:#f0f3fa}
      .ae-checkbox.on{background:rgba(165,235,120,.12);border-color:rgba(22,163,74,.3)}
      .ae-checkbox input{accent-color:#16a34a;width:16px;height:16px}
      .ae-checkbox span{font-size:13px;color:var(--text);font-weight:500}

      /* Preview modal (par-dessus l'éditeur) */
      .ap-modal-bg{position:fixed;inset:0;background:rgba(11,17,48,.75);backdrop-filter:blur(6px);z-index:500;display:none;align-items:center;justify-content:center;padding:24px;overflow-y:auto}
      .ap-modal-bg.show{display:flex}
      .ap-wrap{background:#fff;border-radius:20px;max-width:420px;width:100%;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.4)}
      .ap-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
      .ap-header button{background:none;border:none;font-size:20px;line-height:1;cursor:pointer;color:var(--muted)}
      .ap-header button:hover{color:var(--text)}
      .ap-card{background:#fff;border-radius:18px;overflow:hidden;border:1px solid var(--line);box-shadow:0 12px 30px rgba(10,25,136,.1)}
      .ap-card .img{width:100%;aspect-ratio:4/5;object-fit:cover;background:#f0f3fa;display:block}
      .ap-card .noimg{width:100%;aspect-ratio:4/5;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e8edff,#f7f7fa);color:var(--muted);font-size:12px}
      .ap-card .body{padding:18px 18px 22px}
      .ap-card .tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:4px 10px;border-radius:6px;width:fit-content;background:rgba(165,235,120,.16);color:#15803d;display:inline-block;margin-bottom:10px}
      .ap-card .tag.match{background:rgba(165,235,120,.16);color:#15803d}
      .ap-card .tag.tournoi{background:rgba(245,158,11,.14);color:#b45309}
      .ap-card .tag.event{background:rgba(10,25,136,.08);color:#0A1988}
      .ap-card .date{font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:500}
      .ap-card h3{font-family:'Anton',sans-serif;font-weight:400;font-size:22px;color:var(--text);line-height:1.15;margin-bottom:10px}
      .ap-card p{font-size:13.5px;color:var(--muted);line-height:1.55}
      .ap-footer{margin-top:14px;font-size:11.5px;color:var(--muted);text-align:center;font-style:italic}

      /* Empty state */
      .ae-empty{padding:48px 24px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px;background:var(--surface)}
      .ae-empty p{font-size:14px;margin-bottom:4px}
      .ae-empty small{font-size:12px;opacity:.7}

      /* Mobile */
      @media(max-width:640px){
        .ae-row{grid-template-columns:1fr}
        .ae-modal{border-radius:14px}
        .ae-modal-head,.ae-modal-body,.ae-modal-foot{padding-left:18px;padding-right:18px}
      }
    `;
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------------
  // Remplacement de l'UI existante
  // ----------------------------------------------------------------
  function replaceUI() {
    const toolbar = document.getElementById('actusToolbar');
    const preview = document.getElementById('actusPreview');
    const empty   = document.getElementById('actusEmpty');
    if (!toolbar || !preview) return false;

    // Nouvelle toolbar
    toolbar.outerHTML = `
      <div class="ae-toolbar" id="ae-toolbar">
        <button type="button" class="ae-btn primary" id="ae-new">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Nouvelle actualité
        </button>
        <button type="button" class="ae-btn" id="ae-reload">
          <svg viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Recharger
        </button>
        <button type="button" class="ae-btn" id="ae-github-logout" title="Se déconnecter de GitHub">
          <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Déconnexion GitHub
        </button>
        <span class="ae-status" id="ae-status">Chargement…</span>
      </div>
    `;

    // Grille
    preview.outerHTML = `<div id="ae-grid" class="ae-grid"></div>`;
    if (empty) empty.style.display = 'none';

    document.getElementById('ae-new').addEventListener('click', () => openEditor(-1));
    document.getElementById('ae-reload').addEventListener('click', () => reload());
    document.getElementById('ae-github-logout').addEventListener('click', () => {
      BccoGithub.logout();
      setStatus('Déconnecté. Le prochain chargement redemandera ton token.');
    });

    return true;
  }

  // ----------------------------------------------------------------
  // Chargement / sauvegarde
  // ----------------------------------------------------------------
  function setStatus(msg) {
    const el = document.getElementById('ae-status');
    if (el) el.textContent = msg;
  }

  async function reload() {
    try {
      setStatus('Chargement depuis GitHub…');
      const f = await BccoGithub.readFile(CSV_PATH);
      const parsed = BccoGithub.parseCSV(f.content);
      // Force les headers attendus (au cas où le CSV en aurait moins)
      state.headers = parsed.headers.length ? parsed.headers : ACTU_HEADERS.slice();
      state.rows = parsed.rows;
      state.sha = f.sha;
      renderList();
      setStatus(`${state.rows.length} actualité${state.rows.length > 1 ? 's' : ''} chargée${state.rows.length > 1 ? 's' : ''}`);
    } catch (e) {
      setStatus('');
      BccoGithub.toast('Erreur : ' + e.message, 'err');
      renderList();
    }
  }

  async function commit(message) {
    const csv = BccoGithub.serializeCSV(state.rows, state.headers);
    setStatus('Publication en cours…');
    const res = await BccoGithub.writeFile(CSV_PATH, csv, message, state.sha);
    state.sha = res.content && res.content.sha;
    setStatus('Publié ! ' + new Date().toLocaleTimeString('fr-FR'));
  }

  // ----------------------------------------------------------------
  // Rendu de la liste
  // ----------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function renderList() {
    const grid = document.getElementById('ae-grid');
    if (!grid) return;

    if (!state.rows.length) {
      grid.innerHTML = `
        <div class="ae-empty" style="grid-column:1/-1">
          <p>Aucune actualité publiée pour l'instant.</p>
          <small>Clique sur "Nouvelle actualité" pour commencer.</small>
        </div>`;
      return;
    }

    // Tri : date desc
    const sorted = state.rows.map((r, i) => ({ r, i })).sort((a, b) => {
      const da = a.r.date || '';
      const db = b.r.date || '';
      return db.localeCompare(da);
    });

    // Helper pour calculer l'état d'une actu : draft / scheduled / published
    const today = new Date(); today.setHours(0, 0, 0, 0);
    function getState(row) {
      const isActif = (row.actif || '').toLowerCase() === 'x';
      if (!isActif) return 'draft';
      if (row.date) {
        const d = new Date(row.date);
        if (!isNaN(d) && d > today) return 'scheduled';
      }
      return 'published';
    }
    function fmtFR(iso) {
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    grid.innerHTML = sorted.map(({ r, i }) => {
      const tag = (r.tag || '').toLowerCase();
      const state = getState(r);
      const actif = state !== 'draft';
      // Badge selon l'état
      const badge = state === 'draft'
        ? '<span class="ae-card-badge-draft">Brouillon</span>'
        : state === 'scheduled'
          ? `<span class="ae-card-badge-scheduled" title="Apparaîtra automatiquement le ${escapeHtml(fmtFR(r.date))}">Programmée · ${escapeHtml(fmtFR(r.date))}</span>`
          : '';
      const img = r.image
        ? `<div class="ae-card-img-wrap"><img class="ae-card-img" src="${escapeHtml(r.image)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;ae-card-noimg&quot;>Image inaccessible</div>'">${badge}</div>`
        : `<div class="ae-card-img-wrap"><div class="ae-card-noimg">Pas d'image</div>${badge}</div>`;

      const cardCls = state === 'draft' ? 'inactif' : (state === 'scheduled' ? 'scheduled' : '');

      return `
        <article class="ae-card ${cardCls}">
          ${img}
          <div class="ae-card-body">
            <span class="ae-card-tag ${tag}">${escapeHtml(r.tag_label || r.tag || '—')}</span>
            <span class="ae-card-date">${escapeHtml(r.date_affichage || r.date || '')}</span>
            <h4 class="ae-card-title">${escapeHtml(r.titre || '(sans titre)')}</h4>
            <p class="ae-card-resume">${escapeHtml(r.resume || '')}</p>
          </div>
          <div class="ae-card-foot">
            <button type="button" data-edit="${i}">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
              Modifier
            </button>
            <button type="button" class="danger" data-del="${i}">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Supprimer
            </button>
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => openEditor(parseInt(b.dataset.edit, 10)));
    });
    grid.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => confirmDelete(parseInt(b.dataset.del, 10)));
    });
  }

  // ----------------------------------------------------------------
  // Suppression
  // ----------------------------------------------------------------
  async function confirmDelete(index) {
    const r = state.rows[index];
    if (!r) return;
    if (!confirm(`Supprimer l'actualité "${r.titre || '(sans titre)'}" ?\n\nElle sera retirée immédiatement du site une fois publiée.`)) return;
    state.rows.splice(index, 1);
    try {
      await commit(`Suppression actu : ${r.titre || '(sans titre)'}`);
      BccoGithub.toast('Actualité supprimée', 'ok');
      renderList();
    } catch (e) {
      // rollback
      state.rows.splice(index, 0, r);
      BccoGithub.toast('Erreur suppression : ' + e.message, 'err');
    }
  }

  // ----------------------------------------------------------------
  // Modal éditeur
  // ----------------------------------------------------------------
  let modalEl = null;
  let pendingImage = null; // { file, blob, dataUrl }

  function buildModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'ae-modal-bg';
    modalEl.innerHTML = `
      <div class="ae-modal" role="dialog" aria-modal="true">
        <div class="ae-modal-head">
          <div>
            <h3 id="ae-modal-title">Nouvelle actualité</h3>
            <p>Les modifications sont publiées en commit sur GitHub.</p>
          </div>
          <button type="button" class="ae-modal-close" id="ae-modal-close">&times;</button>
        </div>
        <div class="ae-modal-body">
          <div class="ae-row">
            <div class="ae-field">
              <label for="ae-f-date">Date de publication <span style="color:#ef4444">*</span></label>
              <input type="date" id="ae-f-date" />
              <div class="ae-hint">📌 <strong>Invisible</strong> pour les visiteurs. Sert à classer les actus (plus récente en haut).<br>💡 <strong>Programmation</strong> : si tu mets une date future, l'actu apparaîtra automatiquement à cette date.</div>
            </div>
            <div class="ae-field">
              <label for="ae-f-date-aff">Date de l'événement <span style="color:#ef4444">*</span></label>
              <input type="text" id="ae-f-date-aff" placeholder="ex: Samedi 28 mars · 16h00, ou Mai 2026" />
              <div class="ae-hint">✨ <strong>Visible</strong> sur la carte. Texte libre pour gérer les dates vagues (mois, période, etc.).</div>
            </div>
          </div>

          <div class="ae-field">
            <label for="ae-f-titre">Titre <span style="color:#ef4444">*</span></label>
            <input type="text" id="ae-f-titre" placeholder="Ex: Chambly vs Fos-sur-Mer" />
          </div>

          <div class="ae-field">
            <label for="ae-f-resume">Résumé <span style="color:#ef4444">*</span></label>
            <textarea id="ae-f-resume" placeholder="Description courte qui apparaîtra sur la home (2-3 phrases)…"></textarea>
          </div>

          <div class="ae-field">
            <label>Image <span class="opt">(facultative, recadrée automatiquement en 1080×1350 portrait)</span></label>
            <label class="ae-imgzone" id="ae-imgzone">
              <input type="file" accept="image/*" id="ae-file" />
              <div class="ae-imgzone-text">📷 Cliquer ou glisser une image ici</div>
              <div class="ae-imgzone-sub">JPG ou PNG · recadrage automatique au centre en 1080 × 1350 (format portrait 4:5)</div>
            </label>
            <div class="ae-imgpreview" id="ae-imgpreview">
              <img id="ae-imgpreview-img" alt="Aperçu"/>
              <div class="info">
                <strong id="ae-imgpreview-name">—</strong>
                <span id="ae-imgpreview-meta">—</span>
              </div>
              <button type="button" id="ae-imgpreview-clear">Retirer</button>
            </div>
            <div class="ae-hint" id="ae-imgurl-hint" style="margin-top:8px">
              Ou colle une URL d'image (CDN, hébergement externe) :
            </div>
            <input type="url" id="ae-f-image-url" placeholder="https://…" style="margin-top:6px;width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px;font-size:13px;font-family:inherit;outline:none" />
          </div>

          <div class="ae-row">
            <div class="ae-field">
              <label for="ae-f-tag">Catégorie</label>
              <select id="ae-f-tag">
                <option value="match">Match (vert)</option>
                <option value="tournoi">Tournoi (orange)</option>
                <option value="event">Événement (bleu)</option>
                <option value="">Autre / sans tag</option>
              </select>
            </div>
            <div class="ae-field">
              <label for="ae-f-tag-label">Libellé affiché</label>
              <input type="text" id="ae-f-tag-label" placeholder="Ex: Match Top 12" />
            </div>
          </div>

          <div class="ae-field">
            <label for="ae-f-lien">Lien externe <span class="opt">(facultatif — bouton "En savoir plus")</span></label>
            <input type="url" id="ae-f-lien" placeholder="https://…" />
          </div>

          <div class="ae-field">
            <label class="ae-checkbox" id="ae-actif-label">
              <input type="checkbox" id="ae-f-actif" checked />
              <span>Publier cette actualité (sinon : brouillon, non visible sur le site)</span>
            </label>
          </div>
        </div>
        <div class="ae-modal-foot">
          <button type="button" class="ae-btn" id="ae-preview-btn">
            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Aperçu
          </button>
          <button type="button" class="ae-btn" id="ae-cancel-btn">Annuler</button>
          <button type="button" class="ae-btn primary" id="ae-save-btn">
            <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Publier
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    // Listeners
    modalEl.querySelector('#ae-modal-close').addEventListener('click', closeEditor);
    modalEl.querySelector('#ae-cancel-btn').addEventListener('click', closeEditor);
    modalEl.querySelector('#ae-save-btn').addEventListener('click', saveEditor);
    modalEl.querySelector('#ae-preview-btn').addEventListener('click', openPreview);

    // Checkbox style
    const cbActif = modalEl.querySelector('#ae-f-actif');
    const lblActif = modalEl.querySelector('#ae-actif-label');
    cbActif.addEventListener('change', () => lblActif.classList.toggle('on', cbActif.checked));
    lblActif.classList.toggle('on', cbActif.checked);

    // Tag → auto-libellé
    const tagSel = modalEl.querySelector('#ae-f-tag');
    const tagLbl = modalEl.querySelector('#ae-f-tag-label');
    const defaultLabels = { match: 'Match', tournoi: 'Tournoi', event: 'Événement' };
    tagSel.addEventListener('change', () => {
      if (!tagLbl.value || Object.values(defaultLabels).some(v => tagLbl.value.startsWith(v))) {
        tagLbl.value = defaultLabels[tagSel.value] || '';
      }
    });

    // Image upload
    const fileInput = modalEl.querySelector('#ae-file');
    const dropzone  = modalEl.querySelector('#ae-imgzone');
    const previewEl = modalEl.querySelector('#ae-imgpreview');
    const previewImg = modalEl.querySelector('#ae-imgpreview-img');
    const previewName = modalEl.querySelector('#ae-imgpreview-name');
    const previewMeta = modalEl.querySelector('#ae-imgpreview-meta');
    const previewClear = modalEl.querySelector('#ae-imgpreview-clear');

    fileInput.addEventListener('change', () => handleImageFile(fileInput.files[0]));

    ['dragenter', 'dragover'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleImageFile(f);
    });

    previewClear.addEventListener('click', () => {
      pendingImage = null;
      fileInput.value = '';
      previewEl.classList.remove('show');
      previewImg.src = '';
    });

    async function handleImageFile(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        BccoGithub.toast('Fichier non reconnu comme image', 'err');
        return;
      }
      try {
        // Format card actu : 1080×1350 (4:5, portrait) avec center-crop automatique
        const blob = await BccoGithub.resizeImage(file, { targetWidth: 1080, targetHeight: 1350, quality: 0.85 });
        const dataUrl = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
        pendingImage = { file, blob, dataUrl };
        previewImg.src = dataUrl;
        previewName.textContent = file.name;
        previewMeta.textContent = `${Math.round(blob.size / 1024)} ko après redimensionnement (était ${Math.round(file.size / 1024)} ko)`;
        previewEl.classList.add('show');
        // En cas d'image locale, on clear l'input URL
        modalEl.querySelector('#ae-f-image-url').value = '';
      } catch (e) {
        BccoGithub.toast('Erreur : ' + e.message, 'err');
      }
    }

    return modalEl;
  }

  function openEditor(index) {
    buildModal();
    state.editingIndex = index;
    pendingImage = null;

    const isNew = index < 0;
    const row = isNew ? {} : state.rows[index];

    modalEl.querySelector('#ae-modal-title').textContent = isNew ? 'Nouvelle actualité' : 'Modifier l\'actualité';
    modalEl.querySelector('#ae-f-date').value          = row.date || new Date().toISOString().slice(0, 10);
    modalEl.querySelector('#ae-f-date-aff').value      = row.date_affichage || '';
    modalEl.querySelector('#ae-f-titre').value         = row.titre || '';
    modalEl.querySelector('#ae-f-resume').value        = row.resume || '';
    modalEl.querySelector('#ae-f-image-url').value     = row.image || '';
    modalEl.querySelector('#ae-f-tag').value           = row.tag || 'match';
    modalEl.querySelector('#ae-f-tag-label').value     = row.tag_label || 'Match';
    modalEl.querySelector('#ae-f-lien').value          = row.lien || '';
    const actif = isNew ? true : (String(row.actif || '').toLowerCase() === 'x');
    modalEl.querySelector('#ae-f-actif').checked = actif;
    modalEl.querySelector('#ae-actif-label').classList.toggle('on', actif);

    // Pas de fichier en attente, on remet à zéro la preview
    modalEl.querySelector('#ae-file').value = '';
    modalEl.querySelector('#ae-imgpreview').classList.remove('show');

    modalEl.classList.add('show');
  }

  function closeEditor() {
    if (modalEl) modalEl.classList.remove('show');
    state.editingIndex = -1;
    pendingImage = null;
  }

  function readForm() {
    return {
      date: modalEl.querySelector('#ae-f-date').value.trim(),
      date_affichage: modalEl.querySelector('#ae-f-date-aff').value.trim(),
      titre: modalEl.querySelector('#ae-f-titre').value.trim(),
      resume: modalEl.querySelector('#ae-f-resume').value.trim(),
      image: modalEl.querySelector('#ae-f-image-url').value.trim(),
      tag: modalEl.querySelector('#ae-f-tag').value.trim(),
      tag_label: modalEl.querySelector('#ae-f-tag-label').value.trim(),
      lien: modalEl.querySelector('#ae-f-lien').value.trim(),
      actif: modalEl.querySelector('#ae-f-actif').checked ? 'x' : ''
    };
  }

  async function saveEditor() {
    const data = readForm();
    if (!data.date)           { BccoGithub.toast('La date de publication est obligatoire', 'err'); return; }
    if (!data.date_affichage) { BccoGithub.toast('La date de l\'événement (texte visible) est obligatoire', 'err'); return; }
    if (!data.titre)          { BccoGithub.toast('Le titre est obligatoire', 'err'); return; }
    if (!data.resume)         { BccoGithub.toast('Le résumé est obligatoire', 'err'); return; }

    const saveBtn = modalEl.querySelector('#ae-save-btn');
    saveBtn.disabled = true;
    const originalHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Publication…';

    try {
      // 1. Upload image si pendante
      if (pendingImage) {
        const slug = BccoGithub.slugify(data.titre || 'actu');
        const ext = pendingImage.file.type === 'image/png' ? 'png' : 'jpg';
        const date = data.date || new Date().toISOString().slice(0, 10);
        const path = `media/actus/${date}-${slug}.${ext}`;
        // Conversion blob → file pour conserver le type
        const fileForUpload = new File([pendingImage.blob], `${date}-${slug}.${ext}`, { type: pendingImage.blob.type });
        const uploaded = await BccoGithub.uploadImage(fileForUpload, path, `Upload image actu : ${data.titre}`);
        data.image = uploaded.localUrl;
      }

      // 2. Insert ou update dans state.rows
      const isNew = state.editingIndex < 0;
      // S'assurer que tous les headers existent
      const fullRow = {};
      state.headers.forEach(h => fullRow[h] = data[h] != null ? data[h] : '');

      if (isNew) {
        state.rows.unshift(fullRow);
      } else {
        state.rows[state.editingIndex] = fullRow;
      }

      // 3. Commit CSV
      await commit(isNew ? `Nouvelle actu : ${data.titre}` : `Mise à jour actu : ${data.titre}`);

      BccoGithub.toast(isNew ? 'Actualité publiée !' : 'Actualité mise à jour !', 'ok');
      renderList();
      closeEditor();
    } catch (e) {
      BccoGithub.toast('Erreur : ' + e.message, 'err');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHTML;
    }
  }

  // ----------------------------------------------------------------
  // Preview modal
  // ----------------------------------------------------------------
  let previewEl = null;
  function buildPreviewModal() {
    if (previewEl) return previewEl;
    previewEl = document.createElement('div');
    previewEl.className = 'ap-modal-bg';
    previewEl.innerHTML = `
      <div class="ap-wrap">
        <div class="ap-header">
          <span>📱 Aperçu — telle qu'elle apparaîtra sur la home</span>
          <button type="button" id="ap-close">&times;</button>
        </div>
        <div class="ap-card" id="ap-card"></div>
        <div class="ap-footer">Ceci est un aperçu visuel. Le rendu final peut varier légèrement.</div>
      </div>
    `;
    document.body.appendChild(previewEl);
    previewEl.querySelector('#ap-close').addEventListener('click', () => previewEl.classList.remove('show'));
    previewEl.addEventListener('click', (e) => {
      if (e.target === previewEl) previewEl.classList.remove('show');
    });
    return previewEl;
  }

  function openPreview() {
    buildPreviewModal();
    const d = readForm();
    const img = pendingImage ? pendingImage.dataUrl : d.image;
    const tag = (d.tag || '').toLowerCase();

    const imgHtml = img
      ? `<img class="img" src="${escapeHtml(img)}" alt="" onerror="this.outerHTML='<div class=&quot;noimg&quot;>Image inaccessible</div>'">`
      : `<div class="noimg">Pas d'image</div>`;

    previewEl.querySelector('#ap-card').innerHTML = `
      ${imgHtml}
      <div class="body">
        ${d.tag_label ? `<span class="tag ${tag}">${escapeHtml(d.tag_label)}</span>` : ''}
        ${d.date_affichage ? `<div class="date">📅 ${escapeHtml(d.date_affichage)}</div>` : ''}
        <h3>${escapeHtml(d.titre || '(sans titre)')}</h3>
        <p>${escapeHtml(d.resume || '(sans résumé)')}</p>
      </div>
    `;
    previewEl.classList.add('show');
  }

  // ----------------------------------------------------------------
  // Initialisation (attend que le dashboard soit visible)
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
    if (dash.style.display !== 'none' && document.getElementById('actusToolbar')) {
      init();
      return;
    }
    const obs = new MutationObserver(() => {
      if (dash.style.display !== 'none' && document.getElementById('actusToolbar')) {
        obs.disconnect();
        init();
      }
    });
    obs.observe(dash, { attributes: true, attributeFilter: ['style'] });
    // Au cas où le DOM se construit après notre script
    setTimeout(() => {
      if (document.getElementById('actusToolbar') && dash.style.display !== 'none') {
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
