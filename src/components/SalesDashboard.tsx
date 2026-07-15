import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Euro,
  Percent,
  ReceiptText,
  TrendingUp,
  Trophy,
  Upload,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardVentas } from "@/lib/use-dashboard-ventas";
import { EMPLEADO_OBJETIVO_MENSUAL, type VentaRow } from "@/lib/dashboard-mock";
import { CsvImportDialog } from "./CsvImportDialog";
import { ventasStore } from "@/lib/ventas-store";

type RangoKey = "hoy" | "semana" | "mes" | "todo";

const RANGOS: { key: RangoKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "todo", label: "Todo" },
];

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurP = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 1,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isoDaysAgo(rows: VentaRow[]): { today: string; yesterday: string } {
  const dates = Array.from(new Set(rows.map((r) => r.fecha))).sort();
  return {
    today: dates[dates.length - 1] ?? "",
    yesterday: dates[dates.length - 2] ?? "",
  };
}

function filterByRange(rows: VentaRow[], rango: RangoKey) {
  if (!rows.length) return rows;
  const sortedDates = Array.from(new Set(rows.map((r) => r.fecha))).sort();
  const today = sortedDates[sortedDates.length - 1];
  const todayDate = new Date(today);
  if (rango === "hoy") return rows.filter((r) => r.fecha === today);
  if (rango === "semana") {
    const start = new Date(todayDate);
    start.setDate(todayDate.getDate() - 6);
    return rows.filter((r) => new Date(r.fecha) >= start);
  }
  if (rango === "mes") {
    const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    return rows.filter((r) => new Date(r.fecha) >= start);
  }
  // custom -> last 15 days for demo
  const start = new Date(todayDate);
  start.setDate(todayDate.getDate() - 14);
  return rows.filter((r) => new Date(r.fecha) >= start);
}

function variacion(actual: number, previo: number) {
  if (previo === 0) return actual === 0 ? 0 : 1;
  return (actual - previo) / previo;
}

function KpiCard({
  title,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  delta: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "accent" | "warning" | "info";
}) {
  const up = delta >= 0;
  const accentBg =
    accent === "primary"
      ? "gradient-primary"
      : accent === "accent"
        ? "gradient-accent"
        : accent === "warning"
          ? "bg-warning/20"
          : "bg-info/20";
  const accentIcon =
    accent === "warning"
      ? "text-warning"
      : accent === "info"
        ? "text-info"
        : "text-primary-foreground";
  return (
    <Card className="relative overflow-hidden gradient-card border-border/50 shadow-elevated">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl gradient-primary"
      />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {title}
            </p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
          </div>
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              accentBg,
            )}
          >
            <Icon className={cn("h-5 w-5", accentIcon)} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {up ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {pct.format(Math.abs(delta))}
          </span>
          <span className="text-muted-foreground">vs. ayer</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 text-xs shadow-elevated backdrop-blur">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-foreground">{p.name}:</span> {eurP.format(p.value)}
        </p>
      ))}
    </div>
  );
}

