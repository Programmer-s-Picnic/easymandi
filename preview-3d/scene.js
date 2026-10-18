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
const compactMobile=window.matchMedia('(max-width:790px) and (pointer:coarse)').matches;
renderer.setPixelRatio(Math.min(compactMobile?1.25:2,window.devicePixelRatio||1));renderer.setSize(host.clientWidth,host.clientHeight);
renderer.shadowMap.enabled=!compactMobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
host.appendChild(renderer.domElement);
renderer.domElement.setAttribute('tabindex','0');renderer.domElement.setAttribute('aria-label','Walkable three-dimensional vegetable market. Use WASD to walk and drag to look around.');
renderer.domElement.style.touchAction='none';
const world=new THREE.Scene();world.background=new THREE.Color('#b4d7cd');world.fog=new THREE.Fog('#b4d7cd',32,78);
const camera=new THREE.PerspectiveCamera(72,Math.max(.3,host.clientWidth/host.clientHeight),.08,125);camera.position.set(0,1.68,window.matchMedia('(max-width:790px)').matches?35.4:29.2);
let yaw=0,pitch=0,last=performance.now(),walking=0,walkRows=3,nearest=null,stalls=[],hitMeshes=[];
let lastNearAt=0,pressed=new Set(),mobilePressed=new Set(),lookHeld=new Set(),activeDrag=null,clickStart=null;
let thumbVector={x:0,y:0},joystickPointer=null;
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
const boardCache=new Map();
function boardTexture(title,subtitle,light=false){
const key=String(title)+'|'+String(subtitle)+'|'+(light?'light':'dark');
if(boardCache.has(key))return boardCache.get(key);
const cv=document.createElement('canvas');cv.width=1024;cv.height=284;const c=cv.getContext('2d');
c.fillStyle=light?'#fae9af':'#1d654c';c.fillRect(0,0,1024,284);
c.strokeStyle=light?'#d3af60':'#e7ba63';c.lineWidth=14;c.strokeRect(12,12,1000,260);
c.textAlign='center';c.textBaseline='middle';c.fillStyle=light?'#244e39':'#fffbe9';
c.font='bold 97px system-ui';let s=String(title).slice(0,28);
while(c.measureText(s).width>920&&s.length>4){s=s.slice(0,-1);}c.fillText(s,512,115);
c.fillStyle=light?'#637047':'#f4d68c';c.font='bold 39px system-ui';c.fillText(String(subtitle).slice(0,35),512,213);
const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();boardCache.set(key,t);return t;
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
// Every visible crate is filled with dozens of low-poly instances representing
// a REAL in-stock product from this specific category. No generic five-piece crates.
const produceMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.84,metalness:0,vertexColors:false});
const dummyProduce=new THREE.Object3D();
const palettes={
tomato:['#c94d37','#db6044','#b8382f','#e16a4e'],
onion:['#c58e69','#dba57c','#b7815f','#d4a17f'],
potato:['#b79a6c','#b7a277','#a98a5d','#c5aa7c'],
carrot:['#d77a32','#e18a36','#ca6626','#ee9947'],
cauliflower:['#efe6cd','#fff5e0','#e0d7bb','#fff6eb'],
cabbage:['#8fc16a','#a8d17c','#81b963','#b2d795'],
leafy:['#4c954a','#73b95a','#3e8645','#a0c65a'],
chilli:['#287f43','#45954b','#2b7038','#81ae4c'],
garlic:['#f1e5d3','#e6d5b8','#fff6e5','#e1d5c4'],
ginger:['#c3a478','#b79364','#b89a70','#ddba86'],
eggplant:['#6c497e','#74418a','#8e5a98','#583a70'],
lemon:['#e4c853','#e8da69','#d7c253','#f0dd80'],
fruit:['#c96344','#deb44f','#91ab47','#d77d55'],
other:['#82a857','#d0a75b','#b97d51','#8eae68']
};
function produceKind(p){
 const s=[p.name,p.hindi,p.emoji].join(' ').toLocaleLowerCase();
 if(/tomato|टमाटर|🍅/.test(s))return 'tomato';
 if(/onion|प्याज|प्याज़|🧅/.test(s))return 'onion';
 if(/potato|आलू|🥔/.test(s))return 'potato';
 if(/cauliflower|फूलगोभी|🥦/.test(s))return 'cauliflower';
 if(/cabbage|पत्तागोभी|🥬/.test(s))return 'cabbage';
 if(/spinach|coriander|mint|methi|palak|धनिया|पालक|पुदीना|मेथी|leaf|greens|🌿/.test(s))return 'leafy';
 if(/carrot|गाजर|🥕/.test(s))return 'carrot';
 if(/chilli|chili|bhindi|okra|ladyfinger|cucumber|green pepper|मिर्च|भिंडी|खीरा|🌶|🥒/.test(s))return 'chilli';
 if(/garlic|लहसुन|🧄/.test(s))return 'garlic';
 if(/ginger|अदरक|🫚/.test(s))return 'ginger';
 if(/eggplant|brinjal|बैंगन|🍆/.test(s))return 'eggplant';
 if(/lemon|lime|नींबू|🍋/.test(s))return 'lemon';
 if(/banana|apple|mango|orange|grapes|fruit|केला|आम|सेब|संतरा|🍌|🍏|🍎/.test(s))return 'fruit';
 return /green|leaf|vegetable/i.test(p.category||'')?'leafy':'other';
}
function produceGeometry(kind){
 if(kind==='carrot')return new THREE.ConeGeometry(.135,.39,7,1);
 if(kind==='chilli')return new THREE.ConeGeometry(.095,.36,7,1);
 if(kind==='leafy')return new THREE.IcosahedronGeometry(.155,0);
 if(kind==='cauliflower')return new THREE.IcosahedronGeometry(.14,1);
 if(kind==='eggplant'||kind==='ginger')return new THREE.SphereGeometry(.15,9,7);
 return new THREE.SphereGeometry(.14,9,7);
}
function producePile(parent,x,baseY,z,product,seed){
 const kind=produceKind(product),colors=(palettes[kind]||palettes.other).map(c=>new THREE.Color(c));
 // 25 on the base, 16 stacked, 9 on top, so every crate looks full.
 const layers=[5,4,3],count=layers.reduce((n,v)=>n+v*v,0);
 const geometry=produceGeometry(kind),mesh=new THREE.InstancedMesh(geometry,produceMaterial,count);
 mesh.frustumCulled=true;
 let index=0;
 for(let layer=0;layer<layers.length;layer++){
  const side=layers[layer],spacing=kind==='leafy'?.255:.23,offset=(side-1)*spacing/2;
  for(let row=0;row<side;row++)for(let col=0;col<side;col++){
   // The deterministic variation makes the pile organic without flickering.
   const jitter=Math.sin((index+1)*12.23+seed*3.18);
   const positionX=(col*spacing-offset)+jitter*.012;
   const positionZ=(row*spacing-offset)+Math.cos((index+1)*8.71+seed)*.013;
   const y=baseY+.515+layer*.188+Math.sin((index+seed)*2.16)*.023;
   dummyProduce.position.set(x+positionX,y,z+positionZ);
   dummyProduce.rotation.set((index%5)*.17,(index%7)*.43,(index%3-1)*.12);
   if(kind==='potato'||kind==='ginger')dummyProduce.scale.set(1.08,.8,1.13);
   else if(kind==='eggplant')dummyProduce.scale.set(.85,1.47,.85);
   else if(kind==='leafy')dummyProduce.scale.set(1.2,1.35,1.15);
   else if(kind==='cauliflower')dummyProduce.scale.set(1.15,.98,1.12);
   else if(kind==='cabbage')dummyProduce.scale.set(1.19,1.05,1.14);
   else dummyProduce.scale.set(1,1,1);
   dummyProduce.updateMatrix();mesh.setMatrixAt(index,dummyProduce.matrix);
   mesh.setColorAt(index,colors[(index+seed)%colors.length]);
   index++;
  }
 }
 mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
 mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);
 // Small contrasting leaves make tomatoes / onions / carrots read more clearly.
 if(['tomato','onion','carrot','cauliflower','cabbage','garlic','chilli'].includes(kind)){
  const leafCount=kind==='cauliflower'?18:kind==='cabbage'?12:12;
  const leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(.082,.17,5),mats.leaf,leafCount);
  for(let i=0;i<leafCount;i++){
   const a=i*2.399,r=Math.sqrt((i%17)/17)*.43;
   dummyProduce.position.set(x+Math.cos(a)*r,baseY+.76+Math.sin(i)*.11,z+Math.sin(a)*r);
   dummyProduce.rotation.set(.4*Math.sin(i),i*.43,.8*Math.cos(i));
   dummyProduce.scale.setScalar(.8+(i%3)*.14);
   dummyProduce.updateMatrix();leaves.setMatrixAt(i,dummyProduce.matrix);
  }
  leaves.instanceMatrix.needsUpdate=true;leaves.computeBoundingSphere();leaves.castShadow=false;parent.add(leaves);
 }
}
function stockedCrate(g,x,y,z,product,side,seed,upper=false,backRow=false){
 const frame=upper?1.16:1.29;
 block(g,mats.pine,frame,.13,1.14,x,y+.08,z);
 block(g,mats.pineDark,.085,.43,1.14,x-frame/2+.04,y+.24,z);
 block(g,mats.pineDark,.085,.43,1.14,x+frame/2-.04,y+.24,z);
 block(g,mats.pineDark,frame,.39,.065,x,y+.255,z-.54);
 block(g,mats.pineDark,frame,.39,.065,x,y+.255,z+.54);
 producePile(g,x,y,z,product,seed);
 // Each crate has the actual name and current price, facing the walkway.
 const signX=side===-1?2.06:-2.06;
 const rowPrice=Number(product.price);
 const shortName=String(product.name||'Fresh produce').slice(0,20);
 const subtitle=(Number.isFinite(rowPrice)?'₹'+rowPrice.toFixed(rowPrice%1?2:0):'FRESH')+' / '+String(product.unit||'unit').slice(0,18);
 if(!backRow){const board=boardTexture(shortName,subtitle,true);
 placard(g,board,1.22,.43,signX,y+.83,z,side===-1?Math.PI/2:-Math.PI/2);}
}
function stockedSacks(root,kind,side){
 const sackMaterial=new THREE.MeshStandardMaterial({color:'#cbb58b',roughness:1});
 // Potato/onion/ginger shops often have extra jute sacks behind the counter.
 if(!['potato','onion','ginger','garlic'].includes(kind))return;
 for(let i=0;i<4;i++){
  const x=side===-1?-.92:.92,z=-1.73+i*1.14;
  const sack=new THREE.Mesh(new THREE.SphereGeometry(.45,10,7),sackMaterial);
  sack.position.set(x,.5,z);sack.scale.set(1,.93,.72);sack.rotation.z=(i%2?-.13:.11);
  sack.castShadow=true;root.add(sack);
 }
}
const market=new THREE.Group();world.add(market);
const floorGroup=new THREE.Group();market.add(floorGroup);
function makeStreet(rows){
const length=Math.max(42,rows*10+20),centerZ=18.5-length/2;
block(floorGroup,new THREE.MeshStandardMaterial({color:'#e5d9b7',roughness:1}),26,.22,length,0,-.16,centerZ,false);
// A separate forecourt starts beyond the entrance arch, so the visitor can see
// the complete gate from the outside before walking into the market.
block(floorGroup,new THREE.MeshStandardMaterial({color:'#b9ccaa',roughness:1}),26,.18,24,0,-.19,30.1,false);
block(floorGroup,new THREE.MeshStandardMaterial({color:'#f2e2c3',roughness:1}),8.35,.035,23.2,0,-.065,30.0,false);
for(let z=20.2;z<=41;z+=1.75)block(floorGroup,mats.cement,8.35,.008,.05,0,-.041,z,false);
for(const edge of [-4.3,4.3])block(floorGroup,mats.pineDark,.13,.09,23.2,edge,-.018,30.0,false);
block(floorGroup,new THREE.MeshStandardMaterial({color:'#f8eccc',roughness:1}),7.1,.035,length,0,-.03,centerZ,false);
for(let z=19;z>19-length;z-=2){block(floorGroup,mats.cement,7.1,.006,.055,0,.003,z,false);for(let x of [-3.58,3.58])block(floorGroup,mats.pineDark,.16,.13,2.1,x,.02,z,false);}
for(let x=-12;x<=12;x+=2){block(floorGroup,mats.cement,.035,.006,length,x,.001,centerZ,false);}
for(let z=19;z>19-length;z-=8){block(floorGroup,mats.rug,.46,.02,1.8,0,.02,z-.4,false);}
const lengthWall=length+8;
for(let side of [-1,1]){block(floorGroup,new THREE.MeshStandardMaterial({color:'#c1ccb6',roughness:1,transparent:true,opacity:.72}),.25,4.8,lengthWall,side*12.8,2.34,centerZ,false);}
return length;
}
let streetLength=makeStreet(walkRows);
function storeCategory(category,i,stockProducts){
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
// Ground counters and upper shelves are packed with this stall's real stock.
const inStock=(Array.isArray(stockProducts)?stockProducts:[]).filter(p=>p&&p.available!==false);
const frontX=side===-1?1.13:-1.13,backX=side===-1?-.54:.54;
const positions=[-1.77,-.59,.59,1.77];
if(inStock.length){
 for(let j=0;j<positions.length;j++){
  stockedCrate(root,frontX,.15,positions[j],inStock[j%inStock.length],side,i*30+j);
  stockedCrate(root,backX,.15,positions[j],inStock[(j+4)%inStock.length],side,i*30+8+j,false,true);
  stockedCrate(root,frontX,1.24,positions[j],inStock[(j+8)%inStock.length],side,i*30+16+j,true);
 }
 stockedSacks(root,produceKind(inStock[0]),side);
}else{
 placard(root,boardTexture('COMING SOON','NO ITEMS AVAILABLE',true),2.8,.72,frontX,1.85,0,side===-1?Math.PI/2:-Math.PI/2);
}
const title=category==='All'?'FRESH MARKET':category;
const big=boardTexture(title, 'FRESH · TODAY · MANDI RATE');
const signX=side===-1?2.17:-2.17;
placard(root,big,3.55,.97,signX,3.54,0,side===-1?Math.PI/2:-Math.PI/2);
const emoji=String(inStock[0]?.emoji||'🥬');
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
// The gate faces the waiting customer OUTSIDE (positive Z).
block(arch,mats.gold,9.56,.14,.86,0,5.42,0);
placard(arch,boardTexture('Easy Mandi', 'WELCOME TO YOUR FRESH MARKET',true),8.15,1.53,0,4.25,.48);
placard(arch,boardTexture('ईज़ी मंडी', 'ताज़गी आपके घर तक',true),8.15,1.53,0,4.25,-.48,Math.PI);
for(const x of [-4.2,4.2]){
 block(arch,mats.gold,.68,.58,.8,x,5.3,0);
}
for(const x of [-5.15,5.15]){
 const flower=new THREE.Mesh(new THREE.ConeGeometry(.48,1.6,7),mats.leaf);
 flower.position.set(x,.84,1.6);flower.castShadow=true;arch.add(flower);
 const pot=new THREE.Mesh(new THREE.CylinderGeometry(.4,.32,.52,10),mats.pineDark);
 pot.position.set(x,.26,1.6);arch.add(pot);
}
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
 const availableProducts=Array.isArray(products)?products.filter(p=>p&&p.available!==false):[];
 for(let i=0;i<list.length;i++){
  const matching=availableProducts.filter(p=>p.category===list[i]);
  storeCategory(list[i],i,matching);
 }
 if(!extrasReady){marketExtras(rows);extrasReady=true;}
 walkRows=rows;
}
function updateLabels(language){/* Sign boards retain bilingual produce illustrations and category names. */}
// Camera begins on the public approach facing the front of the Easy Mandi gateway.
function reset(){camera.position.set(0,1.68,window.matchMedia('(max-width:790px)').matches?35.4:29.2);yaw=0;pitch=0;nearest=null;app.near(null);resetJoystick();updateDirection();}
function updateDirection(){camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;}
function move(dx,dz,dt){const baseSpeed=pressed.has('ShiftLeft')||pressed.has('ShiftRight')?6.2:3.7;const len=Math.hypot(dx,dz);const speed=baseSpeed*Math.min(1,len);if(len>0){dx/=len;dz/=len;}const vx=dx*Math.cos(yaw)+dz*Math.sin(yaw),vz=dz*Math.cos(yaw)-dx*Math.sin(yaw);
const minZ=13-Math.max(2,walkRows-1)*9.4-6;camera.position.x=Math.max(-3.1,Math.min(3.1,camera.position.x+vx*dt*speed));camera.position.z=Math.max(minZ,Math.min(39.5,camera.position.z+vz*dt*speed));return len>0;}
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.052,(now-last)/1000||0);last=now;
const active=app.active&&!document.hidden;let forward=0,side=0;
if(active){if(pressed.has('KeyW')||pressed.has('ArrowUp')||mobilePressed.has('forward'))forward-=1;
if(pressed.has('KeyS')||pressed.has('ArrowDown')||mobilePressed.has('backward'))forward+=1;
if(pressed.has('KeyA')||mobilePressed.has('left'))side-=1;
if(pressed.has('KeyD')||mobilePressed.has('right'))side+=1;
if(lookHeld.has('left'))yaw+=1.25*dt;
if(lookHeld.has('right'))yaw-=1.25*dt;
side+=thumbVector.x;forward+=thumbVector.y;const walkingNow=move(side,forward,dt);if(walkingNow)walking+=dt*10;
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
window.addEventListener('keyup',e=>pressed.delete(e.code));window.addEventListener('blur',()=>{pressed.clear();mobilePressed.clear();lookHeld.clear();resetJoystick();});
const joystick=document.getElementById('walkJoystick'),thumb=document.getElementById('joystickThumb');
function resetJoystick(){joystickPointer=null;thumbVector={x:0,y:0};if(thumb)thumb.style.transform='translate(-50%,-50%) translate(0px,0px)';joystick?.classList.remove('is-active');}
function updateJoystick(e){
 if(!joystick||joystickPointer!==e.pointerId)return;
 const rect=joystick.getBoundingClientRect(),radius=Math.max(20,Math.min(rect.width,rect.height)*.31);
 let x=e.clientX-(rect.left+rect.width/2),y=e.clientY-(rect.top+rect.height/2);
 const magnitude=Math.hypot(x,y);
 if(magnitude>radius){x*=radius/magnitude;y*=radius/magnitude;}
 const deadzone=.12;
 const normX=x/radius,normY=y/radius;
 thumbVector={x:Math.abs(normX)>deadzone?normX:0,y:Math.abs(normY)>deadzone?normY:0};
 thumb.style.transform='translate(-50%,-50%) translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
}
if(joystick){
 joystick.addEventListener('pointerdown',e=>{
  if(!app.active||joystickPointer!==null)return;
  e.preventDefault();joystickPointer=e.pointerId;joystick.classList.add('is-active');
  try{joystick.setPointerCapture(e.pointerId);}catch{}
  updateJoystick(e);
  window.EMWalk?.dismissMobileHint?.();
 });
 joystick.addEventListener('pointermove',e=>{if(joystickPointer===e.pointerId){e.preventDefault();updateJoystick(e);}});
 for(const type of ['pointerup','pointercancel','lostpointercapture']){
  joystick.addEventListener(type,e=>{if(joystickPointer===e.pointerId)resetJoystick();});
 }
}
for(const button of document.querySelectorAll('[data-move]')){const dir=button.dataset.move;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);mobilePressed.add(dir);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>mobilePressed.delete(dir));}
for(const button of document.querySelectorAll('[data-look]')){const dir=button.dataset.look;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);lookHeld.add(dir);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>lookHeld.delete(dir));}
app.sceneReady({rebuild,reset,language:updateLabels});
requestAnimationFrame(animate);
}catch(e){console.error('3D market initialization error',e);app.failedWebGL();}
}