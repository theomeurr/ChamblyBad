/* ============================================================
   admin-github.js — Helper d'intégration GitHub pour l'admin BCCO
   ------------------------------------------------------------
   Permet d'éditer les fichiers du repo (CSV, images) sans quitter
   la page admin, en passant par l'API GitHub Contents.

   USAGE :
     await BccoGithub.ready();           // attend le token (UI auto)
     const f = await BccoGithub.readFile('data/actualites.csv');
     await BccoGithub.writeFile('data/actualites.csv', newContent, 'msg', f.sha);
     await BccoGithub.uploadImage(file, 'media/actus/photo.jpg', 'msg');

   SÉCURITÉ :
   - Le Personal Access Token (PAT) est stocké en sessionStorage uniquement.
     Il disparaît à la fermeture du navigateur.
   - Le PAT doit avoir le scope "repo" pour pouvoir écrire.
   - Ne JAMAIS commiter le PAT dans le repo : la fonction setToken() est
     volontairement la seule à manipuler sessionStorage.
   ============================================================ */

(function (global) {
  'use strict';

  const REPO_OWNER  = 'theomeurr';
  const REPO_NAME   = 'ChamblyBad';
  const REPO_BRANCH = 'main';
  const API_BASE    = 'https://api.github.com';
  const TOKEN_KEY   = 'bcco_gh_token_v1';

  // -----------------------------------------------------------
  // Token storage (sessionStorage uniquement)
  // -----------------------------------------------------------
  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(t) {
    if (t && t.trim()) sessionStorage.setItem(TOKEN_KEY, t.trim());
    else sessionStorage.removeItem(TOKEN_KEY);
  }
  function hasToken() {
    return !!getToken();
  }

  // -----------------------------------------------------------
  // Toast notifications
  // -----------------------------------------------------------
  let toastEl = null;
  function ensureToastDom() {
    if (toastEl) return;
    toastEl = document.createElement('div');
    toastEl.id = 'bcco-toast';
    Object.assign(toastEl.style, {
      position: 'fixed', top: '24px', right: '24px',
      maxWidth: '380px', minWidth: '240px',
      padding: '14px 18px', borderRadius: '12px',
      background: '#0A1988', color: '#fff',
      fontSize: '13.5px', fontWeight: '500',
      boxShadow: '0 20px 50px rgba(10,25,136,.28)',
      zIndex: '9999', opacity: '0',
      transform: 'translateY(-10px)',
      transition: 'opacity .2s, transform .2s',
      pointerEvents: 'none', lineHeight: '1.4'
    });
    document.body.appendChild(toastEl);
  }
  function toast(msg, type) {
    ensureToastDom();
    const colors = {
      ok:    { bg: '#16a34a', sh: 'rgba(22,163,74,.32)' },
      err:   { bg: '#ef4444', sh: 'rgba(239,68,68,.32)' },
      info:  { bg: '#0A1988', sh: 'rgba(10,25,136,.28)' },
      warn:  { bg: '#d97706', sh: 'rgba(217,119,6,.32)' }
    };
    const c = colors[type] || colors.info;
    toastEl.style.background = c.bg;
    toastEl.style.boxShadow = `0 20px 50px ${c.sh}`;
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateY(0)';
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(-10px)';
    }, type === 'err' ? 5000 : 3000);
  }

  // -----------------------------------------------------------
  // UI modal : demande du token au premier accès
  // -----------------------------------------------------------
  function showTokenModal() {
    return new Promise((resolve) => {
      const existing = document.getElementById('bcco-token-modal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'bcco-token-modal';
      overlay.innerHTML = `
        <style>
          #bcco-token-modal{position:fixed;inset:0;background:rgba(11,17,48,.65);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
          #bcco-token-modal .box{background:#fff;border-radius:20px;max-width:520px;width:100%;padding:32px;box-shadow:0 40px 100px rgba(0,0,0,.3)}
          #bcco-token-modal h3{font-family:'Anton',sans-serif;font-weight:400;font-size:22px;color:#0A1988;margin-bottom:8px}
          #bcco-token-modal p{font-size:13.5px;color:#5A6380;line-height:1.6;margin-bottom:18px}
          #bcco-token-modal ol{font-size:13px;color:#5A6380;line-height:1.7;margin:0 0 18px 18px}
          #bcco-token-modal a{color:#0A1988;text-decoration:underline}
          #bcco-token-modal input{width:100%;padding:13px 16px;border:1px solid rgba(10,25,136,.18);border-radius:12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;font-family:monospace}
          #bcco-token-modal input:focus{border-color:#0A1988}
          #bcco-token-modal .row{display:flex;gap:10px;margin-top:6px}
          #bcco-token-modal button{flex:1;padding:13px 18px;border-radius:12px;border:none;font-family:'Anton',sans-serif;font-size:14px;font-weight:400;cursor:pointer;letter-spacing:.04em;text-transform:uppercase}
          #bcco-token-modal .ok-btn{background:linear-gradient(135deg,#0A1988,#020260);color:#fff}
          #bcco-token-modal .ok-btn:hover{opacity:.92}
          #bcco-token-modal .ok-btn:disabled{opacity:.5;cursor:not-allowed}
          #bcco-token-modal .cancel-btn{background:#f0f3fa;color:#0A1988}
          #bcco-token-modal .scope{font-size:11.5px;background:rgba(165,235,120,.15);border:1px solid rgba(22,163,74,.3);color:#15803d;padding:10px 14px;border-radius:10px;margin-bottom:14px;line-height:1.5}
        </style>
        <div class="box">
          <h3>Connexion à GitHub</h3>
          <p>Pour éditer le site directement depuis l'admin, on a besoin d'un <strong>Personal Access Token</strong> GitHub. Il sera stocké uniquement dans cette session (jamais sur le serveur).</p>
          <div class="scope">📌 Scope requis : <strong>repo</strong> (lecture + écriture sur ton repo)</div>
          <ol>
            <li>Va sur <a href="https://github.com/settings/tokens/new?description=BCCO%20Admin&scopes=repo" target="_blank">github.com/settings/tokens/new</a></li>
            <li>Donne un nom (ex: "BCCO Admin"), coche <strong>repo</strong></li>
            <li>Clique "Generate token", copie la valeur (commence par <code>ghp_</code>)</li>
            <li>Colle-la ici :</li>
          </ol>
          <input type="password" id="bcco-token-input" placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autocomplete="off" />
          <div class="row">
            <button type="button" class="cancel-btn" id="bcco-token-cancel">Annuler</button>
            <button type="button" class="ok-btn" id="bcco-token-ok">Connecter</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input  = overlay.querySelector('#bcco-token-input');
      const okBtn  = overlay.querySelector('#bcco-token-ok');
      const cancel = overlay.querySelector('#bcco-token-cancel');
      input.focus();

      const close = (token) => {
        overlay.remove();
        resolve(token);
      };

      okBtn.addEventListener('click', async () => {
        const t = input.value.trim();
        if (!t) { input.focus(); return; }
        okBtn.disabled = true;
        okBtn.textContent = 'Vérification…';
        // Test de validité : appel /user
        try {
          const r = await fetch(API_BASE + '/user', {
            headers: { 'Authorization': 'Bearer ' + t, 'Accept': 'application/vnd.github+json' }
          });
          if (!r.ok) throw new Error('Token invalide (HTTP ' + r.status + ')');
          const user = await r.json();
          setToken(t);
          toast('Connecté à GitHub en tant que ' + user.login, 'ok');
          close(t);
        } catch (e) {
          okBtn.disabled = false;
          okBtn.textContent = 'Connecter';
          toast('Échec : ' + e.message, 'err');
          input.focus();
          input.select();
        }
      });
      cancel.addEventListener('click', () => close(null));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') okBtn.click(); });
    });
  }

  async function ensureToken() {
    if (hasToken()) return getToken();
    const t = await showTokenModal();
    if (!t) throw new Error('Token GitHub requis pour cette action.');
    return t;
  }

  // -----------------------------------------------------------
  // GitHub API : lecture / écriture
  // -----------------------------------------------------------
  function ghHeaders(token) {
    return {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async function readFile(path) {
    const token = await ensureToken();
    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${REPO_BRANCH}`;
    const r = await fetch(url, { headers: ghHeaders(token) });
    if (r.status === 401) {
      setToken(''); // token invalide → on l'efface
      throw new Error('Token expiré ou invalide. Recharge la page pour te reconnecter.');
    }
    if (r.status === 404) throw new Error('Fichier introuvable : ' + path);
    if (!r.ok) throw new Error('Erreur lecture (HTTP ' + r.status + ')');
    const data = await r.json();
    // contenu base64 → texte UTF-8
    const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
    const content = new TextDecoder('utf-8').decode(bytes);
    return { content, sha: data.sha, path };
  }

  async function writeFile(path, content, message, sha) {
    const token = await ensureToken();
    // Texte UTF-8 → base64
    const bytes = new TextEncoder().encode(content);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);

    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;

    async function attempt(currentSha) {
      const body = { message: message || ('Mise à jour ' + path), content: b64, branch: REPO_BRANCH };
      if (currentSha) body.sha = currentSha;
      return fetch(url, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) });
    }

    let r = await attempt(sha);

    // Auto-recovery : si on n'a pas envoyé de sha et que le fichier existait déjà,
    // GitHub renvoie 422 "Invalid request. 'sha' wasn't supplied."
    // Idem si on a envoyé un sha obsolète : 409 conflict.
    // → On va chercher le sha à jour et on retente une fois.
    if ((r.status === 422 || r.status === 409)) {
      try {
        const urlCheck = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${REPO_BRANCH}`;
        const rc = await fetch(urlCheck, { headers: ghHeaders(token) });
        if (rc.ok) {
          const d = await rc.json();
          if (d && d.sha) {
            r = await attempt(d.sha);
          }
        }
      } catch (_) { /* on garde la première erreur */ }
    }

    if (r.status === 409) throw new Error('Conflit : le fichier a été modifié entre-temps. Recharge et réessaie.');
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error('Erreur écriture : ' + (e.message || ('HTTP ' + r.status)));
    }
    return await r.json();
  }

  // -----------------------------------------------------------
  // Upload d'image avec redimensionnement
  // -----------------------------------------------------------
  // Options : maxDim (number)  |  { maxDim?, quality?, targetWidth?, targetHeight? }
  // Si targetWidth & targetHeight sont fournis : center-crop "cover" vers ces dimensions exactes.
  function resizeImage(file, options = 1600, quality = 0.85) {
    // Compat ascendante : (file, maxDim, quality)
    let opts;
    if (typeof options === 'number') {
      opts = { maxDim: options, quality };
    } else {
      opts = Object.assign({ maxDim: 1600, quality: 0.85 }, options || {});
    }
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          const ctx = c.getContext('2d');

          if (opts.targetWidth && opts.targetHeight) {
            // Mode "card" : center-crop type object-fit:cover vers dimensions exactes
            c.width = opts.targetWidth;
            c.height = opts.targetHeight;
            const targetRatio = opts.targetWidth / opts.targetHeight;
            const srcRatio = img.width / img.height;
            let sx, sy, sw, sh;
            if (srcRatio > targetRatio) {
              // Source plus large → on rogne sur les côtés
              sh = img.height;
              sw = img.height * targetRatio;
              sx = (img.width - sw) / 2;
              sy = 0;
            } else {
              // Source plus haute → on rogne en haut/bas
              sw = img.width;
              sh = img.width / targetRatio;
              sx = 0;
              sy = (img.height - sh) / 2;
            }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, opts.targetWidth, opts.targetHeight);
          } else {
            // Mode "fit" classique : scale down preserving aspect ratio
            let { width: w, height: h } = img;
            if (Math.max(w, h) > opts.maxDim) {
              const ratio = opts.maxDim / Math.max(w, h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            c.width = w; c.height = h;
            ctx.drawImage(img, 0, 0, w, h);
          }

          c.toBlob(blob => blob ? resolve(blob) : reject(new Error('Conversion canvas échouée')),
                   file.type === 'image/png' ? 'image/png' : 'image/jpeg',
                   opts.quality);
        };
        img.onerror = () => reject(new Error('Image illisible'));
        img.src = e.target.result;
      };
      fr.onerror = () => reject(new Error('Lecture fichier échouée'));
      fr.readAsDataURL(file);
    });
  }

  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const dataUrl = fr.result;
        const b64 = String(dataUrl).split(',')[1] || '';
        resolve(b64);
      };
      fr.onerror = () => reject(new Error('Lecture blob échouée'));
      fr.readAsDataURL(blob);
    });
  }

  async function uploadImage(file, targetPath, message, opts = {}) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      throw new Error('Fichier non reconnu comme image.');
    }
    const token = await ensureToken();
    const blob  = await resizeImage(file, opts.maxDim || 1600, opts.quality || 0.85);
    const b64   = await blobToBase64(blob);

    // Vérifie si le fichier existe déjà pour récupérer le SHA
    let existingSha = null;
    try {
      const urlCheck = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, '/')}?ref=${REPO_BRANCH}`;
      const rc = await fetch(urlCheck, { headers: ghHeaders(token) });
      if (rc.ok) {
        const d = await rc.json();
        existingSha = d.sha;
      }
    } catch (_) {}

    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, '/')}`;
    const body = {
      message: message || ('Upload image ' + targetPath),
      content: b64,
      branch: REPO_BRANCH
    };
    if (existingSha) body.sha = existingSha;

    const r = await fetch(url, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error('Erreur upload : ' + (e.message || ('HTTP ' + r.status)));
    }
    const result = await r.json();
    // URL publique raw pour utilisation immédiate (avant que le déploiement statique ait propagé)
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${targetPath}`;
    // URL "production" (chemin local relatif)
    const localUrl = './' + targetPath;
    return { ...result, rawUrl, localUrl, path: targetPath };
  }

  // -----------------------------------------------------------
  // CSV helpers (parse / serialize)
  // -----------------------------------------------------------
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = []; let i = 0, field = '', row = [], inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"' && text[i+1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { inQ = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (field.length || row.length) { row.push(field); rows.push(row); }
        row = []; field = '';
        if (c === '\r' && text[i+1] === '\n') i += 2; else i++;
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

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function serializeCSV(rows, headers) {
    if (!headers || !headers.length) return '';
    const out = [headers.map(csvEscape).join(',')];
    for (const r of rows) {
      out.push(headers.map(h => csvEscape(r[h])).join(','));
    }
    return out.join('\n') + '\n';
  }

  // -----------------------------------------------------------
  // Misc helpers
  // -----------------------------------------------------------
  function slugify(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item';
  }

  async function ready() {
    if (!hasToken()) await ensureToken();
    return hasToken();
  }

  function logout() {
    setToken('');
    toast('Déconnecté de GitHub', 'info');
  }

  // -----------------------------------------------------------
  // Export public API
  // -----------------------------------------------------------
  global.BccoGithub = {
    // config
    REPO_OWNER, REPO_NAME, REPO_BRANCH,
    // auth
    getToken, setToken, hasToken, ready, logout, ensureToken,
    // files
    readFile, writeFile, uploadImage, resizeImage,
    // csv
    parseCSV, serializeCSV,
    // ui
    toast, slugify
  };

})(window);
