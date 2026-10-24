/* Easy Mandi — unlisted 3D order journey.
   Demo is illustrative. REAL mode requires the existing admin session and
   uses only anonymous stage/product aggregates from admin-orders.php.
   Never save passwords, tokens, raw rows or customer identities to storage. */
const $=id=>document.getElementById(id);
const apiRoot='https://cserver.learnwithchampak.live/easymandi/api/';
let mode='demo',authToken=null,expiresAt=0,poll=null,refreshing=false,paused=false,ready=false;
let currentEvents=[],simulation=null,lastRefresh=0;
const demoEvents=[
 {key:'demo1',stage:'received',items:[{name:'Tomato',qty:3},{name:'Onion',qty:2}],units:5,time:'Illustration'},
 {key:'demo2',stage:'received',items:[{name:'Potato',qty:4},{name:'Cabbage',qty:1}],units:5,time:'Illustration'},
 {key:'demo3',stage:'packing',items:[{name:'Spinach',qty:3},{name:'Carrot',qty:2}],units:5,time:'Illustration'},
 {key:'demo4',stage:'packed',items:[{name:'Garlic',qty:2},{name:'Cauliflower',qty:1}],units:3,time:'Illustration'},
 {key:'demo5',stage:'dispatch',items:[{name:'Tomato',qty:2},{name:'Potato',qty:5}],units:7,time:'Illustration'},
 {key:'demo6',stage:'dispatch',items:[{name:'Onion',qty:5},{name:'Coriander',qty:2}],units:7,time:'Illustration'},
 {key:'demo7',stage:'delivered',items:[{name:'Cabbage',qty:1}],units:1,time:'Illustration'}
];
const tags={received:['🛒','Purchased'],packing:['📦','Being packed'],packed:['📦','Ready to dispatch'],dispatch:['🛺','Dispatched'],delivered:['✓','Delivered'],cancelled:['×','Cancelled']};
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
function safeString(s,max=40){return String(s??'').trim().replace(/[\x00-\x1f]/g,' ').slice(0,max);}
function stageOf(order){
 const o=String(order.status||'').toLowerCase(),d=String(order.delivery_status||'').toLowerCase();
 if(d==='delivered'||o==='delivered')return 'delivered';
 if(d==='cancelled'||o==='cancelled')return 'cancelled';
 if(['out_for_delivery','picked_up','shipped'].includes(d)||o==='shipped')return 'dispatch';
 if(o==='packed'||d==='assigned'||d==='created')return 'packed';
 if(['preparing','processing'].includes(o))return 'packing';
 return 'received';
}
// SECURITY: raw admin-orders includes private data; extract only approved
// event fields synchronously and discard all other fields. No data is stored.
function sanitiseOrderRows(data){
 const rows=Array.isArray(data?.orders)?data.orders:[];
 return rows.slice(0,100).map((row,i)=>{
  const items=Array.isArray(row.items)?row.items.slice(0,5).map(item=>({
   name:safeString(item.product_name,30),
   qty:Math.max(0,Math.min(99,Number(item.quantity)||0))
  })): [];
  const time=safeString(row.updated_at||row.created_at||'',32);
  return {
   key:'order-view-'+i,
   stage:stageOf(row),items,units:items.reduce((n,item)=>n+item.qty,0),
   time:time?time.slice(0,16):'Recent order'
  };
 });
}
function summary(events){
 const totals={received:0,packing:0,packed:0,dispatch:0,delivered:0,cancelled:0};
 events.forEach(e=>{if(Object.hasOwn(totals,e.stage))totals[e.stage]++;});
 return totals;
}
function setStatus(text,connected=false){
 $('statusText').textContent=text;
 $('liveStatus').classList.toggle('connected',connected);
}
function renderFeed(events,real){
 mode=real?'real':'demo';currentEvents=events;
 const totals=summary(events);
 $('receivedCount').textContent=totals.received;
 $('preparingCount').textContent=totals.packing+totals.packed;
 $('dispatchCount').textContent=totals.dispatch;
 $('deliveredCount').textContent=totals.delivered;
 $('snapshotTitle').textContent=real?'Real order activity':'Illustrative activity';
 $('ordersTotal').textContent=real?'Latest '+events.length+' orders':'Sample orders';
 $('modeLabel').textContent=real?'REAL ORDER STATUS FEED':'DEMO ACTIVITY';
 $('modeLabel').classList.toggle('real',real);
 $('feedSummary').textContent=real?'Read-only · anonymised · refreshed every 30 sec':'Illustrative activity only · not actual orders';
 $('asOf').textContent=real?new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})+' IST':'Illustrative';
 $('orderQueue').replaceChildren();
 if(!events.length){
  const msg=document.createElement('div');msg.className='empty-event';msg.textContent=real?'There are no recent orders to display. The market remains quiet until a real order arrives.':'No activity';$('orderQueue').append(msg);
 }
 events.slice(0,14).forEach((e,i)=>{
  const entry=document.createElement('div');entry.className='event';
  const ico=document.createElement('span');ico.className='event-symbol';ico.textContent=tags[e.stage]?.[0]||'📦';
  const main=document.createElement('span');main.className='event-main';
  const headline=document.createElement('strong');headline.textContent=(real?'Order activity ':'Demo activity ')+String(i+1).padStart(2,'0');
  const line=document.createElement('span');line.textContent=e.items.map(x=>x.name+(x.qty>1?' ×'+x.qty:'')).join(', ')||'Produce order';
  main.append(headline,line);
  const st=document.createElement('span');st.className='event-stage';st.textContent=tags[e.stage]?.[1]||e.stage;
  entry.append(ico,main,st);$('orderQueue').append(entry);
 });
 if(simulation)simulation.setEvents(events);
}
function clearSession(){
 authToken=null;expiresAt=0;clearInterval(poll);poll=null;
 $('signInButton').textContent='Connect real orders';$('refreshBtn').disabled=true;
 setStatus('Preview · not connected',false);
 renderFeed(demoEvents,false);
}
async function fetchActivity(){
 if(!authToken)return;
 if(Date.now()>=expiresAt*1000){clearSession();setStatus('Admin session expired',false);return;}
 if(refreshing)return;
 refreshing=true;$('refreshBtn').disabled=true;
 try{
  const res=await fetch(apiRoot+'admin-orders.php',{
   method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
   headers:{'Content-Type':'application/json','X-Admin-Session':authToken},
   body:JSON.stringify({search:''})
  });
  if(res.status===401){clearSession();throw Error('Admin session expired. Connect again.');}
  const body=await res.json();
  if(!res.ok)throw Error(safeString(body?.error||'Could not load order statuses',130));
  // Map and discard the raw response immediately.
  const events=sanitiseOrderRows(body);
  renderFeed(events,true);
  lastRefresh=Date.now();setStatus('Connected · private feed',true);
 }catch(e){
  $('feedSummary').textContent='Could not refresh orders: '+safeString(e.message,95);
  if(!authToken)setStatus('Preview · not connected',false);
 }finally{refreshing=false;$('refreshBtn').disabled=!authToken;}
}
function closeDialog(){if($('authDialog').open)$('authDialog').close();$('adminPassword').value='';$('authError').hidden=true;}
$('signInButton').addEventListener('click',()=>{
 if(authToken){clearSession();return;}
 $('authDialog').showModal();$('adminPassword').focus();
});
$('authClose').addEventListener('click',closeDialog);
$('authDialog').addEventListener('close',()=>{$('adminPassword').value='';});
$('authForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const pw=$('adminPassword').value;$('adminPassword').value='';
 $('authError').hidden=true;$('authSubmit').disabled=true;
 try{
  const res=await fetch(apiRoot+'admin-session.php',{
   method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
   headers:{'X-Admin-Password':pw,'Content-Type':'application/json'},
   body:'{}'
  });
  const data=await res.json();
  if(!res.ok||!data?.token||!Number(data.expiresAt))throw Error(safeString(data?.error||'Incorrect admin password',130));
  authToken=String(data.token);expiresAt=Number(data.expiresAt);
  $('signInButton').textContent='Disconnect';$('refreshBtn').disabled=false;
  closeDialog();setStatus('Reading real orders…',false);
  await fetchActivity();
  clearInterval(poll);poll=setInterval(()=>{if(authToken&&!document.hidden)fetchActivity();},30000);
 }catch(error){
  $('authError').textContent=safeString(error.message,160);$('authError').hidden=false;
 }finally{$('authSubmit').disabled=false;}
});
$('refreshBtn').addEventListener('click',fetchActivity);
$('pauseAnimation').addEventListener('click',()=>{
 paused=!paused;
 $('pauseAnimation').setAttribute('aria-pressed',String(paused));
 $('pauseAnimation').innerHTML=paused?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>';
 if(simulation)simulation.pause(paused);
});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&authToken&&Date.now()-lastRefresh>30000)fetchActivity();
});
renderFeed(demoEvents,false);

