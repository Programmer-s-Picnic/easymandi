/* Easy Mandi Walk-In Market
 * The existing web/index.html is the single source of truth for auth, cart,
 * orders, payment, locality validation, delivery QR and notifications.
 * The 3D layer only reads catalog and invokes existing customer UI actions.
 * Never writes orders with its own API or manufactures delivery QR codes.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id),frame=$('nativeStorefront');
const api='https://cserver.learnwithchampak.live/easymandi/api/catalog.php';
const archive='https://raw.githubusercontent.com/Programmer-s-Picnic/easymandidata/main/catalog/products.json';
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)||0);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let products=[],categories=['All'],catalogStatus='loading',currentCategory='All',catalogSource='';
let scene=null,stallOpen=false,nativeOpen=false,experienceOpen=false,directoryOpen=false,moreOpen=false,entered=false,directoryCategory='All',language='en',nativeLoaded=false,frameError='',toastTimer=null,queuedNative=null,readyCount=0;
const isTouchPhone=()=>window.matchMedia('(max-width:790px) and (pointer:coarse)').matches;
const mobilePrompt=$('mobilePrompt');
function dismissMobileHint(){mobilePrompt.hidden=true;try{sessionStorage.setItem('easy-mandi-3d-mobile-guided','1');}catch{}}
function showMobileHint(){try{if(isTouchPhone()&&sessionStorage.getItem('easy-mandi-3d-mobile-guided')!=='1'){mobilePrompt.hidden=false;return;}}catch{}mobilePrompt.hidden=true;}
showMobileHint();
try{language=localStorage.getItem('easy-mandi-language')==='hi'?'hi':'en';}catch{}
const name=p=>language==='hi'?(p.hindi||p.name):p.name;
const readCart=()=>{try{const c=JSON.parse(localStorage.getItem('easy-mandi-cart')||'{}');return c&&typeof c==='object'?c:{};}catch{return {};}};
const getCount=id=>Math.max(0,Number(readCart()[id])||0);
const totalCart=()=>products.reduce((sum,p)=>sum+getCount(p.id),0);
const priceInfo=p=>{const q=getCount(p.id),price=Number(p.price||0),m=p.mandi||{},threshold=Number(m.minimumQuantity),mandiPrice=Number(m.unitPrice);const reduced=m.enabled===true&&q>=threshold&&threshold>=2&&mandiPrice>0&&mandiPrice<price;return {qty:q,price:reduced?mandiPrice:price,saving:reduced?(price-mandiPrice)*q:0,enabled:!!m.enabled,threshold,mandiPrice};};
const subtotal=()=>products.reduce((s,p)=>s+(p.available?priceInfo(p).price*getCount(p.id):0),0);
function toast(s){const el=$('toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2700);}
function hideLoading(){if(!$('loading').classList.contains('done')){$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,500);if(!sessionStorage.getItem('easy-mandi-3d-visited')){setTimeout(()=>toast('The Easy Mandi gate is ahead — walk in with W / ▲ and explore the stocked stalls.'),550);sessionStorage.setItem('easy-mandi-3d-visited','yes');}}}
function status(text,error=false){const el=$('serverStatus');el.innerHTML='<span class="green-dot"></span>'+esc(text);el.classList.toggle('error',error);}
function frameDocument(){try{const d=frame.contentDocument;return d&&d.querySelector('#basketButton')?d:null;}catch{return null;}}
function nativeApi(){try{const w=frame.contentWindow;return w?.EasyMandiCatalog||null;}catch{return null;}}
function readyNative(){return !!(frameDocument()&&nativeApi()?.ready());}
function waitReady(fn,timeoutMs=18000){if(readyNative()){fn();return;}const start=Date.now();const h=setInterval(()=>{if(readyNative()){clearInterval(h);fn();}else if(Date.now()-start>timeoutMs){clearInterval(h);toast('Live shopping system is unavailable. Please retry.');$('nativeWait').textContent='The customer system did not respond. Try refreshing the shopping counter.';}},250);}
function modifyIframe(){const d=frameDocument();if(!d)return; if(d.getElementById('threeDFrameTweaks'))return;const style=d.createElement('style');style.id='threeDFrameTweaks';style.textContent='.hero,.app-downloads,.site-footer{display:none!important}body{background:#fffdf9!important}.wrap{padding-top:16px!important;max-width:100%!important}header{position:sticky;top:0;z-index:15!important}.customer-quick-nav{position:sticky;top:70px!important}.my-orders-panel{scroll-margin-top:130px}#shopCatalog{scroll-margin-top:150px}.grid{padding-bottom:36px}@media(max-width:640px){header{position:relative}.customer-quick-nav{position:relative;top:0}}';d.head.append(style);}
function frameAction(mode){const d=frameDocument();if(!d)return false;const el=id=>d.getElementById(id);modifyIframe();
try{
if(mode==='basket'){el('basketButton')?.click();}
else if(mode==='account'){el('accountButton')?.click();}
else if(mode==='orders'){el('myOrdersButton')?.click();el('myOrdersPanel')?.scrollIntoView({block:'start'});}
else if(mode==='previous'){const section=d.querySelector('.previously-purchased');if(section){section.scrollIntoView({block:'start'});}else{el('myOrdersButton')?.click();el('myOrdersPanel')?.scrollIntoView({block:'start'});}}
else if(mode==='favorites'){const b=el('favoritesFilter');if(b?.getAttribute('aria-pressed')!=='true')b?.click();el('shopCatalog')?.scrollIntoView({block:'start'});}
else if(mode==='notifications'){el('accountButton')?.click();d.querySelector('#accountProfile .notification-dock')?.scrollIntoView({block:'nearest'});}
else if(mode==='catalog'){const search=el('search');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}el('shopCatalog')?.scrollIntoView({block:'start'});}
else if(mode==='checkout'){el('basketButton')?.click();}
else if(mode==='search'){el('shopCatalog')?.scrollIntoView({block:'start'});el('search')?.focus();}
return true;
}catch(e){console.warn('Native counter action failed',e);return false;}}
function openNative(mode='catalog'){closeMore();closeDirectory();closeExperience();dismissMobileHint();closeStall(false);nativeOpen=true;queuedNative=mode;$('nativePanel').inert=false;$('nativePanel').classList.add('open');$('nativePanel').setAttribute('aria-hidden','false');$('overlay').hidden=false;document.body.classList.add('counter-open');$('nativeTitle').textContent=({basket:'Your real basket & checkout',orders:'My real orders & deliveries',account:'Your Easy Mandi account',previous:'Reorder previous purchases',notifications:'Your customer notifications',favorites:'Saved favorites',catalog:'The fresh product market',checkout:'Checkout'}[mode]||'Easy Mandi service counter');
syncDock();waitReady(()=>{modifyIframe();$('nativeWait').hidden=true;if(queuedNative===mode)frameAction(mode);refreshTotals();});}
function closeNative(){nativeOpen=false;queuedNative=null;$('nativePanel').inert=true;$('nativePanel').classList.remove('open');$('nativePanel').setAttribute('aria-hidden','true');$('overlay').hidden=true;document.body.classList.remove('counter-open');refreshTotals();if(stallOpen)renderStall();syncDock();}
function closeStall(restore=true){stallOpen=false;$('stallPanel').inert=true;$('stallPanel').classList.remove('open');$('stallPanel').setAttribute('aria-hidden','true');if(restore&&!nativeOpen)$('overlay').hidden=true;}
function openStall(category='All'){markEntered();closeMore();closeDirectory();closeExperience();dismissMobileHint();closeNative();stallOpen=true;currentCategory=category||'All';$('stallPanel').inert=false;$('stallPanel').classList.add('open');$('stallPanel').setAttribute('aria-hidden','false');$('overlay').hidden=false;$('stallSearch').value='';renderStall();syncDock();if(!isTouchPhone())$('stallSearch').focus();}
function validImage(p){const raw=String(p?.imageUrl||p?.image||'');try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname?raw:'';}catch{return '';}}
function localCard(p){const q=priceInfo(p),cmp=Number(p.compareAtPrice),img=validImage(p);return '<article class="stall-item"><div class="stall-item-art">'+(img?'<img src="'+esc(img)+'" loading="lazy" alt="'+esc(p.name)+'">':'<span>'+esc(p.emoji||'🥬')+'</span>')+'</div><div><h3>'+esc(name(p))+'</h3><p>'+esc(p.unit||'unit')+' · '+esc(language==='hi'?p.name:(p.hindi||p.category||''))+'</p><strong>'+money(q.price)+'</strong>'+(cmp>q.price?'<del>'+money(cmp)+'</del>':'')+(q.enabled&&Number.isFinite(q.mandiPrice)?'<div class="mandi-price">'+(q.qty>=q.threshold?'✓ Mandi price active':'🏷 Mandi rate '+money(q.mandiPrice)+' from '+q.threshold+' units')+'</div>':'')+'</div><div>'+(p.available?(q.qty?'<div class="counter"><button data-qty="'+esc(p.id)+'" data-delta="-1" aria-label="Remove one '+esc(p.name)+'">−</button><span>'+q.qty+'</span><button data-qty="'+esc(p.id)+'" data-delta="1" aria-label="Add one '+esc(p.name)+'">+</button></div>':'<button class="stall-add" data-qty="'+esc(p.id)+'" data-delta="1" aria-label="Add '+esc(p.name)+'">＋</button>'):'<small>Sold out</small>')+'</div></article>';}
function renderStall(){const title=currentCategory==='All'?(language==='hi'?'सारी मंडी':'Entire marketplace'):currentCategory;$('stallTitle').textContent=title;const search=$('stallSearch').value.toLocaleLowerCase().trim();const items=products.filter(p=>(currentCategory==='All'||p.category===currentCategory)&&(search.length===0||[p.name,p.hindi,p.category,p.description,Array.isArray(p.searchWords)?p.searchWords.join(' '):p.searchWords,Array.isArray(p.keywords)?p.keywords.join(' '):p.keywords].join(' ').toLocaleLowerCase().includes(search)));$('stallMeta').textContent=items.length+' products · '+(catalogSource==='live'?'Live public catalog':'Catalog snapshot')+' · '+'All additions use the official Easy Mandi basket';$('stallItems').innerHTML=items.length?items.map(localCard).join(''):'<p style="text-align:center;padding:40px 12px;color:#879c8d">No products match your search.</p>';refreshTotals();}
function refreshTotals(){
 const cart=readCart(),count=Object.entries(cart).reduce((x,[,q])=>x+Math.max(0,Number(q)||0),0);
 $('cartCount').textContent=String(count);
 $('dockCartCount').textContent=String(count);
 $('directoryCartCount').textContent=String(count);
 $('subtotal').textContent=money(subtotal());
 $('dockBasket').setAttribute('aria-label',count?'Open basket with '+count+' items':'Open empty basket');
}
function changeProduct(id,delta){const api=nativeApi(),p=products.find(x=>String(x.id)===String(id));if(!p||!p.available){toast('Product unavailable');return;}if(!api?.ready()){toast('Waiting for official Easy Mandi cart…');openNative('catalog');return;}const real=api.getProduct(id);if(!real||!real.available){toast('Product not currently available at the official shop.');return;}const card=api.createCard(real);const buttons=[...card.querySelectorAll('.step button')];const b=buttons.find(x=>x.textContent.trim()===(delta>0?'+':'−'));if(!b||b.disabled){toast('Quantity cannot be changed');return;}try{b.click();refreshTotals();if(stallOpen)renderStall();if(directoryOpen)renderDirectory();toast((delta>0?'Added to':'Removed from')+' your real basket · '+name(p));}catch(e){toast('Could not update the official basket');console.warn(e);}}
async function loadCatalog(){status('Loading fresh catalog…');let data;try{const r=await fetch(api+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();if(!Array.isArray(data.products)||!data.store)throw Error('Invalid catalog');catalogSource='live';}catch(e){try{const r=await fetch(archive+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('snapshot unavailable');data=await r.json();catalogSource='snapshot';}catch{try{data=JSON.parse(localStorage.getItem('easy-mandi-catalog')||'null');if(!data?.products)throw Error('no cache');catalogSource='cached';}catch{data={products:[],categories:['All']};catalogSource='unavailable';}}}
products=Array.isArray(data.products)?data.products.filter(p=>p&&p.id!=null&&p.name).map(p=>({...p,id:String(p.id)})):[];categories=['All',...new Set(products.map(p=>p.category||'Other'))];if(products.length){status(catalogSource==='live'?'Live prices':'Catalog snapshot',catalogSource!=='live');}else status('Catalog offline',true);if(scene?.rebuild)scene.rebuild(categories,products);refreshTotals();if(stallOpen)renderStall();if(directoryOpen)renderDirectory();}
function translations(){document.querySelectorAll('[data-en]').forEach(el=>el.textContent=language==='hi'?el.dataset.hi:el.dataset.en);$('languageButton').textContent=language==='en'?'हिन्दी / EN':'EN / हिंदी';if(stallOpen)renderStall();if(directoryOpen)renderDirectory();if(scene?.language)scene.language(language);try{if(frame.contentWindow?.EMI18n&&frame.contentWindow.EMI18n.lang!==language){const lang=frame.contentDocument.getElementById('siteLanguage');if(lang){lang.value=language;lang.dispatchEvent(new Event('change',{bubbles:true}));}}}catch{}}
function onSceneReady(apiScene){$('noWebGL').hidden=true;scene=apiScene;if(scene?.rebuild)scene.rebuild(categories,products);scene?.setQuality?.($('qualitySelect').value);scene?.setCrowd?.($('crowdToggle').checked);syncExperienceInfo();hideLoading();translations();showMobileHint();}
window.EMWalk=Object.freeze({
sceneReady:onSceneReady,
dismissMobileHint,
stallSelect:category=>openStall(category),
near:stall=>{if(stallOpen||nativeOpen)return;$('nearStall').hidden=!stall;if(stall){$('nearIcon').textContent=stall.emoji||'🥬';$('nearName').textContent=stall.category||'All';$('shopStall').dataset.category=stall.category||'All';}},
get active(){return !stallOpen&&!nativeOpen&&!directoryOpen&&!moreOpen&&!experienceOpen&&!$('welcome').open;},
failedWebGL:()=>{$('noWebGL').hidden=false;hideLoading();},
getCatalog:()=>({categories,products}),
toast
});


/* UX V3: guided entry, shopping directory and one-tap direct stall access. */
function markEntered(){
 if(entered)return;
 entered=true;document.body.classList.add('has-entered');$('introActions').hidden=true;
 $('marketLocation').hidden=false;
}
function syncDock(){
 const active=directoryOpen?'dockStalls':nativeOpen&&queuedNative==='basket'?'dockBasket':'dockExplore';
 for(const id of ['dockExplore','dockStalls','dockBasket','dockMore']){
  const el=$(id),on=id===(moreOpen?'dockMore':active);
  el.classList.toggle('active',on);
  if(on)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
 }
 $('dockMore').setAttribute('aria-expanded',String(moreOpen));
}
function closeMore(){
 moreOpen=false;$('morePanel').hidden=true;$('morePanel').inert=true;syncDock();
}
function toggleMore(){
 if(moreOpen){closeMore();return;}
 if(directoryOpen)closeDirectory();
 closeExperience();moreOpen=true;$('morePanel').inert=false;$('morePanel').hidden=false;syncDock();
}
function closeDirectory(){
 if(!directoryOpen)return;
 directoryOpen=false;$('directoryPanel').classList.remove('open');
 $('directoryPanel').setAttribute('aria-hidden','true');$('directoryPanel').inert=true;
 if(!nativeOpen&&!stallOpen)$('overlay').hidden=true;
 syncDock();
}
function openDirectory(){
 markEntered();dismissMobileHint();closeMore();closeExperience();
 closeStall(false);closeNative();
 directoryOpen=true;directoryCategory='All';
 $('directoryPanel').classList.add('open');$('directoryPanel').inert=false;
 $('directoryPanel').setAttribute('aria-hidden','false');$('overlay').hidden=false;
 $('directorySearch').value='';
 renderDirectory();syncDock();
 // Focus the dialog heading/close, not the search box: avoid opening the
 // mobile keyboard before shoppers intend to search.
 $('closeDirectory').focus({preventScroll:true});
}
function productTerms(p){return [
 p.name,p.hindi,p.category,p.description,p.unit,
 Array.isArray(p.searchWords)?p.searchWords.join(' '):p.searchWords,
 Array.isArray(p.keywords)?p.keywords.join(' '):p.keywords
].join(' ').toLocaleLowerCase();}
function renderDirectory(){
 const all=products.filter(p=>p.available!==false);
 const search=$('directorySearch').value.trim().toLocaleLowerCase();
 const cats=['All',...new Set(all.map(p=>p.category||'Other'))];
 if(!cats.includes(directoryCategory))directoryCategory='All';
 $('directoryTabs').innerHTML=cats.map(cat=>'<button type="button" data-directory-cat="'+esc(cat)+'" class="'+(cat===directoryCategory?'active':'')+'">'+esc(cat==='All'?(language==='hi'?'सभी':'All'):cat)+'</button>').join('');
 const filtered=all.filter(p=>(directoryCategory==='All'||(p.category||'Other')===directoryCategory)&&(!search||productTerms(p).includes(search)));
 const makeProduct=p=>{
  const q=priceInfo(p),img=validImage(p),compare=Number(p.compareAtPrice);
  const visual=img?'<img src="'+esc(img)+'" loading="lazy" alt="'+esc(p.name)+'">':esc(p.emoji||'🥬');
  const control=q.qty?'<div class="mini-counter"><button type="button" data-directory-qty="'+esc(p.id)+'" data-delta="-1" aria-label="Remove one '+esc(p.name)+'">−</button><span>'+q.qty+'</span><button type="button" data-directory-qty="'+esc(p.id)+'" data-delta="1" aria-label="Add one '+esc(p.name)+'">+</button></div>':
  '<button type="button" data-directory-qty="'+esc(p.id)+'" data-delta="1" aria-label="Add '+esc(p.name)+'">+</button>';
  return '<article class="directory-product"><div class="image">'+visual+'</div><div class="details"><strong>'+esc(name(p))+'</strong><small>'+esc(p.unit||'unit')+' · '+esc(p.category||'Other')+'</small><b>'+money(q.price)+'</b>'+(Number.isFinite(compare)&&compare>q.price?'<del>'+money(compare)+'</del>':'')+'</div>'+control+'</article>';
 };
 let html='';
 if(!search&&directoryCategory==='All'){
  html+='<div class="directory-section-label">'+(language==='hi'?'दुकान चुनें':'Choose a stall')+'</div>';
  for(const cat of cats.filter(c=>c!=='All')){
   const stock=all.filter(p=>p.category===cat);
   if(!stock.length)continue;
   html+='<button type="button" class="directory-stall" data-shop-cat="'+esc(cat)+'" aria-label="Shop '+esc(cat)+'"><span class="visual">'+stock.slice(0,2).map(p=>esc(p.emoji||'🥬')).join('')+'</span><span class="text"><strong>'+esc(cat)+'</strong><small>'+stock.length+' '+(language==='hi'?'उत्पाद':'fresh products')+' · '+(language==='hi'?'दुकान खोलें':'Shop now')+'</small></span><span class="arrow" aria-hidden="true">↗</span></button>';
  }
  html+='<div class="directory-section-label">'+(language==='hi'?'सभी सामान':'Shop individual items')+'</div>';
 }
 if(filtered.length)html+=filtered.slice(0,80).map(makeProduct).join('');
 else html+='<div class="directory-empty">🌿<p>'+(language==='hi'?'सामान नहीं मिला। दूसरी खोज करें।':'No items found. Try a different name or category.')+'</p><button class="intro-secondary" type="button" id="resetDirectorySearch">Show all</button></div>';
 $('directoryResults').innerHTML=html;
}
function updateLocation(text){
 $('locationText').textContent=text;
 $('marketLocation').hidden=false;
}
function enterNow(){
 markEntered();closeDirectory();closeMore();
 updateLocation(language==='hi'?'मंडी में प्रवेश':'Walking into Easy Mandi');
 if(scene?.enterMarket)scene.enterMarket();else toast('Use W or the joystick to walk into the market');
 syncDock();
}
function viewCategory(category){
 markEntered();closeDirectory();closeStall();
 scene?.focusCategory?.(category);
 updateLocation(category);
}
$('enterNowButton').addEventListener('click',enterNow);
$('chooseStallButton').addEventListener('click',openDirectory);
$('topBrowseButton').addEventListener('click',openDirectory);
$('dockExplore').addEventListener('click',()=>{markEntered();closeDirectory();closeMore();closeStall();closeNative();updateLocation(language==='hi'?'मंडी की सैर':'Explore the marketplace');syncDock();});
$('dockStalls').addEventListener('click',openDirectory);
$('dockBasket').addEventListener('click',()=>openNative('basket'));
$('dockMore').addEventListener('click',toggleMore);
$('directoryToBasket').addEventListener('click',()=>openNative('basket'));
$('closeDirectory').addEventListener('click',closeDirectory);
$('clearDirectorySearch').addEventListener('click',()=>{$('directorySearch').value='';renderDirectory();$('directorySearch').focus();});
$('directorySearch').addEventListener('input',()=>{renderDirectory();});
$('directoryTabs').addEventListener('click',e=>{
 const btn=e.target.closest('[data-directory-cat]');
 if(btn){directoryCategory=btn.dataset.directoryCat;renderDirectory();}
});
$('directoryResults').addEventListener('click',e=>{
 const quantity=e.target.closest('[data-directory-qty]');
 if(quantity){changeProduct(quantity.dataset.directoryQty,Number(quantity.dataset.delta));return;}
 const stall=e.target.closest('[data-shop-cat]');
 if(stall){const cat=stall.dataset.shopCat;scene?.focusCategory?.(cat);openStall(cat);updateLocation(cat);return;}
 if(e.target.closest('#resetDirectorySearch')){$('directorySearch').value='';directoryCategory='All';renderDirectory();}
});
$('walkToStall').addEventListener('click',()=>viewCategory(currentCategory));
$('morePanel').inert=true;
$('directoryPanel').inert=true;
$('nativePanel').inert=true;
$('stallPanel').inert=true;
$('morePanel').addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.dataset.native){closeMore();return;} // document data-native handler acts
 switch(button.id){
 case'moreGoEntrance':closeMore();markEntered();scene?.reset?.();updateLocation(language==='hi'?'मंडी का प्रवेश':'Market gate');break;
 case'moreSettings':closeMore();$('experienceButton').click();break;
 case'moreHelp':closeMore();$('helpButton').click();break;
 }
});
window.EMWalkUX={markEntered,updateLocation};

