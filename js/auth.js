import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const $ = id => document.getElementById(id);
const account = $('account'), modal = $('modal'), area = $('modalContent');
const config = await fetch('./config/auth.json', {cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
const client = config.supabaseUrl && config.supabaseAnonKey ? createClient(config.supabaseUrl,config.supabaseAnonKey) : null;
let user=null, mode='login';
function make(tag,cls='',value=''){const n=document.createElement(tag);if(cls)n.className=cls;if(value)n.textContent=value;return n}
function button(text,cls,fn){const b=make('button',cls,text);b.type='button';b.onclick=fn;return b}
function notice(text,bad=false){const n=$('authNotice');if(n){n.textContent=text;n.className='auth-notice'+(bad?' error':'');n.hidden=false}}
function setMode(m){mode=m;draw()}
function input(label,type,autocomplete){const box=make('label','auth-field');const name=make('span','',label);const i=make('input','auth-input');i.type=type;i.required=true;i.autocomplete=autocomplete;i.placeholder=label;if(type==='password')i.minLength=8;box.append(name,i);return {box,i}}
function draw(){
 area.replaceChildren();
 const wrap=make('div','auth-wrap');
 wrap.append(make('div','auth-mark','IG'),make('div','auth-eyebrow','IG BUY NOW'));
 const title=make('h2','auth-title',user?'Mon espace':mode==='reset'?'Mot de passe oublié ?':'Bienvenue chez IG Buy Now');
 const sub=make('p','auth-subtitle',user?'Gère ta session en toute sécurité.':mode==='reset'?'Nous t’enverrons un lien pour retrouver ton compte.':'Connecte-toi pour retrouver ton espace gaming.');
 wrap.append(title,sub);
 if(!client){wrap.append(make('p','auth-notice','Service de connexion temporairement indisponible.'));area.append(wrap);return}
 if(user){
  const {data:membership}=await client.from('admin_members').select('user_id').eq('user_id',user.id).maybeSingle();
  if(membership){wrap.append(make('p','auth-notice','Mode administrateur activé.'));const admin=button('Ouvrir mon espace administrateur','auth-submit',()=>location.href='./admin.html');wrap.append(admin)}
  const card=make('div','auth-user');card.append(make('span','auth-avatar','👤'),make('span','',user.email||'Compte connecté'));wrap.append(card);
  wrap.append(button('Se déconnecter','auth-submit',async()=>{const {error}=await client.auth.signOut();if(error)notice(error.message,true);else{user=null;refresh();draw()}}));
  const n=make('p','auth-notice');n.id='authNotice';n.hidden=true;wrap.append(n);area.append(wrap);return;
 }
 if(mode!=='reset'){
  const tabs=make('div','auth-tabs');tabs.setAttribute('role','tablist');
  for(const [key,label] of [['login','Connexion'],['register','Créer un compte']]){
   const b=button(label,'auth-tab'+(mode===key?' active':''),()=>setMode(key));b.setAttribute('role','tab');b.setAttribute('aria-selected',String(mode===key));tabs.append(b)
  }
  wrap.append(tabs);
 }
 const form=make('form','auth-form');
 const email=input('Adresse e-mail','email','email');form.append(email.box);
 let password;
 if(mode!=='reset'){password=input('Mot de passe','password',mode==='register'?'new-password':'current-password');form.append(password.box)}
 if(mode==='login'){const line=make('div','auth-help');line.append(button('Mot de passe oublié ?','auth-link',()=>setMode('reset')));form.append(line)}
 const submit=make('button','auth-submit',mode==='register'?'Créer mon compte':mode==='reset'?'Recevoir le lien':'Se connecter');submit.type='submit';form.append(submit);
 form.onsubmit=async e=>{
  e.preventDefault();submit.disabled=true;submit.textContent='Un instant…';
  try{
   let r;
   if(mode==='register')r=await client.auth.signUp({email:email.i.value.trim(),password:password.i.value,options:{emailRedirectTo:location.origin}});
   else if(mode==='reset')r=await client.auth.resetPasswordForEmail(email.i.value.trim(),{redirectTo:location.origin});
   else r=await client.auth.signInWithPassword({email:email.i.value.trim(),password:password.i.value});
   if(r.error)throw r.error;
   if(mode==='login'){user=r.data.user;refresh();draw()}else notice(mode==='register'?'Compte créé ! Vérifie ta boîte e-mail pour confirmer ton inscription.':'Si cette adresse existe, tu recevras un lien de réinitialisation.');
  }catch(err){notice(err.message||'Une erreur est survenue.',true)}
  finally{submit.disabled=false;submit.textContent=mode==='register'?'Créer mon compte':mode==='reset'?'Recevoir le lien':'Se connecter'}
 };
 wrap.append(form);
 if(mode==='reset')wrap.append(button('← Retour à la connexion','auth-back',()=>setMode('login')));
 else {
  const sep=make('div','auth-divider');sep.append(make('span','','ou continuer avec'));wrap.append(sep);
  const google=button('Continuer avec Google','auth-google',async()=>{const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}});if(error)notice(error.message,true)});
  const icon=make('span','auth-google-icon','G');google.prepend(icon);wrap.append(google);
 }
 const n=make('p','auth-notice');n.id='authNotice';n.setAttribute('role','status');n.hidden=true;wrap.append(n);
 wrap.append(make('p','auth-legal','Connexion sécurisée • IG Buy Now'));area.append(wrap);
}
function refresh(){account.textContent=user?'👤 '+(user.email?.split('@')[0]||'Mon compte'):'👤 Connexion / Inscription'}
account.onclick=()=>{draw();modal.classList.add('show')};
if(client){
 try{const {data}=await client.auth.getUser();user=data.user;refresh()}catch(e){console.warn('Session indisponible',e)}
 client.auth.onAuthStateChange((event,session)=>{
  user=session?.user||null;refresh();
  if(event==='PASSWORD_RECOVERY'){
   area.replaceChildren();const wrap=make('div','auth-wrap');wrap.append(make('h2','auth-title','Nouveau mot de passe'));
   const form=make('form','auth-form'),field=input('Nouveau mot de passe','password','new-password'),submit=make('button','auth-submit','Enregistrer');submit.type='submit';form.append(field.box,submit);
   const n=make('p','auth-notice');n.id='authNotice';n.hidden=true;
   form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;const {error}=await client.auth.updateUser({password:field.i.value});notice(error?error.message:'Ton mot de passe a été mis à jour.',!!error);submit.disabled=false};
   wrap.append(form,n);area.append(wrap);modal.classList.add('show');
  }
 });
}
