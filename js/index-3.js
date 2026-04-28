
// Year
document.getElementById('year').textContent = new Date().getFullYear();

// Burger menu
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  burger.classList.toggle('active', open);
  burger.setAttribute('aria-expanded', open ? 'true' : 'false');
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('open');
  burger.classList.remove('active');
  burger.setAttribute('aria-expanded', 'false');
}));

// Team tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.team-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Roster tabs (Joueurs / Staff)
document.querySelectorAll('.rt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.panel;
    document.querySelectorAll('.rt-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === target));
    document.querySelectorAll('.roster-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === target));
  });
});

// Nav shadow on scroll
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) nav.style.boxShadow = '0 8px 30px rgba(10,25,136,.08)';
  else nav.style.boxShadow = 'none';
});

// ===== Planning mobile : sélecteur de jour =====
(function(){
  function initScheduleMobile(container){
    var panels = container.querySelectorAll('.sm-panel');
    var label = container.querySelector('.sm-day-name');
    if(!panels.length || !label) return;
    var cur = 0;
    function go(n){
      panels[cur].hidden = true;
      cur = (n + panels.length) % panels.length;
      panels[cur].hidden = false;
      label.textContent = panels[cur].dataset.label;
    }
    container.querySelector('.sm-prev').addEventListener('click', function(){ go(cur - 1); });
    container.querySelector('.sm-next').addEventListener('click', function(){ go(cur + 1); });
  }
  document.querySelectorAll('.schedule-mobile').forEach(function(c){ initScheduleMobile(c); });
})();

// ===== Programmes : sélecteur Jeunes / Adultes (mobile) =====
(function(){
  var btns = document.querySelectorAll('.prog-cat-btn');
  var groups = document.querySelectorAll('.prog-group');
  if(!btns.length) return;

  function activate(cat){
    btns.forEach(function(b){ b.classList.toggle('active', b.dataset.cat === cat); });
    groups.forEach(function(g){
      if(window.innerWidth <= 640){
        g.classList.toggle('hidden-cat', g.dataset.cat !== cat);
      } else {
        g.classList.remove('hidden-cat');
      }
    });
  }

  btns.forEach(function(btn){
    btn.addEventListener('click', function(){ activate(btn.dataset.cat); });
  });

  // Sur desktop : tout afficher ; sur mobile : jeunes par défaut
  function onResize(){
    if(window.innerWidth > 640){
      groups.forEach(function(g){ g.classList.remove('hidden-cat'); });
    } else {
      var active = document.querySelector('.prog-cat-btn.active');
      if(active) activate(active.dataset.cat);
    }
  }
  window.addEventListener('resize', onResize);
  onResize();
})();

// ===== Roster collapse (mobile) =====
(function(){
  var grid = document.querySelector('.roster-grid');
  var btn = document.getElementById('roster-showmore');
  if(!grid || !btn) return;
  function applyCollapse(){
    if(window.innerWidth <= 640){ grid.classList.add('collapsed'); btn.textContent = "Voir toute l'équipe ↓"; }
    else grid.classList.remove('collapsed');
  }
  applyCollapse();
  btn.addEventListener('click', function(){
    grid.classList.toggle('collapsed');
    btn.textContent = grid.classList.contains('collapsed') ? "Voir toute l'équipe ↓" : 'Réduire ↑';
  });
  window.addEventListener('resize', applyCollapse);
})();

// ===== Gallery collapse (mobile) =====
// (galerie déplacée sur galerie.html)
