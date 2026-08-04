import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Landmark, Loader2, Upload } from "lucide-react";
import type { BankExpense, BankIncome } from "@/lib/bank-csv";
import { parseBankFile } from "@/lib/bank-file";
import { getGastosStore } from "@/lib/gastos-store";
import { getVentasStore } from "@/lib/ventas-store";
import { useEmpresa } from "@/lib/empresa";
import type { VentaRow } from "@/lib/dashboard-mock";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function GastosBankImport() {
  const empresa = useEmpresa();
  const gastosStore = getGastosStore(empresa);
  const ventasStore = getVentasStore(empresa);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    file: string;
    expenses: BankExpense[];
    incomes: BankIncome[];
    ignoredCard: number;
    sinFecha: number;
    ignoredNota: number;
  } | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const res = await parseBankFile(file);
      if (!res.expenses.length && !res.incomes.length) {
        toast.error("No se detectaron movimientos en el archivo");
        setPreview(null);
      } else {
        setPreview({
          file: file.name,
          expenses: res.expenses,
          incomes: res.incomes,
          ignoredCard: res.ignoredCard,
          sinFecha: res.sinFecha,
          ignoredNota: res.ignoredNota ?? 0,
        });
        if (res.sinFecha) {
          toast.warning(
            `${res.sinFecha} apuntes sin fecha legible: no se importan (nunca se colocan en el mes actual)`,
          );
        }
      }
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo leer el archivo");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      let added = 0;
      let omitidos = 0;
      if (preview.expenses.length) {
        const res = await gastosStore.bulkUpsertBank(preview.expenses);
        added = res.added;
        omitidos += res.skipped;
      }
      let ingresos = 0;
      if (preview.incomes.length) {
        // Huella por contenido: si ya existe ese ingreso bancario (misma fecha
        // e importe) no se vuelve a crear.
        const existentes = new Set(
          (ventasStore.get().rows ?? [])
            .filter((r) => r.empleado === "Banco")
            .map((r) => `${r.fecha}|${r.total_venta.toFixed(2)}`),
        );
        const nuevos = preview.incomes.filter(
          (it) => !existentes.has(`${it.fecha}|${it.monto.toFixed(2)}`),
        );
        omitidos += preview.incomes.length - nuevos.length;
        if (nuevos.length) {
          const rows: VentaRow[] = nuevos.map((it) => ({
            id: `bank-${it.referencia}`,
            fecha: it.fecha,
            empleado: "Banco",
            total_venta: it.monto,
            beneficio: 0,
            metodo_pago: "banco",
            pvp: it.monto,
            pvd: null,
            entrega: null,
            efectivo_amount: 0,
            tpv_amount: 0,
            banco_amount: it.monto,
          }));
          const res = await ventasStore.setImported(rows, preview.file);
          ingresos = res.added + res.updated;
        }
      }
      toast.success(
        `Nuevos: ${added} cargos y ${ingresos} ingresos · ${omitidos} ya estaban registrados`,
      );

      setPreview(null);
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudieron guardar los movimientos");
    } finally {
      setBusy(false);
    }
  };

  const totalGastos = preview
    ? preview.expenses.reduce((a, e) => a + e.monto, 0)
    : 0;
  const totalIngresos = preview
    ? preview.incomes.reduce((a, e) => a + e.monto, 0)
    : 0;

  const filas = preview
    ? [
        ...preview.incomes.map((e) => ({ ...e, tipo: "ingreso" as const })),
        ...preview.expenses.map((e) => ({ ...e, tipo: "gasto" as const })),
      ]
    : [];

  return (
    <Card className="gradient-card border-border/50 shadow-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Landmark className="h-4 w-4 text-info" />
          Importar extracto bancario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!preview && (
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 p-8 text-center transition-colors",
              "hover:border-primary/50 hover:bg-muted/50",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              {busy ? "Analizando archivo…" : "Sube el extracto bancario (.xlsx, .xls, .csv o .pdf)"}
            </p>
            <p className="text-xs text-muted-foreground">
              Los cargos (negativos) entran como Gastos Tienda (Banco) y los
              ingresos como ventas (Banco). Solo se ignoran los cobros con
              tarjeta/TPV, que ya se anotan a mano.
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm,.pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </label>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
              <span className="truncate font-medium">{preview.file}</span>
              <span className="text-muted-foreground">
                {preview.expenses.length} cargos · {preview.incomes.length} ingresos ·{" "}
                {preview.ignoredCard} cobros con tarjeta ignorados
                {preview.sinFecha ? ` · ${preview.sinFecha} sin fecha` : ""}
                {preview.ignoredNota
                  ? ` · ${preview.ignoredNota} marcados "no restar"`
                  : ""}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-info/40 bg-info/5 p-3 text-sm">
                Gastos Tienda (Banco):{" "}
                <span className="font-semibold tabular-nums">{eur.format(totalGastos)}</span>
              </div>
              <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
                Ingresos (Banco):{" "}
                <span className="font-semibold tabular-nums">{eur.format(totalIngresos)}</span>
              </div>
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">Fecha</th>
                    <th className="px-2 py-1 text-left">Concepto</th>
                    <th className="px-2 py-1 text-left">Tipo</th>
                    <th className="px-2 py-1 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 80).map((e, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-2 py-1 tabular-nums">{e.fecha}</td>
                      <td className="px-2 py-1 truncate max-w-[220px]">{e.concepto}</td>
                      <td
                        className={cn(
                          "px-2 py-1",
                          e.tipo === "ingreso" ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {e.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {eur.format(e.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={confirm} disabled={busy} className="gap-2">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Importar {filas.length} movimientos
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
