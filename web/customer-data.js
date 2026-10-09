/* Customer addresses and recently ordered items. Live refresh without reloading the website. */
(() => {
  'use strict';
  const by=id=>document.getElementById(id);
  const t=(key,vars={})=>window.EMI18n?.t(key,vars)||key;
  const labelFor=p=>window.EMI18n?.lang==='hi'?(p.hindi||p.name):p.name;
  let addresses=[],previousItems=[],selected=null,refreshSerial=0;
  const controls=document.createElement('section');
  controls.className='customer-address-book';
  const title=document.createElement('h3');
  const select=document.createElement('select');
  const save=document.createElement('button');
  save.type='button';save.className='btn ghost';
  const remove=document.createElement('button');
  remove.type='button';remove.className='btn ghost';
  const message=document.createElement('p');
  message.setAttribute('role','status');
  controls.append(title,select,save,remove,message);
  by('orderForm').prepend(controls);
  const history=document.createElement('section');
  history.className='panel previously-purchased';
  history.setAttribute('aria-labelledby','previouslyOrderedHeading');
  by('products').before(history);

  function renderPreviouslyOrdered(){
    const signedIn=!!window.CustomerAccount?.user;
    history.hidden=!signedIn;
    history.replaceChildren();
    if(!signedIn)return;
    const heading=document.createElement('h2');
    heading.id='previouslyOrderedHeading';
    heading.textContent=t('previouslyOrdered');
    history.append(heading);
    if(!previousItems.length){
      const empty=document.createElement('p');
      empty.textContent=t('noPrevious');
      history.append(empty);
      return;
    }
    const catalog=window.EasyMandiCatalog;
    if(!catalog?.ready()){
      const loading=document.createElement('p');
      loading.textContent=t('loading');
      history.append(loading);
      return;
    }
    const grid=document.createElement('div');
    grid.className='grid previously-purchased-grid';
    const seen=new Set();
    for(const item of previousItems){
      const id=String(item.product_id??'');
      if(!id||seen.has(id))continue;
      seen.add(id);
      const current=catalog.getProduct(id);
      if(current){
        // Identical live catalog card: image, both names, unit, current price
        // and +/- controls connected to the same basket as the shop grid.
        grid.append(catalog.createCard(current));
      }else{
        // Keep historical purchases visible even when a product is deleted
        // from the current catalog. Never allow adding an unavailable item.
        const card=document.createElement('article');
        card.className='card previous-product-unavailable';
        const art=document.createElement('div');
        art.className='illustration';
        art.textContent='🛒';
        art.setAttribute('aria-hidden','true');
        const name=document.createElement('h3');
        name.textContent=item.name||t('unavailable');
        const unit=document.createElement('small');
        unit.textContent=item.unit||'';
        const row=document.createElement('div');
        row.className='row';
        const unavailable=document.createElement('span');
        unavailable.className='previous-product-status';
        unavailable.textContent=t('unavailable');
        row.append(unavailable);
        card.append(art,name,unit,row);
        grid.append(card);
      }
    }
    history.append(grid);
  }

  function render(){
    const signedIn=!!window.CustomerAccount?.user;
    controls.hidden=!signedIn;
    history.hidden=!signedIn;
    title.textContent=t('savedAddresses');
    select.setAttribute('aria-label',t('chooseAddress'));
    save.textContent=t('saveAddress');
    remove.textContent=t('deleteAddress');
    select.replaceChildren();
    const blank=document.createElement('option');
    blank.value='';blank.textContent=t('newAddress');
    select.append(blank);
    for(const address of addresses){
      const option=document.createElement('option');
      option.value=address.id;
      option.textContent=address.house+', '+address.locality+' · '+address.pin;
      select.append(option);
    }
    if(selected!==null&&!addresses.some(a=>Number(a.id)===selected))selected=null;
    select.value=selected===null?'':String(selected);
    remove.hidden=selected===null;

    renderPreviouslyOrdered();
  }

  async function refresh(){
    const account=window.CustomerAccount?.user;
    const request=++refreshSerial;
    if(!account){
      addresses=[];previousItems=[];selected=null;message.textContent='';render();return;
    }
    try{
      const result=await window.CustomerAccount.request('customer-data',{authorized:true});
      if(request!==refreshSerial||window.CustomerAccount?.user?.id!==account.id)return;
      addresses=Array.isArray(result.addresses)?result.addresses:[];
      previousItems=Array.isArray(result.items)?result.items:[];
      render();
    }catch(error){
      if(request===refreshSerial&&window.CustomerAccount?.user?.id===account.id){
        message.textContent=error.message||t('addressLoadError');
      }
    }
  }

  select.addEventListener('change',()=>{
    selected=select.value?Number(select.value):null;
    remove.hidden=selected===null;
    const address=addresses.find(a=>Number(a.id)===selected);
    if(!address)return;
    const form=by('orderForm');
    for(const key of ['name','house','locality','landmark','pin'])form.elements[key].value=address[key]||'';
    form.elements.phone.value=address.phone||'';
    deliveryLocation=null;
    by('locationStatus').dataset.locationState='hint';
    by('locationStatus').textContent=t('locationHint');
  });

  async function mutate(payload,successKey){
    save.disabled=remove.disabled=true;
    message.textContent='';
    try{
      await window.CustomerAccount.request('customer-data',{method:'POST',authorized:true,payload});
      message.textContent=t(successKey);
      if(payload.operation==='delete')selected=null;
      await refresh();
    }catch(error){
      message.textContent=error.message||t('addressLoadError');
    }finally{
      save.disabled=remove.disabled=false;
    }
  }
  save.addEventListener('click',()=>{
    const form=by('orderForm');
    const payload={operation:'save',...(selected!==null?{id:selected}:{})};
    for(const key of ['name','house','locality','landmark','pin'])payload[key]=form.elements[key].value.trim();
    payload.phone=form.elements.phone.value.trim();
    mutate(payload,'savedAddressOk');
  });
  remove.addEventListener('click',()=>{
    if(selected!==null&&confirm(t('deleteAddressQuestion')))
      mutate({operation:'delete',id:selected},'deletedAddressOk');
  });

  window.addEventListener('customer-account-changed',refresh);
  window.addEventListener('customer-order-placed',refresh);
  window.addEventListener('languagechange',render);
  window.addEventListener('easy-mandi-catalog-rendered',renderPreviouslyOrdered);
  by('basketButton').addEventListener('click',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden&&window.CustomerAccount?.user)refresh();},120000);
  refresh();
})();
