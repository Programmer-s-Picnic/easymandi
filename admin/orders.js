(() => {
  'use strict';
  const api = 'https://cserver.learnwithchampak.live/easymandi/api/';
  const byId = id => document.getElementById(id);
  const session=window.AdminSession;
  let orders = [];
  const notificationRoot=document.createElement('section');
  byId('ordersList').after(notificationRoot);
  const inbox=new NotificationInbox(notificationRoot,
    ()=>request('notifications?audience=admin'),
    id=>request('notifications?audience=admin',{id}),
    n=>{byId('ordersFilter').value='All';byId('ordersDeliveryFilter').value='All';render();const card=[...byId('ordersList').children].find(c=>c.textContent.includes(n.order_ref));card?.scrollIntoView({behavior:'smooth'});});

  const statuses = ['New', 'Confirmed', 'Preparing', 'Delivered', 'Cancelled'];
  const deliveryStatuses = {not_created:'Not sent to delivery',created:'Unassigned',assigned:'Assigned',picked_up:'Picked up',out_for_delivery:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled'};
  const deliveryLabel = document.createElement('label');
  deliveryLabel.className = 'field';
  const deliveryCaption = document.createElement('span');
  deliveryCaption.textContent = 'Filter by delivery status';
  const deliveryFilter = document.createElement('select');
  deliveryFilter.id = 'ordersDeliveryFilter';
  for (const [value, label] of [['All','All delivery statuses'], ...Object.entries(deliveryStatuses)]) {
    const option = document.createElement('option');
    option.value = value; option.textContent = label; deliveryFilter.append(option);
  }
  deliveryLabel.append(deliveryCaption, deliveryFilter);
  byId('ordersControls').insertBefore(deliveryLabel, byId('ordersCount'));
  byId('ordersFilter').previousElementSibling.textContent = 'Filter by order status';
  deliveryFilter.addEventListener('change', () => { byId('ordersFilter').value = 'All'; applyFilters(); });
  deliveryFilter.addEventListener('input', () => { byId('ordersFilter').value = 'All'; applyFilters(); });
  const resetFilters = document.createElement('button');
  resetFilters.type = 'button';
  resetFilters.className = 'btn secondary';
  resetFilters.textContent = 'Show all orders';
  resetFilters.onclick = () => { byId('ordersFilter').value = 'All'; deliveryFilter.value = 'All'; render(); };
  byId('ordersControls').append(resetFilters);
  const filterHelp = document.createElement('p');
  filterHelp.className = 'hint';
  filterHelp.textContent = 'Choose an order status or a delivery status. Changing one resets the other to All.';
  byId('ordersControls').append(filterHelp);
  const deliveryStatus = order => order.delivery_status || 'not_created';
  const money = value => '₹' + Number(value).toFixed(2);
  const message = (value, error = false) => {
    byId('ordersMessage').textContent = value;
    byId('ordersMessage').className = error ? 'error' : 'hint';
  };
  async function request(path, payload = {}) {
    const response = await AppHttp.fetch(api + (path.startsWith('notifications?')?'notifications.php?audience=admin':path+'.php'), {
      method: 'POST', cache: 'no-store',
      headers: {'Content-Type': 'application/json', ...session.headers()},
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
  const normalized = value => String(value || '').trim().toLowerCase().replaceAll(' ', '_');
  function applyFilters() {
    const orderFilter = normalized(byId('ordersFilter').value);
    const deliveryValue = normalized(deliveryFilter.value);
    let shown = 0;
    for (const card of byId('ordersList').querySelectorAll('[data-order-status]')) {
      const matches = (orderFilter === 'all' || card.dataset.orderStatus === orderFilter) &&
        (deliveryValue === 'all' || card.dataset.deliveryStatus === deliveryValue);
      card.hidden = !matches;
      if(matches)shown++;
    }
    byId('ordersCount').textContent = shown + ' of ' + orders.length + ' orders shown';
    const empty = byId('ordersEmpty');
    if(empty){empty.hidden=shown>0;empty.textContent=orders.length?'No orders match the selected status. Choose Show all orders to reset.':'No orders have been loaded.';}
  }
  function render() {
    const root = byId('ordersList');
    root.replaceChildren();
    const empty=document.createElement('p');empty.id='ordersEmpty';empty.className='hint';root.append(empty);
    for (const order of orders) {
      const card = document.createElement('article');
      card.className = 'product';
      card.dataset.orderId=order.public_id;
      card.dataset.orderStatus=normalized(order.status);
      card.dataset.deliveryStatus=normalized(deliveryStatus(order));
      const title = document.createElement('h3');
      title.textContent = 'Order ' + order.public_id + ' · ' + money(order.total);
      const date = document.createElement('p');
      date.className = 'hint';
      date.textContent = order.created_at + ' · ' + order.source;
      const progress = document.createElement('p');
      progress.textContent = 'Order status: ' + order.status + ' · Delivery status: ' + (deliveryStatuses[deliveryStatus(order)] || order.delivery_status);
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
      card.append(title, date, progress, customer, address, map, items, totals, row);
      root.append(card);
    }
    applyFilters();
  }
  function lock() {
    inbox.stop();
    if(session.token)session.clear();
    orders = [];
    byId('ordersPassword').value = '';
    byId('ordersPassword').parentElement.hidden=false;byId('ordersUnlock').hidden=false;
    byId('ordersRefresh').hidden = true;
    byId('ordersLock').hidden = true;
    byId('ordersControls').hidden = true;
    byId('ordersList').replaceChildren();
  }
  async function refresh() {
    if (!session.token) return;
    message('Loading orders…');
    try {
      const token=session.token;
      const result = await request('admin-orders');
      if(!token||session.token!==token)return;
      orders = result.orders;
      inbox.active=true;
      byId('ordersPassword').parentElement.hidden=true;byId('ordersUnlock').hidden=true;
      byId('ordersControls').hidden = false;
      byId('ordersRefresh').hidden = false;
      byId('ordersLock').hidden = false;
      message('Orders loaded.');
      render();
      inbox.refresh().catch(() => { message('Orders loaded. Notifications could not refresh; they will retry automatically.'); });
    } catch (error) { message(error.message, true); }
  }
  byId('ordersUnlock').onclick = async () => {
    if(session.token){await refresh();return;}
    const input = byId('ordersPassword');
    if (!input.value) { message('Enter the admin password.', true); input.focus(); return; }
    try { await session.login(input.value); input.value=''; await refresh(); } catch(error){input.value='';message(error.message,true);}
  };
  window.addEventListener('admin-session-started',refresh);
  window.addEventListener('admin-session-ended',()=>{lock();message('Admin session ended after 30 minutes. Enter the password again.');});
  if(session.token)refresh();
  byId('ordersRefresh').onclick = refresh;
  byId('ordersLock').onclick = () => { lock(); message('Orders locked.'); };
  byId('ordersFilter').addEventListener('change', () => { deliveryFilter.value = 'All'; applyFilters(); });
  byId('ordersFilter').addEventListener('input', () => { deliveryFilter.value = 'All'; applyFilters(); });
  setInterval(() => { if (session.token && !document.hidden) refresh(); }, 300000);
  document.addEventListener('visibilitychange', () => { if (session.token && !document.hidden) refresh(); });
})();

