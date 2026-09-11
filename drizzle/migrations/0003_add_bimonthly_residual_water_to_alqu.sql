ALTER TABLE public.alqu_inquilinos
  ADD COLUMN importe_agua_residual numeric NOT NULL DEFAULT 0;

ALTER TABLE public.alqu_cobros_mensuales
  ADD COLUMN aplica_agua_residual boolean NOT NULL DEFAULT false,
  ADD COLUMN importe_agua_residual_cobrado numeric NOT NULL DEFAULT 0;