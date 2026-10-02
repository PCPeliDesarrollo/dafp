CREATE TABLE public.aportaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  fecha date NOT NULL DEFAULT (now())::date,
  monto numeric NOT NULL DEFAULT 0,
  concepto text NOT NULL DEFAULT '',
  fuente text NOT NULL DEFAULT 'efectivo',
  devuelta boolean NOT NULL DEFAULT false,
  fecha_devolucion date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aportaciones TO authenticated;
GRANT ALL ON public.aportaciones TO service_role;
ALTER TABLE public.aportaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superusers manage aportaciones select" ON public.aportaciones FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers manage aportaciones insert" ON public.aportaciones FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers manage aportaciones update" ON public.aportaciones FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'superuser')) WITH CHECK (public.has_role(auth.uid(), 'superuser'));
CREATE POLICY "Superusers manage aportaciones delete" ON public.aportaciones FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'superuser'));
CREATE TRIGGER update_aportaciones_updated_at BEFORE UPDATE ON public.aportaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();