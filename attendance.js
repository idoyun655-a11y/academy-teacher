import { supabase, qs, toast } from "./supabase_client.js";
import { requireTeacher } from "./common.js";

const SELECT_KEY = "academy_selected_student_id";

let studentsCache = [];


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
  const { data, error } = await supabase.from("students").select("id,name,class_name").order("name");
  if(error) throw error;
  studentsCache = data || [];
  const classSel = qs("#classSel");
  if(classSel){
    const classes = Array.from(new Set((studentsCache||[]).map(s=> (s.class_name||"").trim()).filter(Boolean))).sort();
    classSel.innerHTML = `<option value="">(반 선택)</option>` + classes.map(c=>`<option value="${c}">${c}</option>`).join("");
  }
  const sel=qs("#studentSel");
  sel.innerHTML="";
  data.forEach(s=>{
    const o=document.createElement("option");
    o.value=s.id; o.textContent=s.class_name ? `${s.name} (${s.class_name})` : s.name;
    sel.appendChild(o);
  });


  // ✅ 학생 목록에서 선택한 학생이 있으면 자동 고정
  const selectedId = localStorage.getItem(SELECT_KEY);
  if(selectedId){
    const opt = Array.from(sel.options).find(o=>o.value===selectedId);
    if(opt){
      sel.value = selectedId;
      sel.disabled = true;
    }else{
      localStorage.removeItem(SELECT_KEY);
      sel.disabled = false;
    }
  }else{
    sel.disabled = false;
  }

}

// 반 선택 시 학생 목록 필터(학생 고정 상태면 무시)
qs("#classSel")?.addEventListener("change", ()=>{
  const sel = qs("#studentSel");
  if(sel.disabled) return;
  const c = qs("#classSel").value;
  sel.innerHTML="";
  (studentsCache||[]).filter(s=>!c || (s.class_name||"").trim()===c).forEach(s=>{
    const o=document.createElement("option");
    o.value=s.id;
    o.textContent=s.class_name ? `${s.name} (${s.class_name})` : s.name;
    sel.appendChild(o);
  });
});

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


qs("#bulkSaveBtn")?.addEventListener("click", async ()=>{
  try{
    await requireTeacher();
    const class_name = (qs("#classSel")?.value || "").trim();
    if(!class_name) return toast("반을 선택해줘!");
    const date = qs("#date").value;
    const status = qs("#status").value;
    const note = (qs("#note")?.value || "").trim();
    if(!date) return toast("날짜 선택!");
    const targets = (studentsCache||[]).filter(s => (s.class_name||"").trim() === class_name);
    if(!targets.length) return toast("해당 반 학생이 없어!");
    // upsert by (student_id, date)
    const rows = targets.map(s => ({ student_id: s.id, date, status, note }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    if(error) throw error;
    toast(`반 전체 저장 완료 (${targets.length}명)`);
    await loadRecent();
  }catch(e){ toast(e.message || String(e)); }
});

qs("#refreshBtn").addEventListener("click", async ()=>{ await loadStudents(); await loadRecent(); });

(async ()=>{
  await requireTeacher();
  await loadStudents();
  qs("#date").value = new Date().toISOString().slice(0,10);
  await loadRecent();
})().catch(e=>toast(e.message||String(e)));


// 학생 선택 해제(다른 학생으로 변경)
try{
  const btn = qs("#clearStudentBtn");
  if(btn){
    btn.addEventListener("click", ()=>{
      localStorage.removeItem(SELECT_KEY);
      location.reload();
    });
    // 선택이 고정된 상태에서만 버튼 표시
    const sel = qs("#studentSel");
    if(sel && !sel.disabled) btn.style.display = "none";
  }
}catch{}
