
CREATE TABLE public.ventas (
  id TEXT PRIMARY KEY,
  fecha DATE NOT NULL,
  empleado TEXT NOT NULL,
  total_venta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  beneficio NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ventas_fecha_idx ON public.ventas (fecha);
CREATE INDEX ventas_empleado_idx ON public.ventas (empleado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas TO authenticated;
GRANT ALL ON public.ventas TO service_role;

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ventas son públicas para lectura"
  ON public.ventas FOR SELECT
  USING (true);

CREATE POLICY "Cualquiera puede insertar ventas"
  ON public.ventas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Cualquiera puede actualizar ventas"
  ON public.ventas FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Cualquiera puede borrar ventas"
  ON public.ventas FOR DELETE
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ventas_updated_at
BEFORE UPDATE ON public.ventas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ventas;
