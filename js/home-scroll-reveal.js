/* ============================================================
   home-scroll-reveal.js — Scroll reveal enrichi
   ------------------------------------------------------------
   - Sections principales       → reveal-up (fade + slide up)
   - Headers de section         → reveal-up (cascade au scroll)
   - Grilles de cards           → stagger (enfants en cascade)
   - Cards individuelles        → reveal-up
   - Visuels (carousels, halle) → reveal-scale (zoom doux)
   - Sections 2-cols            → reveal-left / -right alternés
   Respecte prefers-reduced-motion.
   ============================================================ */

(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // mode reduce : tout visible direct, aucune anim

  // ---------------------------------------------------------------
  // 1. Application des classes
  // ---------------------------------------------------------------

  // Sections principales : reveal-up (sauf le hero, déjà animé)
  document.querySelectorAll('main section').forEach((s) => {
    if (s.classList.contains('hero')) return;
    if (s.classList.contains('reveal-up')) return;
    s.classList.add('reveal-up');
  });

  // Grilles : stagger (enfants en cascade)
  const gridSelectors = [
    '.actus-grid', '.ac-track',
    '.quick-cats',
    '.equipe-cards',
    '.stats-row', '.stats-inner',
    '.prog-grid', '.programmes-grid',
    '.doc-grid', '.docs-grid',
    '.sponsors-grid',
    '.faq-grid',
    '.team-grid', '.team-cards',
    '.roster-grid',
    '.contact-actions'
  ];
  gridSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((g) => {
      if (g.children && g.children.length >= 2) {
        g.classList.add('stagger');
      }
    });
  });

  // Cards isolées (pas dans un stagger) : reveal-up
  const cardSelectors = [
    '.actu-card', '.doc', '.book-card', '.contact-item',
    '.team-card', '.team-mini', '.prog-card', '.faq-item',
    '.feature', '.sponsor-card'
  ];
  cardSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((c) => {
      if (c.closest('.stagger')) return;
      if (c.classList.contains('reveal-up')) return;
      c.classList.add('reveal-up');
    });
  });

  // Headers de section : reveal-up
  document.querySelectorAll('.sec-head').forEach((h) => {
    if (!h.classList.contains('reveal-up')) h.classList.add('reveal-up');
  });

  // Éléments visuels : reveal-scale (zoom doux)
  const scaleSelectors = ['.salle-hero', '.buvette-hero', '.flame-card', '.sc-outer', '.actus-carousel'];
  scaleSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.classList.contains('reveal-up')) el.classList.remove('reveal-up');
      if (!el.classList.contains('reveal-scale')) el.classList.add('reveal-scale');
    });
  });

  // Sections 2-cols : alternance left/right des enfants directs
  const altSelectors = ['.fitness-grid', '.contact-grid', '.salle-grid', '.club-grid'];
  altSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((container) => {
      [...container.children].forEach((child, i) => {
        if (child.classList.contains('reveal-up')) child.classList.remove('reveal-up');
        if (child.classList.contains('stagger')) return;
        child.classList.add(i % 2 === 0 ? 'reveal-left' : 'reveal-right');
      });
    });
  });

  // ---------------------------------------------------------------
  // 2. Compatibilité ancienne (.reveal/.visible)
  // ---------------------------------------------------------------
  // Retire .reveal si déjà géré par une variante (évite double anim)
  document.querySelectorAll('.reveal').forEach((el) => {
    if (el.classList.contains('reveal-up') || el.classList.contains('reveal-left') ||
        el.classList.contains('reveal-right') || el.classList.contains('reveal-scale')) {
      el.classList.remove('reveal');
    }
  });

  // ---------------------------------------------------------------
  // 3. IntersectionObserver — toggle .is-in (variantes) + .visible (legacy)
  // ---------------------------------------------------------------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;

      if (el.classList.contains('reveal-up') ||
          el.classList.contains('reveal-left') ||
          el.classList.contains('reveal-right') ||
          el.classList.contains('reveal-scale') ||
          el.classList.contains('stagger')) {
        el.classList.add('is-in');
      }
      if (el.classList.contains('reveal')) {
        el.classList.add('visible');
      }
      io.unobserve(el);
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px'
  });

  document.querySelectorAll(
    '.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .stagger, .reveal'
  ).forEach((el) => io.observe(el));

})();
