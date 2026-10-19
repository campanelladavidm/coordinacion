alter table public.zonas
  add column if not exists latitud double precision,
  add column if not exists longitud double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'zonas_coordenadas_pareja_check'
      and conrelid = 'public.zonas'::regclass
  ) then
    alter table public.zonas
      add constraint zonas_coordenadas_pareja_check check (
        (latitud is null and longitud is null)
        or (latitud is not null and longitud is not null and latitud between -90 and 90 and longitud between -180 and 180)
      );
  end if;
end;
$$;

create or replace function public.radar_categorias_semanal(p_semana_inicio date)
returns table (fecha date, categoria_id uuid, categoria text, cantidad integer)
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
  conteos as (
    select c.fecha, c.categoria_id, count(*)::integer as cantidad
    from public.coordinaciones as c
    where c.fecha >= p_semana_inicio and c.fecha < p_semana_inicio + 7
    group by c.fecha, c.categoria_id
  )
  select d.fecha, cat.id, cat.nombre, coalesce(c.cantidad, 0)::integer
  from dias as d
  cross join public.categorias as cat
  left join conteos as c on c.fecha = d.fecha and c.categoria_id = cat.id
  order by d.fecha, cat.nombre;
end;
$$;

revoke all on function public.radar_categorias_semanal(date) from public, anon;
grant execute on function public.radar_categorias_semanal(date) to authenticated;
