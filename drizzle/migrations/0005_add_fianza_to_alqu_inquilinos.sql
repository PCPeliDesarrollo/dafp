ALTER TABLE public.alqu_inquilinos
  ADD COLUMN paga_fianza boolean NOT NULL DEFAULT false,
  ADD COLUMN importe_fianza numeric NOT NULL DEFAULT 0;