/* Quality and crowd settings remain local to this preview browser. */
function readQuality(){try{return localStorage.getItem('easy-mandi-3d-quality-v2')||'auto';}catch{return 'auto';}}
function readCrowd(){try{return localStorage.getItem('easy-mandi-3d-crowd-v2')!=='off';}catch{return true;}}
$('qualitySelect').value=['auto','battery','high'].includes(readQuality())?readQuality():'auto';
$('crowdToggle').checked=readCrowd();
$('soundToggle').checked=false; // never start audio without an explicit gesture
function syncExperienceInfo(){
 const v=scene?.getCrowdState?.();
 $('experienceInfo').textContent=v
  ?'Simulated shoppers: '+v.shoppersVisible+' · Animated vendors: '+v.vendors+'. The existing Easy Mandi checkout remains unchanged.'
  :'3D market settings will apply when the scene is ready.';
}
function closeExperience(){
 experienceOpen=false;$('experiencePanel').hidden=true;
 $('experienceButton').setAttribute('aria-expanded','false');
}
$('experienceButton').addEventListener('click',()=>{
 experienceOpen=!experienceOpen;
 $('experiencePanel').hidden=!experienceOpen;
 $('experienceButton').setAttribute('aria-expanded',String(experienceOpen));
 if(experienceOpen){dismissMobileHint();syncExperienceInfo();}
});
$('closeExperience').addEventListener('click',closeExperience);
$('qualitySelect').addEventListener('change',e=>{
 const quality=e.target.value;
 try{localStorage.setItem('easy-mandi-3d-quality-v2',quality);}catch{}
 scene?.setQuality?.(quality);syncExperienceInfo();
});
$('crowdToggle').addEventListener('change',e=>{
 const enabled=e.target.checked;
 try{localStorage.setItem('easy-mandi-3d-crowd-v2',enabled?'on':'off');}catch{}
 scene?.setCrowd?.(enabled);syncExperienceInfo();
});
/* User-enabled, low-volume, generated ambience. No audio files, microphone,
   autoplay, customer recordings or spoken user data. */
