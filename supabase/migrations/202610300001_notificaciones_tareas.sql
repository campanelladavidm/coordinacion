create table if not exists public.notificaciones_tareas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  tipo text not null check (tipo in ('ASIGNACION', 'ESTADO', 'COMENTARIO')),
  titulo text not null,
  mensaje text not null,
  created_at timestamptz not null default now(),
  leida_at timestamptz
);

create index if not exists notificaciones_tareas_usuario_fecha_idx
  on public.notificaciones_tareas (usuario_id, created_at desc);

create index if not exists notificaciones_tareas_leidas_idx
  on public.notificaciones_tareas (leida_at)
  where leida_at is not null;

alter table public.tareas
  add column if not exists actualizado_por uuid references public.usuarios(id) on delete set null;

alter table public.notificaciones_tareas enable row level security;
revoke all on public.notificaciones_tareas from anon, authenticated;
grant all on public.notificaciones_tareas to service_role;

create or replace function public.notificar_asignacion_tarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  titulo_tarea text;
  nombre_actor text;
begin
  if new.usuario_id = new.asignado_por then
    return new;
  end if;

  select t.titulo into titulo_tarea
  from public.tareas as t
  where t.id = new.tarea_id;

  select coalesce(nullif(u.nombre_completo, ''), 'Un compañero') into nombre_actor
  from public.usuarios as u
  where u.id = new.asignado_por;

  insert into public.notificaciones_tareas (usuario_id, tarea_id, tipo, titulo, mensaje)
  values (new.usuario_id, new.tarea_id, 'ASIGNACION', titulo_tarea, coalesce(nombre_actor, 'Un compañero') || ' te agregó a esta tarea');

  return new;
end;
$$;

create or replace function public.notificar_cambio_estado_tarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre_actor text;
  estado_anterior text;
  estado_nuevo text;
begin
  if old.estado is not distinct from new.estado then
    return new;
  end if;

  if new.creado_por = new.actualizado_por then
    return new;
  end if;

  select coalesce(nullif(u.nombre_completo, ''), 'Un compañero') into nombre_actor
  from public.usuarios as u
  where u.id = new.actualizado_por;

  estado_anterior := case old.estado
    when 'PENDIENTE' then 'Pendiente'
    when 'EN_CURSO' then 'En curso'
    when 'FINALIZADA' then 'Finalizada'
    when 'MATERIALES' then 'Materiales'
    else old.estado
  end;
  estado_nuevo := case new.estado
    when 'PENDIENTE' then 'Pendiente'
    when 'EN_CURSO' then 'En curso'
    when 'FINALIZADA' then 'Finalizada'
    when 'MATERIALES' then 'Materiales'
    else new.estado
  end;

  insert into public.notificaciones_tareas (usuario_id, tarea_id, tipo, titulo, mensaje)
  values (
    new.creado_por,
    new.id,
    'ESTADO',
    new.titulo,
    coalesce(nombre_actor, 'Un compañero') || ' cambió el estado de ' || estado_anterior || ' a ' || estado_nuevo
  );

  return new;
end;
$$;

create or replace function public.notificar_comentario_tarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  titulo_tarea text;
  creador_tarea uuid;
  nombre_actor text;
  receptor uuid;
begin
  select t.titulo, t.creado_por
  into titulo_tarea, creador_tarea
  from public.tareas as t
  where t.id = new.tarea_id;

  select coalesce(nullif(u.nombre_completo, ''), 'Un compañero') into nombre_actor
  from public.usuarios as u
  where u.id = new.autor_id;

  for receptor in
    select creador_tarea
    where creador_tarea <> new.autor_id
    union
    select a.usuario_id
    from public.tareas_asignados as a
    where a.tarea_id = new.tarea_id
      and a.usuario_id <> new.autor_id
  loop
    insert into public.notificaciones_tareas (usuario_id, tarea_id, tipo, titulo, mensaje)
    values (receptor, new.tarea_id, 'COMENTARIO', titulo_tarea, coalesce(nombre_actor, 'Un compañero') || ' agregó un comentario');
  end loop;

  return new;
end;
$$;

revoke all on function public.notificar_asignacion_tarea() from public, anon, authenticated;
revoke all on function public.notificar_cambio_estado_tarea() from public, anon, authenticated;
revoke all on function public.notificar_comentario_tarea() from public, anon, authenticated;

drop trigger if exists tareas_asignados_notificacion_insert on public.tareas_asignados;
create trigger tareas_asignados_notificacion_insert
after insert on public.tareas_asignados
for each row execute function public.notificar_asignacion_tarea();

drop trigger if exists tareas_notificacion_cambio_estado on public.tareas;
create trigger tareas_notificacion_cambio_estado
after update of estado on public.tareas
for each row execute function public.notificar_cambio_estado_tarea();

drop trigger if exists tareas_comentarios_notificacion_insert on public.tareas_comentarios;
create trigger tareas_comentarios_notificacion_insert
after insert on public.tareas_comentarios
for each row execute function public.notificar_comentario_tarea();

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'limpieza-diaria-notificaciones-tareas',
  '0 6 * * *',
  $$
    delete from public.notificaciones_tareas
    where leida_at is not null
      and (leida_at at time zone 'America/Argentina/Buenos_Aires')::date <
        ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 2)
  $$
);
