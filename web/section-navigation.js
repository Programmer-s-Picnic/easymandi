/* Customer navigation follows the Flutter application's catalog + More menu.
   Basket and Account are existing dialogs. No extra website-only tab memory. */
(()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
 const menuButton=byId('appMore'),menu=byId('appMoreMenu');
 if(!menuButton||!menu)return;
 const valid=new Set(['catalog','orders','deliveries']);
 const viewFromHash=()=>{
   let hash='';
   try{hash=decodeURIComponent(location.hash.slice(1));}catch{return 'catalog';}
   return ({myOrdersPanel:'orders',deliveryPanel:'deliveries',shopCatalog:'catalog'})[hash]||
       (valid.has(hash)?hash:'catalog');
 };
 let current='catalog',afterSignIn=null;
 const closeMenu=()=>{menu.hidden=true;menuButton.setAttribute('aria-expanded','false');};
 // Every screen has a direct refresh entry point. This avoids lost custom events
 // and does not require navigating away or reloading the document to update.
 const refreshCurrent=id=>{
   const calls=id==='catalog'
     ?[window.EasyMandiCatalog?.refresh,window.EasyMandiCustomerData?.refresh]
     :id==='orders'?[window.EasyMandiOrders?.refresh]
     :[window.EasyMandiDeliveries?.refresh];
   for(const task of calls){
     if(typeof task!=='function')continue;
     try{Promise.resolve(task()).catch(()=>{});}catch(_){}
   }
 };
 function activate(id,{push=false,scroll=true}={}){
   if(!valid.has(id))return false;
   if(id!=='catalog'&&!window.CustomerAccount?.user){
     afterSignIn=id;
     closeMenu();
     // A saved session may still be restoring; do not display a sign-in dialog.
     if(!window.CustomerAccount?.restoring)byId('accountButton')?.click();
     return false;
   }
   const reopened=current===id;
   current=id;
   document.querySelectorAll('[data-customer-section]').forEach(section=>{
     section.hidden=section.dataset.customerSection!==id;
   });
   document.body.dataset.customerSection=id;
   if(push&&location.hash!=='#'+id)history.pushState(null,'',location.pathname+location.search+'#'+id);
   // Always notify data controllers, even when reselecting an already open view.
   window.dispatchEvent(new CustomEvent('customer-section-opened',{detail:{section:id,reopened}}));
   refreshCurrent(id);
   closeMenu();
   if(scroll)window.scrollTo({top:0,behavior:'auto'});
   return true;
 }
 window.EasyMandiSections=Object.freeze({select:id=>activate(id,{push:true}),get current(){return current;}});
 menuButton.addEventListener('click',()=>{menu.hidden=!menu.hidden;menuButton.setAttribute('aria-expanded',String(!menu.hidden));});
 menu.addEventListener('click',event=>{
   const button=event.target.closest('button');
   if(!button)return;
   if(button.dataset.appView)activate(button.dataset.appView,{push:true});
   else if(button.id==='appReload')byId('refresh')?.click();
   else if(button.id==='appAbout')byId('aboutDialog')?.showModal();
   closeMenu();
 });
 document.addEventListener('click',event=>{if(!menu.contains(event.target)&&event.target!==menuButton)closeMenu();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
 window.addEventListener('customer-account-changed',()=>{
   if(!window.CustomerAccount?.user){
     if(current!=='catalog')activate('catalog',{push:false,scroll:false});
   }else if(afterSignIn){const target=afterSignIn;afterSignIn=null;activate(target,{push:true});}
 });
 window.addEventListener('customer-account-ready',()=>{
   // A deep-linked private section requested while login restoration was pending.
   if(afterSignIn&&!window.CustomerAccount?.user&&!window.CustomerAccount?.restoring)
     byId('accountButton')?.click();
 });
 window.addEventListener('pageshow',event=>{
   // Back/forward cache restores the page without rerunning scripts.
   if(event.persisted)activate(viewFromHash(),{scroll:false});
 });
 window.addEventListener('focus',()=>{if(!document.hidden)refreshCurrent(current);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCurrent(current);});
 window.addEventListener('popstate',()=>activate(viewFromHash(),{scroll:false}));
 window.addEventListener('hashchange',()=>activate(viewFromHash(),{scroll:false}));
 activate(viewFromHash(),{scroll:false});
})();