function makeAmbience(){
 let audio=null,wind=null,timer=null;
 function chirp(){
  if(!audio||document.hidden||audio.state!=='running')return;
  try{
   const now=audio.currentTime,osc=audio.createOscillator(),vol=audio.createGain();
   osc.type='sine';
   osc.frequency.setValueAtTime(740,now);
   osc.frequency.exponentialRampToValueAtTime(1020,now+.11);
   osc.frequency.exponentialRampToValueAtTime(650,now+.32);
   vol.gain.setValueAtTime(.0001,now);
   vol.gain.exponentialRampToValueAtTime(.018,now+.045);
   vol.gain.exponentialRampToValueAtTime(.0001,now+.34);
   osc.connect(vol).connect(audio.destination);
   osc.start(now);osc.stop(now+.36);
  }catch{}
 }
 async function start(){
  if(!audio){
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)throw Error('Sound is not supported in this browser');
   audio=new AC();
   const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),channel=buffer.getChannelData(0);
   for(let i=0;i<channel.length;i++)channel[i]=(Math.random()*2-1)*.7;
   const src=audio.createBufferSource();src.buffer=buffer;src.loop=true;
   const low=audio.createBiquadFilter();low.type='lowpass';low.frequency.value=290;
   wind=audio.createGain();wind.gain.value=.009;src.connect(low).connect(wind).connect(audio.destination);
   src.start();
  }
  await audio.resume();
  if(timer===null)timer=setInterval(chirp,9500);
 }
 function stop(){if(timer!==null){clearInterval(timer);timer=null;}if(audio)audio.suspend().catch(()=>{});}
 return {start,stop};
}
const ambience=makeAmbience();
$('soundToggle').addEventListener('change',async e=>{
 if(e.target.checked){
  try{await ambience.start();toast('Soft market ambience enabled');}
  catch{e.target.checked=false;toast('Audio is not available on this device');}
 }else ambience.stop();
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)ambience.stop();
 else if($('soundToggle').checked)ambience.start().catch(()=>{});
});

