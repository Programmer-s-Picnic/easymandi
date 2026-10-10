/* Delivery and handoff details live inside each order-history card.
   QR is rendered locally; no third-party image or QR service sees the code. */
(()=>{
  'use strict';
  const t=(en,hi)=>window.EMI18n?.lang==='hi'?hi:en;
  const make=(tag,value,css)=>{
    const node=document.createElement(tag);
    if(value!==undefined)node.textContent=String(value);
    if(css)node.className=css;
    return node;
  };
  const labels={
    created:['Awaiting delivery partner','डिलीवरी साथी की प्रतीक्षा'],
    assigned:['Partner assigned','डिलीवरी साथी नियुक्त'],
    picked_up:['Picked up','सामान ले लिया गया'],
    out_for_delivery:['Out for delivery','डिलीवरी के लिए रवाना'],
    delivered:['Delivered','डिलीवरी पूरी'],
    cancelled:['Cancelled','रद्द']
  };
  const active=status=>['assigned','picked_up','out_for_delivery'].includes(status);
  const goodCode=code=>typeof code==='string'&&/^[0-9]{6}$/.test(code);
  const expectedQr=(o,code)=>'easymandi://handoff?order='+
    encodeURIComponent(String(o.external_order_id))+'&delivery='+String(o.id)+'&code='+code;
  let orders=new Map(),lastOwner=null,lastError='';
  async function refresh(){
    const owner=window.CustomerAccount?.user?.id;
    if(owner==null){reset();return;}
    const data=await window.CustomerAccount.customerDeliveries();
    if(window.CustomerAccount?.user?.id!==owner)return;
    const next=new Map();
    for(const row of data.orders||[]){
      if(row&&row.external_order_id)next.set(String(row.external_order_id),row);
    }
    orders=next;lastOwner=owner;lastError='';
  }
  function reset(){orders=new Map();lastOwner=null;lastError='';}
  function renderFor(order){
    if(!window.CustomerAccount?.user||lastOwner!==window.CustomerAccount.user.id)return null;
    const delivery=orders.get(String(order.public_id));
    const status=String(delivery?.status||order.delivery_status||'');
    if(!status)return null;
    const section=make('section',undefined,'order-handoff-section');
    section.append(make('h4',t('Delivery and handoff','डिलीवरी और हैंडऑफ')));
    const stage=make('p',t(...(labels[status]||[status,status])),'delivery-state');
    stage.dataset.state=status;
    section.append(stage);
    const code=delivery?.handoff_code;
    if(active(status)&&goodCode(code)&&delivery.handoff_qr===expectedQr(delivery,code)){
      const box=make('div',undefined,'delivery-code-box');
      box.append(make('p',t('Your six-digit handoff code','आपका छह अंकों का हैंडऑफ कोड'),'delivery-code-label'));
      box.append(make('strong',code,'delivery-code-number'));
      box.append(make('p',t('Give the code or show the QR only after receiving the order.',
        'ऑर्डर मिलने के बाद ही कोड या QR दिखाएँ।'),'delivery-code-warning'));
      const qr=make('div',undefined,'delivery-qr');
      qr.setAttribute('role','img');
      qr.setAttribute('aria-label',t('Handoff QR for order ','ऑर्डर का हैंडऑफ QR ')+String(order.public_id));
      try{
        if(typeof window.QRCode!=='function')throw Error('QR library missing');
        new window.QRCode(qr,{text:delivery.handoff_qr,width:165,height:165,
          colorDark:'#0d3423',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
        box.append(qr);
        const controls=make('div',undefined,'delivery-share-actions');
        const share=make('button',t('Share code + QR','कोड और QR साझा करें'),'btn');
        share.type='button';
        share.onclick=async()=>{
          const name=prompt(t('Receiver name (optional). Share only with someone you trust.',
            'प्राप्तकर्ता का नाम (वैकल्पिक)। केवल भरोसेमंद व्यक्ति से साझा करें।'),'');
          if(name===null)return;
          const text='Easy Mandi order '+String(order.public_id)+
            (name.trim()?'\nReceiver: '+name.trim().slice(0,80):'')+
            '\nDelivery handoff code: '+code+
            '\nQR: '+delivery.handoff_qr+
            '\nShow this only after the items have been received.';
          try{
            const canvas=qr.querySelector('canvas'),img=qr.querySelector('img');
            const blob=canvas?await new Promise(resolve=>canvas.toBlob(resolve,'image/png')):
              img?await(await fetch(img.src)).blob():null;
            const file=blob?new File([blob],'easymandi-'+order.public_id+'-qr.png',{type:'image/png'}):null;
            if(navigator.share){
              const payload={title:'Easy Mandi order '+order.public_id,text};
              if(file&&(!navigator.canShare||navigator.canShare({files:[file]})))payload.files=[file];
              await navigator.share(payload);
            }else{
              await navigator.clipboard.writeText(text);
              alert(t('Handoff details copied.','हैंडऑफ विवरण कॉपी हो गया।'));
            }
          }catch(error){
            if(error.name!=='AbortError')alert(t('Sharing failed; show the code instead.','साझा नहीं हुआ, कृपया कोड दिखाएँ।'));
          }
        };
        const save=make('button',t('Save QR','QR सहेजें'),'btn ghost');
        save.type='button';save.onclick=()=>{
          const canvas=qr.querySelector('canvas'),img=qr.querySelector('img');
          const href=canvas?.toDataURL('image/png')||img?.src;
          if(!href)return;
          const a=document.createElement('a');a.href=href;a.download='easymandi-'+order.public_id+'-qr.png';a.click();
        };
        controls.append(share,save);box.append(controls);
      }catch(_){
        box.append(make('p',t('QR unavailable; use the six-digit code.',
          'QR उपलब्ध नहीं है; छह अंकों का कोड प्रयोग करें.'),'delivery-code-warning'));
      }
      if(delivery.code_expires_at)box.append(make('p',t('Code valid until: ','कोड मान्य: ')+
        String(delivery.code_expires_at),'delivery-expiry'));
      section.append(box);
    }else if(active(status)){
      section.append(make('p',t('Handoff code is unavailable. Ask the admin to issue a fresh code and refresh.',
        'हैंडऑफ कोड उपलब्ध नहीं है। व्यवस्थापक से नया कोड लेकर रीफ़्रेश करें।'),'delivery-code-warning'));
    }else if(status==='created'){
      section.append(make('p',t('Your QR will appear when a delivery partner is assigned.',
        'डिलीवरी साथी नियुक्त होने पर QR यहाँ दिखाई देगा।'),'delivery-help'));
    }else{
      section.append(make('p',t('The handoff code is no longer active.',
        'हैंडऑफ कोड अब सक्रिय नहीं है।'),'delivery-help'));
    }
    return section;
  }
  window.EasyMandiHandoff={refresh,reset,renderFor, get error(){return lastError;}};
  window.addEventListener('customer-account-changed',reset);
})();
