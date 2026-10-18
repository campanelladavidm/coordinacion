-- Agrega el perfil Soporte, con acceso limitado al calendario general,
-- avisos/notas, Dash y Novedades.
alter table public.roles drop constraint if exists roles_codigo_check;
alter table public.roles
  add constraint roles_codigo_check check (codigo in ('COORDINADOR', 'SUPERVISOR', 'JEFE', 'SOPORTE'));

insert into public.roles (codigo, nombre)
values ('SOPORTE', 'Soporte')
on conflict (codigo) do update set nombre = excluded.nombre;

-- Soporte solo necesita conocer qué fechas tienen coordinaciones en el calendario.
create or replace function public.fechas_con_coordinaciones_calendario()
returns table (fecha date)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct c.fecha
  from public.coordinaciones as c
  where public.mi_rol() = 'SOPORTE'
  order by c.fecha;
$$;
revoke all on function public.fechas_con_coordinaciones_calendario() from public, anon;
grant execute on function public.fechas_con_coordinaciones_calendario() to authenticated;

-- Impide leer casos, asignaciones, rangos y catálogos desde un usuario Soporte.
drop policy if exists "coordinaciones lectura autenticada" on public.coordinaciones;
create policy coordinaciones_lectura_roles_operativos on public.coordinaciones
for select to authenticated
using (public.mi_rol() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));

drop policy if exists "extras de coordinacion lectura autenticada" on public.coordinacion_extras;
create policy coordinacion_extras_lectura_roles_operativos on public.coordinacion_extras
for select to authenticated
using (public.mi_rol() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));

drop policy if exists "custodias lectura autenticada" on public.custodias;
create policy custodias_lectura_roles_operativos on public.custodias
for select to authenticated
using (public.mi_rol() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));

drop policy if exists rangos_cuadrilla_lectura_autenticada on public.rangos_cuadrilla;
create policy rangos_cuadrilla_lectura_roles_operativos on public.rangos_cuadrilla
for select to authenticated
using (public.mi_rol() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));

do $$
declare tabla text;
begin
  foreach tabla in array array[
    'tercerizadas', 'cuadrillas', 'tecnologias', 'categorias', 'horarios',
    'zonas', 'estados', 'extras'
  ] loop
    execute format('drop policy if exists %I on public.%I', tabla || '_lectura_autenticada', tabla);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.mi_rol() in (''COORDINADOR'',''SUPERVISOR'',''JEFE''))',
      tabla || '_lectura_roles_operativos', tabla
    );
  end loop;
end $$;

-- Los datos de liquidaciones quedan disponibles solo para Jefe y Supervisor.
drop policy if exists liquidaciones_lectura_autenticada on public.liquidaciones;
create policy liquidaciones_lectura_jefatura on public.liquidaciones
for select to authenticated using (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'));

drop policy if exists liquidaciones_exportaciones_lectura_autenticada on public.liquidaciones_exportaciones;
create policy liquidaciones_exportaciones_lectura_jefatura on public.liquidaciones_exportaciones
for select to authenticated using (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'));
