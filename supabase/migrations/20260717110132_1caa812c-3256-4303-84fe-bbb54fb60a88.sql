UPDATE public.ventas
SET beneficio = 0,
    updated_at = now()
WHERE beneficio <> 0;