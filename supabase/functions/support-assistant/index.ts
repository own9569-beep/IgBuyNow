import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SITE = "https://effulgent-crepe-f4fe0b.netlify.app";
const ALLOWED_ORIGINS = new Set(["https://ig-buy-now.vercel.app", SITE, "https://ig-buy-now-dylanallon01-2211s-projects.vercel.app", "https://ig-buy-da48cub2z-dylanallon01-2211s-projects.vercel.app"]);
const CORS_HEADERS = {
 "Access-Control-Allow-Methods": "POST, OPTIONS",
 "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 "Content-Type": "application/json; charset=utf-8",
 "Cache-Control": "no-store",
 "Vary": "Origin"
};
const SYSTEM = "La roue hebdomadaire est active : un tour gratuit par compte chaque semaine, réinitialisation lundi 00h Europe/Paris. Les gains sont des Bits gratuits sans valeur monétaire, non achetables et non convertibles ; leurs probabilités actuelles sont affichées sur /roue.html. Les lots sont provisoires. Les réponses humaines sont visibles dans Mon compte > Mes demandes et dans les notifications du site. Le catalogue est librement consultable sans connexion. Tu es l'assistant IA de la boutique francophone IG Buy Now, spécialisée en annonces de comptes gaming. Réponds uniquement en français, avec précision, naturel, politesse, et sans être trop long. Prends en compte le contexte de conversation. Tu n'es pas un humain. Données vérifiées : paiement et validation de commandes ne sont pas encore activés ; aucun moyen de paiement n'est actuellement disponible ; la boutique est francophone mais aucune adresse française ni immatriculation n'a été confirmée ; politiques de remboursement, livraison et garantie non publiées ; les annonces sont visibles sur le site ; support humain accessible via 'Contacter le support humain'. Ne crée jamais de fausses promesses, tarifs, disponibilités, politiques ou garanties. Pour un compte de jeu, conseille objectivement sur les niveaux, les améliorations et les questions à poser ; ne garantis pas la sécurité d'un transfert de compte. Si une question demande une confirmation propre à une annonce ou à une commande, oriente vers le support humain.";
const PREFERRED = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];
const delay = (ms:number) => new Promise(r=>setTimeout(r,ms));
const safeFaq = (q:string) => {
 const s=q.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/\b(bonjour|bonsoir|salut|hello)\b/.test(s)) return "Bonjour 👋 Bienvenue chez IG Buy Now ! Je peux vous expliquer comment choisir un compte gaming, consulter les annonces ou contacter notre support humain. Que souhaitez-vous savoir ?";
 if(/roue|bits|hebdomadaire/.test(s)) return "La roue est disponible dans « Roue hebdo ». Connectez-vous pour un tour gratuit par semaine, renouvelé le lundi à 00 h (heure de Paris). Les Bits sont des points gratuits sans valeur monétaire et sans conversion actuellement disponible. Les lots et les chances exactes sont affichés sur la page de la roue. Retrouvez vos gains dans son historique.";
 if(/paiement|payer|paypal|carte bancaire|stripe/.test(s)) return "Le paiement sécurisé est encore en préparation sur IG Buy Now. Aucun paiement ne peut être effectué sur le site pour le moment. Les moyens acceptés seront annoncés une fois cette fonctionnalité activée.";
 if(/france|francais|entreprise|siege social/.test(s)) return "IG Buy Now est une boutique francophone. Son adresse juridique et son immatriculation ne sont pas encore confirmées sur le site.";
 if(/clash|hdv|choisir un compte|critere/.test(s)) return "Pour choisir un compte Clash of Clans HDV18, vérifiez surtout : 1) les niveaux des héros, 2) les défenses, 3) les troupes et sorts, 4) les équipements et familiers, 5) la progression réelle par rapport au prix affiché. Demandez aussi les modalités de remise au support avant toute décision.";
 if(/livraison|transfert|recevoir|identifiants/.test(s)) return "Les modalités de remise dépendent de l'annonce et doivent être confirmées par le support humain. Aucun transfert automatique n'est actuellement activé.";
 if(/rembours|garantie|litige/.test(s)) return "Les conditions de remboursement et de garantie ne sont pas encore publiées. Contactez le support humain pour obtenir une confirmation avant toute transaction.";
 if(/contact|humain|support|aide/.test(s)) return "Vous pouvez utiliser le bouton « Contacter le support humain » dans cette fenêtre. Les demandes des clients connectés sont enregistrées dans l'administration.";
 return "Je peux vous aider à comprendre les annonces et le fonctionnement d'IG Buy Now. Pour une demande précise, utilisez « Contacter le support humain » : une personne pourra examiner votre question.";
};
async function getModels(key:string):Promise<string[]>{
 const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),3500);
 try{
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",{headers:{"x-goog-api-key":key},signal:controller.signal});
  if(!r.ok){console.error("gemini_models_error",r.status);return [];}
  const d=await r.json();
  const names=(d.models||[]).filter((m:any)=>m.supportedGenerationMethods?.includes("generateContent")).map((m:any)=>String(m.name||""));
  return PREFERRED.map(name=>"models/"+name).filter(name=>names.includes(name));
 }catch(e){console.error("gemini_models_exception",String(e).slice(0,100));return [];}
 finally{clearTimeout(timer);}
}
async function generate(key:string,model:string,contents:any[]):Promise<{text?:string,status:number}>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
 try{
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/"+model+":generateContent",{
   method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},signal:controller.signal,
   body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents,generationConfig:{temperature:0.35,maxOutputTokens:700}})
  });
  if(!r.ok){const err=(await r.text()).slice(0,200);console.error("gemini_model_error",model,r.status,err);return {status:r.status};}
  const d=await r.json();
  const text=d?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("").trim();
  return {status:200,text:text||undefined};
 }catch(e){console.error("gemini_attempt_exception",model,String(e).slice(0,100));return {status:503};}
 finally{clearTimeout(timer);}
}
Deno.serve(async(req:Request)=>{
 const origin = req.headers.get("origin");
 const CORS = new Headers(CORS_HEADERS);
 if (!origin || ALLOWED_ORIGINS.has(origin)) CORS.set("Access-Control-Allow-Origin", origin ?? SITE);
 const json = (answer: string, ai=false) => new Response(JSON.stringify({answer,ai}),{headers:CORS});
 if(req.method==="OPTIONS")return new Response(null,{headers:CORS});
 if(req.method!=="POST")return new Response("Method not allowed",{status:405,headers:CORS});
 if(origin && !ALLOWED_ORIGINS.has(origin))return new Response("Forbidden",{status:403,headers:CORS});
 let data:any;
 try{data=await req.json()}catch{return json("Message invalide.");}
 const message=typeof data?.message==="string"?data.message.trim().slice(0,800):"";
 if(!message)return json("Écrivez votre question pour commencer.");
 if(/roue|bits|hebdomadaire|stripe|paypal|paiement/i.test(message))return json(safeFaq(message));
 const key=Deno.env.get("GEMINI_API_KEY");
 if(!key){console.error("gemini_secret_missing");return json(safeFaq(message));}
 const history=(Array.isArray(data?.history)?data.history.slice(-6):[]).filter((m:any)=>["user","assistant"].includes(m?.role)&&typeof m.content==="string").map((m:any)=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content.slice(0,700)}]}));
 const contents=[...history,{role:"user",parts:[{text:message}]}];
 const models=await getModels(key);
 if(models.length===0){console.error("gemini_no_models_available");return json(safeFaq(message));}
 for(const model of models.slice(0,3)){
  const result=await generate(key,model,contents);
  if(result.text)return json(result.text.slice(0,2200),true);
  if(result.status===401||result.status===403||result.status===400)break;
  if(result.status===429||result.status===503||result.status===500||result.status===502||result.status===504)await delay(350);
 }
 return json(safeFaq(message));
});
