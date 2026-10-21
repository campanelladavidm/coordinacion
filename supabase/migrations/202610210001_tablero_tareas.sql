create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 140),
  descripcion text not null default '' check (char_length(descripcion) <= 4000),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'EN_CURSO', 'EN_REVISION', 'RESUELTA')),
  prioridad text not null default 'MEDIA' check (prioridad in ('BAJA', 'MEDIA', 'ALTA')),
  asignado_a uuid references public.usuarios(id) on delete set null,
  creado_por uuid not null references public.usuarios(id) on delete restrict,
  fecha_limite date,
  resuelta_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tareas_checklist (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 240),
  completado boolean not null default false,
  creado_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.tareas_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  autor_id uuid not null references public.usuarios(id) on delete restrict,
  texto text not null check (char_length(texto) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists tareas_estado_updated_idx on public.tareas (estado, updated_at desc);
create index if not exists tareas_asignado_idx on public.tareas (asignado_a, estado);
create index if not exists tareas_checklist_tarea_idx on public.tareas_checklist (tarea_id, created_at);
create index if not exists tareas_comentarios_tarea_idx on public.tareas_comentarios (tarea_id, created_at);

alter table public.tareas enable row level security;
alter table public.tareas_checklist enable row level security;
alter table public.tareas_comentarios enable row level security;

-- Todas las lecturas y escrituras pasan por los Route Handlers autenticados.
-- Las claves de service role nunca se exponen al navegador.
revoke all on public.tareas, public.tareas_checklist, public.tareas_comentarios from anon, authenticated;
grant all on public.tareas, public.tareas_checklist, public.tareas_comentarios to service_role;
