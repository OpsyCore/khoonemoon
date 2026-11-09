-- Atomic, retry-safe transfer into an existing active shopping list. RLS remains
-- in force; the per-list transaction lock serializes competing transfers.
create or replace function public.mobile_add_meal_ingredients(p_list uuid,p_names text[])
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_name text; inserted int:=0; skipped int:=0;
begin
 if auth.uid() is null or p_list is null or p_names is null or cardinality(p_names)>200 then raise exception 'INVALID_INGREDIENTS'; end if;
 if not exists(select 1 from public.shopping_lists where id=p_list and archived_at is null) then raise exception 'LIST_NOT_AVAILABLE'; end if;
 perform pg_advisory_xact_lock(hashtextextended('meal-shopping:'||p_list::text,0));
 for v_name in select distinct btrim(x) from unnest(p_names) x loop
  if v_name is null or char_length(v_name)<1 or char_length(v_name)>160 then raise exception 'INVALID_INGREDIENT'; end if;
  if exists(select 1 from public.shopping_items i where i.list_id=p_list and not i.purchased and lower(btrim(i.name))=lower(v_name)) then
   skipped:=skipped+1;
  else
   insert into public.shopping_items(list_id,name,added_by) values (p_list,v_name,auth.uid());
   inserted:=inserted+1;
  end if;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',skipped);
end $$;
revoke all on function public.mobile_add_meal_ingredients(uuid,text[]) from public,anon;
grant execute on function public.mobile_add_meal_ingredients(uuid,text[]) to authenticated;
