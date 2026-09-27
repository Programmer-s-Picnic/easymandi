(() => {
  'use strict';
  const api = 'https://cserver.learnwithchampak.live/easymandi/api';
  const tokenKey = 'easy-mandi-auth-token';
  const byId = id => document.getElementById(id);
  let token = sessionStorage.getItem(tokenKey);
  let user = null;
  let registering = false;

  async function request(path, {method = 'GET', payload = null, authorized = false} = {}) {
    const response = await fetch(`${api}/${path}.php`, {
      method, cache: 'no-store',
      headers: {Accept: 'application/json', ...(payload ? {'Content-Type': 'application/json'} : {}),
        ...(authorized && token ? {Authorization: `Bearer ${token}`} : {})},
      ...(payload ? {body: JSON.stringify(payload)} : {}),
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('Unexpected server response.'); }
    if (!response.ok) throw new Error(result.error || 'Please try again.');
    return result;
  }

  function refresh() {
    byId('accountButton').textContent = user ? `Hi, ${user.name}` : 'Sign in';
    byId('accountProfile').hidden = !user;
    byId('accountForm').hidden = !!user;
    byId('accountSwitch').hidden = !!user;
    if (user) {
      byId('accountTitle').textContent = 'My account';
      byId('accountIdentity').textContent = `${user.name} · +91 ${user.mobile}${user.email ? ` · ${user.email}` : ''}`;
      const form = byId('orderForm');
      form.elements.name.value = user.name;
      form.elements.phone.value = user.mobile;
    }
  }
  function mode(register) {
    registering = register;
    byId('accountTitle').textContent = register ? 'Create account' : 'Sign in';
    byId('registerFields').hidden = !register;
    byId('loginFields').hidden = register;
    for (const name of ['name', 'mobile', 'login']) {
      byId('accountForm').elements[name].required = register ? name !== 'login' : name === 'login';
    }
    byId('accountForm').elements.password.autocomplete = register ? 'new-password' : 'current-password';
    byId('accountSubmit').textContent = register ? 'Create account' : 'Sign in';
    byId('accountSwitch').textContent = register ? 'Already registered? Sign in' : 'Create an account';
    byId('accountError').textContent = '';
  }

  byId('accountButton').addEventListener('click', () => { refresh(); byId('accountDialog').showModal(); });
  byId('accountClose').addEventListener('click', () => byId('accountDialog').close());
  byId('accountSwitch').addEventListener('click', () => mode(!registering));
  byId('accountForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = byId('accountSubmit');
    button.disabled = true;
    byId('accountError').textContent = '';
    const fields = new FormData(event.currentTarget);
    try {
      const result = await request(registering ? 'register' : 'login', {method: 'POST', payload: registering
        ? {name: fields.get('name'), mobile: fields.get('mobile'), email: fields.get('email'),
          password: fields.get('password'), password_confirmation: fields.get('password')}
        : {login: fields.get('login'), password: fields.get('password')}});
      token = result.token;
      sessionStorage.setItem(tokenKey, token);
      user = result.user;
      event.currentTarget.reset();
      refresh();
      byId('accountDialog').close();
    } catch (error) {
      byId('accountError').textContent = error.message || 'Could not sign in.';
    } finally { button.disabled = false; }
  });
  byId('logoutButton').addEventListener('click', async () => {
    try { await request('logout', {method: 'POST', authorized: true}); }
    catch { byId('status').textContent = 'Signed out on this browser; the server session may remain active until expiry.'; }
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
  byId('orderForm').addEventListener('submit', event => {
    if (user) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    byId('basket').close();
    byId('accountError').textContent = 'Please sign in to send your enquiry.';
    byId('accountDialog').showModal();
  }, true);

  mode(false);
  if (token) request('me', {authorized: true}).then(result => {
    user = result.user;
    refresh();
  }).catch(error => {
    if (/sign in|expired/i.test(error.message)) {
      token = null;
      sessionStorage.removeItem(tokenKey);
    }
  });
})();
