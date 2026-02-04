import { supabase, qs, toast, signOut } from "./supabase_client.js";
qs("#logoutBtn")?.addEventListener("click", signOut);

export async function requireTeacher(){
  const { data: { session } } = await supabase.auth.getSession();
  if(!session){
    location.href = "login.html";
    throw new Error("no session");
  }
  // ensure profile exists
  const { data: prof, error } = await supabase.from("profiles").select("role,name").eq("user_id", session.user.id).maybeSingle();
  if(error) throw error;
  if(!prof || prof.role !== "teacher"){
    toast("teacher 권한 필요");
    location.href = "login.html";
    throw new Error("not teacher");
  }
  qs("#miniName").textContent = prof.name || "선생님";
  return session;
}
