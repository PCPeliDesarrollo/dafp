import { useEffect, useMemo, useState } from "react";
import { allowedMonths, useSuperuser } from "@/lib/use-superuser";

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
  ReceiptText,
  Trophy,
  Upload,
  RotateCcw,
  Wallet,
  Landmark,
  PiggyBank,
  Gift,
  ShoppingBag,
  Trash2,
  LogOut,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { SalesCalendar } from "./SalesCalendar";
import { OcrPasteZone } from "./OcrPasteZone";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { GastosCashForm } from "./GastosCashForm";
import { IngresoManualForm } from "./IngresoManualForm";
import { GastosBankImport } from "./GastosBankImport";
import { GastosListDialog } from "./GastosListDialog";
import { KpiDetailDialog, type KpiDetail, type KpiDetailItem } from "./KpiDetailDialog";
import { CierresImportDialog } from "./CierresImportDialog";

import { getVentasStore } from "@/lib/ventas-store";
import { useGastos, useGastosGeneral, getGastosStore } from "@/lib/gastos-store";
import { useCierres } from "@/lib/cierres-store";
import { formatMesAnio } from "@/lib/cierres-parser";
import { EMPRESAS, EMPRESA_KEYS, useVista } from "@/lib/empresa";
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
import { METODO_PAGO_LABEL, getMetodoBreakdown, type MetodoPago } from "@/lib/albaran-parser";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


type RangoKey = "semana" | "mes" | "todo";

const RANGOS: { key: RangoKey; label: string }[] = [
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "todo", label: "Todo" },
];

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
const num = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
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

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Hoy y ayer reales del calendario (no la última fecha con datos). */
function isoDaysAgo(_rows: VentaRow[]): { today: string; yesterday: string } {
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  return { today: localIso(now), yesterday: localIso(yest) };
}

