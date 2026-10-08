const source='https://cserver.learnwithchampak.live/easymandi/api/catalog.php';
let data=null,category='All',cart={
};
try{
  cart=JSON.parse(localStorage.getItem('easy-mandi-cart')||'{}')
}catch{
}const el=id=>document.getElementById(id),money=n=>'₹'+n,save=()=>localStorage.setItem('easy-mandi-cart',JSON.stringify(cart));
const t=(key,vars={})=>window.EMI18n?.t(key,vars)||key;
const productLabel=p=>window.EMI18n?.lang==='hi'?(p.hindi||p.name):p.name;
let catalogLoading=false;
let confirmationLanguageRefresh=null;
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
  let list=data.products.filter(p=>(category==='All'||p.category===category)&&(p.name+' '+p.hindi+' '+p.category).toLocaleLowerCase().includes(q));
  el('count').textContent=t('productsCount',{count:list.length});
  el('products').innerHTML='';
  for(const p of list){
    const card=document.createElement('article');
    card.className='card';
    const art=document.createElement('div');
    art.className='illustration';
    art.textContent=p.emoji;
    const title=document.createElement('h3');
    title.textContent=productLabel(p);
    const unit=document.createElement('small');
    unit.textContent=(window.EMI18n?.lang==='hi'?p.name:p.hindi)+' · '+p.unit;
    const row=document.createElement('div');
    row.className='row';
    const price=document.createElement('span');
    price.className='price';
    price.textContent=money(p.price);
    const step=document.createElement('span');
    step.className='step';
    if(!p.available)step.textContent=t('soldOut');
    else if(!cart[p.id]){
      const add=document.createElement('button');
      add.textContent='+';
      add.setAttribute('aria-label',t('add')+' '+productLabel(p));
      add.onclick=()=>change(p.id,1);
      step.append(add)
    }else{
      for(const [label,delta] of [['−',-1],['+',1]]){
        const b=document.createElement('button');
        b.textContent=label;
        b.setAttribute('aria-label',t(delta>0?'add':'removeOne')+' '+productLabel(p));
        b.onclick=()=>change(p.id,delta);
        if(delta>0)step.append(String(cart[p.id]));
        step.append(b)
      }
    }row.append(price,step);
    card.append(art,title,unit,row);
    el('products').append(card)
  }if(!list.length)el('products').textContent=t('noProducts');
  el('basketButton').textContent=t('basket')+' · '+Object.values(cart).reduce((a,b)=>a+b,0)
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
  if(!p||!quantity){
    if(el('itemDetail').open)el('itemDetail').close();
    detailProductId=null;
    return
  }el('detailTitle').textContent=productLabel(p);
  el('detailArt').textContent=p.emoji;
  el('detailHindi').textContent=window.EMI18n?.lang==='hi'?p.name:(p.hindi||'');
  el('detailPrice').textContent=money(p.price)+' / '+p.unit;
  el('detailDescription').textContent=p.description||'';
  el('detailQuantity').textContent=quantity;
  el('detailTotal').textContent=t('itemTotal',{amount:money(p.price*quantity)});
  el('detailMinus').setAttribute('aria-label',t('removeOne')+' '+productLabel(p));
  el('detailPlus').setAttribute('aria-label',t('add')+' '+productLabel(p));
  el('detailPlus').disabled=quantity>=99
}
el('detailMinus').onclick=()=>{
  if(detailProductId){
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
    el('locationStatus').textContent=t('locationUnavailable');
    return
  }el('locationStatus').textContent=t('locationFinding');
  navigator.geolocation.getCurrentPosition(p=>{
    deliveryLocation={
      locationLat:p.coords.latitude,locationLng:p.coords.longitude
    };
    el('locationStatus').textContent=t('locationAttached',{coords:p.coords.latitude.toFixed(5)+', '+p.coords.longitude.toFixed(5)})
  },()=>{
    el('locationStatus').textContent=t('locationDenied')
  },{
    enableHighAccuracy:true,timeout:15000,maximumAge:0
  })
};
el('basketButton').onclick=()=>{
  if(!data)return;
  el('orderConfirmation').replaceChildren();
  el('orderError').textContent='';
  renderBasket();
  el('basket').showModal()
};
el('close').onclick=()=>el('basket').close();
el('refresh').onclick=()=>load(false);
el('search').oninput=render;
el('mobile').oninput=()=>el('mobile').setCustomValidity('');
el('pin').oninput=()=>el('pin').setCustomValidity('');
el('orderForm').onsubmit=async e=>{
  e.preventDefault();
  const t=totals();
  if(t.subtotal<data.store.minimumOrder){
    alert(t('minimumError',{minimum:money(data.store.minimumOrder),difference:money(data.store.minimumOrder-t.subtotal)}));
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
        requestKey:key,source:'web',paymentMethod:String(form.get('paymentMethod')||'cod'),name:String(form.get('name')||'').trim(),mobile:phone,house,locality,landmark,pin,...deliveryLocation,items:chosen
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
    }window.dispatchEvent(new Event('customer-order-placed'));
    const paymentMethod=String(form.get('paymentMethod')||'cod');
    deliveryLocation=null;
    el('locationStatus').textContent=t('locationHint');
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
window.addEventListener('languagechange',()=>{
  if(data){render();if(el('basket').open)renderBasket();if(el('itemDetail').open)renderItemDetail();}
  if(confirmationLanguageRefresh)confirmationLanguageRefresh();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true);});
window.addEventListener('focus',()=>{if(!document.hidden)load(true);});
setInterval(()=>{if(!document.hidden)load(true);},120000);
load();
