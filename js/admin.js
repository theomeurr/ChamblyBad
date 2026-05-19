
// Liste des utilisateurs admin — ajouter/supprimer des entrées selon les besoins.
// Pour générer un nouveau hash : ouvrir la console et appeler generateHash('identifiant','motdepasse')
// Utilisateurs chargés depuis data/admins.json (tableau de {label,salt,hash})
let ADMIN_USERS = [];
async function loadAdminUsers() {
  try {
    const r = await fetch('data/admins.json?_=' + Date.now());
    if (r.ok) ADMIN_USERS = await r.json();
  } catch(e) { console.warn('Impossible de charger data/admins.json', e); }
}

const PBKDF2_ITERATIONS = 200000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;

const loginOverlay = document.getElementById('loginOverlay');
const topbar = document.getElementById('topbar');
const dashboard = document.getElementById('dashboard');
const loginUser = document.getElementById('loginUser');
const loginCode = document.getElementById('loginCode');
const loginErr = document.getElementById('loginErr');
const loginLock = document.getElementById('loginLock');
const lockTimer = document.getElementById('lockTimer');
let lockInterval = null;

function getLockData() { try { return JSON.parse(localStorage.getItem('bcco_lock') || 'null'); } catch(e) { return null; } }
function setLockData(d) { localStorage.setItem('bcco_lock', JSON.stringify(d)); }
function isLockedOut() { const d = getLockData(); if (!d) return false; if (Date.now() < d.until) return true; localStorage.removeItem('bcco_lock'); return false; }
function getRemainingLock() { const d = getLockData(); return d ? Math.max(0, d.until - Date.now()) : 0; }

function startLockTimer() {
  loginLock.style.display = 'block'; loginErr.style.display = 'none';
  loginUser.disabled = true; loginCode.disabled = true;
  document.getElementById('loginBtn').disabled = true;
  if (lockInterval) clearInterval(lockInterval);
  lockInterval = setInterval(function() {
    const rem = getRemainingLock();
    if (rem <= 0) {
      clearInterval(lockInterval); loginLock.style.display = 'none';
      loginUser.disabled = false; loginCode.disabled = false;
      document.getElementById('loginBtn').disabled = false;
      localStorage.removeItem('bcco_lock'); localStorage.removeItem('bcco_attempts');
    } else {
      const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
      lockTimer.textContent = m + 'min ' + String(s).padStart(2,'0') + 's';
    }
  }, 1000);
}

function recordFailedAttempt() {
  const attempts = parseInt(localStorage.getItem('bcco_attempts') || '0', 10) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    setLockData({ until: Date.now() + LOCKOUT_MS });
    localStorage.removeItem('bcco_attempts'); startLockTimer();
  } else {
    localStorage.setItem('bcco_attempts', String(attempts));
    loginErr.textContent = 'Identifiants incorrects (' + attempts + '/' + MAX_ATTEMPTS + ' tentatives)';
    loginErr.style.display = 'block';
    loginUser.style.borderColor = '#ef4444'; loginCode.style.borderColor = '#ef4444';
    setTimeout(function() { loginErr.style.display = 'none'; loginUser.style.borderColor = ''; loginCode.style.borderColor = ''; }, 2500);
  }
}

function bytesToHex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''); }
function hexToBytes(hex) { const out = new Uint8Array(hex.length/2); for (let i=0;i<out.length;i++) out[i]=parseInt(hex.substr(i*2,2),16); return out; }
async function sha256Hex(msg) { return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg))); }
async function pbkdf2Hex(pwd, saltHex, iter) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pwd), { name:'PBKDF2' }, false, ['deriveBits']);
  return bytesToHex(await crypto.subtle.deriveBits({ name:'PBKDF2', salt:hexToBytes(saltHex), iterations:iter, hash:'SHA-256' }, key, 256));
}
function constantTimeEq(a, b) { if (a.length!==b.length) return false; let r=0; for(let i=0;i<a.length;i++) r|=a.charCodeAt(i)^b.charCodeAt(i); return r===0; }

