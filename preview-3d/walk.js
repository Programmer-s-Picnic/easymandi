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
let scene=null,stallOpen=false,nativeOpen=false,language='en',nativeLoaded=false,frameError='',toastTimer=null,queuedNative=null,readyCount=0;
try{language=localStorage.getItem('easy-mandi-language')==='hi'?'hi':'en';}catch{}
const name=p=>language==='hi'?(p.hindi||p.name):p.name;
const readCart=()=>{try{const c=JSON.parse(localStorage.getItem('easy-mandi-cart')||'{}');return c&&typeof c==='object'?c:{};}catch{return {};}};
const getCount=id=>Math.max(0,Number(readCart()[id])||0);
const totalCart=()=>products.reduce((sum,p)=>sum+getCount(p.id),0);
const priceInfo=p=>{const q=getCount(p.id),price=Number(p.price||0),m=p.mandi||{},threshold=Number(m.minimumQuantity),mandiPrice=Number(m.unitPrice);const reduced=m.enabled===true&&q>=threshold&&threshold>=2&&mandiPrice>0&&mandiPrice<price;return {qty:q,price:reduced?mandiPrice:price,saving:reduced?(price-mandiPrice)*q:0,enabled:!!m.enabled,threshold,mandiPrice};};
const subtotal=()=>products.reduce((s,p)=>s+(p.available?priceInfo(p).price*getCount(p.id):0),0);
function toast(s){const el=$('toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2700);}
function hideLoading(){if(!$('loading').classList.contains('done')){$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,500);if(!sessionStorage.getItem('easy-mandi-3d-visited')){setTimeout(()=>{if(!$('welcome').open){try{$('welcome').showModal();}catch{}}},500);}}}
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
else if(mode==='notifications'){el('accountButton')?.click();}
else if(mode==='catalog'){const search=el('search');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}el('shopCatalog')?.scrollIntoView({block:'start'});}
else if(mode==='checkout'){el('basketButton')?.click();}
else if(mode==='search'){el('shopCatalog')?.scrollIntoView({block:'start'});el('search')?.focus();}
return true;
}catch(e){console.warn('Native counter action failed',e);return false;}}
function openNative(mode='catalog'){closeStall(false);nativeOpen=true;queuedNative=mode;$('nativePanel').classList.add('open');$('nativePanel').setAttribute('aria-hidden','false');$('overlay').hidden=false;document.body.classList.add('counter-open');$('nativeTitle').textContent=({basket:'Your real basket & checkout',orders:'My real orders & deliveries',account:'Your Easy Mandi account',previous:'Reorder previous purchases',notifications:'Your customer notifications',favorites:'Saved favorites',catalog:'The fresh product market',checkout:'Checkout'}[mode]||'Easy Mandi service counter');
waitReady(()=>{modifyIframe();$('nativeWait').hidden=true;if(queuedNative===mode)frameAction(mode);refreshTotals();});}
function closeNative(){nativeOpen=false;queuedNative=null;$('nativePanel').classList.remove('open');$('nativePanel').setAttribute('aria-hidden','true');$('overlay').hidden=true;document.body.classList.remove('counter-open');refreshTotals();renderStall();}
function closeStall(restore=true){stallOpen=false;$('stallPanel').classList.remove('open');$('stallPanel').setAttribute('aria-hidden','true');if(restore&&!nativeOpen)$('overlay').hidden=true;}
function openStall(category='All'){closeNative();stallOpen=true;currentCategory=category||'All';$('stallPanel').classList.add('open');$('stallPanel').setAttribute('aria-hidden','false');$('overlay').hidden=false;$('stallSearch').value='';renderStall();$('stallSearch').focus();}
function validImage(p){const raw=String(p?.imageUrl||p?.image||'');try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname?raw:'';}catch{return '';}}
function localCard(p){const q=priceInfo(p),cmp=Number(p.compareAtPrice),img=validImage(p);return '<article class="stall-item"><div class="stall-item-art">'+(img?'<img src="'+esc(img)+'" loading="lazy" alt="'+esc(p.name)+'">':'<span>'+esc(p.emoji||'🥬')+'</span>')+'</div><div><h3>'+esc(name(p))+'</h3><p>'+esc(p.unit||'unit')+' · '+esc(language==='hi'?p.name:(p.hindi||p.category||''))+'</p><strong>'+money(q.price)+'</strong>'+(cmp>q.price?'<del>'+money(cmp)+'</del>':'')+(q.enabled&&Number.isFinite(q.mandiPrice)?'<div class="mandi-price">'+(q.qty>=q.threshold?'✓ Mandi price active':'🏷 Mandi rate '+money(q.mandiPrice)+' from '+q.threshold+' units')+'</div>':'')+'</div><div>'+(p.available?(q.qty?'<div class="counter"><button data-qty="'+esc(p.id)+'" data-delta="-1" aria-label="Remove one '+esc(p.name)+'">−</button><span>'+q.qty+'</span><button data-qty="'+esc(p.id)+'" data-delta="1" aria-label="Add one '+esc(p.name)+'">+</button></div>':'<button class="stall-add" data-qty="'+esc(p.id)+'" data-delta="1" aria-label="Add '+esc(p.name)+'">＋</button>'):'<small>Sold out</small>')+'</div></article>';}
function renderStall(){const title=currentCategory==='All'?(language==='hi'?'सारी मंडी':'Entire marketplace'):currentCategory;$('stallTitle').textContent=title;const search=$('stallSearch').value.toLocaleLowerCase().trim();const items=products.filter(p=>(currentCategory==='All'||p.category===currentCategory)&&(search.length===0||[p.name,p.hindi,p.category,p.description,Array.isArray(p.searchWords)?p.searchWords.join(' '):p.searchWords,Array.isArray(p.keywords)?p.keywords.join(' '):p.keywords].join(' ').toLocaleLowerCase().includes(search)));$('stallMeta').textContent=items.length+' products · '+(catalogSource==='live'?'Live public catalog':'Catalog snapshot')+' · '+'All additions use the official Easy Mandi basket';$('stallItems').innerHTML=items.length?items.map(localCard).join(''):'<p style="text-align:center;padding:40px 12px;color:#879c8d">No products match your search.</p>';refreshTotals();}
function refreshTotals(){const cart=readCart();$('cartCount').textContent=Object.entries(cart).reduce((x,[,q])=>x+Math.max(0,Number(q)||0),0);$('subtotal').textContent=money(subtotal());}
function changeProduct(id,delta){const api=nativeApi(),p=products.find(x=>String(x.id)===String(id));if(!p||!p.available){toast('Product unavailable');return;}if(!api?.ready()){toast('Waiting for official Easy Mandi cart…');openNative('catalog');return;}const real=api.getProduct(id);if(!real||!real.available){toast('Product not currently available at the official shop.');return;}const card=api.createCard(real);const buttons=[...card.querySelectorAll('.step button')];const b=buttons.find(x=>x.textContent.trim()===(delta>0?'+':'−'));if(!b||b.disabled){toast('Quantity cannot be changed');return;}try{b.click();refreshTotals();renderStall();toast((delta>0?'Added to':'Removed from')+' your real basket · '+name(p));}catch(e){toast('Could not update the official basket');console.warn(e);}}
async function loadCatalog(){status('Loading fresh catalog…');let data;try{const r=await fetch(api+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();if(!Array.isArray(data.products)||!data.store)throw Error('Invalid catalog');catalogSource='live';}catch(e){try{const r=await fetch(archive+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('snapshot unavailable');data=await r.json();catalogSource='snapshot';}catch{try{data=JSON.parse(localStorage.getItem('easy-mandi-catalog')||'null');if(!data?.products)throw Error('no cache');catalogSource='cached';}catch{data={products:[],categories:['All']};catalogSource='unavailable';}}}
products=Array.isArray(data.products)?data.products.filter(p=>p&&p.id!=null&&p.name).map(p=>({...p,id:String(p.id)})):[];categories=['All',...new Set(products.map(p=>p.category||'Other'))];if(products.length){status(catalogSource==='live'?'Live prices':'Catalog snapshot',catalogSource!=='live');}else status('Catalog offline',true);if(scene?.rebuild)scene.rebuild(categories,products);refreshTotals();if(stallOpen)renderStall();}
function translations(){document.querySelectorAll('[data-en]').forEach(el=>el.textContent=language==='hi'?el.dataset.hi:el.dataset.en);$('languageButton').textContent=language==='en'?'हिन्दी / EN':'EN / हिंदी';if(stallOpen)renderStall();if(scene?.language)scene.language(language);try{if(frame.contentWindow?.EMI18n&&frame.contentWindow.EMI18n.lang!==language){const lang=frame.contentDocument.getElementById('siteLanguage');if(lang){lang.value=language;lang.dispatchEvent(new Event('change',{bubbles:true}));}}}catch{}}
function onSceneReady(apiScene){scene=apiScene;if(scene?.rebuild&&products.length)scene.rebuild(categories,products);hideLoading();translations();}
window.EMWalk=Object.freeze({
sceneReady:onSceneReady,
stallSelect:category=>openStall(category),
near:stall=>{if(stallOpen||nativeOpen)return;$('nearStall').hidden=!stall;if(stall){$('nearIcon').textContent=stall.emoji||'🥬';$('nearName').textContent=stall.category||'All';$('shopStall').dataset.category=stall.category||'All';}},
get active(){return !stallOpen&&!nativeOpen&&!$('welcome').open;},
failedWebGL:()=>{$('noWebGL').hidden=false;hideLoading();},
getCatalog:()=>({categories,products}),
toast
});
frame.addEventListener('load',()=>{nativeLoaded=true;modifyIframe();$('nativeWait').hidden=true;const w=frame.contentWindow;try{w.addEventListener('easy-mandi-catalog-rendered',refreshTotals);w.addEventListener('customer-account-changed',refreshTotals);}catch{}if(queuedNative){const mode=queuedNative;waitReady(()=>frameAction(mode));}refreshTotals();});
frame.addEventListener('error',()=>{frameError='Could not load customer system';$('nativeWait').hidden=false;$('nativeWait').textContent=frameError;});
document.querySelectorAll('[data-native]').forEach(el=>el.addEventListener('click',()=>openNative(el.dataset.native)));
$('basketButton').addEventListener('click',()=>openNative('basket'));
$('openBasketFromStall').addEventListener('click',()=>openNative('basket'));
$('nativeClose').addEventListener('click',closeNative);
$('closeStall').addEventListener('click',()=>closeStall());
$('nativeRefresh').addEventListener('click',()=>{frame.contentWindow?.location.reload();$('nativeWait').hidden=false;});
$('overlay').addEventListener('click',()=>{if(nativeOpen)closeNative();else closeStall();});
$('stallSearch').addEventListener('input',renderStall);
$('stallItems').addEventListener('click',e=>{const btn=e.target.closest('[data-qty]');if(btn)changeProduct(btn.dataset.qty,Number(btn.dataset.delta));});
$('shopStall').addEventListener('click',()=>openStall($('shopStall').dataset.category||'All'));
$('languageButton').addEventListener('click',()=>{language=language==='en'?'hi':'en';try{localStorage.setItem('easy-mandi-language',language);}catch{}translations();});
$('resetButton').addEventListener('click',()=>scene?.reset());
$('helpButton').addEventListener('click',()=>{try{$('welcome').showModal();}catch{}});
$('fullscreenButton').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else $('worldFrame').requestFullscreen?.().catch(()=>toast('Fullscreen unavailable'));});
function dismiss(){try{$('welcome').close();}catch{}try{sessionStorage.setItem('easy-mandi-3d-visited','yes');}catch{}}
$('dismissWelcome').addEventListener('click',dismiss);$('enterMarket').addEventListener('click',dismiss);
$('openCounterWelcome').addEventListener('click',()=>{dismiss();openNative('catalog');});
$('welcome').addEventListener('cancel',()=>{try{sessionStorage.setItem('easy-mandi-3d-visited','yes');}catch{}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(nativeOpen)closeNative();else if(stallOpen)closeStall();}});
window.addEventListener('storage',e=>{if(e.key==='easy-mandi-cart'){refreshTotals();if(stallOpen)renderStall();}});
window.addEventListener('focus',refreshTotals);
setInterval(()=>{if(nativeLoaded){modifyIframe();refreshTotals();}if(stallOpen)renderStall();},5000);
setTimeout(()=>{if(!$('loading').classList.contains('done')){window.EMWalk.failedWebGL();}},13000);
translations();loadCatalog();
})();