alter table public.avisos drop constraint if exists avisos_texto_check;
alter table public.avisos
  add constraint avisos_texto_check check (length(btrim(texto)) between 1 and 200);
