create table if not exists public.pendientes_diarios (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  categoria text not null check (categoria in (
    'instalaciones_fibra',
    'instalaciones_wireless',
    'instalaciones_iptv',
    'iptv_insitu',
    'cambio_tecnologia',
    'anti_baja_retencion',
    'traslado_externo',
    'gamer',
    'home_max',
    'garantias_criticas',
    'garantias_no_criticas'
  )),
  cantidad integer not null default 0 check (cantidad >= 0),
  creado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fecha, categoria)
);

create index if not exists pendientes_diarios_fecha_idx on public.pendientes_diarios (fecha desc);

alter table public.pendientes_diarios enable row level security;