// Utilitaire console pour générer un hash : generateHash('identifiant','motdepasse')
window.generateHash = async function(user, pass) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const sha = await sha256Hex(user + ':' + pass);
  const hash = await pbkdf2Hex(sha, salt, PBKDF2_ITERATIONS);
  console.log('{ label: \'' + user + '\', salt: \'' + salt + '\', hash: \'' + hash + '\' }');
};

if (sessionStorage.getItem('bcco_admin') === '1') {
  showAdmin();
} else if (isLockedOut()) {
  startLockTimer();
} else {
  loadAdminUsers();
}

document.getElementById('loginBtn').addEventListener('click', doLogin);
loginUser.addEventListener('keydown', function(e) { if (e.key==='Enter') loginCode.focus(); });
loginCode.addEventListener('keydown', function(e) { if (e.key==='Enter') doLogin(); });

function doLogout() {
  sessionStorage.removeItem('bcco_admin');
  sessionStorage.removeItem('bcco_role');
  location.reload();
}

async function doLogin() {
  if (isLockedOut()) return;
  const user = loginUser.value.trim(), pass = loginCode.value.trim();
  if (!user || !pass) return;
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Vérification…';
  try {
    if (!ADMIN_USERS.length) await loadAdminUsers();
    const sha = await sha256Hex(user + ':' + pass);
    for (const u of ADMIN_USERS) {
      const hash = await pbkdf2Hex(sha, u.salt, PBKDF2_ITERATIONS);
      if (constantTimeEq(hash, u.hash)) {
        localStorage.removeItem('bcco_attempts'); localStorage.removeItem('bcco_lock');
        sessionStorage.setItem('bcco_admin', '1');
        sessionStorage.setItem('bcco_role', u.role || 'admin');
        sessionStorage.setItem('bcco_label', u.label);
        showAdmin(); return;
      }
    }
    recordFailedAttempt();
  } finally { btn.disabled = false; btn.textContent = 'Se connecter'; }
}

function showAdmin() {
  loginOverlay.classList.add('hidden');
  topbar.style.display = ''; dashboard.style.display = '';
  if (sessionStorage.getItem('bcco_role') === 'super') {
    document.getElementById('accesBtn').style.display = '';
  }
  initActusPreview(); initRencontresPreview(); initReservationsPreview();
}

function openAccesDrawer() {
  document.getElementById('accesDrawer').style.display = '';
  document.getElementById('accesOverlay').style.display = '';
  renderAccesUsers();
}
function closeAccesDrawer() {
  document.getElementById('accesDrawer').style.display = 'none';
  document.getElementById('accesOverlay').style.display = 'none';
}

