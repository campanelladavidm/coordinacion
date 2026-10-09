alter table public.coordinaciones
  add column if not exists orden integer not null default 0;

with orden_inicial as (
  select id,
    row_number() over (
      partition by fecha, tercerizada_id, cuadrilla_id
      order by created_at, id
    ) - 1 as posicion
  from public.coordinaciones
)
update public.coordinaciones as coordinacion
set orden = orden_inicial.posicion
from orden_inicial
where coordinacion.id = orden_inicial.id;

create index if not exists coordinaciones_orden_dia_idx
  on public.coordinaciones(fecha, tercerizada_id, cuadrilla_id, orden);

create or replace function public.reordenar_coordinaciones(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  cantidad_ids integer;
  cantidad_encontrada integer;
  cantidad_grupos integer;
begin
  if public.mi_rol() not in ('COORDINADOR', 'SUPERVISOR', 'JEFE') then
    raise exception 'No tenés permisos para reordenar coordinaciones.';
  end if;

  cantidad_ids := coalesce(cardinality(p_ids), 0);
  if cantidad_ids < 2 then
    raise exception 'Seleccioná al menos dos coordinaciones para reordenar.';
  end if;

  select count(*) into cantidad_encontrada
  from public.coordinaciones
  where id = any(p_ids);

  if cantidad_encontrada <> cantidad_ids then
    raise exception 'La lista contiene coordinaciones inexistentes o repetidas.';
  end if;

  select count(*) into cantidad_grupos
  from (
    select fecha, tercerizada_id, cuadrilla_id
    from public.coordinaciones
    where id = any(p_ids)
    group by fecha, tercerizada_id, cuadrilla_id
  ) as grupos;

  if cantidad_grupos <> 1 then
    raise exception 'Solo se pueden ordenar coordinaciones de la misma cuadrilla y día.';
  end if;

  update public.coordinaciones as coordinacion
  set orden = posiciones.posicion - 1
  from unnest(p_ids) with ordinality as posiciones(id, posicion)
  where coordinacion.id = posiciones.id;
end;
$$;

revoke all on function public.reordenar_coordinaciones(uuid[]) from public, anon;
grant execute on function public.reordenar_coordinaciones(uuid[]) to authenticated;
