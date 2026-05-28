/* ============================================================
   contact.js — Modal du formulaire "Nous contacter"
   ------------------------------------------------------------
   - Ouvre/ferme la modale (.cm-bg) via le bouton CTA
   - Validation client (champs requis, email valide, RGPD)
   - Envoi AJAX vers Web3Forms
   - Affiche l'écran de confirmation in-place
   - Honeypot anti-spam
   - Fermeture via clic dehors, croix, ou touche Escape
   ============================================================ */

(function () {
  'use strict';

  // Même clé Web3Forms que la séance d'essai (compte bcco60@gmail.com)
  const WEB3FORMS_ACCESS_KEY = '6351f62b-06c4-47c1-863b-336b9c31227f';

  const openBtn   = document.getElementById('open-contact-modal');
  const modal     = document.getElementById('contact-modal');
  if (!openBtn || !modal) return;

  const closeBtn  = document.getElementById('cm-close');
  const cancelBtn = document.getElementById('cm-cancel');
  const form      = document.getElementById('cm-form');
  const submitBtn = document.getElementById('cm-submit');
  const errMsg    = document.getElementById('cm-err');
  const confirmEl = document.getElementById('cm-confirm');
  const rgpdInput = document.getElementById('cm-rgpd');
  const rgpdLabel = document.getElementById('cm-rgpd-label');

  // ---------------------------------------------------------------
  // Ouverture / fermeture
  // ---------------------------------------------------------------
  function openModal() {
    // reset l'état (au cas où le user re-ouvre après un envoi)
    form.style.display = '';
    confirmEl.classList.remove('show');
    clearError();
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));
    document.body.style.overflow = 'hidden';
    // Focus 1er champ
    setTimeout(() => {
      const first = form.querySelector('input[type="text"]');
      if (first) first.focus();
    }, 200);
  }

  function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => {
      modal.hidden = true;
      // reset form si fermé après confirmation (prochaine ouverture frais)
      if (confirmEl.classList.contains('show')) {
        form.reset();
        if (rgpdLabel) rgpdLabel.classList.remove('checked');
      }
    }, 220);
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  // ---------------------------------------------------------------
  // RGPD style "checked"
  // ---------------------------------------------------------------
  if (rgpdInput && rgpdLabel) {
    rgpdInput.addEventListener('change', () => {
      rgpdLabel.classList.toggle('checked', rgpdInput.checked);
    });
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function showError(msg) {
    errMsg.textContent = msg;
    errMsg.classList.add('show');
  }
  function clearError() {
    errMsg.classList.remove('show');
    errMsg.textContent = '';
  }
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('loading', loading);
    submitBtn.innerHTML = loading
      ? '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Envoi…'
      : '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg> Envoyer';
  }
  function showConfirm() {
    form.style.display = 'none';
    confirmEl.classList.add('show');
  }

  // ---------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------
  function validate() {
    const prenom  = form.prenom.value.trim();
    const nom     = form.nom.value.trim();
    const email   = form.email.value.trim();
    const message = form.message.value.trim();
    if (!prenom || !nom)   return 'Merci de renseigner ton prénom et ton nom.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Merci de saisir un email valide.';
    if (!message)          return 'Merci d\'écrire ton message.';
    if (message.length < 10) return 'Ton message est un peu court — donne-nous quelques détails pour qu\'on puisse t\'aider.';
    if (!rgpdInput.checked) return 'Tu dois accepter le traitement des données pour qu\'on puisse te recontacter.';
    return null;
  }

  // ---------------------------------------------------------------
  // Submit → Web3Forms
  // ---------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const err = validate();
    if (err) { showError(err); return; }

    // Honeypot
    if (form.botcheck && form.botcheck.checked) return;

    if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY.indexOf('__') === 0) {
      showError('Le formulaire n\'est pas encore configuré. Écris-nous directement à bcco60@gmail.com.');
      return;
    }

    setLoading(true);

    const formData = new FormData(form);
    formData.append('access_key', WEB3FORMS_ACCESS_KEY);
    formData.append('subject', `[BCCO] Contact site — ${form.prenom.value} ${form.nom.value}`);
    formData.append('from_name', 'Site BCCO — Formulaire de contact');

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setLoading(false);
      if (data && data.success) {
        showConfirm();
      } else {
        showError((data && data.message) || 'Une erreur est survenue. Réessaie ou écris-nous à bcco60@gmail.com.');
      }
    } catch (e) {
      setLoading(false);
      showError('Impossible d\'envoyer le formulaire (connexion). Réessaie dans un instant.');
    }
  });

})();
