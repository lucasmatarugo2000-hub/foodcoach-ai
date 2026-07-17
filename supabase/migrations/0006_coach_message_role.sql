-- FoodCoach AI — role em coach_messages (histórico persistente do chat)

alter table public.coach_messages add column if not exists role text default 'assistant' check (role in ('user', 'assistant'));
