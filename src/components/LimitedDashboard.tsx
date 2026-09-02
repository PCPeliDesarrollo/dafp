import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, Users } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { OcrPasteZone } from "./OcrPasteZone";
import { useDashboardVentas } from "@/lib/use-dashboard-ventas";
import { useVista } from "@/lib/empresa";

const eurP = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currentMonth = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Vista reducida para usuarios sin permisos de superusuario:
 * solo pueden subir albaranes y ver las ventas del equipo del mes en curso.
 */
export function LimitedDashboard() {
  const vista = useVista();
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardVentas(vista);
  const mes = currentMonth();

  const porEmpleado = useMemo(() => {
    const map = new Map<string, { total: number; beneficio: number }>();
    for (const r of data ?? []) {
      if ((r.fecha ?? "").slice(0, 7) !== mes) continue;
      if ((r.empleado ?? "").trim().toLowerCase() === "banco") continue;
      const cur = map.get(r.empleado) ?? { total: 0, beneficio: 0 };
      cur.total += r.total_venta;
      cur.beneficio += r.beneficio ?? 0;
      map.set(r.empleado, cur);
    }
    return Array.from(map.entries())
      .map(([empleado, v]) => ({ empleado, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [data, mes]);

  const mesLabel = new Date(`${mes}-01T00:00:00`).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Albaranes y ventas del equipo</h1>
          <p className="text-xs text-muted-foreground capitalize">{mesLabel}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSignOut}>
          <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
        </Button>
      </div>

      <OcrPasteZone />

      <Card className="gradient-card border-border/50 shadow-elevated">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-primary" />
            Ventas por empleado
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Este mes
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : porEmpleado.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Todavía no hay ventas registradas este mes.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porEmpleado} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barFillLimited" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="empleado"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    tickFormatter={(v: string) => v.split(" ")[0]}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    tickFormatter={(v) => num.format(v as number)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
                    formatter={(value: number, name) => [eurP.format(value), name]}
                  />
                  <Bar dataKey="total" name="Total vendido" fill="url(#barFillLimited)" radius={[8, 8, 4, 4]} maxBarSize={54} />
                  <Bar dataKey="beneficio" name="Beneficio" fill="var(--color-success)" radius={[8, 8, 4, 4]} maxBarSize={54} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {porEmpleado.map((e) => (
                  <div
                    key={e.empleado}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs"
                  >
                    <span className="truncate font-medium text-foreground">{e.empleado}</span>
                    <span className="flex flex-wrap items-baseline justify-end gap-3 tabular-nums">
                      <span>
                        <span className="mr-1 text-muted-foreground">Vendido</span>
                        <span className="font-semibold">{eurP.format(e.total)}</span>
                      </span>
                      <span>
                        <span className="mr-1 text-muted-foreground">Beneficio</span>
                        <span className="font-semibold text-success">{eurP.format(e.beneficio)}</span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