// ------------ Three-dimensional narrative scene ------------
let THREE;
try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js');}
catch(err){try{THREE=await import('https://unpkg.com/three@0.164.1/build/three.module.js');}
 catch(second){console.warn('3D render library unavailable',err,second);$('graphicsFailure').hidden=false;}}
if(THREE)try{
 const host=$('threeHost'),mobile=window.matchMedia('(max-width:720px)').matches;
 const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:mobile?'low-power':'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.25:1.8));
 renderer.setSize(host.clientWidth,host.clientHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.48;
 renderer.shadowMap.enabled=!mobile;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 host.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#d6e7dd');scene.fog=new THREE.Fog('#d6e7dd',50,105);
 const camera=new THREE.PerspectiveCamera(48,Math.max(.3,host.clientWidth/host.clientHeight),.1,140);
 let currentCamera='overview',targetLook=new THREE.Vector3(0,0,0),yaw=.58,pitch=.67,distance=41;
 const targets={
  overview:{target:[0,0,0],yaw:.48,pitch:.74,distance:47},
  shopping:{target:[-11,1,0],yaw:.20,pitch:.67,distance:19},
  packing:{target:[0,1,0],yaw:.65,pitch:.67,distance:18},
  dispatch:{target:[12,1,0],yaw:.65,pitch:.67,distance:21}
 };
 function selectCamera(name){
  if(!targets[name])return;
  currentCamera=name;
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.camera===name));
  $('sceneCaption').textContent={
   overview:'Market → Checkout → Packing → Dispatch · Drag to rotate, scroll to zoom',
   shopping:'Customers choose produce and confirm purchases',
   packing:'Packing staff prepare the items in recorded orders',
   dispatch:'Delivery partners move loaded trolleys out of the gate'
  }[name];
 }
 document.querySelectorAll('.view-btn').forEach(b=>b.addEventListener('click',()=>selectCamera(b.dataset.camera)));
 selectCamera('overview');
 scene.add(new THREE.HemisphereLight('#fff5de','#739589',2.6));
 const sun=new THREE.DirectionalLight('#ffe8ae',3.2);sun.position.set(-16,34,22);
 sun.castShadow=!mobile;sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;
 scene.add(sun);
 const materialCache=new Map();
 function mat(color,metal=0){const key=color+'|'+metal;if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,metalness:metal,roughness:metal?.49:.88}));return materialCache.get(key);}
 const ground=mat('#dce6ce'),path=mat('#eedebe'),wood=mat('#947153'),woodDark=mat('#644b37'),roof1=mat('#d37a5f'),roof2=mat('#6b9d75'),ink=mat('#2b6248'),gold=mat('#efcc85');
 function shape(parent,geo,material,x,y,z){
  const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=!mobile;m.receiveShadow=true;parent.add(m);return m;
 }
 const cub=(parent,w,h,d,x,y,z,m)=>shape(parent,new THREE.BoxGeometry(w,h,d),x===undefined?wood:m,x,y,z);
 // Explicit utility avoids custom objects coming from the order feed.
 function box(parent,w,h,d,x,y,z,m){return shape(parent,new THREE.BoxGeometry(w,h,d),m,x,y,z);}
 function cylinder(parent,r1,r2,h,x,y,z,m){return shape(parent,new THREE.CylinderGeometry(r1,r2,h,10),m,x,y,z);}
 function sphere(parent,r,x,y,z,m){return shape(parent,new THREE.SphereGeometry(r,10,8),m,x,y,z);}
 function boardTexture(title,subtitle,main='#245d43'){
  const cv=document.createElement('canvas');cv.width=900;cv.height=270;
  const ctx=cv.getContext('2d');ctx.fillStyle=main;ctx.fillRect(0,0,900,270);
  ctx.strokeStyle='#e6c47e';ctx.lineWidth=12;ctx.strokeRect(9,9,882,252);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f9f6e6';
  let fontSize=76;ctx.font='800 '+fontSize+'px Arial';
  while(ctx.measureText(String(title)).width>830&&fontSize>30){fontSize-=4;ctx.font='800 '+fontSize+'px Arial';}
  ctx.fillText(String(title),450,111);ctx.font='bold 37px Arial';ctx.fillStyle='#e3ca87';ctx.fillText(subtitle,450,207);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;return tex;
 }
 function sign(parent,title,subtitle,x,y,z,w,h,rotation=0,color='#245d43'){
  const material=new THREE.MeshBasicMaterial({map:boardTexture(title,subtitle,color),side:THREE.DoubleSide});
  const m=shape(parent,new THREE.PlaneGeometry(w,h),material,x,y,z);m.rotation.y=rotation;return m;
 }
 const world=new THREE.Group();scene.add(world);
 box(world,43,.3,30,0,-.16,0,ground);
 box(world,38,.05,7.7,0,.01,2.8,path);
 // Walkway ribbons visibly connect every station.
 const aisleMat=mat('#fff1d2');
 box(world,39,.02,2.4,0,.045,1.8,aisleMat);
 for(let x=-18;x<20;x+=2.5)box(world,.05,.025,2.42,x,.061,1.8,mat('#dfcbae'));
 // Separate semantic station zones in world space.
 const stationSpecs=[
  {x:-12,color:'#dfeccb',title:'FRESH STALLS',subtitle:'PICK YOUR PRODUCE',emoji:'🥬'},
  {x:-1.5,color:'#f0e4c8',title:'CHECKOUT',subtitle:'ORDER RECEIVED',emoji:'🛒'},
  {x:6.7,color:'#e3e6e9',title:'PACKING',subtitle:'PREPARING ORDERS',emoji:'📦'},
  {x:15,color:'#f7e3bc',title:'DISPATCH',subtitle:'GOODS ON TROLLEYS',emoji:'🛺'}
 ];
 const zones=[];
 for(const st of stationSpecs){
  const zone=new THREE.Group();zone.position.x=st.x;world.add(zone);
  box(zone,7,.07,13,0,.015,-2.6,mat(st.color));
  sign(zone,st.title,st.subtitle,0,4.35,-7.25,6.1,1.8);
  zones.push(zone);
 }
 // Market shops and substantial produce crates on both sides.
 function crate(group,x,y,z,index){
  box(group,1.85,.2,1.38,x,y,z,wood);
  for(const dx of [-.86,.86])box(group,.12,.38,1.4,x+dx,y+.22,z,woodDark);
  for(const dz of [-.64,.64])box(group,1.85,.38,.11,x,y+.22,z+dz,woodDark);
  const cols=['#c75d3e','#a9bb53','#bd9562','#75a55a'];
  const base=mat(cols[index%cols.length]);
  const inst=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.165,1),base,48);
  const t=new THREE.Object3D();
  let k=0;
  for(const [side,height] of [[4,.47],[4,.70],[4,.91]]){
   for(let a=0;a<4;a++)for(let b=0;b<4;b++){
    t.position.set(x+(a-1.5)*.42,y+height,z+(b-1.5)*.29);
    t.rotation.set((k*.2)%1,(k*.31)%1,0);t.scale.setScalar(.89+(k%4)*.05);
    t.updateMatrix();inst.setMatrixAt(k++,t.matrix);
   }
  }
  group.add(inst);
 }
 function shop(parent,x,z,index){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const red=index%2===0;
  box(g,5.6,.16,4.8,0,3.15,0,woodDark);
  box(g,5.7,.23,5.0,0,3.27,0,red?roof1:roof2);
  for(const dx of [-2.65,2.65])for(const dz of [-2.1,2.1])cylinder(g,.11,.12,3.1,dx,1.58,dz,woodDark);
  box(g,5.4,.14,1.05,0,1.02,1.8,woodDark);
  crate(g,-1.34,1.15,1.50,index);
  crate(g,1.34,1.15,1.50,index+2);
  crate(g,-1.34,.2,-.6,index+1);
  crate(g,1.34,.2,-.6,index+3);
  sign(g,index===0?'FRESH VEG':'LEAFY GREENS','TODAY’S CATALOG',0,2.61,2.59,4.6,.88);
  return g;
 }
 shop(world,-14,-4.9,0);shop(world,-8.2,-4.9,1);
 // Checkout stall and receipt counter.
 const checkout=new THREE.Group();checkout.position.set(-1.5,0,-3.25);world.add(checkout);
 box(checkout,5.6,1.0,2.0,0,.52,0,wood);
 box(checkout,5.9,.16,2.15,0,1.10,0,mat('#fbf1d9'));
 box(checkout,1,.16,.85,1.6,1.29,-.25,ink);
 sign(checkout,'CHECKOUT','ORDER RECEIVED',0,2.8,-.8,4.8,1.25);
 // Packing counters and active packing area.
 const packing=new THREE.Group();packing.position.set(6.7,0,-3.25);world.add(packing);
 for(const dx of [-1.5,1.5]){box(packing,2.3,.18,1.5,dx,1.05,0,wood);for(const l of [-.85,.85])for(const k of [-.55,.55])box(packing,.12,1,.12,dx+l,.54,k,woodDark);}
 for(let i=0;i<5;i++)box(packing,.74,.52,.72,-1.5+(i%3)*.62,1.43+(i%2)*.1,(Math.floor(i/3)-1)*.42,mat('#cbad7c'));
 sign(packing,'PACKING','QUALITY CHECK',0,3.0,-1.3,4.9,1.28);
 // Outbound departure gate at positive X, facing side of delivery lane.
 const arch=new THREE.Group();arch.position.set(19.25,0,1.8);world.add(arch);
 for(const z of [-3.0,3])cylinder(arch,.26,.3,5.6,0,2.8,z,woodDark);
 box(arch,.6,.4,6.65,0,5.48,0,ink);
 sign(arch,'EASY MANDI','DELIVERY DISPATCH',.32,4.78,0,5.6,1.23,Math.PI/2);
 // Small street/entrance gate on left for buyer arrivals.
 const entrance=new THREE.Group();entrance.position.set(-20.4,0,1.75);world.add(entrance);
 for(const z of [-2,2])cylinder(entrance,.19,.2,3.7,0,1.85,z,woodDark);
 box(entrance,.36,.34,4.5,0,3.75,0,ink);
 sign(entrance,'EASY MANDI','CUSTOMER ENTRY',-.29,3.18,0,3.8,.92,Math.PI/2);
 // Street lamps and low evergreen pots.
 for(let x=-18;x<19;x+=7.5){
  cylinder(world,.07,.1,3.25,x,1.63,6.7,woodDark);
  sphere(world,.24,x,3.25,6.7,new THREE.MeshBasicMaterial({color:'#ffdf99'}));
 }
 for(const x of [-18,-10,0,8,16])for(const z of [-8.5,8.6]){
  cylinder(world,.32,.37,.44,x,.23,z,mat('#b97d5c'));
  const greenCone=shape(world,new THREE.ConeGeometry(.55,1.2,8),mat('#5b9763'),x,1.0,z);
 }
 // Anonymous procedural humans, deliberately no real user likenesses.
 const skins=['#bb8563','#c99a7a','#90674b','#daa880'],shirts=['#418d72','#cb8066','#698fc5','#d5b362','#8f7cb6','#83a976'];
 const pants=mat('#394b56'),shoe=mat('#2f3833');
 function character(i,role='shopper'){
  const g=new THREE.Group(),body=new THREE.Group(),arms=[],legs=[];
  const tone=mat(skins[i%skins.length]),outfit=mat(shirts[(i+2*(role==='packer'?1:0))%shirts.length]);
  body.position.y=1.15;g.add(body);
  cylinder(body,.22,.26,.70,0,0,0,outfit);
  sphere(body,.18,0,.53,0,tone);
  const hair=sphere(body,.19,0,.63,0,mat('#29322b'));hair.scale.y=.52;
  for(const d of [-1,1]){
   const a=new THREE.Group();a.position.set(d*.275,.24,0);
   cylinder(a,.075,.065,.53,0,-.27,0,outfit);sphere(a,.07,0,-.54,0,tone);
   body.add(a);arms.push(a);
   const l=new THREE.Group();l.position.set(d*.12,.71,0);
   cylinder(l,.095,.09,.65,0,-.33,0,pants);
   box(l,.19,.12,.29,0,-.69,-.065,shoe);
   g.add(l);legs.push(l);
  }
  if(role==='delivery'){
   cylinder(body,.19,.2,.14,0,.72,0,mat('#dbe1d0'));
  }
  g.scale.setScalar(.95+(i%3)*.04);
  world.add(g);
  return {g,arms,legs,body,phase:i*2.15,x:0,z:0,role};
 }
 // Trolley body, loaded with physical crates to match an order's quantities.
 function trolley(i){
  const g=new THREE.Group();world.add(g);
  const iron=mat('#76817a',.35),tire=mat('#323b38'),crateMat=mat('#b98b5c');
  box(g,1.75,.16,1.1,0,.48,0,iron);
  for(const x of [-.7,.7])for(const z of [-.39,.39]){
   const w=cylinder(g,.23,.23,.13,x,.24,z,tire);w.rotation.z=Math.PI/2;
  }
  box(g,.12,1.14,.1,-.76,1.05,.46,iron);box(g,.12,1.14,.1,-.76,1.05,-.46,iron);
  box(g,.15,.10,1.12,-.76,1.61,0,iron);
  for(let k=0;k<5;k++){
   const x=(k%2?-.30:.35),z=Math.floor(k/2)*.31-.42;
   box(g,.67,.39,.55,x,.82+(k%3===2?.42:0),z,crateMat);
   for(let n=0;n<4;n++)sphere(g,.14,x+(n%2?.16:-.16),1.07+(k%3===2?.42:0),z+(n<2?-.13:.13),mat((i+k)%2?'#729f53':'#d27954'));
  }
  return g;
 }
 const activityActors=new THREE.Group();world.add(activityActors);
 const allAssets=[];
 const processStates=[];
 function clearEvents(){
  for(const a of allAssets){
   a.g.visible=false;
  }
  allAssets.length=0;processStates.length=0;
 }
 function animateRoute(asset,points,t,speed){
  const cycle=Math.max(1,points.length-1);
  const scaled=(t*speed+asset.offset)%cycle;
  const seg=Math.floor(scaled),u=scaled-seg;
  const ease=u*u*(3-2*u);
  const a=points[Math.min(seg,points.length-1)],b=points[Math.min(seg+1,points.length-1)];
  asset.g.position.set(a[0]+(b[0]-a[0])*ease,0,a[1]+(b[1]-a[1])*ease);
  if(asset.character){
   const dx=b[0]-a[0],dz=b[1]-a[1],angle=Math.atan2(-dx,-dz);
   asset.g.rotation.y=angle;
  }
  return {u,seg};
 }
 function updateAssets(events){
  // The private feed refreshes repeatedly. Remove old scene objects rather
  // than accumulating invisible pedestrians and loaded trolleys forever.
  for(const asset of allAssets){
   if(!asset.g)continue;
   world.remove(asset.g);
   asset.g.traverse(node=>{
    if(node.geometry)node.geometry.dispose();
    // Geometry is unique to each animated asset; palette materials may be
    // shared across the market and must not be disposed here.
   });
  }
  allAssets.length=0;
  processStates.length=0;
  const visible=events.filter(e=>e.stage!=='cancelled').slice(0,mobile?10:16);
  visible.forEach((e,i)=>{
   if(e.stage==='received'){
    const actor=character(i,'shopper');
    processStates.push({role:'purchase',entry:e,actor,offset:i*.31,speed:.28});
    allAssets.push({g:actor.g,kind:'buyer'});
   }else if(e.stage==='packing'||e.stage==='packed'){
    processStates.push({role:'packing',entry:e,index:i});
   }else if(e.stage==='dispatch'){
    const person=character(i+30,'delivery'),goods=trolley(i);
    processStates.push({role:'dispatch',entry:e,actor:person,goods,offset:i*.47,speed:.17});
    allAssets.push({g:person.g,kind:'partner'},{g:goods,kind:'trolley'});
   }
  });
  // Packing staff are constant workflow illustrators; active only when
  // there are genuine Preparing/Packed orders in real mode.
  packers.forEach(p=>p.g.visible=processStates.some(e=>e.role==='packing'));
  if(!processStates.some(e=>e.role==='packing'))packingBoxes.forEach(b=>b.visible=false);
  else packingBoxes.forEach(b=>b.visible=true);
 }
 const packers=[character(77,'packer'),character(78,'packer')];
 packers[0].g.position.set(5.15,0,-4.65);packers[1].g.position.set(8.28,0,-4.65);
 packers.forEach(p=>{p.g.rotation.y=Math.PI;p.g.visible=false;});
 const packingBoxes=[];
 for(let i=0;i<4;i++){
  const b=box(world,.62,.39,.61,5.6+i*.64,1.45,-3.16,mat('#d5b682'));packingBoxes.push(b);b.visible=false;
 }
 function setEvents(events){updateAssets(events);}
 let isPaused=false,time=0;
 function pause(value){isPaused=value;}
 const clock=new THREE.Clock();
 let dragging=false,pointerX=0,pointerY=0,moved=0,zoomTarget=distance;
 renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;pointerX=e.clientX;pointerY=e.clientY;moved=0;try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}});
 renderer.domElement.addEventListener('pointermove',e=>{
  if(!dragging)return;
  const dx=e.clientX-pointerX,dy=e.clientY-pointerY;pointerX=e.clientX;pointerY=e.clientY;moved+=Math.hypot(dx,dy);
  if(moved>2){
   yaw=Math.max(-1.2,Math.min(1.35,yaw-dx*.004));
   pitch=Math.max(.26,Math.min(1.32,pitch+dy*.0033));
  }
 });
 renderer.domElement.addEventListener('pointerup',()=>dragging=false);
 renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();zoomTarget=Math.max(12,Math.min(75,zoomTarget+e.deltaY*.025));},{passive:false});
 let last=performance.now();
 function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.052,(now-last)/1000);last=now;
  const p=targets[currentCamera];
  if(!dragging){yaw+=(p.yaw-yaw)*Math.min(.035,dt*2.5);pitch+=(p.pitch-pitch)*Math.min(.035,dt*2.5);}
  zoomTarget+=(p.distance-zoomTarget)*Math.min(.035,dt*2);
  distance+=(zoomTarget-distance)*Math.min(1,dt*3.3);
  const target=new THREE.Vector3(...p.target);targetLook.lerp(target,Math.min(1,dt*3.3));
  camera.position.set(targetLook.x+Math.sin(yaw)*Math.cos(pitch)*distance,
    targetLook.y+Math.sin(pitch)*distance,targetLook.z+Math.cos(yaw)*Math.cos(pitch)*distance);
  camera.lookAt(targetLook);
  if(!isPaused&&!document.hidden){
   time+=dt;
   for(const e of processStates){
    if(e.role==='purchase'){
     const path=[[-19.4,3.6],[-14.5,3.6],[-13.2,-1.1],[-8,-.8],[-4.4,2],[-2.2,.2],[-3.2,4]];
     const result=animateRoute({g:e.actor.g,character:true,offset:e.offset},path,time,e.speed);
     const gait=(result.u>.05&&result.u<.95)?Math.sin(time*9+e.offset)*.31:0;
     e.actor.legs[0].rotation.x=gait;e.actor.legs[1].rotation.x=-gait;
     e.actor.arms[0].rotation.x=-gait*.6;e.actor.arms[1].rotation.x=gait*.6;
    }else if(e.role==='dispatch'){
     const path=[[9.8,2.4],[12,2.4],[15,2.4],[18.2,2.4],[21.1,2.4]];
     const result=animateRoute({g:e.actor.g,character:true,offset:e.offset},path,time,e.speed);
     e.goods.position.set(e.actor.g.position.x+.95,0,e.actor.g.position.z);
     e.goods.rotation.y=e.actor.g.rotation.y;
     const gait=Math.sin(time*8+e.offset)*.32;
     e.actor.legs[0].rotation.x=gait;e.actor.legs[1].rotation.x=-gait;
     e.actor.arms[0].rotation.x=-.35;e.actor.arms[1].rotation.x=-.35;
    }
   }
   const activePacking=processStates.some(e=>e.role==='packing');
   if(activePacking){
    packers.forEach((p,i)=>{
     p.arms[0].rotation.x=-.4-.36*Math.sin(time*2+i);
     p.arms[1].rotation.x=-.4+.36*Math.sin(time*2+i);
     p.body.rotation.y=Math.sin(time*.8+i)*.09;
    });
    packingBoxes.forEach((b,i)=>{b.position.y=1.45+Math.sin(time*.9+i)*.09;});
   }
  }
  renderer.render(scene,camera);
 }
 function resize(){
  camera.aspect=Math.max(.3,host.clientWidth/host.clientHeight);
  camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);
 }
 window.addEventListener('resize',resize);
 simulation={setEvents,pause};
 simulation.setEvents(currentEvents);
 requestAnimationFrame(frame);
 ready=true;
}catch(error){console.error('3D operations scene failed',error);$('graphicsFailure').hidden=false;}

// No background work: refreshing is only while the page is open and admin
// signed in. Going away from the page drops the in-memory admin token.
window.addEventListener('pagehide',()=>{authToken=null;clearInterval(poll);poll=null;});
