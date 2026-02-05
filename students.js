import { supabase, qs, toast } from "./supabase_client.js";
import { requireTeacher } from "./common.js";

const SELECT_KEY = "academy_selected_student_id";

function populateGrades(){
  const school = qs("#stSchool")?.value || "고";
  const gradeSel = qs("#stGrade");
  if(!gradeSel) return;
  const max = (school==="초") ? 6 : 3;
  gradeSel.innerHTML="";
  for(let i=1;i<=max;i++){
    const o=document.createElement("option");
    o.value=String(i);
    o.textContent=`${i}학년`;
    gradeSel.appendChild(o);
  }
}


function tr(cells){
  const tr=document.createElement("tr");
  cells.forEach(x=>{
    const td=document.createElement("td");
    if(x instanceof Node) td.appendChild(x);
    else td.textContent = x ?? "";
    tr.appendChild(td);
  });
  return tr;
}

async function load(){
  await requireTeacher();
  populateGrades();
  const { data, error } = await supabase.from("students").select("id,name,school_level,grade_level,birth_year,class_name").order("created_at",{ascending:false});
  if(error) throw error;

  const body = qs("#stTable tbody");
  body.innerHTML="";
  data.forEach(s=>{
    const makeCodeBtn = (label, role)=>{
      const b = document.createElement("button");
      b.className = role === "parent" ? "btn ghost" : "btn";
      b.textContent = label;
      b.style.padding = "8px 10px";
      b.addEventListener("click", async ()=>{
        try{
          const { data: code, error } = await supabase.rpc("create_access_code", {
            p_student_id: s.id,
            p_target_role: role,
          });
          if(error) throw error;
          toast(`${label} 발급 완료!`);
          await load();
          prompt(`${label} (복사해서 전달):`, code);
        }catch(e){ toast(e.message || String(e)); }
      });
      return b;
    };

    const del = document.createElement("button");
    del.className="btn ghost";
    del.textContent="삭제";
    del.style.padding="8px 10px";
    del.addEventListener("click", async ()=>{
      try{
        if(!confirm("정말 삭제?")) return;
        const { error } = await supabase.from("students").delete().eq("id", s.id);
        if(error) throw error;
        toast("삭제됨");
        await load();
      }catch(e){ toast(e.message || String(e)); }
    });

    const wrap = document.createElement("div");
    wrap.style.display="flex"; wrap.style.gap="8px";
    const pick = document.createElement("button");
    pick.className="btn ghost";
    pick.textContent="선택";
    pick.style.padding="8px 10px";
    pick.addEventListener("click", ()=>{
      localStorage.setItem(SELECT_KEY, s.id);
      toast(`선택됨: ${s.name}`);
    });

    wrap.appendChild(pick);
    wrap.appendChild(makeCodeBtn("학생 코드", "student"));
    wrap.appendChild(makeCodeBtn("부모 코드", "parent"));
    wrap.appendChild(del);

    const row = tr([s.name, `${s.school_level||"고"} ${s.grade_level}${s.class_name?` (${s.class_name})`:""}`, s.birth_year?String(s.birth_year):"", "", wrap]);
    const selectedId = localStorage.getItem(SELECT_KEY);
    if(selectedId && selectedId === s.id) row.classList.add("selected-row");
    row.style.cursor="pointer";
    row.addEventListener("click", (ev)=>{
      // 버튼 클릭은 버튼이 처리
      if(ev.target && ev.target.tagName === "BUTTON") return;
      localStorage.setItem(SELECT_KEY, s.id);
      toast(`선택됨: ${s.name}`);
      load();
    });

    body.appendChild(row);
  });
}

qs("#addStudentBtn").addEventListener("click", async ()=>{
  try{
    await requireTeacher();
  populateGrades();
    const name = qs("#stName").value.trim();
    const school_level = qs("#stSchool")?.value || "고";
    const grade_level = parseInt(qs("#stGrade").value,10);
    const birth = qs("#stBirth").value.trim();
    if(!name) return toast("이름 입력!");
    const payload = { name, school_level, grade_level };
    const class_name = (qs("#stClass")?.value || "").trim();
    const note = (qs("#stNote")?.value || "").trim();
    if(class_name) payload.class_name = class_name;
    if(note) payload.note = note;
    if(birth) payload.birth_year = parseInt(birth,10);
    const { error } = await supabase.from("students").insert(payload);
    if(error) throw error;
    toast("학생 추가!");
    qs("#stName").value=""; qs("#stBirth").value=""; if(qs("#stClass")) qs("#stClass").value=""; qs("#stNote").value="";
    await load();
  }catch(e){ toast(e.message || String(e)); }
});
qs("#refreshBtn").addEventListener("click", ()=>load());

load().catch(e=>toast(e.message||String(e)));


// 선택된 학생 안내/바로가기 카드
async function renderSelectedCard(){
  try{
    const selectedId = localStorage.getItem(SELECT_KEY);
    const card = qs("#selectedActions");
    if(!card) return;
    if(!selectedId){ card.style.display="none"; return; }
    const { data, error } = await supabase.from("students").select("id,name").eq("id", selectedId).maybeSingle();
    if(error) throw error;
    if(!data){ localStorage.removeItem(SELECT_KEY); card.style.display="none"; return; }
    qs("#selStudentName").textContent = data.name;
    card.style.display="block";
    qs("#clearStudentBtn2").addEventListener("click", ()=>{
      localStorage.removeItem(SELECT_KEY);
      location.reload();
    });
  }catch(e){ /* ignore */ }
}
renderSelectedCard();
