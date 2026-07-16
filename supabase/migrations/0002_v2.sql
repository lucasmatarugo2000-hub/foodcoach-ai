-- FoodCoach AI — v2.0: nutritionist area, recommendations, bioimpedance

-- users_profile: role -----------------------------------------------------
alter table public.users_profile
  add column if not exists role text not null default 'client' check (role in ('client', 'nutritionist'));

-- nutritionists have no diet goal — relax the original client-only constraint
alter table public.users_profile alter column goal drop not null;
alter table public.users_profile drop constraint if exists users_profile_goal_check;
alter table public.users_profile
  add constraint users_profile_goal_check
  check (goal is null or goal in ('lose_weight', 'gain_muscle', 'maintenance', 'reeducation'));

-- nutritionists --------------------------------------------------------------
create table if not exists public.nutritionists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  nome text not null,
  crn text,
  clinic_name text,
  created_at timestamptz not null default now()
);

alter table public.nutritionists enable row level security;

create policy "nutritionists can view own record"
  on public.nutritionists for select
  using (auth.uid() = user_id);

create policy "nutritionists can insert own record"
  on public.nutritionists for insert
  with check (auth.uid() = user_id);

create policy "nutritionists can update own record"
  on public.nutritionists for update
  using (auth.uid() = user_id);

-- clients linked to a nutritionist can see basic nutritionist info (name/clinic)
create policy "clients can view their linked nutritionist"
  on public.nutritionists for select
  using (
    exists (
      select 1 from public.client_nutritionist cn
      where cn.nutritionist_id = nutritionists.user_id
        and cn.client_id = auth.uid()
        and cn.status = 'active'
    )
  );

-- client_nutritionist ---------------------------------------------------------
create table if not exists public.client_nutritionist (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users (id) on delete cascade,
  nutritionist_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (client_id, nutritionist_id)
);

alter table public.client_nutritionist enable row level security;

create policy "clients can view own links"
  on public.client_nutritionist for select
  using (auth.uid() = client_id);

create policy "nutritionists can view their links"
  on public.client_nutritionist for select
  using (auth.uid() = nutritionist_id);

create policy "nutritionists can create links"
  on public.client_nutritionist for insert
  with check (auth.uid() = nutritionist_id);

create policy "nutritionists can update their links"
  on public.client_nutritionist for update
  using (auth.uid() = nutritionist_id);

create index if not exists client_nutritionist_client_idx on public.client_nutritionist (client_id);
create index if not exists client_nutritionist_nutritionist_idx on public.client_nutritionist (nutritionist_id);