frame.addEventListener('load',()=>{nativeLoaded=true;modifyIframe();$('nativeWait').hidden=true;const w=frame.contentWindow;try{w.addEventListener('easy-mandi-catalog-rendered',refreshTotals);w.addEventListener('customer-account-changed',refreshTotals);}catch{}if(queuedNative){const mode=queuedNative;waitReady(()=>frameAction(mode));}refreshTotals();});
frame.addEventListener('error',()=>{frameError='Could not load customer system';$('nativeWait').hidden=false;$('nativeWait').textContent=frameError;});
document.querySelectorAll('[data-native]').forEach(el=>el.addEventListener('click',()=>openNative(el.dataset.native)));
$('basketButton').addEventListener('click',()=>openNative('basket'));
$('openBasketFromStall').addEventListener('click',()=>openNative('basket'));
$('nativeClose').addEventListener('click',closeNative);
$('closeStall').addEventListener('click',()=>closeStall());
$('nativeRefresh').addEventListener('click',()=>{frame.contentWindow?.location.reload();$('nativeWait').hidden=false;});
$('overlay').addEventListener('click',()=>{if(directoryOpen)closeDirectory();else if(nativeOpen)closeNative();else closeStall();});
$('stallSearch').addEventListener('input',renderStall);
// The header of the phone-sized product sheet is a swipe-down dismiss handle.
// Dragging product rows still scrolls normally, without closing the sheet.
let sheetDrag=null;
const sheetHeader=$('stallPanel').querySelector('.panel-heading');
sheetHeader.addEventListener('pointerdown',e=>{
 if(!isTouchPhone()||e.target.closest('button'))return;
 sheetDrag={id:e.pointerId,start:e.clientY};
 try{sheetHeader.setPointerCapture(e.pointerId);}catch{}
});
sheetHeader.addEventListener('pointerup',e=>{
 if(!sheetDrag||sheetDrag.id!==e.pointerId)return;
 const delta=e.clientY-sheetDrag.start;sheetDrag=null;
 if(delta>70)closeStall();
});
sheetHeader.addEventListener('pointercancel',()=>sheetDrag=null);
$('dismissMobilePrompt').addEventListener('click',dismissMobileHint);
$('stallItems').addEventListener('click',e=>{const btn=e.target.closest('[data-qty]');if(btn)changeProduct(btn.dataset.qty,Number(btn.dataset.delta));});
$('shopStall').addEventListener('click',()=>openStall($('shopStall').dataset.category||'All'));
$('languageButton').addEventListener('click',()=>{language=language==='en'?'hi':'en';try{localStorage.setItem('easy-mandi-language',language);}catch{}translations();});
$('resetButton').addEventListener('click',()=>scene?.reset());
$('helpButton').addEventListener('click',()=>{try{$('welcome').showModal();}catch{}});
$('fullscreenButton').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else $('app').requestFullscreen?.().catch(()=>toast('Fullscreen unavailable'));});
function dismiss(){try{$('welcome').close();}catch{}try{sessionStorage.setItem('easy-mandi-3d-visited','yes');}catch{}}
$('dismissWelcome').addEventListener('click',dismiss);$('enterMarket').addEventListener('click',()=>{dismiss();enterNow();});
$('openCounterWelcome').addEventListener('click',()=>{dismiss();openDirectory();});
$('welcome').addEventListener('cancel',()=>{try{sessionStorage.setItem('easy-mandi-3d-visited','yes');}catch{}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(experienceOpen)closeExperience();else if(moreOpen)closeMore();else if(directoryOpen)closeDirectory();else if(nativeOpen)closeNative();else if(stallOpen)closeStall();}});
window.addEventListener('storage',e=>{if(e.key==='easy-mandi-cart'){refreshTotals();if(stallOpen)renderStall();}});
window.addEventListener('focus',refreshTotals);
setInterval(()=>{if(nativeLoaded){modifyIframe();refreshTotals();}if(stallOpen)renderStall();if(directoryOpen)renderDirectory();},5000);
setTimeout(()=>{if(!$('loading').classList.contains('done')){window.EMWalk.failedWebGL();}},13000);
translations();loadCatalog();
})();