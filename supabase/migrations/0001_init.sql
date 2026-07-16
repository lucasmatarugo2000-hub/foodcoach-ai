-- FoodCoach AI — initial schema

create extension if not exists "pgcrypto";

-- users_profile ------------------------------------------------------------
create table if not exists public.users_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  goal text not null check (goal in ('lose_weight', 'gain_muscle', 'maintenance', 'reeducation')),
  current_weight numeric,
  target_weight numeric,
  daily_calories_goal integer,
  coaching_style text not null default 'gentle' check (coaching_style in ('direct', 'gentle')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.users_profile enable row level security;

create policy "users can view own profile"
  on public.users_profile for select
  using (auth.uid() = id);

create policy "users can insert own profile"
  on public.users_profile for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.users_profile for update
  using (auth.uid() = id);

-- diet_plans -----------------------------------------------------------------
create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  raw_text text,
  meals_json jsonb not null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

alter table public.diet_plans enable row level security;

create policy "users can view own diet plans"
  on public.diet_plans for select
  using (auth.uid() = user_id);

create policy "users can insert own diet plans"
  on public.diet_plans for insert
  with check (auth.uid() = user_id);

create policy "users can update own diet plans"
  on public.diet_plans for update
  using (auth.uid() = user_id);

create policy "users can delete own diet plans"
  on public.diet_plans for delete
  using (auth.uid() = user_id);

create index if not exists diet_plans_user_id_idx on public.diet_plans (user_id);
create index if not exists diet_plans_active_idx on public.diet_plans (user_id, is_active);

-- meals ------------------------------------------------------------------
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  photo_url text,
  food_name text not null,
  calories integer not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  meal_type text check (meal_type in ('cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia')),
  eaten_at timestamptz not null default now(),
  confirmed boolean not null default false,
  diet_comparison jsonb
);

alter table public.meals enable row level security;

create policy "users can view own meals"
  on public.meals for select
  using (auth.uid() = user_id);

create policy "users can insert own meals"
  on public.meals for insert
  with check (auth.uid() = user_id);

create policy "users can update own meals"
  on public.meals for update
  using (auth.uid() = user_id);

create policy "users can delete own meals"
  on public.meals for delete
  using (auth.uid() = user_id);

create index if not exists meals_user_id_idx on public.meals (user_id);
create index if not exists meals_eaten_at_idx on public.meals (user_id, eaten_at desc);

-- coach_messages -----------------------------------------------------------
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_id uuid references public.meals (id) on delete set null,
  message text not null,
  type text not null default 'comment' check (type in ('comment', 'question', 'pattern_insight', 'substitution')),
  sender text not null default 'kai' check (sender in ('kai', 'user')),
  created_at timestamptz not null default now()
);

alter table public.coach_messages enable row level security;

create policy "users can view own coach messages"
  on public.coach_messages for select
  using (auth.uid() = user_id);

create policy "users can insert own coach messages"
  on public.coach_messages for insert
  with check (auth.uid() = user_id);

create index if not exists coach_messages_user_id_idx on public.coach_messages (user_id, created_at desc);

-- storage ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', true)
on conflict (id) do nothing;

create policy "users can upload own meal photos"
  on storage.objects for insert
  with check (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "anyone can view meal photos"
  on storage.objects for select
  using (bucket_id = 'meal-photos');
