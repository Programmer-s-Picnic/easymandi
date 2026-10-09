/* Service areas loaded from the server, never from unrestricted text input. */
(()=>{
'use strict';
const endpoint='https://cserver.learnwithchampak.live/easymandi/api/localities.php';
const select=document.getElementById('locality'),map=document.getElementById('localityMap'),
      status=document.getElementById('serviceLocalityStatus');
if(!select)return;
let areas=[],ready=false;
const choose=(name)=>{
 const item=areas.find(v=>v.name.toLocaleLowerCase()===String(name||'').trim().toLocaleLowerCase());
 select.value=item?item.name:'';
 select.dispatchEvent(new Event('change',{bubbles:true}));
 return !!item;
};
const current=()=>areas.find(v=>v.name===select.value);
const syncMap=()=>{
 const match=current();
 map.href=match?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(match.mapQuery||match.name+', Varanasi, India'):'#';
 map.setAttribute('aria-disabled',String(!match));
 map.tabIndex=match?0:-1;
 status.textContent=!ready?'Loading service areas…':match?'Service available in '+match.name+'.':'Choose one of our delivery localities in Varanasi.';
};
select.addEventListener('change',syncMap);
map.addEventListener('click',event=>{if(!current()){event.preventDefault();select.focus();}});
async function load(){
 ready=false;select.disabled=true;status.textContent='Loading delivery localities…';
 try{
  const response=await AppHttp.fetch(endpoint,{method:'GET',cache:'no-store'});
  const result=await response.json();
  if(!response.ok||!Array.isArray(result.localities))throw Error(result.error||'Localities unavailable');
  const old=select.value;
  areas=result.localities.filter(x=>typeof x.name==='string'&&typeof x.mapQuery==='string');
  select.replaceChildren();
  const prompt=document.createElement('option');prompt.value='';prompt.textContent='Select locality / क्षेत्र चुनें';
  select.append(prompt);
  for(const area of areas){
   const option=document.createElement('option');option.value=area.name;option.textContent=area.name;select.append(option);
  }
  ready=areas.length>0;select.disabled=!ready;
  if(old)choose(old);else syncMap();
  if(!ready)status.textContent='No delivery localities are enabled. Please try again later.';
 }catch(_){ready=false;areas=[];select.replaceChildren();
  const option=document.createElement('option');option.value='';option.textContent='Localities unavailable — retry later';
  select.append(option);select.disabled=true;
  status.textContent='Unable to load service areas. Orders are temporarily unavailable.';syncMap();
 }
}
window.EasyMandiLocalities=Object.freeze({
 get ready(){return ready;},
 get active(){return current();},
 valid:name=>ready&&areas.some(a=>a.name.toLocaleLowerCase()===String(name||'').trim().toLocaleLowerCase()),
 choose,refresh:load
});
// One-time test-cycle reset on this browser, independent from the preserved
// administrator session and current published product catalogue.
try{
 const marker='easy-mandi-testing-reset-20261009';
 if(localStorage.getItem(marker)!=='done'){
  for(const key of Object.keys(localStorage)){
   if(/^easy-mandi-(?:cart|favorites|guest-|last-customer-section)/.test(key))localStorage.removeItem(key);
  }
  sessionStorage.removeItem('easy-mandi-auth-token');
  sessionStorage.removeItem('easy-mandi-pending-order');
  localStorage.setItem(marker,'done');
 }
}catch(_){}
load();
})();
