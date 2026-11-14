import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const SITE = "https://effulgent-crepe-f4fe0b.netlify.app";
const ALLOWED_ORIGINS = new Set(["https://ig-buy-now.vercel.app", SITE, "https://ig-buy-now-dylanallon01-2211s-projects.vercel.app", "https://ig-buy-da48cub2z-dylanallon01-2211s-projects.vercel.app"]);
const CORS_HEADERS = {
 "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store",
 "Vary": "Origin"
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 const origin = req.headers.get("origin");
 const CORS = new Headers(CORS_HEADERS);
 if (!origin || ALLOWED_ORIGINS.has(origin)) CORS.set("Access-Control-Allow-Origin", origin ?? SITE);
 function result(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:CORS})}
 if(req.method==="OPTIONS")return new Response(null,{headers:CORS});
 if(req.method!=="POST")return result({error:"Méthode non autorisée"},405);
 if(origin && !ALLOWED_ORIGINS.has(origin))return result({error:"Origine non autorisée"},403);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer "))return result({error:"Connexion obligatoire"},401);
 const url=Deno.env.get("SUPABASE_URL");
 const anon=Deno.env.get("SUPABASE_ANON_KEY");
 const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!serviceRole){console.error("moderate_users_missing_server_configuration");return result({error:"Configuration serveur indisponible"},503)}
 const publicClient=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
 const adminClient=createClient(url,serviceRole,{auth:{autoRefreshToken:false,persistSession:false}});
 try{
  const {data:authData,error:authError}=await publicClient.auth.getUser(auth.slice(7));
  if(authError||!authData.user)return result({error:"Session expirée. Reconnectez-vous."},401);
  const actor=authData.user;
  const {data:member,error:memberError}=await adminClient.from("admin_members").select("user_id").eq("user_id",actor.id).maybeSingle();
  if(memberError||!member)return result({error:"Accès réservé aux administrateurs"},403);
  let body:any;try{body=await req.json()}catch{return result({error:"Requête invalide"},400)}
  const action=String(body?.action||"");
  if(action==="list"){
   const page=Math.max(1,Math.min(1000,Math.floor(Number(body?.page)||1)));
   const {data,error}=await adminClient.auth.admin.listUsers({page,perPage:100});
   if(error)return result({error:"Impossible de charger les comptes"},500);
   const users=data.users||[];
   const ids=users.map((u:any)=>u.id);
   let controls:any[]=[],members:any[]=[];
   if(ids.length){
    const [a,b]=await Promise.all([
     adminClient.from("account_controls").select("user_id,purchase_blocked,banned,reason,updated_at").in("user_id",ids),
     adminClient.from("admin_members").select("user_id").in("user_id",ids)
    ]);
    if(a.error||b.error)return result({error:"Impossible de lire les restrictions des comptes"},500);
    controls=a.data||[];members=b.data||[];
   }
   const byId=new Map(controls.map((x:any)=>[x.user_id,x]));
   const adminIds=new Set(members.map((x:any)=>x.user_id));
   return result({
    users:users.map((u:any)=>{
     const control=byId.get(u.id)||{};
     return {id:u.id,email:u.email||"",created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,
      purchase_blocked:!!control.purchase_blocked,banned:!!control.banned,
      reason:control.reason||"",is_admin:adminIds.has(u.id),is_self:u.id===actor.id};
    }),
    page,has_more:users.length===100
   });
  }
  if(!["block_purchase","unblock_purchase","ban","unban","delete"].includes(action))return result({error:"Action inconnue"},400);
  const targetId=String(body?.user_id||"");
  if(!uuid.test(targetId))return result({error:"Identifiant invalide"},400);
  if(targetId===actor.id)return result({error:"Vous ne pouvez pas modifier votre propre compte administrateur"},403);
  const {data:protectedAdmin,error:protectError}=await adminClient.from("admin_members").select("user_id").eq("user_id",targetId).maybeSingle();
  if(protectError)return result({error:"Vérification des droits impossible"},500);
  if(protectedAdmin)return result({error:"Impossible de modifier un compte administrateur"},403);
  const {data:targetData,error:targetError}=await adminClient.auth.admin.getUserById(targetId);
  const target=targetData?.user;
  if(targetError||!target)return result({error:"Utilisateur introuvable"},404);
  const targetEmail=String(target.email||"").toLowerCase();
  const note=String(body?.reason||"").trim().slice(0,300);
  if(action==="delete"){
   if(!targetEmail||String(body?.confirm||"").trim().toLowerCase()!==targetEmail)return result({error:"La confirmation par adresse e-mail est obligatoire"},400);
   const {error}=await adminClient.auth.admin.deleteUser(targetId);
   if(error){console.error("moderation_delete_failed",error.message);return result({error:"Suppression impossible. Vérifiez les dépendances du compte."},500)}
   const log=await adminClient.from("account_action_log").insert({actor_id:actor.id,target_id:targetId,target_email:targetEmail,action:"delete",note});
   if(log.error)console.error("moderation_audit_failure",log.error.message);
   return result({ok:true,message:"Compte supprimé définitivement. Les données liées peuvent également avoir été effacées."});
  }
  const {data:current,error:readError}=await adminClient.from("account_controls").select("purchase_blocked,banned,reason").eq("user_id",targetId).maybeSingle();
  if(readError)return result({error:"Impossible de vérifier la restriction actuelle"},500);
  const purchaseBlocked=action==="block_purchase"?true:action==="unblock_purchase"?false:!!current?.purchase_blocked;
  const banned=action==="ban"?true:action==="unban"?false:!!current?.banned;
  if(action==="ban"||action==="unban"){
   const banDuration=action==="ban"?"876000h":"none";
   const update=await adminClient.auth.admin.updateUserById(targetId,{ban_duration:banDuration});
   if(update.error){console.error("moderation_auth_update_failed",update.error.message);return result({error:"Impossible de modifier le statut de bannissement"},500)}
  }
  const upsert=await adminClient.from("account_controls").upsert({
   user_id:targetId,purchase_blocked:purchaseBlocked,banned,
   reason:note || current?.reason || "",
   updated_by:actor.id,updated_at:new Date().toISOString()
  },{onConflict:"user_id"});
  if(upsert.error){
   console.error("moderation_control_upsert_failed",upsert.error.message);
   if(action==="ban"||action==="unban"){
    const rollback=action==="ban"?"none":"876000h";
    await adminClient.auth.admin.updateUserById(targetId,{ban_duration:rollback});
   }
   return result({error:"La restriction n'a pas pu être sauvegardée"},500);
  }
  const audit=await adminClient.from("account_action_log").insert({actor_id:actor.id,target_id:targetId,target_email:targetEmail,action,note});
  if(audit.error)console.error("moderation_audit_failure",audit.error.message);
  return result({ok:true,message:action==="block_purchase"?"Achats bloqués pour ce compte.":action==="unblock_purchase"?"Achats de nouveau autorisés.":action==="ban"?"Compte banni, nouvelle connexion désactivée.":"Compte débanni."});
 }catch(e){
  console.error("moderation_unexpected_error",String(e).slice(0,180));
  return result({error:"Une erreur serveur est survenue"},500);
 }
});
