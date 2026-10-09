/* Temporary customer troubleshooting alerts. Opt-in only; never records
   contact details, tokens, basket contents, payment references or QR codes. */
(()=>{
  'use strict';
  const key='easy-mandi-test-alerts';
  const params=new URLSearchParams(location.search);
  try{
    if(params.get('testAlerts')==='1')sessionStorage.setItem(key,'1');
    if(params.get('testAlerts')==='0')sessionStorage.removeItem(key);
  }catch(_){}
  let enabled=false;
  try{enabled=sessionStorage.getItem(key)==='1';}catch(_){enabled=params.get('testAlerts')==='1';}
  const entries=[];
  let panel=null,feed=null,button=null;
  let activeSection='',activeAt=0;
  const stamp=()=>new Date().toLocaleTimeString('en-IN',{hour12:false});
  function renderPanel(){
    if(!panel)return;
    panel.hidden=!enabled;
    if(button){button.textContent='Testing alerts: '+(enabled?'ON':'OFF');button.setAttribute('aria-pressed',String(enabled));}
    if(feed)feed.textContent=entries.slice(-25).join('\n');
  }
  function setEnabled(next){
    enabled=!!next;
    try{if(enabled)sessionStorage.setItem(key,'1');else sessionStorage.removeItem(key);}catch(_){}
    if(enabled){
      entries.length=0;
      report('TEST','ENABLED','Open Catalogue, Orders and Deliveries. Record the alerts shown.',{popup:true});
    }
    renderPanel();
  }
  function report(section,stage,detail='',opts={}){
    if(!enabled)return;
    const label=String(section||'APP').slice(0,28).toUpperCase();
    const phase=String(stage||'STATE').slice(0,40).toUpperCase();
    const info=String(detail||'').replace(/[\r\n]+/g,' ').slice(0,180);
    const line=stamp()+' · '+label+' · '+phase+(info?' · '+info:'');
    entries.push(line);
    if(entries.length>100)entries.shift();
    renderPanel();
    if(opts.popup)window.alert('Easy Mandi testing\n\n'+label+' — '+phase+'\n'+info);
  }
  function begin(section,detail=''){
    activeSection=String(section);
    activeAt=Date.now();
    report(section,'SECTION OPENED',detail,{popup:true});
  }
  function recent(section){
    return enabled&&activeSection===String(section)&&Date.now()-activeAt<45000;
  }
  window.EasyMandiTestAlerts=Object.freeze({
    report,begin,recent,get enabled(){return enabled;},get entries(){return [...entries];},setEnabled
  });
  // Defer control placement to the completed DOM (all scripts use defer).
  button=document.getElementById('testAlertsToggle');
  if(button)button.addEventListener('click',()=>setEnabled(!enabled));
  panel=document.createElement('aside');
  panel.className='customer-test-alerts';
  panel.setAttribute('aria-label','Easy Mandi testing diagnostics');
  panel.hidden=!enabled;
  const header=document.createElement('div');
  header.className='customer-test-alerts-head';
  const heading=document.createElement('strong');
  heading.textContent='TEST MODE · Navigation / API';
  const copy=document.createElement('button');
  copy.type='button';copy.textContent='Copy log';
  copy.onclick=async()=>{
    try{await navigator.clipboard.writeText(entries.join('\n'));report('TEST','LOG COPIED');}
    catch(_){report('TEST','COPY FAILED');}
  };
  header.append(heading,copy);
  feed=document.createElement('pre');feed.className='customer-test-alerts-log';
  panel.append(header,feed);
  document.body.append(panel);
  renderPanel();
  if(enabled)report('TEST','READY','v7 diagnostic alerts loaded');
})();
