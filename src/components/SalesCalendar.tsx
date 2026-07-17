import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Users, ReceiptText, Euro, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { VentaRow } from "@/lib/dashboard-mock";

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

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  // Monday-first offset (getDay: 0=Sun..6=Sat -> 0=Mon..6=Sun)
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function SalesCalendar({ rows }: { rows: VentaRow[] }) {
  // Group rows by ISO date
  const byDay = useMemo(() => {
    const m = new Map<string, VentaRow[]>();
    for (const r of rows) {
      const arr = m.get(r.fecha) ?? [];
      arr.push(r);
      m.set(r.fecha, arr);
    }
    return m;
  }, [rows]);

  // Default: month of most recent sale, or current month
  const initial = useMemo(() => {
    const dates = Array.from(byDay.keys()).sort();
    const ref = dates.length ? new Date(dates[dates.length - 1]) : new Date();
    return { year: ref.getFullYear(), month: ref.getMonth(), iso: dates[dates.length - 1] ?? toISO(new Date()) };
  }, [byDay]);

  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: initial.year,
    month: initial.month,
  });
  const [selected, setSelected] = useState<string>(initial.iso);

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const maxDayTotal = useMemo(() => {
    let max = 0;
    for (const d of cells) {
      if (!d) continue;
      const iso = toISO(d);
      const t = (byDay.get(iso) ?? []).reduce((a, r) => a + r.total_venta, 0);
      if (t > max) max = t;
    }
    return max;
  }, [cells, byDay]);

  const selectedRows = byDay.get(selected) ?? [];
  const totalDia = selectedRows.reduce((a, r) => a + r.total_venta, 0);
  const nAlb = selectedRows.length;

  const porComercial = useMemo(() => {
    const m = new Map<string, { total: number; n: number }>();
    for (const r of selectedRows) {
      const cur = m.get(r.empleado) ?? { total: 0, n: 0 };
      cur.total += r.total_venta;
      cur.n += 1;
      m.set(r.empleado, cur);
    }
    return Array.from(m.entries())
      .map(([empleado, v]) => ({ empleado, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [selectedRows]);

  const prevMonth = () =>
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 },
    );
  const nextMonth = () =>
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 },
    );

  const selectedDate = new Date(selected);

  return (
    <Card className="gradient-card border-border/50 shadow-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Calendario de ventas
          <Badge variant="outline" className="border-border/60 text-muted-foreground">
            Pincha un día para ver el detalle
          </Badge>
          <div className="ml-auto">
            <MonthlySummary rows={rows} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={prevMonth}
                className="h-8 w-8 rounded-lg"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold tracking-tight">
                {MONTHS[cursor.month]} {cursor.year}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextMonth}
                className="h-8 w-8 rounded-lg"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="aspect-square" />;
                const iso = toISO(d);
                const dayRows = byDay.get(iso) ?? [];
                const total = dayRows.reduce((a, r) => a + r.total_venta, 0);
                const has = dayRows.length > 0;
                const isSelected = iso === selected;
                const intensity = maxDayTotal > 0 ? total / maxDayTotal : 0;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelected(iso)}
                    className={cn(
                      "group relative aspect-square rounded-lg border p-1.5 text-left transition-all",
                      "flex flex-col justify-between",
                      isSelected
                        ? "border-primary/70 bg-primary/15 shadow-glow"
                        : has
                          ? "border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5"
                          : "border-border/30 bg-transparent text-muted-foreground/50 hover:bg-muted/30",
                    )}
                  >
                    {has && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-1 bottom-1 h-1 rounded-full bg-primary/70"
                        style={{ opacity: 0.35 + intensity * 0.65 }}
                      />
                    )}
                    <span className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      isSelected && "text-primary",
                    )}>
                      {d.getDate()}
                    </span>
                    {has && (
                      <span className="relative z-[1] text-[10px] font-medium tabular-nums text-foreground">
                        {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : eur.format(total)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {selectedDate.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/50 bg-background/40 p-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Euro className="h-3 w-3" /> Total
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">{eur.format(totalDia)}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <ReceiptText className="h-3 w-3" /> Nº
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">{nAlb}</div>
                </div>
              </div>

              {/* Por comercial */}
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  <Users className="h-3 w-3" /> Por comercial
                </div>
                {porComercial.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin ventas este día.</p>
                ) : (
                  <div className="space-y-1.5">
                    {porComercial.map((e) => (
                      <div
                        key={e.empleado}
                        className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-medium">{e.empleado}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">{e.n} alb.</span>
                          <span className="font-semibold tabular-nums">{eur.format(e.total)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de albaranes */}
              <div className="mt-4">
                <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Albaranes ({nAlb})
                </div>
                {selectedRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nada que mostrar.</p>
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {selectedRows
                      .slice()
                      .sort((a, b) => b.total_venta - a.total_venta)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-background/20 px-2 py-1.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-[10px] text-muted-foreground">
                              {r.id}
                            </div>
                            <div className="truncate text-[11px]">{r.empleado}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold tabular-nums">{eurP.format(r.total_venta)}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Monthly summary                                */
/* -------------------------------------------------------------------------- */

function MonthlySummary({ rows }: { rows: VentaRow[] }) {
  const [open, setOpen] = useState(false);

  // All months that have at least one row, sorted newest → oldest
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.fecha.slice(0, 7)); // YYYY-MM
    return Array.from(set).sort().reverse();
  }, [rows]);

  const defaultMonth = months[0] ?? new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState<string>(defaultMonth);

  // Keep selection valid when data changes
  const currentMonth = months.includes(month) ? month : defaultMonth;

  const monthRows = useMemo(
    () => rows.filter((r) => r.fecha.startsWith(currentMonth)),
    [rows, currentMonth],
  );

  const total = monthRows.reduce((a, r) => a + r.total_venta, 0);
  const beneficioMes = monthRows.reduce((a, r) => a + (r.beneficio ?? 0), 0);
  const nAlb = monthRows.length;
  const diasActivos = new Set(monthRows.map((r) => r.fecha)).size;

  const porComercial = useMemo(() => {
    const m = new Map<string, { total: number; beneficio: number; n: number }>();
    for (const r of monthRows) {
      const cur = m.get(r.empleado) ?? { total: 0, beneficio: 0, n: 0 };
      cur.total += r.total_venta;
      cur.beneficio += r.beneficio ?? 0;
      cur.n += 1;
      m.set(r.empleado, cur);
    }
    return Array.from(m.entries())
      .map(([empleado, v]) => ({ empleado, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [monthRows]);

  const porMetodo = useMemo(() => {
    const base = {
      efectivo: { total: 0, beneficio: 0, n: 0 },
      tpv: { total: 0, beneficio: 0, n: 0 },
      banco: { total: 0, beneficio: 0, n: 0 },
    } as Record<"efectivo" | "tpv" | "banco", { total: number; beneficio: number; n: number }>;
    for (const r of monthRows) {
      const k = (r.metodo_pago ?? "efectivo") as "efectivo" | "tpv" | "banco";
      const cur = base[k] ?? base.efectivo;
      cur.total += r.total_venta;
      cur.beneficio += r.beneficio ?? 0;
      cur.n += 1;
    }
    return base;
  }, [monthRows]);


  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-lg border-primary/40 bg-primary/10 text-xs font-medium text-primary hover:bg-primary/15"
        >
          <Calculator className="h-3.5 w-3.5" />
          Cálculo mensual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Resumen mensual
          </DialogTitle>
          <DialogDescription>
            Suma de todos los albaranes registrados en el mes seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mes</label>
            {months.length === 0 ? (
              <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Todavía no hay ventas importadas.
              </p>
            ) : (
              <Select value={currentMonth} onValueChange={setMonth}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((ym) => (
                    <SelectItem key={ym} value={ym}>
                      {formatMonthLabel(ym)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Euro className="h-3 w-3" /> Total
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {eur.format(total)}
              </div>
            </div>
            <div className="rounded-lg border border-success/40 bg-success/5 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Euro className="h-3 w-3" /> Beneficio
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-success">
                {eur.format(beneficioMes)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <ReceiptText className="h-3 w-3" /> Albaranes
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{nAlb}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> Días
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{diasActivos}</div>
            </div>
          </div>


          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <Euro className="h-3 w-3" /> Desglose por método de pago
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([
                { key: "efectivo", label: "Efectivo (Caja)", accent: "bg-emerald-500" },
                { key: "tpv", label: "Tarjeta (TPV)", accent: "bg-sky-500" },
                { key: "banco", label: "Transferencia (BANCO)", accent: "bg-violet-500" },
              ] as const).map((m) => {
                const v = porMetodo[m.key];
                const share = total > 0 ? (v.total / total) * 100 : 0;
                return (
                  <div
                    key={m.key}
                    className="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground">{v.n} alb.</span>
                    </div>
                    <div className="mt-1 text-base font-semibold tabular-nums">
                      {eurP.format(v.total)}
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn("h-full rounded-full", m.accent)}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>

            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <Users className="h-3 w-3" /> Desglose por comercial
            </div>
            {porComercial.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin ventas este mes.</p>
            ) : (
              <div className="space-y-1.5">
                {porComercial.map((e) => {
                  const share = total > 0 ? (e.total / total) * 100 : 0;
                  return (
                    <div
                      key={e.empleado}
                      className="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{e.empleado}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-muted-foreground">{e.n} alb.</span>
                          <span className="font-semibold tabular-nums">
                            {eurP.format(e.total)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
                          {share.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
