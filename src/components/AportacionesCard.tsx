import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { HandCoins, Trash2, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  addAportacion,
  deleteAportacion,
  setAportacionDevuelta,
  type Aportacion,
} from "@/lib/aportaciones-store";
import { EMPRESAS, type EmpresaKey } from "@/lib/empresa";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const fmt = (d: string) => new Date(d).toLocaleDateString("es-ES");

type Filtro = "todas" | "pendientes" | "devueltas";
type FiltroFuente = "todas" | "efectivo" | "banco";

export function AportacionesCard({
  rows,
  empresaDestino,
  dineroS,
}: {
  rows: Aportacion[];
  /** null en vista General: no se pueden añadir. */
  empresaDestino: EmpresaKey | null;
  dineroS: number;
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [fuente, setFuente] = useState<"efectivo" | "banco">("efectivo");
  const [busy, setBusy] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [filtroFuente, setFiltroFuente] = useState<FiltroFuente>("todas");

  const pendiente = rows.filter((r) => !r.devuelta).reduce((a, r) => a + r.monto, 0);
  const puedePagar = pendiente > 0 && dineroS >= pendiente;
  const visibles = useMemo(
    () =>
      rows
        .filter((r) => (filtro === "todas" ? true : filtro === "pendientes" ? !r.devuelta : r.devuelta))
        .filter((r) => (filtroFuente === "todas" ? true : r.fuente === filtroFuente)),
    [rows, filtro, filtroFuente],
  );

  const add = async () => {
    const m = Number(monto.replace(",", "."));
    if (!empresaDestino || !Number.isFinite(m) || m <= 0) {
      toast.error("Pon un importe válido");
      return;
    }
    setBusy(true);
    try {
      await addAportacion({ empresa: empresaDestino, fecha, monto: m, concepto: concepto.trim(), fuente });
      setMonto("");
      setConcepto("");
      toast.success("Aportación anotada");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
      active ? "border-primary bg-primary/15 text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/50"
    }`;

  return (
    <Card className="border-warning/40 shadow-elevated">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-warning" /> Aportaciones del jefe
          </span>
          <span className="text-sm tabular-nums">
            Pendiente: <span className="font-semibold text-warning">{eur.format(pendiente)}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {puedePagar && (
          <div className="flex items-start gap-2 rounded-lg border border-success/50 bg-success/10 p-3 text-sm">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p>
              <span className="font-semibold">¡Puedes pagar las aportaciones!</span> El Dinero S ({eur.format(dineroS)})
              ya cubre lo pendiente ({eur.format(pendiente)}).
            </p>
          </div>
        )}
        {!puedePagar && pendiente > 0 && (
          <p className="text-xs text-muted-foreground">
            Faltan {eur.format(pendiente - Math.max(dineroS, 0))} de Dinero S para poder devolverlas.
          </p>
        )}

        {empresaDestino ? (
          <div className="grid gap-2 sm:grid-cols-[130px_110px_1fr_auto_auto]">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9" />
            <Input inputMode="decimal" placeholder="Importe" value={monto} onChange={(e) => setMonto(e.target.value)} className="h-9" />
            <Input placeholder="Concepto (opcional)" value={concepto} onChange={(e) => setConcepto(e.target.value)} className="h-9" />
            <select
              value={fuente}
              onChange={(e) => setFuente(e.target.value as "efectivo" | "banco")}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="efectivo">Efectivo</option>
              <option value="banco">Banco</option>
            </select>
            <Button size="sm" className="h-9" disabled={busy} onClick={add}>
              Añadir
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Para añadir aportaciones entra en FJV o PCP.</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {(["pendientes", "devueltas", "todas"] as Filtro[]).map((f) => (
            <button key={f} type="button" className={chip(filtro === f)} onClick={() => setFiltro(f)}>
              {f === "pendientes" ? "Pendientes" : f === "devueltas" ? "Devueltas" : "Todas"}
            </button>
          ))}
          <span className="mx-1 w-px bg-border" />
          {(["todas", "efectivo", "banco"] as FiltroFuente[]).map((f) => (
            <button key={f} type="button" className={chip(filtroFuente === f)} onClick={() => setFiltroFuente(f)}>
              {f === "todas" ? "Efectivo y banco" : f === "efectivo" ? "Efectivo" : "Banco"}
            </button>
          ))}
        </div>

        {visibles.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">No hay aportaciones.</p>
        ) : (
          <ul className="divide-y divide-border/40 rounded-lg border border-border/60 text-sm">
            {visibles.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  checked={a.devuelta}
                  onCheckedChange={async (v) => {
                    try {
                      await setAportacionDevuelta(a.id, !!v);
                    } catch (e: any) {
                      toast.error(e?.message ?? "No se pudo actualizar");
                    }
                  }}
                  title="Devuelta"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {a.concepto || "Aportación"}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {EMPRESAS[a.empresa]?.label ?? a.empresa} · {a.fuente === "banco" ? "Banco" : "Efectivo"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(a.fecha)}
                    {a.devuelta && a.fecha_devolucion ? ` · Devuelta el ${fmt(a.fecha_devolucion)}` : ""}
                  </p>
                </div>
                <span className={`tabular-nums font-semibold ${a.devuelta ? "text-muted-foreground line-through" : "text-warning"}`}>
                  {eur.format(a.monto)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (!confirm("¿Eliminar esta aportación?")) return;
                    await deleteAportacion(a.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">Marca la casilla cuando se la devolváis. Lo pendiente resta del TOTAL; no suma al Dinero S.</p>
      </CardContent>
    </Card>
  );
}
