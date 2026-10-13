create or replace function public.asignar_coordinaciones_a_cuadrilla(
  p_ids uuid[],
  p_cuadrilla_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  cantidad_ids integer;
  cantidad_unicos integer;
  cantidad_encontrada integer;
  cantidad_actualizada integer;
  fecha_asignacion date;
  tercerizada_destino uuid;
  orden_inicial integer;
begin
  if coalesce(public.mi_rol(), '') not in ('COORDINADOR', 'SUPERVISOR', 'JEFE') then
    raise exception 'No tenés permisos para asignar coordinaciones.';
  end if;

  cantidad_ids := coalesce(cardinality(p_ids), 0);
  if cantidad_ids = 0 then
    raise exception 'Seleccioná al menos un caso sin cuadrilla.';
  end if;

  select count(distinct id) into cantidad_unicos
  from unnest(p_ids) as seleccion(id);
  if cantidad_unicos <> cantidad_ids then
    raise exception 'La selección contiene casos repetidos o inválidos.';
  end if;

  select count(*) into cantidad_encontrada
  from public.coordinaciones
  where id = any(p_ids);
  if cantidad_encontrada <> cantidad_ids then
    raise exception 'No se encontraron todos los casos seleccionados.';
  end if;

  if exists (
    select 1 from public.coordinaciones
    where id = any(p_ids) and cuadrilla_id is not null
  ) then
    raise exception 'Alguno de los casos ya tiene una cuadrilla asignada. Actualizá la página y volvé a seleccionar.';
  end if;

  select min(fecha) into fecha_asignacion
  from public.coordinaciones
  where id = any(p_ids);
  if exists (
    select 1 from public.coordinaciones
    where id = any(p_ids) and fecha <> fecha_asignacion
  ) then
    raise exception 'Solo se pueden asignar juntos casos del mismo día.';
  end if;

  select tercerizada_id into tercerizada_destino
  from public.cuadrillas
  where id = p_cuadrilla_id and activo = true;
  if not found then
    raise exception 'La cuadrilla elegida ya no está disponible.';
  end if;

  select coalesce(max(orden), -1) + 1 into orden_inicial
  from public.coordinaciones
  where fecha = fecha_asignacion
    and tercerizada_id is not distinct from tercerizada_destino
    and cuadrilla_id = p_cuadrilla_id
    and id <> all(p_ids);

  update public.coordinaciones as coordinacion
  set tercerizada_id = tercerizada_destino,
      cuadrilla_id = p_cuadrilla_id,
      orden = orden_inicial + seleccion.posicion - 1
  from unnest(p_ids) with ordinality as seleccion(id, posicion)
  where coordinacion.id = seleccion.id
    and coordinacion.cuadrilla_id is null;

  get diagnostics cantidad_actualizada = row_count;
  if cantidad_actualizada <> cantidad_ids then
    raise exception 'No se pudieron asignar todos los casos; ninguno quedó modificado.';
  end if;
end;
$$;

revoke all on function public.asignar_coordinaciones_a_cuadrilla(uuid[], uuid) from public, anon;
grant execute on function public.asignar_coordinaciones_a_cuadrilla(uuid[], uuid) to authenticated;
