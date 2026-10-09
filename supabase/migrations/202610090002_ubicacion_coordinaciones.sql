alter table public.coordinaciones
  add column if not exists ubicacion text;

comment on column public.coordinaciones.ubicacion is
  'Ubicación normalizada para el caso: coordenadas, nombre de lugar o Place ID de Google Maps.';
