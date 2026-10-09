/** Rebuild separate static admin pages after any change to index.html.
 * Source of truth is index.html; all CSS/JS modules are shared. Run:
 *   node admin/build-pages.mjs
 * Never hand-edit products.html, customers.html, delivery-partners.html or how-to.html.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url));
const source=await readFile(join(dir,'index.html'),'utf8');
const pages=[
 {page:'products',file:'products.html',title:'Products Master',description:'Easy Mandi product catalog and store settings for authorized administrators.'},
 {page:'localities',file:'localities.html',title:'Localities Master',description:'Varanasi delivery areas and service coverage for authorized administrators.'},
 {page:'customers',file:'customers.html',title:'Customers Master',description:'Easy Mandi customer records and order history for authorized administrators.'},
 {page:'partners',file:'delivery-partners.html',title:'Delivery Partners Master',description:'Easy Mandi delivery partner records for authorized administrators.'},
 {page:'help',file:'how-to.html',title:'How to Work',description:'Daily operating instructions for the Easy Mandi administration team.'}
];
function once(s,from,to){if(!s.includes(from))throw new Error('Missing source anchor: '+from);return s.replace(from,to);}
for(const {page,file,title,description} of pages){
 let html=once(source,'<!doctype html>','<!doctype html>\n<!-- Generated from admin/index.html by admin/build-pages.mjs. Edit index.html instead. -->');
 html=once(html,'<html lang="en" data-admin-page="operations">','<html lang="en" data-admin-page="'+page+'">');
 html=once(html,'<title>Easy Mandi · Operations Desk</title>','<title>Easy Mandi · '+title+'</title>');
 html=once(html,'<link rel="canonical" href="https://easymandi.in/admin/">','<link rel="canonical" href="https://easymandi.in/admin/'+file+'">');
 html=once(html,'<meta name="description" content="Private Easy Mandi administration for products, customer orders and delivery operations.">','<meta name="description" content="'+description+'">');
 html=once(html,'<meta property="og:title" content="Easy Mandi | Admin workspace">','<meta property="og:title" content="Easy Mandi | '+title+'">');
 html=once(html,'<meta property="og:description" content="Easy Mandi administration for authorized staff.">','<meta property="og:description" content="'+description+'">');
 html=once(html,'<meta property="og:url" content="https://easymandi.in/admin/">','<meta property="og:url" content="https://easymandi.in/admin/'+file+'">');
 await writeFile(join(dir,file),html);
 console.log('Generated',file);
}
