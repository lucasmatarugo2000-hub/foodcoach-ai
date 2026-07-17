-- FoodCoach AI — Health Hub: daily health logs

create table if not exists public.health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  -- Sono
  sleep_start time,
  sleep_end time,
  sleep_hours numeric,
  sleep_quality integer check (sleep_quality between 1 and 5),
  -- Hidratação
  water_ml integer default 0,
  -- Peso
  weight numeric,
  -- Humor e energia
  mood integer check (mood between 1 and 5),
  energy integer check (energy between 1 and 5),
  -- Sintomas
  symptoms text[],
  -- Treino
  workout_type text,
  workout_duration integer, -- minutos
  workout_calories integer,
  -- Passos
  steps integer,
  -- Notas livres
  notes text,
  -- De onde veio o registro — prepara terreno para integrações futuras
  -- (Apple Health / Google Fit) sem precisar migrar de novo depois.
  data_source text not null default 'manual' check (data_source in ('manual', 'apple_health', 'google_fit', 'chat')),
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.health_logs enable row level security;

create policy "users can manage own health logs" on public.health_logs for all using (auth.uid() = user_id);

-- Nutricionistas podem ver logs dos clientes vinculados
create policy "nutritionists can view linked clients health logs" on public.health_logs for select
  using (exists (select 1 from public.client_nutritionist cn where cn.client_id = health_logs.user_id and cn.nutritionist_id = auth.uid() and cn.status = 'active'));

create index if not exists health_logs_user_date_idx on public.health_logs (user_id, date desc);

-- Meta diária de hidratação, editável no perfil (usada pelo card de Água em /health)
alter table public.users_profile add column if not exists water_goal_ml integer not null default 2000;
