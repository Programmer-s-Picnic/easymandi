(() => {
  const dialog = document.getElementById('adminDialog');
  const form = document.getElementById('adminForm');
  const input = document.getElementById('adminPassword');
  const error = document.getElementById('adminError');
  const button = document.getElementById('adminSubmit');
  let pending = null;
  window.AdminAccess = {
    ensure() {
      if (AdminSession.token) return Promise.resolve();
      if (pending) return pending.promise;
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      pending = {promise, resolve, reject};
      error.textContent = '';
      input.value = '';
      dialog.showModal();
      input.focus();
      return promise;
    }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (!input.value) { error.textContent = 'Enter the administrator password.'; input.focus(); return; }
    button.disabled = true;
    input.disabled = true;
    error.textContent = 'Signing in…';
    try {
      await AdminSession.login(input.value);
      const request = pending;
      pending = null;
      dialog.close();
      request?.resolve();
    } catch (failure) {
      error.textContent = failure.message || 'Could not sign in. Please retry.';
    } finally {
      input.value = '';
      button.disabled = false;
      input.disabled = false;
      if (dialog.open) input.focus();
    }
  };
  const cancel = () => {
    if (button.disabled) return;
    dialog.close();
  };
  document.getElementById('adminCancel').onclick = cancel;
  dialog.addEventListener('cancel', event => { if (button.disabled) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    input.value = '';
    const request = pending;
    pending = null;
    request?.reject(Error('Sign-in cancelled. Your draft has been preserved.'));
  });
  document.addEventListener('DOMContentLoaded', () => { AdminAccess.ensure().catch(() => {}); });
})();
