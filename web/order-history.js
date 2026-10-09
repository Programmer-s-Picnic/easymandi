/* Full customer order ledger, including orders before any delivery assignment. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const t=(en,hi)=>window.EMI18n?.lang==='hi'?hi:en;
  const panel=byId('myOrdersPanel'),list=byId('myOrdersList'),notice=byId('myOrdersStatus');
  const refreshButton=byId('refreshMyOrders'),moreButton=byId('moreMyOrders');
  const topButton=byId('myOrdersButton');
  if(!panel||!list||!window.CustomerAccount)return;
  const make=(tag,value,cls)=>{
    const n=document.createElement(tag);
    if(value!==undefined)n.textContent=String(value);
    if(cls)n.className=cls;
    return n;
  };
  const cash=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)||0);
  function indianDate(value){
    if(!value)return '—';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return String(value)+' IST';
    return new Intl.DateTimeFormat(window.EMI18n?.lang==='hi'?'hi-IN':'en-IN',{
      dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'
    }).format(date)+' IST';
  }
  const labels={
    New:['Order received','ऑर्डर प्राप्त'],Confirmed:['Confirmed','पुष्टि हुई'],
    Processing:['Preparing','तैयार हो रहा है'],Packed:['Packed','पैक हुआ'],
    Shipped:['Dispatched','भेज दिया गया'],Delivered:['Delivered','पहुंचाया गया'],
    Cancelled:['Cancelled','रद्द'],created:['Awaiting assignment','अभी साथी नियुक्त नहीं'],
    assigned:['Partner assigned','डिलीवरी साथी नियुक्त'],
    picked_up:['Picked up','सामान लिया गया'],
    out_for_delivery:['Out for delivery','डिलीवरी के लिए निकला'],
    delivered:['Delivered','पहुंचाया गया'],cancelled:['Cancelled','रद्द']
  };
  const statusName=s=>labels[s]?t(...labels[s]):String(s||'—');
  let rows=[],page=0,hasMore=false,loading=false,nonce=0,accountId=null;
  function render(){
    const logged=!!window.CustomerAccount?.user;
    panel.hidden=!logged;
    topButton.hidden=!logged;
    if(!logged){list.replaceChildren();notice.textContent='';return;}
    byId('myOrdersHeading').textContent=t('My orders · full history','मेरे ऑर्डर · पूरा इतिहास');
    refreshButton.textContent=t('Refresh orders','ऑर्डर अपडेट करें');
    moreButton.textContent=t('Load more orders','और ऑर्डर दिखाएँ');
    moreButton.hidden=!hasMore;
    list.replaceChildren();
    if(!rows.length){
      list.append(make('p',t('No orders found for this account yet. Orders appear as soon as they are saved, even before assigning a delivery partner.','इस खाते में अभी ऑर्डर नहीं हैं। डिलीवरी साथी नियुक्त होने से पहले भी नया ऑर्डर यहाँ दिखेगा।'),'orders-empty'));
      return;
    }
    for(const o of rows){
      const card=make('article',undefined,'order-history-card');
      const heading=make('div',undefined,'order-history-top');
      const group=make('div');
      group.append(make('h3',t('Order ','ऑर्डर ')+o.public_id));
      group.append(make('small',indianDate(o.created_at)));
      const badge=make('span',statusName(o.delivery_status||o.status),'order-status-badge');
      badge.dataset.status=String(o.delivery_status||o.status||'');
      heading.append(group,badge);card.append(heading);
      card.append(make('p',t('Order status: ','ऑर्डर स्थिति: ')+statusName(o.status)+
        ' · '+t('Delivery: ','डिलीवरी: ')+(o.delivery_status?statusName(o.delivery_status):t('Not yet assigned','अभी नियुक्त नहीं')),'order-status-line'));
      const body=make('div',undefined,'order-history-body');
      const detail=make('div',undefined,'order-history-detail');
      detail.append(make('h4',t('Items ordered','मँगाए गए सामान')));
      const items=make('ul',undefined,'order-history-items');
      for(const line of o.items||[]){
        const li=make('li');
        li.append(make('span',line.product_name+' · '+line.unit+' × '+line.quantity));
        li.append(make('strong',cash(line.line_total)));
        items.append(li);
      }
      detail.append(items);
      const totals=make('dl',undefined,'order-history-totals');
      for(const [name,val] of [
        [t('Subtotal','सामान कुल'),o.subtotal],
        [t('Delivery fee','डिलीवरी शुल्क'),o.delivery_fee],
        [t('Grand total','कुल राशि'),o.total]
      ]){totals.append(make('dt',name),make('dd',cash(val)));}
      detail.append(totals);
      const info=make('div',undefined,'order-history-info');
      info.append(make('h4',t('Delivery address','डिलीवरी का पता')));
      info.append(make('p',[o.customer_name,o.house,o.locality,o.landmark,o.city,o.state,o.pin].filter(Boolean).join(', ')));
      info.append(make('h4',t('Payment','भुगतान')));
      info.append(make('p',t('Method: ','तरीका: ')+String(o.payment_method||'cod').toUpperCase()+
        ' · '+t('Status: ','स्थिति: ')+String(o.payment_status||'pending')));
      if(o.upi_reference)info.append(make('p','UPI: '+o.upi_reference));
      if(o.has_receipt)info.append(make('p',t('Receipt submitted','रसीद जमा हो चुकी है')));
      if(o.submitted_at)info.append(make('p',t('Payment submitted: ','भुगतान दर्ज: ')+indianDate(o.submitted_at)));
      if(o.verified_at)info.append(make('p',t('Payment verified: ','भुगतान सत्यापित: ')+indianDate(o.verified_at)));
      if(o.customer_note)info.append(make('p',t('Delivery instructions: ','डिलीवरी निर्देश: ')+o.customer_note));
      if(o.delivery_partner_name)info.append(make('p',t('Delivery partner: ','डिलीवरी साथी: ')+o.delivery_partner_name));
      info.append(make('p',t('Updated: ','अपडेट: ')+indianDate(o.updated_at),'order-history-updated'));
      body.append(detail,info);card.append(body);
      list.append(card);
    }
  }
  async function fetchPage(reset=false){
    const current=window.CustomerAccount?.user;
    if(!current){nonce++;rows=[];page=0;hasMore=false;render();return;}
    if(loading&&!reset)return;
    if(reset){nonce++;page=0;rows=[];hasMore=false;}
    const serial=nonce,owner=current.id;
    loading=true;
    refreshButton.disabled=moreButton.disabled=true;
    notice.textContent=t('Loading your saved orders…','आपके ऑर्डर लोड हो रहे हैं…');
    try{
      const result=await window.CustomerAccount.request('my-orders',{authorized:true});
      if(serial!==nonce||window.CustomerAccount?.user?.id!==owner)return;
      rows=Array.isArray(result.orders)?result.orders:[];
      page=1;
      hasMore=!!result.hasMore;
      notice.textContent=t('Showing orders for your signed-in account · Times in IST','आपके खाते के ऑर्डर · समय भारतीय मानक समय (IST) में');
      render();
    }catch(error){
      if(serial===nonce)notice.textContent=error.message||t('Could not load orders.','ऑर्डर लोड नहीं हो सके।');
    }finally{loading=false;refreshButton.disabled=moreButton.disabled=false;}
  }
  async function loadMore(){
    if(!hasMore||loading||!window.CustomerAccount?.user)return;
    loading=true;
    moreButton.disabled=true;
    const serial=nonce,owner=window.CustomerAccount.user.id,next=page+1;
    try{
      const data=await window.CustomerAccount.request('my-orders?page='+next,{authorized:true});
      if(serial!==nonce||window.CustomerAccount?.user?.id!==owner)return;
      rows.push(...(data.orders||[]));page=next;hasMore=!!data.hasMore;render();
    }catch(error){notice.textContent=error.message||t('Could not load more.','और ऑर्डर लोड नहीं हुए।');}
    finally{loading=false;moreButton.disabled=false;}
  }
  refreshButton.onclick=()=>fetchPage(true);
  moreButton.onclick=loadMore;
  topButton.onclick=()=>window.EasyMandiSections?.select('orders')||panel.scrollIntoView({behavior:'smooth',block:'start'});
  window.addEventListener('customer-account-changed',()=>{
    accountId=window.CustomerAccount?.user?.id??null;
    rows=[];page=0;hasMore=false;nonce++;render();
    if(accountId!==null)fetchPage(true);
  });
  window.addEventListener('customer-order-placed',()=>fetchPage(true));
  window.addEventListener('languagechange',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&window.CustomerAccount?.user)fetchPage(true);});
  render();
  if(window.CustomerAccount.user)fetchPage(true);
})();
