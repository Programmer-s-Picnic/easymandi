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
     ?[['Catalog API',window.EasyMandiCatalog?.refresh],['Previous purchases',window.EasyMandiCustomerData?.refresh]]
     :id==='orders'?[['Orders API',window.EasyMandiOrders?.refresh]]
     :[['Deliveries API',window.EasyMandiDeliveries?.refresh]];
   for(const [label,task] of calls){
     if(typeof task!=='function'){
       window.EasyMandiTestAlerts?.report(id,'CONTROLLER MISSING',label,{popup:true});
       continue;
     }
     window.EasyMandiTestAlerts?.report(id,'REFRESH CALLED',label);
     try{
       Promise.resolve(task()).catch(error=>{
         window.EasyMandiTestAlerts?.report(id,'UNHANDLED ERROR',label+' '+(error?.message||'Request failed'),{popup:true});
       });
     }catch(error){
       window.EasyMandiTestAlerts?.report(id,'SYNC ERROR',label+' '+(error?.message||'Request failed'),{popup:true});
     }
   }
 };
 function activate(id,{push=false,scroll=true}={}){
   if(!valid.has(id))return false;
   if(id!=='catalog'&&!window.CustomerAccount?.user){
     afterSignIn=id;
     closeMenu();
     window.EasyMandiTestAlerts?.report(id,'SIGN IN REQUIRED',
       window.CustomerAccount?.restoring?'Waiting for saved login':'Customer not signed in',{popup:true});
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
   window.EasyMandiTestAlerts?.begin(id,
     'Reopened: '+(reopened?'yes':'no')+' · Signed in: '+(window.CustomerAccount?.user?'yes':'no'));
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
 let lastReturnRefresh=0;
 const onReturn=()=>{
   if(document.hidden)return;
   // Mobile browsers often emit focus and visibilitychange together.
   const now=Date.now();
   if(now-lastReturnRefresh<1000)return;
   lastReturnRefresh=now;
   refreshCurrent(current);
 };
 window.addEventListener('focus',onReturn);
 document.addEventListener('visibilitychange',onReturn);
 window.addEventListener('popstate',()=>activate(viewFromHash(),{scroll:false}));
 window.addEventListener('hashchange',()=>activate(viewFromHash(),{scroll:false}));
 activate(viewFromHash(),{scroll:false});
})();
