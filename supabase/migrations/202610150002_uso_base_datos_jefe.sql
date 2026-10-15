-- Devuelve el tamano total de las bases del proyecto solo a usuarios Jefe.
create or replace function public.obtener_uso_base_datos_bytes()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bytes_usados bigint;
begin
  if (select public.mi_rol()) is distinct from 'JEFE' then
    raise exception 'Solo Jefatura puede consultar el uso de la base de datos.'
      using errcode = '42501';
  end if;

  select coalesce(sum(pg_catalog.pg_database_size(db.datname)), 0)::bigint
  into bytes_usados
  from pg_catalog.pg_database as db;

  return bytes_usados;
end;
$$;

revoke all on function public.obtener_uso_base_datos_bytes() from public, anon;
grant execute on function public.obtener_uso_base_datos_bytes() to authenticated;
