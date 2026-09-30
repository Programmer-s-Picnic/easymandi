(() => {
  'use strict';
  const api = 'https://cserver.learnwithchampak.live/easymandi/api/';
  const byId = id => document.getElementById(id);
  let password = null;
  let orders = [];
  const statuses = ['New', 'Confirmed', 'Preparing', 'Delivered', 'Cancelled'];
  const money = value => '₹' + Number(value).toFixed(2);
  const message = (value, error = false) => {
    byId('ordersMessage').textContent = value;
    byId('ordersMessage').className = error ? 'error' : 'hint';
  };
  async function request(path, payload = {}) {
    const response = await fetch(api + path + '.php', {
      method: 'POST', cache: 'no-store',
      headers: {'Content-Type': 'application/json', 'X-Admin-Password': password},
      body: JSON.stringify(payload)
    });
    let result;
    try { result = await response.json(); } catch { throw Error('Unexpected server response.'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 429) lock();
      throw Error(result.error || 'Could not load orders.');
    }
    return result;
  }
  function itemText(order) {
    return order.items.map(item => item.product_name + ' (' + item.unit + ') × ' + item.quantity + ' — ' + money(item.line_total)).join(' · ');
  }
  function render() {
    const root = byId('ordersList');
    root.replaceChildren();
    const filter = byId('ordersFilter').value;
    const visible = orders.filter(order => filter === 'All' || order.status === filter);
    byId('ordersCount').textContent = visible.length + ' orders shown';
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No orders in this view.';
      root.append(empty);
      return;
    }
    for (const order of visible) {
      const card = document.createElement('article');
      card.className = 'product';
      const title = document.createElement('h3');
      title.textContent = 'Order ' + order.public_id + ' · ' + money(order.total);
      const date = document.createElement('p');
      date.className = 'hint';
      date.textContent = order.created_at + ' · ' + order.source;
      const customer = document.createElement('p');
      customer.textContent = order.customer_name + ' · +91 ' + order.mobile;
      const address = document.createElement('p');
      address.textContent = [order.house, order.locality, order.landmark, order.city + ', ' + order.state + ' ' + order.pin].filter(Boolean).join(', ');
      const map = document.createElement('a');
      if (order.location_lat != null && order.location_lng != null) {
        map.href = 'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(order.location_lat + ',' + order.location_lng);
        map.target = '_blank'; map.rel = 'noopener noreferrer';
        map.textContent = 'Open customer location on map';
      }
      const items = document.createElement('p');
      items.textContent = itemText(order);
      const totals = document.createElement('p');
      totals.className = 'hint';
      totals.textContent = 'Subtotal ' + money(order.subtotal) + ' · Delivery ' + money(order.delivery_fee);
      const row = document.createElement('div');
      row.className = 'row';
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Status for order ' + order.public_id);
      select.style.maxWidth = '190px';
      for (const status of statuses) {
        const option = document.createElement('option');
        option.value = status; option.textContent = status;
        select.append(option);
      }
      select.value = order.status;
      const save = document.createElement('button');
      save.className = 'btn secondary';
      save.textContent = 'Update status';
      save.disabled = true;
      select.onchange = () => { save.disabled = select.value === order.status; };
      save.onclick = async () => {
        save.disabled = true;
        try {
          await request('admin-order-status', {orderId: order.public_id, status: select.value});
          order.status = select.value;
          message('Status updated for order ' + order.public_id + '.');
          render();
        } catch (error) {
          message(error.message, true);
          save.disabled = false;
        }
      };
      const delivery = document.createElement('a');
      delivery.className = 'btn secondary';
      delivery.href = 'https://programmer-s-picnic.github.io/delivery-app/web/?order=' + encodeURIComponent(order.public_id);
      delivery.textContent = 'Open in delivery admin';
      row.append(select, save, delivery);
      card.append(title, date, customer, address, map, items, totals, row);
      root.append(card);
    }
  }
  function lock() {
    password = null;
    orders = [];
    byId('ordersPassword').value = '';
    byId('ordersRefresh').hidden = true;
    byId('ordersLock').hidden = true;
    byId('ordersControls').hidden = true;
    byId('ordersList').replaceChildren();
  }
  async function refresh() {
    if (!password) return;
    message('Loading orders…');
    try {
      const result = await request('admin-orders');
      orders = result.orders;
      byId('ordersControls').hidden = false;
      byId('ordersRefresh').hidden = false;
      byId('ordersLock').hidden = false;
      message('Orders loaded.');
      render();
    } catch (error) { message(error.message, true); }
  }
  byId('ordersUnlock').onclick = async () => {
    const input = byId('ordersPassword');
    if (!input.value) { message('Enter the admin password.', true); input.focus(); return; }
    password = input.value;
    input.value = '';
    await refresh();
  };
  byId('ordersRefresh').onclick = refresh;
  byId('ordersLock').onclick = () => { lock(); message('Orders locked.'); };
  byId('ordersFilter').onchange = render;
})();
