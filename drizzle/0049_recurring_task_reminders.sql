-- Atomically carry authorized reminder schedules to each new task occurrence.
create or replace function public.mobile_complete_task(p_task_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp set timezone = 'UTC' as $$
declare
  task public.tasks%rowtype;
  recurrence public.task_recurrences%rowtype;
  successor uuid;
  next_due timestamptz;
  after_next timestamptz;
  reminder public.reminders%rowtype;
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
    next_due := public.next_zoned_recurrence(coalesce(task.due_at, now()), recurrence.frequency, recurrence.interval_days, recurrence.weekdays, recurrence.recurrence_timezone);
  end if;
  if next_due is null then raise exception 'INVALID_RECURRENCE'; end if;
  after_next := public.next_zoned_recurrence(next_due, recurrence.frequency, recurrence.interval_days, recurrence.weekdays, recurrence.recurrence_timezone);
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
  insert into public.task_recurrences(task_id,frequency,interval_days,weekdays,next_occurrence_at,recurrence_timezone)
  values(successor,recurrence.frequency,recurrence.interval_days,recurrence.weekdays,after_next,recurrence.recurrence_timezone);
  insert into public.task_recurrence_instances(completed_task_id,next_task_id) values(task.id,successor);
  -- Carry each still-authorized owner's non-canceled reminders forward with
  -- the original offset, never another user's snooze or delivery state. Only
  -- the guarded completion path performs this copy (restore does not).
  if task.due_at is not null then
    for reminder in
      select r.* from public.reminders r
      where r.target_type = 'TASK' and r.target_id = task.id and r.status <> 'CANCELED'
        and r.remind_at <= task.due_at and r.remind_at >= task.due_at - interval '30 days'
        and ((task.visibility = 'PRIVATE' and task.owner_id = r.user_id)
          or (task.visibility = 'HOUSEHOLD_SHARED' and exists (
              select 1 from public.household_members m where m.household_id = task.household_id
                and m.user_id = r.user_id and m.left_at is null)))
      for update of r
    loop
      insert into public.reminders(target_type, target_id, user_id, household_id, remind_at, status)
      values ('TASK', successor, reminder.user_id, task.household_id, next_due - (task.due_at - reminder.remind_at), 'PENDING');
    end loop;
  end if;
  return successor;
end $$;
