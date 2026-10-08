(() => {
  'use strict';
  const api = 'https://cserver.learnwithchampak.live/easymandi/api/';
  const byId = id => document.getElementById(id);
  const session=window.AdminSession;
  let orders = [], statusCounts=null, totalOrders=0;
  const notificationRoot=document.createElement('section');
  byId('ordersList').after(notificationRoot);
  const inbox=new NotificationInbox(notificationRoot,
  ()=>request('notifications?audience=admin'),
  id=>request('notifications?audience=admin',{
    id
  }),
  n=>{
    byId('ordersFilter').value='All';
    byId('ordersDeliveryFilter').value='All';
    render();
    const card=[...byId('ordersList').children].find(c=>c.dataset.orderId===n.order_ref);
    if(card)card.open=true;
    card?.scrollIntoView({
      behavior:'smooth'
    });
  });
  const statuses = ['New', 'Confirmed', 'Preparing', 'Delivered', 'Cancelled'];
  const deliveryStatuses = {
    not_created:'Not sent to delivery',created:'Unassigned',assigned:'Assigned',picked_up:'Picked up',out_for_delivery:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled'
  };
  const deliveryLabel = document.createElement('label');
  deliveryLabel.className = 'field';
  const deliveryCaption = document.createElement('span');
  deliveryCaption.textContent = 'Filter by delivery status';
  const deliveryFilter = document.createElement('select');
  deliveryFilter.id = 'ordersDeliveryFilter';
  for (const [value, label] of [['All','All delivery statuses'], ...Object.entries(deliveryStatuses)]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    deliveryFilter.append(option);
  }
  deliveryLabel.append(deliveryCaption, deliveryFilter);
  byId('ordersControls').insertBefore(deliveryLabel, byId('ordersCount'));
  byId('ordersFilter').previousElementSibling.textContent = 'Filter by order status';
  deliveryFilter.addEventListener('change', () => {
    byId('ordersFilter').value = 'All';
    applyFilters();
  });
  deliveryFilter.addEventListener('input', () => {
    byId('ordersFilter').value = 'All';
    applyFilters();
  });
  const resetFilters = document.createElement('button');
  resetFilters.type = 'button';
  resetFilters.className = 'btn secondary';
  resetFilters.textContent = 'Show all orders';
  resetFilters.onclick = () => {
    byId('ordersFilter').value = 'All';
    deliveryFilter.value = 'All';
    search.value='';
    render();
  };
  byId('ordersControls').append(resetFilters);
  const search=document.createElement('input');search.type='search';search.id='ordersSearch';search.placeholder='Search order, customer, phone or locality';search.setAttribute('aria-label','Search customer orders');
  search.addEventListener('input',applyFilters);byId('ordersControls').append(search);
  const dashboard=document.createElement('div');dashboard.className='order-count-grid';dashboard.id='orderDashboard';byId('ordersControls').append(dashboard);
  function selectStatus(status){byId('ordersFilter').value=status;deliveryFilter.value='All';search.value='';applyFilters();byId('ordersPanel').scrollIntoView({behavior:'smooth'});}
  function renderCounts(){
    const counts=statusCounts||Object.fromEntries(statuses.map(status=>[status,orders.filter(o=>o.status===status).length]));
    dashboard.replaceChildren();
    for(const [status,count] of Object.entries(counts)){const button=document.createElement('button');button.type='button';button.className='order-count-chip';const label=document.createElement('span');label.textContent=status;const number=document.createElement('strong');number.textContent=count;button.append(label,number);button.onclick=()=>selectStatus(status);dashboard.append(button);}
    const note=statusCounts?'Counts cover all orders. The list shows the latest '+orders.length+' of '+totalOrders+' orders.':'Counts cover the loaded orders.';
    inbox.setOrderSummary(counts,selectStatus,note);
  }
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
  async function request(path, payload = {
  }) {
    const response = await AppHttp.fetch(api + (path.startsWith('notifications?')?'notifications.php?audience=admin':path+'.php'), {
      method: 'POST', cache: 'no-store',
      headers: {
        'Content-Type': 'application/json', ...session.headers()
      },
      body: JSON.stringify(payload)
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw Error('Unexpected server response.');
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 429) lock();
      throw Error(result.error || 'Could not load orders.');
    }
    return result;
  }
  function itemText(order) {
    return order.items.map(item => item.product_name + ' (' + item.unit + ') × ' + item.quantity + ' — ' + money(item.line_total)).join(' · ');
  }
  const paymentLabel = order => {
    const method = order.payment_method === 'upi' ? 'UPI' : 'Cash on Delivery';
    const status = String(order.payment_status || 'pending').replaceAll('_',' ');
    return method + ' · ' + status.charAt(0).toUpperCase() + status.slice(1);
  };
  async function paymentAction(order, operation) {
    const result = await request('admin-payment', {orderId: order.public_id, operation});
    message('Payment for order ' + order.public_id + ': ' + result.status + '.');
    await refresh();
  }
  async function showReceipt(order) {
    const result = await request('admin-payment', {orderId: order.public_id, operation:'receipt'});
    const dialog=document.createElement('dialog');
    dialog.className='record-dialog';
    const title=document.createElement('h2');title.textContent='Payment receipt · '+order.public_id;
    const info=document.createElement('p');info.textContent='UPI reference: '+(result.upiReference||'Not supplied')+' · Status: '+result.status;
    const image=document.createElement('img');image.src=result.receipt;image.alt='Customer payment receipt';image.style.cssText='max-width:min(90vw,560px);max-height:65vh;display:block;margin:12px auto;border-radius:12px';
    const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='Close';close.onclick=()=>dialog.close();
    dialog.append(title,info,image,close);document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();
  }
  const normalized = value => String(value || '').trim().toLowerCase().replaceAll(' ', '_');
  function applyFilters() {
    const orderFilter = normalized(byId('ordersFilter').value);
    const deliveryValue = normalized(deliveryFilter.value);
    let shown = 0;
    for (const card of byId('ordersList').querySelectorAll('[data-order-status]')) {
      const matches = (orderFilter === 'all' || card.dataset.orderStatus === orderFilter) &&
      (deliveryValue === 'all' || card.dataset.deliveryStatus === deliveryValue) &&
      (!search.value.trim() || card.dataset.search.includes(search.value.trim().toLowerCase()));
      card.hidden = !matches;
      if(matches)shown++;
    }
    byId('ordersCount').textContent = shown + ' of ' + orders.length + ' orders shown';
    const empty = byId('ordersEmpty');
    if(empty){
      empty.hidden=shown>0;
      empty.textContent=orders.length?'No orders match the selected status. Choose Show all orders to reset.':'No orders have been loaded.';
    }
  }
  function render() {
    const root = byId('ordersList');
    root.replaceChildren();
    const empty=document.createElement('p');
    empty.id='ordersEmpty';
    empty.className='hint';
    root.append(empty);
    for (const order of orders) {
      const card = document.createElement('details');
      card.className = 'order-card';
      card.dataset.search=[order.public_id,order.customer_name,order.mobile,order.locality,order.status].join(' ').toLowerCase();
      card.dataset.orderId=order.public_id;
      card.dataset.orderStatus=normalized(order.status);
      card.dataset.deliveryStatus=normalized(deliveryStatus(order));
      const title = document.createElement('summary');
      title.className='order-card-heading';
      for(const [value,style] of [[order.customer_name,'order-customer'],[money(order.total),'order-amount'],['#'+order.public_id,'order-reference'],[order.status,'order-status '+normalized(order.status)]]){const part=document.createElement('span');part.className=style;part.textContent=value;title.append(part);}
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
        map.target = '_blank';
        map.rel = 'noopener noreferrer';
        map.textContent = 'Open customer location on map';
      }
      const items = document.createElement('p');
      items.textContent = itemText(order);
      items.className='order-items';
      const totals = document.createElement('p');
      totals.className = 'hint';
      totals.textContent = 'Subtotal ' + money(order.subtotal) + ' · Delivery ' + money(order.delivery_fee);
      const payment = document.createElement('section');
      payment.className='payment-admin';
      const paymentInfo=document.createElement('p');
      paymentInfo.innerHTML='<strong>Payment:</strong> '+paymentLabel(order)+(order.upi_reference?' · Ref '+order.upi_reference:'');
      payment.append(paymentInfo);
      const paymentActions=document.createElement('div');paymentActions.className='row';
      if(order.payment_has_receipt){
        const receipt=document.createElement('button');receipt.type='button';receipt.className='btn secondary';receipt.textContent='View receipt';receipt.onclick=()=>showReceipt(order).catch(error=>message(error.message,true));paymentActions.append(receipt);
      }
      if(order.payment_method==='upi' && order.payment_status==='submitted'){
        const verify=document.createElement('button');verify.type='button';verify.className='btn';verify.textContent='Verify UPI';verify.onclick=()=>paymentAction(order,'verify').catch(error=>message(error.message,true));
        const reject=document.createElement('button');reject.type='button';reject.className='btn secondary';reject.textContent='Reject receipt';reject.onclick=()=>paymentAction(order,'reject').catch(error=>message(error.message,true));
        paymentActions.append(verify,reject);
      }
      if(order.payment_method==='cod' && order.payment_status!=='paid' && order.status!=='Cancelled'){
        const paid=document.createElement('button');paid.type='button';paid.className='btn secondary';paid.textContent='Mark COD paid';paid.onclick=()=>paymentAction(order,'cod-paid').catch(error=>message(error.message,true));paymentActions.append(paid);
      }
      payment.append(paymentActions);
      const row = document.createElement('div');
      row.className = 'row';
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Status for order ' + order.public_id);
      select.style.maxWidth = '190px';
      for (const status of statuses) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        select.append(option);
      }
      select.value = order.status;
      const save = document.createElement('button');
      save.className = 'btn secondary';
      save.textContent = 'Update status';
      save.disabled = true;
      select.onchange = () => {
        save.disabled = select.value === order.status;
      };
      save.onclick = async () => {
        save.disabled = true;
        try {
          await request('admin-order-status', {
            orderId: order.public_id, status: select.value
          });
          order.status = select.value;
          message('Status updated for order ' + order.public_id + '.');
          await refresh();
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
      const content=document.createElement('div');content.className='order-card-body';
      content.append(date, progress, customer, address, map, items, totals, payment, row);
      window.EasyMandiPacking?.append(order,content,payload=>request('admin-order-notes',payload));
      card.append(title,content);
      root.append(card);
    }
    renderCounts();
    applyFilters();
  }
  function lock() {
    inbox.stop();
    if(session.token)session.clear();
    orders = [];statusCounts=null;totalOrders=0;dashboard.replaceChildren();
    byId('ordersUnlock').hidden=false;
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
      statusCounts=result.statusCounts||null;totalOrders=result.totalOrders||orders.length;
      inbox.active=true;
      byId('ordersUnlock').hidden=true;
      byId('ordersControls').hidden = false;
      byId('ordersRefresh').hidden = false;
      byId('ordersLock').hidden = false;
      message('Orders loaded.');
      render();
      inbox.refresh().catch(() => {
        message('Orders loaded. Notifications could not refresh; they will retry automatically.');
      });
    } catch (error) {
      message(error.message, true);
    }
  }
  byId('ordersUnlock').onclick = async () => {
    if(session.token){
      await refresh();
      return;
    }
    try {
      await window.AdminAccess.ensure();
    } catch(error) { message(error.message, true); }
  };
  window.addEventListener('admin-session-started',refresh);
  window.addEventListener('admin-session-ended',()=>{
    lock();
    message('Admin session ended after 30 minutes. Enter the password again.');
  });
  if(session.token)refresh();
  byId('ordersRefresh').onclick = refresh;
  byId('ordersLock').onclick = () => {
    lock();
    message('Orders locked.');
  };
  byId('ordersFilter').addEventListener('change', () => {
    deliveryFilter.value = 'All';
    applyFilters();
  });
  byId('ordersFilter').addEventListener('input', () => {
    deliveryFilter.value = 'All';
    applyFilters();
  });
  setInterval(() => {
    if (session.token && !document.hidden) refresh();
  }, 300000);
  document.addEventListener('visibilitychange', () => {
    if (session.token && !document.hidden) refresh();
  });
})();
