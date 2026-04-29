// Formulaire de pré-inscription en 3 étapes.
//
// Comportement :
//  - Navigation entre les étapes (Précédent / Suivant), validation par étape
//    avant de passer à la suivante.
//  - Champ "Numéro de licence" affiché seulement si "Déjà licencié = oui".
//  - À la soumission : on collecte tout, on bascule sur l'écran de confirmation.
//  - Pour l'instant les données ne sont PAS envoyées — le backend sera branché
//    plus tard (Cloud Function, Sheets API, email, etc.).
//    Voir le marqueur TODO dans la fonction submitPayload().
(function () {
  'use strict';

  function init() {
    const form = document.getElementById('insForm');
    if (!form) return;

    const steps = Array.from(form.querySelectorAll('.ins-section'));
    const progressItems = Array.from(document.querySelectorAll('.ins-step'));
    const prevBtn = document.getElementById('insPrev');
    const nextBtn = document.getElementById('insNext');
    const submitBtn = document.getElementById('insSubmit');
    const successPanel = document.getElementById('insSuccess');

    let currentStep = 1;
    const TOTAL_STEPS = steps.length;

    // ===== Affichage / navigation des étapes =====
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
      // Scroll en haut du form pour bien voir la nouvelle étape
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    prevBtn.addEventListener('click', () => showStep(currentStep - 1));
    nextBtn.addEventListener('click', () => {
      if (validateStep(currentStep)) showStep(currentStep + 1);
    });

    // ===== Section conditionnelle (numéro de licence) =====
    const licenceSection = document.getElementById('licence_section');
    form.querySelectorAll('input[name="deja_licencie"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        if (licenceSection) licenceSection.hidden = e.target.value !== 'oui';
      });
    });

    // ===== Compteur de caractères (textarea message) =====
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

    function isValidEmail(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }

    function isValidPhone(v) {
      // Optionnel : si rempli, on attend ~10 chiffres FR
      return v === '' || /^[\d\s+().-]{8,}$/.test(v);
    }

    function isValidDate(v) {
      if (!v) return false;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const today = new Date();
      // Rejette les dates futures, et avant 1900 (frappe au hasard)
      return d <= today && d.getFullYear() >= 1900;
    }

    function validateStep(stepNum) {
      const stepEl = steps.find((s) => Number(s.dataset.step) === stepNum);
      if (!stepEl) return true;
      clearErrors(stepEl);
      let ok = true;

      if (stepNum === 1) {
        const fd = new FormData(form);
        if (!fd.get('prenom')) { setError('prenom', 'Le prénom est requis'); ok = false; }
        if (!fd.get('nom'))    { setError('nom', 'Le nom est requis'); ok = false; }
        const email = fd.get('email') || '';
        if (!email)            { setError('email', 'L’email est requis'); ok = false; }
        else if (!isValidEmail(email)) { setError('email', 'Format d’email invalide'); ok = false; }
        const tel = fd.get('telephone') || '';
        if (!isValidPhone(tel)) { setError('telephone', 'Numéro de téléphone invalide'); ok = false; }
        const dn = fd.get('date_naissance') || '';
        if (!dn)               { setError('date_naissance', 'La date de naissance est requise'); ok = false; }
        else if (!isValidDate(dn)) { setError('date_naissance', 'Date invalide'); ok = false; }
      }

      if (stepNum === 2) {
        const fd = new FormData(form);
        if (!fd.get('categorie'))     { setError('categorie', 'Choisissez une catégorie'); ok = false; }
        if (!fd.get('niveau'))        { setError('niveau', 'Choisissez un niveau'); ok = false; }
        if (!fd.get('deja_licencie')) { setError('deja_licencie', 'Précisez si vous êtes déjà licencié·e'); ok = false; }
      }

      if (stepNum === 3) {
        const fd = new FormData(form);
        if (!fd.get('rgpd')) { setError('rgpd', 'Vous devez accepter pour envoyer le formulaire'); ok = false; }
      }

      // Focus sur le premier champ invalide
      if (!ok) {
        const firstError = stepEl.querySelector('.is-invalid, .ins-option input:not(:checked)');
        if (firstError) {
          try { firstError.focus(); } catch (_) {}
        }
      }
      return ok;
    }

    // ===== Soumission =====
    function collectPayload() {
      const fd = new FormData(form);
      const obj = {};
      fd.forEach((v, k) => { obj[k] = v; });
      // Compléter avec les checkboxes/non-cochées si besoin
      obj.rgpd = obj.rgpd === 'on' ? true : false;
      obj.submitted_at = new Date().toISOString();
      obj.user_agent = navigator.userAgent;
      return obj;
    }

    async function submitPayload(payload) {
      // TODO : brancher l'envoi vers un backend
      //   - Option 1 : Google Apps Script qui écrit dans un Sheets
      //   - Option 2 : Cloud Function (Vercel/Netlify/Cloudflare) qui envoie un mail
      //   - Option 3 : Service tiers type Formspree, Web3Forms, Brevo, etc.
      //
      // Exemple de squelette :
      //   const res = await fetch('https://api.example.com/inscription', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(payload),
      //   });
      //   if (!res.ok) throw new Error('Erreur d’envoi');
      //
      // Pour l'instant, on simule un envoi réussi avec un petit délai.
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
        // Succès : cache le form et l'en-tête, montre la confirmation
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

    // Init
    showStep(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
