alter table public.cuadrillas
  add column if not exists producto_fibra boolean not null default false,
  add column if not exists producto_wireless boolean not null default false,
  add column if not exists producto_fibra_iptv boolean not null default false,
  add column if not exists producto_wireless_iptv boolean not null default false,
  add column if not exists producto_insitu boolean not null default false,
  add column if not exists producto_gamer boolean not null default false,
  add column if not exists producto_home_max boolean not null default false;
