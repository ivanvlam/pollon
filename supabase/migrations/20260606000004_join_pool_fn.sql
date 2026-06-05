-- Función SECURITY DEFINER para unirse a una polla por invite_code.
-- El client anon/authenticated no puede hacer SELECT en pools ajenas (RLS),
-- pero esta función corre como el owner (definer) y sí puede.
create or replace function public.join_pool_by_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool_id uuid;
begin
  select id into v_pool_id
  from public.pools
  where invite_code = p_invite_code;

  if v_pool_id is null then
    return null;
  end if;

  insert into public.pool_members (pool_id, user_id)
  values (v_pool_id, auth.uid())
  on conflict (pool_id, user_id) do nothing;

  return v_pool_id;
end;
$$;

grant execute on function public.join_pool_by_code(text) to authenticated;
