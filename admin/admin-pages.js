/* Shared behavior for independently addressable admin HTML pages.
   Data and mutations continue to use the existing authenticated modules. */
(()=>{
 'use strict';
 const page=document.documentElement.dataset.adminPage||'operations';
 const known=['operations','products','localities','customers','partners','help'];
 if(!known.includes(page))return;
 document.querySelectorAll('[data-admin-link]').forEach(a=>{
   if(a.getAttribute('data-admin-link')===page)a.setAttribute('aria-current','page');
   else a.removeAttribute('aria-current');
 });
 if(page==='help'){
   const guide=document.getElementById('usageGuide');
   if(guide)guide.open=true;
 }
 // Records defaults are also set in records.js before its first authenticated request.
 // This fallback is useful when the page was restored from bfcache.
 if(page==='customers'||page==='partners'){
   const select=document.getElementById('recordsView');
   const wanted=page==='partners'?'partners':'customers';
   if(select&&select.value!==wanted){select.value=wanted;select.dispatchEvent(new Event('change'));}
 }
 document.addEventListener('keydown',e=>{
   if(e.key==='?'&&e.altKey){e.preventDefault();location.href='how-to.html';}
 });
})();
