CREATE TABLE public.ventas_pcp (
  id text NOT NULL PRIMARY KEY,
  fecha date NOT NULL,
  empleado text NOT NULL,
  total_venta numeric NOT NULL DEFAULT 0,
  beneficio numeric NOT NULL DEFAULT 0,
  pvp numeric,
  pvd numeric,
  entrega numeric,
  metodo_pago text NOT NULL DEFAULT 'efectivo',
  raw_text text,
  efectivo_amount numeric,
  tpv_amount numeric,
  banco_amount numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas_pcp TO authenticated;
GRANT ALL ON public.ventas_pcp TO service_role;

ALTER TABLE public.ventas_pcp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ventas_pcp" ON public.ventas_pcp FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert ventas_pcp" ON public.ventas_pcp FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update ventas_pcp" ON public.ventas_pcp FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete ventas_pcp" ON public.ventas_pcp FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_ventas_pcp_updated_at BEFORE UPDATE ON public.ventas_pcp FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.gastos_pcp (
  id text NOT NULL PRIMARY KEY,
  fecha date NOT NULL DEFAULT (now())::date,
  monto numeric NOT NULL DEFAULT 0,
  concepto text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'tienda',
  fuente text NOT NULL DEFAULT 'efectivo',
  referencia text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos_pcp TO authenticated;
GRANT ALL ON public.gastos_pcp TO service_role;

ALTER TABLE public.gastos_pcp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read gastos_pcp" ON public.gastos_pcp FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert gastos_pcp" ON public.gastos_pcp FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update gastos_pcp" ON public.gastos_pcp FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete gastos_pcp" ON public.gastos_pcp FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_gastos_pcp_updated_at BEFORE UPDATE ON public.gastos_pcp FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();