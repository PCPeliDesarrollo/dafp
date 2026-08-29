import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Landmark, Wallet, Search } from "lucide-react";

import {
  getGastosStore,
  type Gasto,
  type GastoCategoria,
  FUENTE_LABEL,
} from "@/lib/gastos-store";
import { useVista, EMPRESA_KEYS, type EmpresaKey } from "@/lib/empresa";
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
  periodo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoria: GastoCategoria;
  gastos: Gasto[];
  periodo?: string;
}) {
  const vista = useVista();
  const esGeneral = vista === "general";
  const gastosStore = getGastosStore(esGeneral ? EMPRESA_KEYS[0] : (vista as EmpresaKey));
  const puedeBorrar = true;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gastos
      .filter((g) => g.categoria === categoria)
      .filter((g) => {
        if (!q) return true;
        const fecha = fmtDate.format(new Date(g.fecha));
        return [g.concepto, FUENTE_LABEL[g.fuente], fecha, String(g.monto)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [gastos, categoria, query]);
  const total = filtered.reduce((a, g) => a + g.monto, 0);


  const remove = async (id: string) => {
    setBusyId(id);
    try {
      if (esGeneral) {
        await Promise.all(EMPRESA_KEYS.map((k) => getGastosStore(k).remove(id)));
      } else {
        await gastosStore.remove(id);
      }
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

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por concepto, origen, fecha o importe…"
            className="h-9 pl-9 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {query.trim()
              ? "Ningún gasto coincide con la búsqueda."
              : "No hay movimientos en este rango."}
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
                      {puedeBorrar && (
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
                      )}
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
