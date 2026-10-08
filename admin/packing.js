/* Per-order packing sheet and private admin notes (no QR/OTP is printed). */
(() => {
  'use strict';
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function printSheet(order){
    const pop=window.open('','_blank');
    if(!pop){alert('Allow popups to print this order.');return;}
    const items=(order.items||[]).map(item=>'<tr><td class="check">☐</td><td>'+h(item.product_name)+'</td><td>'+h(item.quantity)+' '+h(item.unit)+'</td><td>'+h(item.line_total)+'</td></tr>').join('');
    const address=[order.house,order.locality,order.landmark,order.city,order.state,order.pin].filter(Boolean).join(', ');
    const markup=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Easy Mandi · ${h(order.public_id)} packing list</title>
    <style>body{font:15px Arial,sans-serif;color:#162d22;max-width:760px;margin:22px auto;padding:0 16px}header{display:flex;justify-content:space-between;border-bottom:3px solid #176b46;padding-bottom:12px}h1{margin:0;color:#176b46}h2{margin:16px 0 8px;font-size:18px}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border:1px solid #ccd9cf}th{background:#e8f1ea}.check{font-size:24px;width:35px}.notes{white-space:pre-wrap;border:1px solid #cbdccc;padding:12px;min-height:30px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:35px}.signatures p{border-top:1px solid #333;padding-top:8px}.controls{margin:12px 0}button{padding:10px 16px;background:#176b46;color:white;border:0;border-radius:8px}@media print{.controls{display:none}body{margin:0}}</style></head><body>
    <div class="controls"><button onclick="window.print()">Print / Save as PDF</button></div>
    <header><div><h1>🥬 Easy Mandi</h1><strong>Packing & Delivery Checklist</strong></div><div><strong>Order ${h(order.public_id)}</strong><p>${h(order.created_at)}</p></div></header>
    <p><strong>Customer:</strong> ${h(order.customer_name)} · ${h(order.mobile)}</p><p><strong>Delivery address:</strong> ${h(address)}</p>
    <p><strong>Payment:</strong> ${h(order.payment_method||'cod').toUpperCase()} · ${h(order.payment_status||'pending')} · <strong>Total:</strong> ₹${h(order.total)}</p>
    <h2>Items to pack</h2><table><thead><tr><th>✓</th><th>Item</th><th>Quantity</th><th>Line total (₹)</th></tr></thead><tbody>${items}</tbody></table>
    <h2>Customer instructions</h2><div class="notes">${h(order.customer_note)||'None'}</div>
    <h2>Instructions for packer</h2><div class="notes">${h(order.packer_note)||'None'}</div>
    <h2>Instructions for delivery partner</h2><div class="notes">${h(order.partner_note)||'None'}</div>
    <div class="signatures"><p>Packed by / Date</p><p>Checked by / Date</p><p>Delivery partner / Date</p><p>Receiver signature / Date</p></div>
    <small>Private document for order fulfilment. The customer handoff OTP and QR are intentionally excluded.</small></body></html>`;
    pop.document.open();pop.document.write(markup);pop.document.close();pop.focus();
  }
  function append(order,root,saveNotes){
    const section=document.createElement('section');section.className='order-note-editor';
    const title=document.createElement('h4');title.textContent='Packing and delivery notes';section.append(title);
    const customer=document.createElement('p');customer.textContent='Customer: '+(order.customer_note||'No instructions supplied');section.append(customer);
    const fields=[['packer_note','Packer instructions'],['partner_note','Delivery partner instructions']];
    const controls={};
    for(const [name,label] of fields){
      const wrap=document.createElement('label');wrap.textContent=label;
      const input=document.createElement('textarea');input.rows=2;input.maxLength=500;input.value=order[name]||'';
      wrap.append(input);section.append(wrap);controls[name]=input;
    }
    const feedback=document.createElement('p');feedback.setAttribute('role','status');
    const actions=document.createElement('div');actions.className='row';
    const save=document.createElement('button');save.type='button';save.className='btn secondary';save.textContent='Save instructions';
    save.onclick=async()=>{
      save.disabled=true;feedback.textContent='';
      try{
        await saveNotes({orderId:order.public_id,packerNote:controls.packer_note.value.trim(),partnerNote:controls.partner_note.value.trim()});
        order.packer_note=controls.packer_note.value.trim();order.partner_note=controls.partner_note.value.trim();
        feedback.textContent='Instructions saved to server.';
      }catch(e){feedback.textContent=e.message||'Could not save instructions.';}
      finally{save.disabled=false;}
    };
    const print=document.createElement('button');print.type='button';print.className='btn secondary';print.textContent='Print / Save order PDF';print.onclick=()=>printSheet(order);
    actions.append(save,print);section.append(actions,feedback);root.append(section);
  }
  window.EasyMandiPacking={append,printSheet};
})();
