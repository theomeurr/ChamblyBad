/* ============================================================
   admin-effectifs.js — Gestion complète des effectifs licenciés
   ------------------------------------------------------------
   Tableau filtrable + recherche + édition modale + ajout/suppression.
   Persistence via commit GitHub API sur data/effectifs.csv.
   ============================================================ */

(function () {
  'use strict';

  const CSV_PATH = 'data/effectifs.csv';
  const HEADERS  = ['equipe', 'nom', 'prenom', 'simple', 'double', 'mixte', 'capitaine', 'actif'];

  // Familles d'équipes connues (clé canonique → label affiché)
  const EQUIPE_LABELS = {
    top12: 'Top 12',
    n1: 'Nationale 1', n2: 'Nationale 2', n3: 'Nationale 3',
    r1: 'Régionale 1', r2: 'Régionale 2', r3: 'Régionale 3',
    r4: 'Régionale 4', r5: 'Régionale 5', r6: 'Régionale 6',
    d1: 'Départemental 1', d2: 'Départemental 2', d3: 'Départemental 3',
    d4: 'Départemental 4', d5: 'Départemental 5', d6: 'Départemental 6',
    d7: 'Départemental 7', d8: 'Départemental 8', d9: 'Départemental 9',
    icd: 'ICD',
    oise: 'Oise',
    jeunes: 'Jeunes',
    region: 'Régionale'
  };
  const NIVEAUX = ['', 'N1', 'N2', 'N3', 'R4', 'R5', 'R6', 'D7', 'D8', 'D9', 'P10', 'P11', 'P12', 'NC'];

  // Retourne un label lisible pour n'importe quel code d'équipe
  function labelForEquipe(code) {
    const c = (code || '').toLowerCase().trim();
    if (EQUIPE_LABELS[c]) return EQUIPE_LABELS[c];
    // Pattern auto : n2 → Nationale 2, r4 → Régionale 4, d8 → Départemental 8
    const m = c.match(/^([nrd])(\d+)$/);
    if (m) {
      const fam = { n: 'Nationale', r: 'Régionale', d: 'Départemental' }[m[1]];
      return `${fam} ${m[2]}`;
    }
    // Fallback : on retourne la valeur en majuscules
    return (code || '—').toUpperCase();
  }

  // Famille de couleur pour le badge (top, n, r, d, icd, oise, jeunes, autre)
  function familyForEquipe(code) {
    const c = (code || '').toLowerCase().trim();
    if (c === 'top12') return 'top12';
    if (c === 'icd')   return 'icd';
    if (c === 'oise')  return 'oise';
    if (c === 'jeunes') return 'jeunes';
    if (c === 'region') return 'fam-r';
    const m = c.match(/^([nrd])(\d+)$/);
    if (m) return 'fam-' + m[1];
    return 'fam-other';
  }

  let state = {
    headers: HEADERS.slice(),
    rows: [],
    sha: null,
    filterEquipe: 'all',
    search: '',
    sortBy: 'nom',
    editingIndex: -1
  };

  // ----------------------------------------------------------------
  // CSS
  // ----------------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('admin-eff-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-eff-css';
    s.textContent = `
      .ef-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
      .ef-toolbar input[type=search]{padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:13px;font-family:inherit;outline:none;min-width:200px;background:var(--surface)}
      .ef-toolbar input[type=search]:focus{border-color:#0A1988}
      .ef-toolbar select{padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:var(--surface);cursor:pointer}
      .ef-toolbar select:focus{border-color:#0A1988}

      .ef-btn{padding:10px 16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s;color:var(--text)}
      .ef-btn:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(10,25,136,.08)}
      .ef-btn.primary{background:linear-gradient(135deg,#A5EB78,#7ed957);border:none;color:#0A1988;font-weight:700}
      .ef-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .ef-status{font-size:12px;color:var(--muted);font-style:italic;margin-left:auto}

      .ef-table-wrap{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:16px}
      .ef-table{width:100%;border-collapse:collapse;font-size:13px}
      .ef-table thead{background:#f7f7fa}
      .ef-table th{padding:11px 12px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none}
      .ef-table th:hover{color:#0A1988}
      .ef-table th.sorted{color:#0A1988}
      .ef-table th.sorted::after{content:'';margin-left:4px;display:inline-block;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid #0A1988;vertical-align:middle}
      .ef-table th.sorted.desc::after{border-top:none;border-bottom:5px solid #0A1988}
      .ef-table td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
      .ef-table tr:last-child td{border-bottom:0}
      .ef-table tr:hover td{background:rgba(165,235,120,.05)}
      .ef-table tr.inactif td{opacity:.45}

      .ef-equipe-badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.04em;white-space:nowrap}
      /* Top 12 : vert fluo */
      .ef-equipe-badge.top12{background:rgba(165,235,120,.18);color:#15803d}
      /* Nationale (N1-N3) : orange */
      .ef-equipe-badge.fam-n{background:rgba(245,158,11,.14);color:#b45309}
      /* Régionale (R1-R6) : bleu */
      .ef-equipe-badge.fam-r{background:rgba(10,25,136,.10);color:#0A1988}
      /* Départemental (D1-D9) : violet/indigo */
      .ef-equipe-badge.fam-d{background:rgba(99,102,241,.14);color:#4338ca}
      /* ICD : cyan */
      .ef-equipe-badge.icd{background:rgba(14,165,233,.14);color:#0369a1}
      /* Oise : rose */
      .ef-equipe-badge.oise{background:rgba(236,72,153,.12);color:#be185d}
      /* Jeunes : magenta */
      .ef-equipe-badge.jeunes{background:rgba(217,70,239,.12);color:#86198f}
      /* Fallback */
      .ef-equipe-badge.fam-other{background:rgba(100,116,139,.14);color:#475569}

      .ef-classement{font-family:'Open Sans',monospace;font-weight:600;font-size:12px;color:var(--secondary)}
      .ef-classement.empty{color:var(--muted);font-weight:400;font-style:italic}

      .ef-toggle{position:relative;display:inline-block;width:36px;height:20px;cursor:pointer}
      .ef-toggle input{opacity:0;width:0;height:0}
      .ef-toggle .slider{position:absolute;inset:0;background:#d1d5db;border-radius:999px;transition:background .2s}
      .ef-toggle .slider::before{content:'';position:absolute;width:16px;height:16px;left:2px;bottom:2px;background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 2px 4px rgba(0,0,0,.18)}
      .ef-toggle input:checked + .slider{background:#16a34a}
      .ef-toggle input:checked + .slider::before{transform:translateX(16px)}

      .ef-actions{display:flex;gap:5px;flex-wrap:nowrap}
      .ef-action-btn{padding:5px 9px;border-radius:6px;border:1px solid var(--line);background:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--text);display:inline-flex;align-items:center;gap:4px}
      .ef-action-btn:hover{border-color:#0A1988;color:#0A1988}
      .ef-action-btn.danger:hover{border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.04)}
      .ef-action-btn svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2}

      .ef-capitaine{font-size:14px}
      .ef-empty{padding:36px 20px;text-align:center;color:var(--muted);font-size:13px}

      /* Modal édition (réutilise les classes ae- mais préfixées ef-) */
      .ef-modal-bg{position:fixed;inset:0;background:rgba(11,17,48,.6);backdrop-filter:blur(4px);z-index:400;display:none;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
      .ef-modal-bg.show{display:flex}
      .ef-modal{background:#fff;border-radius:20px;max-width:560px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.3)}
      .ef-modal-head{padding:22px 26px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-start;gap:14px;position:sticky;top:0;background:#fff;border-radius:20px 20px 0 0;z-index:2}
      .ef-modal-head h3{font-family:'Anton',sans-serif;font-weight:400;font-size:20px;color:var(--text)}
      .ef-modal-head p{font-size:12px;color:var(--muted);margin-top:4px}
      .ef-modal-close{background:none;border:none;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:18px}
      .ef-modal-close:hover{background:#f0f3fa;color:var(--text)}
      .ef-modal-body{padding:18px 26px 6px}
      .ef-modal-foot{padding:14px 26px 18px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}

      .ef-field{margin-bottom:13px}
      .ef-field label{display:block;font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:5px;letter-spacing:.04em;text-transform:uppercase}
      .ef-field input,.ef-field select{width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;color:var(--text);transition:border-color .2s,box-shadow .2s}
      .ef-field input:focus,.ef-field select:focus{border-color:#0A1988;box-shadow:0 0 0 3px rgba(10,25,136,.08)}
      .ef-row3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .ef-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}

      .ef-checkbox{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f7f7fa;border-radius:10px;cursor:pointer;border:1px solid transparent;margin-bottom:10px}
      .ef-checkbox:hover{background:#f0f3fa}
      .ef-checkbox.on{background:rgba(165,235,120,.12);border-color:rgba(22,163,74,.3)}
      .ef-checkbox input{accent-color:#16a34a;width:16px;height:16px}
      .ef-checkbox span{font-size:13px;color:var(--text);font-weight:500}

      @media(max-width:640px){
        .ef-table th:nth-child(n+5),.ef-table td:nth-child(n+5){display:none}
        .ef-row3,.ef-row2{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------------
  // Injection de la section dans le dashboard
  // ----------------------------------------------------------------
  function mountSection() {
    const dash = document.getElementById('dashboard');
    if (!dash || document.getElementById('ef-section')) return false;

    injectCSS();

    const section = document.createElement('section');
    section.id = 'ef-section';
    section.innerHTML = `
      <h3 class="section-title" style="margin-top:32px">Effectifs licenciés</h3>
      <p class="section-sub">
        Gestion directe des licenciés actifs du club. Les modifications sont publiées en commit
        sur <code>data/effectifs.csv</code>.
      </p>
      <div class="ef-toolbar">
        <button type="button" class="ef-btn primary" id="ef-new">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Nouveau licencié
        </button>
        <select id="ef-filter-equipe">
          <option value="all">Toutes équipes</option>
        </select>
        <input type="search" id="ef-search" placeholder="Rechercher nom, prénom…" />
        <button type="button" class="ef-btn" id="ef-reload">
          <svg viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Recharger
        </button>
        <span class="ef-status" id="ef-status">Chargement…</span>
      </div>
      <div class="ef-table-wrap">
        <table class="ef-table">
          <thead>
            <tr>
              <th data-sort="equipe">Équipe</th>
              <th data-sort="nom" class="sorted">Nom</th>
              <th data-sort="prenom">Prénom</th>
              <th>Simple</th>
              <th>Double</th>
              <th>Mixte</th>
              <th>Cap.</th>
              <th>Actif</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="ef-body">
            <tr><td colspan="9" class="ef-empty">Chargement des effectifs…</td></tr>
          </tbody>
        </table>
      </div>
    `;

    // L'ajouter avant le bouton diagnostic s'il existe, sinon en fin
    const diagBtn = document.getElementById('dg-btn-wrap');
    if (diagBtn) dash.insertBefore(section, diagBtn);
    else dash.appendChild(section);

    // Listeners
    document.getElementById('ef-new').addEventListener('click', () => openEditor(-1));
    document.getElementById('ef-reload').addEventListener('click', reload);
    document.getElementById('ef-filter-equipe').addEventListener('change', (e) => {
      state.filterEquipe = e.target.value;
      renderList();
    });
    document.getElementById('ef-search').addEventListener('input', (e) => {
      state.search = e.target.value.trim().toLowerCase();
      renderList();
    });
    document.querySelectorAll('.ef-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sortBy === key) state.sortBy = '-' + key;
        else if (state.sortBy === '-' + key) state.sortBy = key;
        else state.sortBy = key;
        renderList();
      });
    });

    return true;
  }

  // ----------------------------------------------------------------
  // Chargement
  // ----------------------------------------------------------------
  function setStatus(msg) {
    const el = document.getElementById('ef-status');
    if (el) el.textContent = msg;
  }

  async function reload() {
    try {
      setStatus('Chargement depuis GitHub…');
      const f = await BccoGithub.readFile(CSV_PATH);
      const parsed = BccoGithub.parseCSV(f.content);
      state.headers = parsed.headers.length ? parsed.headers : HEADERS.slice();
      state.rows = parsed.rows;
      state.sha = f.sha;
      refreshFilterOptions();
      renderList();
      setStatus(`${state.rows.length} licencié${state.rows.length > 1 ? 's' : ''} chargé${state.rows.length > 1 ? 's' : ''}`);
    } catch (e) {
      setStatus('');
      BccoGithub.toast('Erreur : ' + e.message, 'err');
    }
  }

  // Reconstruit la liste des équipes du filtre + datalist du modal
  // à partir des codes effectivement présents dans les données.
  function refreshFilterOptions() {
    const codes = new Set();
    state.rows.forEach(r => {
      const c = (r.equipe || '').toLowerCase().trim();
      if (c) codes.add(c);
    });
    // Tri par famille (top12 > N > R > D > autres) puis numérique
    const sorted = [...codes].sort((a, b) => {
      const rank = (c) => {
        if (c === 'top12') return [0, 0];
        if (c === 'icd')   return [5, 0];
        if (c === 'oise')  return [6, 0];
        if (c === 'jeunes') return [7, 0];
        const m = c.match(/^([nrd])(\d+)$/);
        if (m) {
          const family = { n: 1, r: 2, d: 3 }[m[1]];
          return [family, parseInt(m[2], 10)];
        }
        return [9, 0];
      };
      const ra = rank(a), rb = rank(b);
      if (ra[0] !== rb[0]) return ra[0] - rb[0];
      return ra[1] - rb[1];
    });

    const sel = document.getElementById('ef-filter-equipe');
    if (sel) {
      const current = sel.value;
      sel.innerHTML = `<option value="all">Toutes équipes (${state.rows.length})</option>` +
        sorted.map(c => {
          const count = state.rows.filter(r => (r.equipe || '').toLowerCase() === c).length;
          return `<option value="${escape(c)}">${escape(labelForEquipe(c))} (${count})</option>`;
        }).join('');
      // Garder la sélection si elle existe toujours
      if ([...sel.options].some(o => o.value === current)) sel.value = current;
    }

    // Datalist pour suggestions dans le modal
    let dl = document.getElementById('ef-equipes-list');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'ef-equipes-list';
      document.body.appendChild(dl);
    }
    // On combine codes observés + tous les codes connus
    const allCodes = new Set([...codes, ...Object.keys(EQUIPE_LABELS)]);
    dl.innerHTML = [...allCodes].sort().map(c => `<option value="${escape(c)}">${escape(labelForEquipe(c))}</option>`).join('');
  }

  async function commit(message) {
    const csv = BccoGithub.serializeCSV(state.rows, state.headers);
    setStatus('Publication en cours…');
    const res = await BccoGithub.writeFile(CSV_PATH, csv, message, state.sha);
    state.sha = res.content && res.content.sha;
    setStatus('Publié ! ' + new Date().toLocaleTimeString('fr-FR'));
  }

  // ----------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------
  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function filterAndSort() {
    let list = state.rows.map((r, i) => ({ r, i }));
    if (state.filterEquipe !== 'all') {
      list = list.filter(({ r }) => (r.equipe || '').toLowerCase() === state.filterEquipe);
    }
    if (state.search) {
      list = list.filter(({ r }) => {
        const blob = `${r.nom || ''} ${r.prenom || ''} ${r.equipe || ''}`.toLowerCase();
        return blob.includes(state.search);
      });
    }
    const desc = state.sortBy.startsWith('-');
    const key = desc ? state.sortBy.slice(1) : state.sortBy;
    list.sort((a, b) => {
      const va = String(a.r[key] || '').toLowerCase();
      const vb = String(b.r[key] || '').toLowerCase();
      return desc ? vb.localeCompare(va) : va.localeCompare(vb);
    });
    return list;
  }

  function renderList() {
    const tbody = document.getElementById('ef-body');
    if (!tbody) return;
    // Indicateur de tri visuel
    document.querySelectorAll('.ef-table th[data-sort]').forEach(th => {
      th.classList.remove('sorted', 'desc');
    });
    const desc = state.sortBy.startsWith('-');
    const key = desc ? state.sortBy.slice(1) : state.sortBy;
    const activeTh = document.querySelector(`.ef-table th[data-sort="${key}"]`);
    if (activeTh) {
      activeTh.classList.add('sorted');
      if (desc) activeTh.classList.add('desc');
    }

    const list = filterAndSort();
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="ef-empty">Aucun licencié trouvé${state.search || state.filterEquipe !== 'all' ? ' pour ce filtre' : ''}.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(({ r, i }) => {
      const actif = (r.actif || '').toLowerCase() === 'x';
      const cap = (r.capitaine || '').toLowerCase() === 'x';
      const eqCode = (r.equipe || '').toLowerCase();
      const eqLabel = labelForEquipe(r.equipe);
      const eqFamily = familyForEquipe(r.equipe);
      const cls = (v) => v ? `<span class="ef-classement">${escape(v)}</span>` : `<span class="ef-classement empty">—</span>`;

      return `
        <tr class="${actif ? '' : 'inactif'}" data-idx="${i}">
          <td><span class="ef-equipe-badge ${eqFamily}" title="${escape(eqCode)}">${escape(eqLabel)}</span></td>
          <td style="font-weight:600">${escape(r.nom || '')}</td>
          <td>${escape(r.prenom || '')}</td>
          <td>${cls(r.simple)}</td>
          <td>${cls(r.double)}</td>
          <td>${cls(r.mixte)}</td>
          <td><span class="ef-capitaine" title="${cap ? 'Capitaine' : ''}">${cap ? '⭐' : ''}</span></td>
          <td>
            <label class="ef-toggle" title="Toggle actif/inactif">
              <input type="checkbox" data-toggle-actif="${i}" ${actif ? 'checked' : ''} />
              <span class="slider"></span>
            </label>
          </td>
          <td>
            <div class="ef-actions" style="justify-content:flex-end">
              <button type="button" class="ef-action-btn" data-edit="${i}">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
                Éditer
              </button>
              <button type="button" class="ef-action-btn danger" data-del="${i}">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEditor(parseInt(b.dataset.edit, 10))));
    tbody.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => confirmDelete(parseInt(b.dataset.del, 10))));
    tbody.querySelectorAll('[data-toggle-actif]').forEach(cb =>
      cb.addEventListener('change', () => toggleActif(parseInt(cb.dataset.toggleActif, 10), cb.checked)));
  }

  // ----------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------
  async function toggleActif(index, on) {
    const r = state.rows[index];
    if (!r) return;
    const prev = r.actif;
    r.actif = on ? 'x' : '';
    try {
      await commit(`${on ? 'Activation' : 'Désactivation'} licencié : ${r.prenom} ${r.nom}`);
      BccoGithub.toast(`${r.prenom} ${r.nom} ${on ? 'activé' : 'désactivé'}`, 'ok');
      renderList();
    } catch (e) {
      r.actif = prev;
      BccoGithub.toast('Erreur : ' + e.message, 'err');
      renderList();
    }
  }

  async function confirmDelete(index) {
    const r = state.rows[index];
    if (!r) return;
    if (!confirm(`Supprimer définitivement ${r.prenom} ${r.nom} ?\n\nIl sera retiré du fichier CSV après publication.`)) return;
    state.rows.splice(index, 1);
    try {
      await commit(`Suppression licencié : ${r.prenom} ${r.nom}`);
      BccoGithub.toast('Licencié supprimé', 'ok');
      renderList();
    } catch (e) {
      state.rows.splice(index, 0, r);
      BccoGithub.toast('Erreur : ' + e.message, 'err');
      renderList();
    }
  }

  // ----------------------------------------------------------------
  // Modal éditeur
  // ----------------------------------------------------------------
  let modalEl = null;
  function buildModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'ef-modal-bg';
    const nivOptions = NIVEAUX.map(n => `<option value="${n}">${n || '—'}</option>`).join('');
    modalEl.innerHTML = `
      <div class="ef-modal" role="dialog" aria-modal="true">
        <div class="ef-modal-head">
          <div>
            <h3 id="ef-modal-title">Nouveau licencié</h3>
            <p>Les modifications sont publiées en commit sur GitHub.</p>
          </div>
          <button type="button" class="ef-modal-close" id="ef-modal-close">&times;</button>
        </div>
        <div class="ef-modal-body">
          <div class="ef-row2">
            <div class="ef-field">
              <label for="ef-f-equipe">Équipe <span style="color:#ef4444">*</span></label>
              <input type="text" id="ef-f-equipe" list="ef-equipes-list" placeholder="top12, n2, r2, d3, icd…" autocomplete="off" />
              <div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4">Codes : top12, n1-n3, r1-r6, d1-d9, icd, oise, jeunes</div>
            </div>
            <div class="ef-field">
              <label>Capitaine ?</label>
              <label class="ef-checkbox" id="ef-cap-label" style="margin:0">
                <input type="checkbox" id="ef-f-capitaine" />
                <span>Désigner comme capitaine</span>
              </label>
            </div>
          </div>
          <div class="ef-row2">
            <div class="ef-field">
              <label for="ef-f-nom">Nom <span style="color:#ef4444">*</span></label>
              <input type="text" id="ef-f-nom" placeholder="DUPONT" />
            </div>
            <div class="ef-field">
              <label for="ef-f-prenom">Prénom <span style="color:#ef4444">*</span></label>
              <input type="text" id="ef-f-prenom" placeholder="Jean" />
            </div>
          </div>
          <div class="ef-row3">
            <div class="ef-field">
              <label for="ef-f-simple">Simple</label>
              <select id="ef-f-simple">${nivOptions}</select>
            </div>
            <div class="ef-field">
              <label for="ef-f-double">Double</label>
              <select id="ef-f-double">${nivOptions}</select>
            </div>
            <div class="ef-field">
              <label for="ef-f-mixte">Mixte</label>
              <select id="ef-f-mixte">${nivOptions}</select>
            </div>
          </div>
          <div class="ef-field">
            <label class="ef-checkbox" id="ef-actif-label" style="margin-top:6px">
              <input type="checkbox" id="ef-f-actif" checked />
              <span>Licencié actif (visible dans les listes du site)</span>
            </label>
          </div>
        </div>
        <div class="ef-modal-foot">
          <button type="button" class="ef-btn" id="ef-cancel-btn">Annuler</button>
          <button type="button" class="ef-btn primary" id="ef-save-btn">
            <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/></svg>
            Enregistrer
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modalEl.querySelector('#ef-modal-close').addEventListener('click', closeEditor);
    modalEl.querySelector('#ef-cancel-btn').addEventListener('click', closeEditor);
    modalEl.querySelector('#ef-save-btn').addEventListener('click', saveEditor);

    // Style checkboxes
    const cbActif = modalEl.querySelector('#ef-f-actif');
    const lblActif = modalEl.querySelector('#ef-actif-label');
    cbActif.addEventListener('change', () => lblActif.classList.toggle('on', cbActif.checked));
    lblActif.classList.toggle('on', cbActif.checked);

    const cbCap = modalEl.querySelector('#ef-f-capitaine');
    const lblCap = modalEl.querySelector('#ef-cap-label');
    cbCap.addEventListener('change', () => lblCap.classList.toggle('on', cbCap.checked));

    return modalEl;
  }

  function openEditor(index) {
    buildModal();
    state.editingIndex = index;
    const isNew = index < 0;
    const row = isNew ? {} : state.rows[index];

    modalEl.querySelector('#ef-modal-title').textContent = isNew ? 'Nouveau licencié' : 'Modifier licencié';
    modalEl.querySelector('#ef-f-equipe').value    = (row.equipe || 'top12').toLowerCase();
    modalEl.querySelector('#ef-f-nom').value       = row.nom || '';
    modalEl.querySelector('#ef-f-prenom').value    = row.prenom || '';
    modalEl.querySelector('#ef-f-simple').value    = row.simple || '';
    modalEl.querySelector('#ef-f-double').value    = row.double || '';
    modalEl.querySelector('#ef-f-mixte').value     = row.mixte || '';

    const cap = (row.capitaine || '').toLowerCase() === 'x';
    modalEl.querySelector('#ef-f-capitaine').checked = cap;
    modalEl.querySelector('#ef-cap-label').classList.toggle('on', cap);

    const actif = isNew ? true : (String(row.actif || '').toLowerCase() === 'x');
    modalEl.querySelector('#ef-f-actif').checked = actif;
    modalEl.querySelector('#ef-actif-label').classList.toggle('on', actif);

    modalEl.classList.add('show');
  }

  function closeEditor() {
    if (modalEl) modalEl.classList.remove('show');
    state.editingIndex = -1;
  }

  function readForm() {
    return {
      equipe:    modalEl.querySelector('#ef-f-equipe').value.trim().toLowerCase(),
      nom:       modalEl.querySelector('#ef-f-nom').value.trim(),
      prenom:    modalEl.querySelector('#ef-f-prenom').value.trim(),
      simple:    modalEl.querySelector('#ef-f-simple').value.trim(),
      double:    modalEl.querySelector('#ef-f-double').value.trim(),
      mixte:     modalEl.querySelector('#ef-f-mixte').value.trim(),
      capitaine: modalEl.querySelector('#ef-f-capitaine').checked ? 'x' : '',
      actif:     modalEl.querySelector('#ef-f-actif').checked ? 'x' : ''
    };
  }

  async function saveEditor() {
    const data = readForm();
    if (!data.equipe) { BccoGithub.toast('Choisis une équipe (top12, n2, r2, d3…)', 'err'); return; }
    if (!data.nom)    { BccoGithub.toast('Le nom est obligatoire', 'err'); return; }
    if (!data.prenom) { BccoGithub.toast('Le prénom est obligatoire', 'err'); return; }

    const btn = modalEl.querySelector('#ef-save-btn');
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Publication…';

    try {
      const fullRow = {};
      state.headers.forEach(h => fullRow[h] = data[h] != null ? data[h] : '');

      const isNew = state.editingIndex < 0;
      if (isNew) state.rows.push(fullRow);
      else state.rows[state.editingIndex] = fullRow;

      await commit(isNew ? `Nouveau licencié : ${data.prenom} ${data.nom}` : `Modif licencié : ${data.prenom} ${data.nom}`);
      BccoGithub.toast(isNew ? 'Licencié ajouté !' : 'Licencié mis à jour !', 'ok');
      renderList();
      closeEditor();
    } catch (e) {
      BccoGithub.toast('Erreur : ' + e.message, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
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
