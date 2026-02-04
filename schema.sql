
-- === PATCH: normalize column names & required fields (safe to re-run) ===
do $$
begin
  -- access_codes: rename bad columns with spaces if they exist
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='access_codes' and column_name='issued by'
  ) then
    execute 'alter table public.access_codes rename column "issued by" to issued_by';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='access_codes' and column_name='target role'
  ) then
    execute 'alter table public.access_codes rename column "target role" to target_role';
  end if;

  -- ensure columns exist
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='access_codes' and column_name='issued_by'
  ) then
    execute 'alter table public.access_codes add column issued_by uuid references auth.users(id)';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='access_codes' and column_name='target_role'
  ) then
    execute 'alter table public.access_codes add column target_role text';
  end if;

  -- make target_role required with default
  begin
    execute 'alter table public.access_codes alter column target_role set default ''student''';
  exception when others then
    null;
  end;

  -- set any existing nulls to default to satisfy NOT NULL later
  execute 'update public.access_codes set target_role = coalesce(target_role, ''student'') where target_role is null';

  begin
    execute 'alter table public.access_codes alter column target_role set not null';
  exception when others then
    null;
  end;
end $$;


-- =========================================
-- Academy English MVP (Teacher + Student/Parent)
-- Grades split: School(5) vs Mock(9)
-- English only
-- =========================================

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Profiles (who is teacher/student/parent)
create table if not exists profiles (
  user_id uuid primary key,
  role text not null check (role in ('teacher','student','parent')),
  name text,
  created_at timestamp default now()
);
alter table profiles enable row level security;

-- profile: user can read own profile
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select
using (user_id = auth.uid());

-- profile: user can upsert own profile (student/parent name update)
drop policy if exists "upsert own profile" on profiles;
create policy "upsert own profile" on profiles for insert
with check (user_id = auth.uid());
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 2) Students (managed by teachers)
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_level int not null, -- 학년 1~3 등
  birth_year int,           -- 2009+
  created_at timestamp default now()
);
alter table students enable row level security;

-- teachers can manage students
drop policy if exists "teacher all students" on students;
create policy "teacher all students" on students for all
using (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'))
with check (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'));

-- 3) Link codes (teacher creates, student/parent redeems)
create table if not exists access_codes (
  code text primary key,
  student_id uuid not null references students(id) on delete cascade,
  issued_by uuid not null,
  issued_at timestamp default now(),
  target_role text not null default 'student' check (target_role in ('student','parent')),
  redeemed_at timestamp,
  is_active boolean default true
);
alter table access_codes enable row level security;

drop policy if exists "teacher all access codes" on access_codes;
create policy "teacher all access codes" on access_codes for all
using (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'))
with check (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'));

-- 4) Student links (student/parent account -> student record)
create table if not exists student_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null,
  student_id uuid not null references students(id) on delete cascade,
  link_role text not null check (link_role in ('student','parent')),
  linked_at timestamp default now(),
  unique(parent_user_id, student_id)
);
alter table student_links enable row level security;

-- linked user can read own links
drop policy if exists "read own links" on student_links;
create policy "read own links" on student_links for select
using (parent_user_id = auth.uid());

-- teachers can read links (optional)
drop policy if exists "teacher read links" on student_links;
create policy "teacher read links" on student_links for select
using (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'));

-- 5) Attendance
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  status text not null check (status in ('출석','지각','결석','조퇴')),
  note text,
  created_at timestamp default now()
);
alter table attendance enable row level security;

drop policy if exists "teacher all attendance" on attendance;
create policy "teacher all attendance" on attendance for all
using (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'))
with check (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'));

drop policy if exists "user read linked attendance" on attendance;
create policy "user read linked attendance" on attendance for select
using (exists (select 1 from student_links sl where sl.parent_user_id=auth.uid() and sl.student_id=attendance.student_id));

-- 6) Homework
create table if not exists homework (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  due_date date,
  title text not null,
  status text not null check (status in ('미제출','제출','검사중','완료')),
  created_at timestamp default now()
);
alter table homework enable row level security;

drop policy if exists "teacher all homework" on homework;
create policy "teacher all homework" on homework for all
using (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'))
with check (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'));

drop policy if exists "user read linked homework" on homework;
create policy "user read linked homework" on homework for select
using (exists (select 1 from student_links sl where sl.parent_user_id=auth.uid() and sl.student_id=homework.student_id));

-- 7) English School Grades (5등급, 2009+ 기준이지만 여기서는 5로 고정 운영)
create table if not exists english_school_grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  school_year int not null,
  semester int not null check (semester in (1,2)),
  exam_type text not null,
  score int not null check (score between 0 and 100),
  grade int not null check (grade between 1 and 5),
  rank int,
  total_students int,
  class_avg numeric,
  note text,
  created_at timestamp default now()
);
alter table english_school_grades enable row level security;

drop policy if exists "teacher all school grades" on english_school_grades;
create policy "teacher all school grades" on english_school_grades for all
using (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'))
with check (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'));

drop policy if exists "user read linked school grades" on english_school_grades;
create policy "user read linked school grades" on english_school_grades for select
using (exists (select 1 from student_links sl where sl.parent_user_id=auth.uid() and sl.student_id=english_school_grades.student_id));

-- 8) English Mock Grades (9등급)
create table if not exists english_mock_grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  year int not null,
  month int not null check (month in (3,6,9,11)),
  score int not null check (score between 0 and 100),
  grade int not null check (grade between 1 and 9),
  note text,
  created_at timestamp default now()
);
alter table english_mock_grades enable row level security;

drop policy if exists "teacher all mock grades" on english_mock_grades;
create policy "teacher all mock grades" on english_mock_grades for all
using (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'))
with check (exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher'));

drop policy if exists "user read linked mock grades" on english_mock_grades;
create policy "user read linked mock grades" on english_mock_grades for select
using (exists (select 1 from student_links sl where sl.parent_user_id=auth.uid() and sl.student_id=english_mock_grades.student_id));

-- 9) RPC: create code (teacher) + redeem code (student/parent)
create or replace function gen_access_code(len int default 8)
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
begin
  for i in 1..len loop
    out := out || substr(chars, (random()*length(chars) + 1)::int, 1);
  end loop;
  return out;
end $$;

create or replace function create_access_code(p_student_id uuid, p_target_role text default 'student')
returns text
language plpgsql
security definer
as $$
declare
  c text;
begin
  -- teacher only
  if not exists (select 1 from profiles p where p.user_id=auth.uid() and p.role='teacher') then
    raise exception 'not teacher';
  end if;

  if p_target_role not in ('student','parent') then
    raise exception 'invalid target role';
  end if;

  c := gen_access_code(8);
  insert into access_codes(code, student_id, issued_by, target_role)
  values (c, p_student_id, auth.uid(), p_target_role);
  return c;
end $$;

create or replace function redeem_access_code(p_code text, p_role text, p_name text)
returns void
language plpgsql
security definer
as $$
declare
  sid uuid;
begin
  select student_id into sid
  from access_codes
  where code = p_code and is_active = true and redeemed_at is null;

  if sid is null then
    raise exception 'invalid code';
  end if;

  -- link
  insert into student_links(parent_user_id, student_id, link_role)
  values (auth.uid(), sid, p_role)
  on conflict (parent_user_id, student_id) do update set link_role = excluded.link_role;

  -- mark redeemed (1회용)
  update access_codes set redeemed_at=now(), is_active=false where code=p_code;

  -- upsert profile
  insert into profiles(user_id, role, name)
  values (auth.uid(), p_role, p_name)
  on conflict (user_id) do update set role = excluded.role, name = excluded.name;
end $$;
