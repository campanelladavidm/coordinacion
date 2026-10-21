-- Agrega la columna Materiales al tablero de tareas.
alter table public.tareas drop constraint if exists tareas_estado_check;
alter table public.tareas
  add constraint tareas_estado_check
  check (estado in ('PENDIENTE', 'EN_CURSO', 'FINALIZADA', 'MATERIALES'));
