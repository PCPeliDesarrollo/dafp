GRANT SELECT, INSERT, UPDATE, DELETE ON public.alqu_inquilinos TO authenticated;
GRANT ALL ON public.alqu_inquilinos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alqu_cobros_mensuales TO authenticated;
GRANT ALL ON public.alqu_cobros_mensuales TO service_role;