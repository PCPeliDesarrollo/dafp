CREATE TABLE public.alqu_facturas_luz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  monto_total numeric NOT NULL CHECK (monto_total > 0),
  kwh_totales numeric NOT NULL CHECK (kwh_totales > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anio, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alqu_facturas_luz TO authenticated;
GRANT ALL ON public.alqu_facturas_luz TO service_role;
ALTER TABLE public.alqu_facturas_luz ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superusuario gestiona facturas luz" ON public.alqu_facturas_luz
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'angeleschavessamino0@gmail.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'angeleschavessamino0@gmail.com');