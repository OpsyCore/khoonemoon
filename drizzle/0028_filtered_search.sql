-- RLS remains enforced for every searched table; filter before applying the page limit.
create or replace function public.search_workspace_filtered(
  p_query text, p_kinds text[] default '{}', p_since timestamptz default null,
  p_until timestamptz default null, p_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = public as $$
  with term as (
    select btrim(coalesce(p_query, '')) as q
  ), matches as (
    select 'task'::text kind, t.id entity_id, t.title, t.description subtitle,
      coalesce(t.due_at,t.created_at) happened_at, t.status::text status
    from tasks t, term where length(term.q) between 2 and 100 and t.archived_at is null
      and (t.title ilike '%' || term.q || '%' or coalesce(t.description,'') ilike '%' || term.q || '%')
    union all
    select 'event', e.id, e.title, e.location, e.start_at, e.visibility::text
    from events e, term where length(term.q) between 2 and 100
      and (e.title ilike '%' || term.q || '%' or coalesce(e.description,'') ilike '%' || term.q || '%')
    union all
    select 'shopping_item', i.id, i.name, i.category, i.created_at, case when i.purchased then 'PURCHASED' else 'PENDING' end
    from shopping_items i, term where length(term.q) between 2 and 100 and i.name ilike '%' || term.q || '%'
    union all
    select 'finance', f.id, f.title, f.category, coalesce(f.due_at,f.occurred_at), coalesce(f.bill_status::text,f.record_type::text)
    from financial_records f, term where length(term.q) between 2 and 100 and f.archived_at is null
      and (f.title ilike '%' || term.q || '%' or coalesce(f.category,'') ilike '%' || term.q || '%')
    union all
    select 'chore', c.id, c.title, c.description, c.next_due_at, case when c.is_active then 'ACTIVE' else 'PAUSED' end
    from chores c, term where length(term.q) between 2 and 100 and c.archived_at is null
      and (c.title ilike '%' || term.q || '%' or coalesce(c.description,'') ilike '%' || term.q || '%')
  ), timed as (
    select * from matches where happened_at is null or
      ((p_since is null or happened_at >= p_since) and (p_until is null or happened_at <= p_until))
  ), filtered as (
    select * from timed where coalesce(cardinality(p_kinds),0) = 0 or kind = any(p_kinds)
  ), counts as (
    select kind,count(*) count from timed group by kind
  ), page as (
    select * from filtered order by happened_at desc nulls last, kind, entity_id
    limit 50 offset least(greatest(coalesce(p_offset,0),0),10000)
  )
  select jsonb_build_object(
    'results', coalesce((select jsonb_agg(to_jsonb(page) order by happened_at desc nulls last,kind,entity_id) from page),'[]'::jsonb),
    'counts', coalesce((select jsonb_object_agg(kind,count) from counts),'{}'::jsonb),
    'total', (select count(*) from filtered)
  );
$$;
revoke all on function public.search_workspace_filtered(text,text[],timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.search_workspace_filtered(text,text[],timestamptz,timestamptz,integer) to authenticated;
