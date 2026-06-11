-- ============================================================
-- Pollon — Abandonar polla (el participante se va por su cuenta)
-- ============================================================
-- Antes: nadie podía salir de una polla (se quitó pool_members_delete_self);
-- la única forma de que desapareciera era que el creador la eliminara.
--
-- Ahora un participante puede abandonar la polla por su cuenta vía esta RPC
-- (SECURITY DEFINER), que borra su membresía y sus puntos en esa polla —
-- igual que remove_pool_member, pero sobre sí mismo. Las predicciones son
-- globales y sobreviven (siguen contando en sus otras pollas).
--
-- El CREADOR no puede abandonar: para deshacerse de la polla usa delete_pool.
-- Mantener un RPC (en vez de reactivar la policy de delete) permite bloquear
-- al creador y limpiar scores de forma atómica.
create or replace function public.leave_pool(p_pool_id uuid)
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

  if v_created_by = auth.uid() then
    raise exception 'creator cannot leave';
  end if;

  delete from public.scores
  where pool_id = p_pool_id and user_id = auth.uid();

  delete from public.pool_members
  where pool_id = p_pool_id and user_id = auth.uid();
end;
$$;

grant execute on function public.leave_pool(uuid) to authenticated;
