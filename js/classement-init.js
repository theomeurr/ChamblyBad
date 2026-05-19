
// Nav scroll shadow
var nav = document.getElementById('nav');
window.addEventListener('scroll', function(){
  nav.style.boxShadow = window.scrollY > 20 ? '0 8px 30px rgba(10,25,136,.08)' : 'none';
});
// Burger mobile
var burger = document.getElementById('burger');
var navLinks = document.getElementById('navLinks');
burger.addEventListener('click', function(){
  navLinks.classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(function(a){
  a.addEventListener('click', function(){ navLinks.classList.remove('open'); });
});
