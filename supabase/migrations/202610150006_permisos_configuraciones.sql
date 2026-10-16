-- Todo usuario autenticado con rol de la aplicación puede administrar la configuración.
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'tercerizadas', 'cuadrillas', 'tecnologias', 'categorias', 'horarios',
    'zonas', 'estados', 'extras'
  ] loop
    execute format('drop policy if exists %I on public.%I', tabla || '_escritura_supervisor', tabla);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.rol_efectivo() in (''COORDINADOR'',''SUPERVISOR'',''JEFE'')) with check (public.rol_efectivo() in (''COORDINADOR'',''SUPERVISOR'',''JEFE''))',
      tabla || '_escritura_roles_aplicacion', tabla
    );
  end loop;
end $$;

drop policy if exists personal_interno_escritura_supervisor on public.personal_interno;
create policy personal_interno_escritura_roles_aplicacion on public.personal_interno
for all to authenticated
using (public.rol_efectivo() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'))
with check (public.rol_efectivo() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));

drop policy if exists feriados_escritura_supervisor on public.feriados;
create policy feriados_escritura_roles_aplicacion on public.feriados
for all to authenticated
using (public.rol_efectivo() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'))
with check (public.rol_efectivo() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));

drop policy if exists feriado_personal_escritura_supervisor on public.feriado_personal;
create policy feriado_personal_escritura_roles_aplicacion on public.feriado_personal
for all to authenticated
using (public.rol_efectivo() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'))
with check (public.rol_efectivo() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));
