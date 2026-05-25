/* ============================================================
   admin-annonce.js — Éditeur du bandeau d'annonce du site
   ------------------------------------------------------------
   Lit / écrit data/annonce.json via BccoGithub.
   Affiche un aperçu live + 4 types de couleurs + lien optionnel
   + date d'expiration auto.
   ============================================================ */

(function () {
  'use strict';

  const JSON_PATH = 'data/annonce.json';

  const DEFAULT = {
    actif: false,
    type: 'info',
    tag: 'INFO',
    texte: '',
    lien_texte: '',
    lien_url: '',
    date_fin: '',
    fermable: true
  };

  let state = {
    data: Object.assign({}, DEFAULT),
    sha: null
  };

  // ----------------------------------------------------------------
  // CSS (toutes les classes commencent par .an-)
  // ----------------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('admin-annonce-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-annonce-css';
    s.textContent = `
      .an-wrap{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:22px;margin-bottom:24px}
      .an-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
      @media(max-width:900px){.an-grid{grid-template-columns:1fr}}

      .an-field{margin-bottom:14px}
      .an-field label{display:block;font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase}
      .an-field label .opt{text-transform:none;font-weight:500;font-style:italic;opacity:.7}
      .an-field input[type=text],.an-field input[type=date],.an-field input[type=url],.an-field select,.an-field textarea{
        width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px;font-size:14px;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;background:#fff;color:var(--text);
      }
      .an-field textarea{min-height:70px;resize:vertical;line-height:1.5}
      .an-field input:focus,.an-field select:focus,.an-field textarea:focus{border-color:#0A1988;box-shadow:0 0 0 3px rgba(10,25,136,.08)}
      .an-hint{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4}
      .an-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      @media(max-width:540px){.an-row{grid-template-columns:1fr}}

      /* Type picker */
      .an-types{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      @media(max-width:540px){.an-types{grid-template-columns:repeat(2,1fr)}}
      .an-type{padding:10px 6px;border-radius:10px;border:2px solid var(--line);background:#fff;cursor:pointer;font-size:11.5px;font-weight:700;font-family:inherit;text-align:center;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--text)}
      .an-type:hover{transform:translateY(-1px)}
      .an-type .dot{width:16px;height:16px;border-radius:50%}
      .an-type.t-info    .dot{background:linear-gradient(90deg,#1d3fc7,#0A1988)}
      .an-type.t-success .dot{background:linear-gradient(90deg,#16a34a,#15803d)}
      .an-type.t-warning .dot{background:linear-gradient(90deg,#d97706,#b45309)}
      .an-type.t-alert   .dot{background:linear-gradient(90deg,#dc2626,#991b1b)}
      .an-type.on{border-color:#0A1988;background:rgba(10,25,136,.04)}
      .an-type.t-info.on    {border-color:#0A1988}
      .an-type.t-success.on {border-color:#15803d}
      .an-type.t-warning.on {border-color:#b45309}
      .an-type.t-alert.on   {border-color:#991b1b}

      /* Checkbox actif */
      .an-checkbox{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f7f7fa;border-radius:10px;cursor:pointer;border:1px solid transparent}
      .an-checkbox:hover{background:#f0f3fa}
      .an-checkbox.on{background:rgba(165,235,120,.12);border-color:rgba(22,163,74,.3)}
      .an-checkbox input{accent-color:#16a34a;width:16px;height:16px}
      .an-checkbox span{font-size:13px;color:var(--text);font-weight:600}
      .an-checkbox small{display:block;font-size:11.5px;color:var(--muted);font-weight:400;margin-top:2px}

      /* Toolbar */
      .an-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}
      .an-btn{padding:10px 16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;color:var(--text)}
      .an-btn:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(10,25,136,.08)}
      .an-btn.primary{background:linear-gradient(135deg,#A5EB78,#7ed957);border:none;color:#0A1988;font-weight:700}
      .an-btn.danger{border-color:#ef4444;color:#ef4444}
      .an-btn.danger:hover{background:rgba(239,68,68,.06)}
      .an-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .an-btn:disabled{opacity:.55;cursor:wait}
      .an-status{font-size:12px;color:var(--muted);font-style:italic;margin-left:auto}

      /* Preview live */
      .an-preview-wrap{position:sticky;top:90px}
      .an-preview-label{font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:8px;letter-spacing:.06em;text-transform:uppercase;display:flex;align-items:center;gap:6px}
      .an-preview-label::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#A5EB78;box-shadow:0 0 8px rgba(165,235,120,.5);animation:annPulse 1.8s ease-in-out infinite}
      @keyframes annPulse {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.85)}}
      .an-preview-frame{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#f0f3fa}
      .an-preview-nav{height:38px;background:linear-gradient(135deg,#0B1130,#0A1988);display:flex;align-items:center;padding:0 14px;color:#fff;font-size:11px;font-weight:700;letter-spacing:.04em}
      .an-preview-nav::before{content:'';width:18px;height:18px;background:#A5EB78;border-radius:50%;margin-right:8px}
      .an-preview-empty{padding:24px;text-align:center;font-size:12.5px;color:var(--muted);font-style:italic}

      /* Reprise des classes .ann (scopées à .an-preview) pour aperçu visuel */
      .an-preview .ann{position:static;animation:none;color:#fff;font-size:13.5px;line-height:1.4;padding:0;overflow:hidden}
      .an-preview .ann.t-info    {background:linear-gradient(90deg,#1d3fc7 0%,#0A1988 100%)}
      .an-preview .ann.t-success {background:linear-gradient(90deg,#16a34a 0%,#15803d 100%)}
      .an-preview .ann.t-warning {background:linear-gradient(90deg,#d97706 0%,#b45309 100%)}
      .an-preview .ann.t-alert   {background:linear-gradient(90deg,#dc2626 0%,#991b1b 100%)}
      .an-preview .ann-inner{max-width:1200px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;gap:12px}
      .an-preview .ann-icon{width:20px;height:20px;flex-shrink:0;stroke:rgba(255,255,255,.95);fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
      .an-preview .ann-content{flex:1;min-width:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .an-preview .ann-tag{background:rgba(255,255,255,.18);color:#fff;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:6px;white-space:nowrap}
      .an-preview .ann-text{color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1;font-weight:500}
      .an-preview .ann-link{color:#fff;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.5);padding-bottom:1px;font-weight:700;white-space:nowrap;font-size:12.5px;flex-shrink:0}
      .an-preview .ann-close{background:transparent;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:20px;line-height:1;padding:4px 8px;flex-shrink:0;border-radius:6px}
    `;
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------------
  // Rendu du panneau (remplace le placeholder dans l'admin)
  // ----------------------------------------------------------------
  function replaceUI() {
    const slot = document.getElementById('annonceSlot');
    if (!slot) return false;

    slot.innerHTML = `
      <div class="an-wrap">
        <div class="an-grid">
          <!-- Colonne gauche : form -->
          <div>
            <div class="an-field">
              <label class="an-checkbox" id="an-actif-label">
                <input type="checkbox" id="an-actif"/>
                <div>
                  <span>Publier l'annonce</span>
                  <small>Si décoché : le bandeau ne s'affiche pas sur le site.</small>
                </div>
              </label>
            </div>

            <div class="an-field">
              <label>Couleur / ton du message</label>
              <div class="an-types" id="an-types">
                <button type="button" class="an-type t-info"    data-type="info"><span class="dot"></span>Info</button>
                <button type="button" class="an-type t-success" data-type="success"><span class="dot"></span>Bonne nouvelle</button>
                <button type="button" class="an-type t-warning" data-type="warning"><span class="dot"></span>Attention</button>
                <button type="button" class="an-type t-alert"   data-type="alert"><span class="dot"></span>Urgent</button>
              </div>
              <div class="an-hint">Choisis le ton selon le contexte. Ex. : <strong>Bonne nouvelle</strong> pour ouverture inscriptions, <strong>Attention</strong> pour fin de saison, <strong>Urgent</strong> pour fermeture du club.</div>
            </div>

            <div class="an-row">
              <div class="an-field">
                <label for="an-tag">Étiquette <span class="opt">(courte, en majuscules)</span></label>
                <input type="text" id="an-tag" maxlength="18" placeholder="ex: INFO, INSCRIPTIONS, FERMÉ"/>
              </div>
              <div class="an-field">
                <label for="an-date-fin">Disparition automatique <span class="opt">(facultatif)</span></label>
                <input type="date" id="an-date-fin"/>
                <div class="an-hint">Si renseignée, l'annonce disparaît seule après cette date.</div>
              </div>
            </div>

            <div class="an-field">
              <label for="an-texte">Message <span style="color:#ef4444">*</span></label>
              <textarea id="an-texte" maxlength="220" placeholder="ex: Le club sera fermé le lundi 1er mai (jour férié). Les cours reprennent normalement le mardi."></textarea>
              <div class="an-hint">Phrase courte et claire (1-2 lignes max). <span id="an-count">0</span>/220 caractères.</div>
            </div>

            <div class="an-row">
              <div class="an-field">
                <label for="an-lien-texte">Texte du lien <span class="opt">(facultatif)</span></label>
                <input type="text" id="an-lien-texte" placeholder="ex: S'inscrire, En savoir plus"/>
              </div>
              <div class="an-field">
                <label for="an-lien-url">URL du lien <span class="opt">(facultatif)</span></label>
                <input type="url" id="an-lien-url" placeholder="https://… ou /seance-essai.html"/>
              </div>
            </div>

            <div class="an-field">
              <label class="an-checkbox" id="an-fermable-label">
                <input type="checkbox" id="an-fermable"/>
                <div>
                  <span>Visiteur peut fermer le bandeau</span>
                  <small>Recommandé. Décoche uniquement pour les annonces critiques que tout le monde doit lire.</small>
                </div>
              </label>
            </div>
          </div>

          <!-- Colonne droite : preview -->
          <div class="an-preview-wrap">
            <div class="an-preview-label">Aperçu en direct</div>
            <div class="an-preview-frame">
              <div class="an-preview-nav">Barre de navigation du site</div>
              <div class="an-preview" id="an-preview">
                <div class="an-preview-empty">Coche "Publier" pour activer l'aperçu.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="an-toolbar">
          <button type="button" class="an-btn primary" id="an-save">
            <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Publier
          </button>
          <button type="button" class="an-btn danger" id="an-clear">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Vider et désactiver
          </button>
          <button type="button" class="an-btn" id="an-reload">
            <svg viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Recharger
          </button>
          <span class="an-status" id="an-status">Chargement…</span>
        </div>
      </div>
    `;

    // Listeners
    document.getElementById('an-save').addEventListener('click', save);
    document.getElementById('an-clear').addEventListener('click', clearAll);
    document.getElementById('an-reload').addEventListener('click', reload);

    const inputs = ['an-actif','an-tag','an-date-fin','an-texte','an-lien-texte','an-lien-url','an-fermable'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', readAndPreview);
      el.addEventListener('change', readAndPreview);
    });

    document.querySelectorAll('#an-types .an-type').forEach(btn => {
      btn.addEventListener('click', () => {
        state.data.type = btn.dataset.type;
        document.querySelectorAll('#an-types .an-type').forEach(b => b.classList.toggle('on', b === btn));
        renderPreview();
      });
    });

    return true;
  }

  // ----------------------------------------------------------------
  // Lecture du formulaire vers state.data + preview
  // ----------------------------------------------------------------
  function readAndPreview() {
    state.data.actif      = document.getElementById('an-actif').checked;
    state.data.tag        = document.getElementById('an-tag').value.trim();
    state.data.date_fin   = document.getElementById('an-date-fin').value;
    state.data.texte      = document.getElementById('an-texte').value;
    state.data.lien_texte = document.getElementById('an-lien-texte').value.trim();
    state.data.lien_url   = document.getElementById('an-lien-url').value.trim();
    state.data.fermable   = document.getElementById('an-fermable').checked;

    document.getElementById('an-actif-label').classList.toggle('on', state.data.actif);
    document.getElementById('an-fermable-label').classList.toggle('on', state.data.fermable);
    document.getElementById('an-count').textContent = state.data.texte.length;

    renderPreview();
  }

  // ----------------------------------------------------------------
  // Form ← state.data
  // ----------------------------------------------------------------
  function writeForm() {
    document.getElementById('an-actif').checked     = !!state.data.actif;
    document.getElementById('an-tag').value         = state.data.tag || '';
    document.getElementById('an-date-fin').value    = state.data.date_fin || '';
    document.getElementById('an-texte').value       = state.data.texte || '';
    document.getElementById('an-lien-texte').value  = state.data.lien_texte || '';
    document.getElementById('an-lien-url').value    = state.data.lien_url || '';
    document.getElementById('an-fermable').checked  = state.data.fermable !== false;

    document.getElementById('an-actif-label').classList.toggle('on', !!state.data.actif);
    document.getElementById('an-fermable-label').classList.toggle('on', state.data.fermable !== false);
    document.getElementById('an-count').textContent = (state.data.texte || '').length;

    const type = ['info','success','warning','alert'].includes(state.data.type) ? state.data.type : 'info';
    state.data.type = type;
    document.querySelectorAll('#an-types .an-type').forEach(b => b.classList.toggle('on', b.dataset.type === type));

    renderPreview();
  }

  // ----------------------------------------------------------------
  // Preview live
  // ----------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function iconFor(type) {
    switch (type) {
      case 'success': return '<svg class="ann-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      case 'warning': return '<svg class="ann-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      case 'alert':   return '<svg class="ann-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      default:        return '<svg class="ann-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
  }

  function renderPreview() {
    const el = document.getElementById('an-preview');
    if (!el) return;
    const d = state.data;
    if (!d.actif || !d.texte.trim()) {
      el.innerHTML = `<div class="an-preview-empty">${d.actif ? 'Tape un message pour voir l\'aperçu.' : 'Coche "Publier" pour activer l\'aperçu.'}</div>`;
      return;
    }
    const type = ['info','success','warning','alert'].includes(d.type) ? d.type : 'info';
    el.innerHTML = `
      <div class="ann t-${type}" style="position:static;animation:none">
        <div class="ann-inner">
          ${iconFor(type)}
          ${d.tag ? `<span class="ann-tag">${escapeHtml(d.tag)}</span>` : ''}
          <span class="ann-content">
            <span class="ann-text">${escapeHtml(d.texte)}</span>
            ${d.lien_url && d.lien_texte ? `<a href="#" class="ann-link" onclick="return false">${escapeHtml(d.lien_texte)} →</a>` : ''}
          </span>
          ${d.fermable !== false ? '<button type="button" class="ann-close" aria-label="Fermer">&times;</button>' : ''}
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------------
  // GitHub I/O
  // ----------------------------------------------------------------
  function setStatus(msg) {
    const el = document.getElementById('an-status');
    if (el) el.textContent = msg;
  }

  async function reload() {
    try {
      setStatus('Chargement depuis GitHub…');
      const f = await BccoGithub.readFile(JSON_PATH);
      let parsed;
      try { parsed = JSON.parse(f.content); }
      catch (_) { parsed = Object.assign({}, DEFAULT); }
      state.data = Object.assign({}, DEFAULT, parsed);
      state.sha = f.sha;
      writeForm();
      setStatus(state.data.actif ? 'Annonce active' : 'Annonce désactivée');
    } catch (e) {
      // Si le fichier n'existe pas encore, on bosse en local
      if (/introuvable/i.test(e.message)) {
        state.data = Object.assign({}, DEFAULT);
        state.sha = null;
        writeForm();
        setStatus('Aucune annonce existante. Renseigne et publie pour créer.');
      } else {
        BccoGithub.toast('Erreur : ' + e.message, 'err');
        setStatus('');
      }
    }
  }

  async function save() {
    // Validation
    if (state.data.actif && !state.data.texte.trim()) {
      BccoGithub.toast('Le message est obligatoire pour publier une annonce.', 'err');
      return;
    }
    if (state.data.lien_url && !state.data.lien_texte) {
      BccoGithub.toast('Ajoute aussi un texte de lien (ou retire l\'URL).', 'err');
      return;
    }
    if (state.data.lien_texte && !state.data.lien_url) {
      BccoGithub.toast('Ajoute aussi une URL (ou retire le texte du lien).', 'err');
      return;
    }

    const btn = document.getElementById('an-save');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Publication…';

    try {
      const payload = {
        actif: !!state.data.actif,
        type: state.data.type || 'info',
        tag: state.data.tag || '',
        texte: state.data.texte.trim(),
        lien_texte: state.data.lien_texte || '',
        lien_url: state.data.lien_url || '',
        date_fin: state.data.date_fin || '',
        fermable: state.data.fermable !== false
      };
      const json = JSON.stringify(payload, null, 2) + '\n';
      const msg = state.data.actif
        ? `Annonce site : ${payload.texte.slice(0, 60)}${payload.texte.length > 60 ? '…' : ''}`
        : 'Désactivation annonce site';
      const res = await BccoGithub.writeFile(JSON_PATH, json, msg, state.sha);
      state.sha = res.content && res.content.sha;
      BccoGithub.toast(state.data.actif ? 'Annonce publiée !' : 'Annonce désactivée.', 'ok');
      setStatus(state.data.actif ? 'Annonce active · ' + new Date().toLocaleTimeString('fr-FR') : 'Annonce désactivée');
    } catch (e) {
      BccoGithub.toast('Erreur : ' + e.message, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  async function clearAll() {
    if (!confirm('Vider le contenu et désactiver l\'annonce ? Le bandeau disparaîtra du site après publication.')) return;
    state.data = Object.assign({}, DEFAULT);
    writeForm();
    await save();
  }

  // ----------------------------------------------------------------
  // Init (attend que le dashboard et le slot soient visibles)
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
    if (dash.style.display !== 'none' && document.getElementById('annonceSlot')) {
      init();
      return;
    }
    const obs = new MutationObserver(() => {
      if (dash.style.display !== 'none' && document.getElementById('annonceSlot')) {
        obs.disconnect();
        init();
      }
    });
    obs.observe(dash, { attributes: true, attributeFilter: ['style'] });
    setTimeout(() => {
      if (document.getElementById('annonceSlot') && dash.style.display !== 'none') {
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
