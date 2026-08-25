import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, CalendarDays, Users, ReceiptText, Euro, Calculator, Wallet, Landmark, ShoppingBag, TrendingUp, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getMetodoBreakdown } from "@/lib/albaran-parser";
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
import type { Gasto } from "@/lib/gastos-store";


const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const eurP = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

// Cifra compacta para las celdas del calendario (sin símbolo, cabe en móvil).
const eurCell = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
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

export function SalesCalendar({
  rows,
  gastos = [],
  onDeleteVenta,
}: {
  rows: VentaRow[];
  gastos?: Gasto[];
  onDeleteVenta?: (id: string) => Promise<void> | void;
}) {
  // Group gastos by ISO date
  const gastosByDay = useMemo(() => {
    const m = new Map<string, Gasto[]>();
    for (const g of gastos) {
      const arr = m.get(g.fecha) ?? [];
      arr.push(g);
      m.set(g.fecha, arr);
    }
    return m;
  }, [gastos]);

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
  const beneficioDia = selectedRows.reduce((a, r) => a + (r.beneficio ?? 0), 0);
  const nAlb = selectedRows.length;
  const selectedGastos = gastosByDay.get(selected) ?? [];
  const gastosDia = selectedGastos.reduce((a, g) => a + g.monto, 0);
  const netoDia = beneficioDia - gastosDia;

  // Desglose del día por método de cobro (efectivo / TPV / banco)
  const desgloseDia = useMemo(() => {
    const acc = { efectivo: 0, tpv: 0, banco: 0, canje: 0 };
    for (const r of selectedRows) {
      const bd = getMetodoBreakdown(r);
      acc.efectivo += bd.efectivo;
      acc.tpv += bd.tpv;
      acc.banco += bd.banco;
      acc.canje += (r as any).canje_amount ?? 0;
    }
    return acc;
  }, [selectedRows]);

  const gastosDiaEfectivo = selectedGastos
    .filter((g) => g.fuente === "efectivo")
    .reduce((a, g) => a + g.monto, 0);
  const gastosDiaBanco = selectedGastos
    .filter((g) => g.fuente === "banco")
    .reduce((a, g) => a + g.monto, 0);



  const porComercial = useMemo(() => {
    const m = new Map<string, { total: number; beneficio: number; n: number }>();
    for (const r of selectedRows) {
      const cur = m.get(r.empleado) ?? { total: 0, beneficio: 0, n: 0 };
      cur.total += r.total_venta;
      cur.beneficio += r.beneficio ?? 0;
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
            <MonthlySummary rows={rows} gastos={gastos} />
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
                if (!d)
                  return (
                    <div
                      key={i}
                      className="min-h-[3.75rem] sm:aspect-square sm:min-h-0"
                    />
                  );
                const iso = toISO(d);
                const dayRows = byDay.get(iso) ?? [];
                const total = dayRows.reduce((a, r) => a + r.total_venta, 0);
                const has = dayRows.length > 0;
                const dayGastos = gastosByDay.get(iso) ?? [];
                const totalGastos = dayGastos.reduce((a, g) => a + g.monto, 0);
                const hasGastos = dayGastos.length > 0;
                const isSelected = iso === selected;
                const intensity = maxDayTotal > 0 ? total / maxDayTotal : 0;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelected(iso)}
                    className={cn(
                      "group relative min-h-[3.75rem] overflow-hidden rounded-lg border px-0.5 pb-2 pt-1 text-left transition-all sm:aspect-square sm:min-h-0 sm:p-1.5",
                      "flex flex-col justify-between",
                      isSelected
                        ? "border-primary/70 bg-primary/15 shadow-glow"
                        : has || hasGastos
                          ? "border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5"
                          : "border-border/30 bg-transparent text-muted-foreground/50 hover:bg-muted/30",
                    )}
                  >
                    {has && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-1 bottom-0.5 h-1 rounded-full bg-primary/70"
                        style={{ opacity: 0.35 + intensity * 0.65 }}
                      />
                    )}
                    {hasGastos && (
                      <span
                        aria-hidden
                        title={`Gastos: ${eurP.format(totalGastos)}`}
                        className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive"
                      />
                    )}
                    <span className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      isSelected && "text-primary",
                    )}>
                      {d.getDate()}
                    </span>
                    {(has || hasGastos) && (
                      <span className="relative z-[1] flex w-full min-w-0 flex-col gap-0.5 text-[8px] font-medium leading-tight tabular-nums text-foreground sm:text-[10px]">
                        {has && (
                          <span className="block w-full truncate">
                            {eurCell.format(total)}
                          </span>
                        )}
                        {hasGastos && (
                          <span className="block w-full truncate text-destructive">
                            −{eurCell.format(totalGastos)}
                          </span>
                        )}
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

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-border/50 bg-background/40 p-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Euro className="h-3 w-3" /> Ingresos
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">{eur.format(totalDia)}</div>
                </div>
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <TrendingUp className="h-3 w-3" /> Beneficio
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-primary">
                    {eur.format(beneficioDia)}
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <ReceiptText className="h-3 w-3" /> Alb.
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">{nAlb}</div>
                </div>
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Wallet className="h-3 w-3" /> Gastos
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-destructive">
                    −{eur.format(gastosDia)}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Neto real del día (beneficio − gastos)
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    netoDia >= 0 ? "text-primary" : "text-destructive",
                  )}
                >
                  {eur.format(netoDia)}
                </span>
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
                          <span className="font-semibold tabular-nums text-primary">
                            +{eurP.format(e.beneficio)}
                          </span>
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
                          {onDeleteVenta && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                  aria-label={`Eliminar albarán ${r.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar este albarán?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se borrará {r.id} ({r.empleado} · {eurP.format(r.total_venta)}) del{" "}
                                    {selected}. Podrás volver a subir la captura corregida.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                      void onDeleteVenta(r.id);
                                    }}
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Gastos del día */}
              {selectedGastos.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    <Wallet className="h-3 w-3" /> Gastos ({selectedGastos.length})
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                    {selectedGastos
                      .slice()
                      .sort((a, b) => b.monto - a.monto)
                      .map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px]">{g.concepto || "Movimiento"}</div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {g.categoria === "personales" ? "Personales" : "Tienda"} · {g.fuente === "banco" ? "Banco" : "Efectivo"}
                            </div>
                          </div>
                          <div className="font-semibold tabular-nums text-destructive">
                            −{eurP.format(g.monto)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

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

function MonthlySummary({ rows, gastos = [] }: { rows: VentaRow[]; gastos?: Gasto[] }) {
  const [open, setOpen] = useState(false);

  // All months that have at least one row (ventas o gastos), sorted newest → oldest
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.fecha.slice(0, 7)); // YYYY-MM
    for (const g of gastos) set.add(g.fecha.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [rows, gastos]);


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
      const bd = getMetodoBreakdown(r);
      const totalCobrado = bd.efectivo + bd.tpv + bd.banco;
      const benef = r.beneficio ?? 0;
      const share = (part: number) =>
        totalCobrado > 0 ? (part / totalCobrado) * benef : 0;
      base.efectivo.total += bd.efectivo;
      base.tpv.total += bd.tpv;
      base.banco.total += bd.banco;
      base.efectivo.beneficio += share(bd.efectivo);
      base.tpv.beneficio += share(bd.tpv);
      base.banco.beneficio += share(bd.banco);
      if (bd.efectivo > 0) base.efectivo.n += 1;
      if (bd.tpv > 0) base.tpv.n += 1;
      if (bd.banco > 0) base.banco.n += 1;
    }
    return base;
  }, [monthRows]);
  const monthGastos = useMemo(
    () => gastos.filter((g) => g.fecha.startsWith(currentMonth)),
    [gastos, currentMonth],
  );
  const gTiendaCash = monthGastos.filter((g) => g.categoria === "tienda" && g.fuente === "efectivo").reduce((a, g) => a + g.monto, 0);
  const gTiendaBanco = monthGastos.filter((g) => g.categoria === "tienda" && g.fuente === "banco").reduce((a, g) => a + g.monto, 0);
  const gPersonales = monthGastos.filter((g) => g.categoria === "personales").reduce((a, g) => a + g.monto, 0);
  const gastosTotal = gTiendaCash + gTiendaBanco + gPersonales;
  const netoMes = total - gastosTotal;



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

          {/* Gastos del mes */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <Wallet className="h-3 w-3" /> Gastos del mes ({monthGastos.length} mov.)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <ShoppingBag className="h-3 w-3" /> Tienda · Efectivo
                </div>
                <div className="mt-1 text-base font-semibold tabular-nums text-warning">
                  −{eurP.format(gTiendaCash)}
                </div>
              </div>
              <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Landmark className="h-3 w-3" /> Tienda · Banco
                </div>
                <div className="mt-1 text-base font-semibold tabular-nums text-warning">
                  −{eurP.format(gTiendaBanco)}
                </div>
              </div>
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Wallet className="h-3 w-3" /> Personales
                </div>
                <div className="mt-1 text-base font-semibold tabular-nums text-destructive">
                  −{eurP.format(gPersonales)}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Dinero neto del mes
              </span>
              <span className={cn("text-base font-bold tabular-nums", netoMes >= 0 ? "text-success" : "text-destructive")}>
                {eurP.format(netoMes)}
              </span>
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
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-base font-semibold tabular-nums">
                        {eurP.format(v.total)}
                      </span>
                      <span className="text-xs font-medium tabular-nums text-success">
                        +{eurP.format(v.beneficio)}
                      </span>
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
                          <span className="font-medium tabular-nums text-success">
                            +{eurP.format(e.beneficio)}
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
