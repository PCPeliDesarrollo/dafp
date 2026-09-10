ALTER TABLE public.alqu_cobros_mensuales
  ADD COLUMN IF NOT EXISTS notas text,
  ADD COLUMN IF NOT EXISTS importe_alquiler numeric NOT NULL DEFAULT 0;