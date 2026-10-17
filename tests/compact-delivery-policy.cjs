const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const root=fs.readFileSync(path.join(base,'index.html'),'utf8');
const web=fs.readFileSync(path.join(base,'web/index.html'),'utf8');
const css=fs.readFileSync(path.join(base,'web/storefront.css'),'utf8');
for(const [name,html] of [['root',root],['web',web]]){
  assert.match(html,/id="compactDeliveryPolicy"/,name+' includes V3 notice');
  assert.match(html,/id="deliveryPolicyToggle"/);
  assert.match(html,/id="deliveryPolicyDismiss"/);
  assert.match(html,/src="compact-delivery-policy\.js\?v=/);
  assert.match(html,/delivery-time-promise delivery-time-checkout/,name+' retains checkout policy');
  assert.match(html,/deliveryPolicyCompact/,name+' provides short message');
  assert.match(html,/href="\/delivery-policy\.html"/,name+' links to full policy');
}
assert.match(css,/\.hero-delivery-banner\[data-state="compact"\]/);
assert.match(css,/\.hero-delivery-banner\[hidden\]\{display:none!important\}/);
assert.doesNotMatch(css,/\.hero-delivery-banner\s*\{[^}]*position:\s*fixed/i,'message never overlays catalog');
const events={};
const el=(id)=>({id,hidden:false,dataset:{state:'expanded'},attributes:{},
  addEventListener(type,fn){(this.events??={})[type]=fn},
  setAttribute(name,val){this.attributes[name]=val},
  getBoundingClientRect(){return {top:80}},
  click(){this.events?.click?.()}
});
const ids=Object.fromEntries(['compactDeliveryPolicy','deliveryPolicyToggle','deliveryPolicyDismiss','deliveryPolicyToggleText','deliveryPolicyChevron','shopCatalog','marketButton'].map(i=>[i,el(i)]));
const browse=el('browse');
let storage=new Map();
const make=()=>({
  document:{getElementById:id=>ids[id],querySelector:s=>s==='.hero-shop-link'?browse:s==='#marketButton'?ids.marketButton:null},
  sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  window:{scrollY:0,innerHeight:700,EMI18n:{t:id=>id==='deliveryPolicyExpand'?'Expand':id==='deliveryPolicyMinimize'?'Minimise':null},
    addEventListener:(name,fn)=>{(events[name]??=[]).push(fn)}},
});
const src=fs.readFileSync(path.join(base,'web/compact-delivery-policy.js'),'utf8');
const ctx=make();vm.runInNewContext(src,ctx);
assert.equal(ids.compactDeliveryPolicy.dataset.state,'expanded');
assert.equal(ids.deliveryPolicyToggle.attributes['aria-expanded'],'true');
browse.click();
assert.equal(ids.compactDeliveryPolicy.dataset.state,'compact','browse now automatically compacts');
assert.equal(ids.deliveryPolicyToggle.attributes['aria-expanded'],'false');
ids.deliveryPolicyToggle.click();
assert.equal(ids.compactDeliveryPolicy.dataset.state,'expanded','manual expand restores notice');
ctx.window.scrollY=450;for(const fn of events.scroll??[])fn();
assert.equal(ids.compactDeliveryPolicy.dataset.state,'compact','scrolling into catalogue compacts');
ids.deliveryPolicyDismiss.click();
assert.equal(ids.compactDeliveryPolicy.hidden,true,'dismissed notice is hidden');
assert.equal(storage.get('easy-mandi-delivery-notice-v3'),'dismissed');
const reload=make();vm.runInNewContext(src,reload);
assert.equal(ids.compactDeliveryPolicy.hidden,true,'dismissed state survives same-tab reload');
console.log('PASS: V3 web delivery notice, manual controls, scroll, session preference, checkout and both homepage paths');
