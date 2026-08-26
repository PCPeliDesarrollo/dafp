ALTER TABLE public.cierres_mensuales
DROP CONSTRAINT cierres_mensuales_fuente_check;

ALTER TABLE public.cierres_mensuales
ADD CONSTRAINT cierres_mensuales_fuente_check
CHECK (fuente IN (
  'banco',
  'efectivo',
  'bruto:A',
  'bruto:T',
  'bruto:C',
  'bruto:S',
  'neto:A',
  'neto:T',
  'neto:C',
  'neto:S'
));