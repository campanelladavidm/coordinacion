create or replace function public.evitar_ticket_duplicado_por_dia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cuadrilla_existente text;
  ticket_existente text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.fecha::text || ':' || upper(btrim(new.ticket)), 0)
  );

  select c.ticket, q.nombre
  into ticket_existente, cuadrilla_existente
  from public.coordinaciones c
  left join public.cuadrillas q on q.id = c.cuadrilla_id
  where c.fecha = new.fecha
    and upper(btrim(c.ticket)) = upper(btrim(new.ticket))
    and c.id is distinct from new.id
  limit 1;

  if ticket_existente is not null then
    raise exception 'El TK % ya fue coordinado el % en la cuadrilla %.',
      ticket_existente, new.fecha,
      coalesce(cuadrilla_existente, 'sin cuadrilla asignada')
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists coordinaciones_evitar_ticket_duplicado on public.coordinaciones;
create trigger coordinaciones_evitar_ticket_duplicado
before insert or update of fecha, ticket on public.coordinaciones
for each row execute function public.evitar_ticket_duplicado_por_dia();
