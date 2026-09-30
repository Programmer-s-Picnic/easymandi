const source='https://cserver.learnwithchampak.live/easymandi/api/catalog.php';
let data=null,category='All',cart={
};
try{
  cart=JSON.parse(localStorage.getItem('easy-mandi-cart')||'{}')
}catch{
}const el=id=>document.getElementById(id),money=n=>'₹'+n,save=()=>localStorage.setItem('easy-mandi-cart',JSON.stringify(cart));
async function load(){
  el('status').textContent='Loading catalog…';
  try{
    let response=await AppHttp.fetch(source+'?t='+Date.now());
    if(!response.ok)response=await AppHttp.fetch('https://raw.githubusercontent.com/Programmer-s-Picnic/easymandidata/main/catalog/products.json?t='+Date.now());
    if(!response.ok)throw Error('catalog unavailable');
    const next=await response.json();
    if(!Array.isArray(next.products)||!next.store)throw Error('invalid catalog');
    data=next;
    localStorage.setItem('easy-mandi-catalog',JSON.stringify(data));
    el('status').textContent=''
  }catch(e){
    try{
      data=JSON.parse(localStorage.getItem('easy-mandi-catalog'))
    }catch{
    }el('status').textContent=data?'Showing saved catalog · connect to refresh prices':'Could not load catalog. Please retry.'
  }render()
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
    b.textContent=c;
    b.className=c===category?'active':'';
    b.onclick=()=>{
      category=c;
      render()
    };
    el('filters').append(b)
  });
  const q=el('search').value.toLocaleLowerCase();
  let list=data.products.filter(p=>(category==='All'||p.category===category)&&(p.name+' '+p.hindi+' '+p.category).toLocaleLowerCase().includes(q));
  el('count').textContent=list.length+' products · Indicative demo prices';
  el('products').innerHTML='';
  for(const p of list){
    const card=document.createElement('article');
    card.className='card';
    const art=document.createElement('div');
    art.className='illustration';
    art.textContent=p.emoji;
    const title=document.createElement('h3');
    title.textContent=p.name;
    const unit=document.createElement('small');
    unit.textContent=p.hindi+' · '+p.unit;
    const row=document.createElement('div');
    row.className='row';
    const price=document.createElement('span');
    price.className='price';
    price.textContent=money(p.price);
    const step=document.createElement('span');
    step.className='step';
    if(!p.available)step.textContent='Sold out';
    else if(!cart[p.id]){
      const add=document.createElement('button');
      add.textContent='+';
      add.setAttribute('aria-label','Add '+p.name);
      add.onclick=()=>change(p.id,1);
      step.append(add)
    }else{
      for(const [label,delta] of [['−',-1],['+',1]]){
        const b=document.createElement('button');
        b.textContent=label;
        b.setAttribute('aria-label',(delta>0?'Add ':'Remove ')+p.name);
        b.onclick=()=>change(p.id,delta);
        if(delta>0)step.append(String(cart[p.id]));
        step.append(b)
      }
    }row.append(price,step);
    card.append(art,title,unit,row);
    el('products').append(card)
  }if(!list.length)el('products').textContent='No matching products.';
  el('basketButton').textContent='Basket · '+Object.values(cart).reduce((a,b)=>a+b,0)
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
    name.textContent=p.emoji+' '+p.name+' · '+p.unit+' · View details';
    name.setAttribute('aria-label','View '+p.name+' full screen');
    name.onclick=()=>showItemDetail(p);
    const count=document.createElement('span');
    count.textContent='× '+cart[p.id];
    const price=document.createElement('strong');
    price.textContent=money(p.price*cart[p.id]);
    const remove=document.createElement('button');
    remove.type='button';
    remove.className='btn ghost';
    remove.textContent='Remove';
    remove.setAttribute('aria-label','Remove '+p.name+' from basket');
    remove.onclick=()=>change(p.id,-cart[p.id]);
    row.append(name,count,price,remove);
    el('items').append(row)
  }if(!chosen.length)el('items').textContent='Your basket is empty.';
  const t=totals();
  el('totals').innerHTML='<div class="total">Subtotal <span>'+money(t.subtotal)+'</span></div><div class="total">Delivery <span>'+(t.fee?money(t.fee):'Free')+'</span></div><div class="total"><strong>Estimated total</strong><strong>'+money(t.total)+'</strong></div>';
  el('deliveryNote').textContent='Free delivery from '+money(data.store.freeDeliveryAbove)+' · Minimum order '+money(data.store.minimumOrder);
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
  }el('detailTitle').textContent=p.name;
  el('detailArt').textContent=p.emoji;
  el('detailHindi').textContent=p.hindi||'';
  el('detailPrice').textContent=money(p.price)+' / '+p.unit;
  el('detailDescription').textContent=p.description||'';
  el('detailQuantity').textContent=quantity;
  el('detailTotal').textContent='Item total: '+money(p.price*quantity);
  el('detailMinus').setAttribute('aria-label','Remove one '+p.name);
  el('detailPlus').setAttribute('aria-label','Add one '+p.name);
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
    el('locationStatus').textContent='Location is unavailable on this device.';
    return
  }el('locationStatus').textContent='Finding your location…';
  navigator.geolocation.getCurrentPosition(p=>{
    deliveryLocation={
      locationLat:p.coords.latitude,locationLng:p.coords.longitude
    };
    el('locationStatus').textContent='Location attached. Check the pin: '+p.coords.latitude.toFixed(5)+', '+p.coords.longitude.toFixed(5)
  },()=>{
    el('locationStatus').textContent='Location permission was denied or unavailable. You can still place the order.'
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
el('refresh').onclick=load;
el('search').oninput=render;
el('mobile').oninput=()=>el('mobile').setCustomValidity('');
el('pin').oninput=()=>el('pin').setCustomValidity('');
el('orderForm').onsubmit=async e=>{
  e.preventDefault();
  const t=totals();
  if(t.subtotal<data.store.minimumOrder){
    alert('Minimum order is '+money(data.store.minimumOrder)+'. Add '+money(data.store.minimumOrder-t.subtotal)+' more.');
    return
  }const form=new FormData(e.target);
  const phone=String(form.get('phone')||'').trim(),pin=String(form.get('pin')||'').trim(),mobileRule=new RegExp(data.checkout?.mobilePattern||'^[6-9][0-9]{9}$'),pinRule=new RegExp(data.checkout?.pinPattern||'^[1-9][0-9]{5}$');
  if(!mobileRule.test(phone)){
    el('mobile').setCustomValidity('Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9');
    el('mobile').reportValidity();
    return
  }if(!pinRule.test(pin)){
    el('pin').setCustomValidity('Enter a valid 6-digit Indian PIN code');
    el('pin').reportValidity();
    return
  }const house=String(form.get('house')||'').trim(),locality=String(form.get('locality')||'').trim(),landmark=String(form.get('landmark')||'').trim();
  if(house.length<2||locality.length<5||!/[A-Za-z0-9\u0900-\u097F]/.test(house)||!/[A-Za-z0-9\u0900-\u097F]/.test(locality)){
    alert('Enter a valid house/building and street/locality.');
    return
  }const chosen=data.products.filter(p=>p.available&&cart[p.id]).map(p=>({
    id:p.id,quantity:cart[p.id]
  }));
  if(!chosen.length)return;
  const button=el('send');
  button.disabled=true;
  button.textContent='Placing order…';
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
        requestKey:key,source:'web',name:String(form.get('name')||'').trim(),mobile:phone,house,locality,landmark,pin,...deliveryLocation,items:chosen
      })
    });
    let result;
    try{
      result=await response.json()
    }catch{
      throw Error('Unexpected server response. Please retry.')
    }if(!response.ok){
      if(response.status===409&&result.error?.startsWith('Order request already used'))sessionStorage.removeItem('easy-mandi-pending-order');
      throw Error(result.error||'Could not place order. Please retry.');
    }sessionStorage.removeItem('easy-mandi-pending-order');
    deliveryLocation=null;
    el('locationStatus').textContent='Optional map pin for accurate delivery.';
    const address=[house,locality,...(landmark?['Near '+landmark]:[]),(data.store.city||'Varanasi')+', '+(data.checkout?.state||'Uttar Pradesh')+' - '+pin].join(', ');
    const lines=data.products.filter(p=>cart[p.id]).map(p=>'• '+p.name+' ('+p.unit+') × '+cart[p.id]).join('\n');
    const message='Hello Easy Mandi, my order '+result.orderId+' has been placed.\n\n'+lines+'\n\nName: '+form.get('name')+'\nMobile: +91 '+phone+'\nAddress: '+address+'\n\nPlease confirm availability and delivery time.';
    const box=el('orderConfirmation');
    box.replaceChildren();
    const title=document.createElement('h3');
    title.textContent='Order placed · '+result.orderId;
    const note=document.createElement('p');
    note.textContent='Saved total: '+money(result.total)+'. The Easy Mandi team can review your order.';
    const link=document.createElement('a');
    link.className='btn';
    let supportNumber=String(data.store.supportPhone||'').replace(/[^0-9]/g,'');
    if(supportNumber.length===10)supportNumber='91'+supportNumber;
    link.href='https://wa.me/'+supportNumber+'?text='+encodeURIComponent(message);
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.textContent='Send reference on WhatsApp';
    box.append(title,note,link);
    e.target.hidden=true;
    for(const id of Object.keys(cart))delete cart[id];
    save();
    render()
  }catch(error){
    el('orderError').textContent=error.message||'Could not place order. Please retry.'
  }finally{
    button.disabled=false;
    button.textContent='Place order'
  }
};
load();
