/* Easy Mandi customer sections: persistent on-device view selection.
   Never persists customer data, authentication tokens or handoff codes. */
(()=>{
  'use strict';
  const key='easy-mandi-last-customer-section-v1';
  const valid=new Set(['catalog','previous','orders','deliveries']);
  const byId=id=>document.getElementById(id);
  const nav=byId('customerSectionNav');
  if(!nav)return;
  let current='catalog';
  const fromFragment=()=>{
    let fragment;
    try{fragment=decodeURIComponent(location.hash.slice(1));}catch{return null;}
    if(valid.has(fragment))return fragment;
    return ({shopCatalog:'catalog',myOrdersPanel:'orders',deliveryPanel:'deliveries',previousProductsMount:'previous'})[fragment]||null;
  };
  const stored=()=>{
    try{const id=localStorage.getItem(key);return valid.has(id)?id:null;}catch{return null;}
  };
  function syncAccount(){
    const signedIn=!!window.CustomerAccount?.user;
    for(const section of ['previous','orders','deliveries']){
      const gate=byId(section+'SignInGate');
      if(gate)gate.hidden=signedIn;
    }
  }
  function positionNav(){
    const header=document.querySelector('body > header');
    if(header)document.documentElement.style.setProperty('--customer-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  }
  function select(id,{remember=true,updateUrl=false,scroll=false}={}){
    if(!valid.has(id))return false;
    current=id;
    document.querySelectorAll('[data-customer-section]').forEach(section=>{
      section.hidden=section.dataset.customerSection!==id;
    });
    nav.querySelectorAll('[data-customer-tab]').forEach(link=>{
      if(link.dataset.customerTab===id)link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.body.dataset.customerSection=id;
    syncAccount();
    if(remember){try{localStorage.setItem(key,id);}catch{}}
    if(updateUrl){
      const next='#'+id;
      if(location.hash!==next)history.pushState(null,'',location.pathname+location.search+next);
    }
    if(scroll){
      positionNav();
      window.scrollTo({top:0,behavior:'auto'});
    }
    return true;
  }
  window.EasyMandiSections=Object.freeze({
    select:id=>select(id,{remember:true,updateUrl:true,scroll:true}),
    get current(){return current;}
  });
  nav.addEventListener('click',event=>{
    const link=event.target.closest('a[data-customer-tab],a[data-customer-action]');
    if(!link||!nav.contains(link)||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    if(link.dataset.customerTab){
      select(link.dataset.customerTab,{remember:true,updateUrl:true,scroll:true});
      return;
    }
    if(link.dataset.customerAction==='basket')byId('basketButton')?.click();
    if(link.dataset.customerAction==='account')byId('accountButton')?.click();
  });
  for(const section of ['previous','orders','deliveries']){
    byId(section+'SignIn')?.addEventListener('click',()=>byId('accountButton')?.click());
  }
  window.addEventListener('customer-account-changed',syncAccount);
  window.addEventListener('pageshow',()=>{positionNav();syncAccount();});
  window.addEventListener('resize',positionNav);
  window.addEventListener('popstate',()=>select(fromFragment()||stored()||'catalog',{remember:true}));
  window.addEventListener('hashchange',()=>select(fromFragment()||stored()||'catalog',{remember:true}));
  positionNav();
  select(fromFragment()||stored()||'catalog',{remember:true});
})();
