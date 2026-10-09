-- Datos de catalogo y tablas compartidas para Coordinaciones WN.
-- Migracion aditiva: conserva las tablas y los datos de la migracion inicial.

insert into public.zonas (nombre, orden) values
  ('Perdriel', 10), ('Ugarteche', 20), ('Agrelo', 30), ('Castrol', 40),
  ('Las Compuertas', 50), ('Gloria', 60), ('Russel', 70), ('Coquimbito', 80),
  ('Lunlunta', 90), ('San Francisco', 100), ('Rodeo de la Cruz', 110),
  ('Rodeo del Medio', 120), ('Km8', 130), ('Fray Luis', 140), ('Bombal', 150),
  ('Primavera', 160), ('Puente de Hierro', 170), ('Segovia', 180), ('Bermejo', 190),
  ('Lihue', 200), ('Las Heras', 210), ('Las Heras Yapeyu', 220), ('Las Heras Espejo', 230),
  ('Santa Teresita', 240), ('Favorita', 250), ('Challao', 260), ('Lavalle', 270),
  ('La Pega', 280), ('Costa Araujo', 290), ('Gustavo André', 300), ('Jocoli Viejo', 310),
  ('Jocoli', 320), ('Sauce', 330), ('Plumerillo', 340), ('Borbollón', 350),
  ('Corralitos', 360), ('Cruz de Piedra', 370), ('Godoy Cruz', 380), ('San José', 390),
  ('Dorrego', 400), ('Decimo', 410), ('Mendoza Norte', 420), ('Puerto Bizantino', 430)
on conflict (nombre) do update set activo = true, orden = excluded.orden;

insert into public.cuadrillas (nombre, tercerizada_id, orden)
select seed.nombre, empresa.id, seed.orden
from (values
  ('Pablo Vigon', 'Atinet', 10), ('Lautaro Biginay', 'Atinet', 20),
  ('Ricardo Tarifa', 'Atinet', 30), ('Ezequiel Funes', 'Atinet', 40),
  ('Jorge Huanca', 'Atinet', 50), ('Fernando Alcazar', 'Atinet', 60),
  ('David Gaspar', 'Atinet', 70), ('Matias Guzman', 'Atinet', 80),
  ('Marcelo Chiarello', 'Atinet', 90), ('Gonzalo Catacata', 'Atinet', 100),
  ('Julio Castro', 'Atinet', 110),
  ('Walter Zarate', 'Elio Cogo', 10), ('Elio Cogo', 'Elio Cogo', 20),
  ('Daniel Zarate', 'Elio Cogo', 30), ('Nahuel Mora', 'Elio Cogo', 40),
  ('Diego Campos', 'Elio Cogo', 50),
  ('Fernando Araya', 'Ipnet', 10), ('Gabriel Bringas', 'Ipnet', 20),
  ('Ciro Martinez', 'Ciro Martinez', 10),
  ('Ricardo Cortez', 'Bronet', 10), ('Matias Principe', 'Bronet', 20),
  ('Emiliano Vallejos', 'AyR', 10), ('Brian Vallejos', 'AyR', 20),
  ('Enzo Campillay', 'AyR', 30),
  ('Luis Carcamo', 'Galuminet', 10), ('Daniel Arangue', 'Artec', 10)
) as seed(nombre, tercerizada, orden)
join public.tercerizadas as empresa on empresa.nombre = seed.tercerizada
on conflict (nombre) do update
set tercerizada_id = excluded.tercerizada_id, activo = true, orden = excluded.orden;

-- El formulario de custodias permite escribir libremente el horario de retiro.
-- Se conserva el FK anterior como nullable para no perder datos historicos.
alter table public.custodias add column if not exists horario_retiro text;
update public.custodias as c
set horario_retiro = h.nombre
from public.horarios as h
where c.horario_retiro_id = h.id and c.horario_retiro is null;
update public.custodias set horario_retiro = 'Sin horario especificado' where horario_retiro is null or btrim(horario_retiro) = '';
alter table public.custodias alter column horario_retiro set not null;
alter table public.custodias alter column horario_retiro_id drop not null;

