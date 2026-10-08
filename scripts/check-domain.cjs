/* Ensure the Easy Mandi custom-domain root stays in sync with /web/. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const verify=(pass,message)=>{if(!pass)throw Error('Domain validation failed: '+message);};
const canonical='https://easymandi.in/';
const web=read('web/index.html');
const home=read('index.html');
const expected=web.replace(
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">\n<!-- Render the customer homepage at the domain root while loading its assets from /web/. -->\n<base href="/web/">'
);
verify(home===expected,'root and /web/ storefront HTML differ (except for root <base> path)');
verify(read('CNAME').trim()==='easymandi.in','CNAME should contain easymandi.in');
verify(read('sitemap.xml').includes('<loc>'+canonical+'</loc>'),'sitemap points to root');
verify(read('robots.txt').includes('Sitemap: https://easymandi.in/sitemap.xml'),'robots sitemap points to domain');
verify(web.includes('<link rel="canonical" href="'+canonical+'">'),'customer canonical URL');
verify(web.includes('https://easymandi.in/web/og-image.svg'),'social share image path');
verify(!web.includes('programmer-s-picnic.github.io/easymandi'),'old storefront URL in HTML');
verify(read('admin/index.html').includes('https://easymandi.in/admin/'),'admin nav official URL');
verify(read('admin/index.html').includes('name="robots" content="noindex,nofollow"'),'admin must remain noindex');
const attrs=[...home.matchAll(/(?:href|src)="([^"]+)"/g)].map(v=>v[1]);
let count=0;
for(const uri of attrs){
 if(uri.startsWith('#')||uri.startsWith('https://')||uri.startsWith('http://')||uri==='/web/')continue;
 const local=uri.split(/[?#]/,1)[0];
 if(!local)continue;
 const destination=path.resolve(root,'web',local);
 verify(destination.startsWith(root+path.sep),'asset path escaped the site root: '+uri);
 verify(fs.existsSync(destination),'asset referenced by homepage is missing: '+uri);
 count++;
}
console.log('PASS: easymandi.in canonical root, admin, sitemap, CNAME, SEO and '+count+' assets');
