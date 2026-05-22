/* ============================================================
   admin-import.js — Import de fichiers CSV exportés depuis Numbers/Excel
   ------------------------------------------------------------
   Permet de remplacer un fichier CSV du repo par un fichier
   exporté localement. Gère :
   - Sélection du fichier cible (dropdown)
   - Détection auto du séparateur (, ou ;)
   - Validation des colonnes (warning si mismatch)
   - Aperçu / diff (nombre de lignes avant/après)
   - Commit via GitHub API
   ============================================================ */

(function () {
  'use strict';

  // Catalogue des fichiers gérables via l'import.
  // ⚠️ On exclut volontairement les fichiers qui ont déjà un éditeur dédié
  //    dans l'admin (actualites.csv, effectifs.csv, galerie.csv) pour éviter
  //    le double workflow et le risque d'écraser des modifs faites depuis l'UI.
  //    Pour ceux-là : utilise les sections Actualités / Effectifs / Galerie.
  const TARGETS = [
    {
      path: 'data/rencontres.csv',
      label: 'Rencontres équipes (Top 12 & N2)',
      icon: '🏸',
      expectedHeaders: ['equipe', 'date', 'date_affichage', 'adversaire', 'domicile', 'tag', 'actif']
    },
    {
      path: 'data/classement.csv',
      label: 'Classement Top 12',
      icon: '🏆',
      expectedHeaders: ['pool', 'team', 'J', 'G', 'N', 'P', 'F', 'B+', 'P-', 'Pts', 'chambly']
    },
    {
      path: 'data/palmares.csv',
      label: 'Palmarès joueurs',
      icon: '🥇',
      expectedHeaders: ['equipe', 'nom', 'prenom', 'nationalite', 'palmares', 'headline']
    }
  ];

  let parsedData = null; // { headers, rows, separator, sourceText }
  let currentTarget = null;
  let existingFile = null; // { content, sha }

  function injectCSS() {
    if (document.getElementById('admin-imp-css')) return;
    const s = document.createElement('style');
    s.id = 'admin-imp-css';
    s.textContent = `
      .imp-section{margin-top:32px}
      .imp-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 10px 30px rgba(10,25,136,.06)}
      .imp-step{margin-bottom:18px}
      .imp-step-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px;display:flex;align-items:center;gap:8px}
      .imp-step-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#0A1988;color:#fff;font-family:'Open Sans',sans-serif;font-size:11px;font-weight:700;letter-spacing:0}

      .imp-select{width:100%;max-width:480px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;cursor:pointer}
      .imp-select:focus{border-color:#0A1988;box-shadow:0 0 0 3px rgba(10,25,136,.08)}

      .imp-drop{border:2px dashed rgba(10,25,136,.18);border-radius:12px;padding:24px;text-align:center;background:#fafbff;transition:all .15s;cursor:pointer;position:relative;display:block;isolation:isolate;overflow:hidden}
      .imp-drop:hover,.imp-drop.drag{border-color:#0A1988;background:rgba(10,25,136,.04)}
      .imp-drop input[type=file]{position:absolute !important;left:-9999px !important;width:1px !important;height:1px !important;opacity:0 !important;pointer-events:none !important}
      .imp-drop-icon{font-size:30px;margin-bottom:6px;line-height:1}
      .imp-drop-text{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px}
      .imp-drop-sub{font-size:12px;color:var(--muted)}

      .imp-preview{margin-top:14px;padding:0;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
      .imp-preview-head{padding:14px 18px;border-bottom:1px solid var(--line);background:#f7f7fa;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
      .imp-preview-title{font-weight:700;font-size:13px;color:var(--text)}
      .imp-preview-meta{font-size:12px;color:var(--muted)}
      .imp-preview-meta strong{color:var(--text);font-weight:700}
      .imp-preview-meta .arrow{margin:0 6px;color:#0A1988}
      .imp-preview-meta .delta-plus{color:#15803d;font-weight:700}
      .imp-preview-meta .delta-minus{color:#b91c1c;font-weight:700}

      .imp-warnings{padding:14px 18px;border-bottom:1px solid var(--line)}
      .imp-warnings:empty{display:none}
      .imp-warn{font-size:12.5px;padding:8px 12px;border-radius:8px;margin-bottom:6px;display:flex;align-items:flex-start;gap:8px;line-height:1.4}
      .imp-warn:last-child{margin-bottom:0}
      .imp-warn.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#b91c1c}
      .imp-warn.warn{background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.28);color:#92400e}
      .imp-warn.ok{background:rgba(165,235,120,.14);border:1px solid rgba(22,163,74,.28);color:#15803d}
      .imp-warn code{font-family:monospace;font-size:11px;background:rgba(11,17,48,.06);padding:1px 5px;border-radius:4px}

      .imp-table-wrap{max-height:280px;overflow:auto}
      .imp-table{width:100%;border-collapse:collapse;font-size:12px}
      .imp-table th{padding:8px 10px;background:#f7f7fa;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line);position:sticky;top:0}
      .imp-table td{padding:7px 10px;border-bottom:1px solid var(--line);color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

      .imp-actions{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
      .imp-btn{padding:11px 18px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--text);display:inline-flex;align-items:center;gap:8px;transition:all .15s}
      .imp-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 14px rgba(10,25,136,.08)}
      .imp-btn:disabled{opacity:.5;cursor:not-allowed}
      .imp-btn.primary{background:linear-gradient(135deg,#A5EB78,#7ed957);border:none;color:#0A1988}
      .imp-btn.danger{background:linear-gradient(135deg,#ef4444,#dc2626);border:none;color:#fff}
      .imp-btn svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2}

      .imp-hint{font-size:12px;color:var(--muted);line-height:1.5;margin-top:4px}
      .imp-hint code{font-family:monospace;font-size:11px;background:rgba(11,17,48,.06);padding:1px 4px;border-radius:4px}
    `;
    document.head.appendChild(s);
  }

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // Détecte le séparateur en comptant , vs ; sur la première ligne non vide
  function detectSeparator(text) {
    const firstLine = text.split(/\r?\n/).find(l => l.trim());
    if (!firstLine) return ',';
    const comma = (firstLine.match(/,/g) || []).length;
    const semi  = (firstLine.match(/;/g) || []).length;
    return semi > comma ? ';' : ',';
  }

  // Parse CSV avec séparateur configurable
  function parseCSV(text, sep) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const SEP = sep || ',';
    const rows = []; let i = 0, field = '', row = [], inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { inQ = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === SEP) { row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (field.length || row.length) { row.push(field); rows.push(row); }
        row = []; field = '';
        if (c === '\r' && text[i + 1] === '\n') i += 2; else i++;
        continue;
      }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return { headers: [], rows: [] };
    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1).filter(r => r.some(v => v && v.trim())).map(r => {
      const o = {};
      headers.forEach((h, idx) => o[h] = (r[idx] != null ? String(r[idx]) : '').trim());
      return o;
    });
    return { headers, rows: dataRows };
  }

  // -----------------------------------------------------------
  // Mount section
  // -----------------------------------------------------------
  function mountSection() {
    const dash = document.getElementById('dashboard');
    if (!dash || document.getElementById('imp-section')) return false;

    injectCSS();

    const section = document.createElement('section');
    section.id = 'imp-section';
    section.className = 'imp-section';
    section.innerHTML = `
      <h3 class="section-title">📥 Import CSV (depuis Numbers / Excel)</h3>
      <p class="section-sub">
        Pour remplacer en bloc <strong>rencontres</strong>, <strong>classement</strong> ou <strong>palmarès</strong> par un export Numbers/Excel.
        L'ancien fichier est écrasé.<br>
        <em>Actualités, effectifs et galerie sont éditables directement dans leurs sections respectives ci-dessus.</em>
      </p>

      <div class="imp-card">
        <div class="imp-step">
          <div class="imp-step-label"><span class="imp-step-num">1</span> Choisis le fichier à remplacer</div>
          <select class="imp-select" id="imp-target">
            <option value="">— Sélectionne un fichier —</option>
            ${TARGETS.map(t => `<option value="${t.path}">${t.icon} ${t.label} (${t.path})</option>`).join('')}
          </select>
        </div>

        <div class="imp-step" id="imp-step2" style="display:none">
          <div class="imp-step-label"><span class="imp-step-num">2</span> Glisse ton CSV exporté</div>
          <label class="imp-drop" id="imp-drop">
            <input type="file" id="imp-file" accept=".csv,text/csv,text/plain" />
            <div class="imp-drop-icon">📁</div>
            <div class="imp-drop-text">Clique ou glisse ton fichier CSV ici</div>
            <div class="imp-drop-sub">Numbers : <strong>Fichier → Exporter vers → CSV…</strong></div>
          </label>
          <div class="imp-hint">💡 Numbers exporte souvent avec <code>;</code> comme séparateur (locale française). Pas de souci : c'est détecté auto.</div>
        </div>

        <div id="imp-result"></div>
      </div>
    `;

    const diagBtn = document.getElementById('dg-btn-wrap');
    if (diagBtn) dash.insertBefore(section, diagBtn);
    else dash.appendChild(section);

    // Listeners
    document.getElementById('imp-target').addEventListener('change', onTargetChange);

    const drop = document.getElementById('imp-drop');
    const fileInput = document.getElementById('imp-file');
    fileInput.addEventListener('change', () => fileInput.files[0] && handleFile(fileInput.files[0]));
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    return true;
  }

  // -----------------------------------------------------------
  // Étape 1 : cible sélectionnée
  // -----------------------------------------------------------
  async function onTargetChange(e) {
    const path = e.target.value;
    parsedData = null;
    document.getElementById('imp-result').innerHTML = '';
    if (!path) {
      document.getElementById('imp-step2').style.display = 'none';
      return;
    }
    currentTarget = TARGETS.find(t => t.path === path);
    document.getElementById('imp-step2').style.display = 'block';
    document.getElementById('imp-file').value = '';

    // On précharge le fichier existant pour avoir le SHA et le compte de lignes
    try {
      BccoGithub.toast('Chargement du fichier existant…', 'info');
      existingFile = await BccoGithub.readFile(path);
    } catch (err) {
      existingFile = null;
      BccoGithub.toast('Impossible de lire l\'ancien fichier : ' + err.message, 'err');
    }
  }

  // -----------------------------------------------------------
  // Étape 2 : fichier déposé
  // -----------------------------------------------------------
  function handleFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      BccoGithub.toast('Fichier trop gros (>5 Mo)', 'err');
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      const text = String(fr.result);
      const sep = detectSeparator(text);
      const parsed = parseCSV(text, sep);
      // Re-sérialise toujours avec ',' (notre standard de repo)
      parsedData = {
        headers: parsed.headers,
        rows: parsed.rows,
        separator: sep,
        sourceText: text,
        fileName: file.name
      };
      renderResult();
    };
    fr.onerror = () => BccoGithub.toast('Lecture du fichier échouée', 'err');
    fr.readAsText(file, 'utf-8');
  }

  // -----------------------------------------------------------
  // Rendu du diff + preview
  // -----------------------------------------------------------
  function renderResult() {
    const el = document.getElementById('imp-result');
    if (!parsedData || !currentTarget) { el.innerHTML = ''; return; }

    const newCount = parsedData.rows.length;
    let oldCount = 0;
    if (existingFile) {
      try {
        const old = BccoGithub.parseCSV(existingFile.content);
        oldCount = old.rows.length;
      } catch (_) {}
    }
    const delta = newCount - oldCount;

    // Validations
    const warnings = [];

    // Sep info
    warnings.push({
      level: 'ok',
      msg: `Séparateur détecté : <code>${parsedData.separator === ';' ? 'point-virgule (;)' : 'virgule (,)'}</code> · encodage UTF-8`
    });

    // Vérif headers
    const expectedSet = new Set(currentTarget.expectedHeaders);
    const actualSet = new Set(parsedData.headers);
    const missing = currentTarget.expectedHeaders.filter(h => !actualSet.has(h));
    const extra   = parsedData.headers.filter(h => !expectedSet.has(h));

    if (missing.length === 0 && extra.length === 0) {
      warnings.push({ level: 'ok', msg: `Colonnes ✓ — schéma exact : <code>${currentTarget.expectedHeaders.join(', ')}</code>` });
    } else {
      if (missing.length) {
        warnings.push({ level: 'err', msg: `❌ Colonnes manquantes : <code>${missing.join(', ')}</code> — l'import va casser le site !` });
      }
      if (extra.length) {
        warnings.push({ level: 'warn', msg: `⚠️ Colonnes en trop (seront ignorées) : <code>${extra.join(', ')}</code>` });
      }
    }

    // Lignes vides
    if (!newCount) {
      warnings.push({ level: 'err', msg: `❌ Aucune ligne de données dans le fichier importé.` });
    }

    // Detection grosse différence (>50% de change)
    if (oldCount > 0 && Math.abs(delta) / oldCount > 0.5) {
      warnings.push({ level: 'warn', msg: `⚠️ Différence importante (${Math.abs(delta)} ligne${Math.abs(delta) > 1 ? 's' : ''}, ${Math.round(Math.abs(delta) / oldCount * 100)}%). Vérifie bien avant d'importer.` });
    }

    const canImport = !missing.length && newCount > 0;

    // Aperçu : 5 premières lignes
    const previewHeaders = currentTarget.expectedHeaders.filter(h => parsedData.headers.includes(h));
    const previewRows = parsedData.rows.slice(0, 5);

    el.innerHTML = `
      <div class="imp-preview">
        <div class="imp-preview-head">
          <div>
            <div class="imp-preview-title">📄 ${escape(parsedData.fileName)}</div>
            <div class="imp-preview-meta">
              <strong>${oldCount}</strong> ligne${oldCount > 1 ? 's' : ''} actuellement
              <span class="arrow">→</span>
              <strong>${newCount}</strong> ligne${newCount > 1 ? 's' : ''} après import
              ${delta !== 0 ? `<span class="${delta > 0 ? 'delta-plus' : 'delta-minus'}">(${delta > 0 ? '+' : ''}${delta})</span>` : ''}
            </div>
          </div>
        </div>

        <div class="imp-warnings">
          ${warnings.map(w => `<div class="imp-warn ${w.level}">${w.msg}</div>`).join('')}
        </div>

        ${previewRows.length ? `
        <div class="imp-table-wrap">
          <table class="imp-table">
            <thead>
              <tr>${previewHeaders.map(h => `<th>${escape(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${previewRows.map(r => `
                <tr>${previewHeaders.map(h => `<td title="${escape(r[h] || '')}">${escape(r[h] || '')}</td>`).join('')}</tr>
              `).join('')}
              ${parsedData.rows.length > 5 ? `<tr><td colspan="${previewHeaders.length}" style="text-align:center;color:var(--muted);font-style:italic;padding:10px">…et ${parsedData.rows.length - 5} ligne${parsedData.rows.length - 5 > 1 ? 's' : ''} de plus</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        ` : ''}
      </div>

      <div class="imp-actions">
        <button type="button" class="imp-btn" id="imp-cancel">Annuler</button>
        <button type="button" class="imp-btn ${canImport ? 'danger' : ''}" id="imp-confirm" ${canImport ? '' : 'disabled'}>
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Remplacer ${escape(currentTarget.path)}
        </button>
      </div>
    `;

    document.getElementById('imp-cancel').addEventListener('click', resetForm);
    if (canImport) {
      document.getElementById('imp-confirm').addEventListener('click', doImport);
    }
  }

  // -----------------------------------------------------------
  // Reset
  // -----------------------------------------------------------
  function resetForm() {
    parsedData = null;
    existingFile = null;
    currentTarget = null;
    document.getElementById('imp-target').value = '';
    document.getElementById('imp-step2').style.display = 'none';
    document.getElementById('imp-file').value = '';
    document.getElementById('imp-result').innerHTML = '';
  }

  // -----------------------------------------------------------
  // Import : commit GitHub
  // -----------------------------------------------------------
  async function doImport() {
    if (!parsedData || !currentTarget) return;

    const confirmMsg = `⚠️ Cette action va REMPLACER le fichier "${currentTarget.path}" sur GitHub.\n\n` +
                       `${parsedData.rows.length} ligne(s) vont écraser les ${existingFile ? BccoGithub.parseCSV(existingFile.content).rows.length : '?'} ligne(s) actuelle(s).\n\n` +
                       `Continuer ?`;
    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById('imp-confirm');
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Import en cours…';

    try {
      // On re-sérialise toujours avec virgule (notre standard repo)
      // en ne gardant que les colonnes attendues, dans le bon ordre
      const cleanRows = parsedData.rows.map(r => {
        const o = {};
        currentTarget.expectedHeaders.forEach(h => o[h] = r[h] != null ? String(r[h]) : '');
        return o;
      });
      const csv = BccoGithub.serializeCSV(cleanRows, currentTarget.expectedHeaders);

      const message = `Import ${currentTarget.label} depuis ${parsedData.fileName} (${parsedData.rows.length} lignes)`;
      const sha = existingFile ? existingFile.sha : null;
      await BccoGithub.writeFile(currentTarget.path, csv, message, sha);

      // Mémoriser les infos avant resetForm() qui les efface
      const successLabel = currentTarget.label;
      const successPath  = currentTarget.path;
      const successCount = parsedData.rows.length;

      BccoGithub.toast(`✅ ${successLabel} remplacé (${successCount} lignes)`, 'ok');
      resetForm();
    } catch (e) {
      BccoGithub.toast('Erreur import : ' + e.message, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  // -----------------------------------------------------------
  // Init
  // -----------------------------------------------------------
  function init() {
    return mountSection();
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
