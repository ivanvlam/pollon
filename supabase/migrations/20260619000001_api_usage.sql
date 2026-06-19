-- Contador de requests a TheSportsDB por día, para vigilar la cuota gratuita
-- (100 req/día con la clave "3"). Se incrementa desde el servidor en cada
-- llamada a la API y se muestra en el panel admin.

create table if not exists public.api_usage (
  day   date primary key default current_date,
  count integer not null default 0
);

alter table public.api_usage enable row level security;
-- Sin policies a propósito: el acceso es solo vía las funciones SECURITY
-- DEFINER de abajo (la clave sb_secret_* no otorga service_role por PostgREST).

-- Incremento atómico del contador del día.
create or replace function public.increment_api_usage(p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_delta is null or p_delta <= 0 then
    return;
  end if;
  insert into public.api_usage (day, count)
  values (current_date, p_delta)
  on conflict (day) do update
    set count = public.api_usage.count + p_delta;
end;
$$;

-- Uso de los últimos p_days días (incluye hoy), más reciente primero.
create or replace function public.get_api_usage(p_days integer default 7)
returns table (day date, count integer)
language sql
security definer
set search_path = public
as $$
  select day, count
  from public.api_usage
  where day > current_date - p_days
  order by day desc;
$$;

grant execute on function public.increment_api_usage(integer) to anon, authenticated, service_role;
grant execute on function public.get_api_usage(integer) to anon, authenticated, service_role;
