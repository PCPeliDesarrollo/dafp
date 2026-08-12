import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Loader2 } from "lucide-react";
import { getVentasStore } from "@/lib/ventas-store";
import { useEmpresa } from "@/lib/empresa";
import type { VentaRow } from "@/lib/dashboard-mock";
import { toast } from "sonner";

type Metodo = "efectivo" | "tpv" | "banco";

const EMPLEADOS = ["Ainhoa", "Cristina", "Tomás"];

export function IngresoManualForm() {
  const ventasStore = getVentasStore(useEmpresa());
  const [monto, setMonto] = useState("");
  const [coste, setCoste] = useState("");
  const [concepto, setConcepto] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [empleado, setEmpleado] = useState("Banco");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(monto.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Introduce un importe válido");
      return;
    }
    // Sin coste indicado => PVD 0, así el beneficio es el importe completo.
    const pvd = coste.trim() ? Number(coste.replace(",", ".")) : 0;
    if (!Number.isFinite(pvd) || pvd < 0) {
      toast.error("El coste (PVD) no es válido");
      return;
    }
    setSaving(true);
    try {
      const slug = (concepto.trim() || "ingreso")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      const row: VentaRow = {
        // Mismo día + mismo concepto + mismo método => se sobrescribe, no duplica.
        id: `man-${fecha}-${metodo}-${slug}`,
        fecha,
        empleado,
        total_venta: n,
        beneficio: n - pvd,
        metodo_pago: metodo,
        pvp: n,
        pvd,
        entrega: null,
        efectivo_amount: metodo === "efectivo" ? n : 0,
        tpv_amount: metodo === "tpv" ? n : 0,
        banco_amount: metodo === "banco" ? n : 0,
      };
      await ventasStore.setImported([row], concepto.trim() || "Ingreso manual");
      toast.success("Ingreso registrado");
      setMonto("");
      setCoste("");
      setConcepto("");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo guardar el ingreso");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gradient-card border-border/50 shadow-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <TrendingUp className="h-4 w-4 text-success" />
          Ingresos a mano
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Importe (€)</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Método de cobro</Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v as Metodo)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tpv">TPV (tarjeta)</SelectItem>
                <SelectItem value="banco">Banco / transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Comercial</Label>
            <Select value={empleado} onValueChange={setEmpleado}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Banco">Sin asignar</SelectItem>
                {EMPLEADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Concepto</Label>
            <Input
              placeholder="p. ej. Venta mostrador sin albarán"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Coste / PVD (opcional)</Label>
            <Input
              inputMode="decimal"
              placeholder="Déjalo vacío si no hay coste"
              value={coste}
              onChange={(e) => setCoste(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Si lo rellenas, el beneficio se calcula como importe − coste.
            </p>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Registrar ingreso
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
