
CREATE TABLE public.gastos (
  id text NOT NULL PRIMARY KEY,
  fecha date NOT NULL DEFAULT (now()::date),
  monto numeric NOT NULL DEFAULT 0,
  concepto text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'tienda',
  fuente text NOT NULL DEFAULT 'efectivo',
  referencia text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos TO anon, authenticated;
GRANT ALL ON public.gastos TO service_role;

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gastos son públicos para lectura" ON public.gastos FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede insertar gastos" ON public.gastos FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar gastos" ON public.gastos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Cualquiera puede borrar gastos" ON public.gastos FOR DELETE USING (true);

CREATE TRIGGER update_gastos_updated_at
BEFORE UPDATE ON public.gastos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
