/* Easy Mandi V3: session-scoped inline delivery notice; checkout policy is independent. */
(()=>{
  'use strict';
  const notice=document.getElementById('compactDeliveryPolicy');
  const toggle=document.getElementById('deliveryPolicyToggle');
  const dismiss=document.getElementById('deliveryPolicyDismiss');
  const label=document.getElementById('deliveryPolicyToggleText');
  const arrow=document.getElementById('deliveryPolicyChevron');
  if(!notice||!toggle||!dismiss||!label||!arrow)return;
  const key='easy-mandi-delivery-notice-v3';
  const read=()=>{try{return sessionStorage.getItem(key)}catch(_){return null}};
  const save=state=>{try{sessionStorage.setItem(key,state)}catch(_){/* Storage optional */}};
  const translate=(id,fallback)=>window.EMI18n?.t(id)||fallback;
  let state=['expanded','compact','dismissed'].includes(read())?read():'expanded';
  function render(){
    notice.hidden=state==='dismissed';
    notice.dataset.state=state;
    toggle.setAttribute('aria-expanded',String(state==='expanded'));
    label.textContent=state==='expanded'?translate('deliveryPolicyMinimize','Minimise'):translate('deliveryPolicyExpand','Expand');
    toggle.setAttribute('aria-label',state==='expanded'
      ?translate('deliveryPolicyMinimize','Minimise delivery notice')
      :translate('deliveryPolicyExpand','Expand delivery notice'));
    arrow.textContent=state==='expanded'?'⌃':'⌄';
  }
  function set(next){
    if(!['expanded','compact','dismissed'].includes(next))return;
    state=next;save(next);render();
  }
  toggle.addEventListener('click',()=>set(state==='expanded'?'compact':'expanded'));
  dismiss.addEventListener('click',()=>set('dismissed'));
  const collapseForShopping=()=>{if(state==='expanded')set('compact');};
  for(const selector of ['.hero-shop-link','#marketButton']){
    document.querySelector(selector)?.addEventListener('click',collapseForShopping);
  }
  const catalog=document.getElementById('shopCatalog');
  let lastScrollY=window.scrollY||0;
  window.addEventListener('scroll',()=>{
    const y=window.scrollY||0;
    if(y>lastScrollY+1&&catalog&&catalog.getBoundingClientRect().top<=(window.innerHeight||700)*0.8){
      collapseForShopping();
    }
    lastScrollY=y;
  },{passive:true});
  window.addEventListener('languagechange',render);
  render();
  window.EasyMandiCompactDelivery={
    get state(){return state;},
    compact:collapseForShopping,
  };
})();
