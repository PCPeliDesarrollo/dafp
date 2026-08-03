import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Landmark, Wallet } from "lucide-react";
import {
  getGastosStore,
  type Gasto,
  type GastoCategoria,
  FUENTE_LABEL,
} from "@/lib/gastos-store";
import { useEmpresa } from "@/lib/empresa";
import { toast } from "sonner";

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const fmtDate = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function GastosListDialog({
  open,
  onOpenChange,
  categoria,
  gastos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoria: GastoCategoria;
  gastos: Gasto[];
}) {
  const gastosStore = getGastosStore(useEmpresa());
  const [busyId, setBusyId] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      gastos
        .filter((g) => g.categoria === categoria)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    [gastos, categoria],
  );
  const total = filtered.reduce((a, g) => a + g.monto, 0);

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await gastosStore.remove(id);
      toast.success("Gasto eliminado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  const title =
    categoria === "personales" ? "Gastos Personales" : "Gastos Tienda";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {filtered.length} movimientos · Total{" "}
            <span className="font-semibold text-foreground">
              {eur.format(total)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay movimientos en este rango.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Concepto</th>
                  <th className="px-3 py-2 text-left font-medium">Origen</th>
                  <th className="px-3 py-2 text-right font-medium">Importe</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-t border-border/40">
                    <td className="px-3 py-2 tabular-nums text-xs">
                      {fmtDate.format(new Date(g.fecha))}
                    </td>
                    <td className="px-3 py-2">
                      <p className="line-clamp-2 max-w-[280px]">{g.concepto || "—"}</p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] font-normal"
                      >
                        {g.fuente === "banco" ? (
                          <Landmark className="h-3 w-3" />
                        ) : (
                          <Wallet className="h-3 w-3" />
                        )}
                        {FUENTE_LABEL[g.fuente]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {eur.format(g.monto)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        disabled={busyId === g.id}
                        onClick={() => remove(g.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
