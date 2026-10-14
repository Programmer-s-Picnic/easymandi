const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
// Always-visible customer Market and Orders shortcuts (including before sign-in).
for(const filename of ['index.html','web/index.html']){
 const html=fs.readFileSync(path.join(base,filename),'utf8');
 const dock=html.match(/<nav class="customer-quick-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
 assert.ok(dock,filename+' must provide persistent quick navigation');
 assert.match(dock,/id="marketButton"/);
 assert.match(dock,/id="myOrdersButton"/);
 assert.doesNotMatch(dock,/\shidden(?:\s|>|=)/);
 for(const id of ['marketButton','myOrdersButton']){
  assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,filename+' should contain one '+id);
 }
}
const navCss=fs.readFileSync(path.join(base,'web/storefront.css'),'utf8');
assert.match(navCss,/\.customer-quick-nav\s*\{[\s\S]*?position:fixed/);
assert.match(navCss,/safe-area-inset-bottom/);
const historySource=fs.readFileSync(path.join(base,'web/order-history.js'),'utf8');
assert.doesNotMatch(historySource,/topButton\.hidden\s*=/);
assert.match(historySource,/window\.CustomerAccount\?\.openSignIn\(\)/);
// QR-only checkout: neither client may offer the deep link to open a UPI app.
// Keep the QR code and payment screenshot submission workflow intact.
const websitePayment=fs.readFileSync(path.join(base,'web/storefront.js'),'utf8');
const androidPayment=fs.readFileSync(path.join(base,'lib/main.dart'),'utf8');
assert.doesNotMatch(websitePayment,/payLink|\bt\('openUpi'\)/);
assert.match(websitePayment,/new window\.QRCode\(qrHolder/);
assert.match(websitePayment,/receiptBase64:base64/);
assert.doesNotMatch(androidPayment,/Open UPI app|UPI ऐप खोलें/);
assert.match(androidPayment,/QrImageView\(data: payment\['upiUri'\]/);
assert.match(androidPayment,/submitPaymentReceipt\(/);

class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.value='';this.hidden=false;this.textContent='';this.style={};this.classList={add(){},remove(){},toggle(){},contains(){return false}};this.parentElement={hidden:false};this.open=false;this.attributes={};this.previousElementSibling={textContent:''};}
 append(...nodes){if(this.tagName==='select'&&!this.children.length&&nodes[0])this.value=nodes[0].value;this.children.push(...nodes);nodes.forEach(n=>{if(n&&typeof n==='object')n.parentElement=this;});}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 before(){} prepend(...nodes){this.children.unshift(...nodes)} after(){} insertBefore(n){this.append(n)} closest(){return null} remove(){} focus(){} scrollIntoView(){}
 setAttribute(k,v){this.attributes[k]=v} getAttribute(k){return this.attributes[k]}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
 async fire(name){for(const f of this.listeners[name]||[])await f({target:this,currentTarget:this,preventDefault(){}});if(this['on'+name])await this['on'+name]({target:this,currentTarget:this,preventDefault(){}})}
 querySelector(){return {after:node=>this.prepend(node)}}
  querySelectorAll(sel){const all=this.children.filter(n=>n&&typeof n==='object').flatMap(n=>[n,...n.querySelectorAll(sel)]);return all.filter(n=>sel==='[data-order-status]'?'orderStatus' in n.dataset:sel==='.order'?n.className==='order':true)}
 showModal(){this.open=true} close(){this.open=false} setCustomValidity(){} reportValidity(){return true}
 set innerHTML(v){this.children=[];this._html=v} get innerHTML(){return this._html||''}
 get childNodes(){return this.children}
}
function harness(html){
 const nodes={};for(const [,id]of html.matchAll(/\bid="([^"]+)"/g))nodes[id]=new Element();
 const all=[];const document={hidden:false,documentElement:new Element('html'),head:new Element(),body:new Element(),getElementById:id=>nodes[id]||all.findLast(n=>n.id===id),createElement:tag=>{const n=new Element(tag);all.push(n);return n},createTextNode:text=>text,querySelectorAll:()=>[],addEventListener(){}};
 document.documentElement.dataset.adminPage=/data-admin-page="([^"]+)"/.exec(html)?.[1]||'';
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
 const events={},timers=[];const window={innerWidth:1024,innerHeight:768,removeEventListener:(n,f)=>{events[n]=(events[n]||[]).filter(fn=>fn!==f)},addEventListener:(n,f)=>(events[n]??=[]).push(f),dispatchEvent:e=>(events[e.type]||[]).forEach(f=>f())};
 const ctx={window,document,sessionStorage:storage,localStorage:storage,AbortController,URL,URLSearchParams,crypto:require('node:crypto').webcrypto,Date,Event,CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail;}},console,confirm:()=>true,alert(){},navigator:{},location:{search:''},setInterval:f=>{timers.push(f);return timers.length},clearInterval(){},setTimeout:f=>{timers.push(f);return timers.length},clearTimeout(){},MutationObserver:class{observe(){}disconnect(){}},FormData:class{constructor(form){this.values=form.values||{}}get(k){return this.values[k]}}};
 vm.createContext(ctx);return {ctx,nodes,storage,timers,run:p=>{vm.runInContext(fs.readFileSync(path.join(base,p),'utf8'),ctx,{filename:p});if(ctx.window.AppHttp)ctx.AppHttp=ctx.window.AppHttp;if(ctx.window.AdminSession)ctx.AdminSession=ctx.window.AdminSession;if(ctx.window.NotificationInbox)ctx.NotificationInbox=ctx.window.NotificationInbox;}};
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const easy=fs.existsSync(path.join(base,'admin/index.html'));
 const h=harness(fs.readFileSync(path.join(base,easy?'admin/index.html':'web/index.html'),'utf8'));let calls=[];
 h.ctx.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('admin-session.php')?{token:'signed-token',expiresAt:Math.floor(Date.now()/1000)+1800}:url.includes('notifications')?{notifications:[{id:42,order_id:7,order_ref:'ABC',message:'Update',read_at:null}],unreadCount:1}:{orders:[],partners:[]}}};
 h.run(easy?'shared/api-client.js':'web/api-client.js');h.run(easy?'shared/admin-session.js':'web/admin-session.js');h.run(easy?'shared/notification-settings.js':'web/notification-settings.js');h.run(easy?'shared/notifications.js':'web/notifications.js');
 await h.ctx.AdminSession.login('test-password');assert.equal(h.ctx.AdminSession.headers()['X-Admin-Session'],'signed-token');assert.equal(h.ctx.AdminSession.headers()['X-Admin-Password'],undefined);
 const dock=new h.ctx.NotificationInbox(new Element(),async()=>({notifications:[{id:42,order_id:7,message:'Update',read_at:null}],unreadCount:1}),async id=>{assert.equal(id,42)});dock.active=true;await dock.refresh();assert.equal(dock.title.textContent,'Notifications · 1 unread');await dock.save(42);dock.destroy();
 // Fully minimize both admin notification windows, but keep polling for genuinely new unread IDs.
 const adminRoot=new Element('section');adminRoot.id='adminNotifications';
 let adminFeed=[{id:42,audience:'admin',message:'Known order',read_at:null}];
 const readAdmin=async()=>({notifications:adminFeed,unreadCount:adminFeed.filter(n=>!n.read_at).length});
 const adminInbox=new h.ctx.NotificationInbox(adminRoot,readAdmin,async()=>{});
 adminInbox.active=true;await adminInbox.refresh();adminInbox.show();
 assert.equal(adminInbox.dialog.open,true);
 adminInbox.minimizeCompletely();
 assert.equal(adminInbox.dock.hidden,true,'full minimization hides the floating dock');
 assert.equal(adminInbox.dialog.open,false,'full minimization closes notification history');
 assert.ok(h.storage.getItem('easy-mandi-notifications-minimized-v1-admin'),'minimized state survives page refresh');
 assert.equal(adminInbox.reopenButton.hidden,false,'a compact manual reopen button is available');
 await adminInbox.reopenButton.fire('click');
 assert.equal(adminInbox.dock.hidden,false,'manual reopen restores the floating notification dock');
 assert.equal(adminInbox.dialog.open,true,'manual reopen restores the full notification history');
 assert.equal(adminInbox.reopenButton.hidden,true,'reopen button disappears when notifications are expanded');
 assert.equal(h.storage.getItem('easy-mandi-notifications-minimized-v1-admin'),null,'manual reopen clears minimized persistence');
 adminInbox.minimizeCompletely();
 assert.equal(adminInbox.reopenButton.hidden,false,'manual reopen stays available after repeated minimization');
 await adminInbox.refresh();
 assert.equal(adminInbox.dock.hidden,true,'same notifications must not unhide the dock');
 adminFeed=[{id:42,audience:'admin',message:'Known order',read_at:'2026-10-14'}];
 await adminInbox.refresh();
 assert.equal(adminInbox.dock.hidden,true,'marking old messages read must not unhide the dock');
 adminFeed.push({id:43,audience:'admin',message:'New order',read_at:null});
 await adminInbox.refresh();
 assert.equal(adminInbox.dock.hidden,false,'new unread notification must restore the dock');
 assert.equal(adminInbox.dialog.open,true,'new unread notification must reopen the modal');
 adminInbox.minimizeCompletely();
 // Simulate a full page reload sharing sessionStorage (the old page does not call destroy).
 const reloaded=new h.ctx.NotificationInbox(adminRoot,readAdmin,async()=>{});
 reloaded.active=true;await reloaded.refresh();
 assert.equal(reloaded.dock.hidden,true,'minimized state survives a page reload');
 assert.equal(reloaded.reopenButton.hidden,false,'manual reopen is available after a page reload');
 adminFeed.push({id:44,audience:'admin',message:'Another new order',read_at:null});
 await reloaded.refresh();
 assert.equal(reloaded.dialog.open,true,'new unread notification reopens after a reload');
 assert.equal(reloaded.dock.hidden,false);
 assert.equal(reloaded.reopenButton.hidden,true,'automatic restore also hides the manual reopen control');
 reloaded.minimizeCompletely();
 await reloaded.reopenButton.fire('click');
 assert.equal(reloaded.dialog.open,true,'manual reopening also works on a restored session');
 assert.equal(reloaded.reopenButton.hidden,true);
 adminInbox.destroy();reloaded.destroy();

 if(easy){
  const states=[['New',null],['Preparing','out_for_delivery'],['Delivered','delivered'],['Cancelled','cancelled']];
  h.ctx.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('admin-orders')?{orders:states.map(([status,delivery_status],i)=>({public_id:'ORDER'+i,status,delivery_status,items:[],total:10.75,subtotal:10.75,delivery_fee:0,created_at:'2026-09-30',customer_name:'Test',mobile:'9876543210',house:'12',locality:'Lanka',city:'Varanasi',state:'UP',pin:'221005'}))}:{notifications:[],unreadCount:0}}};
  h.nodes.ordersFilter.value='All';h.run('admin/orders.js');await tick();await tick();
  assert.equal(h.nodes.ordersCount.textContent,'4 of 4 orders shown');
  for(const status of states.map(s=>s[0])){h.nodes.ordersFilter.value=status;await h.nodes.ordersFilter.fire('change');assert.equal(h.nodes.ordersCount.textContent,'1 of 4 orders shown');}
  const select=h.ctx.document.getElementById('ordersDeliveryFilter');select.value='out_for_delivery';await select.fire('input');assert.equal(h.nodes.ordersFilter.value,'All');assert.equal(h.nodes.ordersCount.textContent,'1 of 4 orders shown');
  select.value='created';await select.fire('change');assert.equal(h.nodes.ordersCount.textContent,'0 of 4 orders shown');assert.equal(h.ctx.document.getElementById('ordersEmpty').hidden,false);
  const orderSearch=h.ctx.document.getElementById('ordersSearch');select.value='All';h.nodes.ordersFilter.value='All';orderSearch.value='ORDER1';await orderSearch.fire('input');assert.equal(h.nodes.ordersCount.textContent,'1 of 4 orders shown');
  orderSearch.value='';await orderSearch.fire('input');assert.equal(h.nodes.ordersCount.textContent,'4 of 4 orders shown');
  const countGrid=h.ctx.document.getElementById('orderDashboard');assert.equal(countGrid.children.length,5);await countGrid.children[3].fire('click');assert.equal(h.nodes.ordersFilter.value,'Delivered');assert.equal(h.nodes.ordersCount.textContent,'1 of 4 orders shown');
  h.ctx.AdminSession.clear();assert.equal(h.ctx.AdminSession.token,null);assert.equal(h.nodes.ordersControls.hidden,true);
  // Product forms validate before touching the draft; update preserves extra fields.
  const g=harness(fs.readFileSync(path.join(base,'admin/index.html'),'utf8'));
  const sample=JSON.parse(fs.readFileSync(path.join(base,'assets/products.json')));
  g.storage.setItem('easy-mandi-admin-draft-v1',JSON.stringify(sample));
  g.ctx.AppHttp={fetch:async()=>{throw Error('Unexpected network request')}};
  g.run('admin/catalog.js');
  const before=JSON.parse(g.storage.getItem('easy-mandi-admin-draft-v1'));
  await g.nodes.add.fire('click');assert.equal(g.nodes.productDialog.open,true);
  await g.nodes.productForm.fire('submit');assert.equal(g.nodes.productDialog.open,true);
  assert.equal(JSON.parse(g.storage.getItem('easy-mandi-admin-draft-v1')).products.length,before.products.length);
  const el=id=>g.ctx.document.getElementById('product_'+id);
  el('id').value=before.products[0].id;el('name').value='Test product';el('price').value='12.75';
  await g.nodes.productForm.fire('submit');assert.ok(g.ctx.document.getElementById('product_error_id').textContent.includes('already exists'));
  el('id').value='test_product';el('price').value='-1';await g.nodes.productForm.fire('submit');assert.ok(g.ctx.document.getElementById('product_error_price').textContent);
  el('price').value='12.75';
  g.ctx.document.getElementById('product_keywordEntry').value='bhindi, ladyfinger, okra, भिंडी';
  await g.nodes.productForm.fire('submit');assert.equal(g.nodes.productDialog.open,false);
  assert.equal(JSON.parse(g.storage.getItem('easy-mandi-admin-draft-v1')).products.at(-1).price,12.75);
  assert.deepEqual(JSON.parse(g.storage.getItem('easy-mandi-admin-draft-v1')).products.at(-1).searchKeywords,['bhindi','ladyfinger','okra','भिंडी']);
  g.nodes.filter.value='okra';await g.nodes.filter.fire('input');
  assert.ok(!g.nodes.products.children.some(child=>child.textContent.includes('No matching')),'admin search indexes aliases');
  vm.runInContext("openProduct(data.products.find(p=>p.id==='test_product'),'update')",g.ctx);
  el('name').value='Updated product';await g.nodes.productForm.fire('submit');
  assert.equal(JSON.parse(g.storage.getItem('easy-mandi-admin-draft-v1')).products.at(-1).name,'Updated product');
  // The separate authenticated keyword endpoint publishes only aliases.
  const publishedKeywords=[];
  g.ctx.window.AdminAccess={ensure:async()=>true};
  g.ctx.window.AdminSession={headers:()=>({'X-Admin-Session':'signed-token'})};
  g.ctx.AppHttp={fetch:async(url,options)=>{
    assert.ok(url.endsWith('/admin-product-keywords.php'),'Search keywords must use the partial catalog endpoint');
    assert.equal(options.method,'POST');
    assert.equal(options.headers['X-Admin-Session'],'signed-token');
    const body=JSON.parse(options.body);publishedKeywords.push(body);
    return {ok:true,json:async()=>({saved:true,changed:true,productId:body.productId,previousVersion:null,version:'test-keyword-hash'})};
  }};
  vm.runInContext("openProduct(data.products.find(p=>p.id==='test_product'),'update')",g.ctx);
  g.ctx.document.getElementById('product_keywordEntry').value='lady finger, ladyfinger';
  await g.nodes.productPublishKeywords.fire('click');
  assert.equal(publishedKeywords.length,1);
  assert.equal(publishedKeywords[0].productId,'test_product');
  assert.ok(publishedKeywords[0].searchKeywords.includes('lady finger'));
  assert.ok(g.nodes.message.textContent.includes('published'),'Admin must confirm live publication');

  vm.runInContext("openProduct(data.products.find(p=>p.id==='test_product'),'delete')",g.ctx);
  await g.nodes.productCancel.fire('click');assert.equal(JSON.parse(g.storage.getItem('easy-mandi-admin-draft-v1')).products.length,before.products.length+1);
  vm.runInContext("openProduct(data.products.find(p=>p.id==='test_product'),'delete')",g.ctx);
  await g.nodes.productForm.fire('submit');assert.equal(JSON.parse(g.storage.getItem('easy-mandi-admin-draft-v1')).products.length,before.products.length);
  g.nodes.filter.value='nothing_matches';await g.nodes.filter.fire('input');assert.ok(g.nodes.products.children.some(child=>child.textContent.includes('No matching')));
  // Password pop-up retains validation errors and uses the shared session.
  const a=harness(fs.readFileSync(path.join(base,'admin/index.html'),'utf8'));let attempts=0;
  a.ctx.AdminSession={token:null,login:async()=>{if(++attempts===1)throw Error('Incorrect password');a.ctx.AdminSession.token='valid';}};
  a.run('admin/auth-dialog.js');const signin=a.ctx.window.AdminAccess.ensure();
  assert.equal(a.nodes.adminDialog.open,true);a.nodes.adminPassword.value='wrong';await a.nodes.adminForm.fire('submit');
  assert.equal(a.nodes.adminDialog.open,true);assert.equal(a.nodes.adminError.textContent,'Incorrect password');assert.equal(a.nodes.adminPassword.value,'');
  a.nodes.adminPassword.value='correct';await a.nodes.adminForm.fire('submit');await signin;
  assert.equal(a.nodes.adminDialog.open,false);await a.ctx.window.AdminAccess.ensure();assert.equal(attempts,2);
  // Execute customer checkout including WhatsApp confirmation with real production script.
  const c=harness(fs.readFileSync(path.join(base,'web/index.html'),'utf8'));const catalog=JSON.parse(fs.readFileSync(path.join(base,'assets/products.json')));catalog.store.minimumOrder=0;catalog.products[0].price=10.75;const id=catalog.products[0].id;
  c.ctx.fetch=async()=>({ok:true,status:200,json:async()=>catalog});
  c.ctx.window.EasyMandiLocalities={valid:locality=>locality==='Lanka'};
  let savedOrders=0,loggedIn=false;
  c.ctx.window.CustomerAccount={
    get authenticated(){return loggedIn;},
    openSignIn(){},
    request:async(endpoint,options)=>{
      assert.equal(endpoint,'order-create');
      assert.equal(options.authorized,true);
      assert.equal(options.method,'POST');
      assert.equal(options.payload.mobile,'9876543210');
      savedOrders++;
      return {orderId:'ABC123',total:10.75};
    }
  };
  c.run('shared/api-client.js');c.run('web/mandi-pricing.js');c.run('web/storefront.js');await tick();await tick();
  assert.equal(vm.runInContext("productSearchScore({name:'Lady Finger',hindi:'भिंडी',category:'Vegetables',searchKeywords:['bhindi','lady finger','okra']},'okra')",c.ctx),1);
  assert.equal(vm.runInContext("productSearchScore({name:'Lady Finger',hindi:'भिंडी',category:'Vegetables',searchKeywords:['bhindi','lady finger','okra']},'ladyfinger')",c.ctx),0);
  assert.equal(vm.runInContext("productSearchScore({name:'Lady Finger',hindi:'भिंडी',category:'Vegetables',searchKeywords:['bhindi','lady finger','okra']},'करेला')",c.ctx),null);
  assert.equal(vm.runInContext("productSearchScore({name:'Potato',hindi:'आलू',category:'Vegetables',searchKeywords:[]},'aloo')",c.ctx),null);vm.runInContext(`change(${JSON.stringify(id)},1)`,c.ctx);
  await c.nodes.basketButton.fire('click');
  c.nodes.orderForm.values={name:'Test User',phone:'9876543210',house:'House 12',locality:'Lanka',landmark:'',pin:'221005'};
  await c.nodes.orderForm.fire('submit');
  assert.equal(savedOrders,0,'guest checkout must not save orders');
  assert.equal(c.nodes.checkoutLoginGate.hidden,false,'guests see sign-in gate');
  loggedIn=true;
  c.ctx.window.dispatchEvent(new Event('customer-account-changed'));
  assert.equal(c.nodes.orderForm.hidden,false,'signed in customers may check out');
  await c.nodes.orderForm.fire('submit');
  assert.equal(savedOrders,1,'authenticated order submitted');
  const link=c.nodes.orderConfirmation.children.find(n=>n.tagName==='a');assert.ok(link.href.startsWith('https://wa.me/917398564033?'));assert.ok(new URL(link.href).searchParams.get('text').includes('\n'));assert.equal(c.nodes.orderForm.hidden,true);
  const cloud=harness(fs.readFileSync(path.join(base,'web/index.html'),'utf8'));let addressPayload;
  cloud.nodes.orderForm.elements=Object.fromEntries(['name','phone','house','locality','landmark','pin'].map(key=>[key,new Element('input')]));
  cloud.ctx.data={products:[{id:'potato',price:20,available:true}]};cloud.ctx.change=()=>{};cloud.ctx.deliveryLocation={locationLat:1,locationLng:2};
  cloud.ctx.window.EasyMandiLocalities={valid:()=>true,choose:value=>{cloud.nodes.orderForm.elements.locality.value=value;}};
  cloud.ctx.window.CustomerAccount={user:{id:7,mobile:'9876543210'},request:async(path,options)=>{assert.equal(path,'customer-data');assert.equal(options.authorized,true);if(options.payload){addressPayload=options.payload;return {saved:true};}return {addresses:[{id:3,name:'Customer',phone:'9876543210',house:'House 12',locality:'Lanka',landmark:'',pin:'221005'}],items:[{product_id:'potato',name:'Potato'}]};}};
  cloud.run('web/customer-data.js');await tick();await tick();
  const controls=cloud.nodes.orderForm.children[0];const addressSelect=controls.children[1];addressSelect.value='3';await addressSelect.fire('change');assert.equal(cloud.nodes.orderForm.elements.house.value,'House 12');assert.equal(cloud.ctx.deliveryLocation,null);
  cloud.nodes.orderForm.elements.house.value='House 25';await controls.children[2].fire('click');await tick();assert.equal(addressPayload.id,3);assert.equal(addressPayload.house,'House 25');

 }else{
  // Entire delivery application executes; admin inbox must never reference a deleted password.
  h.run('web/app.js');await tick();await tick();assert.ok(calls.some(c=>c.url.includes('audience=admin')));const call=calls.find(c=>c.url.includes('audience=admin'));assert.equal(call.options.headers['X-Admin-Session'],'signed-token');assert.equal(call.options.headers['X-Admin-Password'],undefined);
 }
 console.log((easy?'Easy Mandi':'Delivery')+' session, notifications and feature regressions passed');
})().catch(e=>{console.error(e);process.exitCode=1});
