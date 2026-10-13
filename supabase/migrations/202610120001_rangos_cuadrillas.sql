create table if not exists public.rangos_cuadrilla (
  fecha date not null,
  cuadrilla_id uuid not null references public.cuadrillas(id) on delete restrict,
  cantidad_tickets integer,
  no_trabaja boolean not null default false,
  actualizado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (fecha, cuadrilla_id),
  constraint rangos_cuadrilla_cantidad_check check (
    (no_trabaja and cantidad_tickets is null)
    or (not no_trabaja and cantidad_tickets is not null and cantidad_tickets >= 0)
  )
);

create index if not exists rangos_cuadrilla_fecha_idx
  on public.rangos_cuadrilla(fecha);

alter table public.rangos_cuadrilla enable row level security;

drop policy if exists rangos_cuadrilla_lectura_autenticada on public.rangos_cuadrilla;
create policy rangos_cuadrilla_lectura_autenticada on public.rangos_cuadrilla
for select to authenticated using (public.mi_rol() is not null);

drop policy if exists rangos_cuadrilla_escritura_coordinadores on public.rangos_cuadrilla;
create policy rangos_cuadrilla_escritura_coordinadores on public.rangos_cuadrilla
for all to authenticated using (public.mi_rol() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'))
with check (public.mi_rol() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));

grant select, insert, update, delete on public.rangos_cuadrilla to authenticated;

drop trigger if exists rangos_cuadrilla_set_updated_at on public.rangos_cuadrilla;
create trigger rangos_cuadrilla_set_updated_at before update on public.rangos_cuadrilla
for each row execute function public.set_updated_at();
