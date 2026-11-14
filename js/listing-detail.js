import {priceLabel,discountLabel} from './listing-display.js';
const root=document.getElementById('listingDetail');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
try{
 const id=new URLSearchParams(location.search).get('id');if(!/^[0-9a-f-]{36}$/i.test(id||''))throw Error('Annonce introuvable.');
 const cfg=await fetch('./config/auth.json').then(r=>r.json());
 const url=new URL(cfg.supabaseUrl+'/rest/v1/listings');url.searchParams.set('id','eq.'+id);url.searchParams.set('active','eq.true');url.searchParams.set('select','*');
 const response=await fetch(url,{headers:{apikey:cfg.supabaseAnonKey}});if(!response.ok)throw Error('Impossible de charger cette annonce. Réessayez.');
 const [a]=await response.json();if(!a)throw Error('Cette annonce n’est plus disponible.');
 document.title=a.title+' · IG Buy Now';root.replaceChildren();
 const layout=el('div',null,'detailLayout'),gallery=el('section',null,'detailPanel'),info=el('section',null,'detailPanel');
 const photos=[...new Set([a.image_url,...(a.image_urls||[])].filter(Boolean))];
 const image=el('img');image.className='detailMainImage';image.alt=a.title;image.referrerPolicy='no-referrer';image.onerror=()=>{image.alt='Image indisponible'};
 if(photos.length){image.src=photos[0];gallery.append(image);const thumbs=el('div',null,'thumbs');photos.forEach((url,i)=>{const b=el('button');b.type='button';b.setAttribute('aria-label','Voir la photo '+(i+1));const t=el('img');t.src=url;t.alt='Photo '+(i+1);t.loading='lazy';t.referrerPolicy='no-referrer';b.append(t);b.onclick=()=>{image.src=url};thumbs.append(b)});gallery.append(thumbs)}else gallery.append(el('p','Photos disponibles sur demande.'));
 info.append(el('p',a.game||'Clash of Clans','eyebrow'),el('h1',a.title));
 if(discountLabel(a))info.append(el('p',discountLabel(a)+' sur le devis confirmé'));
 info.append(el('p',a.sold?'Vendu':priceLabel(a),'listingPrice'));
 const request=el('button',a.sold?'Annonce vendue':'Faire une demande','primaryAction');request.disabled=!!a.sold;request.onclick=()=>window.igbnRequest?.(a.id);info.append(request,el('p','Disponibilité et prix définitif confirmés avant tout paiement.'));
 const favorite=el('button','♡ Ajouter aux favoris','favoriteIcon');favorite.dataset.listingId=a.id;favorite.setAttribute('aria-pressed','false');favorite.onclick=()=>window.igbnLike?.(a.id,favorite);info.append(favorite);
 layout.append(gallery,info);const description=el('section',null,'detailPanel');description.append(el('h2','Description de l’annonce'),el('p',a.description||'Contactez-nous pour obtenir les détails de ce compte.','longDescription'));root.append(layout,description);document.dispatchEvent(new Event('igbn:listings-rendered'));
}catch(e){root.textContent=e.message}