/* ---- Gestion des accès admin ---- */
async function renderAccesUsers() {
  const el = document.getElementById('accesUserList');
  if (!el) return;
  await loadAdminUsers();
  if (!ADMIN_USERS.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);font-style:italic">Aucun utilisateur configuré.</div>';
    return;
  }
  const me = sessionStorage.getItem('bcco_label') || '';
  el.innerHTML = ADMIN_USERS.map(u => {
    const isMe = u.label === me;
    const roleTag = u.role === 'super'
      ? `<span style="font-size:10px;color:#fff;background:var(--secondary);border:1px solid var(--secondary);padding:2px 7px;border-radius:5px">super admin</span>`
      : `<span style="font-size:10px;color:var(--muted);background:var(--surface);border:1px solid var(--line);padding:2px 7px;border-radius:5px">admin</span>`;
    const revokeBtn = isMe
      ? `<span style="font-size:10px;color:var(--muted);font-style:italic">vous</span>`
      : `<button onclick="revokeUser('${u.label.replace(/'/g,"\\'")}')"
           style="font-size:11px;font-weight:700;color:#b91c1c;background:none;border:1px solid #fca5a5;border-radius:6px;padding:3px 9px;cursor:pointer;font-family:inherit"
           title="Révoquer l'accès">Révoquer</button>`;
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-2);border-radius:8px">
      <svg style="width:15px;height:15px;stroke:var(--secondary);fill:none;stroke-width:2;flex-shrink:0" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0112 0v1"/></svg>
      <span style="font-size:13px;font-weight:600;color:var(--text);flex:1">${u.label}</span>
      ${roleTag}
      ${revokeBtn}
    </div>`;
  }).join('');
}

function revokeUser(label) {
  if (!confirm(`Révoquer l'accès de « ${label} » ?\n\nCela génèrera le nouveau JSON à copier dans data/admins.json.`)) return;
  const updated = ADMIN_USERS.filter(u => u.label !== label);
  const json = JSON.stringify(updated, null, 2);
  const out = document.getElementById('revokeOutput');
  const res = document.getElementById('revokeResult');
  out.value = json;
  res.style.display = '';
  out.select();
  // Mettre à jour la liste visuellement
  ADMIN_USERS = updated;
  const el = document.getElementById('accesUserList');
  const me = sessionStorage.getItem('bcco_label') || '';
  el.innerHTML = updated.length ? updated.map(u => {
    const isMe = u.label === me;
    const roleTag = u.role === 'super'
      ? `<span style="font-size:10px;color:#fff;background:var(--secondary);border:1px solid var(--secondary);padding:2px 7px;border-radius:5px">super admin</span>`
      : `<span style="font-size:10px;color:var(--muted);background:var(--surface);border:1px solid var(--line);padding:2px 7px;border-radius:5px">admin</span>`;
    const revokeBtn = isMe
      ? `<span style="font-size:10px;color:var(--muted);font-style:italic">vous</span>`
      : `<button onclick="revokeUser('${u.label.replace(/'/g,"\\'")}')"
           style="font-size:11px;font-weight:700;color:#b91c1c;background:none;border:1px solid #fca5a5;border-radius:6px;padding:3px 9px;cursor:pointer;font-family:inherit"
           title="Révoquer l'accès">Révoquer</button>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-2);border-radius:8px">
      <svg style="width:15px;height:15px;stroke:var(--secondary);fill:none;stroke-width:2;flex-shrink:0" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0112 0v1"/></svg>
      <span style="font-size:13px;font-weight:600;color:var(--text);flex:1">${u.label}</span>
      ${roleTag}${revokeBtn}</div>`;
  }).join('') : '<div style="font-size:13px;color:var(--muted);font-style:italic">Aucun utilisateur restant.</div>';
}

async function genHashUI() {
  const user = document.getElementById('genUser').value.trim();
  const pass = document.getElementById('genPass').value.trim();
  const btn = document.getElementById('genHashBtn');
  const result = document.getElementById('genResult');
  const output = document.getElementById('genOutput');
  if (!user || !pass) { alert('Renseignez l\'identifiant et le mot de passe.'); return; }
  btn.disabled = true; btn.textContent = 'Calcul en cours…';
  try {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const sha = await sha256Hex(user + ':' + pass);
    const hash = await pbkdf2Hex(sha, salt, PBKDF2_ITERATIONS);
    const role = (document.getElementById('genRole') || {}).value || 'admin';
    const entry = role === 'super'
      ? `{ "label": "${user}", "salt": "${salt}", "hash": "${hash}", "role": "super" }`
      : `{ "label": "${user}", "salt": "${salt}", "hash": "${hash}" }`;
    output.value = entry;
    result.style.display = 'block';
    output.select();
  } finally { btn.disabled = false; btn.textContent = 'Générer le hash'; }
}

/* =================================================================
   APERCU RESERVATIONS TERRAINS — lecture CSV (lecture seule pour l'instant)
================================================================== */
const GH = 'https://github.com/theomeurr/ChamblyBad/edit/main/';

