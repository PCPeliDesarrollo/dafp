import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { CierresImportDialog } from "@/components/CierresImportDialog";
import { EmpresaProvider, EMPRESAS, EMPRESA_KEYS, type VistaKey } from "@/lib/empresa";
import { useDashboardVentas } from "@/lib/use-dashboard-ventas";
import { useGastos, useGastosGeneral } from "@/lib/gastos-store";
import { useCierres, parseFuenteVendedor, VENDEDOR_NOMBRE } from "@/lib/cierres-store";
import { allowedMonths, useSuperuser } from "@/lib/use-superuser";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const VISTAS: { key: VistaKey; label: string }[] = [
  { key: "fjv", label: EMPRESAS.fjv.label },
  { key: "pcp", label: EMPRESAS.pcp.label },
  { key: "general", label: "General" },
];

export function AnnualView() {
  const { isSuper } = useSuperuser();
  const allowed = useMemo(() => (isSuper ? null : allowedMonths()), [isSuper]);
  const [vista, setVista] = useState<VistaKey>("fjv");
  const [year, setYear] = useState<string>(() => String(new Date().getFullYear()));

  const { data } = useDashboardVentas(vista);
  const esGeneral = vista === "general";
  const gastosEmpresa = useGastos(esGeneral ? EMPRESA_KEYS[0] : vista);
  const gastosGeneral = useGastosGeneral();
  const gastosRows = (esGeneral ? gastosGeneral : gastosEmpresa).rows;

  const ventas = useMemo(() => {
    const all = data ?? [];
    return allowed
      ? all.filter((r) => allowed.includes((r.fecha ?? "").slice(0, 7)))
      : all;
  }, [data, allowed]);

  const gastos = useMemo(
    () =>
      allowed
        ? gastosRows.filter((g) => allowed.includes((g.fecha ?? "").slice(0, 7)))
        : gastosRows,
    [gastosRows, allowed],
  );

  const { rows: cierresRows } = useCierres();
  const empresasVista = esGeneral ? EMPRESA_KEYS : [vista];

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const r of ventas) set.add((r.fecha ?? "").slice(0, 4));
    for (const g of gastos) set.add((g.fecha ?? "").slice(0, 4));
    for (const c of cierresRows) {
      if (empresasVista.includes(c.empresa)) set.add(String(c.anio));
    }
    set.add(String(new Date().getFullYear()));
    set.add(year);
    return Array.from(set)
      .filter((y) => /^\d{4}$/.test(y))
      .sort()
      .reverse();
  }, [ventas, gastos, cierresRows, esGeneral, vista, year]);


  const cierresAnio = useMemo(
    () =>
      cierresRows.filter(
        (c) => String(c.anio) === year && empresasVista.includes(c.empresa),
      ),
    [cierresRows, year, esGeneral, vista],
  );

  const meses = useMemo(() => {
    return MESES.map((label, i) => {
      const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
      const vs = ventas.filter((r) => (r.fecha ?? "").startsWith(ym));
      const gs = gastos.filter((g) => (g.fecha ?? "").startsWith(ym));
      const cs = cierresAnio.filter((c) => c.mes === i + 1);
      const ventasTotal = vs.reduce((a, r) => a + (r.total_venta ?? 0), 0);
      const beneficio = vs.reduce((a, r) => a + (r.beneficio ?? 0), 0);
      const canjeado = vs.reduce((a, r) => a + Math.max(0, Number(r.canje_amount ?? 0)), 0);
      const gastosTotal = gs.reduce((a, g) => a + (g.monto ?? 0), 0);
      const cierreEfectivo = cs
        .filter((c) => c.fuente === "efectivo")
        .reduce((a, c) => a + c.monto, 0);
      const cierreBanco = cs.filter((c) => c.fuente === "banco").reduce((a, c) => a + c.monto, 0);
      const cierres = cierreEfectivo + cierreBanco;
      // Ventas/beneficios históricos por vendedor (VA/VT/VC/VS)
      const vendBruto = cs
        .filter((c) => parseFuenteVendedor(c.fuente)?.tipo === "bruto")
        .reduce((a, c) => a + c.monto, 0);
      const vendNeto = cs
        .filter((c) => parseFuenteVendedor(c.fuente)?.tipo === "neto")
        .reduce((a, c) => a + c.monto, 0);
      return {
        mes: label.slice(0, 3),
        label,
        ym,
        ventas: ventasTotal + vendBruto,
        beneficio: beneficio + vendNeto,
        canjeado,
        gastos: gastosTotal,
        cierreEfectivo,
        cierreBanco,
        cierres,
        neto: ventasTotal - canjeado - gastosTotal + cierres,
        albaranes: vs.length,
      };
    });
  }, [ventas, gastos, cierresAnio, year]);

  const tot = useMemo(
    () =>
      meses.reduce(
        (a, m) => ({
          ventas: a.ventas + m.ventas,
          beneficio: a.beneficio + m.beneficio,
          canjeado: a.canjeado + m.canjeado,
          gastos: a.gastos + m.gastos,
          cierres: a.cierres + m.cierres,
          neto: a.neto + m.neto,
          albaranes: a.albaranes + m.albaranes,
        }),
        { ventas: 0, beneficio: 0, canjeado: 0, gastos: 0, cierres: 0, neto: 0, albaranes: 0 },
      ),
    [meses],
  );

  /** Ventas y beneficios del año agrupados por comercial (incluye cierres V* históricos). */
  const comerciales = useMemo(() => {
    const map = new Map<string, { ventas: number; beneficio: number }>();
    const add = (nombre: string, venta: number, beneficio: number) => {
      const cur = map.get(nombre) ?? { ventas: 0, beneficio: 0 };
      cur.ventas += venta;
      cur.beneficio += beneficio;
      map.set(nombre, cur);
    };
    for (const r of ventas) {
      if (!(r.fecha ?? "").startsWith(year)) continue;
      if (r.empleado === "Banco") continue;
      add(r.empleado, r.total_venta ?? 0, r.beneficio ?? 0);
    }
    for (const c of cierresAnio) {
      const v = parseFuenteVendedor(c.fuente);
      if (!v) continue;
      add(
        VENDEDOR_NOMBRE[v.letra],
        v.tipo === "bruto" ? c.monto : 0,
        v.tipo === "neto" ? c.monto : 0,
      );
    }
    return Array.from(map.entries())
      .map(([nombre, t]) => ({ nombre, ...t }))
      .sort((a, b) => b.ventas - a.ventas);
  }, [ventas, cierresAnio, year]);

  /**
   * KPI definitivo del año: Dinero Real Efectivo + TPV + Banco + Gastos Personales.
   * Dinero real = ingresos cobrados − gastos pagados + saldos de cuentas cerradas.
   */
  const totalDefinitivo = useMemo(() => {
    const ingresos = ventas
      .filter((r) => (r.fecha ?? "").startsWith(year))
      .reduce((a, r) => a + (r.total_venta ?? 0), 0);
    const gastosAnio = gastos.filter((g) => (g.fecha ?? "").startsWith(year));
    const gastosTotal = gastosAnio.reduce((a, g) => a + (g.monto ?? 0), 0);
    const personales = gastosAnio
      .filter((g) => g.categoria === "personales")
      .reduce((a, g) => a + (g.monto ?? 0), 0);
    const cierres = cierresAnio
      .filter((c) => c.fuente === "efectivo" || c.fuente === "banco")
      .reduce((a, c) => a + c.monto, 0);
    return ingresos - gastosTotal + cierres + personales;
  }, [ventas, gastos, cierresAnio, year]);






  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contabilidad anual</h1>
          <p className="text-sm text-muted-foreground">
            Resumen mes a mes del año completo · {VISTAS.find((v) => v.key === vista)?.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={vista} onValueChange={(v) => setVista(v as VistaKey)}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISTAS.map((v) => (
                <SelectItem key={v.key} value={v.key} className="text-xs">
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-9 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!esGeneral && (
            <EmpresaProvider key={vista} value={vista}>
              <CsvImportDialog
                trigger={
                  <Button size="sm" variant="outline" className="h-9 gap-2 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    Importar CSV anual
                  </Button>
                }
              />
            </EmpresaProvider>
          )}
          <CierresImportDialog />
        </div>
      </div>

      {!isSuper && (
        <p className="mt-3 text-xs text-muted-foreground">
          Tu cuenta solo puede consultar el mes en curso; los totales anuales aparecerán
          limitados a ese periodo.
        </p>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="border-success/70 bg-success/25 shadow-elevated shadow-success-glow">
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Total ingresos reales · {year}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-success">
              {eur.format(tot.ventas)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ventas del año más cuentas de vendedores importadas
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gradient-accent border-accent/60 shadow-glow">
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-foreground/80">
              Beneficio real · {year}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-accent-foreground">
              {eur.format(tot.beneficio)}
            </p>
            <p className="mt-1 text-xs text-accent-foreground/75">
              Calculado desde PVP − PVD de los albaranes
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          { t: "Gastos", v: tot.gastos, c: "text-destructive" },
          { t: "Saldo cuentas cerradas (BF/EF/BS/ES)", v: tot.cierres, c: "text-info" },
        ].map((k) => (
          <Card key={k.t} className="gradient-card border-border/50 shadow-elevated">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {k.t}
              </p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", k.c)}>
                {eur.format(k.v)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>


      <Card className="mt-6 gradient-card border-border/50 shadow-elevated">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Evolución mensual {year}</CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {tot.albaranes} albaranes
          </Badge>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={meses}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={54} />
              <Tooltip
                formatter={(v: number) => eur.format(v)}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ventas" name="Ventas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              <Bar
                dataKey="beneficio"
                name="Beneficio"
                fill="var(--chart-4)"
                radius={[6, 6, 0, 0]}
              />
              <Bar dataKey="gastos" name="Gastos" fill="var(--chart-5)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="mt-6 gradient-card border-border/50 shadow-elevated">
        <CardHeader>
          <CardTitle className="text-base">Ventas y beneficios por comercial · {year}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Comercial</th>
                <th className="px-4 py-2 text-right font-medium">Ventas (bruto)</th>
                <th className="px-4 py-2 text-right font-medium">Beneficio (neto)</th>
                <th className="px-4 py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {comerciales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No hay ventas registradas en {year}.
                  </td>
                </tr>
              ) : (
                comerciales.map((c) => (
                  <tr key={c.nombre} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2 font-medium">{c.nombre}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{eur.format(c.ventas)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-accent">
                      {eur.format(c.beneficio)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {c.ventas ? `${((c.beneficio / c.ventas) * 100).toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-6 gradient-card border-border/50 shadow-elevated">
        <CardHeader>
          <CardTitle className="text-base">Detalle mes a mes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Mes</th>
                <th className="px-4 py-2 text-right font-medium">Ventas</th>
                <th className="px-4 py-2 text-right font-medium">Beneficio</th>
                <th className="px-4 py-2 text-right font-medium">Canjeos</th>
                <th className="px-4 py-2 text-right font-medium">Gastos</th>
                <th className="px-4 py-2 text-right font-medium">Cuentas ant.</th>
                <th className="px-4 py-2 text-right font-medium">Neto</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.ym} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2">{m.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{eur.format(m.ventas)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-accent">
                    {eur.format(m.beneficio)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {eur.format(m.canjeado)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-destructive">
                    {eur.format(m.gastos)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-info">
                    {m.cierres !== 0 ? eur.format(m.cierres) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right font-semibold tabular-nums",
                      m.neto >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {eur.format(m.neto)}
                  </td>
                </tr>
              ))}
              <tr className="bg-card/60 font-semibold">
                <td className="px-4 py-2">Total {year}</td>
                <td className="px-4 py-2 text-right tabular-nums">{eur.format(tot.ventas)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-accent">
                  {eur.format(tot.beneficio)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {eur.format(tot.canjeado)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-destructive">
                  {eur.format(tot.gastos)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-info">
                  {eur.format(tot.cierres)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right tabular-nums",
                    tot.neto >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {eur.format(tot.neto)}
                </td>
              </tr>

            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
