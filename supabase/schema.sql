-- ============================================================
-- School Pickup App — Supabase Schema
-- Run this in the Supabase SQL Editor (project → SQL Editor)
-- ============================================================

-- 1. Profiles (extends auth.users with role info)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('parent', 'teacher', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'parent')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  grade text,
  class_name text,
  created_at timestamptz default now()
);

-- 3. Parent → Student links (many-to-many)
create table public.parent_students (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  primary key (parent_id, student_id)
);

-- 4. Pickup queue
create table public.pickup_queue (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  arrived_at timestamptz default now(),
  status text not null default 'waiting' check (status in ('waiting', 'picked_up')),
  location_verified boolean default false
);

create index pickup_queue_status_idx on public.pickup_queue(status);
create index pickup_queue_arrived_idx on public.pickup_queue(arrived_at);

-- 5. School settings (single row)
create table public.school_settings (
  id int primary key default 1,
  name text not null default 'My School',
  lat double precision not null default 0,
  lng double precision not null default 0,
  radius_meters int not null default 150,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Insert default row
insert into public.school_settings (id, name, lat, lng, radius_meters)
values (1, 'My School', 0, 0, 150)
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parent_students enable row level security;
alter table public.pickup_queue enable row level security;
alter table public.school_settings enable row level security;

-- Helper: get current user's role
create or replace function public.current_user_role()
returns text language sql security definer
as $$ select role from public.profiles where id = auth.uid() $$;

-- profiles: users can read their own; admins can read all
create policy "Users read own profile"
  on public.profiles for select
  using (id = auth.uid() or current_user_role() in ('admin', 'teacher'));

create policy "Admins manage profiles"
  on public.profiles for all
  using (current_user_role() = 'admin');

-- students: parents can read their linked students; teachers/admins can read all
create policy "Parents read linked students"
  on public.students for select
  using (
    current_user_role() in ('teacher', 'admin')
    or exists (
      select 1 from public.parent_students
      where student_id = students.id and parent_id = auth.uid()
    )
  );

create policy "Admins manage students"
  on public.students for all
  using (current_user_role() = 'admin');

-- parent_students: parents see own links; admins manage all
create policy "Parents read own links"
  on public.parent_students for select
  using (parent_id = auth.uid() or current_user_role() in ('admin', 'teacher'));

create policy "Admins manage links"
  on public.parent_students for all
  using (current_user_role() = 'admin');

-- pickup_queue: parents insert own entries and read own; teachers/admins read/update all
create policy "Parents insert own queue entries"
  on public.pickup_queue for insert
  with check (parent_id = auth.uid());

create policy "Parents read own queue entries"
  on public.pickup_queue for select
  using (parent_id = auth.uid() or current_user_role() in ('teacher', 'admin'));

create policy "Teachers update queue entries"
  on public.pickup_queue for update
  using (current_user_role() in ('teacher', 'admin'));

create policy "Admins delete queue entries"
  on public.pickup_queue for delete
  using (current_user_role() = 'admin');

-- school_settings: anyone authenticated can read; only admins write
create policy "Authenticated users read settings"
  on public.school_settings for select
  using (auth.uid() is not null);

create policy "Admins manage settings"
  on public.school_settings for all
  using (current_user_role() = 'admin');

-- ============================================================
-- Enable Realtime for live teacher dashboard
-- ============================================================
alter publication supabase_realtime add table public.pickup_queue;

-- ============================================================
-- Absences (run separately if schema was already applied)
-- ============================================================
create table public.absences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  note text,
  created_by uuid references public.profiles(id),
  unique (student_id, date)
);

alter table public.absences enable row level security;

create policy "Teachers and admins manage absences"
  on public.absences for all
  using (current_user_role() in ('teacher', 'admin'));

create policy "Absences are readable by teachers and admins"
  on public.absences for select
  using (current_user_role() in ('teacher', 'admin'));

alter publication supabase_realtime add table public.absences;

-- ============================================================
-- Schools (multi-school support)
-- ============================================================
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table public.schools enable row level security;

create policy "Authenticated users read schools"
  on public.schools for select
  using (auth.uid() is not null);

create policy "Admins manage schools"
  on public.schools for all
  using (current_user_role() = 'admin');

-- Add school_id to key tables (nullable for backward compat)
alter table public.students add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.pickup_queue add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.profiles add column if not exists school_id uuid references public.schools(id) on delete set null;

-- After creating your first school, run this to migrate existing students:
-- UPDATE public.students SET school_id = '<your-school-uuid>' WHERE school_id IS NULL;
-- UPDATE public.pickup_queue SET school_id = '<your-school-uuid>' WHERE school_id IS NULL;

-- ============================================================
-- School Locations (multiple pickup zones)
-- Run this migration after initial schema if needed.
-- ============================================================
create table if not exists public.school_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null default 0,
  lng double precision not null default 0,
  radius_meters int not null default 150,
  created_at timestamptz default now()
);

alter table public.school_locations enable row level security;

create policy "Authenticated users read locations"
  on public.school_locations for select
  using (auth.uid() is not null);

create policy "Admins manage locations"
  on public.school_locations for all
  using (current_user_role() = 'admin');

alter table public.school_locations add column if not exists school_id uuid references public.schools(id) on delete cascade;

-- Migrate existing school_settings row into school_locations (run once)
-- insert into public.school_locations (name, lat, lng, radius_meters, school_id)
-- select name, lat, lng, radius_meters, '<your-school-uuid>' from public.school_settings where lat != 0;

-- ============================================================
-- Pending student link requests
-- ============================================================
create table if not exists public.pending_student_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_first_name text not null,
  child_last_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

alter table public.pending_student_requests enable row level security;

create policy "Parents read own requests"
  on public.pending_student_requests for select
  using (parent_id = auth.uid() or current_user_role() = 'admin');

create policy "Parents insert own requests"
  on public.pending_student_requests for insert
  with check (parent_id = auth.uid());

create policy "Admins manage pending requests"
  on public.pending_student_requests for all
  using (current_user_role() = 'admin');

-- ============================================================
-- Auto-clear absences daily at 4pm CST (21:00 UTC Mon–Fri)
-- Requires pg_cron extension (Supabase Pro plans).
-- Enable extension first: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- ============================================================
-- select cron.schedule(
--   'clear-daily-absences',
--   '0 21 * * 1-5',
--   $$delete from public.absences where date = current_date$$
-- );
