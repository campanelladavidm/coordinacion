alter table public.notas_equipo
  add column if not exists titulo text not null default 'Publicacion',
  add column if not exists area_interesada text not null default 'General',
  add column if not exists imagen_url text;

create index if not exists notas_equipo_created_at_idx on public.notas_equipo(created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicaciones-equipo', 'publicaciones-equipo', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
