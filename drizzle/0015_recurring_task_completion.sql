-- Link each completed occurrence to at most one successor. Writes are allowed
-- only through the guarded completion function; rows follow task visibility.
create table if not exists public.task_recurrence_instances (
  completed_task_id uuid primary key references public.tasks(id) on delete cascade,
  next_task_id uuid not null unique references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (completed_task_id <> next_task_id)
);
alter table public.task_recurrence_instances enable row level security;
drop policy if exists "recurrence_instances_select_access" on public.task_recurrence_instances;
create policy "recurrence_instances_select_access" on public.task_recurrence_instances
  for select to authenticated using (public.current_user_can_access_task(completed_task_id));
revoke all on public.task_recurrence_instances from public, anon, authenticated;
grant select on public.task_recurrence_instances to authenticated;

-- The function needs to copy the original creator/owner, which RLS ordinarily
-- prevents another household member from inserting. Its only argument is a task
-- ID, it checks the existing manage policy explicitly, locks the row, derives
-- all new values from trusted rows, and remains atomic on errors.
create or replace function public.mobile_complete_task(p_task_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp set timezone = 'UTC' as $$
declare
  task public.tasks%rowtype;
  recurrence public.task_recurrences%rowtype;
  successor uuid;
  next_due timestamptz;
  after_next timestamptz;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.current_user_can_manage_task(p_task_id) then raise exception 'TASK_NOT_FOUND_OR_FORBIDDEN'; end if;
  select * into task from public.tasks where id = p_task_id for update;
  if task.id is null or task.archived_at is not null or not public.current_user_can_manage_task(p_task_id) then raise exception 'TASK_NOT_FOUND_OR_FORBIDDEN'; end if;
  select next_task_id into successor from public.task_recurrence_instances where completed_task_id = task.id;
  if task.status = 'COMPLETED' then return successor; end if;
  update public.tasks set status = 'COMPLETED', completed_at = now() where id = task.id;
  if successor is not null then return successor; end if;
  select * into recurrence from public.task_recurrences where task_id = task.id;
  if recurrence.id is null or recurrence.frequency = 'NONE' then return null; end if;
  next_due := recurrence.next_occurrence_at;
  if next_due is null or (task.due_at is not null and next_due <= task.due_at) then
    next_due := public.calculate_next_chore_due(coalesce(task.due_at, now()), recurrence.frequency, recurrence.interval_days, recurrence.weekdays);
  end if;
  if next_due is null then raise exception 'INVALID_RECURRENCE'; end if;
  after_next := public.calculate_next_chore_due(next_due, recurrence.frequency, recurrence.interval_days, recurrence.weekdays);
  if after_next is null or after_next <= next_due then raise exception 'INVALID_RECURRENCE'; end if;
  insert into public.tasks(title,description,creator_id,owner_id,household_id,visibility,status,priority,due_at)
  values(task.title,task.description,task.creator_id,task.owner_id,task.household_id,task.visibility,'PENDING',task.priority,next_due)
  returning id into successor;
  insert into public.task_assignees(task_id,assignee_id)
    select successor, a.assignee_id from public.task_assignees a
    where a.task_id = task.id and public.valid_task_assignee(successor,a.assignee_id);
  if not exists(select 1 from public.task_assignees where task_id = successor) then
    insert into public.task_assignees(task_id,assignee_id) values(successor, case when task.visibility = 'PRIVATE' then task.owner_id else auth.uid() end);
  end if;
  insert into public.task_recurrences(task_id,frequency,interval_days,weekdays,next_occurrence_at)
  values(successor,recurrence.frequency,recurrence.interval_days,recurrence.weekdays,after_next);
  insert into public.task_recurrence_instances(completed_task_id,next_task_id) values(task.id,successor);
  return successor;
end $$;
revoke all on function public.mobile_complete_task(uuid) from public, anon;
grant execute on function public.mobile_complete_task(uuid) to authenticated;
