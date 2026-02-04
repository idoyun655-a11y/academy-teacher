import { supabase, qs, toast } from "./supabase_client.js";
import { requireTeacher } from "./common.js";

const SELECT_KEY = "academy_selected_student_id";

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

// ✅ 학생 페이지에서 선택한 학생이 있으면 자동 고정
const selectedId = localStorage.getItem(SELECT_KEY);
if(selectedId){
  const opt = Array.from(sel.options).find(o=>o.value===selectedId);
  if(opt){
    sel.value = selectedId;
    sel.disabled = true;
  }else{
    // 선택된 학생이 목록에 없으면 선택 해제
    localStorage.removeItem(SELECT_KEY);
    sel.disabled = false;
  }
}else{
  sel.disabled = false;
}
}

async function loadRecent(){
  const { data, error } = await supabase
    .from("english_mock_grades")
    .select("year,month,score,grade,note,students(name)")
    .order("created_at",{ascending:false})
    .limit(30);
  if(error) throw error;
  const body=qs("#tbl tbody"); body.innerHTML="";
  data.forEach(r=>{
    body.appendChild(trRow(
      [`${r.year}-${String(r.month).padStart(2,'0')}`, r.students?.name||"", String(r.score), String(r.grade), r.note||""]
    ));
  });
}

qs("#saveBtn").addEventListener("click", async ()=>{
  try{
    await requireTeacher();
    const student_id=qs("#studentSel").value;
    const year=parseInt(qs("#year").value,10);
    const month=parseInt(qs("#month").value,10);
    const score=parseInt(qs("#score").value,10);
    const grade=parseInt(qs("#grade").value,10);
    const note=qs("#note").value.trim();

    if(!student_id) return toast("학생 선택!");
    if(Number.isNaN(year)) return toast("연도 입력!");
    if(Number.isNaN(score)) return toast("점수 입력!");
    if(score<0||score>100) return toast("점수는 0~100");

    const { error } = await supabase.from("english_mock_grades").insert({
      student_id, year, month, score, grade, note: note||null
    });
    if(error) throw error;
    toast("저장 완료!");
    qs("#score").value=""; qs("#note").value="";
    await loadRecent();
  }catch(e){ toast(e.message||String(e)); }
});

qs("#refreshBtn").addEventListener("click", async ()=>{ await loadStudents(); await loadRecent(); });

(async ()=>{
  await requireTeacher();

  // 상단에 "학생 변경" 버튼 추가
  try{
    const header = document.querySelector(".pageTop") || document.querySelector("header") || document.body;
    const btn = document.createElement("button");
    btn.className="btn ghost";
    btn.id="changeStudentBtn";
    btn.textContent="학생 변경";
    btn.style.marginLeft="8px";
    btn.addEventListener("click", ()=>{
      localStorage.removeItem(SELECT_KEY);
      location.href="students.html";
    });
    // 헤더 안에 버튼 넣기 (가능하면 오른쪽)
    const target = document.querySelector(".topActions") || header;
    target.appendChild(btn);
  }catch{}

  await loadStudents();
  qs("#year").value = new Date().getFullYear();
  await loadRecent();
})().catch(e=>toast(e.message||String(e)));
