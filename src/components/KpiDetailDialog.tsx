import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Trash2, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


const eurP = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export type KpiDetailItem = {
  id: string;
  fecha?: string;
  concepto: string;
  detalle?: string;
  importe: number;
  /** true = resta al total (gastos) */
  negativo?: boolean;
  /** Origen real del movimiento, para poder eliminarlo */
  sourceKind?: "venta" | "gasto";
  sourceId?: string;
  /** true si el albarán ya tiene PVD (coste) y por tanto beneficio calculado */
  hasPvd?: boolean;
};

export type KpiDetail = {
  title: string;
  formula: string;
  total: number;
  totalLabel?: string;
  items: KpiDetailItem[];
  /** Cuando el KPI es un contador (nº de ventas) en lugar de un importe */
  countMode?: boolean;
};


export function KpiDetailDialog({
  detail,
  onOpenChange,
  onDelete,
  onSetPvd,
}: {
  detail: KpiDetail | null;
  onOpenChange: (open: boolean) => void;
  /** Borra el movimiento real (venta o gasto). Si no se pasa, no se muestra la papelera. */
  onDelete?: (item: KpiDetailItem) => Promise<void> | void;
  /** Fija el PVD (coste) de un albarán; el beneficio se recalcula solo. */
  onSetPvd?: (item: KpiDetailItem, pvd: number) => Promise<void> | void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [pvdEditId, setPvdEditId] = useState<string | null>(null);
  const [pvdValue, setPvdValue] = useState("");
  const [pvdBusy, setPvdBusy] = useState(false);

  useEffect(() => {
    setRemoved(new Set());
    setQuery("");
    setPvdEditId(null);
    setPvdValue("");
  }, [detail?.title]);

  const handleSavePvd = async (it: KpiDetailItem) => {
    if (!onSetPvd) return;
    const pvd = Number(pvdValue.replace(",", "."));
    if (!Number.isFinite(pvd) || pvd < 0) return;
    setPvdBusy(true);
    try {
      await onSetPvd(it, pvd);
      setPvdEditId(null);
      setPvdValue("");
    } finally {
      setPvdBusy(false);
    }
  };

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!detail) return [];
    if (!q) return detail.items;
    return detail.items.filter((it) => {
      const fecha = it.fecha
        ? new Date(it.fecha).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "";
      return [it.concepto, it.detalle ?? "", fecha, String(it.importe)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [detail, query]);

  const visibleTotal = useMemo(
    () =>
      visibleItems.reduce(
        (a, it) => a + (it.negativo ? -Math.abs(it.importe) : Math.abs(it.importe)),
        0,
      ),
    [visibleItems],
  );



  const handleDelete = async (it: KpiDetailItem) => {
    if (!onDelete) return;
    setBusyId(it.id);
    try {
      await onDelete(it);
      setRemoved((prev) => new Set(prev).add(it.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={!!detail} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{detail?.title}</DialogTitle>
          <DialogDescription>{detail?.formula}</DialogDescription>
        </DialogHeader>

        {detail && (
          <>
            <div className="flex items-baseline justify-between rounded-lg border border-border/60 bg-card/60 px-4 py-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {detail.totalLabel ?? "Total contado"}
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {detail.countMode
                  ? `${detail.total} ${detail.total === 1 ? "venta" : "ventas"}`
                  : eurP.format(detail.total)}
              </span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por concepto, fecha o importe…"
                className="h-9 pl-9 text-sm"
              />
            </div>
            {query.trim() && (
              <div className="flex items-baseline justify-between rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {visibleItems.length} resultado{visibleItems.length === 1 ? "" : "s"}
                </span>
                <span className="font-semibold tabular-nums">
                  {eurP.format(visibleTotal)}
                </span>
              </div>
            )}

            <div className="max-h-[55vh] w-full min-w-0 overflow-y-auto overflow-x-hidden pr-2">
              {visibleItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {query.trim()
                    ? "Ningún movimiento coincide con la búsqueda."
                    : "No hay movimientos que compongan esta cantidad en el filtro actual."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {visibleItems.map((it) => (

                    <li
                      key={it.id}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2",
                        removed.has(it.id) && "opacity-40 line-through",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{it.concepto}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {it.fecha && (
                            <Badge variant="outline" className="text-[10px]">
                              {new Date(it.fecha).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </Badge>
                          )}
                          {it.detalle && <span>{it.detalle}</span>}
                        </p>
                        {onSetPvd && it.sourceKind === "venta" && !removed.has(it.id) && (
                          pvdEditId === it.id ? (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={pvdValue}
                                onChange={(e) => setPvdValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleSavePvd(it);
                                  if (e.key === "Escape") setPvdEditId(null);
                                }}
                                placeholder="PVD €"
                                className="h-7 w-24 rounded-md border border-border/60 bg-background px-2 text-xs tabular-nums outline-none focus:border-primary"
                              />
                              <Button
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                disabled={pvdBusy}
                                onClick={() => void handleSavePvd(it)}
                              >
                                {pvdBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                              </Button>
                            </div>
                          ) : it.hasPvd ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPvdEditId(it.id);
                                setPvdValue("");
                              }}
                              className="mt-1 inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-500 hover:bg-blue-500/20"
                              title="PVD añadido. Pincha para cambiarlo"
                            >
                              <CheckCircle2 className="h-3 w-3" /> PVD
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPvdEditId(it.id);
                                setPvdValue("");
                              }}
                              className="mt-1 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                            >
                              + PVD · calcular beneficio
                            </button>
                          )
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums",
                          it.negativo ? "text-destructive" : "text-success",
                        )}
                      >
                        {it.negativo ? "−" : "+"}
                        {eurP.format(Math.abs(it.importe))}
                      </span>
                      {onDelete && it.sourceKind && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 p-0 text-destructive hover:bg-destructive/10"
                          disabled={busyId === it.id || removed.has(it.id)}
                          onClick={() => handleDelete(it)}
                          title="Eliminar movimiento"
                        >
                          {busyId === it.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}

                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {detail.items.length} movimiento{detail.items.length === 1 ? "" : "s"} contado
              {detail.items.length === 1 ? "" : "s"}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
