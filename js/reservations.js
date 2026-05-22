
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
    nb_terrains: Number(state.config.nb_terrains_reservables) || 9,
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
  function countBooked(dateStr, startMin, endMin){
    return state.reservations.filter(r => {
      if (r.date !== dateStr) return false;
      const rs = hhmmToMin(r.heure_debut);
      const re = hhmmToMin(r.heure_fin);
      return (startMin < re && endMin > rs);
    }).length;
  }
  function isBooked(dateStr, startMin, endMin){
    return countBooked(dateStr, startMin, endMin) >= C.nb_terrains;
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

  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // === DATE PICKER ===
  const dateInput  = document.getElementById('rv-date-input');
  const dateLabel  = document.getElementById('rv-date-label');
  const daySlotsEl = document.getElementById('rv-day-slots');

  function formatDateLabel(date){
    const today = new Date(); today.setHours(0,0,0,0);
    const tom   = new Date(today); tom.setDate(tom.getDate()+1);
    const dayIdx = (date.getDay()+6)%7;
    const base = DAY_NAMES_FR[dayIdx].charAt(0).toUpperCase() + DAY_NAMES_FR[dayIdx].slice(1) +
                 ' ' + date.getDate() + ' ' + MONTH_LABELS[date.getMonth()];
    if (ymd(date) === ymd(today)) return 'Aujourd\'hui · ' + date.getDate() + ' ' + MONTH_LABELS[date.getMonth()];
    if (ymd(date) === ymd(tom))   return 'Demain · ' + date.getDate() + ' ' + MONTH_LABELS[date.getMonth()];
    return base + ' ' + date.getFullYear();
  }

  function renderDateSlots(date){
    state.currentWeekStart   = startOfWeek(date);
    state.selectedDayIndex   = Math.round((date - state.currentWeekStart) / 86400000);
    const dstr = ymd(date);
    const info = buildSlotsForDay(date);
    const SLOT_STEP = 60;

    dateLabel.textContent = formatDateLabel(date);

    if (!info.windows.length){
      daySlotsEl.innerHTML = '<div class="rv-day-empty">Aucun créneau ouvert ce jour.</div>';
      return;
    }
    if (isBeyondHorizon(date)){
      daySlotsEl.innerHTML = `<div class="rv-day-empty">Ce jour dépasse la fenêtre de réservation (${C.anticipation} jours max).</div>`;
      return;
    }

    const w = info.windows[0];
    const rows = [];
    for (let m = Math.floor(w.start/60)*60; m < w.end; m += SLOT_STEP){
      const end = m + SLOT_STEP;
      const startStr = minToHhmm(m);
      const endStr   = minToHhmm(end);
      let type, badge, clickable = false;
      if (isPast(date, m)){
        type = 'past'; badge = 'Passé';
      } else if (isBlocked(dstr, m, end)){
        const reason = (state.blocked.find(b => b.date===dstr) || {}).raison || 'Indisponible';
        type = 'blocked'; badge = escapeHtml(reason.slice(0,16));
      } else {
        const booked = countBooked(dstr, m, end);
        const places = (C.nb_terrains - booked) * 4;
        if (places <= 0){ type = 'booked'; badge = 'Complet'; }
        else { type = 'free'; badge = `${places} places libres`; clickable = true; }
      }
      const row = document.createElement(clickable ? 'button' : 'div');
      if (clickable) row.type = 'button';
      row.className = `rv-slot-row ${type}`;
      row.innerHTML = `<span class="slot-time">${startStr}<span class="slot-arrow"> → </span>${endStr}</span><span class="slot-badge">${badge}</span>`;
      if (clickable) row.addEventListener('click', () => openModal({ date: dstr, start: startStr }));
      rows.push(row);
    }
    daySlotsEl.innerHTML = '';
    rows.forEach(r => daySlotsEl.appendChild(r));
  }

  // Borne du date picker
  const todayStr = ymd(new Date());
  const maxDate  = new Date(); maxDate.setDate(maxDate.getDate() + C.anticipation);
  dateInput.min   = todayStr;
  dateInput.max   = ymd(maxDate);
  dateInput.value = todayStr;

  function updateNavBtns(){
    const prevBtn = document.getElementById('rv-day-prev');
    const nextBtn = document.getElementById('rv-day-next');
    if (prevBtn) prevBtn.disabled = dateInput.value <= dateInput.min;
    if (nextBtn) nextBtn.disabled = dateInput.value >= dateInput.max;
  }

  dateInput.addEventListener('change', function(){
    const parts = this.value.split('-');
    if (parts.length !== 3) return;
    renderDateSlots(new Date(+parts[0], +parts[1]-1, +parts[2]));
    updateNavBtns();
  });

  const prevDayBtn = document.getElementById('rv-day-prev');
  const nextDayBtn = document.getElementById('rv-day-next');
  function navDay(delta){
    const parts = dateInput.value.split('-');
    const d = new Date(+parts[0], +parts[1]-1, +parts[2]);
    d.setDate(d.getDate() + delta);
    const s = ymd(d);
    if (s >= dateInput.min && s <= dateInput.max){
      dateInput.value = s;
      renderDateSlots(d);
      updateNavBtns();
    }
  }
  if (prevDayBtn) prevDayBtn.addEventListener('click', function(){ navDay(-1); });
  if (nextDayBtn) nextDayBtn.addEventListener('click', function(){ navDay(+1); });

  // Rendu initial : aujourd'hui
  renderDateSlots(new Date());
  updateNavBtns();


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
