ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS canje_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliente text;

ALTER TABLE public.ventas_pcp
  ADD COLUMN IF NOT EXISTS canje_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliente text;