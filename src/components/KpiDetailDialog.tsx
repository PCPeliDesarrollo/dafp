import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

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
}: {
  detail: KpiDetail | null;
  onOpenChange: (open: boolean) => void;
}) {
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

            <div className="max-h-[55vh] w-full min-w-0 overflow-y-auto overflow-x-hidden pr-2">
              {detail.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No hay movimientos que compongan esta cantidad en el filtro actual.
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2"
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
