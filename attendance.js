import { supabase, qs, toast } from "./supabase_client.js";
import { requireTeacher } from "./common.js";

function trRow(vals){
  const tr=document.createElement("tr");
  vals.forEach(v=>{
    const td=document.createElement("td");
    td.textContent=v??"";
    tr.appendChild(td);
  });
  return tr;
}

async function loadStudents(){
  const { data, error } = await supabase.from("students").select("id,name").order("name");
  if(error) throw error;
  const sel=qs("#studentSel");
  sel.innerHTML="";
  data.forEach(s=>{
    const o=document.createElement("option");
    o.value=s.id; o.textContent=s.name;
    sel.appendChild(o);
  });
}

async function loadRecent(){
  const { data, error } = await supabase
    .from("attendance")
    .select("date,status,note,students(name)")
    .order("date",{ascending:false})
    .limit(30);
  if(error) throw error;
  const body=qs("#tbl tbody"); body.innerHTML="";
  data.forEach(r=>{
    body.appendChild(trRow([r.date, r.students?.name||"", r.status, r.note||""]));
  });
}

qs("#saveBtn").addEventListener("click", async ()=>{
  try{
    await requireTeacher();
    const student_id = qs("#studentSel").value;
    const date = qs("#date").value;
    const status = qs("#status").value;
    const note = qs("#note").value.trim();
    if(!student_id) return toast("학생 선택!");
    if(!date) return toast("날짜 선택!");
    const { error } = await supabase.from("attendance").insert({ student_id, date, status, note: note||null });
    if(error) throw error;
    toast("저장 완료!");
    qs("#note").value="";
    await loadRecent();
  }catch(e){ toast(e.message||String(e)); }
});

qs("#refreshBtn").addEventListener("click", async ()=>{ await loadStudents(); await loadRecent(); });

(async ()=>{
  await requireTeacher();
  await loadStudents();
  qs("#date").value = new Date().toISOString().slice(0,10);
  await loadRecent();
})().catch(e=>toast(e.message||String(e)));
