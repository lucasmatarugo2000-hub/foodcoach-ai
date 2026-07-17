-- FoodCoach AI — gênero/coach Luna + ciclo menstrual

alter table public.users_profile add column if not exists gender text check (gender in ('male', 'female', 'other'));
alter table public.users_profile add column if not exists birth_date date;

create table if not exists public.menstrual_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_start date not null,
  cycle_length integer default 28,
  period_length integer default 5,
  symptoms text[],
  notes text,
  created_at timestamptz default now()
);

alter table public.menstrual_cycles enable row level security;

create policy "users can manage own cycles" on public.menstrual_cycles for all using (auth.uid() = user_id);

create index if not exists menstrual_cycles_user_start_idx on public.menstrual_cycles (user_id, cycle_start desc);
