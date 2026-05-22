/* ============================================================
   seance-essai.js
   Gestion du formulaire de demande de séance d'essai.
   - Bascule des tuiles "type d'essai" et "niveau"
   - Validation client
   - Envoi AJAX vers Web3Forms (https://web3forms.com)
   - Affichage succès / erreur sans rechargement
   ============================================================ */

(function () {
  'use strict';

  // ⚠️ ÉTAPE OBLIGATOIRE AVANT MISE EN PROD :
  // Remplacer la valeur ci-dessous par ta clé Web3Forms.
  // 1. Va sur https://web3forms.com
  // 2. Renseigne l'email du club → "Create Access Key"
  // 3. Copie la clé reçue par mail, colle-la ici.
  const WEB3FORMS_ACCESS_KEY = '6351f62b-06c4-47c1-863b-336b9c31227f';

  const form        = document.getElementById('se-form');
  const submitBtn   = document.getElementById('se-submit');
  const errMsg      = document.getElementById('se-err');
  const confirmBox  = document.getElementById('se-confirm');
  const rgpdLabel   = document.getElementById('se-rgpd-label');
  const rgpdInput   = document.getElementById('se-rgpd');

  if (!form) return;

  // ----- Bascule des tuiles (type + niveau) -----
  function setupChoiceGroup(containerId, hiddenInputId, dataAttr) {
    const container = document.getElementById(containerId);
    const hidden    = document.getElementById(hiddenInputId);
    if (!container || !hidden) return;

    container.querySelectorAll('.se-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.se-choice').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        hidden.value = btn.dataset[dataAttr];
      });
    });
  }
  setupChoiceGroup('se-type',    'se-type-input',    'type');
  setupChoiceGroup('se-niveau',  'se-niveau-input',  'niveau');

  // ----- Style "checked" du bloc RGPD -----
  if (rgpdInput && rgpdLabel) {
    rgpdInput.addEventListener('change', () => {
      rgpdLabel.classList.toggle('checked', rgpdInput.checked);
    });
  }

  // ----- Helpers -----
  function showError(msg) {
    errMsg.textContent = msg;
    errMsg.classList.add('show');
    errMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function clearError() {
    errMsg.classList.remove('show');
    errMsg.textContent = '';
  }
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('loading', loading);
    submitBtn.innerHTML = loading
      ? '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Envoi en cours…'
      : '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg> Envoyer ma demande';
  }
  function showConfirm() {
    form.style.display = 'none';
    confirmBox.classList.add('show');
    confirmBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ----- Validation -----
  function validate() {
    const prenom = form.prenom.value.trim();
    const nom    = form.nom.value.trim();
    const email  = form.email.value.trim();
    const rgpd   = rgpdInput.checked;

    if (!prenom || !nom) return 'Merci de renseigner ton prénom et ton nom.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Merci de saisir un email valide.';
    if (!rgpd) return 'Tu dois accepter le traitement des données pour qu’on puisse te recontacter.';
    return null;
  }

  // ----- Submit -----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const err = validate();
    if (err) { showError(err); return; }

    // Vérif honeypot (anti-spam)
    if (form.botcheck && form.botcheck.checked) return;

    // Vérif que la clé a bien été remplie
    if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY.indexOf('__') === 0) {
      showError('Le formulaire n’est pas encore configuré côté technique. Merci de nous écrire directement à t.meurier13@gmail.com.');
      return;
    }

    setLoading(true);

    // Construction du payload Web3Forms
    const formData = new FormData(form);
    formData.append('access_key', WEB3FORMS_ACCESS_KEY);
    formData.append('subject', `[BCCO] Nouvelle demande de séance d'essai — ${form.prenom.value} ${form.nom.value}`);
    formData.append('from_name', 'Site BCCO — Séance d\'essai');
    // Champ "redirect" volontairement omis : on reste sur la page, on gère le succès en JS

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data && data.success) {
        setLoading(false);
        showConfirm();
      } else {
        setLoading(false);
        showError((data && data.message) || 'Une erreur est survenue. Réessaie ou écris-nous à t.meurier13@gmail.com.');
      }
    } catch (e) {
      setLoading(false);
      showError('Impossible d’envoyer le formulaire (connexion). Réessaie dans un instant.');
    }
  });

})();
