-- Milestone 10: Cross-domain search (RLS-aware)

create extension if not exists pg_trgm;

create index if not exists tasks_title_trgm_idx
  on public.tasks using gin (title gin_trgm_ops);

create index if not exists events_title_trgm_idx
  on public.events using gin (title gin_trgm_ops);

create index if not exists shopping_items_name_trgm_idx
  on public.shopping_items using gin (name gin_trgm_ops);

create index if not exists financial_records_title_trgm_idx
  on public.financial_records using gin (title gin_trgm_ops);

create index if not exists chores_title_trgm_idx
  on public.chores using gin (title gin_trgm_ops);

/**
 * Searches every domain the caller is allowed to see.
 *
 * The function is security invoker (the default), so the RLS policies of each
 * underlying table are applied per row — a partner can never see private
 * records belonging to the other person through search.
 */
create or replace function public.search_workspace(p_query text, p_limit integer default 20)
returns table (
  kind text,
  entity_id uuid,
  title text,
  subtitle text,
  happened_at timestamptz,
  status text
)
language sql
stable
set search_path = public
as $$
  with term as (
    select nullif(btrim(coalesce(p_query, '')), '') as q
  )
  select * from (
    select
      'task'::text as kind,
      t.id as entity_id,
      t.title,
      t.description as subtitle,
      coalesce(t.due_at, t.created_at) as happened_at,
      t.status::text as status
    from public.tasks t, term
    where term.q is not null
      and t.archived_at is null
      and (t.title ilike '%' || term.q || '%' or coalesce(t.description, '') ilike '%' || term.q || '%')

    union all

    select
      'event'::text,
      e.id,
      e.title,
      e.location,
      e.start_at,
      e.visibility::text
    from public.events e, term
    where term.q is not null
      and (e.title ilike '%' || term.q || '%' or coalesce(e.description, '') ilike '%' || term.q || '%')

    union all

    select
      'shopping_item'::text,
      i.id,
      i.name,
      i.category,
      i.created_at,
      case when i.purchased then 'PURCHASED' else 'PENDING' end
    from public.shopping_items i, term
    where term.q is not null
      and i.name ilike '%' || term.q || '%'

    union all

    select
      'finance'::text,
      f.id,
      f.title,
      f.category,
      coalesce(f.due_at, f.occurred_at),
      coalesce(f.bill_status::text, f.record_type::text)
    from public.financial_records f, term
    where term.q is not null
      and f.archived_at is null
      and (f.title ilike '%' || term.q || '%' or coalesce(f.category, '') ilike '%' || term.q || '%')

    union all

    select
      'chore'::text,
      c.id,
      c.title,
      c.description,
      c.next_due_at,
      case when c.is_active then 'ACTIVE' else 'PAUSED' end
    from public.chores c, term
    where term.q is not null
      and c.archived_at is null
      and (c.title ilike '%' || term.q || '%' or coalesce(c.description, '') ilike '%' || term.q || '%')
  ) results
  order by happened_at desc nulls last
  limit least(coalesce(p_limit, 20), 50);
$$;

grant execute on function public.search_workspace(text, integer) to authenticated;
