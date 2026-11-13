import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cfg=await fetch('./config/auth.json',{cache:'no-store'}).then(r=>r.json());
const db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const css=document.createElement('style');css.textContent=`
#supportLaunch{position:fixed;right:18px;bottom:20px;z-index:900;background:linear-gradient(130deg,#0b3a81,#1571d2);color:white;border:2px solid #ffffff70;border-radius:50px;padding:15px 20px;box-shadow:0 12px 30px #092d6680;font-weight:800}
#supportPanel{position:fixed;right:18px;bottom:85px;z-index:901;width:min(395px,calc(100vw - 24px));height:min(620px,calc(100dvh - 110px));background:#f7faff;color:#16365e;border:1px solid #9cbde8;border-radius:20px;box-shadow:0 18px 60px #06245c55;display:flex;flex-direction:column;overflow:hidden}
#supportPanel[hidden]{display:none}#supportHead{background:linear-gradient(115deg,#082d67,#1668c1);padding:18px;color:white;display:flex;justify-content:space-between;align-items:center}
#supportHead strong{font-size:17px}#supportHead small{display:block;color:#dceaff;font-size:11px}#supportClose{background:#ffffff22;color:white;border:1px solid #ffffff50;padding:6px 10px}
#supportMessages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.supportBubble{padding:11px 13px;border-radius:15px;max-width:90%;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;background:#e1edff;align-self:flex-start}
.supportBubble.me{background:#145ab1;color:white;align-self:flex-end}
#supportQuick{display:flex;gap:6px;overflow:auto;padding:8px 12px}#supportQuick button{font-size:11px;white-space:nowrap;border:1px solid #b2ccef;background:white;color:#114a93;padding:8px;border-radius:20px}
#supportForm{display:flex;padding:12px;gap:7px;border-top:1px solid #cbdcf2;background:white}#supportInput{flex:1;min-width:0;border:1px solid #b5c9e7;border-radius:11px;padding:12px;font:inherit}
#supportSend{background:#145ab1;color:white;border:0;border-radius:10px;padding:10px}
#supportHuman{margin:0 12px 10px;background:#e4efff;color:#0c478c;border:1px solid #bdd6f7;border-radius:10px;padding:10px;font-weight:750}
#supportTicket{padding:12px;background:white;border-top:1px solid #cadcf1}#supportTicket[hidden]{display:none}#supportTicket input,#supportTicket textarea{width:100%;padding:9px;border:1px solid #bbcee7;border-radius:8px;margin-bottom:7px;font:inherit}#supportInput,#supportTicket input,#supportTicket textarea{font-size:16px}#supportTicket button{background:#145ab1;color:white;border:0;border-radius:8px;padding:10px}
@media(max-width:500px){#supportPanel{right:8px;bottom:76px;width:calc(100vw - 16px);height:min(650px,calc(100dvh - 90px));border-radius:16px}#supportLaunch{right:12px;bottom:12px;padding:13px 16px}#supportHead{padding:14px}#supportMessages{padding:12px}#supportForm{padding:9px}#supportQuick{padding:7px 9px}#supportHuman{margin:0 9px 8px}}
@media(max-height:540px){#supportPanel{bottom:8px;height:calc(100dvh - 16px)}#supportLaunch{bottom:8px}}

/* Violet neon support theme */
#supportLaunch{background:linear-gradient(125deg,#8d37e2,#532099);border-color:#bd75f5;box-shadow:0 12px 35px #3f12638c}
#supportPanel{background:#171124;color:#f7eaff;border-color:#744995;box-shadow:0 15px 70px #05010a99}
#supportHead{background:linear-gradient(110deg,#29133f,#732bb2);color:white}
#supportHead small{color:#d9b9f0}
#supportMessages{background:#18102a}
.supportBubble{background:#34204a;color:#f5eaff}
.supportBubble.me{background:linear-gradient(125deg,#8035c9,#5e2499);color:white}
#supportQuick,#supportForm,#supportTicket{background:#1b132b;border-color:#49325e}
#supportQuick button{color:#e8cdff;background:#2c1b40;border-color:#6b458e}
#supportInput,#supportTicket input,#supportTicket textarea{background:#241733;color:white;border-color:#634586}
#supportSend,#supportTicket button{background:linear-gradient(110deg,#9e47e7,#6b29b5);color:white}
#supportHuman{background:#38234d;color:#e7bdff;border-color:#754a99}
#supportClose{background:#48235e;color:white;border-color:#9369b0}
`;document.head.append(css);
const el=(tag,id,text)=>{const e=document.createElement(tag);if(id)e.id=id;if(text)e.textContent=text;return e};
const launch=el('button','supportLaunch','💬 Assistance');launch.type='button';launch.setAttribute('aria-label','Ouvrir l’assistance IG Buy Now');
const panel=el('section','supportPanel');panel.hidden=true;panel.setAttribute('aria-label','Assistance clientèle');
const head=el('div','supportHead');const brand=el('div');brand.append(el('strong','','IG Buy Now · Assistance'),el('small','','Assistant virtuel • Support humain disponible'));const close=el('button','supportClose','✕');head.append(brand,close);
const messages=el('div','supportMessages');const quick=el('div','supportQuick');const form=el('form','supportForm');const input=el('input','supportInput');input.placeholder='Posez votre question…';input.maxLength=800;input.required=true;const send=el('button','supportSend','Envoyer');send.type='submit';form.append(input,send);
const human=el('button','supportHuman','✉ Contacter le support humain');
const ticket=el('form','supportTicket');ticket.hidden=true;const subject=el('input');subject.placeholder='Sujet de votre demande';subject.required=true;subject.maxLength=120;const details=el('textarea');details.placeholder='Décrivez votre demande';details.required=true;details.minLength=5;details.maxLength=2000;details.rows=3;const ticketSend=el('button','','Envoyer ma demande');ticketSend.type='submit';const ticketStatus=el('div');ticket.append(subject,details,ticketSend,ticketStatus);
panel.append(head,messages,quick,form,human,ticket);document.body.append(launch,panel);
function bubble(text,me=false){const b=el('div');b.className='supportBubble'+(me?' me':'');b.textContent=text;messages.append(b);messages.scrollTop=messages.scrollHeight;return b}
bubble('Bonjour 👋 Je suis l’assistant virtuel IG Buy Now. Je peux répondre aux questions sur les annonces et le fonctionnement du site. Pour une demande particulière, contactez le support humain.');
launch.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)input.focus()};close.onclick=()=>panel.hidden=true;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)panel.hidden=true});
const history=[];
async function ask(message){bubble(message,true);const loading=bubble('Je cherche une réponse…');send.disabled=true;try{const r=await fetch(cfg.supabaseUrl+'/functions/v1/support-assistant',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.supabaseAnonKey},body:JSON.stringify({message,history})});if(!r.ok)throw Error('Service indisponible');const data=await r.json();loading.textContent=data.answer||'Je ne peux pas répondre pour le moment.';history.push({role:'user',content:message},{role:'assistant',content:loading.textContent});if(history.length>12)history.splice(0,history.length-12)}catch{loading.textContent='Le service est temporairement indisponible. Vous pouvez contacter le support humain.'}finally{send.disabled=false;messages.scrollTop=messages.scrollHeight}}
for(const q of ['Moyens de paiement','Site basé en France ?','Comment recevoir un compte ?']){const b=el('button','',q);b.onclick=()=>ask(q);quick.append(b)}
form.onsubmit=e=>{e.preventDefault();const v=input.value.trim();if(v){input.value='';ask(v)}};
human.onclick=()=>{ticket.hidden=!ticket.hidden;if(!ticket.hidden){subject.focus();ticket.scrollIntoView({block:'nearest'})}};
ticket.onsubmit=async e=>{e.preventDefault();ticketSend.disabled=true;ticketStatus.textContent='Envoi en cours…';const {data:{user}}=await db.auth.getUser();if(!user){ticketStatus.textContent='Pour enregistrer votre demande, connectez-vous avec votre compte. Sinon, utilisez votre messagerie.';const a=el('a','','Écrire un e-mail');a.href='mailto:Dylanallon01@gmail.com?subject='+encodeURIComponent('Support IG Buy Now : '+subject.value)+'&body='+encodeURIComponent(details.value);ticketStatus.append(' ',a);ticketSend.disabled=false;return}
const {error}=await db.from('support_tickets').insert({user_id:user.id,subject:subject.value.trim(),message:details.value.trim()});ticketStatus.textContent=error?'Envoi impossible : '+error.message:'Demande enregistrée dans le support IG Buy Now. Un e-mail automatique n’est pas encore activé.';if(!error){subject.value='';details.value=''}ticketSend.disabled=false};
