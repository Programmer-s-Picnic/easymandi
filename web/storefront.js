const source='https://cserver.learnwithchampak.live/easymandi/api/catalog.php';
let data=null,category='All',cart={
};
try{
  cart=JSON.parse(localStorage.getItem('easy-mandi-cart')||'{}')
}catch{
}const el=id=>document.getElementById(id),money=n=>'₹'+n,save=()=>localStorage.setItem('easy-mandi-cart',JSON.stringify(cart));
const t=(key,vars={})=>window.EMI18n?.t(key,vars)||key;
const productLabel=p=>window.EMI18n?.lang==='hi'?(p.hindi||p.name):p.name;
let popularIds=[];
const favoriteKey='easy-mandi-favorites';
let favoriteIds=new Set();
try{favoriteIds=new Set(JSON.parse(localStorage.getItem(favoriteKey)||'[]').map(String));}catch{}
let favoritesOnly=false;
function toggleFavorite(id){
  const key=String(id);
  if(favoriteIds.has(key))favoriteIds.delete(key);else favoriteIds.add(key);
  try{localStorage.setItem(favoriteKey,JSON.stringify([...favoriteIds]));}catch{}
  render();
}
function productPhoto(p){
  const raw=p?.imageUrl||p?.image||'';
  if(typeof raw!=='string')return '';
  try{const url=new URL(raw);return url.protocol==='https:'&&url.hostname?raw:'';}catch{return '';}
}
function compareAt(p){
  const amount=Number(p?.compareAtPrice),price=Number(p?.price);
  return Number.isFinite(amount)&&amount>price&&amount<=1000000?amount:null;
}
function showArtwork(parent,p){
  parent.replaceChildren();
  const fallback=document.createElement('span');fallback.textContent=p.emoji||'🥬';fallback.className='emoji-art';
  const src=productPhoto(p);
  if(src){
    const photo=document.createElement('img');
    photo.src=src;photo.alt='';photo.loading='lazy';photo.decoding='async';photo.className='product-photo';
    photo.onerror=()=>photo.replaceWith(fallback);
    parent.append(photo);
  }else parent.append(fallback);
}
function deliveryProgress(){
  const target=el('deliveryProgress');
  if(!target||!data)return;
  const above=Number(data.store?.freeDeliveryAbove||499);
  const subtotal=totals().subtotal;
  const missing=Math.max(0,above-subtotal);
  target.textContent=missing===0?t('deliveryUnlocked'):
    subtotal===0?t('deliveryAbove',{amount:money(above)}):t('deliveryRemaining',{amount:money(missing)});
  const track=el('deliveryProgressFill');if(track)track.style.width=(above>0?Math.min(100,subtotal/above*100):100)+'%';
}

