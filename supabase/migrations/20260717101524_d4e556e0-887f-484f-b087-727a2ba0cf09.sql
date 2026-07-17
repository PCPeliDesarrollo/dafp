ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS pvp numeric,
  ADD COLUMN IF NOT EXISTS pvd numeric,
  ADD COLUMN IF NOT EXISTS entrega numeric,
  ADD COLUMN IF NOT EXISTS metodo_pago text NOT NULL DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS raw_text text;