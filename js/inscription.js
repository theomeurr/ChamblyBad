// Formulaire de pré-inscription en 3 étapes — version "smart" :
//
//  - À partir de la date de naissance saisie à l'étape 1, on calcule
//    automatiquement la catégorie FFBaD (Minibad / Poussin / Benjamin /
//    Minime / Cadet / Junior / Sénior).
//  - À l'étape 2, on propose la formule en fonction de la catégorie :
//      jeunes   → 1 ou 2 entraînements / semaine
//      adultes  → loisir-jeu-libre, loisir-entraînement, compétiteur, sénior
//  - À l'étape 3, on liste UNIQUEMENT les créneaux compatibles avec la
//    catégorie + le type choisi, et on affiche le tarif annuel total
//    (avec offre primo-licencié si applicable).
//
//  - À la soumission : on collecte tout, on bascule sur l'écran de
//    confirmation. Pour l'instant les données ne sont PAS envoyées —
//    le backend sera branché plus tard (Cloud Function, Sheets API,
//    email). Voir le marqueur TODO dans submitPayload().
//
// Source des créneaux et tarifs : PDF "Horaires et tarifs saison 2025-2026".

(function () {
  'use strict';

  // =====================================================================
  // 1. Catégories FFBaD par année de naissance (saison 2025-2026)
  // =====================================================================
  // Ordre du plus jeune au plus ancien
  const CATEGORIES = [
    { code: 'minibad',  label: 'Minibad',                   minYear: 2018, maxYear: 9999, ageLabel: 'nés en 2018 et après' },
    { code: 'poussin',  label: 'Poussin',                   minYear: 2016, maxYear: 2017, ageLabel: 'nés en 2016-2017' },
    { code: 'benjamin', label: 'Benjamin',                  minYear: 2014, maxYear: 2015, ageLabel: 'nés en 2014-2015' },
    { code: 'minime',   label: 'Minime',                    minYear: 2012, maxYear: 2013, ageLabel: 'nés en 2012-2013' },
    { code: 'cadet',    label: 'Cadet',                     minYear: 2010, maxYear: 2011, ageLabel: 'nés en 2010-2011' },
    { code: 'junior',   label: 'Junior',                    minYear: 2008, maxYear: 2009, ageLabel: 'nés en 2008-2009' },
    { code: 'senior',   label: 'Sénior (adulte)',           minYear: 0,    maxYear: 2007, ageLabel: '18 ans et plus' },
  ];

  function getCategory(birthYear) {
    return CATEGORIES.find((c) => birthYear >= c.minYear && birthYear <= c.maxYear) || null;
  }

  function isYouth(cat) {
    return cat && cat.code !== 'senior';
  }

  // =====================================================================
  // 2. Catalogue des créneaux (PDF saison 2025-2026)
  // =====================================================================
  // categories : codes des catégories FFBaD compatibles
  // types      : 'jeune' | 'loisir_jeu_libre' | 'loisir_entrainement' |
  //              'competiteur' | 'senior'
  // birthYears : optionnel, restreint l'année de naissance (cas des créneaux
  //              avec sous-segment, ex Poussins/Benj.1 sur mercredi 11h-12h30)
  const SLOTS = [
    // ===== École de Badminton — 1 entraînement / semaine =====
    { id: 'lun-1730-pous-benj', day: 'Lundi',    time: '17h30 – 19h',    label: 'Poussins / Benjamins',     categories: ['poussin','benjamin'],     types: ['jeune'], birthYears: [2014,2015,2016,2017], price: 170 },
    { id: 'lun-1900-min-cad',   day: 'Lundi',    time: '19h – 20h30',    label: 'Minimes / Cadets',          categories: ['minime','cadet'],         types: ['jeune'], birthYears: [2010,2011,2012,2013], price: 170 },
    { id: 'mar-1730-pous-benj', day: 'Mardi',    time: '17h30 – 19h',    label: 'Poussins / Benjamins',     categories: ['poussin','benjamin'],     types: ['jeune'], birthYears: [2014,2015,2016,2017], price: 170 },
    { id: 'mar-1900-min-cad',   day: 'Mardi',    time: '19h – 20h30',    label: 'Minimes / Cadets',          categories: ['minime','cadet'],         types: ['jeune'], birthYears: [2010,2011,2012,2013], price: 170 },
    { id: 'mer-0930-mini',      day: 'Mercredi', time: '9h30 – 11h',     label: 'Minibad',                   categories: ['minibad'],                types: ['jeune'], price: 130 },
    { id: 'mer-1100-pous-b1',   day: 'Mercredi', time: '11h – 12h30',    label: 'Poussins / Benjamins 1',   categories: ['poussin','benjamin'],     types: ['jeune'], birthYears: [2015,2016,2017],    price: 170 },
    { id: 'mer-1530-mini',      day: 'Mercredi', time: '15h30 – 16h30',  label: 'Minibad',                   categories: ['minibad'],                types: ['jeune'], price: 130 },
    { id: 'mer-1630-b2-min',    day: 'Mercredi', time: '16h30 – 18h',    label: 'Benjamins 2 / Minimes',    categories: ['benjamin','minime'],      types: ['jeune'], birthYears: [2012,2013,2014],    price: 170 },
    { id: 'mer-1830-cad-jun',   day: 'Mercredi', time: '18h30 – 20h',    label: 'Cadets / Juniors',          categories: ['cadet','junior'],         types: ['jeune'], birthYears: [2009,2010,2011],    price: 170 },
    { id: 'ven-1730-pous-benj', day: 'Vendredi', time: '17h30 – 19h',    label: 'Poussins / Benjamins',     categories: ['poussin','benjamin'],     types: ['jeune'], birthYears: [2014,2015,2016,2017], price: 170 },
    { id: 'ven-1900-min-cad',   day: 'Vendredi', time: '19h – 20h30',    label: 'Minimes / Cadets',          categories: ['minime','cadet'],         types: ['jeune'], birthYears: [2010,2011,2012,2013], price: 170 },
    { id: 'sam-0930-pous-benj', day: 'Samedi',   time: '9h30 – 11h',     label: 'Poussins / Benjamins',     categories: ['poussin','benjamin'],     types: ['jeune'], birthYears: [2014,2015,2016,2017], price: 170 },
    { id: 'sam-1100-mini',      day: 'Samedi',   time: '11h – 12h30',    label: 'Minibad',                   categories: ['minibad'],                types: ['jeune'], price: 130 },

    // ===== Adultes Compétiteurs (recrutement sur sélection) =====
    { id: 'lun-2030-comp-n1',   day: 'Lundi',    time: '20h30 – 22h30',  label: 'Niveau 1 (R et N)',         categories: ['senior'], types: ['competiteur'], price: 260, note: 'Volants fournis' },
    { id: 'lun-2030-comp-n2',   day: 'Lundi',    time: '20h30 – 22h30',  label: 'Niveau 2 (D et P)',         categories: ['senior'], types: ['competiteur'], price: 260, note: 'Volants fournis' },
    { id: 'jeu-2000-comp',      day: 'Jeudi',    time: '20h – 22h',      label: 'Tous niveaux (N à P)',      categories: ['senior'], types: ['competiteur'], price: 260, note: 'Volants fournis' },

    // ===== Adultes Loisir entraînement =====
    { id: 'mar-2030-loi-ent',   day: 'Mardi',    time: '20h30 – 22h',    label: 'Loisir encadré',            categories: ['senior'], types: ['loisir_entrainement'], price: 170, note: 'Volants fournis' },
    { id: 'mer-2030-loi-ent',   day: 'Mercredi', time: '20h30 – 22h',    label: 'Loisir encadré',            categories: ['senior'], types: ['loisir_entrainement'], price: 170, note: 'Volants fournis' },

    // ===== Adultes Sénior =====
    { id: 'mar-1630-senior',    day: 'Mardi',    time: '16h30 – 17h30',  label: 'Créneau Sénior',            categories: ['senior'], types: ['senior'], price: 100, note: 'Volants fournis' },

    // ===== Adultes Loisir jeu libre =====
    { id: 'mar-2030-jl',        day: 'Mardi',    time: '20h30 – 22h',    label: 'Jeu libre (3 terrains)',    categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
    { id: 'jeu-1800-jl',        day: 'Jeudi',    time: '18h – 20h',      label: 'Jeu libre',                 categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
    { id: 'ven-1730-jl',        day: 'Vendredi', time: '17h30 – 21h30',  label: 'Jeu libre',                 categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
    { id: 'sam-0930-jl',        day: 'Samedi',   time: '9h30 – 12h30',   label: 'Jeu libre (4 terrains)',    categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
    { id: 'dim-1700-jl',        day: 'Dimanche', time: '17h – 20h',      label: 'Jeu libre',                 categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
  ];

  // =====================================================================
  // 3. Tarification spéciale
  // =====================================================================
  function computePrice({ slot, isYouthCat, formuleJeune, isPrimo }) {
    if (!slot && !(isYouthCat && formuleJeune === '2x')) return null;

    // Jeune 2x/semaine : tarif fixe 210€ (ou 120€ primo)
    if (isYouthCat && formuleJeune === '2x') {
      return {
        amount: isPrimo ? 120 : 210,
        detail: isPrimo
          ? 'Offre primo-licencié jeune — 120 € pour 2 entraînements / semaine'
          : '210 € — 2 entraînements / semaine, jours définis avec les entraîneurs',
      };
    }
    // Jeune 1x/semaine + primo : tarif fixe 100€
    if (isYouthCat && formuleJeune === '1x' && isPrimo) {
      return {
        amount: 100,
        detail: 'Offre primo-licencié jeune — 100 € pour 1 entraînement / semaine',
      };
    }
    // Sinon : tarif du créneau
    return {
      amount: slot.price,
      detail: slot.note ? `${slot.note}. Tarif normal saison 2025-2026.` : 'Tarif normal saison 2025-2026.',
    };
  }

  // =====================================================================
  // 4. Init
  // =====================================================================
  function init() {
    const form = document.getElementById('insForm');
    if (!form) return;

    const steps = Array.from(form.querySelectorAll('.ins-section'));
    const progressItems = Array.from(document.querySelectorAll('.ins-step'));
    const prevBtn = document.getElementById('insPrev');
    const nextBtn = document.getElementById('insNext');
    const submitBtn = document.getElementById('insSubmit');
    const successPanel = document.getElementById('insSuccess');

    // Étape 2
    const autoCard = document.getElementById('autoCategoryCard');
    const autoName = document.getElementById('autoCategoryName');
    const autoDetail = document.getElementById('autoCategoryDetail');
    const youthFormulaGroup = document.getElementById('youthFormulaGroup');
    const adultTypeGroup = document.getElementById('adultTypeGroup');
    const primoBenefitText = document.getElementById('primoBenefit');

    // Étape 3
    const slotsContainer = document.getElementById('slotsContainer');
    const slotsEmpty = document.getElementById('slotsEmpty');
    const slots2xMsg = document.getElementById('slots2xMessage');
    const slotsLabel = document.getElementById('slotsLabel');
    const tarifCard = document.getElementById('tarifCard');
    const tarifAmount = document.getElementById('tarifAmount');
    const tarifDetail = document.getElementById('tarifDetail');

    let currentStep = 1;
    const TOTAL_STEPS = steps.length;
    let detectedCategory = null; // {code, label, ageLabel, ...}

    // ===== Navigation entre étapes =====
    function showStep(n) {
      currentStep = Math.max(1, Math.min(TOTAL_STEPS, n));
      steps.forEach((sec) => {
        sec.classList.toggle('is-active', Number(sec.dataset.step) === currentStep);
      });
      progressItems.forEach((p) => {
        const stepNum = Number(p.dataset.step);
        p.classList.toggle('is-active', stepNum === currentStep);
        p.classList.toggle('is-done', stepNum < currentStep);
      });
      prevBtn.disabled = currentStep === 1;
      const isLast = currentStep === TOTAL_STEPS;
      nextBtn.hidden = isLast;
      submitBtn.hidden = !isLast;
      if (currentStep === 2) refreshStep2();
      if (currentStep === 3) refreshStep3();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    prevBtn.addEventListener('click', () => showStep(currentStep - 1));
    nextBtn.addEventListener('click', () => {
      if (validateStep(currentStep)) showStep(currentStep + 1);
    });

    // ===== Étape 2 — affichage selon catégorie auto =====
    function refreshStep2() {
      const dn = (form.querySelector('[name="date_naissance"]') || {}).value;
      const year = dn ? Number(dn.slice(0, 4)) : NaN;
      detectedCategory = Number.isFinite(year) ? getCategory(year) : null;

      if (!detectedCategory) {
        autoCard.hidden = true;
        youthFormulaGroup.hidden = true;
        adultTypeGroup.hidden = true;
        return;
      }
      autoCard.hidden = false;
      autoName.textContent = detectedCategory.label;
      autoDetail.textContent = detectedCategory.ageLabel;

      // Affichage du bon groupe
      if (isYouth(detectedCategory)) {
        youthFormulaGroup.hidden = false;
        adultTypeGroup.hidden = true;
        // Dynamiser le bénéfice primo
        if (primoBenefitText) primoBenefitText.textContent = 'Tarif réduit : 100 € (1x) ou 120 € (2x)';
      } else {
        youthFormulaGroup.hidden = true;
        adultTypeGroup.hidden = false;
        if (primoBenefitText) primoBenefitText.textContent = 'Première licence';
      }
    }

    // ===== Étape 3 — créneaux filtrés + tarif =====
    function getSelectedRadio(name) {
      const el = form.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : '';
    }

    function refreshStep3() {
      slotsContainer.innerHTML = '';
      slotsEmpty.hidden = true;
      slots2xMsg.hidden = true;
      tarifCard.hidden = true;

      if (!detectedCategory) return;

      const youth = isYouth(detectedCategory);
      const formuleJeune = youth ? getSelectedRadio('formule_jeune') : '';
      const typeAdulte = youth ? '' : getSelectedRadio('type_adulte');
      const isPrimo = getSelectedRadio('deja_licencie') === 'non';

      // Cas spécial : jeune 2x/semaine → pas de créneau à choisir, juste le tarif
      if (youth && formuleJeune === '2x') {
        slots2xMsg.hidden = false;
        slotsLabel.innerHTML = 'Créneau d\'entraînement';
        const price = computePrice({ slot: null, isYouthCat: true, formuleJeune, isPrimo });
        if (price) {
          tarifCard.hidden = false;
          tarifAmount.textContent = price.amount + ' €';
          tarifDetail.textContent = price.detail;
        }
        return;
      }

      // Filtrer les créneaux
      const dn = (form.querySelector('[name="date_naissance"]') || {}).value;
      const year = dn ? Number(dn.slice(0, 4)) : NaN;

      const compatible = SLOTS.filter((s) => {
        if (!s.categories.includes(detectedCategory.code)) return false;
        if (youth) {
          if (!s.types.includes('jeune')) return false;
          if (s.birthYears && Number.isFinite(year) && !s.birthYears.includes(year)) return false;
          return true;
        }
        // Adulte
        return typeAdulte && s.types.includes(typeAdulte);
      });

      if (compatible.length === 0) {
        slotsEmpty.hidden = false;
        slotsLabel.innerHTML = 'Créneau d\'entraînement <em>*</em>';
        return;
      }

      slotsLabel.innerHTML = 'Créneau d\'entraînement <em>*</em>';
      compatible.forEach((s) => {
        const id = `slot-${s.id}`;
        const card = document.createElement('label');
        card.className = 'ins-option ins-slot';
        card.innerHTML = `
          <input type="radio" name="creneau_id" value="${s.id}" id="${id}" />
          <span class="ins-option-card ins-slot-card">
            <span class="ins-slot-day">${s.day}</span>
            <strong>${s.time}</strong>
            <span class="ins-slot-label">${s.label}</span>
            ${s.note ? `<span class="ins-slot-note">${s.note}</span>` : ''}
            <span class="ins-slot-price">${s.price} €</span>
          </span>
        `;
        slotsContainer.appendChild(card);
      });

      // Quand on coche un créneau, on met à jour le tarif
      slotsContainer.querySelectorAll('input[name="creneau_id"]').forEach((r) => {
        r.addEventListener('change', () => updateTarif(compatible));
      });
    }

    function updateTarif(compatible) {
      const id = getSelectedRadio('creneau_id');
      const slot = compatible.find((s) => s.id === id);
      if (!slot) {
        tarifCard.hidden = true;
        return;
      }
      const youth = isYouth(detectedCategory);
      const formuleJeune = youth ? getSelectedRadio('formule_jeune') : '';
      const isPrimo = getSelectedRadio('deja_licencie') === 'non';
      const price = computePrice({ slot, isYouthCat: youth, formuleJeune, isPrimo });
      if (!price) { tarifCard.hidden = true; return; }
      tarifCard.hidden = false;
      tarifAmount.textContent = price.amount + ' €';
      tarifDetail.textContent = price.detail;
    }

    // Recalcul quand un radio amont change (formule, type, déjà licencié)
    form.addEventListener('change', (e) => {
      if (!e.target || !e.target.name) return;
      if (['formule_jeune', 'type_adulte', 'deja_licencie'].includes(e.target.name)) {
        if (currentStep === 3) refreshStep3();
      }
      if (e.target.name === 'date_naissance' && currentStep === 2) {
        refreshStep2();
      }
    });

    // ===== Section conditionnelle (numéro de licence) =====
    const licenceSection = document.getElementById('licence_section');
    form.querySelectorAll('input[name="deja_licencie"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        if (licenceSection) licenceSection.hidden = e.target.value !== 'oui';
      });
    });

    // ===== Compteur de caractères =====
    form.querySelectorAll('[data-counter]').forEach((counter) => {
      const fieldName = counter.dataset.counter;
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (!field) return;
      const update = () => { counter.textContent = String(field.value.length); };
      field.addEventListener('input', update);
      update();
    });

    // ===== Validation =====
    function setError(name, msg) {
      const target = form.querySelector(`[data-error-for="${name}"]`);
      if (target) target.textContent = msg || '';
      const input = form.querySelector(`[name="${name}"]`);
      if (input) input.classList.toggle('is-invalid', Boolean(msg));
    }
    function clearErrors(stepEl) {
      stepEl.querySelectorAll('.ins-error').forEach((e) => { e.textContent = ''; });
      stepEl.querySelectorAll('.is-invalid').forEach((e) => e.classList.remove('is-invalid'));
    }
    function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function isValidPhone(v) { return v === '' || /^[\d\s+().-]{8,}$/.test(v); }
    function isValidDate(v) {
      if (!v) return false;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const today = new Date();
      return d <= today && d.getFullYear() >= 1900;
    }

    function validateStep(stepNum) {
      const stepEl = steps.find((s) => Number(s.dataset.step) === stepNum);
      if (!stepEl) return true;
      clearErrors(stepEl);
      let ok = true;
      const fd = new FormData(form);

      if (stepNum === 1) {
        if (!fd.get('prenom')) { setError('prenom', 'Le prénom est requis'); ok = false; }
        if (!fd.get('nom'))    { setError('nom', 'Le nom est requis'); ok = false; }
        const email = fd.get('email') || '';
        if (!email)            { setError('email', 'L’email est requis'); ok = false; }
        else if (!isValidEmail(email)) { setError('email', 'Format d’email invalide'); ok = false; }
        const tel = fd.get('telephone') || '';
        if (!isValidPhone(tel)) { setError('telephone', 'Numéro invalide'); ok = false; }
        const dn = fd.get('date_naissance') || '';
        if (!dn)               { setError('date_naissance', 'La date de naissance est requise'); ok = false; }
        else if (!isValidDate(dn)) { setError('date_naissance', 'Date invalide'); ok = false; }
      }

      if (stepNum === 2) {
        if (!detectedCategory) {
          setError('date_naissance', 'Date de naissance manquante (étape 1)');
          ok = false;
        } else if (isYouth(detectedCategory)) {
          if (!fd.get('formule_jeune')) {
            setError('formule_jeune', 'Choisissez 1 ou 2 entraînements / semaine');
            ok = false;
          }
        } else {
          if (!fd.get('type_adulte')) {
            setError('type_adulte', 'Choisissez un type de pratique');
            ok = false;
          }
        }
        if (!fd.get('deja_licencie')) {
          setError('deja_licencie', 'Précisez si vous êtes déjà licencié·e');
          ok = false;
        }
      }

      if (stepNum === 3) {
        const youth = isYouth(detectedCategory);
        const formule = youth ? fd.get('formule_jeune') : '';
        // Cas particulier : jeune 2x/semaine → pas de créneau à sélectionner
        if (!(youth && formule === '2x')) {
          if (!fd.get('creneau_id')) {
            setError('creneau_id', 'Choisissez un créneau');
            ok = false;
          }
        }
        if (!fd.get('rgpd')) {
          setError('rgpd', 'Vous devez accepter pour envoyer le formulaire');
          ok = false;
        }
      }

      if (!ok) {
        const firstError = stepEl.querySelector('.is-invalid, .ins-option input:not(:checked)');
        if (firstError) { try { firstError.focus(); } catch (_) {} }
      }
      return ok;
    }

    // ===== Soumission =====
    function collectPayload() {
      const fd = new FormData(form);
      const obj = {};
      fd.forEach((v, k) => { obj[k] = v; });
      obj.rgpd = obj.rgpd === 'on';
      // Champs calculés (utiles côté admin)
      if (detectedCategory) {
        obj.categorie_ffbad = detectedCategory.code;
        obj.categorie_label = detectedCategory.label;
      }
      const slot = SLOTS.find((s) => s.id === obj.creneau_id);
      if (slot) {
        obj.creneau_jour = slot.day;
        obj.creneau_heure = slot.time;
        obj.creneau_label = slot.label;
        obj.creneau_prix_normal = slot.price;
      }
      const youth = isYouth(detectedCategory);
      const formule = youth ? obj.formule_jeune : '';
      const isPrimo = obj.deja_licencie === 'non';
      const computed = computePrice({ slot, isYouthCat: youth, formuleJeune: formule, isPrimo });
      if (computed) obj.tarif_calcule = computed.amount;
      obj.submitted_at = new Date().toISOString();
      obj.user_agent = navigator.userAgent;
      return obj;
    }

    async function submitPayload(payload) {
      // TODO : brancher l'envoi vers un backend
      //   - Option 1 : Google Apps Script qui écrit dans un Sheets
      //   - Option 2 : Cloud Function (Vercel/Netlify/Cloudflare) qui envoie un mail
      //   - Option 3 : Service tiers type Formspree, Web3Forms, Brevo, etc.
      console.info('[Pré-inscription] Données collectées :', payload);
      await new Promise((resolve) => setTimeout(resolve, 600));
      return { ok: true };
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateStep(currentStep)) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours…';
      try {
        const payload = collectPayload();
        const res = await submitPayload(payload);
        if (!res.ok) throw new Error('submit failed');
        form.hidden = true;
        const head = document.querySelector('.ins-head');
        if (head) head.style.display = 'none';
        if (successPanel) {
          successPanel.hidden = false;
          successPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Envoyer ma pré-inscription';
        alert('Une erreur est survenue. Réessayez ou contactez le club par mail.');
      }
    });

    showStep(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
