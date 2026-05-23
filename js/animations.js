/* =================================================================
   animations.js — micro-interactions design (BCCO)
   - Scroll reveal avancé (variantes + stagger)
   - Compteurs animés sur stats / palmarès
   - Spotlight hover (curseur)
   - Tilt léger
   - Parallax hero
   - Injection de volants SVG dans le hero
   ================================================================= */
(function(){
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Volants SVG injectés dans le hero ---------- */
  const hero = document.querySelector('.hero');
  if (hero && !hero.querySelector('.hero-shuttles') && !reduce){
    const wrap = document.createElement('div');
    wrap.className = 'hero-shuttles';
    wrap.setAttribute('aria-hidden','true');
    const shuttleSVG = `
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="46" cy="46" r="6" fill="currentColor" stroke="none"/>
        <path d="M40 40 L18 8"/>
        <path d="M44 38 L24 4"/>
        <path d="M48 42 L32 6"/>
        <path d="M40 44 L8 22"/>
        <path d="M42 48 L6 30"/>
      </svg>`;
    wrap.innerHTML = `
      <div class="shuttle s1">${shuttleSVG}</div>
      <div class="shuttle s2">${shuttleSVG}</div>
      <div class="shuttle s3">${shuttleSVG}</div>
      <div class="shuttle s4">${shuttleSVG}</div>`;
    hero.prepend(wrap);
  }

  /* ---------- 2. Parallax hero (très léger) ---------- */
  const heroImg = document.querySelector('.hero-visual');
  if (heroImg && !reduce){
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = heroImg.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const progress = Math.max(-1, Math.min(1, (rect.top + rect.height/2 - vh/2) / vh));
        heroImg.style.setProperty('--py', (progress * -22) + 'px');
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 3. Scroll reveal avancé (variantes + stagger) ---------- */
  // Marque automatiquement certains conteneurs "stagger"
  document.querySelectorAll(
    '.club-features, .docs-grid, .teams-overview, .prog-grid, .stats-inner, .booking, .salle-hero-stats, .flame-highlights, .buvette-hero-items'
  ).forEach(el => el.classList.add('stagger'));

  // Marque les variantes
  document.querySelectorAll('.team-card .media').forEach(el => el.classList.add('reveal-left'));
  document.querySelectorAll('.team-card .content').forEach(el => el.classList.add('reveal-right'));
  document.querySelectorAll('.club-visual').forEach(el => el.classList.add('reveal-left'));
  document.querySelectorAll('.club-text').forEach(el => el.classList.add('reveal-right'));
  document.querySelectorAll('.fitness-img-wrap').forEach(el => el.classList.add('reveal-left'));
  document.querySelectorAll('.fitness > div:not(.fitness-img-wrap)').forEach(el => el.classList.add('reveal-right'));

  const ioReveal = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('is-in');
        ioReveal.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll(
    '.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .stagger'
  ).forEach(el => ioReveal.observe(el));

  /* ---------- 4. Compteurs animés (re-déclenchés à chaque entrée dans le viewport) ---------- */
  const counterTargets = document.querySelectorAll(
    '.stats .stat .num, .floating-card .num, .fh-num, .shn, .book-price, ' +
    '.team-stats .ts-num, .rank-pos'
  );

  // Mémorise la valeur originale pour pouvoir relancer plusieurs fois.
  counterTargets.forEach(el => {
    if (!el.dataset.original) el.dataset.original = el.textContent.trim();
  });

  const animateCount = (el) => {
    if (el.dataset.running === '1') return; // évite de relancer pendant l'animation en cours
    const raw = el.dataset.original || el.textContent.trim();
    const match = raw.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!match) return;
    el.dataset.running = '1';
    const prefix = match[1];
    const numStr = match[2].replace(',', '.');
    const suffix = match[3];
    const target = parseFloat(numStr);
    const isFloat = /\./.test(numStr);
    const duration = 1100;
    const start = performance.now();
    el.classList.add('counting');
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = target * ease(t);
      const out = isFloat ? v.toFixed(1) : Math.round(v).toString();
      el.textContent = prefix + out + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else {
        el.textContent = raw;
        el.dataset.running = '0';
        setTimeout(() => el.classList.remove('counting'), 600);
      }
    };
    requestAnimationFrame(tick);
  };

  if (!reduce){
    const ioCount = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target;
        if (entry.isIntersecting){
          // Relance à chaque entrée si pas déjà en cours
          if (el.dataset.running !== '1') animateCount(el);
        } else {
          // Sortie du viewport : reset l'affichage à 0 pour que le prochain défilement reparte de 0
          if (el.dataset.running !== '1' && el.dataset.original){
            const m = el.dataset.original.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
            if (m) el.textContent = m[1] + '0' + m[3];
          }
        }
      });
    }, { threshold: 0.5 });
    counterTargets.forEach(el => ioCount.observe(el));
  }

  /* ---------- 5.bis Galerie : caption auto depuis alt ---------- */
  document.querySelectorAll('.gallery-full .gitem').forEach(it => {
    if (it.dataset.caption) return;
    const img = it.querySelector('img');
    if (img && img.alt) it.dataset.caption = img.alt;
  });

  /* ---------- 5+6. Spotlight + Tilt — pointer fin uniquement, listener unique, rAF throttle ---------- */
  // Sur tactile (pointer: coarse) on saute complètement : pas de hover utile,
  // et le coût des pointermove pendant le scroll est l'un des principaux responsables du lag.
  if (!reduce && window.matchMedia('(pointer: fine)').matches){
    const spotSelector = '.feature, .doc, .team-mini, .prog-card, .book-card, .actu-card, .bhi, .fh, .stat';
    const tiltSelector = '.team-mini, .prog-card, .book-card, .feature';

    document.querySelectorAll(spotSelector).forEach(el => el.classList.add('spotlight'));
    document.querySelectorAll(tiltSelector).forEach(el => el.classList.add('tilt'));

    let frame = 0;
    let lastTilt = null;
    let lx = 0, ly = 0;

    const flush = () => {
      frame = 0;
      const el = document.elementFromPoint(lx, ly);
      const spot = el && el.closest(spotSelector);
      const tilt = el && el.closest(tiltSelector);

      if (spot){
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--mx', ((lx - r.left) / r.width * 100).toFixed(1) + '%');
        spot.style.setProperty('--my', ((ly - r.top) / r.height * 100).toFixed(1) + '%');
      }
      if (tilt){
        const r = tilt.getBoundingClientRect();
        const cx = (lx - r.left) / r.width - .5;
        const cy = (ly - r.top) / r.height - .5;
        tilt.style.setProperty('--rx', (cx * 6).toFixed(2) + 'deg');
        tilt.style.setProperty('--ry', (-cy * 6).toFixed(2) + 'deg');
        lastTilt = tilt;
      } else if (lastTilt){
        lastTilt.style.setProperty('--rx', '0deg');
        lastTilt.style.setProperty('--ry', '0deg');
        lastTilt = null;
      }
    };

    document.addEventListener('pointermove', (e) => {
      lx = e.clientX; ly = e.clientY;
      if (!frame) frame = requestAnimationFrame(flush);
    }, { passive: true });
  }
})();