export function SalesDashboard() {
  const { data, isLoading, source, fileName, importedAt } = useDashboardVentas();
  const [rango, setRango] = useState<RangoKey>("hoy");

  const rows = data ?? [];
  const filtered = useMemo(() => filterByRange(rows, rango), [rows, rango]);

  const { today, yesterday } = useMemo(() => isoDaysAgo(rows), [rows]);
  const todayRows = useMemo(() => rows.filter((r) => r.fecha === today), [rows, today]);
  const yestRows = useMemo(
    () => rows.filter((r) => r.fecha === yesterday),
    [rows, yesterday],
  );

  const sum = (rs: VentaRow[], k: "total_venta" | "beneficio") =>
    rs.reduce((a, r) => a + r[k], 0);

  const totalHoy = sum(todayRows, "total_venta");
  const totalAyer = sum(yestRows, "total_venta");
  const benHoy = sum(todayRows, "beneficio");
  const benAyer = sum(yestRows, "beneficio");
  const margenHoy = totalHoy ? benHoy / totalHoy : 0;
  const margenAyer = totalAyer ? benAyer / totalAyer : 0;
  const ventasHoy = todayRows.length;
  const ventasAyer = yestRows.length;

  // Bar chart: ventas hoy por empleado (respeta filtro seleccionado)
  const porEmpleado = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) map.set(r.empleado, (map.get(r.empleado) ?? 0) + r.total_venta);
    return Array.from(map.entries())
      .map(([empleado, total]) => ({ empleado, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Line chart: últimos 15 días
  const evolucion = useMemo(() => {
    const dates = Array.from(new Set(rows.map((r) => r.fecha))).sort().slice(-15);
    return dates.map((d) => {
      const day = rows.filter((r) => r.fecha === d);
      return {
        fecha: new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
        ventas: Math.round(sum(day, "total_venta")),
        beneficio: Math.round(sum(day, "beneficio")),
      };
    });
  }, [rows]);

  // Leaderboard: mes actual
  const leaderboard = useMemo(() => {
    if (!rows.length) return [];
    const todayDate = today ? new Date(today) : new Date();
    const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const mensuales = rows.filter((r) => new Date(r.fecha) >= monthStart);
    const map = new Map<string, { total: number; beneficio: number }>();
    for (const r of mensuales) {
      const cur = map.get(r.empleado) ?? { total: 0, beneficio: 0 };
      cur.total += r.total_venta;
      cur.beneficio += r.beneficio;
      map.set(r.empleado, cur);
    }
    return Array.from(map.entries())
      .map(([empleado, v]) => ({
        empleado,
        total: v.total,
        beneficio: v.beneficio,
        progreso: Math.min(100, (v.total / EMPLEADO_OBJETIVO_MENSUAL) * 100),
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows, today]);





  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
              Panel en vivo
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Ventas y Rendimiento
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vista general del equipo comercial ·{" "}
              {today ? new Date(today).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }) : ""}
            </p>
            <div className="mt-2">
              {source === "csv" ? (
                <Badge
                  variant="outline"
                  className="border-success/40 bg-success/10 text-success"
                >
                  CSV · {fileName}
                  {importedAt && (
                    <span className="ml-2 opacity-70">
                      {new Date(importedAt).toLocaleDateString("es-ES")}
                    </span>
                  )}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-border/60 text-muted-foreground"
                >
                  Datos de demostración
                </Badge>
              )}
            </div>
          </div>

          {/* Filtros rápidos + export */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border/60 bg-card/60 p-1 backdrop-blur">
              {RANGOS.map((r) => (
                <Button
                  key={r.key}
                  variant="ghost"
                  size="sm"
                  onClick={() => setRango(r.key)}
                  className={cn(
                    "h-8 rounded-lg text-xs font-medium",
                    rango === r.key
                      ? "gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <CsvImportDialog
              trigger={
                <Button
                  size="sm"
                  className="h-10 gap-2 rounded-xl gradient-primary text-xs font-medium text-primary-foreground shadow-glow hover:opacity-90"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Importar CSV
                </Button>
              }
            />
            {source === "csv" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => ventasStore.clear()}
                className="h-10 gap-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
                title="Volver a los datos de demostración"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restablecer demo
              </Button>
            )}
          </div>
        </header>

        {/* KPIs */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Vendido Hoy"
            value={eur.format(totalHoy)}
            delta={variacion(totalHoy, totalAyer)}
            icon={Euro}
            accent="primary"
          />
          <KpiCard
            title="Beneficio Neto Hoy"
            value={eur.format(benHoy)}
            delta={variacion(benHoy, benAyer)}
            icon={TrendingUp}
            accent="accent"
          />
          <KpiCard
            title="Margen Medio"
            value={pct.format(margenHoy)}
            delta={variacion(margenHoy, margenAyer)}
            icon={Percent}
            accent="warning"
          />
          <KpiCard
            title="Nº Ventas Hoy"
            value={String(ventasHoy)}
            delta={variacion(ventasHoy, ventasAyer)}
            icon={ReceiptText}
            accent="info"
          />
        </section>

        {/* Charts */}
        <section className="mt-6 grid gap-6 lg:grid-cols-5">
          <Card className="gradient-card border-border/50 shadow-elevated lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                Ventas por empleado
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-primary"
                >
                  {RANGOS.find((r) => r.key === rango)?.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porEmpleado} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
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
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
                  <Bar
                    dataKey="total"
                    name="Total vendido"
                    fill="url(#barFill)"
                    radius={[8, 8, 4, 4]}
                    maxBarSize={54}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="gradient-card border-border/50 shadow-elevated lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                Evolución (últimos 15 días)
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-chart-1" /> Ventas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-chart-2" /> Beneficio
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={evolucion} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lineVentas" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--color-chart-1)" />
                      <stop offset="100%" stopColor="var(--color-chart-2)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    name="Ventas"
                    stroke="url(#lineVentas)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5, fill: "var(--color-chart-1)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="beneficio"
                    name="Beneficio"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 5, fill: "var(--color-chart-2)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Leaderboard */}
        <section className="mt-6">
          <Card className="gradient-card border-border/50 shadow-elevated">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Trophy className="h-4 w-4 text-warning" />
                Clasificación del mes
                <Badge
                  variant="outline"
                  className="ml-auto border-border/60 text-muted-foreground"
                >
                  Objetivo: {eur.format(EMPLEADO_OBJETIVO_MENSUAL)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.map((emp, idx) => (
                <div
                  key={emp.empleado}
                  className={cn(
                    "group flex items-center gap-4 rounded-xl border border-transparent p-3 transition-colors",
                    "hover:border-border/60 hover:bg-muted/40",
                  )}
                >
                  <div className="flex w-6 items-center justify-center text-sm font-semibold text-muted-foreground">
                    {idx + 1}
                  </div>
                  <Avatar className="h-11 w-11 border border-border/60">
                    <AvatarFallback
                      className={cn(
                        "text-sm font-semibold",
                        idx === 0
                          ? "gradient-primary text-primary-foreground"
                          : idx === 1
                            ? "gradient-accent text-accent-foreground"
                            : "bg-muted text-foreground",
                      )}
                    >
                      {initials(emp.empleado)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{emp.empleado}</p>
                        {idx === 0 && (
                          <Badge className="gradient-primary border-0 text-[10px] uppercase tracking-wider text-primary-foreground">
                            Top vendedor
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-baseline gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Beneficio{" "}
                          <span className="font-semibold text-foreground">
                            {eur.format(emp.beneficio)}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums">
                          {eur.format(emp.total)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={emp.progreso} className="h-2 flex-1" />
                      <span className="w-12 text-right text-xs font-medium tabular-nums text-muted-foreground">
                        {emp.progreso.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {source === "csv"
            ? "Datos importados desde CSV · guardados en este navegador."
            : "Datos de demostración · importa un CSV desde tu programa de facturación para ver tus ventas reales."}
        </p>
      </div>
    </div>
  );
}
