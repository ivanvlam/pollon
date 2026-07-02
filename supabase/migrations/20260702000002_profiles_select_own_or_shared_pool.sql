-- ============================================================
-- profiles: restringir SELECT a perfil propio o de compañeros de polla
-- ============================================================
-- Antes cualquier usuario autenticado podía listar TODOS los perfiles
-- (display_name, timezone) con using (true). Como el registro es abierto,
-- un desconocido podía crear cuenta y enumerar los nombres de todos los
-- usuarios. Ahora solo se ve el perfil propio o el de usuarios con quienes
-- se comparte al menos una polla (misma regla que predictions/champion).
--
-- No rompe ninguna vista: todas las lecturas de profiles en la app son del
-- propio usuario, de miembros de la misma polla, vía service role (admin) o
-- vía RPCs SECURITY DEFINER (get_pool_ranking, get_my_pools_ranking).

drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_own_or_shared_pool" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_pool_with(id));
