// Comportement du mega-menu groupé (Le Club / Compétition / Pratique).
//
// Fonctionnel :
//  - Hover desktop : géré en CSS (ouvre au survol du .nav-group)
//  - Click sur trigger : toggle aria-expanded (utile clavier + mobile)
//  - Click ailleurs : ferme tous les menus ouverts
//  - Échap : ferme tous les menus ouverts
//  - Mobile : burger qui slide la nav-links depuis la droite,
//    chaque trigger devient un accordéon
(function () {
  'use strict';

  function init() {
    const triggers = Array.from(document.querySelectorAll('.nav-trigger'));
    const navLinks = document.getElementById('navLinks');
    const burger = document.getElementById('burger');

    if (triggers.length === 0 && !burger) return;

    function closeAllMega() {
      triggers.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    }

    function openMega(trigger) {
      triggers.forEach((t) => {
        t.setAttribute(
          'aria-expanded',
          t === trigger ? 'true' : 'false',
        );
      });
    }

    const isMobile = () => window.matchMedia('(max-width: 980px)').matches;

    // Hover desktop : on écoute sur le bouton ET directement sur le mega-menu.
    // Sans ça, quand la souris traverse le gap entre le bouton et le menu,
    // le mouseenter sur le nav-group ne se déclenche pas (le mega est hors de ses bornes visuelles).
    triggers.forEach((trigger) => {
      const group = trigger.closest('.nav-group');
      const mega = group && group.querySelector('.nav-mega');
      if (!group) return;
      let closeTimer = null;

      const clearClose = () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } };
      const startClose = () => { clearClose(); closeTimer = setTimeout(() => { closeAllMega(); closeTimer = null; }, 300); };

      group.addEventListener('mouseenter', () => { if (!isMobile()) { clearClose(); openMega(trigger); } });
      group.addEventListener('mouseleave', () => { if (!isMobile()) startClose(); });

      if (mega) {
        mega.addEventListener('mouseenter', () => { if (!isMobile()) { clearClose(); openMega(trigger); } });
        mega.addEventListener('mouseleave', () => { if (!isMobile()) startClose(); });
      }
    });

    // Click sur un trigger → toggle
    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        if (isOpen) closeAllMega();
        else openMega(trigger);
      });
    });

    // Click n'importe où ailleurs ferme les menus
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-group')) {
        closeAllMega();
      }
    });

    // Échap ferme tout
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllMega();
        if (navLinks && navLinks.classList.contains('is-open')) {
          navLinks.classList.remove('is-open');
          if (burger) {
            burger.classList.remove('active');
            burger.setAttribute('aria-expanded', 'false');
          }
        }
      }
    });

    // ===== Burger mobile =====
    if (burger && navLinks) {
      burger.addEventListener('click', (e) => {
        e.preventDefault();
        const willOpen = !navLinks.classList.contains('is-open');
        navLinks.classList.toggle('is-open', willOpen);
        burger.classList.toggle('active', willOpen);
        burger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        // Ferme les sous-menus quand on referme la nav mobile
        if (!willOpen) closeAllMega();
      });

      // Click sur un lien interne → ferme la nav mobile pour voir la cible
      navLinks.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => {
          if (window.matchMedia('(max-width: 980px)').matches) {
            navLinks.classList.remove('is-open');
            burger.classList.remove('active');
            burger.setAttribute('aria-expanded', 'false');
            closeAllMega();
          }
        });
      });
    }

    // Resize : ferme tout si on passe de mobile à desktop
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth > 980) {
          if (navLinks) navLinks.classList.remove('is-open');
          if (burger) {
            burger.classList.remove('active');
            burger.setAttribute('aria-expanded', 'false');
          }
        }
        closeAllMega();
      }, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
