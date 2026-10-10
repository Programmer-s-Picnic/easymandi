/* Mandi V1: a single all-units quantity threshold per product. */
(function(){
 'use strict';
 const paise=value=>Math.round(Number(value)*100);
 const quote=(product,qty)=>{
   const quantity=Math.max(0,Math.trunc(Number(qty)||0));
   const regular=paise(product.price);
   const rule=product.mandi||{};
   const threshold=Number(rule.minimumQuantity);
   const rate=paise(rule.unitPrice);
   const enabled=rule.enabled===true&&Number.isInteger(threshold)&&threshold>=2&&threshold<=99
      &&rate>0&&rate<regular;
   const active=enabled&&quantity>=threshold;
   const unit=active?rate:regular;
   return {unitPrice:unit/100,retailPrice:regular/100,minimumQuantity:threshold,
     enabled,active,quantity,lineTotal:quantity*unit/100,
     savings:quantity*(regular-unit)/100,
     remaining:enabled?Math.max(0,threshold-quantity):0};
 };
 const subtotal=(products,cart)=>Math.round(
   products.reduce((sum,p)=>sum+Math.round(quote(p,cart[p.id]||0).lineTotal*100),0))/100;
 window.EasyMandiPricing=Object.freeze({quote,subtotal});
})();