let previouslyBoughtIds=new Set();
async function loadPopularity(){
  try{
    const response=await AppHttp.fetch('https://cserver.learnwithchampak.live/easymandi/api/popular-products.php',{cache:'no-store'});
    if(!response.ok)return;
    const result=await response.json();
    popularIds=Array.isArray(result.products)?result.products.map(x=>String(x.id)):[];
    if(data)render();
  }catch(_){/* Catalog remains usable without sales statistics. */}
}
let catalogLoading=false;
let confirmationLanguageRefresh=null;
function showLocationStatus(state){
  const names={hint:'locationHint',unavailable:'locationUnavailable',finding:'locationFinding',attached:'locationAttached',denied:'locationDenied'};
  const element=el('locationStatus');
  element.dataset.locationState=state;
  element.textContent=t(names[state]||names.hint,{coords:deliveryLocation?deliveryLocation.locationLat.toFixed(5)+', '+deliveryLocation.locationLng.toFixed(5):''});
}
async function load(silent=false){
  if(catalogLoading)return;
  catalogLoading=true;
  if(!silent)el('status').textContent=t('loading');
  try{
    let response=await AppHttp.fetch(source+'?t='+Date.now(),{cache:'no-store'});
    if(!response.ok)response=await AppHttp.fetch('https://raw.githubusercontent.com/Programmer-s-Picnic/easymandidata/main/catalog/products.json?t='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('catalog unavailable');
    const next=await response.json();
    if(!Array.isArray(next.products)||!next.store)throw Error('invalid catalog');
    data=next;
    localStorage.setItem('easy-mandi-catalog',JSON.stringify(data));
    el('status').textContent='';
  }catch(error){
    if(!data){
      try{data=JSON.parse(localStorage.getItem('easy-mandi-catalog'))}catch{}
    }
    if(!silent)el('status').textContent=data?t('offlineCatalog'):t('catalogError');
  }finally{
    catalogLoading=false;
  }
  if(data){
    render();
    if(el('basket').open)renderBasket();
    if(el('itemDetail').open)renderItemDetail();
  }
}
function change(id,delta){
  cart[id]=Math.max(0,Math.min(99,(cart[id]||0)+delta));
  if(!cart[id])delete cart[id];
  save();
  render();
  if(el('basket').open)renderBasket()
}
function totals(){
  let subtotal=data.products.reduce((s,p)=>s+(p.available?p.price*(cart[p.id]||0):0),0);
  let fee=subtotal===0||subtotal>=data.store.freeDeliveryAbove?0:data.store.deliveryFee;
  return{
    subtotal,fee,total:subtotal+fee
  }
}

/* One product-card renderer for the live catalog and previously ordered items.
   Reusing the same component keeps prices, language and cart controls in sync. */
function createProductCard(p,{context='catalog'}={}){
  const card=document.createElement('article');
  card.className='card'+(context==='previous'?' previously-ordered-card':'');
  card.dataset.productId=String(p.id);
  const art=document.createElement('div');
  art.className='illustration';
  showArtwork(art,p);
  art.setAttribute('aria-hidden','true');
  const previouslyBought=previouslyBoughtIds.has(String(p.id));
  if(context==='previous'||previouslyBought){
    const badge=document.createElement('span');
    badge.className='previous-purchase-badge'+(context==='previous'?' repeat-purchase':'');
    badge.textContent=context==='previous'?t('buyAgainLabel'):t('purchasedBefore');
    art.append(badge);
  }
  const favorite=document.createElement('button');
  favorite.className='favorite-button'+(favoriteIds.has(String(p.id))?' is-favorite':'');
  favorite.type='button';
  favorite.textContent=favoriteIds.has(String(p.id))?'♥':'♡';
  favorite.setAttribute('aria-label',t(favoriteIds.has(String(p.id))?'removeFavorite':'addFavorite')+' '+productLabel(p));
  favorite.onclick=()=>toggleFavorite(p.id);
  art.append(favorite);
  art.classList.toggle('product-unavailable',!p.available);
  const title=document.createElement('h3');
  title.textContent=productLabel(p);
  title.className='product-name-link';
  title.tabIndex=0;
  title.setAttribute('role','button');
  title.setAttribute('aria-label',t('viewFull',{name:productLabel(p)}));
  title.onclick=()=>showItemDetail(p);
  title.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showItemDetail(p);}};
  const unit=document.createElement('small');
  unit.textContent=(window.EMI18n?.lang==='hi'?p.name:(p.hindi||p.name))+' · '+p.unit;
  const row=document.createElement('div');
  row.className='row';
  const price=document.createElement('span');
  price.className='price';
  price.textContent=money(p.price);
  const strike=compareAt(p);
  if(strike){
    const compare=document.createElement('del');compare.className='compare-price';compare.textContent=money(strike);
    const saving=document.createElement('small');saving.className='product-savings';saving.textContent=t('saveAmount',{amount:money(strike-Number(p.price))});
    price.append(compare,saving);
  }
  const step=document.createElement('span');
  step.className='step';
  if(!p.available){
    step.textContent=t('soldOut');
  }else if(!cart[p.id]){
    const add=document.createElement('button');
    add.type='button';
    add.textContent='+';
    add.setAttribute('aria-label',t('add')+' '+productLabel(p));
    add.onclick=()=>change(p.id,1);
    step.append(add);
  }else{
    for(const [label,delta] of [['−',-1],['+',1]]){
      const button=document.createElement('button');
      button.type='button';
      button.textContent=label;
      button.setAttribute('aria-label',t(delta>0?'add':'removeOne')+' '+productLabel(p));
      button.onclick=()=>change(p.id,delta);
      button.disabled=delta>0&&cart[p.id]>=99;
      if(delta>0)step.append(String(cart[p.id]));
      step.append(button);
    }
  }
  row.append(price,step);
  card.append(art,title,unit,row);
  return card;
}
window.EasyMandiCatalog=Object.freeze({
  ready:()=>!!data,
  getProduct:id=>data?.products.find(p=>String(p.id)===String(id))||null,
  createCard:createProductCard,
  setPreviousIds:ids=>{
    previouslyBoughtIds=new Set((Array.isArray(ids)?ids:[]).map(String));
    if(data)render();
  }
});
function render(){
  if(!data)return;
  const valid=new Set(data.products.filter(p=>p.available).map(p=>p.id));
  Object.keys(cart).forEach(id=>{
    if(!valid.has(id))delete cart[id]
  });
  save();
  el('filters').innerHTML='';
  data.categories.forEach(c=>{
    let b=document.createElement('button');
    b.textContent=c==='All'?t('all'):c;
    b.className=c===category?'active':'';
    b.onclick=()=>{
      category=c;
      render()
    };
    el('filters').append(b)
  });
  const q=el('search').value.toLocaleLowerCase();
  let list=data.products.filter(p=>(category==='All'||p.category===category)&&(!favoritesOnly||favoriteIds.has(String(p.id)))&&(p.name+' '+p.hindi+' '+p.category).toLocaleLowerCase().includes(q));
  if(category==='All'&&!q&&popularIds.length){
    const ranks=new Map(popularIds.map((id,index)=>[id,index]));
    list=[...list].sort((a,b)=>(ranks.get(String(a.id))??999)-(ranks.get(String(b.id))??999));
  }
  el('count').textContent=t('productsCount',{count:list.length});
  const favoritesButton=el('favoritesFilter');
  if(favoritesButton){
    favoritesButton.textContent=favoritesOnly?t('showAllProducts'):t('showFavorites');
    favoritesButton.setAttribute('aria-pressed',String(favoritesOnly));
  }
  el('products').innerHTML='';
  for(const p of list)el('products').append(createProductCard(p));
  if(!list.length)el('products').textContent=t('noProducts');
  el('basketButton').textContent=t('basket')+' · '+Object.values(cart).reduce((a,b)=>a+b,0);
  deliveryProgress();
  window.dispatchEvent(new Event('easy-mandi-catalog-rendered'));
}
function renderBasket(){
  const chosen=data.products.filter(p=>p.available&&cart[p.id]);
  el('items').innerHTML='';
  for(const p of chosen){
    const row=document.createElement('div');
    row.className='basket-line';
    const name=document.createElement('button');
    name.type='button';
    name.className='basket-name';
    name.textContent=p.emoji+' '+productLabel(p)+' · '+p.unit+' · '+t('viewDetails');
    name.setAttribute('aria-label',t('viewFull',{name:productLabel(p)}));
    name.onclick=()=>showItemDetail(p);
    const count=document.createElement('span');
    count.textContent='× '+cart[p.id];
    const price=document.createElement('strong');
    price.textContent=money(p.price*cart[p.id]);
    const remove=document.createElement('button');
    remove.type='button';
    remove.className='btn ghost';
    remove.textContent=t('remove');
    remove.setAttribute('aria-label',t('removeFromBasket',{name:productLabel(p)}));
    remove.onclick=()=>change(p.id,-cart[p.id]);
    row.append(name,count,price,remove);
    el('items').append(row)
  }if(!chosen.length)el('items').textContent=t('emptyBasket');
  const totalsValue=totals();
  el('totals').innerHTML='<div class="total">'+t('subtotal')+' <span>'+money(totalsValue.subtotal)+'</span></div><div class="total">'+t('delivery')+' <span>'+(totalsValue.fee?money(totalsValue.fee):t('free'))+'</span></div><div class="total"><strong>'+t('estimatedTotal')+'</strong><strong>'+money(totalsValue.total)+'</strong></div>';
  el('deliveryNote').textContent=t('deliveryNote',{free:money(data.store.freeDeliveryAbove),minimum:money(data.store.minimumOrder)});
  el('countryCode').textContent=data.checkout?.countryCode||'+91';
  el('addressExample').textContent=data.checkout?.addressExample||'House 12, Lanka, Varanasi, Uttar Pradesh 221005';
  el('deliveryCity').textContent=(data.store.city||'Varanasi')+', '+(data.checkout?.state||'Uttar Pradesh');
  el('mobile').placeholder=data.checkout?.mobileExample||'9876543210';
  el('pin').placeholder=data.checkout?.pinExample||'221005';
  el('orderForm').hidden=!chosen.length;
  el('send').disabled=!chosen.length
}
let deliveryLocation=null, detailProductId=null;
function showItemDetail(product){
  detailProductId=product.id;
  renderItemDetail();
  el('itemDetail').showModal()
}
function renderItemDetail(){
  const p=data?.products.find(item=>item.id===detailProductId),quantity=cart[detailProductId]||0;
  if(!p){
    if(el('itemDetail').open)el('itemDetail').close();
    detailProductId=null;
    return
  }el('detailTitle').textContent=productLabel(p);
  showArtwork(el('detailArt'),p);
  el('detailHindi').textContent=window.EMI18n?.lang==='hi'?p.name:(p.hindi||'');
  el('detailPrice').textContent=money(p.price)+' / '+p.unit;
  el('detailDescription').textContent=p.description||'';
  el('detailQuantity').textContent=quantity;
  el('detailTotal').textContent=t('itemTotal',{amount:money(p.price*quantity)});
  el('detailMinus').setAttribute('aria-label',t('removeOne')+' '+productLabel(p));
  el('detailPlus').setAttribute('aria-label',t('add')+' '+productLabel(p));
  el('detailMinus').disabled=quantity<=0;
  el('detailPlus').disabled=!p.available||quantity>=99
}
el('detailMinus').onclick=()=>{
  if(detailProductId&&cart[detailProductId]){
    change(detailProductId,-1);
    renderItemDetail()
  }
};
el('detailPlus').onclick=()=>{
  if(detailProductId){
    change(detailProductId,1);
    renderItemDetail()
  }
};
el('detailClose').onclick=()=>el('itemDetail').close();
el('itemDetail').onclose=()=>{
  detailProductId=null
};
el('shareLocation').onclick=()=>{
  if(!navigator.geolocation){
    showLocationStatus('unavailable');
    return
  }showLocationStatus('finding');
  navigator.geolocation.getCurrentPosition(p=>{
    deliveryLocation={
      locationLat:p.coords.latitude,locationLng:p.coords.longitude
    };
    showLocationStatus('attached')
  },()=>{
    showLocationStatus('denied')
  },{
    enableHighAccuracy:true,timeout:15000,maximumAge:0
  })
};
el('basketButton').onclick=()=>{
  if(!data)return;
  el('orderConfirmation').replaceChildren();
  confirmationLanguageRefresh=null;
  el('orderError').textContent='';
  renderBasket();
  el('basket').showModal()
};
el('close').onclick=()=>el('basket').close();
el('refresh').onclick=()=>load(false);
el('search').oninput=render;
el('favoritesFilter')?.addEventListener('click',()=>{favoritesOnly=!favoritesOnly;render();});
el('clearSearch')?.addEventListener('click',()=>{el('search').value='';render();el('search').focus();});
el('mobile').oninput=()=>el('mobile').setCustomValidity('');
el('pin').oninput=()=>el('pin').setCustomValidity('');
el('orderForm').onsubmit=async e=>{
  e.preventDefault();
  const orderTotals=totals();
  if(orderTotals.subtotal<data.store.minimumOrder){
    alert(t('minimumError',{minimum:money(data.store.minimumOrder),difference:money(data.store.minimumOrder-orderTotals.subtotal)}));
    return
  }const form=new FormData(e.target);
  const phone=String(form.get('phone')||'').trim(),pin=String(form.get('pin')||'').trim(),mobileRule=new RegExp(data.checkout?.mobilePattern||'^[6-9][0-9]{9}$'),pinRule=new RegExp(data.checkout?.pinPattern||'^[1-9][0-9]{5}$');
  if(!mobileRule.test(phone)){
    el('mobile').setCustomValidity(t('mobileError'));
    el('mobile').reportValidity();
    return
  }if(!pinRule.test(pin)){
    el('pin').setCustomValidity(t('pinError'));
    el('pin').reportValidity();
    return
  }const house=String(form.get('house')||'').trim(),locality=String(form.get('locality')||'').trim(),landmark=String(form.get('landmark')||'').trim();
  if(house.length<2||locality.length<5||!/[A-Za-z0-9\u0900-\u097F]/.test(house)||!/[A-Za-z0-9\u0900-\u097F]/.test(locality)){
    alert(t('addressError'));
    return
  }const chosen=data.products.filter(p=>p.available&&cart[p.id]).map(p=>({
    id:p.id,quantity:cart[p.id]
  }));
  if(!chosen.length)return;
  const button=el('send');
  button.disabled=true;
  button.textContent=t('placingOrder');
  el('orderError').textContent='';
  try{
    let key=sessionStorage.getItem('easy-mandi-pending-order');
    if(!key){
      key=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
      sessionStorage.setItem('easy-mandi-pending-order',key)
    }const response=await AppHttp.fetch('https://cserver.learnwithchampak.live/easymandi/api/order-create.php',{
      method:'POST',headers:{
        'Content-Type':'application/json'
      },body:JSON.stringify({
        requestKey:key,source:'web',customerNote:String(form.get('customerNote')||'').trim(),paymentMethod:String(form.get('paymentMethod')||'cod'),name:String(form.get('name')||'').trim(),mobile:phone,house,locality,landmark,pin,...deliveryLocation,items:chosen
      })
    });
    let result;
    try{
      result=await response.json()
    }catch{
      throw Error(t('serverUnexpected'))
    }if(!response.ok){
      if(response.status===409&&result.error?.startsWith('Order request already used'))sessionStorage.removeItem('easy-mandi-pending-order');
      throw Error(result.error||t('orderFailure'));
    }window.dispatchEvent(new CustomEvent('customer-order-placed',{detail:{
      orderId:result.orderId,
      items:chosen.map(line=>{
        const product=data.products.find(p=>String(p.id)===String(line.id));
        return {product_id:String(line.id),name:product?.name||'',unit:product?.unit||'',quantity:line.quantity};
      })
    }}));
    const paymentMethod=String(form.get('paymentMethod')||'cod');
    deliveryLocation=null;
    showLocationStatus('hint');
    const address=[house,locality,...(landmark?['Near '+landmark]:[]),(data.store.city||'Varanasi')+', '+(data.checkout?.state||'Uttar Pradesh')+' - '+pin].join(', ');
    const lines=data.products.filter(p=>cart[p.id]).map(p=>'• '+p.name+' ('+p.unit+') × '+cart[p.id]).join('\n');
    const message=t('welcomeWhatsapp',{id:result.orderId})+'\n\n'+lines+'\n\nName: '+form.get('name')+'\nMobile: +91 '+phone+'\nAddress: '+address+'\n\nPlease confirm availability and delivery time.';
    const box=el('orderConfirmation');
    box.replaceChildren();
    const title=document.createElement('h3');
    title.textContent=t('orderPlaced',{id:result.orderId});
    const note=document.createElement('p');
    note.textContent=t('savedTotal',{total:money(result.total),method:t(paymentMethod==='upi'?'upiSelected':'codSelected')});
    box.append(title,note);
    const acknowledgement=document.createElement('p');
    acknowledgement.className='note';
    acknowledgement.textContent=paymentMethod==='cod'
      ?(window.EMI18n?.lang==='hi'?'आपका COD ऑर्डर दर्ज हो गया है। डिलीवरी और उपलब्धता की पुष्टि अभी बाकी है।':'Your COD order was saved. Availability and delivery time are pending seller confirmation.')
      :(window.EMI18n?.lang==='hi'?'ऑर्डर दर्ज हो गया है। भुगतान रसीद सत्यापन के बाद ही भुगतान की पुष्टि होगी।':'Order saved. Your payment is confirmed only after receipt verification.');
    box.append(acknowledgement);
    if(paymentMethod==='upi'){
      const payWrap=document.createElement('section');
      payWrap.className='payment-panel';
      const payTitle=document.createElement('h4');payTitle.textContent=t('upiPayment');
      const payInfo=document.createElement('p');payInfo.textContent=t('payInfo',{total:money(result.total),name:'ABHISHEK KUMAR SINGH',upi:'7398564033@kotakbank'});
      const payLink=document.createElement('a');payLink.className='btn';payLink.textContent=t('openUpi');
      const upi='upi://pay?pa='+encodeURIComponent('7398564033@kotakbank')+'&pn='+encodeURIComponent('ABHISHEK KUMAR SINGH')+'&am='+encodeURIComponent(Number(result.total).toFixed(2))+'&cu=INR&tn='+encodeURIComponent('Easy Mandi '+result.orderId);
      payLink.href=upi;
      const ref=document.createElement('input');ref.placeholder=t('upiReference');ref.maxLength=80;
      const receipt=document.createElement('input');receipt.type='file';receipt.accept='image/jpeg,image/png,image/webp';
      const receiptStatus=document.createElement('p');receiptStatus.className='note';receiptStatus.textContent=t('receiptHint');
      const submitReceipt=document.createElement('button');submitReceipt.type='button';submitReceipt.className='btn secondary';submitReceipt.textContent=t('submitReceipt');
      submitReceipt.onclick=async()=>{
        const file=receipt.files?.[0];
        if(!file){receiptStatus.textContent=t('chooseReceipt');return;}
        if(file.size>1048576){receiptStatus.textContent=t('receiptSize');return;}
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)){receiptStatus.textContent=t('receiptType');return;}
        submitReceipt.disabled=true;receiptStatus.textContent=t('uploadingReceipt');
        try{
          const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(file);});
          const pr=await AppHttp.fetch('https://cserver.learnwithchampak.live/easymandi/api/payment.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'submit',orderId:result.orderId,requestKey:key,upiReference:ref.value.trim(),receiptMime:file.type,receiptBase64:base64})});
          const pd=await pr.json();
          if(!pr.ok)throw Error(pd.error||'Could not submit receipt.');
          receiptStatus.textContent=t('receiptSubmitted');
          submitReceipt.textContent=t('receiptSubmittedButton');
          sessionStorage.removeItem('easy-mandi-pending-order');
        }catch(error){receiptStatus.textContent=error.message||'Could not submit receipt.';submitReceipt.disabled=false;}
      };
      payWrap.append(payTitle,payInfo,payLink,ref,receipt,submitReceipt,receiptStatus);
      box.append(payWrap);
    }else{
      sessionStorage.removeItem('easy-mandi-pending-order');
    }
    const link=document.createElement('a');
    link.className='btn';
    let supportNumber=String(data.store.supportPhone||'').replace(/[^0-9]/g,'');
    if(supportNumber.length===10)supportNumber='91'+supportNumber;
    link.href='https://wa.me/'+supportNumber+'?text='+encodeURIComponent(message);
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.textContent=t('sendWhatsapp');
    box.append(link);
    confirmationLanguageRefresh=()=>{
      title.textContent=t('orderPlaced',{id:result.orderId});
      note.textContent=t('savedTotal',{total:money(result.total),method:t(paymentMethod==='upi'?'upiSelected':'codSelected')});
      acknowledgement.textContent=paymentMethod==='cod'
        ?(window.EMI18n?.lang==='hi'?'आपका COD ऑर्डर दर्ज हो गया है। डिलीवरी की पुष्टि अभी बाकी है।':'Your COD order was saved. Delivery confirmation is pending.')
        :(window.EMI18n?.lang==='hi'?'रसीद सत्यापन के बाद भुगतान की पुष्टि होगी।':'Payment confirmation follows receipt verification.');
      link.textContent=t('sendWhatsapp');
      const panel=box.querySelector('.payment-panel');
      if(panel){
        panel.querySelector('h4').textContent=t('upiPayment');
        panel.querySelector('p').textContent=t('payInfo',{total:money(result.total),name:'ABHISHEK KUMAR SINGH',upi:'7398564033@kotakbank'});
        panel.querySelector('a').textContent=t('openUpi');
        panel.querySelector('input').placeholder=t('upiReference');
      }
    };
    e.target.hidden=true;
    for(const id of Object.keys(cart))delete cart[id];
    save();
    render()
  }catch(error){
    el('orderError').textContent=error.message||t('orderFailure')
  }finally{
    button.disabled=false;
    button.textContent=t('placeOrder')
  }
};
window.addEventListener('customer-section-opened',event=>{
  if(event.detail?.section==='catalog')load(true);
});
window.addEventListener('languagechange',()=>{
  if(data){render();if(el('basket').open)renderBasket();if(el('itemDetail').open)renderItemDetail();}
  showLocationStatus(el('locationStatus').dataset.locationState||'hint');
  if(confirmationLanguageRefresh)confirmationLanguageRefresh();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true);});
window.addEventListener('focus',()=>{if(!document.hidden)load(true);});
setInterval(()=>{if(!document.hidden)load(true);},120000);
loadPopularity();
load();
