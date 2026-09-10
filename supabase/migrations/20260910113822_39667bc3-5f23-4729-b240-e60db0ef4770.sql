CREATE TYPE public.alqu_frecuencia AS ENUM ('Mensual', 'Trimestral', 'Bimestral');
CREATE TYPE public.alqu_estado_basura AS ENUM ('Cobrado este trimestre', 'No corresponde pagar', 'Pendiente de cobro');
CREATE TYPE public.alqu_estado_pago AS ENUM ('Pendiente', 'Cobrado');

CREATE TABLE public.alqu_inquilinos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inquilino text NOT NULL,
  direccion text NOT NULL DEFAULT '',
  importe_alquiler numeric NOT NULL DEFAULT 0,
  importe_basura numeric NOT NULL DEFAULT 0,
  frecuencia_basura public.alqu_frecuencia NOT NULL DEFAULT 'Trimestral',
  iva numeric NOT NULL DEFAULT 21,
  precio_kw numeric(12,6) NOT NULL DEFAULT 0,
  minimo_luz numeric NOT NULL DEFAULT 10,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alqu_inquilinos TO authenticated;
GRANT ALL ON public.alqu_inquilinos TO service_role;
ALTER TABLE public.alqu_inquilinos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read alqu_inquilinos" ON public.alqu_inquilinos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert alqu_inquilinos" ON public.alqu_inquilinos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update alqu_inquilinos" ON public.alqu_inquilinos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete alqu_inquilinos" ON public.alqu_inquilinos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_alqu_inquilinos_updated_at BEFORE UPDATE ON public.alqu_inquilinos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.alqu_cobros_mensuales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inquilino_id uuid NOT NULL REFERENCES public.alqu_inquilinos(id) ON DELETE CASCADE,
  anio integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  trimestre integer GENERATED ALWAYS AS (((mes - 1) / 3) + 1) STORED,
  lectura_anterior numeric NOT NULL DEFAULT 0,
  lectura_actual numeric NOT NULL DEFAULT 0,
  kw_consumidos numeric NOT NULL DEFAULT 0,
  total_luz numeric NOT NULL DEFAULT 0,
  aplica_basura_mes boolean NOT NULL DEFAULT false,
  estado_basura_trimestre public.alqu_estado_basura NOT NULL DEFAULT 'Pendiente de cobro',
  importe_basura_cobrado numeric NOT NULL DEFAULT 0,
  importe_agua numeric NOT NULL DEFAULT 0,
  total_a_cobrar numeric NOT NULL DEFAULT 0,
  fecha_cobro date,
  quien_cobra text,
  estado_pago public.alqu_estado_pago NOT NULL DEFAULT 'Pendiente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inquilino_id, anio, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alqu_cobros_mensuales TO authenticated;
GRANT ALL ON public.alqu_cobros_mensuales TO service_role;
ALTER TABLE public.alqu_cobros_mensuales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read alqu_cobros" ON public.alqu_cobros_mensuales FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert alqu_cobros" ON public.alqu_cobros_mensuales FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update alqu_cobros" ON public.alqu_cobros_mensuales FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete alqu_cobros" ON public.alqu_cobros_mensuales FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_alqu_cobros_updated_at BEFORE UPDATE ON public.alqu_cobros_mensuales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX alqu_cobros_periodo_idx ON public.alqu_cobros_mensuales (anio, mes);

INSERT INTO public.alqu_inquilinos (inquilino, direccion, importe_alquiler, importe_basura, frecuencia_basura, iva, precio_kw, minimo_luz, notas) VALUES
('RUBÉN (NUEVO OCTUBRE)', 'POZO CONCEJO BAJO', 230, 11, 'Trimestral', 21, 0.145922, 10, NULL),
('AGUSTIN', 'POZO CONCEJO ALTO', 250, 11, 'Trimestral', 21, 0.145922, 10, NULL),
('ALI ASIF', 'CALLE DERECHA 51 BAJO', 180, 11, 'Trimestral', 21, 0.125, 10, NULL),
('FARGALLO', 'CALLE DERECHA 51', 250, 11, 'Trimestral', 21, 0.125, 10, NULL),
('PAQUINO', 'CALLE SAN ANTON', 250, 22, 'Trimestral', 21, 0.17, 0, NULL),
('OTMAN', 'CALLE MANUEL FERRERA', 260, 22, 'Trimestral', 21, 0.17, 0, NULL),
('RUI MIGUEL', 'ALCABALAS APAR 2', 330, 22, 'Trimestral', 21, 0.2, 10, NULL),
('TELLI', 'ALCABALAS APAR 5', 330, 22, 'Trimestral', 21, 0.2, 10, NULL),
('SAMUEL', 'ALCABALAS APAR 7', 330, 22, 'Trimestral', 21, 0.2, 10, NULL),
('JOSE RABAZO', 'ALCABALAS APAR 1', 360, 22, 'Trimestral', 21, 0.2, 10, NULL),
('JOSE MARIA', 'ALCABALAS APAR 3', 330, 22, 'Trimestral', 21, 0.2, 10, '5266,05 PT'),
('LOLA', 'ALCABALAS APAR 4', 330, 22, 'Trimestral', 21, 0.2, 10, NULL),
('MANUEL', 'ALCABALAS APAR 6', 330, 22, 'Trimestral', 21, 0.2, 10, NULL);