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
  window.CustomerAccount={get user(){return user;},request};
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
  request('google-config').then(({
    clientId
  }) => {
    if (!clientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      google.accounts.id.initialize({
        client_id: clientId, callback: async ({
          credential
        }) => {
          googleCredential = credential;
          await completeGoogle();
        }
      });
      google.accounts.id.renderButton(byId('googleSignIn'), {
        theme: 'outline', size: 'large', text: 'continue_with', locale: window.EMI18n?.lang || 'en'
      });
    };
    document.head.append(script);
  }).catch(() => {
  });
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
    if(window.google?.accounts?.id){
      const googleRoot=byId('googleSignIn');
      googleRoot.replaceChildren();
      google.accounts.id.renderButton(googleRoot,{theme:'outline',size:'large',text:'continue_with',locale:window.EMI18n?.lang||'en'});
    }
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