const RV_ADMIN_CONFIG = {
  // Liens d'édition → ouvrent le fichier CSV sur GitHub
  sheetConfigUrl:    GH + 'data/reservations/config.csv',
  sheetSlotsUrl:     GH + 'data/reservations/creneaux_ouverts.csv',
  sheetBlockedUrl:   GH + 'data/reservations/creneaux_bloques.csv',
  sheetLicenciesUrl: GH + 'data/reservations/licencies.csv',
  sheetResUrl:       GH + 'data/reservations/reservations.csv',
  // Pas de source remote — données locales uniquement
  configPubUrl:      '',
  slotsPubUrl:       '',
  blockedPubUrl:     '',
  licenciesPubUrl:   '',
  reservationsPubUrl:'',
  // Fichiers CSV locaux (source unique)
  configCsv:       'data/reservations/config.csv',
  blockedCsv:      'data/reservations/creneaux_bloques.csv',
  reservationsCsv: 'data/reservations/reservations.csv',
  licenciesCsv:    'data/reservations/licencies.csv'
};

function initReservationsPreview(){
  const cfgBtn = document.getElementById('openSheetRvConfigBtn');
  const slotsBtn = document.getElementById('openSheetRvSlotsBtn');
  const blkBtn = document.getElementById('openSheetRvBlockedBtn');
  const licBtn = document.getElementById('openSheetRvLicenciesBtn');
  if (cfgBtn)   cfgBtn.href   = RV_ADMIN_CONFIG.sheetConfigUrl    || '#';
  if (slotsBtn) slotsBtn.href = RV_ADMIN_CONFIG.sheetSlotsUrl     || '#';
  if (blkBtn)   blkBtn.href   = RV_ADMIN_CONFIG.sheetBlockedUrl   || '#';
  if (licBtn)   licBtn.href   = RV_ADMIN_CONFIG.sheetLicenciesUrl || '#';

  const refreshBtn = document.getElementById('refreshRvBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadReservationsPreview);

  const exportBtn = document.getElementById('rvExportCsvBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportReservationsCsv);

  loadReservationsPreview();
}

async function loadReservationsPreview(){
  const statusEl = document.getElementById('rvStatus');
  if (statusEl) statusEl.textContent = 'Chargement...';

  const resSources = [];
  if (RV_ADMIN_CONFIG.reservationsPubUrl) resSources.push(RV_ADMIN_CONFIG.reservationsPubUrl);
  if (RV_ADMIN_CONFIG.reservationsCsv) resSources.push(RV_ADMIN_CONFIG.reservationsCsv);

  const blkSources = [];
  if (RV_ADMIN_CONFIG.blockedPubUrl) blkSources.push(RV_ADMIN_CONFIG.blockedPubUrl);
  if (RV_ADMIN_CONFIG.blockedCsv) blkSources.push(RV_ADMIN_CONFIG.blockedCsv);

  const licSources = [];
  if (RV_ADMIN_CONFIG.licenciesPubUrl) licSources.push(RV_ADMIN_CONFIG.licenciesPubUrl);
  if (RV_ADMIN_CONFIG.licenciesCsv) licSources.push(RV_ADMIN_CONFIG.licenciesCsv);

  async function loadAny(urls){
    for (const u of urls){
      try { const t = await fetchCSVAdmin(u); const p = parseCSV(t); return p; }
      catch(e) { console.warn('RV source inaccessible :', u, e); }
    }
    return [];
  }

  const [reservations, blocked, licencies] = await Promise.all([
    loadAny(resSources),
    loadAny(blkSources),
    loadAny(licSources)
  ]);

  renderRvStats(reservations, blocked, licencies);
  renderRvTable(reservations);

  if (statusEl){
    statusEl.textContent = reservations.length
      ? reservations.length + ' réservation(s) chargée(s)'
      : 'Aucune réservation (normal, le paiement n\'est pas encore branché)';
  }
}

function renderRvStats(reservations, blocked, licencies){
  const now = new Date();
  const today = new Date(now); today.setHours(0,0,0,0);
  const in7 = new Date(today); in7.setDate(in7.getDate()+7);
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const isConfirmed = r => ['confirmed','pending','confirmée'].includes((r.statut||'').toLowerCase());
  const isActive = v => /^(x|1|true|oui|yes)$/i.test(String(v||'').trim());
  const parseD = s => {
    const m = String(s||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
  };

  const upcoming = reservations.filter(r => {
    const d = parseD(r.date);
    return d && d >= today && d <= in7 && isConfirmed(r);
  });

  const monthRes = reservations.filter(r => {
    const d = parseD(r.date);
    return d && d >= startMonth && isConfirmed(r);
  });
  const revenue = monthRes.reduce((sum, r) => sum + (Number(r.montant)||0), 0);

  const licenciesActifs = (licencies || []).filter(l => isActive(l.actif)).length;

  const blockedFuture = (blocked || []).filter(b => {
    const d = parseD(b.date);
    return d && d >= today && isActive(b.actif);
  });

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('rvStatUpcoming',  String(upcoming.length));
  setText('rvStatRevenue',   revenue.toFixed(2).replace('.', ',') + ' €');
  setText('rvStatLicencies', String(licenciesActifs));
  setText('rvStatBlocked',   String(blockedFuture.length));
}

function renderRvTable(reservations){
  const body = document.getElementById('rvTableBody');
  if (!body) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = reservations.filter(r => {
    const m = String(r.date||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return false;
    const d = new Date(+m[1], +m[2]-1, +m[3]);
    return d >= today && ['confirmed','pending','confirmée'].includes((r.statut||'').toLowerCase());
  }).sort((a,b) => (a.date+a.heure_debut).localeCompare(b.date+b.heure_debut));

  if (!upcoming.length){
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:28px">Aucune réservation à venir pour l\'instant.</td></tr>';
    return;
  }

  const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = s => {
    const m = String(s||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return s;
    const d = new Date(+m[1], +m[2]-1, +m[3]);
    return d.toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit', month:'short' });
  };
  const fmtDuree = min => {
    const n = Number(min) || 0;
    if (n === 60) return '1 h';
    if (n === 90) return '1 h 30';
    if (n === 120) return '2 h';
    return n + ' min';
  };

  body.innerHTML = upcoming.map(r => `
    <tr>
      <td>${esc(fmtDate(r.date))}</td>
      <td>${esc(r.heure_debut||'—')} → ${esc(r.heure_fin||'—')}</td>
      <td>${esc(fmtDuree(r.duree))}</td>
      <td class="name-col">${esc((r.prenom||'') + ' ' + (r.nom||''))}</td>
      <td class="email-col">${esc(r.email||'')}<br>${esc(r.telephone||'')}</td>
      <td>${/^(oui|yes|x|1|true)$/i.test(r.licencie||'')
        ? '<span class="sport-badge badminton">Licencié</span>'
        : '<span class="sport-badge pickle">Externe</span>'}</td>
      <td class="price-col">${esc(r.montant||'0')} €</td>
      <td><span class="status-badge ${/confirmed/i.test(r.statut||'') ? 'confirmee' : 'en-attente'}">${esc(r.statut||'—')}</span></td>
      <td class="actions-col">
        <button type="button" class="act-btn cancel" disabled title="Disponible après branchement Stripe">Annuler</button>
      </td>
    </tr>
  `).join('');
}

function exportReservationsCsv(){
  // Récupère la source CSV actuelle et propose le téléchargement
  const url = RV_ADMIN_CONFIG.reservationsPubUrl || RV_ADMIN_CONFIG.reservationsCsv;
  if (!url){ alert('Aucune source de réservations configurée.'); return; }
  const ts = new Date().toISOString().slice(0,10);
  fetchCSVAdmin(url).then(text => {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reservations-bcco-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }).catch(e => {
    console.error(e);
    alert('Export impossible : ' + e.message);
  });
}

/* =================================================================
   UTILITAIRES CSV — partagés entre loadRencontresPreview et loadActusPreview
================================================================== */
function parseCSV(text){
  if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const rows=[]; let i=0, f='', r=[], inQ=false;
  while(i<text.length){
    const c=text[i];
    if(inQ){ if(c==='"'&&text[i+1]==='"'){f+='"';i+=2;continue;} if(c==='"'){inQ=false;i++;continue;} f+=c;i++;continue; }
    if(c==='"'){inQ=true;i++;continue;}
    if(c===','){r.push(f);f='';i++;continue;}
    if(c==='\n'||c==='\r'){ if(f.length||r.length){r.push(f);rows.push(r);} r=[];f=''; if(c==='\r'&&text[i+1]==='\n')i+=2; else i++; continue; }
    f+=c;i++;
  }
  if(f.length||r.length){r.push(f);rows.push(r);}
  if(!rows.length) return [];
  const h=rows[0].map(x=>x.trim());
  return rows.slice(1).filter(x=>x.some(v=>v&&v.trim())).map(x=>{ const o={}; h.forEach((k,idx)=>o[k]=(x[idx]||'').trim()); return o; });
}
async function fetchCSVAdmin(url){
  const busted = url + (url.includes('?')?'&':'?') + 't=' + Date.now();
  const res = await fetch(busted,{cache:'no-cache'});
  if(!res.ok) throw new Error('HTTP '+res.status);
  return res.text();
}

/* =================================================================
   APERCU RENCONTRES (Top 12 & N2) — lecture seule
================================================================== */
const RENCONTRES_ADMIN_CONFIG = {
  sheetEditUrl: 'https://github.com/theomeurr/ChamblyBad/edit/main/data/rencontres.csv',
  csvUrl: '',
  csvFallback: 'data/rencontres.csv'
};

function initRencontresPreview(){
  const openBtn = document.getElementById('openSheetRencontresBtn');
  const refreshBtn = document.getElementById('refreshRencontresBtn');
  if(openBtn) openBtn.href = RENCONTRES_ADMIN_CONFIG.sheetEditUrl || '#';
  if(refreshBtn) refreshBtn.addEventListener('click', loadRencontresPreview);
  loadRencontresPreview();
}

async function loadRencontresPreview(){
  const topEl = document.getElementById('rencontresTop12List');
  const n2El = document.getElementById('rencontresN2List');
  const statusEl = document.getElementById('rencontresStatus');
  if(!topEl || !n2El) return;
  statusEl.textContent = 'Chargement...';
  topEl.innerHTML = ''; n2El.innerHTML = '';

  const urls = [];
  if(RENCONTRES_ADMIN_CONFIG.csvUrl) urls.push({url:RENCONTRES_ADMIN_CONFIG.csvUrl, src:'Google Sheets'});
  if(RENCONTRES_ADMIN_CONFIG.csvFallback) urls.push({url:RENCONTRES_ADMIN_CONFIG.csvFallback, src:'data/rencontres.csv'});

  let rows = [], sourceUsed = null;
  for(const u of urls){
    try{ const t = await fetchCSVAdmin(u.url); const p = parseCSV(t); if(p.length){ rows = p; sourceUsed = u.src; break; } }
    catch(e){ console.warn('Rencontres source inaccessible :',u.url,e); }
  }

  function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function isActive(v){ return /^(x|1|true|oui|yes)$/i.test(String(v||'').trim()); }
  function parseD(s){
    const m=String(s||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
  }

  const today = new Date(); today.setHours(0,0,0,0);

  function renderTeam(el, matches){
    if(!matches.length){
      el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--line);border-radius:10px;background:var(--surface)">Aucune rencontre. Modifie <code>data/rencontres.csv</code> sur GitHub.</div>`;
      return;
    }
    el.innerHTML = matches.map(r => {
      const active = !r.actif || isActive(r.actif);
      const d = parseD(r.date);
      const future = d && d >= today;
      const home = isActive(r.domicile);
      const opp = esc(r.adversaire || '—');
      const line = home
        ? `<strong>Chambly</strong> <span style="color:var(--muted);font-size:11px;margin:0 4px">vs</span> ${opp}`
        : `${opp} <span style="color:var(--muted);font-size:11px;margin:0 4px">vs</span> <strong>Chambly</strong>`;
      const statusDot = future
        ? `<span style="width:6px;height:6px;border-radius:50%;background:var(--gold-2);display:inline-block" title="A venir"></span>`
        : `<span style="width:6px;height:6px;border-radius:50%;background:#9ca3af;display:inline-block" title="Passe"></span>`;
      const bg = active ? 'var(--surface)' : 'rgba(239,68,68,.04)';
      const border = active ? 'var(--line)' : 'rgba(239,68,68,.3)';
      const draftBadge = active ? '' : `<span style="background:rgba(239,68,68,.1);color:#ef4444;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px">BROUILLON</span>`;
      const tag = esc(r.tag || (home ? 'Domicile' : 'Extérieur'));
      return `
        <div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px">
          ${statusDot}
          <span style="font-family:'Anton',sans-serif;font-weight:400;font-size:12px;color:var(--secondary);min-width:60px">${esc(r.date_affichage || '—')}</span>
          <span style="flex:1;font-size:13px;color:var(--text)">${line}${draftBadge}</span>
          <span style="font-size:10px;font-weight:700;color:var(--muted);background:var(--bg-2);padding:3px 8px;border-radius:5px;letter-spacing:.03em">${tag}</span>
        </div>`;
    }).join('');
  }

  const sorted = rows
    .map(r => ({...r, _d: parseD(r.date)}))
    .sort((a,b) => {
      const da=a._d, db=b._d;
      if(!da&&!db) return 0;
      if(!da) return 1;
      if(!db) return -1;
      const af=da>=today, bf=db>=today;
      if(af&&!bf) return -1;
      if(!af&&bf) return 1;
      if(af&&bf) return da-db;
      return db-da;
    });
  const top = sorted.filter(r => (r.equipe||'').toLowerCase() === 'top12');
  const n2 = sorted.filter(r => {
    const e = (r.equipe||'').toLowerCase();
    return e === 'n2' || e === 'nationale 2' || e === 'nationale2';
  });

  if (!sourceUsed) {
    const errHtml = '<div class="empty-state"><p>Sources inaccessibles — vérifiez votre connexion ou la publication du Google Sheets.</p></div>';
    topEl.innerHTML = errHtml;
    n2El.innerHTML = errHtml;
    statusEl.textContent = 'Aucune donnée accessible';
    return;
  }

  renderTeam(topEl, top);
  renderTeam(n2El, n2);

  const total = rows.length;
  const drafts = rows.filter(r => r.actif && !isActive(r.actif)).length;
  statusEl.textContent = sourceUsed
    ? `${total} rencontre${total>1?'s':''} · Top 12 : ${top.length} · N2 : ${n2.length}${drafts?` · ${drafts} brouillon${drafts>1?'s':''}`:''} · source : ${sourceUsed}`
    : 'Aucune donnée accessible';
}

/* =================================================================
   APERCU ACTUALITES (lecture seule depuis Google Sheets / CSV local)
   -----------------------------------------------------------------
   Pour que le bouton "Modifier dans Google Sheets" fonctionne,
   renseigne l'URL d'EDITION (pas la CSV publiee) ci-dessous :
================================================================== */
const ACTUS_ADMIN_CONFIG = {
  sheetEditUrl: 'https://github.com/theomeurr/ChamblyBad/edit/main/data/actualites.csv',
  actusCsvUrl: '',
  actusCsvFallback: 'data/actualites.csv'
};

function initActusPreview(){
  const openBtn = document.getElementById('openSheetBtn');
  const refreshBtn = document.getElementById('refreshActusBtn');
  if(openBtn) openBtn.href = ACTUS_ADMIN_CONFIG.sheetEditUrl || '#';
  if(refreshBtn) refreshBtn.addEventListener('click',loadActusPreview);
  loadActusPreview();
}

async function loadActusPreview(){
  const previewEl = document.getElementById('actusPreview');
  const emptyEl = document.getElementById('actusEmpty');
  const statusEl = document.getElementById('actusStatus');
  statusEl.textContent = 'Chargement...';
  previewEl.innerHTML = '';
  emptyEl.style.display = 'none';

  const urls = [];
  if(ACTUS_ADMIN_CONFIG.actusCsvUrl) urls.push({url:ACTUS_ADMIN_CONFIG.actusCsvUrl, src:'Google Sheets'});
  if(ACTUS_ADMIN_CONFIG.actusCsvFallback) urls.push({url:ACTUS_ADMIN_CONFIG.actusCsvFallback, src:'data/actualites.csv'});

  let rows = [], sourceUsed = null;
  for(const u of urls){
    try{ const t = await fetchCSVAdmin(u.url); const parsed = parseCSV(t); if(parsed.length){ rows = parsed; sourceUsed = u.src; break; } }
    catch(e){ console.warn('Actus source inaccessible :', u.url, e); }
  }

  if(!rows.length){
    emptyEl.style.display = 'block';
    statusEl.textContent = sourceUsed ? 'Aucune actualité' : 'Sources inaccessibles — vérifiez votre connexion';
    return;
  }

  function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function isActive(v){ return /^(x|1|true|oui|yes)$/i.test(String(v||'').trim()); }

  const publies = rows.filter(r => !('actif' in r) || !r.actif || isActive(r.actif)).length;
  const brouillons = rows.length - publies;

  previewEl.innerHTML = rows.map((r,idx) => {
    const published = (!('actif' in r) || !r.actif || isActive(r.actif));
    const tag = (r.tag||'event').toLowerCase();
    const tagLabel = r.tag_label || r.tag || '';
    const bg = published ? '#fff' : 'rgba(239,68,68,.04)';
    const border = published ? 'var(--line)' : 'rgba(239,68,68,.2)';
    const badge = published
      ? '<span style="background:rgba(165,235,120,.2);color:var(--gold-2);padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">En ligne</span>'
      : '<span style="background:rgba(239,68,68,.1);color:#ef4444;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Brouillon</span>';
    const tagColor = tag==='match' ? '#ef4444' : (tag==='tournoi' ? 'var(--gold-2)' : 'var(--secondary)');
    const tagBg = tag==='match' ? 'rgba(239,68,68,.1)' : (tag==='tournoi' ? 'rgba(165,235,120,.15)' : 'rgba(10,25,136,.08)');

    return `
      <div style="background:${bg};border:1px solid ${border};border-radius:12px;overflow:hidden;display:flex;flex-direction:column">
        ${r.image ? `<div style="aspect-ratio:16/9;overflow:hidden;background:var(--bg-2)"><img src="${esc(r.image)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"/></div>` : ''}
        <div style="padding:14px;display:flex;flex-direction:column;gap:6px;flex:1">
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${badge}
            ${tagLabel ? `<span style="background:${tagBg};color:${tagColor};padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700">${esc(tagLabel)}</span>` : ''}
          </div>
          ${r.date_affichage ? `<div style="font-size:11px;color:var(--muted);font-weight:600">${esc(r.date_affichage)}</div>` : ''}
          <div style="font-family:'Anton',sans-serif;font-weight:400;font-size:14px;color:var(--text);line-height:1.3">${esc(r.titre||'(sans titre)')}</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(r.resume||'')}</div>
        </div>
      </div>`;
  }).join('');

  statusEl.textContent = `${publies} en ligne${brouillons?` · ${brouillons} brouillon${brouillons>1?'s':''}`:''} · source : ${sourceUsed}`;
}

