// Formulaire de pré-inscription en 3 étapes — version "smart" :
//
//  - À partir de la date de naissance saisie à l'étape 1, on calcule
//    automatiquement la catégorie FFBaD.
//  - À l'étape 2, on propose la formule en fonction de la catégorie :
//      jeunes  → 1 ou 2 entraînements / semaine, ou CFC (3x ou 4x sur sélection)
//      adultes → loisir-jeu-libre, loisir-entraînement, compétiteur, sénior (65+)
//  - À l'étape 3, on liste UNIQUEMENT les créneaux compatibles avec
//    la catégorie + le type/formule choisis :
//      • jeune 1x          → 1 créneau à choisir (radio)
//      • jeune 2x          → 2 créneaux à choisir (checkboxes, exactement 2)
//      • jeune CFC 3x/4x   → pas de choix, info "définis avec les entraîneurs"
//      • adulte compétiteur → pas de choix, peut venir aux 3 créneaux
//      • adulte sénior     → 1 créneau (mardi 16h30) — visible si 65+ uniquement
//      • adulte loisir     → choix d'un créneau parmi ceux compatibles
//
// Source des créneaux et tarifs : PDF "Horaires et tarifs saison 2025-2026".

(function () {
  'use strict';

  // =====================================================================
  // 1. Catégories FFBaD par année de naissance (saison 2025-2026)
  // =====================================================================
  const CATEGORIES = [
    { code: 'minibad',  label: 'Minibad',         minYear: 2018, maxYear: 9999, ageLabel: 'nés en 2018 et après' },
    { code: 'poussin',  label: 'Poussin',          minYear: 2016, maxYear: 2017, ageLabel: 'nés en 2016-2017' },
    { code: 'benjamin', label: 'Benjamin',         minYear: 2014, maxYear: 2015, ageLabel: 'nés en 2014-2015' },
    { code: 'minime',   label: 'Minime',           minYear: 2012, maxYear: 2013, ageLabel: 'nés en 2012-2013' },
    { code: 'cadet',    label: 'Cadet',            minYear: 2010, maxYear: 2011, ageLabel: 'nés en 2010-2011' },
    { code: 'junior',   label: 'Junior',           minYear: 2008, maxYear: 2009, ageLabel: 'nés en 2008-2009' },
    { code: 'senior',   label: 'Sénior (adulte)',  minYear: 0,    maxYear: 2007, ageLabel: '18 ans et plus' },
  ];
  // L'année limite pour avoir accès au créneau "Adultes Sénior" du club
  // (réservé aux 65 ans et plus, donc nés en 1960 ou avant pour 2025-2026)
  const SENIOR_PLUS_MAX_YEAR = 1960;

  function getCategory(birthYear) {
    return CATEGORIES.find((c) => birthYear >= c.minYear && birthYear <= c.maxYear) || null;
  }
  function isYouth(cat) {
    return cat && cat.code !== 'senior';
  }

  // =====================================================================
  // 2. Catalogue des créneaux (PDF saison 2025-2026)
  // =====================================================================
  const SLOTS = [
    // ===== École de Badminton — créneaux jeunes =====
    { id: 'lun-1730-pous-benj', day: 'Lundi',    time: '17h30 – 19h',   label: 'Poussins / Benjamins',     categories: ['poussin','benjamin'], types: ['jeune'], birthYears: [2014,2015,2016,2017], price: 170 },
    { id: 'lun-1900-min-cad',   day: 'Lundi',    time: '19h – 20h30',   label: 'Minimes / Cadets',         categories: ['minime','cadet'],     types: ['jeune'], birthYears: [2010,2011,2012,2013], price: 170 },
    { id: 'mar-1730-pous-benj', day: 'Mardi',    time: '17h30 – 19h',   label: 'Poussins / Benjamins',     categories: ['poussin','benjamin'], types: ['jeune'], birthYears: [2014,2015,2016,2017], price: 170 },
    { id: 'mar-1900-min-cad',   day: 'Mardi',    time: '19h – 20h30',   label: 'Minimes / Cadets',         categories: ['minime','cadet'],     types: ['jeune'], birthYears: [2010,2011,2012,2013], price: 170 },
    { id: 'mer-0930-mini',      day: 'Mercredi', time: '9h30 – 11h',    label: 'Minibad',                  categories: ['minibad'],            types: ['jeune'], price: 130 },
    { id: 'mer-1100-pous-b1',   day: 'Mercredi', time: '11h – 12h30',   label: 'Poussins / Benjamins 1',   categories: ['poussin','benjamin'], types: ['jeune'], birthYears: [2015,2016,2017],     price: 170 },
    { id: 'mer-1530-mini',      day: 'Mercredi', time: '15h30 – 16h30', label: 'Minibad',                  categories: ['minibad'],            types: ['jeune'], price: 130 },
    { id: 'mer-1630-b2-min',    day: 'Mercredi', time: '16h30 – 18h',   label: 'Benjamins 2 / Minimes',    categories: ['benjamin','minime'],  types: ['jeune'], birthYears: [2012,2013,2014],     price: 170 },
    { id: 'mer-1830-cad-jun',   day: 'Mercredi', time: '18h30 – 20h',   label: 'Cadets / Juniors',         categories: ['cadet','junior'],     types: ['jeune'], birthYears: [2009,2010,2011],     price: 170 },
    { id: 'ven-1730-pous-benj', day: 'Vendredi', time: '17h30 – 19h',   label: 'Poussins / Benjamins',     categories: ['poussin','benjamin'], types: ['jeune'], birthYears: [2014,2015,2016,2017], price: 170 },
    { id: 'ven-1900-min-cad',   day: 'Vendredi', time: '19h – 20h30',   label: 'Minimes / Cadets',         categories: ['minime','cadet'],     types: ['jeune'], birthYears: [2010,2011,2012,2013], price: 170 },
    { id: 'sam-0930-pous-benj', day: 'Samedi',   time: '9h30 – 11h',    label: 'Poussins / Benjamins',     categories: ['poussin','benjamin'], types: ['jeune'], birthYears: [2014,2015,2016,2017], price: 170 },
    { id: 'sam-1100-mini',      day: 'Samedi',   time: '11h – 12h30',   label: 'Minibad',                  categories: ['minibad'],            types: ['jeune'], price: 130 },

    // ===== Adultes Compétiteurs (info uniquement, pas de choix) =====
    { id: 'lun-2030-comp-n1',   day: 'Lundi',    time: '20h30 – 22h30', label: 'Niveau 1 (R et N)',        categories: ['senior','junior'], types: ['competiteur'], price: 260, note: 'Volants fournis' },
    { id: 'lun-2030-comp-n2',   day: 'Lundi',    time: '20h30 – 22h30', label: 'Niveau 2 (D et P)',        categories: ['senior','junior'], types: ['competiteur'], price: 260, note: 'Volants fournis' },
    { id: 'jeu-2000-comp',      day: 'Jeudi',    time: '20h – 22h',     label: 'Tous niveaux (N à P)',     categories: ['senior','junior'], types: ['competiteur'], price: 260, note: 'Volants fournis' },

    // ===== Adultes Loisir — entraînement encadré =====
    { id: 'mar-2030-loi-ent',   day: 'Mardi',    time: '20h30 – 22h',   label: 'Loisir encadré',           categories: ['senior'], types: ['loisir_entrainement'], price: 170, note: 'Volants fournis' },
    { id: 'mer-2030-loi-ent',   day: 'Mercredi', time: '20h30 – 22h',   label: 'Loisir encadré',           categories: ['senior'], types: ['loisir_entrainement'], price: 170, note: 'Volants fournis' },

    // ===== Adultes Sénior (65 ans et plus) =====
    { id: 'mar-1630-senior',    day: 'Mardi',    time: '16h30 – 17h30', label: 'Créneau Sénior 65+',       categories: ['senior'], types: ['senior'], price: 100, note: 'Volants fournis · réservé aux 65+' },

    // ===== Adultes Loisir — jeu libre =====
    { id: 'mar-2030-jl',        day: 'Mardi',    time: '20h30 – 22h',   label: 'Jeu libre (3 terrains)',   categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
    { id: 'jeu-1800-jl',        day: 'Jeudi',    time: '18h – 20h',     label: 'Jeu libre',                categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
    { id: 'ven-1730-jl',        day: 'Vendredi', time: '17h30 – 21h30', label: 'Jeu libre',                categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
    { id: 'sam-0930-jl',        day: 'Samedi',   time: '9h30 – 12h30',  label: 'Jeu libre (4 terrains)',   categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
    { id: 'dim-1700-jl',        day: 'Dimanche', time: '17h – 20h',     label: 'Jeu libre',                categories: ['senior'], types: ['loisir_jeu_libre'], price: 145, note: 'Volants non fournis' },
  ];

  // =====================================================================
  // 3. Tarification spéciale
  // =====================================================================
  function computePrice({ slots, formuleJeune, isPrimo, isYouthCat }) {
    // CFC 3x/sem — 260€
    if (formuleJeune === 'cfc_3x') {
      return { amount: 260, detail: 'CFC — 3 entraînements / semaine, sur sélection. Jours définis par le club.' };
    }
    // CFC tous les soirs (4x) — 320€
    if (formuleJeune === 'cfc_4x') {
      return { amount: 320, detail: 'CFC — tous les soirs du lundi au jeudi, sur sélection.' };
    }
    // Jeune 2x/sem (École de Badminton) — 210€ ou 120€ primo
    if (isYouthCat && formuleJeune === '2x') {
      return {
        amount: isPrimo ? 120 : 210,
        detail: isPrimo
          ? 'Offre primo-licencié jeune — 120 € pour 2 entraînements / semaine'
          : '210 € — 2 entraînements / semaine (École de Badminton)',
      };
    }
    // Jeune 1x/sem + primo — 100€
    if (isYouthCat && formuleJeune === '1x' && isPrimo) {
      return { amount: 100, detail: 'Offre primo-licencié jeune — 100 € pour 1 entraînement / semaine' };
    }
    // Sinon : tarif du créneau (le premier de la liste, qu'il y en ait 1 ou plusieurs)
    const slot = Array.isArray(slots) ? slots[0] : slots;
    if (!slot) return null;
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

    const autoCard = document.getElementById('autoCategoryCard');
    const autoName = document.getElementById('autoCategoryName');
    const autoDetail = document.getElementById('autoCategoryDetail');
    const youthFormulaGroup = document.getElementById('youthFormulaGroup');
    const adultTypeGroup = document.getElementById('adultTypeGroup');
    const primoBenefitText = document.getElementById('primoBenefit');

    const slotsContainer = document.getElementById('slotsContainer');
    const slotsEmpty = document.getElementById('slotsEmpty');
    const infoCard = document.getElementById('infoCard');
    const infoCardTitle = document.getElementById('infoCardTitle');
    const infoCardDetail = document.getElementById('infoCardDetail');
    const infoCardList = document.getElementById('infoCardList');
    const slotsHelp = document.getElementById('slotsHelp');
    const slotsLabel = document.getElementById('slotsLabel');
    const tarifCard = document.getElementById('tarifCard');
    const tarifAmount = document.getElementById('tarifAmount');
    const tarifDetail = document.getElementById('tarifDetail');

    let currentStep = 1;
    const TOTAL_STEPS = steps.length;
    let detectedCategory = null;
    let detectedYear = null;

    // ===== Navigation =====
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

    // ===== Étape 2 =====
    function refreshStep2() {
      const dn = (form.querySelector('[name="date_naissance"]') || {}).value;
      detectedYear = dn ? Number(dn.slice(0, 4)) : null;
      detectedCategory = Number.isFinite(detectedYear) ? getCategory(detectedYear) : null;

      if (!detectedCategory) {
        autoCard.hidden = true;
        youthFormulaGroup.hidden = true;
        adultTypeGroup.hidden = true;
        return;
      }
      autoCard.hidden = false;
      autoName.textContent = detectedCategory.label;
      autoDetail.textContent = detectedCategory.ageLabel;

      const youth = isYouth(detectedCategory);
      youthFormulaGroup.hidden = !youth;
      adultTypeGroup.hidden = youth;

      // Hide/show "senior" adult type based on age (65+ only)
      if (!youth) {
        const seniorOption = adultTypeGroup.querySelector('input[name="type_adulte"][value="senior"]');
        if (seniorOption) {
          const seniorWrap = seniorOption.closest('.ins-option');
          const eligible = detectedYear !== null && detectedYear <= SENIOR_PLUS_MAX_YEAR;
          if (seniorWrap) {
            seniorWrap.style.display = eligible ? '' : 'none';
            // Si non éligible et coché, on le décoche
            if (!eligible && seniorOption.checked) seniorOption.checked = false;
          }
        }
      }

      if (primoBenefitText) {
        primoBenefitText.textContent = youth
          ? 'Tarif réduit : 100 € (1×) ou 120 € (2×)'
          : 'Première licence';
      }
    }

    // ===== Étape 3 =====
    function getSelectedRadio(name) {
      const el = form.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : '';
    }
    function getSelectedCheckboxes(name) {
      return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
    }

    function clearStep3UI() {
      slotsContainer.innerHTML = '';
      slotsEmpty.hidden = true;
      infoCard.hidden = true;
      slotsHelp.hidden = true;
      tarifCard.hidden = true;
    }

    function showInfoCard(title, detail, listItems) {
      infoCard.hidden = false;
      infoCardTitle.textContent = title;
      infoCardDetail.textContent = detail || '';
      infoCardList.innerHTML = '';
      (listItems || []).forEach((it) => {
        const li = document.createElement('li');
        li.textContent = it;
        infoCardList.appendChild(li);
      });
    }

    function updateTarif(slot) {
      const youth = isYouth(detectedCategory);
      const formuleJeune = youth ? getSelectedRadio('formule_jeune') : '';
      const isPrimo = getSelectedRadio('deja_licencie') === 'non';
      const slots = slot ? (Array.isArray(slot) ? slot : [slot]) : [];
      const price = computePrice({ slots, formuleJeune, isPrimo, isYouthCat: youth });
      if (!price) { tarifCard.hidden = true; return; }
      tarifCard.hidden = false;
      tarifAmount.textContent = price.amount + ' €';
      tarifDetail.textContent = price.detail;
    }

    function refreshStep3() {
      clearStep3UI();
      if (!detectedCategory) return;

      const youth = isYouth(detectedCategory);
      const formuleJeune = youth ? getSelectedRadio('formule_jeune') : '';
      const typeAdulte = youth ? '' : getSelectedRadio('type_adulte');

      // ===== Cas spéciaux : pas de choix de créneau =====

      // Jeune CFC 3x/sem
      if (youth && formuleJeune === 'cfc_3x') {
        slotsLabel.innerHTML = 'Centre de Formation de Club';
        showInfoCard(
          'CFC — 3 entraînements / semaine',
          'Sur sélection. Les jours d’entraînement sont fixés par le club après évaluation.',
          ['Évaluation préalable par les entraîneurs', 'Volants fournis', 'Engagement saison complète']
        );
        updateTarif(null);
        return;
      }
      // Jeune CFC tous les soirs
      if (youth && formuleJeune === 'cfc_4x') {
        slotsLabel.innerHTML = 'Centre de Formation de Club';
        showInfoCard(
          'CFC — tous les soirs du lundi au jeudi',
          'Sur sélection. Programme intensif de formation, sélection par les entraîneurs.',
          ['Lundi, mardi, mercredi, jeudi soir', 'Évaluation préalable obligatoire', 'Volants fournis']
        );
        updateTarif(null);
        return;
      }
      // Adulte compétiteur — accès aux 3 créneaux
      if (!youth && typeAdulte === 'competiteur') {
        slotsLabel.innerHTML = 'Créneaux compétiteurs (accès aux 3)';
        const compSlots = SLOTS.filter((s) => s.types.includes('competiteur'));
        showInfoCard(
          'Vous aurez accès à tous les créneaux compétiteurs',
          'Recrutement sur sélection. Vous pouvez venir aux 3 créneaux ci-dessous selon votre disponibilité.',
          compSlots.map((s) => `${s.day} ${s.time} — ${s.label}`)
        );
        updateTarif(compSlots[0]);
        return;
      }

      // ===== Cas spécial : jeune 2× / semaine — choix de 2 créneaux (multi-select) =====
      if (youth && formuleJeune === '2x') {
        const compatible = SLOTS.filter((s) =>
          s.categories.includes(detectedCategory.code)
          && s.types.includes('jeune')
          && (!s.birthYears || (detectedYear && s.birthYears.includes(detectedYear)))
        );
        if (compatible.length < 2) {
          slotsEmpty.hidden = false;
          slotsLabel.innerHTML = 'Créneaux d’entraînement <em>*</em>';
          updateTarif(null);
          return;
        }
        slotsLabel.innerHTML = 'Choisissez 2 créneaux <em>*</em>';
        slotsHelp.hidden = false;
        slotsHelp.textContent = 'Sélectionnez exactement 2 créneaux différents parmi ceux compatibles avec votre catégorie.';
        compatible.forEach((s) => {
          const card = document.createElement('label');
          card.className = 'ins-option ins-slot';
          card.innerHTML = `
            <input type="checkbox" name="creneau_ids" value="${s.id}" />
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
        // Limite à 2 sélections
        const checkboxes = slotsContainer.querySelectorAll('input[name="creneau_ids"]');
        checkboxes.forEach((cb) => {
          cb.addEventListener('change', () => {
            const checked = Array.from(checkboxes).filter((c) => c.checked);
            if (checked.length > 2) {
              cb.checked = false;
              return;
            }
            updateTarif(checked.length === 2 ? null : null); // tarif fixe pour 2x, indépendant des slots
            updateTarif(null);
          });
        });
        // Tarif fixe affiché immédiatement (210€ ou 120€ primo)
        updateTarif(null);
        return;
      }

      // ===== Cas standard : choix d'un créneau (radio) =====
      const compatible = SLOTS.filter((s) => {
        if (!s.categories.includes(detectedCategory.code)) return false;
        if (youth) {
          if (!s.types.includes('jeune')) return false;
          if (s.birthYears && Number.isFinite(detectedYear) && !s.birthYears.includes(detectedYear)) return false;
          return true;
        }
        return typeAdulte && s.types.includes(typeAdulte);
      });

      if (compatible.length === 0) {
        slotsEmpty.hidden = false;
        slotsLabel.innerHTML = 'Créneau d’entraînement <em>*</em>';
        return;
      }

      slotsLabel.innerHTML = 'Créneau d’entraînement <em>*</em>';
      compatible.forEach((s) => {
        const card = document.createElement('label');
        card.className = 'ins-option ins-slot';
        card.innerHTML = `
          <input type="radio" name="creneau_id" value="${s.id}" />
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
      slotsContainer.querySelectorAll('input[name="creneau_id"]').forEach((r) => {
        r.addEventListener('change', () => {
          const id = getSelectedRadio('creneau_id');
          const slot = compatible.find((s) => s.id === id);
          updateTarif(slot);
        });
      });
    }

    // Recalcul auto quand on change formule / type / déjà licencié
    form.addEventListener('change', (e) => {
      if (!e.target || !e.target.name) return;
      if (['formule_jeune', 'type_adulte', 'deja_licencie'].includes(e.target.name)) {
        if (currentStep === 3) refreshStep3();
        if (e.target.name === 'deja_licencie' && currentStep === 2) refreshStep2();
      }
      if (e.target.name === 'date_naissance' && currentStep === 2) refreshStep2();
    });

    // Section conditionnelle (numéro de licence)
    const licenceSection = document.getElementById('licence_section');
    form.querySelectorAll('input[name="deja_licencie"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        if (licenceSection) licenceSection.hidden = e.target.value !== 'oui';
      });
    });

    // Compteur message
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
      return d <= new Date() && d.getFullYear() >= 1900;
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
          setError('date_naissance', 'Date de naissance manquante (étape 1)'); ok = false;
        } else if (isYouth(detectedCategory)) {
          if (!fd.get('formule_jeune')) {
            setError('formule_jeune', 'Choisissez une formule'); ok = false;
          }
        } else {
          if (!fd.get('type_adulte')) {
            setError('type_adulte', 'Choisissez un type de pratique'); ok = false;
          }
        }
        if (!fd.get('deja_licencie')) {
          setError('deja_licencie', 'Précisez si vous êtes déjà licencié·e'); ok = false;
        }
      }

      if (stepNum === 3) {
        const youth = isYouth(detectedCategory);
        const formule = youth ? fd.get('formule_jeune') : '';
        const typeAd = youth ? '' : fd.get('type_adulte');
        // Cas où on ne demande PAS de créneau :
        //  - jeune CFC (3x ou 4x) : pas de choix (sur sélection)
        //  - adulte compétiteur : accès aux 3 créneaux par défaut
        const skipSlot = (youth && (formule === 'cfc_3x' || formule === 'cfc_4x'))
          || (!youth && typeAd === 'competiteur');
        if (!skipSlot) {
          if (youth && formule === '2x') {
            const ids = getSelectedCheckboxes('creneau_ids');
            if (ids.length !== 2) {
              setError('creneau_id', 'Choisissez exactement 2 créneaux');
              ok = false;
            }
          } else {
            if (!fd.get('creneau_id')) {
              setError('creneau_id', 'Choisissez un créneau');
              ok = false;
            }
          }
        }
        if (!fd.get('rgpd')) {
          setError('rgpd', 'Vous devez accepter pour envoyer le formulaire'); ok = false;
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
      fd.forEach((v, k) => {
        if (k in obj) {
          // Cas des checkboxes multiples (creneau_ids)
          if (!Array.isArray(obj[k])) obj[k] = [obj[k]];
          obj[k].push(v);
        } else {
          obj[k] = v;
        }
      });
      obj.rgpd = obj.rgpd === 'on';

      if (detectedCategory) {
        obj.categorie_ffbad = detectedCategory.code;
        obj.categorie_label = detectedCategory.label;
      }
      const youth = isYouth(detectedCategory);
      const formule = youth ? obj.formule_jeune : '';
      const isPrimo = obj.deja_licencie === 'non';

      // Liste des créneaux choisis (1, 2, ou tous pour compétiteur)
      let chosenSlots = [];
      if (!youth && obj.type_adulte === 'competiteur') {
        chosenSlots = SLOTS.filter((s) => s.types.includes('competiteur'));
      } else if (youth && formule === '2x' && obj.creneau_ids) {
        const ids = Array.isArray(obj.creneau_ids) ? obj.creneau_ids : [obj.creneau_ids];
        chosenSlots = SLOTS.filter((s) => ids.includes(s.id));
      } else if (obj.creneau_id) {
        const slot = SLOTS.find((s) => s.id === obj.creneau_id);
        if (slot) chosenSlots = [slot];
      }
      obj.creneaux_choisis = chosenSlots.map((s) => ({
        id: s.id, jour: s.day, heure: s.time, label: s.label, prix_normal: s.price,
      }));

      const computed = computePrice({
        slots: chosenSlots,
        formuleJeune: formule,
        isPrimo,
        isYouthCat: youth,
      });
      if (computed) obj.tarif_calcule = computed.amount;

      obj.submitted_at = new Date().toISOString();
      obj.user_agent = navigator.userAgent;
      return obj;
    }

    async function submitPayload(payload) {
      // TODO : brancher vers backend (Apps Script Sheets, Cloud Function, Brevo…)
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
