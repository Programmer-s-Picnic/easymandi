'use strict';
const SOURCE='https://cserver.learnwithchampak.live/easymandi/api/catalog.php';
const KEY='easy-mandi-admin-draft-v1';
let data=null,version=localStorage.getItem(KEY+'-version');
const $=id=>document.getElementById(id);
async function hashCatalog(raw){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
}
const notify=(message,type='good')=>{
  $('message').className=type;
  $('message').textContent=message
};
const field=(label,value,onchange,options={
})=>{
  const wrap=document.createElement('label');
  wrap.className='field'+(options.wide?' wide':'');
  const name=document.createElement('span');
  name.textContent=label;
  const input=document.createElement(options.multiline?'textarea':options.choices?'select':'input');
  if(options.choices){
    for(const item of options.choices){
      const option=document.createElement('option');
      option.value=item;
      option.textContent=item;
      input.append(option)
    }
  }else if(!options.multiline){
    input.type=options.type||'text';
    if(options.type==='number'){
      input.min='0';
      input.step=options.step||'0.01'
    }
  }input.value=value??'';
  input.addEventListener('change',()=>onchange(options.type==='number'?Number(input.value):input.value));
  wrap.append(name,input);
  return wrap
};
function persist(){
  localStorage.setItem(KEY,JSON.stringify(data));
  renderSummary()
}
function renderSummary(){
  if(!data)return;
  $('summary').replaceChildren();
  for(const [label,value] of [['Products',data.products.length],['Available',data.products.filter(p=>p.available).length],['Categories',data.categories.length-1]]){
    const card=document.createElement('div');
    const title=document.createElement('span');
    title.textContent=label;
    const strong=document.createElement('strong');
    strong.textContent=value;
    card.append(title,strong);
    $('summary').append(card)
  }
}
function renderStore(){
  const root=$('store');
  root.replaceChildren();
  for(const [label,key,opts] of [['Store name','name'],['Tagline','tagline'],['City','city'],['Support WhatsApp number','supportPhone'],['Delivery fee (₹)','deliveryFee',{
    type:'number'
  }],['Free delivery above (₹)','freeDeliveryAbove',{
    type:'number'
  }],['Minimum order (₹)','minimumOrder',{
    type:'number'
  }],['Delivery note','deliveryNote',{
    multiline:true,wide:true
  }]])root.append(field(label,data.store[key],value=>{
    data.store[key]=value;
    persist()
  },opts||{
  }))
}
let mandiSelected=new Set();
let productPage=1, productSort='name', productAscending=true, editingProduct=null, productMode='insert';
const pageSize=10;
const productSpecs=[['ID','id'],['English name','name'],['Hindi name','hindi'],['Category','category'],['Unit','unit'],['Price (₹)','price'],['Emoji','emoji'],['Photo HTTPS URL (optional)','imageUrl'],['Compare-at price ₹ (optional)','compareAtPrice'],['Description','description']];
function productErrors(p, original){
  const errors={};
  if(!/^[a-z0-9_-]{1,64}$/.test(p.id||''))errors.id='Use 1–64 lowercase letters, numbers, underscores or hyphens.';
  else if(data.products.some(other=>other!==original&&other.id===p.id))errors.id='This product ID already exists. Enter a unique ID.';
  if(!p.name?.trim())errors.name='English name is required.';
  if(!p.unit?.trim())errors.unit='Unit is required (for example, 1 kg).';
  if(!data.categories.includes(p.category)||p.category==='All')errors.category='Select an existing product category.';
  if(p.price===''||!Number.isFinite(Number(p.price))||Number(p.price)<0)errors.price='Enter a price of zero or greater.';
  else if(Math.abs(Number(p.price)*100-Math.round(Number(p.price)*100))>0.000001)errors.price='Use no more than two decimal places.';
  for(const [,key] of productSpecs){const limit=key==='id'?64:key==='name'?150:key==='unit'?80:key==='imageUrl'?500:300;if(Array.from(String(p[key]||'')).length>limit)errors[key]='Use no more than '+limit+' characters.';}
  if(Number(p.price)>1000000)errors.price='Price cannot exceed ₹1,000,000.';
  if(p.imageUrl && (!/^https:\/\/[^\s/]+\/[^\s]*$/i.test(p.imageUrl)||p.imageUrl.length>500))
    errors.imageUrl='Use an HTTPS image link (up to 500 characters).';
  if(p.compareAtPrice!=='' && p.compareAtPrice!=null &&
      (!Number.isFinite(Number(p.compareAtPrice))||Number(p.compareAtPrice)<=Number(p.price)||Number(p.compareAtPrice)>1000000))
    errors.compareAtPrice='Comparison price must be greater than the actual price.';
  if(!original&&data.products.length>=500)errors.id='The catalog supports at most 500 products.';
  return errors;
}
function openProduct(original=null, mode='insert'){
  if(!data){notify('Load the catalog first.','error');return;}
  editingProduct=original;productMode=mode;
  const value=original||{id:'',name:'',hindi:'',category:data.categories.find(x=>x!=='All')||'',unit:'1 kg',price:'',emoji:'🥬',imageUrl:'',compareAtPrice:'',description:'',available:false};
  $('productTitle').textContent=mode==='delete'?'Delete product':mode==='insert'?'Insert product':'Update product';
  $('productSubmit').textContent=mode==='delete'?'Delete from draft':mode==='insert'?'Insert into draft':'Update draft';
  $('productSubmit').className=mode==='delete'?'btn danger':'btn';
  $('productFormMessage').textContent=mode==='delete'?'Review this record. Confirm deletion to remove it from the draft.':'';
  const root=$('productFields');root.replaceChildren();
  for(const [label,key] of productSpecs){
    const wrap=field(label,value[key],()=>{},key==='category'?{choices:data.categories.filter(x=>x!=='All')}:key==='description'?{multiline:true,wide:true}:(key==='price'||key==='compareAtPrice')?{type:'number'}:{});
    const input=wrap.children[1];input.id='product_'+key;input.disabled=mode==='delete';
    input.setAttribute('aria-describedby','product_error_'+key);
    const error=document.createElement('small');error.id='product_error_'+key;error.className='field-error';wrap.append(error);
    if(key==='imageUrl'&&mode!=='delete'){
      const choose=document.createElement('button');
      choose.className='btn secondary media-choose';choose.type='button';
      choose.textContent='Choose uploaded picture';
      choose.onclick=()=>window.EasyMandiMedia?.pick(url=>{
        input.value=url;
        photo.src=url;photo.hidden=false;
      });
      const photo=document.createElement('img');
      photo.className='media-inline-preview';photo.alt='Product photo preview';
      photo.hidden=!value.imageUrl;if(value.imageUrl)photo.src=value.imageUrl;
      input.addEventListener('input',()=>{photo.hidden=!input.value.trim();if(input.value.trim())photo.src=input.value.trim();});
      wrap.append(choose,photo);
    }
    root.append(wrap);
  }
  const wrap=document.createElement('label');wrap.className='row';
  const check=document.createElement('input');check.id='product_available';check.type='checkbox';check.checked=!!value.available;check.disabled=mode==='delete';
  wrap.append(check,document.createTextNode('Available to order'));root.append(wrap);
  // A single Mandi threshold/rate, independently configured for each item.
  const config=original?.mandi||{enabled:true,minimumQuantity:5,unitPrice:Math.round(Number(value.price||0)*90)/100};
  const enabled=document.createElement('label');enabled.className='row';
  const mandiOn=document.createElement('input');mandiOn.type='checkbox';mandiOn.id='product_mandiEnabled';
  mandiOn.checked=config.enabled===true;mandiOn.disabled=mode==='delete';
  enabled.append(mandiOn,document.createTextNode('Enable Mandi quantity price'));root.append(enabled);
  for(const [key,label,value] of [['mandiMin','Mandi threshold (units)',config.minimumQuantity],['mandiPrice','Mandi unit price (₹)',config.unitPrice]]){
    const wrap=field(label,String(value),()=>{},{type:'number'});
    wrap.children[1].id='product_'+key;wrap.children[1].disabled=mode==='delete';
    root.append(wrap);
  }
  $('productDialog').showModal();$('product_id').focus();
}
function renderProducts(){
  if(!data)return;
  const root=$('products');root.replaceChildren();
  const category=$('productCategoryFilter'), selected=category.value||'All';
  category.replaceChildren();
  for(const name of data.categories){const o=document.createElement('option');o.value=name;o.textContent=name;category.append(o);}
  category.value=data.categories.includes(selected)?selected:'All';
  const query=$('filter').value.trim().toLocaleLowerCase(), available=$('productAvailabilityFilter').value||'all';
  const rows=data.products.filter(p=>(p.name+' '+p.hindi+' '+p.id+' '+p.category).toLocaleLowerCase().includes(query)&&(category.value==='All'||p.category===category.value)&&(available==='all'||Boolean(p.available)===(available==='yes')));
  rows.sort((a,b)=>{const result=productSort==='price'?Number(a.price)-Number(b.price):String(a[productSort]??'').localeCompare(String(b[productSort]??''));return productAscending?result:-result;});
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));productPage=Math.min(productPage,pages);
  const bulk=document.createElement('div');bulk.className='row mandi-bulk-toolbar';
  const selectAll=document.createElement('button');selectAll.type='button';selectAll.className='btn secondary';
  selectAll.textContent='Select shown';selectAll.onclick=()=>{for(const p of rows.slice((productPage-1)*pageSize,productPage*pageSize))mandiSelected.add(p.id);renderProducts();};
  const clear=document.createElement('button');clear.type='button';clear.className='btn secondary';clear.textContent='Clear selection';
  clear.onclick=()=>{mandiSelected.clear();renderProducts();};
  const qty=document.createElement('input');qty.type='number';qty.min=2;qty.max=99;qty.value='5';qty.title='Minimum quantity';qty.setAttribute('aria-label','Mandi quantity threshold');
  const percent=document.createElement('input');percent.type='number';percent.min=1;percent.max=99;percent.value='10';percent.title='Percent off retail';percent.setAttribute('aria-label','Mandi percent discount');
  const apply=document.createElement('button');apply.type='button';apply.className='btn';
  apply.textContent='Apply Mandi to selected';
  apply.onclick=()=>{
     const threshold=Number(qty.value),discount=Number(percent.value);
     if(!mandiSelected.size||!Number.isInteger(threshold)||threshold<2||threshold>99||
        !Number.isFinite(discount)||discount<=0||discount>=100){notify('Select products and enter a valid quantity (2–99) and discount (1–99%).','error');return;}
     const selected=data.products.filter(p=>mandiSelected.has(p.id));
     if(!confirm('Apply a single '+discount+'% Mandi discount from '+threshold+' units to '+selected.length+' selected products?'))return;
     for(const p of selected){
       const rate=Math.round(Number(p.price)*(100-discount))/100;
       p.mandi={enabled:rate>0&&rate<Number(p.price),minimumQuantity:threshold,unitPrice:rate>0?rate:Number(p.price)};
     }
     persist();mandiSelected.clear();renderProducts();notify('Mandi draft updated. Save catalog to server to publish.');
  };
  bulk.append(selectAll,clear,document.createTextNode('Qty ≥'),qty,document.createTextNode('Discount %'),percent,apply);
  root.append(bulk);
  const scroll=document.createElement('div');scroll.className='grid-scroll';
  const table=document.createElement('table');table.className='product-grid';
  const caption=document.createElement('caption');caption.textContent='Product records';table.append(caption);
  const head=document.createElement('thead'), header=document.createElement('tr');
  for(const [label,key] of [['ID','id'],['Product','name'],['Hindi name','hindi'],['Category','category'],['Unit','unit'],['Price','price'],['Mandi rate','mandi'],['Available','available']]){
    const th=document.createElement('th');th.setAttribute('scope','col');th.setAttribute('aria-sort',productSort===key?(productAscending?'ascending':'descending'):'none');
    const button=document.createElement('button');button.type='button';button.className='sort-button';button.textContent=label+(productSort===key?(productAscending?' ↑':' ↓'):'');
    button.onclick=()=>{productAscending=productSort===key?!productAscending:true;productSort=key;productPage=1;renderProducts();};th.append(button);header.append(th);
  }
  const selectHead=document.createElement('th');selectHead.textContent='Select';header.prepend(selectHead);
  const actions=document.createElement('th');actions.textContent='Actions';actions.setAttribute('scope','col');header.append(actions);head.append(header);table.append(head);
  const body=document.createElement('tbody');
  for(const p of rows.slice((productPage-1)*pageSize,productPage*pageSize)){
    const row=document.createElement('tr');
    const selectedCell=document.createElement('td');const pick=document.createElement('input');pick.type='checkbox';
    pick.checked=mandiSelected.has(p.id);pick.setAttribute('aria-label','Select '+p.name+' for Mandi bulk pricing');
    pick.onchange=()=>{if(pick.checked)mandiSelected.add(p.id);else mandiSelected.delete(p.id);};
    selectedCell.append(pick);row.append(selectedCell);
    for(const value of [p.id,(p.emoji||'')+' '+p.name,p.hindi,p.category,p.unit,'₹'+Number(p.price).toFixed(2),p.mandi?.enabled?'₹'+Number(p.mandi.unitPrice).toFixed(2)+' from '+p.mandi.minimumQuantity:'Not set',p.available?'Yes':'No']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
    const cell=document.createElement('td');const controls=document.createElement('div');controls.className='row';
    for(const [label,mode] of [['Update','update'],['Delete','delete']]){const button=document.createElement('button');button.type='button';button.className=mode==='delete'?'btn danger':'btn secondary';button.textContent=label;button.setAttribute('aria-label',label+' '+p.name);button.onclick=()=>openProduct(p,mode);controls.append(button);}
    cell.append(controls);row.append(cell);body.append(row);
  }
  table.append(body);scroll.append(table);root.append(scroll);
  const summary=document.createElement('p');summary.setAttribute('role','status');summary.textContent=rows.length?rows.length+' matching products · Page '+productPage+' of '+pages:'No matching products. Change the filters or add a product.';root.append(summary);
  const pager=document.createElement('div');pager.className='row';
  for(const [label,delta,disabled] of [['Previous',-1,productPage===1],['Next',1,productPage===pages]]){const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent=label;button.disabled=disabled;button.onclick=()=>{productPage+=delta;renderProducts();};pager.append(button);}root.append(pager);
}
$('productCancel').onclick=()=>$('productDialog').close();
$('productForm').onsubmit=event=>{
  event.preventDefault();
  if(productMode==='delete'){
    data.products=data.products.filter(p=>p!==editingProduct);
  }else{
    const value={...(editingProduct||{})};
    for(const [,key] of productSpecs)value[key]=$('product_'+key).value.trim();
    value.available=$('product_available').checked;
    const errors=productErrors(value,editingProduct);
    for(const [,key] of productSpecs){$('product_error_'+key).textContent=errors[key]||'';$('product_'+key).setAttribute('aria-invalid',errors[key]?'true':'false');}
    if(Object.keys(errors).length){$('productFormMessage').textContent='Please correct the highlighted fields.';$('product_'+Object.keys(errors)[0]).focus();return;}
    const minimum=Number($('product_mandiMin').value);
    let unitPrice=Number($('product_mandiPrice').value);
    if(!editingProduct&&unitPrice===0&&Number(value.price)>0)
      unitPrice=Math.round(Number(value.price)*90)/100;
    const enabled=$('product_mandiEnabled').checked;
    if(!Number.isInteger(minimum)||minimum<2||minimum>99||
       !Number.isFinite(unitPrice)||unitPrice<0||unitPrice>Number(value.price)||
       (enabled&&(unitPrice<=0||unitPrice>=Number(value.price)))||
       Math.abs(unitPrice*100-Math.round(unitPrice*100))>0.00001){
       $('productFormMessage').textContent='Mandi: enter quantity 2–99 and a lower unit price (₹).';
       return;
    }
    value.mandi={enabled,minimumQuantity:minimum,unitPrice};
    value.price=Number(value.price);
    if(value.compareAtPrice==='')delete value.compareAtPrice;
    else value.compareAtPrice=Number(value.compareAtPrice);
    if(!value.imageUrl)delete value.imageUrl;
    if(editingProduct)Object.assign(editingProduct,value);else data.products.push(value);
  }
  persist();renderProducts();renderCategories();$('productDialog').close();
  notify((productMode==='delete'?'Product deleted':productMode==='insert'?'Product inserted':'Product updated')+' in the draft. Save to server to publish.');
};
for(const id of ['filter','productCategoryFilter','productAvailabilityFilter'])$(id).addEventListener(id==='filter'?'input':'change',()=>{productPage=1;renderProducts();});
function renderCategories(){
  const root=$('categories');
  root.replaceChildren();
  for(const category of data.categories.filter(name=>name!=='All')){
    const row=document.createElement('div');
    row.className='row category-row';
    const picture=document.createElement('img');
    picture.className='media-category-thumb';
    picture.alt='Photo for '+category;
    const currentUrl=data.categoryImages?.[category];
    if(currentUrl)picture.src=currentUrl;
    else picture.classList.add('media-placeholder');
    const input=document.createElement('input');
    input.value=category;
    input.maxLength=80;
    input.setAttribute('aria-label','Rename '+category);
    input.style.maxWidth='340px';
    const count=document.createElement('span');
    count.className='hint';
    count.textContent=data.products.filter(p=>p.category===category).length+' products';
    const rename=document.createElement('button');
    rename.className='btn secondary';
    rename.type='button';
    rename.textContent='Rename';
    rename.onclick=()=>{
      const next=input.value.trim();
      if(!next||next==='All'||next.length>80||data.categories.some(name=>name!==category&&name.toLowerCase()===next.toLowerCase())){
        notify('Enter a unique category name (up to 80 characters).','error');
        input.value=category;
        return
      }
      data.categories[data.categories.indexOf(category)]=next;
      for(const p of data.products)if(p.category===category)p.category=next;
      if(data.categoryImages?.[category]){
        const url=data.categoryImages[category];delete data.categoryImages[category];
        data.categoryImages[next]=url;
      }
      persist();
      renderCategories();
      renderProducts();
      notify('Category renamed in the draft. Save to server to publish.')
    };
    const remove=document.createElement('button');
    remove.className='btn danger';
    remove.type='button';
    remove.textContent='Delete';
    remove.disabled=data.products.some(p=>p.category===category);
    remove.title=remove.disabled?'Move or delete the products first':'Delete category';
    remove.onclick=()=>{
      if(!confirm('Delete '+category+' from this draft?'))return;
      data.categories=data.categories.filter(name=>name!==category);
      if(data.categoryImages)delete data.categoryImages[category];
      persist();
      renderCategories();
      renderProducts();
      notify('Category deleted from the draft. Save to server to publish.')
    };
    const choose=document.createElement('button');choose.className='btn secondary media-choose';
    choose.type='button';choose.textContent='Choose picture';
    choose.onclick=()=>window.EasyMandiMedia?.pick(url=>{
      data.categoryImages ||= {};
      data.categoryImages[category]=url;
      persist();renderCategories();
      notify('Category photo set in draft. Save to server to publish.');
    });
    const clear=document.createElement('button');clear.className='btn secondary';
    clear.type='button';clear.textContent='Remove picture';clear.disabled=!currentUrl;
    clear.onclick=()=>{
      if(data.categoryImages)delete data.categoryImages[category];
      persist();renderCategories();notify('Category photo removed from draft. Save to server to publish.');
    };
    row.append(picture,input,count,rename,choose,clear,remove);
    root.append(row)
  }
}
function render(){
  renderSummary();
  renderStore();
  renderCategories();
  renderProducts()
}
function validate(){
  const errors=[];
  if(!data||!Array.isArray(data.products)||!data.store||!Array.isArray(data.categories)){
    notify('Catalog structure is invalid.','error');
    return false
  }if(!data.store.name?.trim())errors.push('Store name is required');
  if(data.categories[0]!=='All'||data.categories.length>30||data.categories.some((name,i)=>typeof name!=='string'||!name.trim()||name.length>80||data.categories.findIndex(v=>v.toLowerCase()===name.toLowerCase())!==i))errors.push('Categories must be unique, nonempty, and start with All');
  if(data.categoryImages!==undefined){
    if(!data.categoryImages||typeof data.categoryImages!=='object'||Array.isArray(data.categoryImages))
      errors.push('Category image mapping must be an object');
    else{
      for(const [name,url] of Object.entries(data.categoryImages)){
        if(name==='All'||!data.categories.includes(name)||typeof url!=='string'||!/^https:\/\/[^\s/]+\/[^\s]*$/i.test(url)||url.length>500)
          errors.push('Invalid image URL for category '+name);
      }
    }
  }
  if(!/^\+?[0-9 ()-]{10,20}$/.test(data.store.supportPhone||''))errors.push('Enter a valid support number');
  for(const key of ['deliveryFee','freeDeliveryAbove','minimumOrder'])if(!Number.isFinite(data.store[key])||data.store[key]<0)errors.push(key+' must be zero or greater');
  const ids=new Set();
  for(const [i,p] of data.products.entries()){
    const prefix='Product '+(i+1)+': ';
    if(!/^[a-z0-9_-]{1,64}$/.test(p.id||''))errors.push(prefix+'ID must use lowercase letters, numbers, _ or -');
    if(ids.has(p.id))errors.push(prefix+'duplicate ID');
    ids.add(p.id);
    if(!p.name?.trim()||!p.unit?.trim())errors.push(prefix+'name and unit are required');
    if(!data.categories.includes(p.category)||p.category==='All')errors.push(prefix+'select a category');
    if(!Number.isFinite(p.price)||p.price<0)errors.push(prefix+'price must be zero or greater');
    if(p.imageUrl && (!/^https:\/\/[^\s/]+\/[^\s]*$/i.test(p.imageUrl)||p.imageUrl.length>500))
      errors.push(prefix+'photo URL must be HTTPS');
    if(p.compareAtPrice!=null && (!Number.isFinite(p.compareAtPrice)||p.compareAtPrice<=p.price))
      errors.push(prefix+'comparison price must exceed selling price');
  }if(errors.length){
    notify(errors.slice(0,8).join(' · ')+(errors.length>8?' · More errors remain.':''),'error');
    return false
  }notify('Catalog is valid. Choose Save to server to publish.');
  return true
}
async function load(){
  if(localStorage.getItem(KEY)&&!confirm('Discard the local draft and reload the published catalog?'))return;
  notify('Loading published catalog…');
  try{
    let response=await AppHttp.fetch(SOURCE+'?t='+Date.now(),{
      cache:'no-store'
    });
    if(!response.ok)response=await AppHttp.fetch('https://raw.githubusercontent.com/Programmer-s-Picnic/easymandidata/main/catalog/products.json?t='+Date.now(),{
      cache:'no-store'
    });
    if(!response.ok)throw Error();
    const raw=await response.text();
    const next=JSON.parse(raw);
    if(!Array.isArray(next.products)||!next.store||!Array.isArray(next.categories))throw Error();
    data=next;
    version=response.url.startsWith('https://cserver.learnwithchampak.live/')?((response.headers.get('ETag')||'').replaceAll('"','')||await hashCatalog(raw)):null;
    localStorage.setItem(KEY+'-version',version||'');
    persist();
    render();
    notify(version?'Published catalog loaded from cserver.':'Backup catalog loaded. Saving needs a live cserver connection.');
  }catch{
    notify('Could not load the catalog. Check your connection and retry.','error')
  }
}
function exportFile(){
  if(!validate())return;
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{
    type:'application/json'
  });
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download='products.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
async function saveToServer(){
  if(!validate())return;
  const button=$('saveTop');
  $('saveBottom').disabled=true;
  button.disabled=true;
  try{
    await window.AdminAccess.ensure();
    if(!version){
      let current;
      try{
        current=await AppHttp.fetch(SOURCE+'?t='+Date.now(),{
          cache:'no-store'
        })
      }catch{
        throw Error('Could not reach cserver. Your draft is saved in this browser; try again when the connection is available.')
      }if(!current.ok)throw Error('Cserver catalog is unavailable. Your draft is saved in this browser.');
      const currentRaw=await current.text();
      version=(current.headers.get('ETag')||'').replaceAll('"','')||await hashCatalog(currentRaw);
      localStorage.setItem(KEY+'-version',version)
    }const response=await AppHttp.fetch('https://cserver.learnwithchampak.live/easymandi/api/admin-catalog-save.php',{
      method:'POST',headers:{
        'Content-Type':'application/json',...window.AdminSession.headers()
      },body:JSON.stringify({
        version,catalog:data
      })
    });
    let result;
    try{
      result=await response.json()
    }catch{
      throw Error('The server did not return a valid response.')
    }if(!response.ok){
      if(response.status===401)window.AdminSession.clear();
      if(response.status===409){
        throw Error('The published catalog changed. Your draft is preserved. Export your draft, reload the published catalog and review your changes before saving.')
      }throw Error(result.error||'Could not save catalog.')
    }version=result.version;
    localStorage.setItem(KEY+'-version',version);
    notify('Saved to cserver. The customer website and app will load these catalog changes.')
  }catch(error){
    notify(error.message||'Could not save catalog.','error')
  }finally{
    button.disabled=false;
    $('saveBottom').disabled=false
  }
}
$('saveTop').onclick=$('saveBottom').onclick=()=>{if(validate())saveToServer();};
$('reload').onclick=load;
$('validate').onclick=validate;
$('export').onclick=exportFile;
$('exportBottom').onclick=exportFile;

$('addCategory').onclick=()=>{
  if(!data){
    notify('Load the catalog first.','error');
    return
  }const name=$('newCategory').value.trim();
  if(!name||name.length>80||data.categories.some(v=>v.toLowerCase()===name.toLowerCase())||data.categories.length>=30){
    notify('Enter a unique category name (up to 80 characters; maximum 30 categories).','error');
    return
  }data.categories.push(name);
  $('newCategory').value='';
  persist();
  renderCategories();
  renderProducts();
  notify('Category added to the draft. Save to server to publish.')
};
$('newCategory').onkeydown=e=>{
  if(e.key==='Enter'){
    $('addCategory').click()
  }
};
$('add').onclick=()=>openProduct();
try{
  const draft=JSON.parse(localStorage.getItem(KEY));
  if(draft&&Array.isArray(draft.products)&&draft.store&&Array.isArray(draft.categories)){
    data=draft;
    render();
    notify('Local draft restored. Reload published catalog to discard it.')
  }else load()
}catch{
  load()
}
