-- ============================================================
-- Pollon — RPCs: dashboard (1 sola query) + borrado atómico de polla
-- ============================================================

-- ------------------------------------------------------------
-- get_my_pools_ranking: ranking de TODAS las pollas del usuario en una
-- sola llamada (elimina el N+1 del dashboard). Devuelve una fila por
-- (polla, miembro) ya ordenada por posición, con metadata de la polla.
-- Solo expone pollas donde auth.uid() es miembro.
-- ------------------------------------------------------------
create or replace function public.get_my_pools_ranking()
returns table (
  pool_id         uuid,
  pool_name       text,
  pool_created_by uuid,
  user_id         uuid,
  display_name    text,
  total           bigint,
  rank            bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with my_pools as (
    select p.id, p.name, p.created_by
    from public.pools p
    join public.pool_members pm on pm.pool_id = p.id
    where pm.user_id = auth.uid()
  ),
  scored as (
    select
      mp.id          as pool_id,
      mp.name        as pool_name,
      mp.created_by  as pool_created_by,
      pm.user_id,
      pr.display_name,
      coalesce(sum(s.points), 0)::bigint as total,
      count(*) filter (
        where s.reason in ('exact_score', 'exact_qualifier_score')
      )::bigint as exact_count,
      count(*) filter (
        where s.reason in ('correct_diff', 'correct_diff_qualifier')
      )::bigint as diff_count,
      count(*) filter (
        where s.reason in ('correct_winner', 'correct_draw', 'correct_qualifier')
      )::bigint as winner_count,
      coalesce(bool_or(s.reason = 'champion'), false) as champion_correct
    from my_pools mp
    join public.pool_members pm on pm.pool_id = mp.id
    join public.profiles pr on pr.id = pm.user_id
    left join public.scores s
      on s.pool_id = pm.pool_id and s.user_id = pm.user_id
    group by mp.id, mp.name, mp.created_by, pm.user_id, pr.display_name
  )
  select
    pool_id,
    pool_name,
    pool_created_by,
    user_id,
    display_name,
    total,
    row_number() over (
      partition by pool_id
      order by
        total desc,
        exact_count desc,
        diff_count desc,
        winner_count desc,
        champion_correct desc,
        display_name asc
    )::bigint as rank
  from scored
  order by pool_id, rank;
$$;

grant execute on function public.get_my_pools_ranking() to authenticated;

-- ------------------------------------------------------------
-- delete_pool: el creador puede eliminar su polla, salvo que ya haya
-- puntos registrados (una polla en curso no se borra). El borrado cascada
-- limpia pool_members y scores; las predicciones son globales y sobreviven.
-- Atómico y SECURITY DEFINER.
-- ------------------------------------------------------------
create or replace function public.delete_pool(p_pool_id uuid)
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
  where id = p_pool_id
  for update;

  if v_created_by is null then
    raise exception 'pool not found';
  end if;

  if v_created_by <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if exists (select 1 from public.scores where pool_id = p_pool_id) then
    raise exception 'pool has scores';
  end if;

  delete from public.pools where id = p_pool_id;
end;
$$;

grant execute on function public.delete_pool(uuid) to authenticated;

-- ------------------------------------------------------------
-- Nadie se sale de una polla por su cuenta: la única salida es que el
-- creador la elimine. Quitamos la política que permitía auto-borrarse la
-- membresía (el borrado en cascada de delete_pool sigue funcionando: corre
-- como SECURITY DEFINER y no depende de RLS).
-- ------------------------------------------------------------
drop policy if exists "pool_members_delete_self" on public.pool_members;