function filterByRange(rows: VentaRow[], rango: RangoKey, monthAnchor: string) {
  if (!rows.length) return rows;
  const today = localIso(new Date());
  const todayDate = new Date(today);
  if (rango === "semana") {
    const start = new Date(todayDate);
    start.setDate(todayDate.getDate() - 6);
    return rows.filter((r) => new Date(r.fecha) >= start);
  }
  if (rango === "mes") {
    const [yy, mm] = monthAnchor.split("-").map(Number);
    const start = new Date(yy, mm - 1, 1);
    const end = new Date(yy, mm, 1);
    return rows.filter((r) => {
      const d = new Date(r.fecha);
      return d >= start && d < end;
    });
  }

  // "todo" — every row in the dataset
  return rows;
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
  onClick,
}: {
  title: string;
  value: string;
  delta: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "accent" | "warning" | "info";
  onClick?: () => void;
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
    <Card
      onClick={onClick}
      className={cn(
        "relative overflow-hidden gradient-card border-border/50 shadow-elevated",
        onClick && "cursor-pointer transition-colors hover:border-primary/50",
      )}
    >
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
  const navigate = useNavigate();
  const vista = useVista();
  const esGeneral = vista === "general";
  const empresaLabel = esGeneral ? "General" : EMPRESAS[vista].label;
  const ventasStore = getVentasStore(esGeneral ? EMPRESA_KEYS[0] : vista);
  const gastosStore = getGastosStore(esGeneral ? EMPRESA_KEYS[0] : vista);
  const { data, isLoading, source, fileName, importedAt } = useDashboardVentas(vista);
  const { isSuper } = useSuperuser();
  const allowed = useMemo(() => (isSuper ? null : allowedMonths()), [isSuper]);
  const [rango, setRango] = useState<RangoKey>("mes");
  const [monthAnchor, setMonthAnchor] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (allowed && !allowed.includes(monthAnchor)) setMonthAnchor(allowed[0]);
  }, [allowed, monthAnchor]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const rows = useMemo(() => {
    const all = data ?? [];
    return allowed ? all.filter((r) => allowed.includes((r.fecha ?? "").slice(0, 7))) : all;
  }, [data, allowed]);
  const filtered = useMemo(
    () => filterByRange(rows, rango, monthAnchor),
    [rows, rango, monthAnchor],
  );



  const sumTotal = (rs: VentaRow[]) => rs.reduce((a, r) => a + r.total_venta, 0);


  // "Banco" no es un empleado: sus ingresos no se atribuyen a nadie
  const isEmpleadoReal = (nombre: string) =>
    (nombre ?? "").trim().toLowerCase() !== "banco";

  // Bar chart: ventas hoy por empleado (respeta filtro seleccionado)
  const porEmpleado = useMemo(() => {
    const map = new Map<string, { total: number; beneficio: number }>();
    for (const r of filtered) {
      if (!isEmpleadoReal(r.empleado)) continue;
      const cur = map.get(r.empleado) ?? { total: 0, beneficio: 0 };
      cur.total += r.total_venta;
      cur.beneficio += r.beneficio ?? 0;
      map.set(r.empleado, cur);
    }
    return Array.from(map.entries())
      .map(([empleado, v]) => ({ empleado, total: v.total, beneficio: v.beneficio }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);


  // Line chart: últimos 15 días
  const evolucion = useMemo(() => {
    const dates = Array.from(new Set(rows.map((r) => r.fecha))).sort().slice(-15);
    return dates.map((d) => {
      const day = rows.filter((r) => r.fecha === d);
      return {
        fecha: new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
        ventas: sumTotal(day),
      };
    });
  }, [rows]);

  // Leaderboard: mes seleccionado en el selector de mes
  const leaderboard = useMemo(() => {
    if (!rows.length) return [];
    const mensuales = rows.filter(
      (r) => (r.fecha ?? "").slice(0, 7) === monthAnchor && isEmpleadoReal(r.empleado),
    );

    const map = new Map<string, { total: number; beneficio: number }>();
    for (const r of mensuales) {
      const cur = map.get(r.empleado) ?? { total: 0, beneficio: 0 };
      cur.total += r.total_venta;
      cur.beneficio += r.beneficio ?? 0;
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
  }, [rows, monthAnchor]);


  // Desglose por método de pago (sobre `filtered`, respeta el filtro de rango)
  const desglosePago = useMemo(() => {
    const base: Record<MetodoPago, { ingreso: number; beneficio: number; count: number }> = {
      efectivo: { ingreso: 0, beneficio: 0, count: 0 },
      tpv: { ingreso: 0, beneficio: 0, count: 0 },
      banco: { ingreso: 0, beneficio: 0, count: 0 },
    };
    for (const r of filtered) {
      const bd = getMetodoBreakdown(r);
      const totalCobrado = bd.efectivo + bd.tpv + bd.banco;
      const benef = r.beneficio ?? 0;
      const share = (part: number) =>
        totalCobrado > 0 ? (part / totalCobrado) * benef : 0;
      base.efectivo.ingreso += bd.efectivo;
      base.tpv.ingreso += bd.tpv;
      base.banco.ingreso += bd.banco;
      base.efectivo.beneficio += share(bd.efectivo);
      base.tpv.beneficio += share(bd.tpv);
      base.banco.beneficio += share(bd.banco);
      if (bd.efectivo > 0) base.efectivo.count += 1;
      if (bd.tpv > 0) base.tpv.count += 1;
      if (bd.banco > 0) base.banco.count += 1;
    }
    return base;
  }, [filtered]);

  const ingresosRealesTotal = useMemo(
    () => filtered.reduce((a, r) => a + r.total_venta, 0),
    [filtered],
  );
  // CANJEOS: parte de las ventas pagada con saldo a favor (no es dinero nuevo).
  const canjeadoTotal = useMemo(
    () => filtered.reduce((a, r) => a + Math.max(0, Number(r.canje_amount ?? 0)), 0),
    [filtered],
  );
  const canjeRows = useMemo(
    () => filtered.filter((r) => Math.max(0, Number(r.canje_amount ?? 0)) > 0),
    [filtered],
  );
  /** Dinero realmente cobrado = ventas − canjeos. */
  const cobrosRealesTotal = ingresosRealesTotal - canjeadoTotal;
  const beneficioRealTotal = useMemo(
    () => filtered.reduce((a, r) => a + (r.beneficio ?? 0), 0),
    [filtered],
  );
  const albaranesConBeneficio = useMemo(
    () => filtered.filter((r) => (r.beneficio ?? 0) > 0).length,
    [filtered],
  );

  // ------- Gastos (respeta el mismo filtro de rango) -------
  const gastosSnapEmpresa = useGastos(esGeneral ? EMPRESA_KEYS[0] : vista);
  const gastosSnapGeneral = useGastosGeneral();
  const gastosSnapRaw = esGeneral ? gastosSnapGeneral : gastosSnapEmpresa;
  const gastosSnap = useMemo(
    () =>
      allowed
        ? {
            ...gastosSnapRaw,
            rows: gastosSnapRaw.rows.filter((g) =>
              allowed.includes((g.fecha ?? "").slice(0, 7)),
            ),
          }
        : gastosSnapRaw,
    [gastosSnapRaw, allowed],
  );

  const [gastosDialog, setGastosDialog] = useState<"tienda" | "personales" | null>(null);
  const [kpiDetail, setKpiDetail] = useState<KpiDetail | null>(null);

  const filteredGastos = useMemo(() => {
    if (!gastosSnap.rows.length) return [];
    if (rango === "todo") return gastosSnap.rows;
    const now = new Date();
    if (rango === "mes") {
      const [yy, mm] = monthAnchor.split("-").map(Number);
      const start = new Date(yy, mm - 1, 1);
      const end = new Date(yy, mm, 1);
      return gastosSnap.rows.filter((g) => {
        const d = new Date(g.fecha);
        return d >= start && d < end;
      });
    }

    // "semana" se ancla al día real de calendario
    const anchor = now;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - 6);
    return gastosSnap.rows.filter((g) => new Date(g.fecha) >= start);
  }, [gastosSnap.rows, rows, rango, monthAnchor]);


  /** Cierres históricos (importes finales ya cerrados: BF/EF/BS/ES). */
  const { rows: cierresRows } = useCierres();
  const empresasVista = esGeneral ? EMPRESA_KEYS : [vista];

  // Meses disponibles: ventas + gastos + cierres históricos + mes actual
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.fecha.slice(0, 7));
    for (const g of gastosSnap.rows) set.add(g.fecha.slice(0, 7));
    for (const c of cierresRows) {
      if (!empresasVista.includes(c.empresa)) continue;
      const ym = `${c.anio}-${String(c.mes).padStart(2, "0")}`;
      if (allowed && !allowed.includes(ym)) continue;
      set.add(ym);
    }
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    set.add(monthAnchor);
    return Array.from(set).sort().reverse();
  }, [rows, gastosSnap.rows, cierresRows, esGeneral, vista, allowed, monthAnchor]);


  const monthLabel = (ym: string) => {
    const [yy, mm] = ym.split("-").map(Number);
    return new Date(yy, mm - 1, 1)
      .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
      .replace(/^./, (c) => c.toUpperCase());
  };



  const gastosTiendaCash = filteredGastos
    .filter((g) => g.categoria === "tienda" && g.fuente === "efectivo")
    .reduce((a, g) => a + g.monto, 0);
  const gastosTiendaBanco = filteredGastos
    .filter((g) => g.categoria === "tienda" && g.fuente === "banco")
    .reduce((a, g) => a + g.monto, 0);
  const gastosTiendaTotal = gastosTiendaCash + gastosTiendaBanco;
  const gastosPersonales = filteredGastos
    .filter((g) => g.categoria === "personales")
    .reduce((a, g) => a + g.monto, 0);
  /** Gastos pagados con cada fuente (efectivo / banco), incluyendo personales. */
  const gastosPorFuente = useMemo(() => {
    const base = { efectivo: 0, banco: 0 };
    for (const g of filteredGastos) {
      if (g.fuente === "efectivo") base.efectivo += g.monto;
      else base.banco += g.monto;
    }
    return base;
  }, [filteredGastos]);

  /** Gasto imputado a cada método de cobro: el TPV liquida en banco,
   *  por eso los gastos bancarios se muestran también sobre el banco. */
  const gastoDeMetodo = (mp: MetodoPago) =>
    mp === "efectivo" ? gastosPorFuente.efectivo : mp === "banco" ? gastosPorFuente.banco : 0;

  /** Cierres históricos (importes finales ya cerrados: BF/EF/BS/ES). */
  const { rows: cierresRows } = useCierres();
  const empresasVista = esGeneral ? EMPRESA_KEYS : [vista];
  const cierresPeriodo = useMemo(() => {
    const [yy, mm] = monthAnchor.split("-").map(Number);
    const base = cierresRows.filter((c) => empresasVista.includes(c.empresa));
    const enPeriodo =
      rango === "todo" ? base : base.filter((c) => c.anio === yy && c.mes === mm);
    const visibles = allowed
      ? enPeriodo.filter((c) =>
          allowed.includes(`${c.anio}-${String(c.mes).padStart(2, "0")}`),
        )
      : enPeriodo;
    const efectivo = visibles
      .filter((c) => c.fuente === "efectivo")
      .reduce((a, c) => a + c.monto, 0);
    const banco = visibles.filter((c) => c.fuente === "banco").reduce((a, c) => a + c.monto, 0);
    return { rows: visibles, efectivo, banco, total: efectivo + banco };
  }, [cierresRows, esGeneral, vista, rango, monthAnchor, allowed]);

  /** Importe de cierre histórico que suma a cada método de cobro. */
  const cierreDeMetodo = (mp: MetodoPago) =>
    mp === "efectivo" ? cierresPeriodo.efectivo : mp === "banco" ? cierresPeriodo.banco : 0;

  const dineroNetoReal =
    cobrosRealesTotal - gastosTiendaTotal - gastosPersonales + cierresPeriodo.total;


  // ---- Detalle de KPIs: de dónde sale cada cantidad ----
  const rangoLabel = RANGOS.find((r) => r.key === rango)?.label ?? "";
  const ventaConcepto = (r: VentaRow) => {
    const num = String(r.id ?? "").replace(/^alb-/, "");
    return `Albarán ${num || "s/n"} · ${r.empleado}`;
  };
  const ventaItems = (rs: VentaRow[]) =>
    rs
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .map((r) => ({
        id: String(r.id),
        fecha: r.fecha,
        concepto: ventaConcepto(r),
        importe: r.total_venta,
        sourceKind: "venta" as const,
        sourceId: String(r.id),
      }));

  const showMetodoDetalle = (mp: MetodoPago) => {
    const items = filtered
      .map((r) => ({ r, bd: getMetodoBreakdown(r) }))
      .filter(({ bd }) => bd[mp] > 0)
      .sort((a, b) => (a.r.fecha < b.r.fecha ? 1 : -1))
      .map(({ r, bd }) => ({
        id: String(r.id),
        fecha: r.fecha,
        concepto: ventaConcepto(r),
        detalle: `Total albarán ${eurP.format(r.total_venta)} · cobrado por ${METODO_PAGO_LABEL[mp]} ${eurP.format(bd[mp])}`,
        importe: bd[mp],
        sourceKind: "venta" as const,
        sourceId: String(r.id),
      }));
    setKpiDetail({
      title: `${METODO_PAGO_LABEL[mp]} · ${rangoLabel}`,
      formula:
        mp === "banco"
          ? "Movimientos contados en positivo como cobro por transferencia/banco (nota BANCO en el albarán o ingreso importado del extracto)."
          : mp === "tpv"
            ? "Importes cobrados con tarjeta (nota TPV en el albarán), sumados por encima del efectivo."
            : "Parte del albarán cobrada en efectivo (TOTAL del albarán menos lo anotado como TPV/BANCO).",
      total: desglosePago[mp].ingreso,
      items,
    });
  };

  const canjeItems = canjeRows
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .map((r) => ({
      id: `c-${r.id}`,
      fecha: r.fecha,
      concepto: `${ventaConcepto(r)}${r.cliente ? ` · ${r.cliente}` : ""}`,
      detalle: `Venta ${eurP.format(r.total_venta)} · pagado con saldo a favor`,
      importe: Math.max(0, Number(r.canje_amount ?? 0)),
      sourceKind: "venta" as const,
      sourceId: String(r.id),
    }));

  const dineroNetoItems = [
    ...ventaItems(filtered).map((it) => {
      const row = filtered.find((r) => String(r.id) === it.sourceId);
      const canje = Math.max(0, Number(row?.canje_amount ?? 0));
      return canje > 0
        ? {
            ...it,
            importe: it.importe - canje,
            detalle: `CANJEA ${eurP.format(canje)} descontado (no es cobro nuevo)`,
          }
        : it;
    }),
    ...filteredGastos
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .map((g) => ({
        id: `g-${g.id}`,
        fecha: g.fecha,
        concepto: g.concepto || (g.categoria === "tienda" ? "Gasto tienda" : "Gasto personal"),
        detalle: `${g.categoria === "tienda" ? "Gasto tienda" : "Gasto personal"} · ${g.fuente === "banco" ? "banco" : "efectivo"}`,
        importe: g.monto,
        negativo: true,
        sourceKind: "gasto" as const,
        sourceId: g.id,
      })),
  ];

  /** Detalle de los gastos pagados con una fuente concreta (efectivo / banco) del mes. */
  const showGastosFuenteDetalle = (mp: MetodoPago) => {
    const fuente = mp === "efectivo" ? "efectivo" : "banco";
    const rows = filteredGastos
      .filter((g) => (g.fuente === "efectivo" ? "efectivo" : "banco") === fuente)
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    setKpiDetail({
      title: `Gastos pagados en ${fuente} · ${rangoLabel}`,
      formula:
        mp === "tpv"
          ? "El TPV liquida en banco, por eso aquí se listan los gastos bancarios del periodo."
          : `Todos los gastos (tienda y personales) pagados en ${fuente} dentro del periodo seleccionado. Se restan al ingreso para obtener el dinero real.`,
      total: rows.reduce((a, g) => a + g.monto, 0),
      totalLabel: "Total gastos",
      items: rows.map((g) => ({
        id: `g-${g.id}`,
        fecha: g.fecha,
        concepto: g.concepto || (g.categoria === "tienda" ? "Gasto tienda" : "Gasto personal"),
        detalle: `${g.categoria === "tienda" ? "Gasto tienda" : "Gasto personal"} · ${fuente}`,
        importe: g.monto,
        negativo: true,
        sourceKind: "gasto" as const,
        sourceId: g.id,
      })),
    });
  };


  /** Borra el movimiento real (albarán o gasto) desde el detalle de un KPI. */
  const deleteKpiItem = async (item: KpiDetailItem) => {
    if (!item.sourceKind || !item.sourceId) return;
    const id = item.sourceId;
    try {
      if (item.sourceKind === "venta") {
        if (esGeneral) {
          await Promise.all(EMPRESA_KEYS.map((k) => getVentasStore(k).remove(id)));
        } else {
          await ventasStore.remove(id);
        }
      } else {
        if (esGeneral) {
          await Promise.all(EMPRESA_KEYS.map((k) => getGastosStore(k).remove(id)));
        } else {
          await gastosStore.remove(id);
        }
      }
      toast.success("Movimiento eliminado");
    } catch {
      toast.error("No se pudo eliminar el movimiento");
    }
  };



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

  const leaderboardCard = (
    <Card className="gradient-card border-border/50 shadow-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Trophy className="h-4 w-4 text-warning" />
          Clasificación de{" "}
          {new Date(`${monthAnchor}-01T00:00:00`).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
          })}

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
          <div className="flex w-full min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 text-sm sm:w-auto">
            <span className="text-right">
        <span className="mr-1 text-xs text-muted-foreground">Ingresos</span>
        <span className="font-semibold tabular-nums">
          {eur.format(emp.total)}
        </span>
            </span>
            <span className="text-right">
        <span className="mr-1 text-xs text-muted-foreground">Beneficio</span>
        <span className="font-semibold tabular-nums text-success">
          {eur.format(emp.beneficio)}
        </span>
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
        {leaderboard.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
      No hay ventas registradas en este mes. Cambia el mes en el selector de arriba
      para ver otra clasificación.
          </p>
        )}

      </CardContent>
    </Card>
  );

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
              Ventas y Rendimiento · {empresaLabel}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vista general del equipo comercial
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
            <Select
              value={monthAnchor}
              onValueChange={(v) => {
                setMonthAnchor(v);
                setRango("mes");
              }}
            >
              <SelectTrigger className="h-10 w-[180px] rounded-xl border-border/60 bg-card/60 text-xs backdrop-blur">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!esGeneral && (
            <CsvImportDialog
              trigger={
                <Button
                  size="sm"
                  className="h-10 gap-2 rounded-xl gradient-primary text-xs font-medium text-primary-foreground shadow-glow hover:opacity-90"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Importar{"\u00a0"}
                </Button>
              }
            />
            )}
            {!esGeneral && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2 rounded-xl border-destructive/40 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Borrar todo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Borrar todos los datos de {empresaLabel}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán todas las ventas (albaranes) y todos los gastos
                    guardados en la nube. Esta acción no se puede deshacer: tendrás
                    que volver a subir las capturas y los movimientos del banco.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await ventasStore.clear();
                      await gastosStore.clear();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sí, borrar todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}
            {!esGeneral && source === "csv" && (
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="h-10 gap-2 rounded-xl border-border/60 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </Button>
          </div>
        </header>

        {/* Resumen real de ingresos y beneficio, respeta filtro */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <Card
            className="cursor-pointer gradient-card border-border/50 shadow-elevated transition-colors hover:border-primary/50"
            onClick={() =>
              setKpiDetail({
                title: `Total Ingresos Reales · ${rangoLabel}`,
                formula:
                  "Suma del PVP total de cada albarán (efectivo + TPV + banco) en el periodo seleccionado.",
                total: ingresosRealesTotal,
                items: ventaItems(filtered),
              })
            }
          >
            <CardContent className="p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Total Ingresos Reales · {RANGOS.find((r) => r.key === rango)?.label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {eurP.format(ingresosRealesTotal)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Incluye entregas parciales al valor cobrado · pulsa para ver el detalle
              </p>
            </CardContent>
          </Card>
          <Card
            className="relative cursor-pointer overflow-hidden gradient-accent border-accent/60 shadow-glow transition-opacity hover:opacity-90"

            onClick={() =>
              setKpiDetail({
                title: `Beneficio Real · ${rangoLabel}`,
                formula: "Beneficio de cada albarán = PVP total − PVD (coste × cantidad).",
                total: beneficioRealTotal,
                items: filtered
                  .filter((r) => (r.beneficio ?? 0) !== 0)
                  .slice()
                  .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                  .map((r) => ({
                    id: `b-${r.id}`,
                    fecha: r.fecha,
                    concepto: ventaConcepto(r),
                    detalle: `PVP ${eurP.format(r.total_venta)} · beneficio`,
                    importe: r.beneficio ?? 0,
                    sourceKind: "venta" as const,
                    sourceId: String(r.id),
                  })),
              })
            }
          >
            <CardContent className="p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-accent-foreground/80">
                Beneficio Real · {RANGOS.find((r) => r.key === rango)?.label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-accent-foreground">
                {eurP.format(beneficioRealTotal)}
              </p>
              <p className="mt-1 text-xs text-accent-foreground/75">
                Calculado desde PVP − PVD de los albaranes ({albaranesConBeneficio} con datos)
              </p>
            </CardContent>
          </Card>

        </section>



        {/* Desglose por método de pago */}
        <section className="mt-4 grid gap-4 md:grid-cols-3">
          {(["efectivo", "tpv", "banco"] as MetodoPago[]).map((mp) => {
            const d = desglosePago[mp];
            const accent =
              mp === "efectivo"
                ? "border-success/40 bg-success/5"
                : mp === "tpv"
                  ? "border-primary/40 bg-primary/5"
                  : "border-info/40 bg-info/5";
            return (
              <Card
                key={mp}
                onClick={() => showMetodoDetalle(mp)}
                className={cn(
                  "cursor-pointer border shadow-elevated transition-opacity hover:opacity-90",
                  accent,
                )}
              >
                <CardContent className="p-5">

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{METODO_PAGO_LABEL[mp]}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {d.count} venta{d.count === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Ingreso
                      </p>
                      <p className="text-xl font-semibold tabular-nums">
                        {eurP.format(d.ingreso)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Beneficio
                      </p>
                      <p className="text-xl font-semibold tabular-nums text-success">
                        {eurP.format(d.beneficio)}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const gasto = gastoDeMetodo(mp);
                    const cierre = cierreDeMetodo(mp);
                    const real = d.ingreso - gasto + cierre;
                    return (
                      <div className="mt-3 space-y-1 border-t border-border/50 pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showGastosFuenteDetalle(mp);
                          }}
                          className="flex w-full items-center justify-between rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-muted/50"
                        >
                          <span className="text-muted-foreground underline decoration-dotted underline-offset-2">
                            {mp === "tpv" ? "Gastos (liquidan en banco)" : "− Gastos pagados"}
                          </span>
                          <span className="tabular-nums text-destructive">
                            {gasto > 0 ? `−${eurP.format(gasto)}` : eurP.format(0)}
                          </span>
                        </button>

                        {cierre !== 0 && (
                          <div className="flex items-center justify-between px-1 text-[11px]">
                            <span className="text-muted-foreground">+ Cuentas anteriores</span>
                            <span className="tabular-nums text-info">{eurP.format(cierre)}</span>
                          </div>
                        )}


                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Dinero real
                          </span>
                          <span
                            className={cn(
                              "text-lg font-semibold tabular-nums",
                              real >= 0 ? "text-success" : "text-destructive",
                            )}
                          >
                            {eurP.format(real)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                </CardContent>

              </Card>
            );
          })}
        </section>

        {/* CANJEOS: ventas pagadas con saldo a favor del cliente */}
        <section className="mt-4">
          <Card
            className="cursor-pointer border-warning/40 bg-warning/5 shadow-elevated transition-colors hover:border-warning/70"
            onClick={() =>
              setKpiDetail({
                title: `Canjeos · ${rangoLabel}`,
                formula:
                  "Importe de las ventas pagado con saldo a favor del cliente (CANJEA). Cuenta como venta del comercial, pero NO como dinero nuevo cobrado.",
                total: canjeadoTotal,
                items: canjeItems,
              })
            }
          >
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Gift className="h-3.5 w-3.5" /> Canjeos · {rangoLabel}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-warning">
                  {eurP.format(canjeadoTotal)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {canjeRows.length} venta{canjeRows.length === 1 ? "" : "s"} pagada
                  {canjeRows.length === 1 ? "" : "s"} con saldo a favor · no suma a caja
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Cobros reales
                </p>
                <p className="text-xl font-semibold tabular-nums text-success">
                  {eurP.format(cobrosRealesTotal)}
                </p>
                <p className="text-[11px] text-muted-foreground">Ventas − canjeos</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Resumen global de tesorería (Ingresos - Gastos = Dinero Neto Real) */}
        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            className="cursor-pointer border-success/40 bg-success/5 shadow-elevated transition-colors hover:border-success/70"
            onClick={() =>
              setKpiDetail({
                title: `Total Ingresos Reales · ${rangoLabel}`,
                formula:
                  "Suma del PVP total de cada albarán (efectivo + TPV + banco) en el periodo seleccionado.",
                total: ingresosRealesTotal,
                items: ventaItems(filtered),
              })
            }
          >
            <CardContent className="p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Total Ingresos Reales
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-success">
                {eurP.format(ingresosRealesTotal)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Cobrado de verdad: {eurP.format(cobrosRealesTotal)} (sin canjeos)
              </p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer border-warning/40 bg-warning/5 shadow-elevated transition-colors hover:border-warning/70"
            onClick={() => setGastosDialog("tienda")}
          >
            <CardContent className="p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Total Gastos Tienda
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-warning">
                {eurP.format(gastosTiendaTotal)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Efectivo + banco (proveedores)
              </p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer border-destructive/40 bg-destructive/5 shadow-elevated transition-colors hover:border-destructive/70"
            onClick={() => setGastosDialog("personales")}
          >
            <CardContent className="p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Total Gastos Personales
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
                {eurP.format(gastosPersonales)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Retiradas de caja personales
              </p>
            </CardContent>
          </Card>
          <Card
            className="relative cursor-pointer overflow-hidden gradient-primary text-primary-foreground shadow-glow transition-opacity hover:opacity-90"
            onClick={() =>
              setKpiDetail({
                title: `Dinero Neto Real · ${rangoLabel}`,
                formula:
                  "Cobros reales (ventas − canjeos, en verde) − gastos de tienda y personales (en rojo) del periodo.",
                total: dineroNetoReal,
                items: dineroNetoItems,
              })
            }
          >
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <CardContent className="p-5">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest opacity-90">
                <PiggyBank className="h-3.5 w-3.5" /> Dinero Neto Real
              </p>
              <p className={cn(
                "mt-1 text-3xl font-bold tabular-nums",
                dineroNetoReal < 0 && "text-destructive-foreground",
              )}>
                {eurP.format(dineroNetoReal)}
              </p>
              <p className="mt-1 text-[11px] opacity-90">
                Cobros reales (sin canjeos) − Gastos Tienda − Gastos Personales
              </p>
            </CardContent>
          </Card>
        </section>


        {/* Desglose de gastos por categoría */}
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <Card
            className="cursor-pointer border-warning/30 bg-warning/5 shadow-elevated transition-colors hover:border-warning/60 hover:bg-warning/10"
            onClick={() => setGastosDialog("tienda")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShoppingBag className="h-4 w-4 text-warning" /> Gastos Tienda
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {filteredGastos.filter((g) => g.categoria === "tienda").length} mov.
                </Badge>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {eurP.format(gastosTiendaTotal)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md border border-border/50 bg-card/60 p-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Efectivo (manual)
                  </p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">
                    {eurP.format(gastosTiendaCash)}
                  </p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/60 p-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Banco (CSV)
                  </p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">
                    {eurP.format(gastosTiendaBanco)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer border-destructive/30 bg-destructive/5 shadow-elevated transition-colors hover:border-destructive/60 hover:bg-destructive/10"
            onClick={() => setGastosDialog("personales")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Wallet className="h-4 w-4 text-destructive" /> Gastos Personales
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {filteredGastos.filter((g) => g.categoria === "personales").length} mov.
                </Badge>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {eurP.format(gastosPersonales)}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Registrados en efectivo desde el formulario de gastos.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Ranking de vendedores: en móvil justo debajo de los gastos */}
        <section className="mt-6 lg:hidden">{leaderboardCard}</section>

        {/* Formularios: ingresos a mano + gastos de caja + importador bancario */}
        {!esGeneral && (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <IngresoManualForm />
          <GastosCashForm />
          <GastosBankImport />
        </section>
        )}

        {/* Cuentas cerradas de meses anteriores (BF / EF / BS / ES) */}
        <section className="mt-6">
          <Card className="gradient-card border-border/50 shadow-elevated">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Cuentas cerradas del periodo
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-info">
                  {eurP.format(cierresPeriodo.total)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Efectivo {eurP.format(cierresPeriodo.efectivo)} · Banco{" "}
                  {eurP.format(cierresPeriodo.banco)}
                  {cierresPeriodo.rows.length > 0 &&
                    ` · ${cierresPeriodo.rows.length} registro(s)`}
                </p>
                {cierresPeriodo.rows.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {cierresPeriodo.rows
                      .map(
                        (c) =>
                          `${c.codigo} ${formatMesAnio(c.mes, c.anio)}: ${eurP.format(c.monto)}`,
                      )
                      .join(" · ")}
                  </p>
                )}
              </div>
              <CierresImportDialog />
            </CardContent>
          </Card>
        </section>

        {/* Zona de pegado / OCR de albaranes */}
        {!esGeneral && (
        <section className="mt-6">
          <SectionErrorBoundary title="No se pudo procesar la captura del albarán">
            <OcrPasteZone />
          </SectionErrorBoundary>
        </section>
        )}




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
                    tickFormatter={(v) => num.format(v)}
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
                  <Bar
                    dataKey="beneficio"
                    name="Beneficio"
                    fill="var(--color-success)"
                    radius={[8, 8, 4, 4]}
                    maxBarSize={54}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {porEmpleado.map((e) => (
                  <div
                    key={e.empleado}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-xs"
                  >
                    <span className="truncate font-medium text-foreground">{e.empleado}</span>
                    <span className="flex items-baseline gap-3 tabular-nums">
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
                {porEmpleado.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    No hay ventas de comerciales en este rango.
                  </p>
                )}
              </div>
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
                    tickFormatter={(v) => num.format(v)}
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
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Calendario */}
        <section className="mt-6">
          <SalesCalendar
            rows={rows}
            gastos={gastosSnap.rows}
            onDeleteVenta={async (id) => {
              try {
                if (esGeneral) {
                  await Promise.all(
                    EMPRESA_KEYS.map((k) => getVentasStore(k).remove(id)),
                  );
                } else {
                  await ventasStore.remove(id);
                }
                toast.success(`Albarán ${id} eliminado`);
              } catch {
                toast.error("No se pudo eliminar el albarán");
              }
            }}
          />
        </section>

        {/* Leaderboard (escritorio) */}
        <section className="mt-6 hidden lg:block">{leaderboardCard}</section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {source === "csv"
            ? "Datos importados desde CSV · guardados en este navegador."
            : "Datos de demostración · importa un CSV desde tu programa de facturación para ver tus ventas reales."}
        </p>
      </div>
      <GastosListDialog
        open={gastosDialog !== null}
        onOpenChange={(v) => !v && setGastosDialog(null)}
        categoria={gastosDialog ?? "tienda"}
        gastos={gastosSnap.rows}
      />
      <KpiDetailDialog
        detail={kpiDetail}
        onOpenChange={(v) => !v && setKpiDetail(null)}
        onDelete={deleteKpiItem}
      />

    </div>
  );
}
