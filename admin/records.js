/* Authenticated Easy Mandi records explorer: paginated; no password/token data. */
(()=>{
 'use strict';
 const id=name=>document.getElementById(name);
 const base='https://cserver.learnwithchampak.live/easymandi/api/admin-records.php';
 const session=window.AdminSession;
 const modes={
   customers:{title:'Customers',fields:[['ID','id'],['Name','name'],['Mobile','mobile'],['Email','email'],['Google','google_linked'],['Orders','order_count'],['Order value','order_total'],['Addresses','address_count'],['Created','created_at']]},
   orders:{title:'Orders',fields:[['Order ID','public_id'],['Customer','customer_name'],['Mobile','mobile'],['Total','total'],['Order status','status'],['Payment','payment_method'],['Payment status','payment_status'],['Delivery','delivery_status'],['Date','created_at']]},
   payments:{title:'Payments',fields:[['Order ID','public_id'],['Customer','customer_name'],['Mobile','mobile'],['Total','total'],['Method','method'],['Status','status'],['UPI ref','upi_reference'],['Receipt','has_receipt'],['Submitted','submitted_at'],['Verified','verified_at']]},
   partners:{title:'Delivery partners',fields:[['ID','id'],['Name','name'],['Mobile','mobile'],['Active','active'],['Assigned jobs','job_count'],['Delivered','delivered_count'],['Photo','has_photo'],['Registered','created_at']]}
 };
 let mode='customers',page=1,search='',pending=0,timeout;
 const message=(text,error=false)=>{id('recordsMessage').textContent=text;id('recordsMessage').className=error?'error':'hint';};
 const cell=(tr,value)=>{
   const td=document.createElement('td');
   td.textContent=String(value??'—');
   tr.append(td);
   return td;
 };
 const money=value=>'₹'+Number(value||0).toFixed(2);
 const format=(name,value)=>{
   if(name==='order_total'||name==='total')return money(value);
   if(['google_linked','has_photo','has_receipt','active'].includes(name))return Number(value)?'Yes':'No';
   if(value===null||value==='')return '—';
   return String(value);
 };
 async function post(payload){
   if(!session.token)throw Error('Sign in as administrator to view private records.');
   const response=await AppHttp.fetch(base,{
     method:'POST',cache:'no-store',
     headers:{'Content-Type':'application/json',...session.headers()},
     body:JSON.stringify(payload)
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'Could not load records.');
   return result;
 }
 function clear(){
   pending++;
   id('recordsBody').replaceChildren();
   id('recordsDetail').hidden=true;
   id('recordsSummary').textContent='';
   id('recordsPrevious').disabled=true;
   id('recordsNext').disabled=true;
   id('recordsUnlock').hidden=false;
   id('recordsControls').hidden=true;
 }
 async function reload(){
   if(!session.token){clear();message('Administrator login required.');return;}
   const request=++pending;
   id('recordsControls').hidden=false;
   id('recordsUnlock').hidden=true;
   id('recordsPrevious').disabled=true;
   id('recordsNext').disabled=true;
   message('Loading '+modes[mode].title.toLowerCase()+'…');
   try{
     const result=await post({view:mode,page,search});
     if(request!==pending||!session.token)return;
     const {rows=[],total=0,pageSize=25}=result;
     const table=document.createElement('table');
     table.className='product-grid';
     table.id='recordsTable';
     const head=document.createElement('thead'),headRow=document.createElement('tr');
     for(const [label] of modes[mode].fields){const th=document.createElement('th');th.scope='col';th.textContent=label;headRow.append(th);}
     if(mode==='customers'){const th=document.createElement('th');th.scope='col';th.textContent='Actions';headRow.append(th);}
     head.append(headRow);table.append(head);
     const body=document.createElement('tbody');
     for(const row of rows){
       const tr=document.createElement('tr');
       for(const [,field] of modes[mode].fields)cell(tr,format(field,row[field]));
       if(mode==='customers'){
         const action=document.createElement('td');
         const details=document.createElement('button');details.className='btn secondary';details.type='button';details.textContent='View details';
         details.onclick=()=>customerDetail(Number(row.id));
         const orders=document.createElement('button');orders.className='btn secondary';orders.type='button';orders.textContent='View orders';
         orders.onclick=()=>{mode='orders';page=1;search=String(row.mobile);id('recordsView').value=mode;id('recordsSearch').value=search;reload();};
         action.append(details,document.createTextNode(' '),orders);tr.append(action);
       }
       body.append(tr);
     }
     table.append(body);
     id('recordsBody').replaceChildren(table);
     const start=total?(page-1)*pageSize+1:0,end=Math.min(total,page*pageSize);
     id('recordsSummary').textContent=total+' '+modes[mode].title.toLowerCase()+' · '+start+'–'+end+' · page '+page;
     id('recordsPrevious').disabled=page<=1;
     id('recordsNext').disabled=end>=total;
     if(!rows.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='No matching records.';id('recordsBody').append(empty);}
     message('Records loaded. Details are visible only in an active administrator session.');
   }catch(error){
     if(request===pending){
       message(error.message||'Could not fetch records.',true);
       id('recordsSummary').textContent='';
       id('recordsBody').replaceChildren();
       if(!session.token)clear();
     }
   }
 }
 async function customerDetail(customerId){
   if(!session.token)return;
   const current=++pending;
   message('Loading customer details…');
   try{
     const data=await post({view:'customer-detail',customerId});
     if(current!==pending||!session.token)return;
     const box=id('recordsDetail');
     box.replaceChildren();box.hidden=false;
     const title=document.createElement('h3');
     title.textContent='Customer · '+data.customer.name+' · '+data.customer.mobile;
     box.append(title);
     const email=document.createElement('p');email.textContent='Email: '+(data.customer.email||'Not provided')+' · Joined: '+data.customer.created_at;
     box.append(email);
     const addresses=document.createElement('h4');addresses.textContent='Saved addresses ('+data.addresses.length+')';box.append(addresses);
     if(data.addresses.length){
       const list=document.createElement('ul');
       for(const a of data.addresses){const li=document.createElement('li');li.textContent=[a.name,a.phone,a.house,a.locality,a.landmark,a.pin].filter(Boolean).join(' · ');list.append(li);}
       box.append(list);
     }else {const p=document.createElement('p');p.textContent='No saved addresses.';box.append(p);}
     const orders=document.createElement('h4');orders.textContent='Orders ('+data.orderCount+' total, latest '+data.orders.length+' below)';box.append(orders);
     const list=document.createElement('ul');
     for(const o of data.orders){const li=document.createElement('li');li.textContent=[o.public_id,o.created_at,o.status,money(o.total),'Payment: '+o.payment_method+'/'+o.payment_status,'Delivery: '+(o.delivery_status||'not assigned')].join(' · ');list.append(li);}
     if(data.orders.length)box.append(list);
     const all=document.createElement('button');all.className='btn secondary';all.type='button';all.textContent='Browse all orders for this customer';
     all.onclick=()=>{mode='orders';page=1;search=data.customer.mobile;id('recordsView').value=mode;id('recordsSearch').value=search;box.hidden=true;reload();};
     box.append(all);box.scrollIntoView({behavior:'smooth',block:'start'});
     message('Customer record loaded.');
   }catch(error){message(error.message||'Could not load customer details.',true);}
 }
 id('recordsUnlock').onclick=async()=>{try{if(!session.token)await window.AdminAccess.ensure();if(session.token)await reload();}catch(error){message(error.message||'Administrator login required.',true);}};
 id('recordsRefresh').onclick=reload;
 id('recordsView').onchange=value=>{mode=id('recordsView').value;page=1;search=id('recordsSearch').value.trim();id('recordsDetail').hidden=true;reload();};
 id('recordsSearch').oninput=()=>{clearTimeout(timeout);timeout=setTimeout(()=>{search=id('recordsSearch').value.trim();page=1;id('recordsDetail').hidden=true;reload();},350);};
 id('recordsPrevious').onclick=()=>{if(page>1){page--;reload();}};
 id('recordsNext').onclick=()=>{page++;reload();};
 window.addEventListener('admin-session-started',reload);
 window.addEventListener('admin-session-ended',()=>{clear();message('Admin session ended. Sign in again to view customer and payment data.');});
 if(session.token)reload();
})();
