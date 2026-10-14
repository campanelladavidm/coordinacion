-- Novedades laborales creadas por cada usuario y revisión individual de Jefatura.
create table if not exists public.novedades (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  motivo text not null check (length(btrim(motivo)) between 1 and 80),
  descripcion text not null check (length(btrim(descripcion)) between 1 and 2000),
  tiempo_devuelto boolean not null default false,
  detalle_devolucion text,
  creado_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint novedades_detalle_devolucion_check check (
    (tiempo_devuelto and detalle_devolucion is not null and length(btrim(detalle_devolucion)) between 1 and 300)
    or (not tiempo_devuelto and detalle_devolucion is null)
  )
);

create index if not exists novedades_fecha_created_at_idx on public.novedades(fecha desc, created_at desc);
create index if not exists novedades_creado_por_fecha_idx on public.novedades(creado_por, fecha desc);

create table if not exists public.novedades_vistas (
  novedad_id uuid not null references public.novedades(id) on delete cascade,
  jefe_id uuid not null references public.usuarios(id) on delete cascade,
  revisado_at timestamptz not null default now(),
  primary key (novedad_id, jefe_id)
);

alter table public.novedades enable row level security;
alter table public.novedades_vistas enable row level security;
revoke all on public.novedades, public.novedades_vistas from anon, authenticated;
grant all on public.novedades, public.novedades_vistas to service_role;
