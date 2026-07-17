import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Landmark, Loader2, Upload } from "lucide-react";
import type { BankExpense } from "@/lib/bank-csv";
import { parseBankFile } from "@/lib/bank-file";
import { gastosStore } from "@/lib/gastos-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function GastosBankImport() {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    file: string;
    expenses: BankExpense[];
    ignored: number;
  } | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const res = await parseBankFile(file);
      if (!res.expenses.length) {
        toast.error("No se detectaron cargos negativos en el archivo");
        setPreview(null);
      } else {
        setPreview({ file: file.name, expenses: res.expenses, ignored: res.ignoredPositives });
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
      const { added } = await gastosStore.bulkUpsertBank(preview.expenses);
      toast.success(
        `Importados ${added} nuevos cargos como Gastos Tienda (Banco)`,
      );
      setPreview(null);
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudieron guardar los gastos");
    } finally {
      setBusy(false);
    }
  };

  const total = preview
    ? preview.expenses.reduce((a, e) => a + e.monto, 0)
    : 0;

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
              Se ignoran los ingresos (positivos). Solo se importan los cargos
              (negativos) como Gastos Tienda (Banco).
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
                {preview.expenses.length} cargos · {preview.ignored} ingresos ignorados
              </span>
            </div>
            <div className="rounded-lg border border-info/40 bg-info/5 p-3 text-sm">
              Total a importar como <strong>Gastos Tienda (Banco)</strong>:{" "}
              <span className="font-semibold tabular-nums">{eur.format(total)}</span>
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">Fecha</th>
                    <th className="px-2 py-1 text-left">Concepto</th>
                    <th className="px-2 py-1 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.expenses.slice(0, 50).map((e, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-2 py-1 tabular-nums">{e.fecha}</td>
                      <td className="px-2 py-1 truncate max-w-[240px]">{e.concepto}</td>
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
                Importar {preview.expenses.length} cargos
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
