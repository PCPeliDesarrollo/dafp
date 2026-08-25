CREATE TABLE public.cierres_mensuales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa text NOT NULL,
  anio integer NOT NULL,
  mes integer NOT NULL,
  fuente text NOT NULL,
  codigo text,
  monto numeric NOT NULL DEFAULT 0,
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cierres_mensuales_empresa_check CHECK (empresa IN ('fjv','pcp')),
  CONSTRAINT cierres_mensuales_fuente_check CHECK (fuente IN ('banco','efectivo')),
  CONSTRAINT cierres_mensuales_mes_check CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT cierres_mensuales_unico UNIQUE (empresa, anio, mes, fuente)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cierres_mensuales TO authenticated;
GRANT ALL ON public.cierres_mensuales TO service_role;

ALTER TABLE public.cierres_mensuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cierres" ON public.cierres_mensuales FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert cierres" ON public.cierres_mensuales FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update cierres" ON public.cierres_mensuales FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete cierres" ON public.cierres_mensuales FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_cierres_mensuales_updated_at BEFORE UPDATE ON public.cierres_mensuales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();