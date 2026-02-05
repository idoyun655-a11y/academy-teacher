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
    .from("english_school_grades")
    .select("school_year,semester,exam_type,score,grade,rank,total_students,students(name)")
    .order("created_at",{ascending:false})
    .limit(30);
  if(error) throw error;
  const body=qs("#tbl tbody"); body.innerHTML="";
  data.forEach(r=>{
    body.appendChild(trRow(
      [`${r.school_year}학년 ${r.semester}학기`, r.exam_type, r.students?.name||"", String(r.score), String(r.grade), r.rank?String(r.rank):"", r.total_students?String(r.total_students):""]
    ));
  });
}

qs("#saveBtn").addEventListener("click", async ()=>{
  try{
    await requireTeacher();
    const student_id=qs("#studentSel").value;
    const exam_type=qs("#examType").value;
    const school_year=parseInt(qs("#schoolYear").value,10);
    const semester=parseInt(qs("#semester").value,10);
    const score=parseInt(qs("#score").value,10);
    const grade=parseInt(qs("#grade").value,10);

    if(!student_id) return toast("학생 선택!");
    if(Number.isNaN(score)) return toast("점수 입력!");
    if(score<0||score>100) return toast("점수는 0~100");

    const rankVal = qs("#rank").value.trim();
    const totalVal = qs("#total").value.trim();
    const avgVal = qs("#avg").value.trim();
    const note = qs("#note").value.trim();

    const payload = {
      student_id, exam_type, school_year, semester, score, grade,
      rank: rankVal?parseInt(rankVal,10):null,
      total_students: totalVal?parseInt(totalVal,10):null,
      class_avg: avgVal?parseFloat(avgVal):null,
      note: note||null
    };

    const { error } = await supabase.from("english_school_grades").insert(payload);
    if(error) throw error;
    toast("저장 완료!");
    qs("#score").value=""; qs("#rank").value=""; qs("#total").value=""; qs("#avg").value=""; qs("#note").value="";
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
