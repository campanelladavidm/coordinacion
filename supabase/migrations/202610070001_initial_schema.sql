-- Esquema inicial para Coordinaciones WN. Aplicar en un proyecto Supabase nuevo.
create extension if not exists pgcrypto;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo in ('COORDINADOR', 'SUPERVISOR', 'JEFE')),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

-- El id del perfil coincide con auth.users.id; Auth administra la identidad.
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text,
  rol_id uuid not null references public.roles(id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tercerizadas (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  activo boolean not null default true, orden integer not null default 0, created_at timestamptz not null default now()
);
create table public.zonas (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  activo boolean not null default true, orden integer not null default 0, created_at timestamptz not null default now()
);
create table public.cuadrillas (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  tercerizada_id uuid references public.tercerizadas(id) on delete set null,
  zona_id uuid references public.zonas(id) on delete set null,
  activo boolean not null default true, orden integer not null default 0, created_at timestamptz not null default now()
);
create table public.tecnologias (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  activo boolean not null default true, orden integer not null default 0, created_at timestamptz not null default now()
);
create table public.categorias (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  activo boolean not null default true, orden integer not null default 0, created_at timestamptz not null default now()
);
create table public.horarios (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  activo boolean not null default true, orden integer not null default 0, created_at timestamptz not null default now()
);
create table public.estados (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  activo boolean not null default true, orden integer not null default 0, created_at timestamptz not null default now()
);
create table public.extras (
  id uuid primary key default gen_random_uuid(), nombre text not null unique,
  activo boolean not null default true, orden integer not null default 0, created_at timestamptz not null default now()
);

create table public.coordinaciones (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  ticket text not null,
  cliente text not null,
  tercerizada_id uuid references public.tercerizadas(id) on delete set null,
  cuadrilla_id uuid references public.cuadrillas(id) on delete set null,
  horario_id uuid references public.horarios(id) on delete set null,
  tecnologia_id uuid not null references public.tecnologias(id) on delete restrict,
  categoria_id uuid not null references public.categorias(id) on delete restrict,
  observaciones text,
  zona_id uuid references public.zonas(id) on delete set null,
  estado_id uuid not null references public.estados(id) on delete restrict,
  creado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coordinaciones_fecha_idx on public.coordinaciones(fecha);
create index coordinaciones_tercerizada_cuadrilla_idx on public.coordinaciones(tercerizada_id, cuadrilla_id);
create index coordinaciones_ticket_idx on public.coordinaciones(ticket);

create table public.coordinacion_extras (
  coordinacion_id uuid not null references public.coordinaciones(id) on delete cascade,
  extra_id uuid not null references public.extras(id) on delete restrict,
  primary key (coordinacion_id, extra_id)
);

create table public.custodias (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo text not null check (tipo in ('CUSTODIA', 'POLICIA')),
  cuadrilla_id uuid not null references public.cuadrillas(id) on delete restrict,
  horario_retiro_id uuid not null references public.horarios(id) on delete restrict,
  observaciones text,
  creado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);
create index custodias_fecha_idx on public.custodias(fecha);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger usuarios_set_updated_at before update on public.usuarios for each row execute function public.set_updated_at();
create trigger coordinaciones_set_updated_at before update on public.coordinaciones for each row execute function public.set_updated_at();

insert into public.roles (codigo, nombre) values
  ('COORDINADOR', 'Coordinador'), ('SUPERVISOR', 'Supervisor'), ('JEFE', 'Jefe');
insert into public.tercerizadas (nombre, orden) values
  ('Atinet', 10), ('Elio Cogo', 20), ('Ipnet', 30), ('Ciro Martinez', 40),
  ('Bronet', 50), ('AyR', 60), ('Galuminet', 70), ('Artec', 80);
insert into public.tecnologias (nombre, orden) values ('Fibra', 10), ('Wireless', 20);
insert into public.categorias (nombre, orden) values
  ('Instalaciones Fibra', 10), ('Instalaciones BP', 20), ('Instalaciones Programadas', 30),
  ('Instalaciones Wireless', 40), ('Garantía Critica', 50), ('Garantía NO Critica', 60),
  ('Cambio de tecnologia', 70), ('Traslado Externo', 80), ('Traslado Programado', 90),
  ('Anti-Baja Retención', 100), ('Instalaciones Extensible', 110),
  ('Instalaciones Fibra + IPTV', 120), ('Instalaciones Wireless + IPTV', 130),
  ('IPTV In Situ', 140), ('Instalaciones Home Max', 150), ('Instalaciones Gamer', 160),
  ('Instalaciones Home Max Económico', 170);
insert into public.horarios (nombre, orden) values
  ('Mañana (9 a 13)', 10), ('Tarde (13 a 18)', 20), ('Todo el día', 30), ('Particular', 40);
insert into public.estados (nombre, orden) values
  ('Contactado', 10), ('Confirmado', 20), ('Cancelado', 30), ('Rechazado', 40), ('Espera', 50);
insert into public.extras (nombre, orden) values
  ('Enojado', 10), ('Recoordinado', 20), ('Urgente', 30), ('Zonda', 40), ('Lluvia', 50),
  ('Huawei', 60), ('Policía', 70), ('Custodia', 80);

-- Función SECURITY DEFINER para consultar el rol sin recursión entre políticas RLS.
create function public.mi_rol() returns text
language sql stable security definer set search_path = '' as $$
  select r.codigo from public.usuarios u join public.roles r on r.id = u.rol_id
  where u.id = (select auth.uid()) and u.activo = true limit 1;
$$;
revoke all on function public.mi_rol() from public;
grant execute on function public.mi_rol() to authenticated;

alter table public.roles enable row level security;
alter table public.usuarios enable row level security;
alter table public.tercerizadas enable row level security;
alter table public.cuadrillas enable row level security;
alter table public.tecnologias enable row level security;
alter table public.categorias enable row level security;
alter table public.horarios enable row level security;
alter table public.zonas enable row level security;
alter table public.estados enable row level security;
alter table public.extras enable row level security;
alter table public.coordinaciones enable row level security;
alter table public.coordinacion_extras enable row level security;
alter table public.custodias enable row level security;

create policy "roles visibles para usuarios autenticados" on public.roles for select to authenticated using (public.mi_rol() is not null);
create policy "perfil propio o administración jefe" on public.usuarios for select to authenticated using (id = (select auth.uid()) or public.mi_rol() = 'JEFE');
create policy "jefe administra perfiles" on public.usuarios for all to authenticated using (public.mi_rol() = 'JEFE') with check (public.mi_rol() = 'JEFE');

do $$
declare tabla text;
begin
  foreach tabla in array array['tercerizadas','cuadrillas','tecnologias','categorias','horarios','zonas','estados','extras'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.mi_rol() is not null)', tabla || '_lectura_autenticada', tabla);
    execute format('create policy %I on public.%I for all to authenticated using (public.mi_rol() in (''SUPERVISOR'',''JEFE'')) with check (public.mi_rol() in (''SUPERVISOR'',''JEFE''))', tabla || '_escritura_supervisor', tabla);
  end loop;
end $$;

create policy "coordinaciones lectura autenticada" on public.coordinaciones for select to authenticated using (public.mi_rol() is not null);
create policy "coordinadores administran coordinaciones" on public.coordinaciones for all to authenticated using (public.mi_rol() in ('COORDINADOR','SUPERVISOR','JEFE')) with check (public.mi_rol() in ('COORDINADOR','SUPERVISOR','JEFE'));
create policy "extras de coordinacion lectura autenticada" on public.coordinacion_extras for select to authenticated using (public.mi_rol() is not null);
create policy "coordinadores administran extras de coordinacion" on public.coordinacion_extras for all to authenticated using (public.mi_rol() in ('COORDINADOR','SUPERVISOR','JEFE')) with check (public.mi_rol() in ('COORDINADOR','SUPERVISOR','JEFE'));
create policy "custodias lectura autenticada" on public.custodias for select to authenticated using (public.mi_rol() is not null);
create policy "coordinadores administran custodias" on public.custodias for all to authenticated using (public.mi_rol() in ('COORDINADOR','SUPERVISOR','JEFE')) with check (public.mi_rol() in ('COORDINADOR','SUPERVISOR','JEFE'));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.roles, public.usuarios, public.tercerizadas, public.cuadrillas,
  public.tecnologias, public.categorias, public.horarios, public.zonas, public.estados, public.extras,
  public.coordinaciones, public.coordinacion_extras, public.custodias to authenticated;
