
document.getElementById('year').textContent = new Date().getFullYear();

// Nav scroll shadow
var nav = document.getElementById('nav');
window.addEventListener('scroll', function(){
  nav.style.boxShadow = window.scrollY > 20 ? '0 8px 30px rgba(10,25,136,.08)' : 'none';
});
// Burger mobile
var burger = document.getElementById('burger');
var navLinks = document.getElementById('navLinks');
burger.addEventListener('click', function(){ navLinks.classList.toggle('open'); });
document.querySelectorAll('.nav-links a').forEach(function(a){
  a.addEventListener('click', function(){ navLinks.classList.remove('open'); });
});

// Lightbox
(function(){
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lightboxImg');
  var lbClose = document.getElementById('lightboxClose');
  document.querySelectorAll('#gallery .gitem').forEach(function(item){
    item.addEventListener('click', function(){
      var src = item.dataset.src;
      if(!src) return;
      lbImg.src = src;
      lbImg.alt = item.querySelector('img') ? item.querySelector('img').alt : '';
      lb.classList.add('active');
      lb.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
    });
  });
  function closeLb(){
    lb.classList.remove('active');
    lb.setAttribute('aria-hidden','true');
    lbImg.src = '';
    document.body.style.overflow = '';
  }
  lbClose.addEventListener('click', closeLb);
  lb.addEventListener('click', function(e){ if(e.target === lb) closeLb(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeLb(); });
})();
