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

    const links = Array.from(navLinks.querySelectorAll('a'));
    if (links.length === 0) return;

    // Crée la pill et l'insère au début pour qu'elle soit derrière les liens
    const pill = document.createElement('span');
    pill.className = 'nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    navLinks.insertBefore(pill, navLinks.firstChild);

    // Détecte le lien correspondant à la page courante
    const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    let activeLink = null;
    for (const a of links) {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (!href) continue;
      // Match direct sur le fichier (classement.html, reservations.html, galerie.html…)
      if (href === currentFile) { activeLink = a; break; }
      // Si on est sur index.html, on accepte aussi l'ancre #top comme actif
      if (currentFile === 'index.html' && (href === '#top' || href === '/' || href === './' || href === 'index.html')) {
        activeLink = a;
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
