(()=>{
'use strict';
const $=id=>document.getElementById(id);
const root=$('opsDesk');if(!root)return;
const api='https://cserver.learnwithchampak.live/easymandi/api/';
const deliveryApi='https://cserver.learnwithchampak.live/delivery/api/?action=admin';
const state={orders:[],counts:{},partners:[],page:1,total:0,hasMore:false,selected:null,busy:false,filter:'new',search:'',timer:null,seq:0,loaded:false};
const label={new_orders:'New orders',payment:'UPI verification',packing:'Preparing',unassigned:'Unassigned',active:'In delivery',exceptions:'Exceptions',completed:'Completed',all_orders:'All orders'};
const rupees=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n)||0);
const date=raw=>{if(!raw)return '—';const value=String(raw),d=new Date(value.includes('T')?value:value.replace(' ','T')+'+05:30');return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(d)+' IST':value+' IST';};
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;};
const status=(o)=>o.delivery_status?o.status+' · '+o.delivery_status:o.status+' · awaiting delivery setup';
const show=(msg,isError=false)=>{$('opsMessage').textContent=msg;$('opsMessage').className=isError?'ops-error':'ops-success';};
async function call(url,data){
 const response=await AppHttp.fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...window.AdminSession.headers()},body:JSON.stringify(data),cache:'no-store'});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Could not complete the request.');
 return payload;
}
async function auth(){
 if(window.AdminSession.token)return true;
 await window.AdminAccess.ensure();
 return !!window.AdminSession.token;
}
const scrollSelected=()=>{const row=$('opsList').querySelector('[data-current="true"]');row?.scrollIntoView({block:'nearest'});};
function counts(){
 const targets=[['new_orders','new'],['payment','payment'],['packing','packing'],['unassigned','unassigned'],['active','active'],['exceptions','exceptions'],['completed','completed'],['all_orders','all']];
 $('opsKpis').replaceChildren();
 for(const [key,queue] of targets){
  const btn=make('button',undefined,'ops-kpi');btn.type='button';btn.dataset.active=String(queue===state.filter);
  btn.append(make('span',label[key]),make('strong',state.counts[key]??'—'));
  btn.onclick=()=>{state.filter=queue;$('opsQueue').value=queue;state.page=1;state.selected=null;load();};
  $('opsKpis').append(btn);
 }
}
function list(){
 const list=$('opsList');list.replaceChildren();
 $('opsCount').textContent=state.total+' matching orders';
 $('opsPage').textContent='Page '+state.page;
 $('opsPrev').disabled=state.page<=1||state.busy;
 $('opsNext').disabled=!state.hasMore||state.busy;
 if(!state.orders.length){list.append(make('p','No orders in this queue.','ops-empty'));return;}
 for(const order of state.orders){
  const card=make('button',undefined,'ops-order');card.type='button';card.dataset.orderId=order.public_id;
  card.dataset.current=String(order.public_id===state.selected);
  const head=make('span',undefined,'ops-order-head');
  head.append(make('strong','#'+order.public_id),make('strong',rupees(order.total)));
  card.append(head,make('span',order.customer_name+' · '+date(order.created_at),'ops-muted'),
    make('span',status(order),'ops-stage'));
  const action=order.payment_method==='upi'&&order.payment_status==='submitted'?'Receipt to verify':
   !order.delivery_id&&order.status!=='Cancelled'?'Not imported to delivery':
   order.delivery_status==='created'?'Needs a partner':'';
  if(action)card.append(make('span',action,'ops-attention'));
  card.onclick=()=>{state.selected=order.public_id;list.querySelectorAll('.ops-order').forEach(el=>el.dataset.current=String(el===card));detail();};
  list.append(card);
 }
}
function pair(container,key,value){
 const div=make('div',undefined,'ops-pair');div.append(make('span',key),make('strong',value??'—'));container.append(div);
}
function action(parent,title,handler,secondary=false){
 const button=make('button',title,'btn'+(secondary?' secondary':''));button.type='button';
 button.onclick=async()=>{
  if(state.busy)return;
  state.busy=true;button.disabled=true;show('Saving…');
  try{await handler();show(title+' completed.');await load(true);}
  catch(e){show(e.message||'Action failed.',true);}
  finally{state.busy=false;button.disabled=false;}
 };
 parent.append(button);
 return button;
}
function detail(){
 const target=$('opsDetail');target.replaceChildren();
 const o=state.orders.find(x=>x.public_id===state.selected);
 if(!o){$('opsDetailStatus').textContent='Select an order';target.append(make('p','Choose an order to begin processing.','ops-muted'));return;}
 $('opsDetailStatus').textContent=status(o);
 const h=make('section',undefined,'ops-detail-block');
 h.append(make('h4','Order #'+o.public_id));
 pair(h,'Customer',o.customer_name+' · '+o.mobile);
 pair(h,'Received',date(o.created_at));
 pair(h,'Address',[o.house,o.locality,o.landmark,o.city,o.state,o.pin].filter(Boolean).join(', '));
 if(o.customer_note)pair(h,'Customer note',o.customer_note);
 if(o.packer_note)pair(h,'Packer note',o.packer_note);
 if(o.partner_note)pair(h,'Partner note',o.partner_note);
 if(o.location_lat!=null&&o.location_lng!=null){
  const a=make('a','View delivery location');a.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(o.location_lat+','+o.location_lng);a.target='_blank';a.rel='noopener noreferrer';h.append(a);
 }
 target.append(h);
 const items=make('section',undefined,'ops-detail-block');items.append(make('h4','Items to pack'));
 const ul=make('ul',undefined,'ops-items');
 for(const item of o.items||[])ul.append(make('li',item.product_name+' · '+item.quantity+' '+item.unit+' — '+rupees(item.line_total)));
 items.append(ul);pair(items,'Subtotal',rupees(o.subtotal));pair(items,'Delivery fee',rupees(o.delivery_fee));pair(items,'Total',rupees(o.total));
 const packing=make('div',undefined,'ops-actions');
 action(packing,'Print packing checklist',async()=>{if(!window.EasyMandiPacking?.printSheet)throw Error('Packing tool unavailable. Use legacy orders below.');window.EasyMandiPacking.printSheet(o);},true);
 items.append(packing);
 if(window.EasyMandiPacking?.append){
  window.EasyMandiPacking.append(o,items,payload=>call(api+'admin-order-notes.php',payload));
 }
 target.append(items);
 const pay=make('section',undefined,'ops-detail-block');pay.append(make('h4','Payment'));
 pair(pay,'Payment',String(o.payment_method).toUpperCase()+' · '+o.payment_status);
 if(o.upi_reference)pair(pay,'UPI reference',o.upi_reference);
 const payactions=make('div',undefined,'ops-actions');
 if(o.payment_has_receipt)action(payactions,'Review receipt',async()=>{
  const data=await call(api+'admin-payment.php',{orderId:o.public_id,operation:'receipt'});
  if(!data.receipt)throw Error('No receipt returned.');
  const win=window.open('','_blank');if(!win)throw Error('Enable pop-ups to review the receipt.');
  const image=win.document.createElement('img');image.src=data.receipt;image.alt='UPI receipt';image.style.maxWidth='100%';win.document.body.append(image);
 },true);
 if(o.payment_method==='upi'&&o.payment_status==='submitted'){
  action(payactions,'Verify UPI',()=>call(api+'admin-payment.php',{orderId:o.public_id,operation:'verify'}));
  action(payactions,'Reject receipt',async()=>{if(confirm('Reject this submitted receipt?'))await call(api+'admin-payment.php',{orderId:o.public_id,operation:'reject'});},true);
 }
 if(o.payment_method==='cod'&&o.payment_status!=='paid'&&o.status!=='Cancelled')action(payactions,'Mark COD paid',async()=>{
  if(!confirm('Confirm that COD payment has actually been collected?'))return;
  await call(api+'admin-payment.php',{orderId:o.public_id,operation:'cod-paid'});
 });
 pay.append(payactions);target.append(pay);
 const workflow=make('section',undefined,'ops-detail-block');workflow.append(make('h4','Order processing'));
 const select=make('select');select.setAttribute('aria-label','Change order stage');
 for(const next of ['New','Confirmed','Preparing','Delivered','Cancelled']){
  const option=make('option',next);option.value=next;select.append(option);
 }
 select.value=o.status;workflow.append(select);
 const workActions=make('div',undefined,'ops-actions');
 action(workActions,'Save order status',async()=>{
  if(select.value===o.status)return;
  if(!confirm('Change this order to '+select.value+'?'))return;
  await call(api+'admin-order-status.php',{orderId:o.public_id,status:select.value});
 });
 workflow.append(workActions);target.append(workflow);
 const delivery=make('section',undefined,'ops-detail-block');delivery.append(make('h4','Delivery management'));
 pair(delivery,'Status',o.delivery_status||'Not imported');pair(delivery,'Partner',o.partner_name||'Unassigned');
 const deliveryActions=make('div',undefined,'ops-actions');
 if(!o.delivery_id&&o.status!=='Cancelled'&&o.status!=='Delivered'){
  action(deliveryActions,'Import for delivery',()=>call(deliveryApi,{operation:'import',source_app:'easymandi',external_order_id:o.public_id}));
 }
 if(o.delivery_id&&['created','assigned','picked_up','out_for_delivery'].includes(o.delivery_status)){
  const partner=make('select');partner.setAttribute('aria-label','Delivery partner');
  const blank=make('option','Choose delivery partner');blank.value='';partner.append(blank);
  for(const p of state.partners.filter(x=>Number(x.active)===1)){
   const option=make('option',p.name+' · '+p.mobile);option.value=p.id;partner.append(option);
  }
  partner.value=o.partner_id??'';delivery.append(partner);
  action(deliveryActions,o.partner_id?'Change delivery partner':'Assign delivery partner',async()=>{
   if(!partner.value)throw Error('Choose an active delivery partner.');
   if(o.partner_id&&String(o.partner_id)!==partner.value&&!confirm('Change delivery partner? A new handoff code will be sent.'))return;
   const result=await call(deliveryApi,{operation:'assign',id:Number(o.delivery_id),partner_id:Number(partner.value),previous_partner_id:Number(o.partner_id||0)});
   if(result.code)show('Assigned. Customer code: '+result.code+' · Share securely.'); 
  });
 }
 const link=make('a','Open advanced delivery admin');link.href='https://programmer-s-picnic.github.io/delivery-app/web/?order='+encodeURIComponent(o.public_id);link.target='_blank';link.rel='noopener noreferrer';deliveryActions.append(link);
 delivery.append(deliveryActions);target.append(delivery);
}
async function load(keepSelection=false){
 if(!window.AdminSession.token){$('opsSignIn').hidden=false;$('opsLastSync').textContent='Admin sign-in required';return;}
 const serial=++state.seq;
 const current=keepSelection?state.selected:null;
 $('opsSignIn').hidden=true;$('opsLastSync').textContent='Refreshing…';$('opsRefresh').disabled=true;
 try{
  const [data,delivery]=await Promise.all([
   call(api+'admin-operations.php',{queue:state.filter,search:state.search,page:state.page}),
   call(deliveryApi,{operation:'list'}).catch(()=>({partners:[]}))
  ]);
  if(serial!==state.seq||!window.AdminSession.token)return;
  Object.assign(state,{orders:data.orders,counts:data.counts,total:data.total,hasMore:data.hasMore,partners:delivery.partners||[],loaded:true});
  state.selected=current&&state.orders.some(o=>o.public_id===current)?current:(state.orders[0]?.public_id||null);
  $('opsLastSync').textContent='Updated '+new Intl.DateTimeFormat('en-IN',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}).format(new Date())+' IST';
  counts();list();detail();
 }catch(e){if(serial===state.seq){$('opsLastSync').textContent='Refresh failed';show(e.message,true);}}
 finally{$('opsRefresh').disabled=false;}
}
// In-context operator guide: queue links are actual filters, never placeholders.
const howTo=$('opsHowTo');
for(const button of howTo.querySelectorAll('[data-ops-guide-queue]')){
 button.addEventListener('click',()=>{
  const queue=button.dataset.opsGuideQueue;
  if(!['new','payment','packing','unassigned','active','exceptions','completed','all'].includes(queue))return;
  state.filter=queue;
  state.page=1;
  state.selected=null;
  state.search='';
  $('opsSearch').value='';
  $('opsQueue').value=queue;
  howTo.open=false;
  $('opsDesk').scrollIntoView({behavior:'smooth',block:'start'});
  if(!window.AdminSession.token){
   $('opsSignIn').focus();
   show('Unlock operations to open the '+button.textContent.trim().replace(/\s*→$/,'')+' queue.');
   return;
  }
  load();
 });
}
for(const anchor of document.querySelectorAll('a[href="#opsHowTo"]')){
 anchor.addEventListener('click',()=>{howTo.open=true;});
}

let searchTimer;
$('opsQueue').onchange=()=>{state.filter=$('opsQueue').value;state.page=1;state.selected=null;load();};
$('opsSearch').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=$('opsSearch').value.trim();state.page=1;load();},300);};
$('opsPrev').onclick=()=>{if(state.page>1){state.page--;load();}};
$('opsNext').onclick=()=>{if(state.hasMore){state.page++;load();}};
$('opsRefresh').onclick=()=>load(true);
$('opsSignIn').onclick=async()=>{try{await auth();await load();}catch(e){show(e.message,true);}};
window.addEventListener('admin-session-started',()=>load(true));
window.addEventListener('admin-session-ended',()=>{state.seq++;state.orders=[];state.partners=[];state.selected=null;$('opsList').replaceChildren();$('opsDetail').replaceChildren();$('opsSignIn').hidden=false;$('opsLastSync').textContent='Session expired; unlock to continue.';});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&window.AdminSession.token)load(true);});
setInterval(()=>{if(!document.hidden&&window.AdminSession.token&&!state.busy)load(true);},30000);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('opsSearch').focus();}});
if(window.AdminSession.token)load();
})();