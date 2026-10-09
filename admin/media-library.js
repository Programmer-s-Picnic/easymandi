/* Easy Mandi administrator Media Library. Uploaded files are stored on cserver,
   not in localStorage, Github Pages or the catalogue JSON. */
(()=>{
 'use strict';
 const BASE='https://cserver.learnwithchampak.live/easymandi/api/admin-media.php';
 const IMAGE_BASE='https://cserver.learnwithchampak.live/easymandi/uploads/images/';
 const $=id=>document.getElementById(id);
 if(!$('mediaPanel'))return;
 let items=[],selection=null,localPreview='';
 const status=(message,kind='')=>{
   $('mediaStatus').textContent=message;
   $('mediaStatus').dataset.status=kind;
 };
 const allowed=(url)=>typeof url==='string'&&url.startsWith(IMAGE_BASE)&&
   /^https:\/\/cserver\.learnwithchampak\.live\/easymandi\/uploads\/images\/em-[a-f0-9]{24}\.webp$/.test(url);
 function mediaCard(row,mode){
   const card=document.createElement('article');card.className='media-card';
   const picture=document.createElement('img');picture.src=row.url;
   picture.alt='Uploaded product or category image';picture.loading='lazy';
   const label=document.createElement('small');label.textContent=row.name;
   const buttons=document.createElement('div');buttons.className='row';
   const copy=document.createElement('button');copy.className='btn secondary';
   copy.type='button';copy.textContent='Copy URL';
   copy.onclick=async()=>{
     try{await navigator.clipboard.writeText(row.url);status('Image URL copied.');}
     catch(_){status('Select and copy this URL: '+row.url,'error');}
   };
   buttons.append(copy);
   if(mode==='pick'){
     const use=document.createElement('button');use.className='btn';
     use.type='button';use.textContent='Use picture';
     use.onclick=()=>{
       if(selection)selection(row.url);
       $('mediaPickerDialog').close();
     };
     buttons.append(use);
   }
   card.append(picture,label,buttons);
   return card;
 }
 function render(){
   for(const [rootId,mode] of [['mediaGrid','library'],['mediaPickerGrid','pick']]){
     const root=$(rootId);root.replaceChildren();
     if(!items.length){const text=document.createElement('p');text.className='hint';text.textContent='No pictures uploaded yet.';root.append(text);continue;}
     for(const item of items)root.append(mediaCard(item,mode));
   }
 }
 function responseError(response,result){
   if(response.status===401){window.AdminSession.clear();return 'Admin session expired. Unlock administration again.';}
   return result?.error||'The media server is unavailable. Try again.';
 }
 async function load(){
   await window.AdminAccess.ensure();
   status('Loading server images…');
   const response=await AppHttp.fetch(BASE,{method:'GET',cache:'no-store',headers:{...window.AdminSession.headers()}});
   let result;try{result=await response.json();}catch{throw Error('Media server sent an invalid response.');}
   if(!response.ok)throw Error(responseError(response,result));
   items=(Array.isArray(result.images)?result.images:[]).filter(item=>allowed(item.url));
   render();
   status(items.length+' uploaded images available.');
   return items;
 }
 async function upload(){
   const input=$('mediaUploadFile'),file=input.files?.[0];
   if(!file){status('Choose an image first.','error');return;}
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)){status('Only JPEG, PNG or WebP pictures are supported.','error');return;}
   if(file.size>4194304||file.size<1){status('Use an image smaller than 4 MB.','error');return;}
   const button=$('mediaUpload');
   button.disabled=true;status('Uploading securely to cserver…');
   const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),60000);
   try{
     await window.AdminAccess.ensure();
     const body=new FormData();body.set('image',file);
     const response=await fetch(BASE,{
       method:'POST',cache:'no-store',headers:{...window.AdminSession.headers()},
       body,signal:abort.signal
     });
     let result;try{result=await response.json();}catch{throw Error('Media server sent an invalid response.');}
     if(!response.ok)throw Error(responseError(response,result));
     if(!allowed(result.url))throw Error('Media server returned an invalid image URL.');
     // Add immediately to the local library; the catalogue is saved separately.
     items=[{url:result.url,name:result.name||result.url.split('/').pop()},...items.filter(x=>x.url!==result.url)];
     input.value='';
     render();
     status('Picture uploaded successfully. URL: '+result.url);
   }catch(error){status(error.name==='AbortError'?'Upload timed out. Try again.':error.message||'Image upload failed.','error');}
   finally{clearTimeout(timeout);button.disabled=false;}
 }
 $('mediaUpload').addEventListener('click',upload);
 $('mediaRefresh').addEventListener('click',()=>load().catch(error=>status(error.message,'error')));
 $('mediaUploadFile').addEventListener('change',()=>{
   if(localPreview)URL.revokeObjectURL(localPreview);
   const file=$('mediaUploadFile').files?.[0];
   localPreview=file?URL.createObjectURL(file):'';
   $('mediaUploadPreview').hidden=!localPreview;
   if(localPreview)$('mediaUploadPreview').src=localPreview;
 });
 $('mediaPickerClose').addEventListener('click',()=>$('mediaPickerDialog').close());
 $('mediaPickerRefresh').addEventListener('click',()=>load().catch(error=>status(error.message,'error')));
 $('mediaPickerDialog').addEventListener('close',()=>{selection=null;});
 window.EasyMandiMedia=Object.freeze({
   async pick(callback){
     if(typeof callback!=='function')return;
     selection=callback;
     $('mediaPickerDialog').showModal();
     try{await load();}
     catch(error){status(error.message,'error');}
   },
   refresh:()=>load(),
   get images(){return [...items];}
 });
})();
