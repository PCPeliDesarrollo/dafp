-- Replace true conditions with auth.uid() IS NOT NULL for write policies
DROP POLICY IF EXISTS "Authenticated can insert ventas" ON public.ventas;
DROP POLICY IF EXISTS "Authenticated can update ventas" ON public.ventas;
DROP POLICY IF EXISTS "Authenticated can delete ventas" ON public.ventas;
CREATE POLICY "Authenticated can insert ventas" ON public.ventas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update ventas" ON public.ventas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete ventas" ON public.ventas
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can insert gastos" ON public.gastos;
DROP POLICY IF EXISTS "Authenticated can update gastos" ON public.gastos;
DROP POLICY IF EXISTS "Authenticated can delete gastos" ON public.gastos;
CREATE POLICY "Authenticated can insert gastos" ON public.gastos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update gastos" ON public.gastos
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete gastos" ON public.gastos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);