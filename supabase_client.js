// Supabase client wrapper (static site friendly)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const qs = (sel) => document.querySelector(sel);

export function toast(msg){
  // tiny toast (no libs)
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.position="fixed";
  el.style.left="50%";
  el.style.top="18px";
  el.style.transform="translateX(-50%)";
  el.style.padding="10px 12px";
  el.style.borderRadius="12px";
  el.style.background="rgba(0,0,0,.65)";
  el.style.border="1px solid rgba(255,255,255,.18)";
  el.style.color="rgba(232,238,252,.95)";
  el.style.zIndex=9999;
  el.style.boxShadow="0 10px 30px rgba(0,0,0,.4)";
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .2s"; }, 1200);
  setTimeout(()=>el.remove(), 1500);
}

export async function signOut(){
  await supabase.auth.signOut();
  location.href = "login.html";
}
