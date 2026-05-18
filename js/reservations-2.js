
(async function bookingApp(){
  // === CONFIG Google Sheets (mêmes données, onglets du classeur BCCO) ===
  // données locales — éditer les fichiers dans data/reservations/
  const CONFIG_URL       = ''; const CONFIG_FALLBACK  = 'data/reservations/config.csv';
  const SLOTS_URL        = ''; const SLOTS_FALLBACK   = 'data/reservations/creneaux_ouverts.csv';
  const BLOCKED_URL      = ''; const BLOCKED_FALLBACK = 'data/reservations/creneaux_bloques.csv';
  const RESERVATIONS_URL = ''; const RESERVATIONS_FALLBACK = 'data/reservations/reservations.csv';
  const LICENCIES_URL    = ''; const LICENCIES_FALLBACK = 'data/reservations/licencies.csv';

  // === HELPERS ===
  function parseCSV(text){
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = []; let i=0, field='', row=[], inQ=false;
    while (i<text.length){
      const c=text[i];
      if (inQ){
        if (c==='"' && text[i+1]==='"'){ field+='"'; i+=2; continue; }
        if (c==='"'){ inQ=false; i++; continue; }
        field+=c; i++; continue;
      }
      if (c==='"'){ inQ=true; i++; continue; }
      if (c===','){ row.push(field); field=''; i++; continue; }
      if (c==='\n' || c==='\r'){
        if (field.length || row.length){ row.push(field); rows.push(row); }
        row=[]; field='';
        if (c==='\r' && text[i+1]==='\n') i+=2; else i++;
        continue;
      }
      field+=c; i++;
    }
    if (field.length || row.length){ row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).filter(r => r.some(v => v && v.trim())).map(r => {
      const o = {}; headers.forEach((h, idx) => o[h] = (r[idx] || '').trim()); return o;
    });
  }
  async function fetchCSV(url, { timeout = 7000, retries = 2 } = {}){
    const busted = url + (url.includes('?')?'&':'?') + 't=' + Date.now();
    let lastErr;
    for (let attempt=0; attempt<=retries; attempt++){
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(busted, { cache: 'no-cache', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP '+res.status);
        return res.text();
      } catch(e){
        clearTimeout(timer);
        lastErr = e;
        if (attempt<retries) await new Promise(r => setTimeout(r, 400*(attempt+1)));
      }
    }
    throw lastErr;
  }
  async function loadCSV(remoteUrl, fallbackUrl){
    const urls = [];
    if (remoteUrl) urls.push(remoteUrl);
    if (fallbackUrl) urls.push(fallbackUrl);
    for (const url of urls){
      try { return parseCSV(await fetchCSV(url)); }
      catch(e){ console.warn('CSV inaccessible:', url, e); }
    }
    return [];
  }
  function isActive(v){ return /^(x|1|true|oui|yes)$/i.test(String(v||'').trim()); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function ymd(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function hhmmToMin(s){ const [h,m]=s.split(':').map(Number); return h*60+m; }
  function minToHhmm(m){ return pad(Math.floor(m/60))+':'+pad(m%60); }
  function startOfWeek(d){
    const x = new Date(d); x.setHours(0,0,0,0);
    const day = (x.getDay()+6)%7; // lundi=0
    x.setDate(x.getDate()-day);
    return x;
  }
  const DAY_NAMES_FR = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  const DAY_LABELS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const MONTH_LABELS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

  // === ÉTAT ===
  const state = {
    config: {},
    openSlots: [],      // creneaux_ouverts
    blocked: [],        // creneaux_bloques
    reservations: [],   // reservations confirmées
    currentWeekStart: startOfWeek(new Date()),
    selected: null,     // { date: 'YYYY-MM-DD', start: 'HH:MM' }
  };

  // === CHARGEMENT ===
  const [configRows, openRows, blockedRows, resRows, licenciesRows] = await Promise.all([
    loadCSV(CONFIG_URL, CONFIG_FALLBACK),
    loadCSV(SLOTS_URL, SLOTS_FALLBACK),
    loadCSV(BLOCKED_URL, BLOCKED_FALLBACK),
    loadCSV(RESERVATIONS_URL, RESERVATIONS_FALLBACK),
    loadCSV(LICENCIES_URL, LICENCIES_FALLBACK),
  ]);

  // Config en objet
  for (const r of configRows){
    if (r.cle) state.config[r.cle] = r.valeur;
  }
  state.openSlots = openRows.filter(r => isActive(r.actif));
  state.blocked = blockedRows.filter(r => isActive(r.actif));
  state.reservations = resRows.filter(r => ['confirmed','pending'].includes((r.statut||'').toLowerCase()));
  // Index des licenciés actifs — on garde plusieurs variantes pour être tolérant
  // (Google Sheets supprime parfois les zéros initiaux si la colonne n'est pas en texte)
  state.licencies = new Map();
  function normalizeLicence(n){
    return String(n||'').trim().toLowerCase().replace(/^0+/, '');  // retire les zéros en tête
  }
  licenciesRows.filter(r => isActive(r.actif)).forEach(r => {
    const raw = String(r.numero_licence||'').trim().toLowerCase();
    const norm = normalizeLicence(raw);
    if (raw) state.licencies.set(raw, r);
    if (norm && norm !== raw) state.licencies.set(norm, r);
  });

  // Valeurs par défaut si config absente
  const C = {
    tarif_1h:    Number(state.config.tarif_1h)    || 16,
    tarif_1h30:  Number(state.config.tarif_1h30)  || 24,
    tarif_2h:    Number(state.config.tarif_2h)    || 32,
    reduction:   Number(state.config.reduction_licencie_pct) || 0,
    anticipation:Number(state.config.anticipation_jours)     || 14,
    annulation:  Number(state.config.annulation_heures_avant)|| 24,
    email:       state.config.email_contact || 'contact@chamblybadminton.fr',
    halle_adresse: state.config.halle_adresse || 'Halle Marie-Amélie Le Fur, Chambly 60230',
  };

  // === RENDU HEAD + TARIFS ===
  document.getElementById('rv-adresse').textContent = C.halle_adresse;
  document.getElementById('rv-anticipation').textContent = C.anticipation;
  document.getElementById('rv-annulation').textContent = C.annulation + 'h';
  document.getElementById('rv-contact-email').textContent = C.email;

  // Tarif réduit licencié (utilisé pour affichage)
  function reducedPrice(price){
    if (!C.reduction) return price;
    return Math.round((price * (100 - C.reduction)) / 100 * 100) / 100;
  }
  const tarifsEl = document.getElementById('rv-tarifs');
  const tarifData = [
    { label: '1 heure',    price: C.tarif_1h },
    { label: '1 h 30',     price: C.tarif_1h30 },
    { label: '2 heures',   price: C.tarif_2h },
  ];
  tarifsEl.innerHTML = tarifData.map(t => {
    const red = reducedPrice(t.price);
    return `
      <div class="rv-tarif-card">
        <span class="rv-tarif-duree">${t.label}</span>
        <span class="rv-tarif-prix">${t.price} €</span>
        ${C.reduction ? `<span class="rv-tarif-licencie">Licencié BCCO : ${red} € (−${C.reduction}%)</span>` : ''}
      </div>
    `;
  }).join('');

  // Met à jour les prix dans la modale
  document.getElementById('rv-price-60').textContent = C.tarif_1h + ' €';
  document.getElementById('rv-price-90').textContent = C.tarif_1h30 + ' €';
  document.getElementById('rv-price-120').textContent = C.tarif_2h + ' €';
  document.getElementById('rv-licencie-tag').textContent = C.reduction ? ('−' + C.reduction + '%') : '';
  if (!C.reduction) document.getElementById('rv-licencie-tag').style.display = 'none';

  // === GRID CALCUL ===
  function buildSlotsForDay(date){
    // date : Date object
    const jour = DAY_NAMES_FR[(date.getDay()+6)%7];
    const opening = state.openSlots.find(s => (s.jour||'').toLowerCase() === jour);
    if (!opening) return { windows: [] };
    return {
      windows: [{
        start: hhmmToMin(opening.heure_debut),
        end:   hhmmToMin(opening.heure_fin),
      }]
    };
  }
  function isBlocked(dateStr, startMin, endMin){
    return state.blocked.some(b => {
      if (b.date !== dateStr) return false;
      const bs = hhmmToMin(b.heure_debut);
      const be = hhmmToMin(b.heure_fin);
      return (startMin < be && endMin > bs);
    });
  }
  function isBooked(dateStr, startMin, endMin){
    return state.reservations.some(r => {
      if (r.date !== dateStr) return false;
      const rs = hhmmToMin(r.heure_debut);
      const re = hhmmToMin(r.heure_fin);
      return (startMin < re && endMin > rs);
    });
  }
  function isPast(date, startMin){
    const now = new Date();
    if (ymd(date) > ymd(now)) return false;
    if (ymd(date) < ymd(now)) return true;
    return startMin <= (now.getHours()*60 + now.getMinutes());
  }
  function isBeyondHorizon(date){
    const horizon = new Date();
    horizon.setHours(23,59,59,999);
    horizon.setDate(horizon.getDate() + C.anticipation);
    return date > horizon;
  }

  // === RENDU GRILLE ===
  const gridEl = document.getElementById('rv-grid');
  const weekTitleEl = document.getElementById('rv-week-title');
  const prevBtn = document.getElementById('rv-prev');
  const nextBtn = document.getElementById('rv-next');

  function renderWeek(){
    const ws = state.currentWeekStart;
    const we = new Date(ws); we.setDate(we.getDate()+6);
    weekTitleEl.textContent = formatWeekLabel(ws, we);

    // Désactive "précédent" si on est déjà sur la semaine courante
    const thisWeek = startOfWeek(new Date());
    prevBtn.disabled = ws.getTime() <= thisWeek.getTime();

    // Détermine toutes les heures possibles (union des fenêtres de chaque jour)
    const days = [];
    let minStart = 24*60, maxEnd = 0;
    for (let i=0; i<7; i++){
      const d = new Date(ws); d.setDate(ws.getDate()+i);
      const info = buildSlotsForDay(d);
      if (info.windows.length){
        minStart = Math.min(minStart, info.windows[0].start);
        maxEnd = Math.max(maxEnd, info.windows[0].end);
      }
      days.push({ date: d, info });
    }
    if (minStart >= maxEnd){
      gridEl.innerHTML = '<div class="rv-state">Aucun créneau ouvert sur cette semaine.</div>';
      return;
    }

    // Créneaux d'1 heure alignés sur l'heure pleine
    const SLOT_STEP = 60; // minutes par ligne
    const hours = [];
    for (let m = Math.floor(minStart/60)*60; m < maxEnd; m += SLOT_STEP){
      hours.push(m);
    }

    // Header (jours)
    let html = '<div class="rv-grid-head"><div></div>';
    const today = ymd(new Date());
    days.forEach(({date}) => {
      const dayIdx = (date.getDay()+6)%7;
      const isToday = ymd(date) === today;
      html += `<div class="rv-grid-day ${isToday?'today':''}">
        <span class="day-name">${DAY_LABELS_SHORT[dayIdx]}</span>
        <span class="day-num">${pad(date.getDate())}/${pad(date.getMonth()+1)}</span>
      </div>`;
    });
    html += '</div>';

    // Lignes horaires
    for (const hm of hours){
      html += `<div class="rv-time-label">${minToHhmm(hm)}</div>`;
      for (const { date, info } of days){
        const endSlot = hm + SLOT_STEP;
        const dstr = ymd(date);
        // Dans la fenêtre d'ouverture ?
        const inWindow = info.windows.some(w => hm >= w.start && endSlot <= w.end);
        if (!inWindow){
          html += `<div class="rv-slot blocked">—</div>`;
          continue;
        }
        // Horizon ?
        if (isBeyondHorizon(date)){
          html += `<div class="rv-slot blocked" title="Au-delà de la fenêtre de réservation">·</div>`;
          continue;
        }
        // Passé ?
        if (isPast(date, hm)){
          html += `<div class="rv-slot past">—</div>`;
          continue;
        }
        // Bloqué ?
        if (isBlocked(dstr, hm, endSlot)){
          const reason = (state.blocked.find(b => b.date===dstr) || {}).raison || '';
          html += `<div class="rv-slot blocked" title="${escapeHtml(reason)}">${escapeHtml(reason.slice(0,10))||'—'}</div>`;
          continue;
        }
        // Réservé ?
        if (isBooked(dstr, hm, endSlot)){
          html += `<div class="rv-slot booked">Réservé</div>`;
          continue;
        }
        // Libre
        html += `<button type="button" class="rv-slot free" data-date="${dstr}" data-start="${minToHhmm(hm)}">Libre</button>`;
      }
    }

    gridEl.innerHTML = html;

    // Event listeners
    gridEl.querySelectorAll('.rv-slot.free').forEach(btn => {
      btn.addEventListener('click', () => {
        openModal({ date: btn.dataset.date, start: btn.dataset.start });
      });
    });
  }

  function formatWeekLabel(ws, we){
    const mStart = MONTH_LABELS[ws.getMonth()];
    const mEnd = MONTH_LABELS[we.getMonth()];
    if (ws.getMonth() === we.getMonth()){
      return `Semaine du ${ws.getDate()} au ${we.getDate()} ${mEnd} ${we.getFullYear()}`;
    }
    return `Semaine du ${ws.getDate()} ${mStart} au ${we.getDate()} ${mEnd} ${we.getFullYear()}`;
  }
  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  prevBtn.addEventListener('click', () => {
    const d = new Date(state.currentWeekStart); d.setDate(d.getDate()-7);
    if (d.getTime() < startOfWeek(new Date()).getTime()) return;
    state.currentWeekStart = d;
    renderWeek();
    renderMobileWeek();
  });
  nextBtn.addEventListener('click', () => {
    const d = new Date(state.currentWeekStart); d.setDate(d.getDate()+7);
    state.currentWeekStart = d;
    renderWeek();
    renderMobileWeek();
  });

  renderWeek();

  // === VUE MOBILE JOUR PAR JOUR ===
  const chipsEl = document.getElementById('rv-day-chips');
  const daySlotsEl = document.getElementById('rv-day-slots');
  state.selectedDayIndex = 0; // index 0-6 dans la semaine courante

  function renderMobileWeek(){
    const ws = state.currentWeekStart;
    const today = ymd(new Date());
    chipsEl.innerHTML = '';
    for (let i=0; i<7; i++){
      const d = new Date(ws); d.setDate(ws.getDate()+i);
      const dstr = ymd(d);
      const dayIdx = (d.getDay()+6)%7;
      const info = buildSlotsForDay(d);
      const hasSlots = info.windows.length > 0 && !isBeyondHorizon(d);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'rv-day-chip' +
        (dstr === today ? ' today' : '') +
        (i === state.selectedDayIndex ? ' active' : '') +
        (!hasSlots ? ' no-slots' : '');
      chip.innerHTML = `<span class="chip-name">${DAY_LABELS_SHORT[dayIdx]}</span><span class="chip-num">${pad(d.getDate())}</span>`;
      chip.addEventListener('click', () => {
        state.selectedDayIndex = i;
        renderMobileWeek();
        renderMobileDay();
      });
      chipsEl.appendChild(chip);
    }
    renderMobileDay();
  }

  function renderMobileDay(){
    const ws = state.currentWeekStart;
    const d = new Date(ws); d.setDate(ws.getDate() + state.selectedDayIndex);
    const dstr = ymd(d);
    const info = buildSlotsForDay(d);
    const SLOT_STEP = 60;

    if (!info.windows.length){
      daySlotsEl.innerHTML = '<div class="rv-day-empty">Aucun créneau ouvert ce jour.</div>';
      return;
    }
    if (isBeyondHorizon(d)){
      daySlotsEl.innerHTML = '<div class="rv-day-empty">Ce jour est au-delà de la fenêtre de réservation.</div>';
      return;
    }

    const w = info.windows[0];
    const rows = [];
    for (let m = Math.floor(w.start/60)*60; m < w.end; m += SLOT_STEP){
      const end = m + SLOT_STEP;
      const startStr = minToHhmm(m);
      const endStr = minToHhmm(end);

      let type, badge, clickable = false;
      if (isPast(d, m)){
        type = 'past'; badge = 'Passé';
      } else if (isBlocked(dstr, m, end)){
        const reason = (state.blocked.find(b => b.date===dstr) || {}).raison || 'Indisponible';
        type = 'blocked'; badge = escapeHtml(reason.slice(0,16));
      } else if (isBooked(dstr, m, end)){
        type = 'booked'; badge = 'Réservé';
      } else {
        type = 'free'; badge = 'Libre'; clickable = true;
      }

      const row = document.createElement(clickable ? 'button' : 'div');
      row.type = clickable ? 'button' : undefined;
      row.className = `rv-slot-row ${type}`;
      row.innerHTML = `<span class="slot-time">${startStr}<span class="slot-arrow"> → </span>${endStr}</span><span class="slot-badge">${badge}</span>`;
      if (clickable){
        row.addEventListener('click', () => openModal({ date: dstr, start: startStr }));
      }
      rows.push(row);
    }

    daySlotsEl.innerHTML = '';
    rows.forEach(r => daySlotsEl.appendChild(r));
  }

  // Sélectionner aujourd'hui si dans la semaine courante, sinon le premier jour
  const todayDate = new Date(); todayDate.setHours(0,0,0,0);
  const todayOff = Math.round((todayDate - state.currentWeekStart) / 86400000);
  state.selectedDayIndex = (todayOff >= 0 && todayOff < 7) ? todayOff : 0;
  renderMobileWeek();

  // === MODAL ===
  const modal = document.getElementById('rv-modal');
  const modalSubtitle = document.getElementById('rv-modal-subtitle');
  const durationBtns = document.querySelectorAll('.rv-duration-btn');
  const licencieCheckbox = document.getElementById('rv-licencie');
  const licencieLabel = document.getElementById('rv-licencie-label');
  const licenceField = document.getElementById('rv-licence-field');
  const numeroLicence = document.getElementById('rv-numero-licence');
  const recapMeta = document.getElementById('rv-recap-meta');
  const recapTotal = document.getElementById('rv-recap-total');
  const recapOld = document.getElementById('rv-recap-old');
  const submitAmount = document.getElementById('rv-submit-amount');
  const form = document.getElementById('rv-form');
  const licenceStatus = document.getElementById('rv-licence-status');

  // Vérifie le numéro de licence contre la liste (tolère la présence/absence de zéros initiaux)
  function verifyLicence(num){
    const key = String(num||'').trim().toLowerCase();
    if (!key) return { ok: false, reason: 'empty' };
    const norm = key.replace(/^0+/, '');
    const match = state.licencies.get(key) || state.licencies.get(norm);
    return match ? { ok: true, match } : { ok: false, reason: 'not_found' };
  }
  function updateLicenceStatus(){
    if (!licencieCheckbox.checked){
      licenceStatus.innerHTML = '';
      licenceStatus.style.color = 'var(--muted)';
      return;
    }
    const v = numeroLicence.value.trim();
    if (!v){
      licenceStatus.textContent = 'Saisissez votre numéro pour bénéficier du tarif réduit.';
      licenceStatus.style.color = 'var(--muted)';
      return;
    }
    const r = verifyLicence(v);
    if (r.ok){
      const nom = ((r.match.prenom||'') + ' ' + (r.match.nom||'')).trim();
      licenceStatus.innerHTML = '✅ Licence reconnue' + (nom ? ' · ' + escapeHtml(nom) : '') + ' — tarif réduit appliqué.';
      licenceStatus.style.color = '#16a34a';
    } else {
      licenceStatus.innerHTML = '⚠️ Numéro non trouvé dans la liste des licenciés actifs. Vérifiez la saisie. Sans correspondance, le tarif public s\'applique.';
      licenceStatus.style.color = '#d97706';
    }
  }

  function openModal(slot){
    state.selected = slot;
    const d = new Date(slot.date + 'T' + slot.start);
    const jour = DAY_LABELS_SHORT[(d.getDay()+6)%7];
    const dateLabel = `${jour} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]} · ${slot.start}`;
    modalSubtitle.textContent = dateLabel;
    // Reset durée = 60
    durationBtns.forEach(b => b.classList.toggle('active', b.dataset.duration === '60'));
    licencieCheckbox.checked = false;
    licencieLabel.classList.remove('checked');
    licenceField.classList.remove('show');
    numeroLicence.value = '';
    form.reset();
    modal.classList.add('open');
    updateRecap();
    setTimeout(() => document.getElementById('rv-prenom').focus(), 100);
  }
  function closeModal(){
    modal.classList.remove('open');
    state.selected = null;
  }
  document.getElementById('rv-modal-close').addEventListener('click', closeModal);
  document.getElementById('rv-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Durée
  durationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      durationBtns.forEach(b => b.classList.toggle('active', b === btn));
      updateRecap();
    });
  });

  // Licencié checkbox
  licencieCheckbox.addEventListener('change', () => {
    licencieLabel.classList.toggle('checked', licencieCheckbox.checked);
    licenceField.classList.toggle('show', licencieCheckbox.checked);
    if (licencieCheckbox.checked) numeroLicence.setAttribute('required','');
    else numeroLicence.removeAttribute('required');
    updateLicenceStatus();
    updateRecap();
  });

  // Vérification en direct pendant la saisie
  numeroLicence.addEventListener('input', () => {
    updateLicenceStatus();
    updateRecap();
  });

  function currentDuration(){
    const btn = document.querySelector('.rv-duration-btn.active');
    return Number(btn?.dataset.duration || 60);
  }
  function currentPrice(){
    const dur = currentDuration();
    if (dur === 60)  return C.tarif_1h;
    if (dur === 90)  return C.tarif_1h30;
    if (dur === 120) return C.tarif_2h;
    return C.tarif_1h;
  }
  // La réduction n'est appliquée que si le numéro de licence est reconnu
  function isLicencieVerified(){
    if (!licencieCheckbox.checked) return false;
    return verifyLicence(numeroLicence.value).ok;
  }

  function updateRecap(){
    if (!state.selected) return;
    const dur = currentDuration();
    const price = currentPrice();
    const verified = isLicencieVerified();
    const final = verified ? reducedPrice(price) : price;

    const d = new Date(state.selected.date + 'T' + state.selected.start);
    const endMin = hhmmToMin(state.selected.start) + dur;
    const endStr = minToHhmm(endMin);
    const dLabel = `${DAY_LABELS_SHORT[(d.getDay()+6)%7]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
    const durLabel = dur === 60 ? '1 h' : dur === 90 ? '1 h 30' : '2 h';
    recapMeta.textContent = `${dLabel} · ${state.selected.start} → ${endStr} (${durLabel})`;
    recapTotal.textContent = final + ' €';
    submitAmount.textContent = final + ' €';
    if (verified && C.reduction){
      recapOld.textContent = price + ' €';
      recapOld.style.display = 'inline';
    } else {
      recapOld.style.display = 'none';
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const verified = isLicencieVerified();
    const data = {
      date: state.selected.date,
      heure_debut: state.selected.start,
      duree: currentDuration(),
      heure_fin: minToHhmm(hhmmToMin(state.selected.start) + currentDuration()),
      prenom: form.prenom.value.trim(),
      nom: form.nom.value.trim(),
      email: form.email.value.trim(),
      telephone: form.telephone.value.trim(),
      licencie: verified ? 'oui' : 'non',
      numero_licence: licencieCheckbox.checked ? numeroLicence.value.trim() : '',
      montant: verified ? reducedPrice(currentPrice()) : currentPrice(),
    };
    if (!form.checkValidity()){
      form.reportValidity();
      return;
    }
    const labelStatut =
      verified ? `Licencié vérifié · n° ${data.numero_licence}` :
      (licencieCheckbox.checked ? `Licence non reconnue — tarif public appliqué` : 'Non licencié');
    // TODO: appel backend Cloudflare Worker → crée session Stripe → redirection
    console.log('Réservation demandée:', data);
    alert(
      'Version démo — le paiement Stripe sera branché ultérieurement.\n\n' +
      'Récapitulatif :\n' +
      `• ${data.date} · ${data.heure_debut} → ${data.heure_fin}\n` +
      `• ${data.prenom} ${data.nom} · ${data.email}\n` +
      `• ${labelStatut}\n` +
      `• Montant : ${data.montant} €`
    );
  });

  // Burger mobile (nav)
  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');
  if (burger && navLinks){
    burger.addEventListener('click', () => {
      const open = !navLinks.classList.contains('open');
      navLinks.classList.toggle('open', open);
      burger.classList.toggle('active', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
})();
