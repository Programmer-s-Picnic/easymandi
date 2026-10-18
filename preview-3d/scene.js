/* First-person walk-through marketplace. Three.js is visualization only.
   The live Easy Mandi storefront handles all commercial transactions. */
const app=window.EMWalk;
if(!app){throw new Error('Easy Mandi walk controller unavailable');}
let THREE;
try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js');}
catch(first){try{THREE=await import('https://unpkg.com/three@0.164.1/build/three.module.js');}catch(e){console.warn('3D engine unavailable',first,e);app.failedWebGL();}}
if(THREE){
try{
const host=document.getElementById('canvasHost'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.matchMedia('(max-width: 790px)').matches?1.5:2,window.devicePixelRatio||1));renderer.setSize(host.clientWidth,host.clientHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
host.appendChild(renderer.domElement);
renderer.domElement.setAttribute('tabindex','0');renderer.domElement.setAttribute('aria-label','Walkable three-dimensional vegetable market. Use WASD to walk and drag to look around.');
renderer.domElement.style.touchAction='none';
const world=new THREE.Scene();world.background=new THREE.Color('#b4d7cd');world.fog=new THREE.Fog('#b4d7cd',32,78);
const camera=new THREE.PerspectiveCamera(72,Math.max(.3,host.clientWidth/host.clientHeight),.08,125);camera.position.set(0,1.68,17.8);
let yaw=0,pitch=0,last=performance.now(),walking=0,walkRows=3,nearest=null,stalls=[],hitMeshes=[];
let lastNearAt=0,pressed=new Set(),mobilePressed=new Set(),lookHeld=new Set(),activeDrag=null,clickStart=null;
const price=n=>'₹'+Math.round(Number(n)||0);
const mats={
cream:new THREE.MeshStandardMaterial({color:'#f2e2bd',roughness:.94}),
pine:new THREE.MeshStandardMaterial({color:'#ab8458',roughness:.95}),
pineDark:new THREE.MeshStandardMaterial({color:'#785535',roughness:.91}),
leaf:new THREE.MeshStandardMaterial({color:'#4a8151',roughness:.82}),
gold:new THREE.MeshStandardMaterial({color:'#ebc77c',roughness:.87}),
cement:new THREE.MeshStandardMaterial({color:'#d5c5a4',roughness:1}),
concrete:new THREE.MeshStandardMaterial({color:'#f2e8d5',roughness:1}),
sign:new THREE.MeshBasicMaterial({color:'#2e684b'}),
rug:new THREE.MeshStandardMaterial({color:'#9db293',roughness:1}),
};
world.add(new THREE.HemisphereLight('#fffbea','#759b73',2.4));
const sun=new THREE.DirectionalLight('#fff4cb',3.2);sun.position.set(-12,27,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=38;sun.shadow.camera.bottom=-55;sun.shadow.normalBias=.025;world.add(sun);
const fill=new THREE.DirectionalLight('#cee9ed',.85);fill.position.set(15,9,-19);world.add(fill);
function block(group,material,w,h,d,x,y,z,cast=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;group.add(m);return m;}
function cylinder(group,material,top,bottom,height,x,y,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,9),material);m.position.set(x,y,z);m.castShadow=true;group.add(m);return m;}
function boardTexture(title,subtitle,light=false){
const cv=document.createElement('canvas');cv.width=1024;cv.height=284;const c=cv.getContext('2d');
c.fillStyle=light?'#fae9af':'#1d654c';c.fillRect(0,0,1024,284);
c.strokeStyle=light?'#d3af60':'#e7ba63';c.lineWidth=14;c.strokeRect(12,12,1000,260);
c.textAlign='center';c.textBaseline='middle';c.fillStyle=light?'#244e39':'#fffbe9';
c.font='bold 97px system-ui';let s=String(title).slice(0,28);
while(c.measureText(s).width>920&&s.length>4){s=s.slice(0,-1);}c.fillText(s,512,115);
c.fillStyle=light?'#637047':'#f4d68c';c.font='bold 39px system-ui';c.fillText(String(subtitle).slice(0,35),512,213);
const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
}
function placard(group,texture,w,h,x,y,z,ry=0){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:false,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=ry;group.add(mesh);return mesh;}
function emojiTexture(emoji){const cv=document.createElement('canvas');cv.width=256;cv.height=256;const c=cv.getContext('2d');c.font='175px "Segoe UI Emoji", "Apple Color Emoji",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(emoji,128,142);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;}
const emojiCache=new Map();
function emojiPlane(parent,text,x,y,z,scale=1,rotation=0){if(!emojiCache.has(text))emojiCache.set(text,emojiTexture(text));const mesh=new THREE.Mesh(new THREE.PlaneGeometry(scale,scale),new THREE.MeshBasicMaterial({map:emojiCache.get(text),side:THREE.DoubleSide,transparent:true,depthWrite:false}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);return mesh;}
function flowerPatch(group,x,z){for(let i=0;i<9;i++){const angle=i*2.39,r=(i%3)*.48+.2;const grass=new THREE.Mesh(new THREE.ConeGeometry(.07,.3,4),mats.leaf);grass.position.set(x+Math.cos(angle)*r,.16,z+Math.sin(angle)*r);group.add(grass);}}
function stemProduce(group,x,y,z,color){
const palette=new THREE.MeshStandardMaterial({color,roughness:.56});
const fruit=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),palette);fruit.position.set(x,y,z);fruit.scale.set(1,.85,1);fruit.castShadow=true;group.add(fruit);
const leaf=new THREE.Mesh(new THREE.ConeGeometry(.09,.15,5),mats.leaf);leaf.position.set(x,y+.25,z);group.add(leaf);
}
function crate(g,x,y,z,priceLabel,emoji){
block(g,mats.pine,1.3,.20,1.25,x,y+.1,z);
block(g,mats.pineDark,.08,.5,1.25,x-.61,y+.25,z);
block(g,mats.pineDark,.08,.5,1.25,x+.61,y+.25,z);
block(g,mats.pineDark,1.25,.4,.08,x,y+.25,z-.59);
block(g,mats.pineDark,1.25,.4,.08,x,y+.25,z+.59);
const greens=['#d3604a','#70a459','#d2a253','#8eab4b','#eba957'];
for(let i=0;i<5;i++){stemProduce(g,x+(i%3-1)*.32,y+.54+(i===4?.06:0),z+Math.floor(i/3)*.37-.18,greens[(i+Math.floor(x*10))%greens.length]);}
emojiPlane(g,emoji,x,y+.8,z+.1,.73);
}
const market=new THREE.Group();world.add(market);
const floorGroup=new THREE.Group();market.add(floorGroup);
function makeStreet(rows){
const length=Math.max(42,rows*10+20),centerZ=18.5-length/2;
block(floorGroup,new THREE.MeshStandardMaterial({color:'#e5d9b7',roughness:1}),26,.22,length,0,-.16,centerZ,false);
block(floorGroup,new THREE.MeshStandardMaterial({color:'#f8eccc',roughness:1}),7.1,.035,length,0,-.03,centerZ,false);
for(let z=19;z>19-length;z-=2){block(floorGroup,mats.cement,7.1,.006,.055,0,.003,z,false);for(let x of [-3.58,3.58])block(floorGroup,mats.pineDark,.16,.13,2.1,x,.02,z,false);}
for(let x=-12;x<=12;x+=2){block(floorGroup,mats.cement,.035,.006,length,x,.001,centerZ,false);}
for(let z=19;z>19-length;z-=8){block(floorGroup,mats.rug,.46,.02,1.8,0,.02,z-.4,false);}
const lengthWall=length+8;
for(let side of [-1,1]){block(floorGroup,new THREE.MeshStandardMaterial({color:'#c1ccb6',roughness:1,transparent:true,opacity:.72}),.25,4.8,lengthWall,side*12.8,2.34,centerZ,false);}
return length;
}
let streetLength=makeStreet(walkRows);
function storeCategory(category,i){
const side=i%2===0?-1:1,row=Math.floor(i/2),z=10-row*9.4,x=side*7.5,face=side===-1?1:-1;
const root=new THREE.Group();root.position.set(x,0,z);market.add(root);
const oak=mats.pine,frame=mats.pineDark;
const canopyColors=['#ba6e58','#478668','#bb934c','#8b86a3','#d48a70','#a88955'];
const color=canopyColors[row%canopyColors.length];const fabricA=new THREE.MeshStandardMaterial({color,roughness:.96,side:THREE.DoubleSide});
const fabricB=new THREE.MeshStandardMaterial({color:'#f1e0b1',roughness:1,side:THREE.DoubleSide});
const inward=-side;
block(root,mats.cream,4.65,.14,6.7,0,.08,0);
block(root,oak,4.45,.12,4.5,0,1.18,0);
block(root,frame,4.7,.16,4.9,0,1.05,0);
for(const dx of [-1.95,1.95])for(const dz of [-2.12,2.12]){cylinder(root,frame,.115,.15,3,dx,1.63,dz);}
block(root,mats.pineDark,4.7,.17,5.2,0,3.18,0);
for(let j=0;j<7;j++){const wx=-2.03+j*.68;block(root,j%2===0?fabricA:fabricB,.66,.075,5.4,wx,3.12,0,false);}
for(const front of [-1,1]){block(root,fabricA,4.4,.38,.12,0,2.82,front*2.6,false);}
for(const off of [-.9,.9]){
 const crateX=side===-1?1.0:-1.0;
 crate(root,crateX,.45,off,price(30+i*5),['🥕','🍅','🥬','🥔','🌽','🍆'][i%6]);
}
const title=category==='All'?'FRESH MARKET':category;
const big=boardTexture(title, 'FRESH · TODAY · MANDI RATE');
const signX=side===-1?2.17:-2.17;
placard(root,big,3.55,.97,signX,2.49,0,side===-1?Math.PI/2:-Math.PI/2);
const emoji=['🥬','🍅','🥔','🌽','🥕','🍆','🫑','🍋'][i%8];
emojiPlane(root,emoji,signX+face*.07,1.68,-1.25,.94,side===-1?Math.PI/2:-Math.PI/2);
const rugs=new THREE.Mesh(new THREE.CircleGeometry(.62,24),new THREE.MeshStandardMaterial({color:'#c8b58b',roughness:1}));rugs.rotation.x=-Math.PI/2;rugs.position.set(signX+face*.65,.045,0);root.add(rugs);
const hit=new THREE.Mesh(new THREE.BoxGeometry(4.9,3.9,5.8),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(0,1.9,0);root.add(hit);hit.userData.category=category;hitMeshes.push(hit);
const spotlight=new THREE.PointLight('#ffd1a0',1.2,8,2);spotlight.position.set(0,2.5,0);root.add(spotlight);
stalls.push({category,z,x,side,emoji,root,titleMesh:null,texture:big});
return root;
}
const hanging=new THREE.Group();world.add(hanging);
function lantern(x,z){const bulb=new THREE.PointLight('#ffe5ab',1.6,8,2);bulb.position.set(x,4.35,z);hanging.add(bulb);cylinder(hanging,mats.pineDark,.035,.035,.8,x,5.05,z);const shape=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),new THREE.MeshBasicMaterial({color:'#ffe0a0'}));shape.position.set(x,4.3,z);hanging.add(shape);}
function marketExtras(rows){for(let i=0;i<rows+2;i++){const z=13-i*8.3;lantern(0,z);for(const sx of [-10.7,10.7]){const post=cylinder(hanging,mats.pineDark,.1,.13,4.3,sx,2.12,z);const flag=block(hanging,i%2?mats.gold:mats.leaf,.65,.5,.04,sx/1.1,3.9,z,false);flag.rotation.z=i%2?.11:-.11;}}
for(let z=12;z>14-rows*9;z-=8){flowerPatch(hanging,-11,z);flowerPatch(hanging,11,z);}
const arch=new THREE.Group();arch.position.set(0,0,20.5);world.add(arch);
cylinder(arch,mats.pineDark,.3,.3,5.3,-4.2,2.5,0);
cylinder(arch,mats.pineDark,.3,.3,5.3,4.2,2.5,0);
block(arch,mats.pine,9.3,.5,.7,0,5.05,0);
placard(arch,boardTexture('ईज़ीमंडी', 'WELCOME · ताज़गी का बाज़ार',true),7.6,1.42,0,4.25,.44);
}
let extrasReady=false;
function disposeGroup(group){group.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();/* Shared palette materials are retained; the renderer reuses them across market rebuilds. */});}
function rebuild(cats,products){
 const list=(Array.isArray(cats)?cats:[]).filter(x=>x!=='All').slice(0,18);
 if(!list.length)list.push('Vegetables','Fruits','Leafy greens','Essentials');
 for(const stall of stalls){market.remove(stall.root);disposeGroup(stall.root);}
 stalls=[];hitMeshes=[];const rows=Math.ceil(Math.max(6,list.length)/2);
 while(floorGroup.children.length){const child=floorGroup.children[0];floorGroup.remove(child);if(child?.geometry)child.geometry.dispose();}
 streetLength=makeStreet(rows);
 for(let i=0;i<list.length;i++)storeCategory(list[i],i);
 if(!extrasReady){marketExtras(rows);extrasReady=true;}
 walkRows=rows;
}
function updateLabels(language){/* Sign boards retain bilingual produce illustrations and category names. */}
const clock=new THREE.Clock();
function reset(){camera.position.set(0,1.68,17.8);yaw=0;pitch=0;updateDirection();}
function updateDirection(){camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;}
function move(dx,dz,dt){const speed=pressed.has('ShiftLeft')||pressed.has('ShiftRight')?6.2:3.7;const len=Math.hypot(dx,dz);if(len>0){dx/=len;dz/=len;}const vx=dx*Math.cos(yaw)+dz*Math.sin(yaw),vz=dz*Math.cos(yaw)-dx*Math.sin(yaw);
const minZ=13-Math.max(2,walkRows-1)*9.4-6;camera.position.x=Math.max(-3.1,Math.min(3.1,camera.position.x+vx*dt*speed));camera.position.z=Math.max(minZ,Math.min(19.1,camera.position.z+vz*dt*speed));return len>0;}
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.052,(now-last)/1000||0);last=now;
const active=app.active&&!document.hidden;let forward=0,side=0;
if(active){if(pressed.has('KeyW')||pressed.has('ArrowUp')||mobilePressed.has('forward'))forward-=1;
if(pressed.has('KeyS')||pressed.has('ArrowDown')||mobilePressed.has('backward'))forward+=1;
if(pressed.has('KeyA')||mobilePressed.has('left'))side-=1;
if(pressed.has('KeyD')||mobilePressed.has('right'))side+=1;
if(lookHeld.has('left'))yaw+=1.25*dt;
if(lookHeld.has('right'))yaw-=1.25*dt;
const walkingNow=move(side,forward,dt);if(walkingNow)walking+=dt*10;
camera.position.y=1.68+(walkingNow?Math.sin(walking)*.045:0);
}
updateDirection();
if(active&&now-lastNearAt>240){lastNearAt=now;let near=null,distance=7;for(const stall of stalls){const d=Math.hypot(camera.position.z-stall.z,camera.position.x-stall.x);if(d<distance){distance=d;near=stall;}}if(near!==nearest){nearest=near;app.near(near);}}
renderer.render(world,camera);
}
window.addEventListener('resize',()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=Math.max(.3,w/h);camera.updateProjectionMatrix();renderer.setSize(w,h);});
const canvas=renderer.domElement;
const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
function clicked(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(hitMeshes,false);if(hits.length&&hits[0].distance<15){app.stallSelect(hits[0].object.userData.category);return true;}return false;}
canvas.addEventListener('pointerdown',e=>{if(!app.active)return;activeDrag={x:e.clientX,y:e.clientY,initialX:e.clientX,initialY:e.clientY,id:e.pointerId};try{canvas.setPointerCapture(e.pointerId);}catch{}});
canvas.addEventListener('pointermove',e=>{if(!activeDrag||!app.active)return;const dx=e.clientX-activeDrag.x,dy=e.clientY-activeDrag.y;yaw-=dx*.004;pitch=Math.max(-.7,Math.min(.6,pitch-dy*.0035));activeDrag.x=e.clientX;activeDrag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!activeDrag)return;const delta=Math.hypot(e.clientX-activeDrag.initialX,e.clientY-activeDrag.initialY);activeDrag=null;if(delta<9&&app.active)clicked(e);});
canvas.addEventListener('pointercancel',()=>activeDrag=null);
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable)return;if(e.code==='KeyR'&&app.active)reset();if(e.code==='KeyE'&&app.active&&nearest){e.preventDefault();app.stallSelect(nearest.category);}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)&&app.active){e.preventDefault();pressed.add(e.code);}if(e.code==='ArrowLeft'&&app.active){yaw+=.075;}if(e.code==='ArrowRight'&&app.active){yaw-=.075;}});
window.addEventListener('keyup',e=>pressed.delete(e.code));window.addEventListener('blur',()=>{pressed.clear();mobilePressed.clear();lookHeld.clear();});
for(const button of document.querySelectorAll('[data-move]')){const dir=button.dataset.move;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);mobilePressed.add(dir);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>mobilePressed.delete(dir));}
for(const button of document.querySelectorAll('[data-look]')){const dir=button.dataset.look;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);lookHeld.add(dir);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>lookHeld.delete(dir));}
app.sceneReady({rebuild,reset,language:updateLabels});
requestAnimationFrame(animate);
}catch(e){console.error('3D market initialization error',e);app.failedWebGL();}
}