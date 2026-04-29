// Liquid pill : un fond animé qui glisse fluidement entre les liens du menu top.
// Inspiration : nav d'Apple / liquid pill effect.
//
// Comportement :
//  - Au survol d'un lien, la pill se déplace vers ce lien avec une easing élastique.
//  - Quand la souris quitte la nav, la pill revient se poser sur le lien actif
//    (page courante).
//  - Sans page courante détectée → la pill disparaît.
(function () {
  'use strict';

  function init() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return; // ex: page admin sans nav publique

    // Cible UNIQUEMENT les éléments de niveau top (boutons de groupe + CTAs).
    // Les liens à l'intérieur des .nav-mega ne déclenchent pas la pill.
    const links = Array.from(navLinks.querySelectorAll('.nav-item'));
    if (links.length === 0) return;

    // Crée la pill et l'insère au début pour qu'elle soit derrière les liens
    const pill = document.createElement('span');
    pill.className = 'nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    navLinks.insertBefore(pill, navLinks.firstChild);

    // Détecte le lien correspondant à la page courante.
    // Les triggers de groupe ne sont jamais considérés comme actifs
    // (ils ouvrent un sous-menu, pas une page).
    const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    let activeLink = null;
    for (const el of links) {
      // Skip les boutons (triggers de mega-menu)
      if (el.tagName === 'BUTTON') continue;
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (!href) continue;
      if (href === currentFile) { activeLink = el; break; }
      if (currentFile === 'index.html' && (href === '#top' || href === '/' || href === './' || href === 'index.html')) {
        activeLink = el;
        break;
      }
    }

    function placeOn(link) {
      if (!link) {
        pill.classList.remove('is-visible');
        return;
      }
      const linkRect = link.getBoundingClientRect();
      const navRect = navLinks.getBoundingClientRect();
      pill.style.left = (linkRect.left - navRect.left) + 'px';
      pill.style.top = (linkRect.top - navRect.top) + 'px';
      pill.style.width = linkRect.width + 'px';
      pill.style.height = linkRect.height + 'px';
      pill.classList.add('is-visible');
    }

    // Pose initiale après le layout, sans animation (snap)
    function snapTo(link) {
      if (!link) return;
      pill.classList.add('is-no-anim');
      placeOn(link);
      // Force un reflow puis réactive l'animation
      // eslint-disable-next-line no-unused-expressions
      pill.offsetWidth;
      requestAnimationFrame(() => pill.classList.remove('is-no-anim'));
    }

    if (activeLink) snapTo(activeLink);

    // Hover : la pill suit le pointeur
    links.forEach((link) => {
      link.addEventListener('mouseenter', () => placeOn(link));
      link.addEventListener('focus', () => placeOn(link));
    });

    // Sortie de zone : retour sur le lien actif (ou disparition)
    navLinks.addEventListener('mouseleave', () => {
      if (activeLink) placeOn(activeLink);
      else pill.classList.remove('is-visible');
    });

    // Recalcul à chaque resize (les liens peuvent bouger)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (activeLink) snapTo(activeLink);
      }, 80);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
