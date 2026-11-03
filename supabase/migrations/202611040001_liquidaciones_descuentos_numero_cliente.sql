alter table public.liquidaciones_descuentos
  add column if not exists numero_cliente text not null default ''
  check (char_length(numero_cliente) <= 80);
