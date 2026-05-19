
/* ===== Scroll Reveal ===== */
(function(){
  const targets = document.querySelectorAll(
    'section, .prog-card, .actu-card, .doc, .book-card, .contact-item, .salle-stats, .team-card'
  );
  targets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if(entry.isIntersecting){
        setTimeout(() => entry.target.classList.add('visible'), i * 60);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  targets.forEach(el => io.observe(el));
})();
