-- Lock down ventas and gastos to authenticated users only
DROP POLICY IF EXISTS "Ventas son públicas para lectura" ON public.ventas;
DROP POLICY IF EXISTS "Cualquiera puede insertar ventas" ON public.ventas;
DROP POLICY IF EXISTS "Cualquiera puede actualizar ventas" ON public.ventas;
DROP POLICY IF EXISTS "Cualquiera puede borrar ventas" ON public.ventas;

CREATE POLICY "Authenticated can read ventas" ON public.ventas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ventas" ON public.ventas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ventas" ON public.ventas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete ventas" ON public.ventas
  FOR DELETE TO authenticated USING (true);

REVOKE ALL ON public.ventas FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas TO authenticated;

DROP POLICY IF EXISTS "Gastos son públicos para lectura" ON public.gastos;
DROP POLICY IF EXISTS "Cualquiera puede insertar gastos" ON public.gastos;
DROP POLICY IF EXISTS "Cualquiera puede actualizar gastos" ON public.gastos;
DROP POLICY IF EXISTS "Cualquiera puede borrar gastos" ON public.gastos;

CREATE POLICY "Authenticated can read gastos" ON public.gastos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert gastos" ON public.gastos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update gastos" ON public.gastos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete gastos" ON public.gastos
  FOR DELETE TO authenticated USING (true);

REVOKE ALL ON public.gastos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos TO authenticated;