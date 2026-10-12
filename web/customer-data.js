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
  const setPrimary=document.createElement('button');
  setPrimary.type='button';setPrimary.className='btn ghost';
  const startNew=document.createElement('button');
  startNew.type='button';startNew.className='btn ghost';
  const remember=document.createElement('label');
  const rememberCheckbox=document.createElement('input');
  rememberCheckbox.type='checkbox';rememberCheckbox.id='saveCheckoutAddress';rememberCheckbox.checked=true;
  const rememberText=document.createElement('span');remember.append(rememberCheckbox,rememberText);
  const message=document.createElement('p');
  message.setAttribute('role','status');
  controls.append(title,select,save,remove,message,setPrimary,startNew,remember);
  by('orderForm').querySelector('.service-locality-group').after(controls);
  const history=document.createElement('section');
  history.className='panel previously-purchased';
  history.setAttribute('aria-labelledby','previouslyOrderedHeading');
  by('products').before(history);
  // Account-wide address management, separate from checkout.
  const accountSection=document.createElement('section');
  accountSection.className='customer-account-addresses';
  const accountTitle=document.createElement('h3');
  const accountList=document.createElement('div');
  accountList.className='customer-account-address-list';
  const accountAdd=document.createElement('button');
  accountAdd.type='button';accountAdd.className='btn ghost';
  const accountMessage=document.createElement('p');
  accountMessage.setAttribute('role','status');
  accountSection.append(accountTitle,accountList,accountAdd,accountMessage);
  by('accountProfile').prepend(accountSection);
  const editor=document.createElement('dialog');
  editor.className='customer-address-editor';
  const editorForm=document.createElement('form');editorForm.className='form';
  const editorHeading=document.createElement('h3');
  editorForm.append(editorHeading);
  const editorFields={};
  for(const [key,type] of [['name','text'],['house','text'],['locality','select'],['landmark','text'],['pin','text']]){
    const label=document.createElement('label');
    const input=document.createElement(type==='select'?'select':'input');
    input.name=key;input.required=['name','house','locality'].includes(key);
    if(type!=='select')input.type=type;
    if(key==='pin'){input.maxLength=6;input.inputMode='numeric';}
    editorFields[key]=input;label.append(input);editorForm.append(label);
  }
  const editorPrimaryLabel=document.createElement('label');
  const editorPrimary=document.createElement('input');
  editorPrimary.type='checkbox';
  const editorPrimaryText=document.createElement('span');
  editorPrimaryLabel.append(editorPrimary,editorPrimaryText);
  const editorError=document.createElement('p');
  editorError.setAttribute('role','alert');
  const editorButtons=document.createElement('div');
  editorButtons.className='actions';
  const editorCancel=document.createElement('button');
  editorCancel.type='button';editorCancel.className='btn ghost';
  const editorSave=document.createElement('button');
  editorSave.type='submit';editorSave.className='btn';
  editorButtons.append(editorCancel,editorSave);
  editorForm.append(editorPrimaryLabel,editorError,editorButtons);
  editor.append(editorForm);document.body.append(editor);
  let editingId=null,selectionManual=false,checkoutOpened=false;
  const lng=(en,hi)=>window.EMI18n?.lang==='hi'?hi:en;
  const prettyAddress=a=>[a.house,a.locality,a.landmark,a.pin].filter(Boolean).join(', ');
  function applyAddress(address){
    const form=by('orderForm');
    for(const key of ['name','house','landmark','pin'])form.elements[key].value=address?.[key]||'';
    window.EasyMandiLocalities?.choose(address?.locality||'');
    form.elements.phone.value=window.CustomerAccount?.user?.mobile||'';
    // Previously shared device coordinates do not belong to a different address.
    if(typeof deliveryLocation!=='undefined')deliveryLocation=null;
    by('locationStatus').dataset.locationState='hint';
    by('locationStatus').textContent=t('locationHint');
  }
  function chooseAddress(id,manual=false){
    selected=id;
    selectionManual=manual;
    const address=addresses.find(a=>Number(a.id)===selected);
    applyAddress(address);
    render();
  }
  function openEditor(address=null){
    editingId=address?Number(address.id):null;
    const locality=editorFields.locality;locality.replaceChildren();
    const initial=document.createElement('option');initial.value='';initial.textContent=lng('Select delivery locality','डिलीवरी क्षेत्र चुनें');
    locality.append(initial);
    for(const opt of by('locality').children){
      if(!opt.value)continue;
      const item=document.createElement('option');item.value=opt.value;item.textContent=opt.textContent;
      locality.append(item);
    }
    for(const key of Object.keys(editorFields)){
      if(key==='locality')continue;
      editorFields[key].value=address?.[key]||(key==='name'?window.CustomerAccount?.user?.name||'':'');
    }
    locality.value=address?.locality||'';
    editorPrimary.checked=!!address?.is_primary||!addresses.length;
    editorPrimary.disabled=!!address?.is_primary;
    editorHeading.textContent=address?lng('Edit saved address','सहेजा पता बदलें'):lng('Add a new address','नया पता जोड़ें');
    const captions={name:lng('Recipient name','नाम'),house:lng('House / flat / building','मकान / फ्लैट'),locality:lng('Service locality','डिलीवरी क्षेत्र'),landmark:lng('Landmark (optional)','नज़दीकी पहचान (वैकल्पिक)'),pin:lng('PIN (optional)','पिन (वैकल्पिक)')};
    for(const key of Object.keys(editorFields))editorFields[key].parentElement.firstChild?.remove?.();
    for(const key of Object.keys(editorFields)){editorFields[key].setAttribute('aria-label',captions[key]);editorFields[key].placeholder=captions[key];}
    editorPrimaryText.textContent=lng(' Make primary address',' मुख्य पता बनाएँ');
    editorCancel.textContent=lng('Cancel','रद्द करें');editorSave.textContent=lng('Save address','पता सहेजें');
    editorError.textContent='';
    editor.showModal();
  }
  editorCancel.addEventListener('click',()=>editor.close());
  editorForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!window.CustomerAccount?.authenticated)return;
    const payload={operation:'save',...(editingId?{id:editingId}:{}),setPrimary:editorPrimary.checked};
    for(const key of Object.keys(editorFields))payload[key]=editorFields[key].value.trim();
    payload.phone=window.CustomerAccount.user.mobile;
    if(payload.name.length<2||payload.house.length<2||
      !window.EasyMandiLocalities?.valid(payload.locality)||
      (payload.pin!==''&&!/^[1-9][0-9]{5}$/.test(payload.pin))){
      editorError.textContent=lng('Check the name, house, served locality and optional PIN.','नाम, मकान, डिलीवरी क्षेत्र और पिन की जाँच करें।');
      return;
    }
    editorSave.disabled=true;
    try{
      const result=await window.CustomerAccount.request('customer-data',{method:'POST',authorized:true,payload});
      editor.close();
      accountMessage.textContent=t('savedAddressOk');
      selected=Number(result.id)||null;selectionManual=false;
      await refresh(true);
    }catch(error){editorError.textContent=error.message||t('addressLoadError');}
    finally{editorSave.disabled=false;}
  });
  accountAdd.addEventListener('click',()=>openEditor());
  function renderAccountAddresses(){
    const logged=!!window.CustomerAccount?.user;
    accountSection.hidden=!logged;
    accountTitle.textContent=lng('My saved addresses','मेरे सहेजे पते');
    accountAdd.textContent=lng('+ Add new address','+ नया पता जोड़ें');
    accountList.replaceChildren();
    if(!logged)return;
    if(!addresses.length){
      const empty=document.createElement('p');
      empty.textContent=lng('No address saved yet. Add one to make checkout faster.','अभी कोई पता सहेजा नहीं है। तेज़ चेकआउट के लिए पता जोड़ें।');
      accountList.append(empty);return;
    }
    for(const address of addresses){
      const card=document.createElement('article');card.className='saved-address-card';
      const heading=document.createElement('strong');heading.textContent=address.name||'';
      const details=document.createElement('p');details.textContent=prettyAddress(address);
      card.append(heading,details);
      if(address.is_primary){
        const badge=document.createElement('span');badge.className='primary-address-badge';
        badge.textContent=lng('★ Primary / Default','★ मुख्य पता');card.append(badge);
      }
      const actions=document.createElement('div');actions.className='address-card-actions';
      function action(label,handler){
        const button=document.createElement('button');button.type='button';button.className='btn ghost';
        button.textContent=label;button.addEventListener('click',handler);actions.append(button);
      }
      action(lng('Edit','बदलें'),()=>openEditor(address));
      if(!address.is_primary)action(lng('Set primary','मुख्य बनाएँ'),()=>mutate({operation:'set-primary',id:Number(address.id)},'savedAddressOk'));
      action(lng('Delete','हटाएँ'),()=>{
        if(confirm(t('deleteAddressQuestion')))mutate({operation:'delete',id:Number(address.id)},'deletedAddressOk');
      });
      card.append(actions);accountList.append(card);
    }
  }


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
    setPrimary.textContent=lng('Set as primary','मुख्य पता बनाएँ');
    startNew.textContent=lng('Add new address','नया पता जोड़ें');
    rememberText.textContent=lng(' Save this new address to my account',' यह नया पता मेरे खाते में सहेजें');
    remove.textContent=t('deleteAddress');
    select.replaceChildren();
    const blank=document.createElement('option');
    blank.value='';blank.textContent=t('newAddress');
    select.append(blank);
    for(const address of addresses){
      const option=document.createElement('option');
      option.value=address.id;
      option.textContent=(address.is_primary?'★ '+lng('Primary','मुख्य')+' · ':'')+address.house+', '+address.locality+(address.pin?' · '+address.pin:'');
      select.append(option);
    }
    if(selected!==null&&!addresses.some(a=>Number(a.id)===selected))selected=null;
    select.value=selected===null?'':String(selected);
    remove.hidden=selected===null;
    setPrimary.hidden=selected===null||!!addresses.find(a=>Number(a.id)===selected)?.is_primary;
    startNew.hidden=!addresses.length;
    remember.hidden=selected!==null;
    renderAccountAddresses();
    renderPreviouslyOrdered();
  }

  async function refresh(preferPrimary=false){
    if(preferPrimary){selected=null;selectionManual=false;checkoutOpened=true;}
    const account=window.CustomerAccount?.user;
    const request=++refreshSerial;
    if(!account){
      addresses=[];previousItems=[];selected=null;selectionManual=false;message.textContent='';accountMessage.textContent='';render();return;
    }
    try{
      const result=await window.CustomerAccount.request('customer-data',{authorized:true});
      if(request!==refreshSerial||window.CustomerAccount?.user?.id!==account.id)return;
      addresses=Array.isArray(result.addresses)?result.addresses:[];
      previousItems=Array.isArray(result.items)?result.items:[];
      const primary=addresses.find(a=>a.is_primary)||addresses[0]||null;
      if((checkoutOpened||selected===null||!addresses.some(a=>Number(a.id)===selected))&&!selectionManual){
        selected=primary?Number(primary.id):null;
        if(primary)applyAddress(primary);
      }else if(checkoutOpened&&selectionManual){
        // Explicit one-order choice stays selected, even when refreshed.
        if(selected!==null)applyAddress(addresses.find(a=>Number(a.id)===selected));
      }
      checkoutOpened=false;
      render();
    }catch(error){
      if(request===refreshSerial&&window.CustomerAccount?.user?.id===account.id){
        message.textContent=error.message||t('addressLoadError');
      }
    }
  }

  select.addEventListener('change',()=>{
    chooseAddress(select.value?Number(select.value):null,true);
  });
  startNew.addEventListener('click',()=>chooseAddress(null,true));
  setPrimary.addEventListener('click',()=>{
    if(selected!==null)mutate({operation:'set-primary',id:selected},'savedAddressOk');
  });

  async function mutate(payload,successKey){
    save.disabled=remove.disabled=setPrimary.disabled=true;
    message.textContent='';
    try{
      await window.CustomerAccount.request('customer-data',{method:'POST',authorized:true,payload});
      message.textContent=t(successKey);accountMessage.textContent=t(successKey);
      if(payload.operation==='delete')selected=null;
      selectionManual=false;
      await refresh(true);
    }catch(error){
      message.textContent=error.message||t('addressLoadError');
    }finally{
      save.disabled=remove.disabled=setPrimary.disabled=false;
    }
  }
  save.addEventListener('click',()=>{
    const form=by('orderForm');
    const payload={operation:'save',...(selected!==null?{id:selected}:{})};
    for(const key of ['name','house','locality','landmark','pin'])payload[key]=form.elements[key].value.trim();
    payload.phone=window.CustomerAccount?.user?.mobile||form.elements.phone.value.trim();
    if(!window.EasyMandiLocalities?.valid(payload.locality)){
      message.textContent='Choose a currently served Varanasi locality before saving this address.';
      return;
    }
    mutate(payload,'savedAddressOk');
  });
  remove.addEventListener('click',()=>{
    if(selected!==null&&confirm(t('deleteAddressQuestion')))
      mutate({operation:'delete',id:selected},'deletedAddressOk');
  });

  window.EasyMandiCustomerData={
    saveCheckoutAddress:async address=>{
      if(selected!==null||!rememberCheckbox.checked)return;
      const response=await window.CustomerAccount.request('customer-data',{
        method:'POST',authorized:true,payload:{operation:'save',...address,phone:window.CustomerAccount.user.mobile}
      });
      selected=Number(response.id)||null;
      selectionManual=false;await refresh();
    }
  };
  window.addEventListener('customer-account-changed',()=>{selected=null;selectionManual=false;refresh();});
  window.addEventListener('customer-order-placed',refresh);
  window.addEventListener('languagechange',render);
  window.addEventListener('easy-mandi-catalog-rendered',renderPreviouslyOrdered);
  by('basketButton').addEventListener('click',()=>refresh(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden&&window.CustomerAccount?.user)refresh();},120000);
  refresh();
})();
