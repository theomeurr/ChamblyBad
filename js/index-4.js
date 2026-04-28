
(function(){
  if(window.innerWidth>640)return;
  var ab=document.getElementById('actus-voir-plus');
  if(ab)ab.style.display='block';
  var db=document.getElementById('docs-voir-plus');
  if(db)db.style.display='block';
})();
// Menu rapide bottom-nav
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

var fitPhotosOpen=false;
function toggleFitPhotos(){
  fitPhotosOpen=!fitPhotosOpen;
  document.querySelectorAll('.fit-photo-extra').forEach(function(el){ el.hidden=!fitPhotosOpen; });
  var btn=document.getElementById('fit-voir-plus-btn');
  if(btn) btn.textContent=fitPhotosOpen?'Voir moins':'Voir plus de photos';
}
var actusOpen=false,docsOpen=false;
function toggleActus(){
  actusOpen=!actusOpen;
  document.querySelectorAll('.actu-extra').forEach(function(c){
    c.style.display=actusOpen?'flex':'';
  });
  var btn=document.getElementById('actus-btn');
  if(btn)btn.textContent=actusOpen?'Voir moins':'Voir plus';
}
function toggleDocs(){
  docsOpen=!docsOpen;
  document.querySelectorAll('.doc-extra').forEach(function(c){
    c.style.display=docsOpen?'flex':'';
  });
  var btn=document.getElementById('docs-btn');
  if(btn)btn.textContent=docsOpen?'Voir moins':'Voir plus';
}
// Bottom nav active state (scroll-sync)
(function(){
  if(window.innerWidth > 640) return;
  var sectionMap = [
    { id: 'equipes',    nav: null },
    { id: 'roster',     nav: null },
    { id: 'actus',      nav: 'actus' },
    { id: 'horaires',   nav: 'horaires' },
    { id: 'programmes', nav: 'programmes' },
    { id: 'fitness',    nav: 'programmes' },
    { id: 'contact',    nav: 'contact' }
  ];
  function updateActive(){
    var threshold = window.innerHeight * 0.5;
    var current = null;
    for(var i = 0; i < sectionMap.length; i++){
      var el = document.getElementById(sectionMap[i].id);
      if(!el) continue;
      if(el.getBoundingClientRect().top <= threshold){
        current = sectionMap[i].nav;
      } else {
        break; // sections dans l'ordre : dès qu'une est en dessous, les suivantes aussi
      }
    }
    // Nettoyer TOUS les bn-item (pas seulement [data-section])
    document.querySelectorAll('.bn-item').forEach(function(b){ b.classList.remove('active'); });
    if(current){
      var active = document.querySelector('.bn-item[data-section="'+current+'"]');
      if(active) active.classList.add('active');
    }
  }
  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
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

window.addEventListener('resize',function(){
  var isM=window.innerWidth<=640;
  var ab=document.getElementById('actus-voir-plus');
  if(ab)ab.style.display=isM?'block':'none';
  var db=document.getElementById('docs-voir-plus');
  if(db)db.style.display=isM?'block':'none';
  if(!isM){
    document.querySelectorAll('.actu-extra').forEach(function(c){c.style.display='';});
    document.querySelectorAll('.doc-extra').forEach(function(c){c.style.display='';});
    actusOpen=false;docsOpen=false;
    var ab2=document.getElementById('actus-btn');if(ab2)ab2.textContent='Voir plus';
    var db2=document.getElementById('docs-btn');if(db2)db2.textContent='Voir plus';
  }
});

// Lightbox fitness
(function(){
  var lb=document.getElementById('fitLightbox');
  var lbImg=document.getElementById('fitLightboxImg');
  var lbClose=document.getElementById('fitLightboxClose');
  var lbPrev=document.getElementById('fitLightboxPrev');
  var lbNext=document.getElementById('fitLightboxNext');
  var items=Array.from(document.querySelectorAll('[data-fit-lb]'));
  var current=0;

  function show(){
    var img=items[current].querySelector('img');
    lbImg.src=img?img.src:'';
    lbImg.alt=img?img.alt:'';
    lb.classList.add('active');
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    lbPrev.style.display=current>0?'':'none';
    lbNext.style.display=current<items.length-1?'':'none';
  }
  function close(){
    lb.classList.remove('active');
    lb.setAttribute('aria-hidden','true');
    lbImg.src='';
    document.body.style.overflow='';
  }
  items.forEach(function(item,i){
    item.addEventListener('click',function(){ current=i; show(); });
  });
  lbClose.addEventListener('click',close);
  lbPrev.addEventListener('click',function(e){ e.stopPropagation(); if(current>0){current--;show();} });
  lbNext.addEventListener('click',function(e){ e.stopPropagation(); if(current<items.length-1){current++;show();} });
  lb.addEventListener('click',function(e){ if(e.target===lb)close(); });
  document.addEventListener('keydown',function(e){
    if(!lb.classList.contains('active'))return;
    if(e.key==='Escape')close();
    if(e.key==='ArrowLeft'&&current>0){current--;show();}
    if(e.key==='ArrowRight'&&current<items.length-1){current++;show();}
  });
})();
