/* ============================================================
   faq.js — animation fluide des accordéons <details>
   ------------------------------------------------------------
   Les <details> natifs n'animent pas l'ouverture/fermeture.
   Ce script intercepte le toggle, calcule scrollHeight, et
   anime max-height pour un effet fluide. Garde l'accessibilité.
   ============================================================ */

(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.faq-item').forEach((item) => {
    const summary = item.querySelector('summary');
    const body    = item.querySelector('.faq-body');
    if (!summary || !body) return;

    // Si l'utilisateur préfère pas d'anim, on laisse le natif
    if (reduce) return;

    // Initial state
    if (!item.hasAttribute('open')) {
      body.style.maxHeight = '0px';
    }

    let animating = false;

    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (animating) return;

      const isOpen = item.hasAttribute('open');

      if (isOpen) {
        // Fermeture : on fige la hauteur actuelle, puis on transitionne vers 0
        animating = true;
        const currentHeight = body.scrollHeight;
        body.style.maxHeight = currentHeight + 'px';
        // Force reflow pour que la transition démarre du bon point
        body.offsetHeight; // eslint-disable-line no-unused-expressions
        requestAnimationFrame(() => {
          body.style.maxHeight = '0px';
        });
        const onEnd = () => {
          body.removeEventListener('transitionend', onEnd);
          item.removeAttribute('open');
          animating = false;
        };
        body.addEventListener('transitionend', onEnd);
      } else {
        // Ouverture : on ajoute open, puis on anime de 0 vers scrollHeight
        animating = true;
        item.setAttribute('open', '');
        body.style.maxHeight = '0px';
        // Force reflow puis transition
        body.offsetHeight; // eslint-disable-line no-unused-expressions
        const target = body.scrollHeight;
        requestAnimationFrame(() => {
          body.style.maxHeight = target + 'px';
        });
        const onEnd = () => {
          body.removeEventListener('transitionend', onEnd);
          // Une fois ouvert, on libère max-height pour que le contenu
          // puisse grandir si jamais il change (images qui chargent, etc.)
          body.style.maxHeight = 'none';
          animating = false;
        };
        body.addEventListener('transitionend', onEnd);
      }
    });

    // Si la fenêtre est redimensionnée pendant qu'un item est ouvert,
    // on remet max-height à none pour éviter une coupure
    window.addEventListener('resize', () => {
      if (item.hasAttribute('open') && !animating) {
        body.style.maxHeight = 'none';
      }
    });
  });

})();
