/* Easy Mandi Living Market V2 — visual-only, no production/customer data. */
export function createLivingMandi({THREE,world,renderer,camera,mobile=false}){
 const actors=new THREE.Group();actors.name='Simulated shoppers and vendors';world.add(actors);
 const shoppers=[],vendors=[],awnings=[];
 const mats=new Map();
 const material=c=>{if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.85}));return mats.get(c);};
 const shared={
  head:new THREE.SphereGeometry(.18,10,8),
  hair:new THREE.SphereGeometry(.186,10,8,0,Math.PI*2,0,Math.PI*.53),
  body:new THREE.CylinderGeometry(.21,.24,.62,8),
  arm:new THREE.CylinderGeometry(.068,.065,.49,7),
  leg:new THREE.CylinderGeometry(.083,.08,.62,7),
  shoe:new THREE.BoxGeometry(.17,.12,.25),
  basket:new THREE.CylinderGeometry(.32,.24,.22,10),
  produce:new THREE.IcosahedronGeometry(.11,0),
  face:new THREE.SphereGeometry(.073,6,5),
 };
 const skins=['#a67558','#c69173','#8b634d','#daa27c'];
 const shirts=['#448a70','#bc7258','#7896bf','#bc965d','#937db0','#6b9f75','#b56f59'];
 const pants=['#354b58','#505051','#586c54','#766457'];
 const flags=['#d5aa7a','#f7dfab','#a9bd91'];
 const groupMesh=(p,geo,color,x=0,y=0,z=0)=>{
  const m=new THREE.Mesh(geo,typeof color==='string'?material(color):color);
  m.position.set(x,y,z);m.castShadow=false;p.add(m);return m;
 };
 const box=(p,w,h,d,x,y,z,color)=>groupMesh(p,new THREE.BoxGeometry(w,h,d),color,x,y,z);
 const cylinder=(p,a,b,h,x,y,z,color)=>groupMesh(p,new THREE.CylinderGeometry(a,b,h,9),color,x,y,z);
 function makeHuman(i,vendor=false){
  const p=new THREE.Group(),torso=new THREE.Group(),arms=[],legs=[];
  const color=skins[i%skins.length],shirt=shirts[(i+(vendor?3:0))%shirts.length],trouser=pants[i%pants.length];
  torso.position.y=1.12;p.add(torso);
  groupMesh(torso,shared.body,shirt,0,0,0);
  groupMesh(torso,shared.head,color,0,.53,0);
  groupMesh(torso,shared.hair,i%4===0?'#513d31':'#292c29',0,.60,0);
  for(const side of [-1,1]){
   const a=new THREE.Group();a.position.set(side*.25,.27,0);
   groupMesh(a,shared.arm,shirt,0,-.25,0);
   groupMesh(a,shared.face,color,0,-.50,0);torso.add(a);arms.push(a);
   const l=new THREE.Group();l.position.set(side*.115,.71,0);
   groupMesh(l,shared.leg,trouser,0,-.31,0);
   groupMesh(l,shared.shoe,'#38423b',0,-.65,-.06);
   p.add(l);legs.push(l);
  }
  if(!vendor&&i%3===0){
   const bag=box(arms[1],.30,.32,.15,.02,-.75,0,'#edc575');
   groupMesh(arms[1],new THREE.TorusGeometry(.095,.018,5,12,Math.PI),'#8c6b3b',.02,-.55,0).rotation.z=Math.PI/2;
  }
  // An occasional delivery worker moves a small, non-interactive produce cart.
  if(!vendor&&i%9===6){
   const trolley=new THREE.Group();
   trolley.position.set(0,0,-.84);
   box(trolley,.65,.14,.78,0,.52,0,'#9e774c');
   box(trolley,.66,.38,.07,0,.68,.37,'#755638');
   box(trolley,.66,.38,.07,0,.68,-.37,'#755638');
   for(const x of [-.32,.32]){
    const wheel=cylinder(trolley,.16,.16,.075,x,.2,.25,'#343a34');
    wheel.rotation.z=Math.PI/2;
    const wheel2=cylinder(trolley,.16,.16,.075,x,.2,-.25,'#343a34');
    wheel2.rotation.z=Math.PI/2;
   }
   for(let n=0;n<7;n++){
    groupMesh(trolley,shared.produce,n%2?'#6e9856':'#d27e4d',((n%3)-1)*.19,.65+(n%2)*.13,(Math.floor(n/3)-1)*.19);
   }
   box(trolley,.05,.75,.05,-.3,.94,.43,'#775c3b');
   box(trolley,.05,.75,.05,.3,.94,.43,'#775c3b');
   p.add(trolley);
  }
  p.scale.setScalar(.94+(i%4)*.04);
  // Footprint of the whole character, including the occasional pushcart.
  const hasTrolley=!vendor&&i%9===6;
  return {root:p,torso,arms,legs,phase:i*1.7,id:i,direction:i%2?-1:1,
    radius:hasTrolley?.74:.39,pause:0,wait:2+i*.31};
 }
 function decorate(stall,i,items){
  const root=stall.root,side=stall.side;
  // Distinct canopy trim, baskets, shelves and a manual weighing scale.
  for(const z of [-1.8,-.6,.6,1.8]){
   box(root,3.65,.075,.09,0,1.51,z,'#7f583b');
   box(root,3.65,.07,.09,0,.79,z,'#a77d54');
  }
  for(let k=0;k<7;k++){
   const flap=new THREE.Group();
   flap.position.set(side===-1?2.18:-2.18,2.87,-2.11+k*.69);
   box(flap,.05,.38,.55,0,-.19,0,flags[(i+k)%flags.length]);
   root.add(flap);awnings.push({group:flap,seed:i*3+k});
  }
  // A balancing scale and baskets are decoration, not interactive controls.
  const scale=new THREE.Group();scale.position.set(side===-1?-.79:.79,1.42,-1.64);
  cylinder(scale,.035,.035,.49,0,.25,0,'#a6b5ad');
  box(scale,.72,.04,.06,0,.53,0,'#728a83');
  for(const sign of [-1,1]){
   cylinder(scale,.015,.015,.26,sign*.29,.37,0,'#9aa9a4');
   cylinder(scale,.22,.17,.065,sign*.29,.20,0,'#c4b8a0');
  }
  root.add(scale);
  const tagColors=['#bb7354','#779e5d','#d5b16e'];
  for(let k=0;k<3;k++){
   const z=-1.66+k*1.7,x=side===-1?-.9:.9;
   cylinder(root,.36,.27,.25,x,.37,z,'#b99261');
   if(items.length)for(let n=0;n<8;n++){
    const theta=n*Math.PI/4;
    groupMesh(root,shared.produce,tagColors[(n+i+k)%3],x+Math.cos(theta)*.20,.56,z+Math.sin(theta)*.20);
   }
  }
  if(items.length){
   const v=makeHuman(i+23,true);
   v.root.position.set(stall.x+(side===-1?-1.52:1.52),0,stall.z+.13);
   v.root.rotation.y=side===-1?-Math.PI/2:Math.PI/2;
   v.stall=stall;actors.add(v.root);vendors.push(v);
  }
 }
 let quality='auto',crowdEnabled=true,visible=0,reduction=0,slowSeconds=0;
 function applyQuality(){
  const max=quality==='battery'?(mobile?4:6):quality==='high'?(mobile?8:16):(mobile?7:12);
  visible=crowdEnabled?Math.max(0,max-reduction):0;
  shoppers.forEach((p,i)=>p.root.visible=i<visible);
  vendors.forEach(v=>v.root.visible=crowdEnabled);
  renderer.shadowMap.enabled=!mobile&&quality!=='battery';
  const dpr=quality==='battery'?(mobile?1:1.25):quality==='high'?(mobile?1.5:2):(mobile?1.2:1.65);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,dpr));
 }
 function resetCrowd(){
  for(const p of [...shoppers,...vendors])actors.remove(p.root);
  shoppers.length=0;vendors.length=0;awnings.length=0;
 }
 function rebuild(stalls,products){
  resetCrowd();
  const available=Array.isArray(products)?products.filter(p=>p&&p.available!==false):[];
  stalls.forEach((stall,i)=>decorate(stall,i,available.filter(p=>p.category===stall.category)));
  const inside=Math.min(-5,10-(Math.max(1,Math.ceil(stalls.length/2))-1)*9.4-7);
  // Two separated traffic lanes. Spread all spawn points so even a high
  // graphics-quality setting never begins with overlapping characters.
  const rows=9,step=Math.min(5.4,(26-(inside+1.8))/(rows-1));
  for(let i=0;i<18;i++){
   const p=makeHuman(i+1);
   p.lane=i%2?1.52:-1.52;
   p.minZ=inside;
   p.z=26-Math.floor(i/2)*step;
   p.speed=.72+(i%5)*.12;p.pause=0;
   p.root.position.set(p.lane,0,p.z);
   p.root.rotation.y=p.direction===-1?0:Math.PI;
   actors.add(p.root);shoppers.push(p);
  }
  applyQuality();
 }
 // Shoppers are discs in the ground plane. A gap between their footprints
 // keeps arms, shopping bags and trolley geometry from cutting through people.
 const clearance=(a,b)=>a.radius+b.radius+.22;
 const cameraRadius=.44;
 function canMoveTo(x,z){
  for(const p of shoppers){
   if(!p.root.visible)continue;
   if(Math.hypot(x-p.root.position.x,z-p.z)<p.radius+cameraRadius+.10)return false;
  }
  return true;
 }
 // Sort within each direction from the front of the queue backwards. Leaders
 // move first and followers yield instead of crossing through stalled shoppers.
 function moveCrowd(dt,player){
  const moving=shoppers.filter(p=>p.root.visible).sort((a,b)=>
   a.direction===b.direction
    ? a.direction*(b.z-a.z)
    : a.id-b.id);
  for(const p of moving){
   if(p.pause>0){p.pause=Math.max(0,p.pause-dt);}
   else{
    p.wait-=dt;
    if(p.wait<0){
     const atShop=vendors.some(v=>Math.abs(p.z-v.stall.z)<.65);
     if(atShop){p.pause=2.2+(p.id%3)*.65;p.wait=5+(p.id%4)*2;}
     else p.wait=.6;
    }
   }
   let travel=p.pause>0?0:p.speed*dt;
   for(const q of shoppers){
    if(q===p||!q.root.visible)continue;
    const dx=p.lane-q.root.position.x;
    const needed=clearance(p,q);
    if(Math.abs(dx)>=needed)continue;
    // Only someone ahead in our direction can limit progress. People
    // coming the other way occupy the opposite marked walking lane.
    const dz=p.direction*(q.z-p.z);
    if(dz<0)continue;
    const zGap=Math.sqrt(Math.max(0,needed*needed-dx*dx));
    travel=Math.min(travel,Math.max(0,dz-zGap));
   }
   // A real visitor walking into a lane gets right of way. The NPC stops
   // rather than sliding sideways through other simulated shoppers.
   if(player){
    const dx=p.lane-player.x,needed=p.radius+cameraRadius+.19;
    if(Math.abs(dx)<needed){
     const dz=p.direction*(player.z-p.z);
     if(dz>=0){
      const gap=Math.sqrt(Math.max(0,needed*needed-dx*dx));
      travel=Math.min(travel,Math.max(0,dz-gap));
     }
    }
   }
   const candidate=p.z+p.direction*travel;
   if(candidate<p.minZ){p.z=p.minZ;p.direction=1;p.pause=.55;}
   else if(candidate>29){p.z=29;p.direction=-1;p.pause=.5;}
   else p.z=candidate;
   p.root.position.z=p.z;
   // Fixed separate lanes remove the previous sudden lateral swings which
   // caused two bodies to briefly occupy the same space while passing.
   p.root.position.x=p.lane;
   p.isWalking=travel>.0003;
  }
 }
 function animatePeople(t){
  for(let i=0;i<shoppers.length;i++){
   const p=shoppers[i];if(!p.root.visible)continue;
   const targetYaw=p.direction===-1?0:Math.PI;
   const angle=((targetYaw-p.root.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
   p.root.rotation.y+=angle*.18;
   const gait=p.isWalking?Math.sin(t*(p.speed*7)+p.phase)*.37:0;
   p.legs[0].rotation.x=gait;p.legs[1].rotation.x=-gait;
   p.arms[0].rotation.x=-gait*.62;p.arms[1].rotation.x=gait*.62;
   p.torso.rotation.y=p.isWalking?0:Math.sin(t*.7+i)*.18;
   p.root.position.y=p.isWalking?.022*Math.abs(Math.sin(t*7+i)):0;
  }
 }
 function update(dt,ms,player,active=true){
  const t=ms*.001;
  for(const awning of awnings)awning.group.rotation.z=Math.sin(t*.8+awning.seed)*.055;
  for(const v of vendors){
   if(!v.root.visible)continue;
   const phase=t*.85+v.phase;
   v.torso.rotation.y=Math.sin(phase*.55)*.075;
   v.arms[0].rotation.x=-.2-.28*(.5+.5*Math.sin(phase));
   v.arms[1].rotation.x=-.18-.39*Math.pow(Math.max(0,Math.sin(phase*.9)),3);
   v.arms[1].rotation.z=Math.sin(phase)*.08;
  }
  if(!active)return;
  moveCrowd(Math.min(dt,.06),player);
  animatePeople(t);
  if(quality==='auto'){
   if(dt>.04)slowSeconds+=dt;else slowSeconds=Math.max(0,slowSeconds-dt*.3);
   if(slowSeconds>3.5&&reduction<3){reduction++;slowSeconds=0;applyQuality();}
  }
 }
 function setQuality(v){quality=['auto','battery','high'].includes(v)?v:'auto';reduction=0;slowSeconds=0;applyQuality();}
 function setCrowd(v){crowdEnabled=!!v;applyQuality();}
 function getState(){return {quality,crowdEnabled,shoppersVisible:visible,vendors:crowdEnabled?vendors.length:0};}
 return {rebuild,update,setQuality,setCrowd,getState,canMoveTo};
}