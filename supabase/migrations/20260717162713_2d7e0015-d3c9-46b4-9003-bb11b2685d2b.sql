ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS efectivo_amount numeric,
  ADD COLUMN IF NOT EXISTS tpv_amount numeric,
  ADD COLUMN IF NOT EXISTS banco_amount numeric;