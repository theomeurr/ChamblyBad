/* ============================================================
   faq.js — animation fluide des accordéons <details>
   ------------------------------------------------------------
   Comportement "single-open" : ouvrir une question ferme les autres.
   - Animation max-height fluide à l'ouverture et à la fermeture
   - Respecte prefers-reduced-motion (fallback natif)
   - Garde l'accessibilité (<details>/<summary>)
   ============================================================ */

(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [...document.querySelectorAll('.faq-item')];
  if (!items.length) return;

  // ---------------------------------------------------------------
  // Animation helpers
  // ---------------------------------------------------------------
  function closeItem(item, immediate = false) {
    const body = item.querySelector('.faq-body');
    if (!body) return Promise.resolve();
    if (!item.hasAttribute('open')) return Promise.resolve();

    return new Promise((resolve) => {
      if (immediate || reduce) {
        item.removeAttribute('open');
        body.style.maxHeight = '0px';
        resolve();
        return;
      }
      // On fige la hauteur actuelle puis on anime vers 0
      const currentHeight = body.scrollHeight;
      body.style.maxHeight = currentHeight + 'px';
      // Force reflow
      body.offsetHeight; // eslint-disable-line no-unused-expressions
      requestAnimationFrame(() => {
        body.style.maxHeight = '0px';
      });
      const onEnd = () => {
        body.removeEventListener('transitionend', onEnd);
        item.removeAttribute('open');
        resolve();
      };
      body.addEventListener('transitionend', onEnd);
    });
  }

  function openItem(item) {
    const body = item.querySelector('.faq-body');
    if (!body) return Promise.resolve();

    return new Promise((resolve) => {
      item.setAttribute('open', '');
      if (reduce) {
        body.style.maxHeight = 'none';
        resolve();
        return;
      }
      body.style.maxHeight = '0px';
      // Force reflow puis transition
      body.offsetHeight; // eslint-disable-line no-unused-expressions
      const target = body.scrollHeight;
      requestAnimationFrame(() => {
        body.style.maxHeight = target + 'px';
      });
      const onEnd = () => {
        body.removeEventListener('transitionend', onEnd);
        // Une fois ouvert, max-height = none pour que le contenu puisse grandir
        body.style.maxHeight = 'none';
        resolve();
      };
      body.addEventListener('transitionend', onEnd);
    });
  }

  // ---------------------------------------------------------------
  // Init des items (état initial)
  // ---------------------------------------------------------------
  items.forEach((item) => {
    const body = item.querySelector('.faq-body');
    if (!body) return;
    if (!item.hasAttribute('open')) {
      body.style.maxHeight = '0px';
    } else {
      body.style.maxHeight = 'none';
    }
  });

  // ---------------------------------------------------------------
  // Click handler : comportement accordion (un seul ouvert)
  // ---------------------------------------------------------------
  let animating = false;

  items.forEach((item) => {
    const summary = item.querySelector('summary');
    if (!summary) return;

    summary.addEventListener('click', async (e) => {
      e.preventDefault();
      if (animating) return;
      animating = true;

      const isOpen = item.hasAttribute('open');

      if (isOpen) {
        // Cliquer sur l'item ouvert → on le ferme simplement
        await closeItem(item);
      } else {
        // Ouverture : on ferme d'abord les autres ouverts, puis on ouvre
        const otherOpens = items.filter(i => i !== item && i.hasAttribute('open'));
        // On lance les fermetures en parallèle pour fluidité
        await Promise.all(otherOpens.map(i => closeItem(i)));
        await openItem(item);
      }

      animating = false;
    });
  });

  // ---------------------------------------------------------------
  // Au resize, on remet max-height: none sur l'item ouvert (évite coupure)
  // ---------------------------------------------------------------
  window.addEventListener('resize', () => {
    if (animating) return;
    items.forEach((item) => {
      const body = item.querySelector('.faq-body');
      if (body && item.hasAttribute('open')) {
        body.style.maxHeight = 'none';
      }
    });
  });

})();
