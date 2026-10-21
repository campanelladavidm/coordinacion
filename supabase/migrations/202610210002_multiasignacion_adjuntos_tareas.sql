-- Evoluciona el tablero a tres columnas y mantiene las asignaciones previas.
create table if not exists public.tareas_asignados (
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  asignado_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tarea_id, usuario_id)
);

insert into public.tareas_asignados (tarea_id, usuario_id, asignado_por)
select id, asignado_a, creado_por from public.tareas where asignado_a is not null
on conflict (tarea_id, usuario_id) do nothing;

alter table public.tareas drop constraint if exists tareas_estado_check;
update public.tareas set estado = 'EN_CURSO' where estado = 'EN_REVISION';
update public.tareas set estado = 'FINALIZADA' where estado = 'RESUELTA';
alter table public.tareas add constraint tareas_estado_check check (estado in ('PENDIENTE', 'EN_CURSO', 'FINALIZADA'));
drop index if exists public.tareas_asignado_idx;
alter table public.tareas drop column if exists asignado_a;
create index if not exists tareas_asignados_usuario_idx on public.tareas_asignados (usuario_id, tarea_id);

create table if not exists public.tareas_archivos (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  storage_path text not null unique,
  nombre_archivo text not null check (char_length(nombre_archivo) between 1 and 240),
  mime_type text not null,
  tamano_bytes bigint not null check (tamano_bytes > 0 and tamano_bytes <= 10485760),
  subido_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists tareas_archivos_tarea_idx on public.tareas_archivos (tarea_id, created_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tareas-archivos', 'tareas-archivos', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.tareas_asignados enable row level security;
alter table public.tareas_archivos enable row level security;
revoke all on public.tareas_asignados, public.tareas_archivos from anon, authenticated;
grant all on public.tareas_asignados, public.tareas_archivos to service_role;
