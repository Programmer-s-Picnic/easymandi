/* Customer-facing delivery confirmation: only an authenticated server-issued live code is shown.
   QR generation is local (no external QR service receives the handoff secret). */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const t=(en,hi)=>window.EMI18n?.lang==='hi'?hi:en;
  const labels={
    created:['Waiting for partner','डिलीवरी साथी की प्रतीक्षा'],
    assigned:['Partner assigned','डिलीवरी साथी नियुक्त'],
    picked_up:['Picked up','सामान ले लिया गया'],
    out_for_delivery:['Out for delivery','डिलीवरी के लिए निकला'],
    delivered:['Delivered','पहुंचा दिया गया'],
    cancelled:['Cancelled','रद्द किया गया']
  };
  const panel=byId('deliveryPanel');
  const list=byId('customerDeliveries');
  const notice=byId('deliveryStatus');
  const refreshButton=byId('refreshDeliveries');
  if(!panel||!list||!notice||!refreshButton)return;
  let requestNumber=0,loading=false,lastOrders=[];

  function element(tag,text,className){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=String(text);
    if(className)node.className=className;
    return node;
  }
  const validCode=code=>typeof code==='string'&&/^[0-9]{6}$/.test(code);
  const validQr=(order,code)=>typeof order.handoff_qr==='string' &&
    order.handoff_qr==='easymandi://handoff?delivery='+String(order.id)+'&code='+code;
  function render(){
    const loggedIn=!!window.CustomerAccount?.user;
    panel.hidden=!loggedIn;
    if(!loggedIn){lastOrders=[];list.replaceChildren();notice.textContent='';return;}
    byId('deliveryHeading').textContent=t('My deliveries · code & QR','मेरी डिलीवरी · कोड और QR');
    refreshButton.textContent=t('Refresh deliveries','डिलीवरी अपडेट करें');
    list.replaceChildren();
    if(!lastOrders.length){
      list.append(element('p',t('No deliveries have been assigned yet. When a delivery partner is assigned, the code and QR will appear here.','अभी कोई डिलीवरी नहीं जोड़ी गई है। डिलीवरी साथी नियुक्त होने पर कोड और QR यहाँ दिखेंगे।'),'delivery-empty'));
      return;
    }
    for(const order of lastOrders){
      const card=element('article',undefined,'customer-delivery-card');
      const top=element('div',undefined,'delivery-card-head');
      const title=element('h3',t('Order ','ऑर्डर ')+String(order.external_order_id||order.id));
      const status=String(order.status||'created');
      const state=element('span',t(...(labels[status]||[status,status])),'delivery-state');
      state.dataset.state=status;
      top.append(title,state);card.append(top);

      const active=['assigned','picked_up','out_for_delivery'].includes(status);
      const code=order.handoff_code;
      if(active&&validCode(code)&&validQr(order,code)){
        const handoff=element('div',undefined,'delivery-code-box');
        handoff.append(element('p',t('Your six-digit delivery code','आपका छह अंकों का डिलीवरी कोड'),'delivery-code-label'));
        const codeText=element('strong',code,'delivery-code-number');
        handoff.append(codeText);
        handoff.append(element('p',t('Give this code or show the QR to the delivery partner only after receiving your order.','सामान मिलने के बाद ही डिलीवरी साथी को कोड या QR दिखाएँ।'),'delivery-code-warning'));
        const qr=element('div',undefined,'delivery-qr');
        qr.setAttribute('role','img');
        qr.setAttribute('aria-label',t('QR for delivery '+order.id,'डिलीवरी '+order.id+' का QR'));
        try{
          if(typeof window.QRCode!=='function')throw Error('QR library unavailable');
          new window.QRCode(qr,{text:order.handoff_qr,width:180,height:180,colorDark:'#0d3423',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
          handoff.append(qr);
          const buttons=element('div',undefined,'delivery-share-actions');
          const share=element('button',t('Share code + QR with receiver','प्राप्तकर्ता को कोड और QR भेजें'),'btn');
          share.type='button';
          share.onclick=async()=>{
            const name=prompt(t('Receiver name (optional). Share only with somebody you trust.','प्राप्तकर्ता का नाम (वैकल्पिक)। केवल भरोसेमंद व्यक्ति से साझा करें।'),'');
            if(name===null)return;
            const receiver=String(name).trim().slice(0,80);
            const text=t('Easy Mandi order ','Easy Mandi ऑर्डर ')+String(order.external_order_id||order.id)+
              (receiver?'\n'+t('Receiver: ','प्राप्तकर्ता: ')+receiver:'')+
              '\n'+t('Delivery code: ','डिलीवरी कोड: ')+code+
              '\\nQR: '+order.handoff_qr+
              '\n'+t('Give this to the delivery partner only after physically receiving the order.','सामान मिलने के बाद ही डिलीवरी साथी को यह कोड दें।');
            try{
              const canvas=qr.querySelector('canvas'),img=qr.querySelector('img');
              const blob=canvas?await new Promise(resolve=>canvas.toBlob(resolve,'image/png')):img?await (await fetch(img.src)).blob():null;
              const file=blob?new File([blob],'easy-mandi-order-'+order.id+'-qr.png',{type:'image/png'}):null;
              if(navigator.share){
                const details={title:'Easy Mandi delivery code',text};
                if(file&&(!navigator.canShare||navigator.canShare({files:[file]})))details.files=[file];
                await navigator.share(details);
              }else{
                await navigator.clipboard.writeText(text);
                alert(t('Code and QR text copied. You can also save the QR image below.','कोड और QR लिंक कॉपी हो गया। QR चित्र नीचे सहेजें।'));
              }
            }catch(error){
              if(error.name!=='AbortError')alert(t('Could not share. Copy the code instead.','साझा नहीं हो पाया। कृपया कोड कॉपी करें।'));
            }
          };
          const download=element('button',t('Save QR image','QR चित्र सहेजें'),'btn ghost');
          download.type='button';
          download.onclick=()=>{
            const canvas=qr.querySelector('canvas'),img=qr.querySelector('img');
            const href=canvas?.toDataURL('image/png')||img?.src;
            if(!href)return;
            const link=document.createElement('a');link.href=href;link.download='easy-mandi-delivery-'+order.id+'.png';link.click();
          };
          buttons.append(share,download);handoff.append(buttons);
        }catch(_){
          handoff.append(element('p',t('QR is unavailable. The six-digit code above can be entered manually.','QR उपलब्ध नहीं है। ऊपर का छह अंकों का कोड डिलीवरी साथी दर्ज कर सकता है।'),'delivery-code-warning'));
        }
        if(order.code_expires_at)handoff.append(element('p',t('Valid until: ','मान्य समय: ')+String(order.code_expires_at),'delivery-expiry'));
        card.append(handoff);
      }else if(active){
        card.append(element('p',t('The delivery code is not currently available. Ask the administrator to issue a fresh code and refresh this page.','डिलीवरी कोड अभी उपलब्ध नहीं है। व्यवस्थापक से नया कोड जारी करवाकर यह पृष्ठ अपडेट करें।'),'delivery-code-warning'));
      }else if(status==='created'){
        card.append(element('p',t('A QR code is created when a delivery partner is assigned.','डिलीवरी साथी नियुक्त होने पर QR कोड मिलेगा।'),'delivery-help'));
      }else{
        card.append(element('p',status==='delivered'?t('Completed. The handoff code is no longer active.','डिलीवरी पूरी हो गई। कोड अब सक्रिय नहीं है।'):t('No active delivery handoff code.','कोई सक्रिय डिलीवरी कोड नहीं है।'),'delivery-help'));
      }
      list.append(card);
    }
  }
  async function refresh(){
    const account=window.CustomerAccount?.user;
    if(!account){requestNumber++;lastOrders=[];loading=false;render();return;}
    // Do not invalidate a running response merely because the user reopened
    // this tab. The in-flight request is already going to populate the view.
    if(loading)return;
    const serial=++requestNumber;
    loading=true;
    refreshButton.disabled=true;
    notice.textContent=t('Updating delivery status…','डिलीवरी स्थिति अपडेट हो रही है…');
    try{
      const response=await window.CustomerAccount.customerDeliveries();
      if(serial!==requestNumber||window.CustomerAccount?.user?.id!==account.id)return;
      lastOrders=Array.isArray(response.orders)?response.orders:[];
      notice.textContent='';
      render();
    }catch(error){
      if(serial===requestNumber&&window.CustomerAccount?.user?.id===account.id){
        notice.textContent=error.message||t('Could not load deliveries. Try again.','डिलीवरी नहीं खुली। दोबारा प्रयास करें।');
      }
    }finally{
      if(serial===requestNumber){
        loading=false;
        refreshButton.disabled=false;
      }
    }
  }
  refreshButton.addEventListener('click',refresh);
  window.addEventListener('customer-section-opened',event=>{
    if(event.detail?.section==='deliveries'){
      render(); // cached delivery cards and active codes appear immediately
      refresh(); // update current status and codes in the background
    }
  });
  window.addEventListener('customer-account-changed',()=>{
    requestNumber++;
    loading=false;
    lastOrders=[];
    render();
    refresh();
  });
  window.addEventListener('customer-order-placed',()=>refresh());
  window.addEventListener('languagechange',()=>{render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden&&window.CustomerAccount?.user)refresh();},60000);
  render();
  if(window.CustomerAccount?.user)refresh();
})();
