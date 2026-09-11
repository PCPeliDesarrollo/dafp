CREATE UNIQUE INDEX IF NOT EXISTS alqu_cobros_inquilino_periodo_key
ON public.alqu_cobros_mensuales (inquilino_id, anio, mes);

DROP POLICY IF EXISTS "Authenticated can read alqu_inquilinos" ON public.alqu_inquilinos;
DROP POLICY IF EXISTS "Authenticated can insert alqu_inquilinos" ON public.alqu_inquilinos;
DROP POLICY IF EXISTS "Authenticated can update alqu_inquilinos" ON public.alqu_inquilinos;
DROP POLICY IF EXISTS "Authenticated can delete alqu_inquilinos" ON public.alqu_inquilinos;

CREATE POLICY "Superusers can read alqu_inquilinos"
ON public.alqu_inquilinos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers can insert alqu_inquilinos"
ON public.alqu_inquilinos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers can update alqu_inquilinos"
ON public.alqu_inquilinos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'superuser'))
WITH CHECK (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers can delete alqu_inquilinos"
ON public.alqu_inquilinos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'superuser'));

DROP POLICY IF EXISTS "Authenticated can read alqu_cobros" ON public.alqu_cobros_mensuales;
DROP POLICY IF EXISTS "Authenticated can insert alqu_cobros" ON public.alqu_cobros_mensuales;
DROP POLICY IF EXISTS "Authenticated can update alqu_cobros" ON public.alqu_cobros_mensuales;
DROP POLICY IF EXISTS "Authenticated can delete alqu_cobros" ON public.alqu_cobros_mensuales;

CREATE POLICY "Superusers can read alqu_cobros"
ON public.alqu_cobros_mensuales FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers can insert alqu_cobros"
ON public.alqu_cobros_mensuales FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers can update alqu_cobros"
ON public.alqu_cobros_mensuales FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'superuser'))
WITH CHECK (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers can delete alqu_cobros"
ON public.alqu_cobros_mensuales FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'superuser'));