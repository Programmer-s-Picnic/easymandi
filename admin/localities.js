/* Easy Mandi Localities Master — server-authoritative Varanasi delivery areas. */
(()=>{
  'use strict';
  if(document.documentElement.dataset.adminPage!=='localities')return;
  const by=id=>document.getElementById(id),endpoint='https://cserver.learnwithchampak.live/easymandi/api/admin-localities.php';
  let revision=null,rows=[],dirty=false;
  const status=(message,error=false)=>{by('localityStatus').textContent=message;by('localityStatus').dataset.error=error?'yes':'no';};
  async function request(method,payload){
    await window.AdminAccess.ensure();
    const resp=await AppHttp.fetch(endpoint,{method,cache:'no-store',headers:{
      ...window.AdminSession.headers(),...(payload?{'Content-Type':'application/json'}:{})
    },...(payload?{body:JSON.stringify(payload)}:{})});
    let data;try{data=await resp.json();}catch{throw Error('Invalid locality server response');}
    if(!resp.ok)throw Error(data.error||'Localities request failed');
    return data;
  }
  function render(){
    const root=by('localityRows');root.replaceChildren();
    rows.forEach((entry,index)=>{
      const row=document.createElement('div');row.className='locality-master-row';
      const name=document.createElement('input');name.value=entry.name;
      name.maxLength=80;name.required=true;name.setAttribute('aria-label','Locality name');
      name.addEventListener('input',()=>{entry.name=name.value;dirty=true;});
      const query=document.createElement('input');query.value=entry.mapQuery;
      query.maxLength=180;query.required=true;query.setAttribute('aria-label','Map search text');
      query.addEventListener('input',()=>{entry.mapQuery=query.value;dirty=true;});
      const toggle=document.createElement('label');toggle.className='locality-active';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=entry.active;
      checkbox.onchange=()=>{entry.active=checkbox.checked;dirty=true;};
      toggle.append(checkbox,document.createTextNode('Served'));
      const map=document.createElement('a');map.target='_blank';map.rel='noopener noreferrer';
      map.textContent='View map';map.className='btn secondary';
      map.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(entry.mapQuery||entry.name+', Varanasi, India');
      query.addEventListener('change',()=>{map.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query.value);});
      const remove=document.createElement('button');remove.type='button';remove.className='btn secondary';
      remove.textContent='Remove';remove.onclick=()=>{rows.splice(index,1);dirty=true;render();};
      row.append(name,query,toggle,map,remove);root.append(row);
    });
    by('localityCount').textContent=rows.filter(x=>x.active).length+' enabled / '+rows.length+' total';
  }
  async function load(){
    status('Loading service localities…');
    try{const data=await request('GET');revision=data.revision;rows=data.localities.map(v=>({...v}));dirty=false;render();status('Localities loaded. Customers can select only enabled areas.');}
    catch(e){status(e.message,true);}
  }
  by('localityAdd').onclick=()=>{rows.push({name:'',mapQuery:', Varanasi, Uttar Pradesh, India',active:true});dirty=true;render();};
  by('localityReload').onclick=()=>{if(dirty&&!confirm('Discard unsaved changes?'))return;load();};
  by('localitySave').onclick=async()=>{
    if(!rows.length||!rows.some(x=>x.active)){status('At least one service locality must remain enabled.',true);return;}
    const normal=new Set();
    for(const item of rows){
      item.name=item.name.trim();item.mapQuery=item.mapQuery.trim();
      const key=item.name.toLocaleLowerCase();
      if(item.name.length<2||item.mapQuery.length<5||normal.has(key)){status('Check names, map searches and duplicate localities.',true);return;}
      normal.add(key);
    }
    const button=by('localitySave');button.disabled=true;status('Publishing locality changes…');
    try{const saved=await request('POST',{revision,localities:rows});revision=saved.revision;rows=saved.localities;dirty=false;render();status('Saved. Active localities are now enforced for all customers and orders.');}
    catch(e){status(e.message,true);}
    finally{button.disabled=false;}
  };
  load();
})();
