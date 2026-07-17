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
import { Wallet, Loader2 } from "lucide-react";
import { gastosStore, type GastoCategoria } from "@/lib/gastos-store";
import { toast } from "sonner";

export function GastosCashForm() {
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<GastoCategoria>("tienda");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(monto.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Introduce un importe válido");
      return;
    }
    if (!concepto.trim()) {
      toast.error("Añade un concepto");
      return;
    }
    setSaving(true);
    try {
      await gastosStore.addManual({
        fecha,
        monto: n,
        concepto: concepto.trim(),
        categoria,
      });
      toast.success("Gasto registrado");
      setMonto("");
      setConcepto("");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo guardar el gasto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gradient-card border-border/50 shadow-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Wallet className="h-4 w-4 text-warning" />
          Gastos en efectivo
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
          <div className="sm:col-span-2">
            <Label className="text-xs">Concepto</Label>
            <Input
              placeholder="p. ej. Compra material"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Categoría</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as GastoCategoria)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tienda">Gastos Tienda</SelectItem>
                <SelectItem value="personales">Gastos Personales</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Registrar gasto
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
