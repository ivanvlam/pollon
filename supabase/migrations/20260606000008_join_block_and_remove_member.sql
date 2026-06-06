-- ============================================================
-- Pollon — Unión bloqueada post-final + expulsar miembros (creador)
-- ============================================================

-- 1) join_pool_by_code: no se puede unir una vez terminada la final.
create or replace function public.join_pool_by_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool_id uuid;
begin
  if exists (
    select 1 from public.matches where round = 'final' and status = 'finished'
  ) then
    raise exception 'tournament ended';
  end if;

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

-- 2) remove_pool_member: el creador puede expulsar a un participante.
-- Borra su membresía y sus puntos en esa polla (para que no quede en el
-- ranking). No permite expulsar al propio creador.
create or replace function public.remove_pool_member(
  p_pool_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select created_by into v_created_by
  from public.pools
  where id = p_pool_id;

  if v_created_by is null then
    raise exception 'pool not found';
  end if;

  if v_created_by <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if p_user_id = v_created_by then
    raise exception 'cannot remove creator';
  end if;

  delete from public.scores
  where pool_id = p_pool_id and user_id = p_user_id;

  delete from public.pool_members
  where pool_id = p_pool_id and user_id = p_user_id;
end;
$$;

grant execute on function public.remove_pool_member(uuid, uuid) to authenticated;
