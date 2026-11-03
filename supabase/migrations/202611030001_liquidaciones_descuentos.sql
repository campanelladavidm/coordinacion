create table if not exists public.liquidaciones_descuentos (
  id uuid primary key default gen_random_uuid(),
  mes smallint not null check (mes between 1 and 12),
  anio smallint not null check (anio between 2000 and 2200),
  ticket text not null default '' check (char_length(ticket) <= 80),
  realiza_id uuid references public.tercerizadas(id) on delete restrict,
  pertenece_id uuid references public.tercerizadas(id) on delete restrict,
  motivo text not null default '' check (char_length(motivo) <= 1500),
  creado_por uuid not null references auth.users(id),
  actualizado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists liquidaciones_descuentos_periodo_idx
  on public.liquidaciones_descuentos(anio, mes, created_at, id);

alter table public.liquidaciones_descuentos enable row level security;

drop policy if exists liquidaciones_descuentos_lectura_supervision on public.liquidaciones_descuentos;
create policy liquidaciones_descuentos_lectura_supervision
  on public.liquidaciones_descuentos
  for select to authenticated
  using (public.rol_efectivo() in ('SUPERVISOR', 'JEFE'));

grant select on public.liquidaciones_descuentos to authenticated;
