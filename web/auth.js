(() => {
  'use strict';
  const api = 'https://cserver.learnwithchampak.live/easymandi/api';
  const tokenKey = 'easy-mandi-auth-token';
  const byId = id => document.getElementById(id);
  const t=(key,vars={})=>window.EMI18n?.t(key,vars)||key;
  let token = sessionStorage.getItem(tokenKey);
  let user = null;
  let registering = false;
  let googleCredential = null;
  let googleReady=false;
  async function request(path, {
    method = 'GET', payload = null, authorized = false
  } = {
  }) {
    const response = await AppHttp.fetch(`${api}/${path}.php`, {
      method, cache: 'no-store',
      headers: {
        Accept: 'application/json', ...(payload ? {
          'Content-Type': 'application/json'
        } : {
        }),
        ...(authorized && token ? {
          Authorization: `Bearer ${token}`
        } : {
        })
      },
      ...(payload ? {
        body: JSON.stringify(payload)
      } : {
      }),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('Unexpected server response.');
    }
    if (!response.ok) throw new Error(result.error || 'Please try again.');
    return result;
  }
  const notificationRoot=document.createElement('section');
  byId('accountProfile').append(notificationRoot);
  async function deliveryNotifications(id, mark=false) {
    const response=await AppHttp.fetch('https://cserver.learnwithchampak.live/delivery/api/?action=notifications&audience=customer',{
      method:mark?'POST':'GET',cache:'no-store',headers:{
        'Content-Type':'application/json',Authorization:'Bearer '+token
      },
      ...(mark?{
        body:JSON.stringify({
          id
        })
      }:{
      })
    });
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Could not load delivery notifications.');
    return data;
  }
  const inbox=new NotificationInbox(notificationRoot,
  async()=>{
    const feeds=await Promise.allSettled([request('notifications',{
      authorized:true
    }),deliveryNotifications()]);
    if(feeds.every(f=>f.status==='rejected'))throw feeds[0].reason;
    const [order,delivery]=feeds.map(f=>f.status==='fulfilled'?f.value:{
      notifications:[],unreadCount:0
    });
    const notifications=[...order.notifications.map(n=>({
      ...n,audience:'order'
    })),...delivery.notifications.map(n=>({
      ...n,audience:'delivery'
    }))]
    .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    return {
      notifications,unreadCount:Number(order.unreadCount)+Number(delivery.unreadCount)
    };
  },
  async(id,n)=>{
    if(id===null||n?.audience==='order')await request('notifications',{
      method:'POST',authorized:true,payload:{
        id
      }
    });
    if(id===null||n?.audience==='delivery')await deliveryNotifications(id,true);
  });
  async function customerDeliveries(){
    if(!token||!user)throw Error('Sign in to see your deliveries.');
    const response=await AppHttp.fetch('https://cserver.learnwithchampak.live/delivery/api/?action=customer',{
      method:'GET',
      cache:'no-store',
      headers:{Accept:'application/json',Authorization:'Bearer '+token}
    });
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Could not load deliveries.');
    return result;
  }
  // Customer notifications belong to My Account, not a floating overlay.
  byId('accountProfile').append(inbox.dock);
  inbox.dock.classList.add('customer-inbox-menu');
  inbox.dock.style.position='static';
  inbox.dock.style.width='100%';
  inbox.dock.style.boxShadow='none';
  inbox.dock.style.marginTop='14px';
  const notificationsHeading=document.createElement('h3');
  notificationsHeading.textContent='Notifications / सूचनाएँ';
  byId('accountProfile').insertBefore(notificationsHeading,inbox.dock);
  const forgot=document.createElement('button');
  forgot.type='button';forgot.className='btn ghost';forgot.textContent='Forgot password? / पासवर्ड भूल गए?';
  byId('accountSwitch').before(forgot);
  const googleLink=document.createElement('div');googleLink.id='googleLink';byId('accountProfile').append(googleLink);
  const changeButton=document.createElement('button');
  changeButton.type='button';changeButton.className='btn ghost';changeButton.textContent='Change password / पासवर्ड बदलें';
  byId('accountProfile').append(changeButton);

  function accountNotice(text,failed=false){
    byId('accountError').textContent=text;
    byId('accountError').style.color=failed?'#a33222':'#176b46';
  }
  function showPasswordForm(title,fields,onSubmit){
    const dialog=document.createElement('dialog');dialog.className='account-password-dialog';
    const form=document.createElement('form');form.className='form';form.noValidate=false;
    const heading=document.createElement('h2');heading.textContent=title;
    const feedback=document.createElement('p');feedback.setAttribute('role','status');
    form.append(heading,feedback);
    const controls={};
    for(const f of fields){
      const label=document.createElement('label');
      label.textContent=f.label;
      const input=document.createElement('input');
      input.name=f.name;input.type=f.type||'password';input.required=true;
      input.autocomplete=f.autocomplete||'off';
      if(input.type==='password')input.minLength=8;
      label.append(input);form.append(label);controls[f.name]=input;
    }
    const actions=document.createElement('div');actions.className='actions';
    const close=document.createElement('button');close.type='button';close.className='btn ghost';close.textContent='Cancel / रद्द करें';close.onclick=()=>dialog.close();
    const save=document.createElement('button');save.type='submit';save.className='btn';save.textContent='Continue / आगे बढ़ें';
    actions.append(close,save);form.append(actions);
    form.addEventListener('submit',async event=>{
      event.preventDefault();save.disabled=true;feedback.textContent='';
      try{
        const data=Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value]));
        const result=await onSubmit(data);
        feedback.textContent=result?.message||'Done.';
        feedback.style.color='#176b46';
        if(result?.changed){
          setTimeout(()=>dialog.close(),1000);
        }
      }catch(error){
        feedback.textContent=error.message||'Please try again.';
        feedback.style.color='#a33222';
      }finally{save.disabled=false;}
    });
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    document.body.append(dialog);dialog.showModal();return dialog;
  }
  forgot.addEventListener('click',()=>{
    byId('accountDialog').close();
    showPasswordForm('Reset password / पासवर्ड रीसेट',[
      {name:'email',label:'Registered email / पंजीकृत ईमेल',type:'email',autocomplete:'email'}
    ],async({email})=>request('password-reset',{method:'POST',payload:{operation:'request',email}}));
  });
  changeButton.addEventListener('click',()=>{
    byId('accountDialog').close();
    showPasswordForm('Change password / पासवर्ड बदलें',[
      {name:'current_password',label:'Current password',autocomplete:'current-password'},
      {name:'new_password',label:'New password',autocomplete:'new-password'},
      {name:'password_confirmation',label:'Confirm new password',autocomplete:'new-password'}
    ],async(payload)=>{
      const response=await request('password-change',{method:'POST',authorized:true,payload});
      token=null;user=null;sessionStorage.removeItem(tokenKey);
      refresh();
      return response;
    });
  });
  const resetParams=new URLSearchParams(location.search);
  const resetToken=resetParams.get('reset');
  if(resetToken && /^[a-f0-9]{64}$/i.test(resetToken)){
    showPasswordForm('Set new password / नया पासवर्ड',[
      {name:'password',label:'New password',autocomplete:'new-password'},
      {name:'password_confirmation',label:'Confirm new password',autocomplete:'new-password'}
    ],async(values)=>{
      const response=await request('password-reset',{method:'POST',payload:{operation:'complete',token:resetToken,...values}});
      history.replaceState(null,'',location.pathname);
      return response;
    });
  }
  window.CustomerAccount={get user(){return user;},request,customerDeliveries};
  function refresh() {
    window.dispatchEvent(new Event('customer-account-changed'));
    inbox.active=!!user;
    if(user)inbox.refresh().catch(()=>{
    });
    else inbox.stop();
    byId('accountButton').textContent = user ? t('hiUser',{name:user.name}) : t('signIn');
    byId('accountProfile').hidden = !user;
    byId('accountForm').hidden = !!user;
    byId('accountSwitch').hidden = !!user;
    byId('googleSignIn').hidden = !!user;
    byId('googleComplete').hidden = !!user || !googleCredential || !registering;
    if (user) {
      if(googleReady)renderGoogleButtons();
      else{
        const googleRoot=byId('googleLink');
        googleRoot.replaceChildren();
        const linkButton=document.createElement('button');
        linkButton.type='button';
        linkButton.className='btn ghost';
        linkButton.textContent='Connect Google / Google खाता जोड़ें';
        linkButton.onclick=initializeGoogle;
        googleRoot.append(linkButton);
      }
      byId('accountTitle').textContent = t('myAccount');
      byId('accountIdentity').textContent = `${user.name} · +91 ${user.mobile}${user.email ? ` · ${
        user.email
      }` : ''}`;
      const form = byId('orderForm');
      form.elements.name.value = user.name;
      form.elements.phone.value = user.mobile;
    }
  }
  function mode(register) {
    registering = register;
    byId('accountTitle').textContent = t(register?'createAccountAction':'signIn');
    byId('registerFields').hidden = !register;
    byId('loginFields').hidden = register;
    for (const name of ['name', 'mobile', 'login']) {
      byId('accountForm').elements[name].required = register ? name !== 'login' : name === 'login';
    }
    byId('accountForm').elements.password.autocomplete = register ? 'new-password' : 'current-password';
    byId('confirmPasswordField').hidden = !register;
    byId('accountForm').elements.password_confirmation.required = register;
    byId('accountSubmit').textContent = t(register?'createAccountAction':'signIn');
    byId('accountSwitch').textContent = t(register?'alreadyAccount':'createAccount');
    byId('googleComplete').hidden = !register || !googleCredential;
    byId('accountError').textContent = '';
  }
  byId('accountButton').addEventListener('click', () => {
    refresh();
    byId('accountDialog').showModal();
  });
  byId('accountClose').addEventListener('click', () => byId('accountDialog').close());
  byId('accountSwitch').addEventListener('click', () => mode(!registering));
  // Keep Google sign-in visible even when the backend is not configured.
  // Never ship a guessed OAuth client ID or suppress configuration errors.
  let googleLoading=false;
  const googleStatus=byId('googleStatus');
  const googleRetry=byId('googleRetry');
  function showGoogleStatus(message, error=false){
    googleStatus.textContent=message;
    googleStatus.style.color=error?'#a33222':'#49675c';
  }
  function renderGoogleButtons(){
    if(!googleReady||!window.google?.accounts?.id)return;
    const options={theme:'outline',size:'large',text:'continue_with',locale:window.EMI18n?.lang||'en'};
    const root=byId('googleSignIn');
    root.replaceChildren();
    window.google.accounts.id.renderButton(root,options);
    if(user){
      const linked=byId('googleLink');
      linked.replaceChildren();
      window.google.accounts.id.renderButton(linked,options);
    }
  }
  async function initializeGoogle(){
    if(googleLoading)return;
    googleLoading=true;
    googleRetry.disabled=true;
    showGoogleStatus('Checking Google Sign-In… / Google साइन-इन जाँचा जा रहा है…');
    try{
      const {clientId}=await request('google-config');
      if(typeof clientId!=='string'||!/^\\d+-[a-zA-Z0-9_-]+\\.apps\\.googleusercontent\\.com$/.test(clientId)){
        throw Error('Google Sign-In is not configured on the Easy Mandi server. Use your password for now or contact support.');
      }
      if(!window.google?.accounts?.id){
        await new Promise((resolve,reject)=>{
          const sdk=document.createElement('script');
          sdk.src='https://accounts.google.com/gsi/client';
          sdk.async=true;
          const timeout=setTimeout(()=>reject(Error('Google Sign-In took too long to load. Check network or browser privacy settings.')),15000);
          sdk.onload=()=>{clearTimeout(timeout);window.google?.accounts?.id?resolve():reject(Error('Google Sign-In could not start.'));};
          sdk.onerror=()=>{clearTimeout(timeout);reject(Error('Could not load Google Sign-In. Check your connection or browser settings.'));};
          document.head.append(sdk);
        });
      }
      window.google.accounts.id.initialize({
        client_id:clientId,
        callback:async ({credential})=>{
          if(user){
            try{
              await request('google',{method:'POST',authorized:true,payload:{operation:'link',id_token:credential}});
              accountNotice('Google account linked successfully / Google खाता जुड़ गया।');
            }catch(error){accountNotice(error.message||'Google account linking failed',true);}
          }else{
            googleCredential=credential;
            await completeGoogle();
          }
        }
      });
      googleReady=true;
      renderGoogleButtons();
      googleRetry.hidden=true;
      showGoogleStatus('');
    }catch(error){
      googleReady=false;
      googleRetry.hidden=false;
      googleRetry.textContent='Retry Google Sign-In / दोबारा कोशिश करें';
      showGoogleStatus(error.message||'Google Sign-In is currently unavailable.',true);
    }finally{
      googleLoading=false;
      googleRetry.disabled=false;
    }
  }
  googleRetry.addEventListener('click',initializeGoogle);
  initializeGoogle();
  async function completeGoogle() {
    if (!googleCredential) return;
    byId('accountError').textContent = '';
    try {
      const result = await request('google', {
        method: 'POST', payload: {
          id_token: googleCredential, mobile: byId('accountForm').elements.mobile.value.trim(),
        }
      });
      token = result.token;
      sessionStorage.setItem(tokenKey, token);
      user = result.user;
      googleCredential = null;
      byId('googleComplete').hidden = true;
      byId('accountForm').reset();
      mode(false);
      refresh();
      byId('accountDialog').close();
    } catch (error) {
      if (/mobile number to complete/i.test(error.message)) {
        mode(true);
        byId('accountError').textContent = t('accountGoogleMobile');
        byId('googleComplete').hidden = false;
      } else byId('accountError').textContent = error.message || 'Could not sign in with Google.';
    }
  }
  byId('googleComplete').addEventListener('click', completeGoogle);
  byId('accountForm').addEventListener('submit', async event => {
    event.preventDefault();
    // currentTarget is only available while the event is being dispatched.
    // Keep the form reference before awaiting the authentication response.
    const form = event.currentTarget;
    const button = byId('accountSubmit');
    button.disabled = true;
    byId('accountError').textContent = '';
    const fields = new FormData(form);
    if (registering && fields.get('password') !== fields.get('password_confirmation')) {
      byId('accountError').textContent = t('passwordsMismatch');
      button.disabled = false;
      return;
    }
    try {
      const result = await request(registering ? 'register' : 'login', {
        method: 'POST', payload: registering
        ? {
          name: fields.get('name'), mobile: fields.get('mobile'), email: fields.get('email'),
          password: fields.get('password'), password_confirmation: fields.get('password_confirmation')
        }
        : {
          login: fields.get('login'), password: fields.get('password')
        }
      });
      token = result.token;
      sessionStorage.setItem(tokenKey, token);
      user = result.user;
      googleCredential = null;
      form.reset();
      mode(false);
      refresh();
      byId('accountDialog').close();
    } catch (error) {
      byId('accountError').textContent = error.message || 'Could not sign in.';
    } finally {
      button.disabled = false;
    }
  });
  byId('logoutButton').addEventListener('click', async () => {
    if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    try {
      await request('logout', {
        method: 'POST', authorized: true
      });
    }
    catch {
      byId('status').textContent = 'Signed out on this browser; the server session may remain active until expiry.';
    }
    token = null;
    user = null;
    sessionStorage.removeItem(tokenKey);
    localStorage.removeItem('easy-mandi-cart');
    // The storefront script owns this local basket.
    for (const key of Object.keys(cart)) delete cart[key];
    byId('orderForm').reset();
    render();
    mode(false);
    refresh();
    byId('accountDialog').close();
  });
  window.addEventListener('languagechange',()=>{
    if(user){
      byId('accountTitle').textContent=t('myAccount');
      byId('accountButton').textContent=t('hiUser',{name:user.name});
    }else{
      mode(registering);
      byId('accountButton').textContent=t('signIn');
    }
    if(googleReady)renderGoogleButtons();
  });
  mode(false);
  if (token) request('me', {
    authorized: true
  }).then(result => {
    user = result.user;
    refresh();
  }).catch(error => {
    if (/sign in|expired/i.test(error.message)) {
      token = null;
      sessionStorage.removeItem(tokenKey);
    }
  });
})();
