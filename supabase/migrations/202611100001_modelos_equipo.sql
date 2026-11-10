create table public.modelos_equipo (
  id uuid primary key default gen_random_uuid(),
  modelo text not null check (char_length(trim(modelo)) between 1 and 120),
  precio_unitario numeric(14, 2) not null check (precio_unitario >= 0),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index modelos_equipo_modelo_activo_idx
  on public.modelos_equipo (lower(trim(modelo))) where activo = true;
create trigger modelos_equipo_set_updated_at
  before update on public.modelos_equipo
  for each row execute function public.set_updated_at();

alter table public.modelos_equipo enable row level security;
create policy modelos_equipo_lectura_autenticada on public.modelos_equipo
  for select to authenticated using (public.rol_efectivo() is not null);
create policy modelos_equipo_escritura_roles_aplicacion on public.modelos_equipo
  for all to authenticated
  using (public.rol_efectivo() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'))
  with check (public.rol_efectivo() in ('COORDINADOR', 'SUPERVISOR', 'JEFE'));
grant select, insert, update, delete on public.modelos_equipo to authenticated;
