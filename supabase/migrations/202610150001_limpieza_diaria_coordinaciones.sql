-- Elimina coordinaciones con más de siete días de antigüedad.
-- La fecha se calcula en hora argentina; corre todos los días a las 03:00 ART.
-- coordinacion_extras se elimina en cascada por su FK. No afecta rangos,
-- custodias, novedades, notas ni otros datos del sistema.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'limpieza-diaria-coordinaciones',
  '0 6 * * *',
  $$
    delete from public.coordinaciones
    where fecha < (
      (now() at time zone 'America/Argentina/Buenos_Aires')::date - 7
    )
  $$
);
