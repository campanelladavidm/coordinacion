begin;

-- Any account created outside the admin flow starts inactive.
-- The app's Jefatura-only user API explicitly activates it after provisioning.
create or replace function public.crear_perfil_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rol_coordinador uuid;
begin
  select id into rol_coordinador from public.roles where codigo = 'COORDINADOR' limit 1;
  if rol_coordinador is null then
    raise exception 'No existe el rol COORDINADOR.';
  end if;
  insert into public.usuarios (id, nombre_completo, rol_id, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre_completo', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    rol_coordinador,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.crear_perfil_usuario_auth() from public, anon, authenticated;

-- The app authenticates users before accessing the public schema.
-- A publishable Supabase key is public by design; anonymous SQL/API access is denied here.
revoke all on schema public from public, anon;
revoke create on schema public from authenticated;
grant usage on schema public to authenticated, service_role;

revoke all on all tables in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;
revoke execute on all functions in schema public from public, anon;

-- Re-grant only the RPCs used by signed-in users in the application.
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.rol_efectivo() to authenticated;
grant execute on function public.reordenar_coordinaciones(uuid[]) to authenticated;
grant execute on function public.asignar_coordinaciones_a_cuadrilla(uuid[], uuid) to authenticated;
grant execute on function public.obtener_uso_base_datos_bytes() to authenticated;
grant execute on function public.fechas_con_coordinaciones_calendario() to authenticated;
grant execute on function public.radar_semanal(date) to authenticated;
grant execute on function public.radar_categorias_semanal(date) to authenticated;

-- Ensure all current public tables fail closed unless an explicit RLS policy allows access.
do $$
declare
  tabla record;
begin
  for tabla in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', tabla.schemaname, tabla.tablename);
  end loop;
end;
$$;

-- Keep future objects created by the migration owner closed to anonymous/public roles by default.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

commit;
