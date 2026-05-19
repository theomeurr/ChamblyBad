
(function(){
  var btn = document.getElementById('bnPlusBtn');
  var menu = document.getElementById('bnPlusMenu');
  if(!btn||!menu) return;
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = !menu.hidden;
    menu.hidden = open;
    btn.setAttribute('aria-expanded', String(!open));
    btn.classList.toggle('bn-plus-open', !open);
  });
  document.addEventListener('click', function(){ menu.hidden=true; btn.setAttribute('aria-expanded','false'); btn.classList.remove('bn-plus-open'); });
  menu.addEventListener('click', function(e){ e.stopPropagation(); });
})();
// Bouton retour en haut
(function(){
  var topBtn = document.getElementById('btnTop');
  if(!topBtn) return;
  function syncTopBtn(){
    var menu = document.getElementById('bnPlusMenu');
    var menuOpen = menu && !menu.hidden;
    if(window.scrollY > 300 && !menuOpen){ topBtn.classList.add('visible'); }
    else { topBtn.classList.remove('visible'); }
  }
  window.addEventListener('scroll', syncTopBtn, {passive:true});
  topBtn.addEventListener('click', function(){ window.scrollTo({top:0,behavior:'smooth'}); });
  var bnMenu = document.getElementById('bnPlusMenu');
  if(bnMenu){ new MutationObserver(syncTopBtn).observe(bnMenu, {attributes:true, attributeFilter:['hidden']}); }
  syncTopBtn();
})();
