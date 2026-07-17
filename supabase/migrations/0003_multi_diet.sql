-- FoodCoach AI — multiple diets: label + start date on diet_plans

alter table public.diet_plans add column if not exists label text;
alter table public.diet_plans add column if not exists started_at date;
