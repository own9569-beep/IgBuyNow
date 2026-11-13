import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const $=id=>document.getElementById(id);
const config=await fetch('./config/auth.json').then(r=>r.json()).catch(()=>({}));
const client=config.supabaseUrl&&config.supabaseAnonKey?createClient(config.supabaseUrl,config.supabaseAnonKey):null;
let user=null,mode='login';
const account=$('account'),modal=$('modal'),area=$('modalContent');
function el(tag,text='',type=''){const x=document.createElement(tag);if(text)x.textContent=text;if(type)x.type=type;return x}
function draw(){
 area.replaceChildren();
 area.append(el('h2',user?'Mon compte':mode==='register'?'Créer un compte':mode==='reset'?'Mot de passe oublié':'Connexion'));
 if(!client){area.append(el('p','Connexion en attente de configuration Supabase.'));return}
 if(user){area.append(el('p','Connecté : '+user.email));const out=el('button','Déconnexion');out.onclick=async()=>{await client.auth.signOut();user=null;refresh();draw()};area.append(out);return}
 const form=el('form');const email=el('input','','email');email.placeholder='Adresse e-mail';email.required=true;email.autocomplete='email';form.append(email);
 const pass=el('input','','password');if(mode!=='reset'){pass.placeholder='Mot de passe (8 caractères minimum)';pass.minLength=8;pass.required=true;pass.autocomplete=mode==='register'?'new-password':'current-password';form.append(pass)}
 const submit=el('button',mode==='register'?'Créer mon compte':mode==='reset'?'Envoyer le lien':'Se connecter');submit.className='primary';form.append(submit);
 const info=el('p');info.setAttribute('role','status');
 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;let r;try{if(mode==='register')r=await client.auth.signUp({email:email.value.trim(),password:pass.value,options:{emailRedirectTo:location.origin}});else if(mode==='reset')r=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin});else r=await client.auth.signInWithPassword({email:email.value.trim(),password:pass.value});if(r.error)throw r.error;info.textContent=mode==='register'?'Compte créé. Vérifie ton e-mail.':mode==='reset'?'Si ce compte existe, un e-mail a été envoyé.':'Connexion réussie.';if(mode==='login'){user=r.data.user;refresh();draw()}}catch(err){info.textContent=err.message||'Erreur de connexion'}finally{submit.disabled=false}};
 area.append(form,info);
 const switcher=el('button',mode==='login'?'Créer un compte':'Retour à la connexion');switcher.onclick=()=>{mode=mode==='login'?'register':'login';draw()};area.append(switcher);
 if(mode==='login'){const forgot=el('button','Mot de passe oublié ?');forgot.onclick=()=>{mode='reset';draw()};area.append(forgot)}
 const google=el('button','Continuer avec Google');google.style.display='block';google.style.marginTop='15px';google.onclick=async()=>{const r=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}});if(r.error)info.textContent=r.error.message};area.append(google);
}
function refresh(){account.textContent=user?'👤 '+user.email.split('@')[0]:'👤 Connexion / Inscription'}
account.onclick=()=>{draw();modal.classList.add('show')};
if(client){const r=await client.auth.getUser();user=r.data.user;refresh();client.auth.onAuthStateChange(async(event,session)=>{user=session?.user||null;refresh();if(event==='PASSWORD_RECOVERY'){area.replaceChildren();area.append(el('h2','Définir un nouveau mot de passe'));const form=el('form'),pass=el('input','','password'),btn=el('button','Enregistrer'),info=el('p');pass.placeholder='Nouveau mot de passe';pass.minLength=8;pass.required=true;form.append(pass,btn);form.onsubmit=async e=>{e.preventDefault();const r=await client.auth.updateUser({password:pass.value});info.textContent=r.error?r.error.message:'Mot de passe mis à jour.'};area.append(form,info);modal.classList.add('show')}})}
