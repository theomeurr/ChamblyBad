/* ============================================================
   admin-diagnostic.js — Diagnostic santé des données CSV
   ------------------------------------------------------------
   Bouton "Diagnostic" qui parse tous les CSV de data/ et vérifie :
   - Schémas (colonnes attendues présentes)
   - Doublons (clé naturelle de chaque CSV)
   - Valeurs invalides (dates, actif="x", URL)
   - Images locales référencées qui n'existent pas
   ============================================================ */

(function () {
  'use strict';

  const CHECKS = [
    {
      file: 'data/actualites.csv',
      label: 'Actualités',
      required: ['date', 'date_affichage', 'titre', 'resume', 'image', 'tag', 'tag_label', 'lien', 'actif'],
      dateFields: ['date'],
      activeField: 'actif',
      imageFields: ['image'],
      dupKey: row => `${row.date}|${row.titre}`
    },
    {
      file: 'data/effectifs.csv',
      label: 'Effectifs',
      required: ['equipe', 'nom', 'prenom', 'simple', 'double', 'mixte', 'capitaine', 'actif'],
      activeField: 'actif',
      dupKey: row => `${row.nom}|${row.prenom}|${row.equipe}`
    },
    {
      file: 'data/rencontres.csv',
      label: 'Rencontres',
      required: ['equipe', 'date', 'date_affichage', 'adversaire', 'domicile', 'tag', 'actif'],
      dateFields: ['date'],
      activeField: 'actif',
      dupKey: row => `${row.equipe}|${row.date}|${row.adversaire}`
    },
    {
      file: 'data/classement.csv',
      label: 'Classement',
      required: ['pool', 'team', 'J', 'G', 'N', 'P', 'F', 'B+', 'P-', 'Pts', 'chambly'],
      dupKey: row => `${row.pool}|${row.team}`
    },
    {
      file: 'data/palmares.csv',
      label: 'Palmarès',
      required: ['equipe', 'nom', 'prenom', 'nationalite', 'palmares', 'headline'],
      dupKey: row => `${row.equipe}|${row.nom}|${row.prenom}`
    }
  ];

  function injectCSS() {
    if (document.getElementById('admin-diag-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-diag-css';
    s.textContent = `
      .dg-btn-wrap{margin:24px 0;display:flex;justify-content:flex-end}
      .dg-btn{padding:11px 18px;border-radius:10px;background:linear-gradient(135deg,#0A1988,#020260);color:#fff;font-family:'Open Sans',sans-serif;font-size:13px;font-weight:700;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:transform .15s,box-shadow .2s}
      .dg-btn:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(10,25,136,.28)}
      .dg-btn svg{width:16px;height:16px;stroke:#A5EB78;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

      .dg-modal-bg{position:fixed;inset:0;background:rgba(11,17,48,.65);backdrop-filter:blur(4px);z-index:450;display:none;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
      .dg-modal-bg.show{display:flex}
      .dg-modal{background:#fff;border-radius:20px;max-width:760px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.3)}
      .dg-modal-head{padding:24px 26px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-start;gap:16px;position:sticky;top:0;background:#fff;border-radius:20px 20px 0 0;z-index:2}
      .dg-modal-head h3{font-family:'Anton',sans-serif;font-weight:400;font-size:22px;color:#0A1988;margin-bottom:4px}
      .dg-modal-head p{font-size:12.5px;color:var(--muted)}
      .dg-modal-close{background:none;border:none;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:18px}
      .dg-modal-close:hover{background:#f0f3fa;color:var(--text)}
      .dg-modal-body{padding:20px 26px 28px}

      .dg-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
      .dg-stat{padding:14px;border-radius:12px;background:#f7f7fa;text-align:center}
      .dg-stat.ok{background:rgba(165,235,120,.16);border:1px solid rgba(22,163,74,.3)}
      .dg-stat.warn{background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.32)}
      .dg-stat.err{background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.32)}
      .dg-stat-num{font-family:'Anton',sans-serif;font-size:24px;color:#0A1988}
      .dg-stat.ok .dg-stat-num{color:#15803d}
      .dg-stat.warn .dg-stat-num{color:#b45309}
      .dg-stat.err .dg-stat-num{color:#b91c1c}
      .dg-stat-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}

      .dg-section{margin-bottom:18px;border:1px solid var(--line);border-radius:14px;overflow:hidden}
      .dg-section-head{padding:13px 16px;background:#f7f7fa;display:flex;align-items:center;gap:10px;font-weight:700;font-size:14px}
      .dg-section-head .badge{margin-left:auto;padding:3px 10px;border-radius:6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
      .dg-section-head .badge.ok{background:rgba(165,235,120,.16);color:#15803d}
      .dg-section-head .badge.warn{background:rgba(245,158,11,.14);color:#b45309}
      .dg-section-head .badge.err{background:rgba(239,68,68,.12);color:#b91c1c}
      .dg-section-body{padding:0}
      .dg-issue{padding:11px 16px;border-top:1px solid var(--line);font-size:12.5px;line-height:1.5;display:flex;gap:10px;align-items:flex-start}
      .dg-issue:first-child{border-top:0}
      .dg-issue.warn{background:#fffbeb}
      .dg-issue.err{background:#fef2f2}
      .dg-issue.info{background:#f0f9ff}
      .dg-issue .icon{flex-shrink:0;font-size:14px;line-height:1.1;margin-top:1px}
      .dg-issue code{font-family:monospace;font-size:11px;background:rgba(11,17,48,.06);padding:1px 5px;border-radius:4px}

      .dg-loading{text-align:center;padding:40px 20px;color:var(--muted);font-style:italic}
      .dg-loading::after{content:'';display:inline-block;width:14px;height:14px;border:2px solid var(--muted);border-top-color:transparent;border-radius:50%;margin-left:8px;vertical-align:middle;animation:dgSpin 0.8s linear infinite}
      @keyframes dgSpin{to{transform:rotate(360deg)}}

      @media(max-width:640px){
        .dg-summary{grid-template-columns:1fr}
        .dg-modal-head,.dg-modal-body{padding-left:18px;padding-right:18px}
      }
    `;
    document.head.appendChild(s);
  }

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function parseCSV(text) {
    if (window.BccoGithub && BccoGithub.parseCSV) return BccoGithub.parseCSV(text);
    return { headers: [], rows: [] };
  }

  async function fetchCSV(path) {
    try {
      const r = await fetch(path + '?_=' + Date.now(), { cache: 'no-cache' });
      if (!r.ok) return { error: 'HTTP ' + r.status };
      return parseCSV(await r.text());
    } catch (e) {
      return { error: e.message };
    }
  }

  async function imageExists(url) {
    // Pour les images locales (./media/...), HEAD request
    if (!/^\.?\//.test(url)) return null; // URL externe : on ne teste pas
    try {
      const r = await fetch(url.replace(/^\.\//, ''), { method: 'HEAD' });
      return r.ok;
    } catch (_) { return false; }
  }

  function isValidDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));
  }
  function isValidActif(v) {
    return v === '' || v.toLowerCase() === 'x';
  }
  function isValidUrl(s) {
    if (!s) return true;
    return /^(https?:\/\/|\.?\/)/.test(s);
  }

  // -----------------------------------------------------------
  // Run diagnostic
  // -----------------------------------------------------------
  async function runDiagnostic() {
    const results = [];

    for (const check of CHECKS) {
      const issues = [];
      const data = await fetchCSV(check.file);

      if (data.error) {
        issues.push({ level: 'err', msg: `Impossible de lire <code>${check.file}</code> : ${data.error}` });
        results.push({ ...check, rowCount: 0, issues });
        continue;
      }

      const { headers, rows } = data;

      // 1. Vérif des colonnes requises
      const missing = check.required.filter(c => !headers.includes(c));
      if (missing.length) {
        issues.push({ level: 'err', msg: `Colonne(s) manquante(s) : <code>${missing.join('</code>, <code>')}</code>` });
      }

      // 2. Lignes vides ?
      const blankRows = rows.filter(r => Object.values(r).every(v => !v || !v.trim())).length;
      if (blankRows > 0) {
        issues.push({ level: 'warn', msg: `${blankRows} ligne${blankRows > 1 ? 's' : ''} vide${blankRows > 1 ? 's' : ''}` });
      }

      // 3. Doublons
      if (check.dupKey) {
        const seen = new Map();
        rows.forEach((r, i) => {
          const k = check.dupKey(r);
          if (!k || k === '||' || k === '|') return;
          if (seen.has(k)) {
            issues.push({ level: 'warn', msg: `Doublon ligne ${i + 2} et ${seen.get(k) + 2} : <code>${escape(k)}</code>` });
          } else {
            seen.set(k, i);
          }
        });
      }

      // 4. Dates invalides
      if (check.dateFields) {
        rows.forEach((r, i) => {
          for (const f of check.dateFields) {
            const v = r[f];
            if (v && !isValidDate(v)) {
              issues.push({ level: 'warn', msg: `Ligne ${i + 2} · date invalide dans <code>${f}</code> : <code>${escape(v)}</code> (attendu YYYY-MM-DD)` });
            }
          }
        });
      }

      // 5. Champ "actif" → doit être 'x' ou vide
      if (check.activeField) {
        rows.forEach((r, i) => {
          const v = r[check.activeField];
          if (v && !isValidActif(v)) {
            issues.push({ level: 'info', msg: `Ligne ${i + 2} · champ <code>${check.activeField}</code> a une valeur inhabituelle : <code>${escape(v)}</code>` });
          }
        });
      }

      // 6. URL images
      if (check.imageFields) {
        for (const f of check.imageFields) {
          for (let i = 0; i < rows.length; i++) {
            const v = rows[i][f];
            if (!v) continue;
            if (!isValidUrl(v)) {
              issues.push({ level: 'warn', msg: `Ligne ${i + 2} · URL malformée dans <code>${f}</code> : <code>${escape(v.slice(0, 80))}</code>` });
              continue;
            }
            // Test existence locale
            if (/^\.?\//.test(v)) {
              const exists = await imageExists(v);
              if (exists === false) {
                issues.push({ level: 'err', msg: `Ligne ${i + 2} · image locale introuvable : <code>${escape(v)}</code>` });
              }
            }
          }
        }
      }

      results.push({ ...check, rowCount: rows.length, issues });
    }

    return results;
  }

  // -----------------------------------------------------------
  // Rendu du rapport
  // -----------------------------------------------------------
  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function severityOf(issues) {
    if (issues.some(i => i.level === 'err')) return 'err';
    if (issues.some(i => i.level === 'warn')) return 'warn';
    return 'ok';
  }

  function renderResults(results, modalBody) {
    const totalErr  = results.reduce((s, r) => s + r.issues.filter(i => i.level === 'err').length, 0);
    const totalWarn = results.reduce((s, r) => s + r.issues.filter(i => i.level === 'warn').length, 0);
    const totalOk   = results.length - results.filter(r => r.issues.length).length;

    let html = `
      <div class="dg-summary">
        <div class="dg-stat ${totalErr ? 'err' : 'ok'}">
          <div class="dg-stat-num">${totalErr}</div>
          <div class="dg-stat-lbl">Erreur${totalErr > 1 ? 's' : ''}</div>
        </div>
        <div class="dg-stat ${totalWarn ? 'warn' : 'ok'}">
          <div class="dg-stat-num">${totalWarn}</div>
          <div class="dg-stat-lbl">Avertissement${totalWarn > 1 ? 's' : ''}</div>
        </div>
        <div class="dg-stat ok">
          <div class="dg-stat-num">${totalOk}/${results.length}</div>
          <div class="dg-stat-lbl">Fichiers OK</div>
        </div>
      </div>
    `;

    for (const r of results) {
      const sev = severityOf(r.issues);
      const sevLbl = sev === 'ok' ? 'OK' : (sev === 'warn' ? 'À regarder' : 'Erreur');
      html += `
        <div class="dg-section">
          <div class="dg-section-head">
            <span>${escape(r.label)}</span>
            <span style="color:var(--muted);font-weight:500;font-size:12px">${r.rowCount} ligne${r.rowCount > 1 ? 's' : ''} · <code>${escape(r.file)}</code></span>
            <span class="badge ${sev}">${sevLbl}</span>
          </div>
          <div class="dg-section-body">
            ${r.issues.length
              ? r.issues.map(iss => `<div class="dg-issue ${iss.level}"><span class="icon">${iss.level === 'err' ? '❗' : iss.level === 'warn' ? '⚠️' : 'ℹ️'}</span><span>${iss.msg}</span></div>`).join('')
              : '<div class="dg-issue info"><span class="icon">✅</span><span>Tout est en ordre.</span></div>'}
          </div>
        </div>
      `;
    }

    modalBody.innerHTML = html;
  }

  // -----------------------------------------------------------
  // Modal
  // -----------------------------------------------------------
  let modalEl = null;
  function openModal() {
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'dg-modal-bg';
      modalEl.innerHTML = `
        <div class="dg-modal">
          <div class="dg-modal-head">
            <div>
              <h3>🔍 Diagnostic des données</h3>
              <p>Vérification des fichiers CSV du dossier <code>data/</code></p>
            </div>
            <button type="button" class="dg-modal-close" id="dg-close">&times;</button>
          </div>
          <div class="dg-modal-body" id="dg-body">
            <div class="dg-loading">Analyse en cours</div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
      modalEl.querySelector('#dg-close').addEventListener('click', () => modalEl.classList.remove('show'));
      modalEl.addEventListener('click', (e) => { if (e.target === modalEl) modalEl.classList.remove('show'); });
    }
    modalEl.classList.add('show');
    runDiagnostic().then(results => renderResults(results, modalEl.querySelector('#dg-body')));
  }

  // -----------------------------------------------------------
  // Bouton dans le dashboard
  // -----------------------------------------------------------
  function mountButton() {
    const dash = document.getElementById('dashboard');
    if (!dash) return false;
    if (document.getElementById('dg-btn-wrap')) return true;

    injectCSS();

    const wrap = document.createElement('div');
    wrap.id = 'dg-btn-wrap';
    wrap.className = 'dg-btn-wrap';
    wrap.innerHTML = `
      <button type="button" class="dg-btn" id="dg-run">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M9 11l2 2 4-4"/></svg>
        Diagnostiquer les données
      </button>
    `;
    // On l'ajoute en fin du dashboard
    dash.appendChild(wrap);
    document.getElementById('dg-run').addEventListener('click', openModal);
    return true;
  }

  function waitForDashboard() {
    const dash = document.getElementById('dashboard');
    if (!dash) { setTimeout(waitForDashboard, 300); return; }
    if (dash.style.display !== 'none') { mountButton(); return; }
    const obs = new MutationObserver(() => {
      if (dash.style.display !== 'none') { obs.disconnect(); mountButton(); }
    });
    obs.observe(dash, { attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDashboard);
  } else {
    waitForDashboard();
  }

})();
