-- Shared weekly meal plans; no privileged client access, household membership is enforced by RLS.
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  meal_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  minutes integer check (minutes between 0 and 1440),
  assignee text check (assignee is null or char_length(assignee) <= 80),
  ingredients text check (ingredients is null or char_length(ingredients) <= 2000),
  image_choice text check (image_choice is null or image_choice in ('breakfast', 'lunch', 'dinner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, meal_date, meal_type)
);
create index if not exists meal_plans_household_date_idx on public.meal_plans (household_id, meal_date);
create index if not exists meal_plans_created_by_idx on public.meal_plans (created_by);
drop trigger if exists meal_plans_set_updated_at on public.meal_plans;
create trigger meal_plans_set_updated_at before update on public.meal_plans for each row execute function public.set_current_timestamp_updated_at();
alter table public.meal_plans enable row level security;
revoke all on public.meal_plans from anon;
revoke all on public.meal_plans from authenticated;
grant select, insert, delete on public.meal_plans to authenticated;
grant update (meal_date, meal_type, title, minutes, assignee, ingredients, image_choice) on public.meal_plans to authenticated;
drop policy if exists meal_plans_select on public.meal_plans;
create policy meal_plans_select on public.meal_plans for select to authenticated using (public.is_household_member(household_id));
drop policy if exists meal_plans_insert on public.meal_plans;
create policy meal_plans_insert on public.meal_plans for insert to authenticated with check (created_by = (select auth.uid()) and public.is_household_member(household_id));
drop policy if exists meal_plans_update on public.meal_plans;
create policy meal_plans_update on public.meal_plans for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists meal_plans_delete on public.meal_plans;
create policy meal_plans_delete on public.meal_plans for delete to authenticated using (public.is_household_member(household_id));
