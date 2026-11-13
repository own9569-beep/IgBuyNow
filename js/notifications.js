import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cfg=await fetch('./config/auth.json',{cache:'no-store'}).then(r=>r.json());
const db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const bell=document.getElementById('notifyBell');
const admin=document.getElementById('adminShortcut');
const pop=document.getElementById('notifyPanel');
const count=document.getElementById('notifyCount');
let current=null,isAdmin=false;
const safe=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
async function syncUser(){
 const {data}=await db.auth.getUser();current=data.user;
 if(!current){admin.hidden=true;count.hidden=true;pop.hidden=true;return}
 const {data:membership}=await db.from('admin_members').select('user_id').eq('user_id',current.id).maybeSingle();
 isAdmin=!!membership;admin.hidden=!isAdmin;
 await refresh();await syncFavoriteIcons();
}
async function refresh(){
 if(!current)return;
 const {data,error}=await db.from('site_notifications').select('id,kind,title,body,link,is_read,created_at').order('created_at',{ascending:false}).limit(50);
 if(error){pop.replaceChildren(safe('p','Notifications momentanément indisponibles.'));return}
 const unread=data.filter(x=>!x.is_read).length;count.hidden=!unread;count.textContent=unread>99?'99+':String(unread);
 pop.replaceChildren();
 const head=safe('h3','🔔 Notifications');pop.append(head);
 if(!data.length){pop.append(safe('p','Aucune notification pour le moment.'));return}
 for(const n of data){
  const row=document.createElement('div');row.className='notificationItem'+(n.is_read?'':' unread');
  const title=safe('strong',n.title),body=safe('p',n.body),date=safe('small',new Date(n.created_at).toLocaleString('fr-FR'));
  const open=safe('button','Consulter');open.type='button';open.onclick=async()=>{await db.from('site_notifications').update({is_read:true}).eq('id',n.id);if(n.link){location.href=n.link}else refresh()};
  row.append(title,body,date,open);pop.append(row);
 }
 const readAll=safe('button','Tout marquer comme lu');readAll.type='button';readAll.onclick=async()=>{const {error}=await db.from('site_notifications').update({is_read:true}).eq('user_id',current.id).eq('is_read',false);if(!error)refresh()};pop.append(readAll);
}
bell.onclick=async()=>{if(!current){document.getElementById('account')?.click();return}pop.hidden=!pop.hidden;if(!pop.hidden)await refresh()};
admin.onclick=()=>location.href='./admin.html';
db.auth.onAuthStateChange(()=>setTimeout(syncUser,0));
await syncUser();
setInterval(()=>{if(current)refresh()},30000);
async function syncFavoriteIcons(){
 if(!current)return;
 const buttons=[...document.querySelectorAll('.favoriteIcon[data-listing-id]')];
 if(!buttons.length)return;
 const {data,error}=await db.from('listing_likes').select('listing_id').eq('user_id',current.id);
 if(error)return;
 const ids=new Set((data||[]).map(x=>x.listing_id));
 for(const b of buttons){const liked=ids.has(b.dataset.listingId);b.textContent=liked?'♥':'♡';b.setAttribute('aria-pressed',String(liked));b.title=liked?'Retirer des favoris':'Ajouter aux favoris';b.setAttribute('aria-label',b.title)}
}
document.addEventListener('igbn:listings-rendered',syncFavoriteIcons);
syncFavoriteIcons();
window.igbnLike=async (listingId,button)=>{
 const {data:{user}}=await db.auth.getUser();if(!user){document.getElementById('account')?.click();return}
 const {data:existing}=await db.from('listing_likes').select('listing_id').eq('listing_id',listingId).eq('user_id',user.id).maybeSingle();
 const {error}=existing?await db.from('listing_likes').delete().eq('listing_id',listingId).eq('user_id',user.id):await db.from('listing_likes').insert({listing_id:listingId,user_id:user.id});
 if(error){alert('Impossible de modifier les favoris : '+error.message);return}
 button.textContent=existing?'♡':'♥';button.title=existing?'Ajouter aux favoris':'Retirer des favoris';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(!existing));
};
window.igbnRequest=async listingId=>{
 const {data:{user}}=await db.auth.getUser();if(!user){document.getElementById('account')?.click();return}
 const {data:controls,error:controlsError}=await db.from('account_controls').select('purchase_blocked,banned').eq('user_id',user.id).maybeSingle();
 if(controlsError){alert('Impossible de vérifier votre compte pour le moment.');return}
 if(controls?.banned||controls?.purchase_blocked){alert('Votre compte n’est pas autorisé à envoyer de nouvelles demandes d’achat. Contactez le support si vous pensez qu’il s’agit d’une erreur.');return}
 const message=prompt('Votre question ou demande concernant ce compte (aucun paiement demandé) :','Bonjour, je souhaite des renseignements sur ce compte.');
 if(message===null)return;
 const {error}=await db.from('order_requests').insert({user_id:user.id,listing_id:listingId,message:message.trim().slice(0,1000)});
 alert(error?'Demande non enregistrée : '+error.message:'Votre demande a été envoyée au vendeur. Aucun paiement n’a été effectué.');
};
