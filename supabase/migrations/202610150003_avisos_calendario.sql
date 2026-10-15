create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (length(btrim(texto)) between 1 and 200),
  desde date not null,
  hasta date not null check (hasta >= desde),
  creado_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists avisos_vigencia_idx on public.avisos(desde, hasta);

create table if not exists public.aviso_destinatarios (
  aviso_id uuid not null references public.avisos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  primary key (aviso_id, usuario_id)
);

create index if not exists aviso_destinatarios_usuario_idx on public.aviso_destinatarios(usuario_id, aviso_id);

create table if not exists public.avisos_cerrados (
  aviso_id uuid not null references public.avisos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  cerrado_at timestamptz not null default now(),
  primary key (aviso_id, usuario_id)
);

alter table public.avisos enable row level security;
alter table public.aviso_destinatarios enable row level security;
alter table public.avisos_cerrados enable row level security;

grant select, insert, update, delete on public.avisos, public.aviso_destinatarios, public.avisos_cerrados to authenticated;

-- Los avisos se consultan y administran desde el servidor con la clave secreta de Supabase.
-- No se habilitan políticas para el cliente autenticado.
