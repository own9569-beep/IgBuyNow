import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
export const cfg=await fetch('./config/auth.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Configuration indisponible');return r.json()});
export const db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
