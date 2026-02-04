import { supabase, qs, toast } from "./supabase_client.js";

qs("#loginBtn").addEventListener("click", async ()=>{
  const email = qs("#email").value.trim();
  const password = qs("#password").value.trim();
  try{
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) throw error;
    toast("로그인 완료!");
    location.href = "students.html";
  }catch(e){
    toast(e.message || String(e));
  }
});

qs("#createProfileBtn").addEventListener("click", async ()=>{
  try{
    const { data: { session } } = await supabase.auth.getSession();
    if(!session) return toast("먼저 로그인!");
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      role: "teacher",
      name: "선생님"
    });
    if(error) throw error;
    toast("teacher 프로필 저장!");
  }catch(e){
    toast(e.message || String(e));
  }
});
