alter table public.liquidaciones
add column if not exists informacion_adicional text not null default '';
