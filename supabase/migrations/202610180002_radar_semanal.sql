create or replace function public.radar_semanal(p_semana_inicio date)
returns table (fecha date, zona_id uuid, zona text, cantidad integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.mi_rol() is null then
    raise exception 'No tenés permiso para consultar el radar semanal.';
  end if;

  if p_semana_inicio is null or extract(isodow from p_semana_inicio) <> 1 then
    raise exception 'La semana debe comenzar un lunes.';
  end if;

  return query
  with dias as (
    select (p_semana_inicio + serie.dia)::date as fecha
    from generate_series(0, 6) as serie(dia)
  ),
  zonas_radar as (
    select z.id as zona_id, z.nombre as zona
    from public.zonas as z
    union all
    select null::uuid, 'Sin zona asignada'::text
  ),
  conteos as (
    select c.fecha, c.zona_id, count(*)::integer as cantidad
    from public.coordinaciones as c
    where c.fecha >= p_semana_inicio and c.fecha < p_semana_inicio + 7
    group by c.fecha, c.zona_id
  )
  select d.fecha, z.zona_id, z.zona, coalesce(c.cantidad, 0)::integer
  from dias as d
  cross join zonas_radar as z
  left join conteos as c on c.fecha = d.fecha and c.zona_id is not distinct from z.zona_id
  order by d.fecha, z.zona;
end;
$$;

revoke all on function public.radar_semanal(date) from public, anon;
grant execute on function public.radar_semanal(date) to authenticated;
