create table if not exists public.liquidaciones (
  id uuid primary key default gen_random_uuid(),
  tercerizada_id uuid not null references public.tercerizadas(id) on delete restrict,
  mes smallint not null check (mes between 1 and 12),
  anio smallint not null check (anio between 2000 and 2200),
  estado text not null default 'BORRADOR' check (estado in ('BORRADOR', 'FINALIZADA')),
  conceptos jsonb not null default '[]'::jsonb check (jsonb_typeof(conceptos) = 'array'),
  creado_por uuid not null references auth.users(id),
  finalizado_por uuid references auth.users(id),
  finalizado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tercerizada_id, mes, anio)
);

create index if not exists liquidaciones_periodo_idx on public.liquidaciones(anio, mes);

create table if not exists public.liquidaciones_exportaciones (
  id uuid primary key default gen_random_uuid(),
  mes smallint not null check (mes between 1 and 12),
  anio smallint not null check (anio between 2000 and 2200),
  nombre_archivo text not null,
  storage_path text not null,
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (mes, anio)
);

alter table public.liquidaciones enable row level security;
alter table public.liquidaciones_exportaciones enable row level security;

drop policy if exists liquidaciones_lectura_autenticada on public.liquidaciones;
create policy liquidaciones_lectura_autenticada on public.liquidaciones
for select to authenticated using (public.rol_efectivo() is not null);

drop policy if exists liquidaciones_exportaciones_lectura_autenticada on public.liquidaciones_exportaciones;
create policy liquidaciones_exportaciones_lectura_autenticada on public.liquidaciones_exportaciones
for select to authenticated using (public.rol_efectivo() is not null);

grant select on public.liquidaciones, public.liquidaciones_exportaciones to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('liquidaciones', 'liquidaciones', false, 52428800, array['application/zip'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/zip'];
