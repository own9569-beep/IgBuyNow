import {mkdir,rm,readdir,copyFile,cp} from 'node:fs/promises';
// Deploy only public assets; SQL, tests, legal drafts and server source stay private.
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const name of await readdir('.')) if(name.endsWith('.html')||['robots.txt','sitemap.xml','hdv18.jpg'].includes(name)) await copyFile(name,'dist/'+name);
for(const name of ['assets','css','js','config']) await cp(name,'dist/'+name,{recursive:true});
console.log('Static site prepared: public pages and assets only.');
