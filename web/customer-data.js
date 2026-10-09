/* Customer addresses and recently ordered items. Live refresh without reloading the website. */
(() => {
  'use strict';
  const by=id=>document.getElementById(id);
  const t=(key,vars={})=>window.EMI18n?.t(key,vars)||key;
  const labelFor=p=>window.EMI18n?.lang==='hi'?(p.hindi||p.name):p.name;
  let addresses=[],previousItems=[],selected=null,refreshSerial=0,seenAccountId=null,previousLoading=false,previousError='';
  const guestAddressesKey='easy-mandi-guest-addresses-v1',guestRecentKey='easy-mandi-guest-recent-v1';
  const guestRead=(key)=>{try{const rows=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(rows)?rows:[];}catch{return [];}};
  const guestWrite=(key,rows)=>{try{localStorage.setItem(key,JSON.stringify(rows));}catch{}};
  const guestRecent=()=>guestRead(guestRecentKey).slice(0,20);
  const signedIn=()=>!!window.CustomerAccount?.user;
  let lastUserId=null;
  function guestAddressSave(payload){
    const rows=guestRead(guestAddressesKey);
    const record={...payload,id:payload.id??Date.now()};
    const existing=rows.findIndex(row=>String(row.id)===String(record.id));
    if(existing>=0)rows[existing]=record;else rows.unshift(record);
    guestWrite(guestAddressesKey,rows.slice(0,30));selected=Number(record.id);
  }
  function guestRecordOrder(items){
    const rows=guestRecent();
    const ordered=[...items].reverse().map(item=>({
      product_id:String(item.product_id),name:item.name||'',unit:item.unit||'',last_ordered:new Date().toISOString()
    }));
    const dedup=new Map();
    for(const item of [...ordered,...rows]){
      if(item.product_id&&!dedup.has(item.product_id))dedup.set(item.product_id,item);
    }
    guestWrite(guestRecentKey,[...dedup.values()].slice(0,20));
  }
  async function fallbackPreviousItems(){
    const found=new Map();
    for(let page=1;page<=5;page++){
      const result=await window.CustomerAccount.request('my-orders?page='+page,{authorized:true});
      for(const order of result.orders||[]){
        if(String(order.status||'').toLowerCase()==='cancelled')continue;
        for(const line of order.items||[]){
          const id=String(line.product_id||''),name=String(line.product_name||'');
          if(id&&name&&!found.has(id))found.set(id,{product_id:id,name,unit:line.unit||''});
          if(found.size>=20)break;
        }
      }
      if(found.size>=20||!result.hasMore)break;
    }
    return [...found.values()];
  }

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
  history.setAttribute('aria-label','Previously purchased product cards');
  by('previousProductsMount').append(history);

  function renderPreviouslyOrdered(){
    const personal=!!window.CustomerAccount?.user;
    history.hidden=!personal&&!previousItems.length;
    by('recentSection').hidden=history.hidden;
    history.replaceChildren();
    if(!personal&&!previousItems.length)return;
    if(previousError){
      const error=document.createElement('p');
      error.className='status';
      error.setAttribute('role','alert');
      error.textContent=previousError;
      history.append(error);
    }
    if(!previousItems.length){
      const empty=document.createElement('p');
      empty.textContent=previousLoading?t('loading'):t('noPrevious');
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
        grid.append(catalog.createCard(current,{context:'previous'}));
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
    const personal=!!window.CustomerAccount?.user;
    controls.hidden=false;
    history.hidden=!personal&&!previousItems.length;
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
    const id=account?.id==null?null:String(account.id);
    if(id!==seenAccountId){
      seenAccountId=id;
      addresses=[];previousItems=[];selected=null;previousError='';
      window.EasyMandiCatalog?.setPreviousIds([]);
    }
    if(!account){
      addresses=guestRead(guestAddressesKey);
      previousItems=guestRecent();
      previousLoading=false;
      message.textContent='';
      window.EasyMandiCatalog?.setPreviousIds(previousItems.map(item=>item.product_id));
      render();
      window.dispatchEvent(new Event('customer-recent-items-updated'));
      return;
    }
    previousLoading=true;
    previousError='';
    renderPreviouslyOrdered();
    try{
      const result=await window.CustomerAccount.request('customer-data',{authorized:true});
      if(request!==refreshSerial||window.CustomerAccount?.user?.id!==account.id)return;
      addresses=Array.isArray(result.addresses)?result.addresses:[];
      previousItems=Array.isArray(result.items)?result.items:[];
      if(!previousItems.length)previousItems=await fallbackPreviousItems();
      if(request!==refreshSerial||window.CustomerAccount?.user?.id!==account.id)return;
      previousLoading=false;
      window.EasyMandiCatalog?.setPreviousIds(previousItems.map(item=>item.product_id));
      render();
    }catch(error){
      if(request===refreshSerial&&window.CustomerAccount?.user?.id===account.id){
        try{
          previousItems=await fallbackPreviousItems();
          if(request!==refreshSerial||window.CustomerAccount?.user?.id!==account.id)return;
          window.EasyMandiCatalog?.setPreviousIds(previousItems.map(item=>item.product_id));
          previousError='';
        }catch(other){previousError=other.message||error.message||t('addressLoadError');}
        previousLoading=false;
        message.textContent=previousError||t('addressLoadError');
        renderPreviouslyOrdered();
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
      if(signedIn()){
        await window.CustomerAccount.request('customer-data',{method:'POST',authorized:true,payload});
      }else if(payload.operation==='delete'){
        guestWrite(guestAddressesKey,guestRead(guestAddressesKey).filter(row=>String(row.id)!==String(payload.id)));
      }else guestAddressSave(payload);
      message.textContent=t(successKey);
      if(payload.operation==='delete')selected=null;
      await refresh();
    }catch(error){
      message.textContent=error.message||t('addressLoadError');
    }finally{
      save.disabled=remove.disabled=false;
    }
  }
  window.EasyMandiCustomerData=Object.freeze({
    // The section coordinator calls this every time the catalogue is opened.
    refresh:()=>{renderPreviouslyOrdered();return refresh();},
    saveCheckoutAddress:async fields=>{
      const payload={operation:'save',...(selected!==null?{id:selected}:{})};
      for(const field of ['name','house','locality','landmark','pin'])payload[field]=String(fields[field]||'').trim();
      payload.phone=String(fields.phone||'').trim();
      if(signedIn())await window.CustomerAccount.request('customer-data',{method:'POST',authorized:true,payload});
      else guestAddressSave(payload);
      await refresh();
    }
  });
  by('refreshRecent')?.addEventListener('click',refresh);
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
  // Section coordinator now calls EasyMandiCustomerData.refresh directly.
  window.addEventListener('customer-order-placed',event=>{
    if(!signedIn()&&Array.isArray(event.detail?.items)){
      guestRecordOrder(event.detail.items);
    }
    refresh();
  });
  window.addEventListener('languagechange',render);
  window.addEventListener('easy-mandi-catalog-rendered',renderPreviouslyOrdered);
  by('basketButton').addEventListener('click',refresh);


  setInterval(()=>{if(!document.hidden&&window.CustomerAccount?.user)refresh();},120000);
  refresh();
})();
