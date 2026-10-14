-- Jefatura puede operar desde la interfaz en el contexto de un usuario activo.
-- El registro queda restringido al servidor y conserva autor real y usuario contexto.
create table if not exists public.actuaciones_jefe (
  id uuid primary key default gen_random_uuid(),
  jefe_id uuid references public.usuarios(id) on delete set null,
  usuario_contexto_id uuid references public.usuarios(id) on delete set null,
  tabla text not null,
  operacion text not null,
  fila_id text,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  created_at timestamptz not null default now()
);

alter table public.actuaciones_jefe enable row level security;
revoke all on public.actuaciones_jefe from anon, authenticated;
grant all on public.actuaciones_jefe to service_role;

create or replace function public.registrar_actuacion_jefe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  headers jsonb;
  contexto_id uuid;
  raw_contexto text;
  antes jsonb;
  despues jsonb;
  clave text;
begin
  if actor_id is null or public.mi_rol() <> 'JEFE' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  raw_contexto := coalesce(headers ->> 'x-user-context', '');
  if raw_contexto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    contexto_id := raw_contexto::uuid;
  end if;
  if contexto_id is null or contexto_id = actor_id then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  antes := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  despues := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  clave := coalesce(despues ->> 'id', antes ->> 'id');
  if clave is null and tg_table_name = 'rangos_cuadrilla' then
    clave := coalesce(despues ->> 'fecha', antes ->> 'fecha') || ':' || coalesce(despues ->> 'cuadrilla_id', antes ->> 'cuadrilla_id');
  elsif clave is null and tg_table_name = 'feriados' then
    clave := coalesce(despues ->> 'fecha', antes ->> 'fecha');
  elsif clave is null and tg_table_name = 'feriado_personal' then
    clave := coalesce(despues ->> 'fecha', antes ->> 'fecha') || ':' || coalesce(despues ->> 'personal_id', antes ->> 'personal_id');
  elsif clave is null and tg_table_name = 'coordinacion_extras' then
    clave := coalesce(despues ->> 'coordinacion_id', antes ->> 'coordinacion_id') || ':' || coalesce(despues ->> 'extra_id', antes ->> 'extra_id');
  end if;

  insert into public.actuaciones_jefe (jefe_id, usuario_contexto_id, tabla, operacion, fila_id, datos_anteriores, datos_nuevos)
  values (actor_id, contexto_id, tg_table_name, tg_op, clave, antes, despues);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.registrar_actuacion_jefe() from public, anon, authenticated;

create or replace function public.rol_efectivo()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rol_real text := public.mi_rol();
  raw_contexto text;
  rol_contexto text;
begin
  if rol_real <> 'JEFE' then return rol_real; end if;
  raw_contexto := coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-user-context', '');
  if raw_contexto !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return rol_real; end if;
  select r.codigo into rol_contexto from public.usuarios u join public.roles r on r.id = u.rol_id
  where u.id = raw_contexto::uuid and u.activo = true;
  return coalesce(rol_contexto, rol_real);
end;
$$;
revoke all on function public.rol_efectivo() from public, anon;
grant execute on function public.rol_efectivo() to authenticated;

do $$
declare tabla text;
begin
  foreach tabla in array array[
    'coordinaciones', 'coordinacion_extras', 'custodias', 'rangos_cuadrilla', 'feriados',
    'feriado_personal', 'notas_equipo', 'tercerizadas', 'cuadrillas', 'tecnologias',
    'categorias', 'horarios', 'zonas', 'estados', 'extras', 'personal_interno',
    'novedades', 'novedades_vistas'
  ] loop
    execute format('drop trigger if exists auditoria_contexto_jefe on public.%I', tabla);
    execute format('create trigger auditoria_contexto_jefe after insert or update or delete on public.%I for each row execute function public.registrar_actuacion_jefe()', tabla);
  end loop;
end $$;

do $$
declare tabla text;
begin
  foreach tabla in array array['tercerizadas','cuadrillas','tecnologias','categorias','horarios','zonas','estados','extras'] loop
    execute format('drop policy if exists %I on public.%I', tabla || '_escritura_supervisor', tabla);
    execute format('create policy %I on public.%I for all to authenticated using (public.rol_efectivo() in (''SUPERVISOR'',''JEFE'')) with check (public.rol_efectivo() in (''SUPERVISOR'',''JEFE''))', tabla || '_escritura_supervisor', tabla);
  end loop;
end $$;

drop policy if exists personal_interno_escritura_supervisor on public.personal_interno;
create policy personal_interno_escritura_supervisor on public.personal_interno
for all to authenticated using (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'))
with check (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'));
drop policy if exists feriados_escritura_supervisor on public.feriados;
create policy feriados_escritura_supervisor on public.feriados
for all to authenticated using (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'))
with check (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'));
drop policy if exists feriado_personal_escritura_supervisor on public.feriado_personal;
create policy feriado_personal_escritura_supervisor on public.feriado_personal
for all to authenticated using (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'))
with check (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'));

-- La política permite que un Jefe cree una nota bajo el usuario seleccionado.
drop policy if exists notas_equipo_creacion_autenticada on public.notas_equipo;
create policy notas_equipo_creacion_autenticada on public.notas_equipo
for insert to authenticated with check (
  public.rol_efectivo() is not null
  and (
    creado_por = (select auth.uid())
    or (
      public.mi_rol() = 'JEFE'
      and coalesce((coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb) ->> 'x-user-context'), '') = creado_por::text
    )
  )
);

drop policy if exists notas_equipo_eliminar_propia_o_supervisor on public.notas_equipo;
create policy notas_equipo_eliminar_propia_o_supervisor on public.notas_equipo
for delete to authenticated using (creado_por = (select auth.uid()) or public.rol_efectivo() in ('SUPERVISOR', 'JEFE'));