-- recommendations ---------------------------------------------------------
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references auth.users (id) on delete cascade,
  type text not null check (type in ('recipe', 'substitution', 'tip', 'orientation')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.recommendations enable row level security;

create policy "clients can view recommendations addressed to them"
  on public.recommendations for select
  using (auth.uid() = client_id);

create policy "nutritionists can view own recommendations"
  on public.recommendations for select
  using (auth.uid() = nutritionist_id);

create policy "nutritionists can insert recommendations"
  on public.recommendations for insert
  with check (auth.uid() = nutritionist_id);

create policy "nutritionists can update own recommendations"
  on public.recommendations for update
  using (auth.uid() = nutritionist_id);

create policy "nutritionists can delete own recommendations"
  on public.recommendations for delete
  using (auth.uid() = nutritionist_id);

create index if not exists recommendations_client_idx on public.recommendations (client_id, created_at desc);
create index if not exists recommendations_nutritionist_idx on public.recommendations (nutritionist_id, created_at desc);

-- bioimpedance --------------------------------------------------------------
create table if not exists public.bioimpedance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight numeric,
  body_fat_pct numeric,
  muscle_mass numeric,
  bone_mass numeric,
  water_pct numeric,
  visceral_fat numeric,
  bmr integer,
  bmi numeric,
  raw_text text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.bioimpedance enable row level security;

create policy "users can view own bioimpedance"
  on public.bioimpedance for select
  using (auth.uid() = user_id);

create policy "users can insert own bioimpedance"
  on public.bioimpedance for insert
  with check (auth.uid() = user_id);

create policy "users can update own bioimpedance"
  on public.bioimpedance for update
  using (auth.uid() = user_id);

create policy "users can delete own bioimpedance"
  on public.bioimpedance for delete
  using (auth.uid() = user_id);

create policy "nutritionists can view linked clients bioimpedance"
  on public.bioimpedance for select
  using (
    exists (
      select 1 from public.client_nutritionist cn
      where cn.client_id = bioimpedance.user_id
        and cn.nutritionist_id = auth.uid()
        and cn.status = 'active'
    )
  );

-- nutritionists can launch a bioimpedance report on behalf of a linked client
create policy "nutritionists can insert bioimpedance for linked clients"
  on public.bioimpedance for insert
  with check (
    exists (
      select 1 from public.client_nutritionist cn
      where cn.client_id = bioimpedance.user_id
        and cn.nutritionist_id = auth.uid()
        and cn.status = 'active'
    )
  );

create index if not exists bioimpedance_user_idx on public.bioimpedance (user_id, date desc);

-- storage: bioimpedance report photos ---------------------------------------
insert into storage.buckets (id, name, public)
values ('bioimpedance-photos', 'bioimpedance-photos', true)
on conflict (id) do nothing;

create policy "users can upload own bioimpedance photos"
  on storage.objects for insert
  with check (bucket_id = 'bioimpedance-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "anyone can view bioimpedance photos"
  on storage.objects for select
  using (bucket_id = 'bioimpedance-photos');

-- coach_messages: allow 'system' notifications (e.g. nutritionist linked) ----
alter table public.coach_messages drop constraint if exists coach_messages_type_check;
alter table public.coach_messages
  add constraint coach_messages_type_check
  check (type in ('comment', 'question', 'pattern_insight', 'substitution', 'system'));

-- cross-role RLS: nutritionist read/write access to linked clients' data ----
-- Required so /nutri/cliente/[id] can render a client's meals, active diet and
-- profile, and so a nutritionist can update a linked client's diet plan.

create policy "nutritionists can view linked clients meals"
  on public.meals for select
  using (
    exists (
      select 1 from public.client_nutritionist cn
      where cn.client_id = meals.user_id
        and cn.nutritionist_id = auth.uid()
        and cn.status = 'active'
    )
  );

create policy "nutritionists can view linked clients diet plans"
  on public.diet_plans for select
  using (
    exists (
      select 1 from public.client_nutritionist cn
      where cn.client_id = diet_plans.user_id
        and cn.nutritionist_id = auth.uid()
        and cn.status = 'active'
    )
  );

create policy "nutritionists can update linked clients diet plans"
  on public.diet_plans for update
  using (
    exists (
      select 1 from public.client_nutritionist cn
      where cn.client_id = diet_plans.user_id
        and cn.nutritionist_id = auth.uid()
        and cn.status = 'active'
    )
  );

create policy "nutritionists can insert diet plans for linked clients"
  on public.diet_plans for insert
  with check (
    exists (
      select 1 from public.client_nutritionist cn
      where cn.client_id = diet_plans.user_id
        and cn.nutritionist_id = auth.uid()
        and cn.status = 'active'
    )
  );

create policy "nutritionists can view linked clients profile"
  on public.users_profile for select
  using (
    exists (
      select 1 from public.client_nutritionist cn
      where cn.client_id = users_profile.id
        and cn.nutritionist_id = auth.uid()
        and cn.status = 'active'
    )
  );

create policy "nutritionists can insert system messages for linked clients"
  on public.coach_messages for insert
  with check (
    type = 'system'
    and exists (
      select 1 from public.client_nutritionist cn
      where cn.client_id = coach_messages.user_id
        and cn.nutritionist_id = auth.uid()
        and cn.status = 'active'
    )
  );

-- RPC helpers ----------------------------------------------------------------
-- The app only ships the anon key (no service role key), so looking up
-- auth.users by email — needed by the "add client" flow — has to go through a
-- SECURITY DEFINER function instead of the admin API.

create or replace function public.find_user_id_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where email = lookup_email limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to authenticated;

-- Returns the email of every client linked to the calling nutritionist. Scoped
-- to auth.uid() internally, so it cannot be used to read arbitrary emails.
create or replace function public.get_linked_clients_emails()
returns table (client_id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select u.id, u.email
  from auth.users u
  join public.client_nutritionist cn on cn.client_id = u.id
  where cn.nutritionist_id = auth.uid()
    and cn.status = 'active';
$$;

revoke all on function public.get_linked_clients_emails() from public;
grant execute on function public.get_linked_clients_emails() to authenticated;