create table if not exists public.personal_interno (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.feriados (
  fecha date primary key,
  es_feriado boolean not null default false,
  creado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feriado_personal (
  fecha date not null references public.feriados(fecha) on delete cascade,
  personal_id uuid not null references public.personal_interno(id) on delete restrict,
  orden integer not null default 0,
  primary key (fecha, personal_id)
);

create table if not exists public.notas_equipo (
  id uuid primary key default gen_random_uuid(),
  comentario text not null check (length(btrim(comentario)) > 0),
  creado_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists notas_equipo_created_at_idx on public.notas_equipo(created_at desc);

create trigger feriados_set_updated_at before update on public.feriados
for each row execute function public.set_updated_at();

-- Cada usuario Auth recibe un perfil Coordinador por defecto.
create or replace function public.crear_perfil_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rol_coordinador uuid;
begin
  select id into rol_coordinador from public.roles where codigo = 'COORDINADOR' limit 1;
  if rol_coordinador is null then
    raise exception 'No existe el rol COORDINADOR.';
  end if;
  insert into public.usuarios (id, nombre_completo, rol_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre_completo', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    rol_coordinador
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.crear_perfil_usuario_auth() from public, anon, authenticated;
drop trigger if exists crear_perfil_usuario_auth on auth.users;
create trigger crear_perfil_usuario_auth
after insert on auth.users
for each row execute function public.crear_perfil_usuario_auth();

-- Cubre cuentas Auth existentes antes de instalar el trigger.
insert into public.usuarios (id, nombre_completo, rol_id)
select au.id,
  coalesce(au.raw_user_meta_data ->> 'nombre_completo', au.raw_user_meta_data ->> 'name', split_part(coalesce(au.email, ''), '@', 1)),
  r.id
from auth.users au
cross join public.roles r
where r.codigo = 'COORDINADOR'
on conflict (id) do nothing;

drop policy if exists usuarios_lectura_nombres_autenticada on public.usuarios;
create policy usuarios_lectura_nombres_autenticada on public.usuarios
for select to authenticated using (public.mi_rol() is not null);

alter table public.personal_interno enable row level security;
alter table public.feriados enable row level security;
alter table public.feriado_personal enable row level security;
alter table public.notas_equipo enable row level security;

drop policy if exists personal_interno_lectura_autenticada on public.personal_interno;
create policy personal_interno_lectura_autenticada on public.personal_interno
for select to authenticated using (public.mi_rol() is not null);
drop policy if exists personal_interno_escritura_supervisor on public.personal_interno;
create policy personal_interno_escritura_supervisor on public.personal_interno
for all to authenticated using (public.mi_rol() in ('SUPERVISOR', 'JEFE'))
with check (public.mi_rol() in ('SUPERVISOR', 'JEFE'));

drop policy if exists feriados_lectura_autenticada on public.feriados;
create policy feriados_lectura_autenticada on public.feriados
for select to authenticated using (public.mi_rol() is not null);
drop policy if exists feriados_escritura_supervisor on public.feriados;
create policy feriados_escritura_supervisor on public.feriados
for all to authenticated using (public.mi_rol() in ('SUPERVISOR', 'JEFE'))
with check (public.mi_rol() in ('SUPERVISOR', 'JEFE'));

drop policy if exists feriado_personal_lectura_autenticada on public.feriado_personal;
create policy feriado_personal_lectura_autenticada on public.feriado_personal
for select to authenticated using (public.mi_rol() is not null);
drop policy if exists feriado_personal_escritura_supervisor on public.feriado_personal;
create policy feriado_personal_escritura_supervisor on public.feriado_personal
for all to authenticated using (public.mi_rol() in ('SUPERVISOR', 'JEFE'))
with check (public.mi_rol() in ('SUPERVISOR', 'JEFE'));

drop policy if exists notas_equipo_lectura_autenticada on public.notas_equipo;
create policy notas_equipo_lectura_autenticada on public.notas_equipo
for select to authenticated using (public.mi_rol() is not null);
drop policy if exists notas_equipo_creacion_autenticada on public.notas_equipo;
create policy notas_equipo_creacion_autenticada on public.notas_equipo
for insert to authenticated with check (creado_por = (select auth.uid()) and public.mi_rol() is not null);
drop policy if exists notas_equipo_eliminar_propia_o_supervisor on public.notas_equipo;
create policy notas_equipo_eliminar_propia_o_supervisor on public.notas_equipo
for delete to authenticated using (creado_por = (select auth.uid()) or public.mi_rol() in ('SUPERVISOR', 'JEFE'));

grant select, insert, update, delete on public.personal_interno, public.feriados, public.feriado_personal, public.notas_equipo to authenticated;
