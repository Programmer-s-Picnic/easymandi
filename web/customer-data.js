(() => {
 const by=id=>document.getElementById(id);let addresses=[],selected=null;
 const controls=document.createElement('section');controls.className='customer-address-book';
 const title=document.createElement('h3');title.textContent='Saved addresses';
 const select=document.createElement('select');select.setAttribute('aria-label','Choose saved address');
 const save=document.createElement('button');save.type='button';save.className='btn ghost';save.textContent='Save address to my account';
 const remove=document.createElement('button');remove.type='button';remove.className='btn ghost';remove.textContent='Delete saved address';
 const message=document.createElement('p');message.setAttribute('role','status');controls.append(title,select,save,remove,message);by('orderForm').prepend(controls);
 const history=document.createElement('section');history.className='panel';by('products').before(history);
 function render(){
  controls.hidden=!window.CustomerAccount?.user;history.replaceChildren();select.replaceChildren();
  const blank=document.createElement('option');blank.value='';blank.textContent='Use a new address';select.append(blank);
  for(const a of addresses){const o=document.createElement('option');o.value=a.id;o.textContent=a.house+', '+a.locality+' · '+a.pin;select.append(o);}select.value=selected||'';remove.hidden=!selected;
 }
 async function refresh(){
  const user=window.CustomerAccount?.user;addresses=[];selected=null;render();if(!user)return;
  try{const result=await window.CustomerAccount.request('customer-data',{authorized:true});if(window.CustomerAccount.user?.id!==user.id)return;addresses=result.addresses;render();
   const heading=document.createElement('h2');heading.textContent='Previously ordered items';history.append(heading);
   if(!result.items.length){const p=document.createElement('p');p.textContent='Your ordered items will appear here.';history.append(p);}
   for(const item of result.items){const current=data?.products.find(p=>p.id===item.product_id);const button=document.createElement('button');button.type='button';button.className='btn ghost';button.textContent=item.name+' · '+(current?'₹'+Number(current.price).toFixed(2):'Unavailable');button.disabled=!current?.available;button.onclick=()=>change(item.product_id,1);history.append(button);}
  }catch(e){message.textContent=e.message||'Could not load saved addresses.';}
 }
 select.onchange=()=>{selected=select.value?Number(select.value):null;remove.hidden=!selected;const a=addresses.find(a=>Number(a.id)===selected);if(a){const form=by('orderForm');for(const key of ['name','house','locality','landmark','pin'])form.elements[key].value=a[key];form.elements.phone.value=a.phone;deliveryLocation=null;by('locationStatus').textContent='Optional map pin for accurate delivery.';}};
 async function mutate(payload,text){save.disabled=remove.disabled=true;try{await window.CustomerAccount.request('customer-data',{method:'POST',authorized:true,payload});message.textContent=text;await refresh();}catch(e){message.textContent=e.message;}finally{save.disabled=remove.disabled=false;}}
 save.onclick=()=>{const form=by('orderForm');const payload={operation:'save',...(selected?{id:selected}:{})};for(const key of ['name','house','locality','landmark','pin'])payload[key]=form.elements[key].value.trim();payload.phone=form.elements.phone.value.trim();mutate(payload,'Address saved to your account.');};
 remove.onclick=()=>{if(selected&&confirm('Delete this saved address from your account?'))mutate({operation:'delete',id:selected},'Address deleted.');};
 window.addEventListener('customer-account-changed',refresh);window.addEventListener('customer-order-placed',refresh);by('basketButton').addEventListener('click',refresh);refresh();
})();
