alter table public.liquidaciones
  add column if not exists descuentos_equipos jsonb not null default '[]'::jsonb;

comment on column public.liquidaciones.descuentos_equipos is
  'Descuentos por equipos asociados a la liquidación, con modelo y precio unitario históricos.';
