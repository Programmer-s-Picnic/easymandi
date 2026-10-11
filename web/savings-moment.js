/* A short, accessible savings moment after the server confirms the order. */
(()=>{
 'use strict';
 const cash=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(value);
 function flash(value,host){
   const amount=Number(value);
   if(!Number.isFinite(amount)||amount<=0||!host)return Promise.resolve();
   const old=host.querySelector('.savings-moment');
   old?.remove();
   const moment=document.createElement('div');
   moment.className='savings-moment';
   moment.setAttribute('role','status');
   moment.setAttribute('aria-live','polite');
   const card=document.createElement('div');
   card.className='savings-moment-card';
   const spark=document.createElement('span');spark.className='savings-moment-symbol';spark.textContent='✧';spark.setAttribute('aria-hidden','true');
   const heading=document.createElement('span');
   heading.textContent=window.EMI18n?.lang==='hi'?'आपकी मंडी बचत':'A little extra value';
   const total=document.createElement('strong');total.textContent=cash(amount);
   const caption=document.createElement('span');
   caption.textContent=window.EMI18n?.lang==='hi'?'इस ऑर्डर में बचाए':'Saved on this order';
   card.append(spark,heading,total,caption);moment.append(card);host.append(moment);
   return new Promise(resolve=>setTimeout(()=>{moment.remove();resolve();},1400));
 }
 window.EasyMandiSavings=Object.freeze({flash});
})();
