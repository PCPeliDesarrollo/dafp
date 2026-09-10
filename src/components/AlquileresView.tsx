import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Home, Zap, Trash2, Droplets, Receipt, Plus, CheckCircle2 } from "lucide-react";
import {
  alquStore,
  useAlqu,
  MESES,
  eur,
  trimestreDe,
  mesAnterior,
  calcTotalLuz,
  basuraYaCobrada,
  type Cobro,
  type EstadoBasura,
  type FrecuenciaBasura,
  type Inquilino,
} from "@/lib/alqu-store";

type SubVista = "mensualidad" | "inquilinos" | "recibos";

const FRECUENCIAS: FrecuenciaBasura[] = ["Mensual", "Trimestral", "Bimestral"];

const SUBTABS: { key: SubVista; label: string }[] = [
  { key: "mensualidad", label: "Mensualidad y lecturas" },
  { key: "recibos", label: "Recibos" },
  { key: "inquilinos", label: "Inquilinos" },
];

function num(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------- Mensualidad ------------------------------ */

function FilaMensual({
  inq,
  cobros,
  anio,
  mes,
}: {
  inq: Inquilino;
  cobros: Cobro[];
  anio: number;
  mes: number;
}) {
  const existente = cobros.find(
    (c) => c.inquilino_id === inq.id && c.anio === anio && c.mes === mes,
  );
  const prevPer = mesAnterior(anio, mes);
  const previo = cobros.find(
    (c) => c.inquilino_id === inq.id && c.anio === prevPer.anio && c.mes === prevPer.mes,
  );
  const lecturaAnteriorAuto = existente?.lectura_anterior ?? previo?.lectura_actual ?? 0;
  const yaCobradaBasura = basuraYaCobrada(inq, cobros, anio, mes);

  const [lecturaAnterior, setLecturaAnterior] = useState(String(lecturaAnteriorAuto));
  const [lecturaActual, setLecturaActual] = useState(
    existente ? String(existente.lectura_actual) : "",
  );
  const [agua, setAgua] = useState(existente ? String(existente.importe_agua) : "0");
  const [alquiler, setAlquiler] = useState(
    String(existente?.importe_alquiler || inq.importe_alquiler),
  );
  const [basuraImporte, setBasuraImporte] = useState(
    String(existente?.importe_basura_cobrado || inq.importe_basura),
  );
  const [notas, setNotas] = useState(existente?.notas ?? "");
  const [fechaCobro, setFechaCobro] = useState(existente?.fecha_cobro ?? "");
  const [basura, setBasura] = useState(
    existente ? existente.aplica_basura_mes : !yaCobradaBasura,
  );
  const [quienCobra, setQuienCobra] = useState(existente?.quien_cobra ?? "");
  const [saving, setSaving] = useState(false);

  const kw = Math.max(0, num(lecturaActual) - num(lecturaAnterior));
  const totalLuz = calcTotalLuz(inq, kw);
  const importeBasura = basura ? num(basuraImporte) : 0;
  const total = num(alquiler) + totalLuz + importeBasura + num(agua);
  const estadoBasura: EstadoBasura = basura
    ? "Pendiente de cobro"
    : yaCobradaBasura
      ? "Cobrado este trimestre"
      : "No corresponde pagar";
  const cobrado = existente?.estado_pago === "Cobrado";

  const guardar = async (modo: boolean | "pendiente") => {
    const marcarCobrado = modo === true;
    const marcarPendiente = modo === "pendiente";
    setSaving(true);
    try {
      await alquStore.saveCobro({
        ...(existente ? { id: existente.id } : {}),
        inquilino_id: inq.id,
        anio,
        mes,
        importe_alquiler: num(alquiler),
        notas: notas.trim() || null,
        lectura_anterior: num(lecturaAnterior),
        lectura_actual: num(lecturaActual),
        kw_consumidos: kw,
        total_luz: totalLuz,
        aplica_basura_mes: basura,
        estado_basura_trimestre: marcarCobrado && basura ? "Cobrado este trimestre" : estadoBasura,
        importe_basura_cobrado: importeBasura,
        importe_agua: num(agua),
        total_a_cobrar: total,
        fecha_cobro: marcarPendiente
          ? null
          : fechaCobro || (marcarCobrado ? new Date().toISOString().slice(0, 10) : null),
        quien_cobra: quienCobra || null,
        estado_pago: marcarPendiente
          ? "Pendiente"
          : marcarCobrado
            ? "Cobrado"
            : (existente?.estado_pago ?? "Pendiente"),
      });
      toast.success(marcarCobrado ? `Cobro registrado · ${inq.inquilino}` : "Guardado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4 border-border/60 bg-card/60 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">
            {inq.inquilino}
            {cobrado && (
              <Badge className="gap-1 bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" /> Cobrado
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{inq.direccion}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total recibo</p>
          <p className="text-xl font-extrabold">{eur(total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Lectura anterior</Label>
          <Input
            inputMode="decimal"
            value={lecturaAnterior}
            onChange={(e) => setLecturaAnterior(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lectura actual</Label>
          <Input
            inputMode="decimal"
            value={lecturaActual}
            onChange={(e) => setLecturaActual(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Agua (€)</Label>
          <Input inputMode="decimal" value={agua} onChange={(e) => setAgua(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Alquiler (€)</Label>
          <Input
            inputMode="decimal"
            value={alquiler}
            onChange={(e) => setAlquiler(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Basura (€)</Label>
          <Input
            inputMode="decimal"
            value={basuraImporte}
            onChange={(e) => setBasuraImporte(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quién cobra</Label>
          <Input value={quienCobra} onChange={(e) => setQuienCobra(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha de cobro</Label>
          <Input
            type="date"
            value={fechaCobro}
            onChange={(e) => setFechaCobro(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notas de este mes</Label>
        <Textarea
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder={`Notas de ${MESES[mes - 1]} ${anio}…`}
        />
      </div>


      <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-4">
        <div>
          <span className="text-muted-foreground">Alquiler</span>
          <p className="font-semibold">{eur(num(alquiler))}</p>
        </div>
        <div>
          <span className="text-muted-foreground">
            Luz · {kw.toLocaleString("es-ES")} KW × {inq.precio_kw} + {eur(inq.minimo_luz)}
          </span>
          <p className="font-semibold">{eur(totalLuz)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Basura ({inq.frecuencia_basura})</span>
          <p className="font-semibold">{eur(importeBasura)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Agua</span>
          <p className="font-semibold">{eur(num(agua))}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={basura} onCheckedChange={(v) => setBasura(v === true)} />
          Cobrar basura este mes
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold",
              yaCobradaBasura && !basura
                ? "bg-amber-500/15 text-amber-500"
                : "bg-muted text-muted-foreground",
            )}
          >
            {yaCobradaBasura && !basura
              ? "Ya pagado en este trimestre (No corresponde)"
              : estadoBasura}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {existente && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={saving}
              onClick={async () => {
                if (!confirm(`¿Borrar el recibo de ${inq.inquilino}?`)) return;
                try {
                  await alquStore.removeCobro(existente.id);
                  toast.success("Recibo borrado");
                } catch {
                  toast.error("No se pudo borrar");
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={saving} onClick={() => guardar(false)}>
            Guardar
          </Button>
          {cobrado ? (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => guardar("pendiente")}>
              Marcar pendiente
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={saving}
              className="gradient-primary text-primary-foreground"
              onClick={() => guardar(true)}
            >
              Marcar cobrado
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------- Inquilinos ------------------------------ */

function InquilinoDialog({ inq }: { inq: Inquilino | null }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    inquilino: inq?.inquilino ?? "",
    direccion: inq?.direccion ?? "",
    importe_alquiler: String(inq?.importe_alquiler ?? 0),
    importe_basura: String(inq?.importe_basura ?? 0),
    frecuencia_basura: (inq?.frecuencia_basura ?? "Trimestral") as FrecuenciaBasura,
    iva: String(inq?.iva ?? 21),
    precio_kw: String(inq?.precio_kw ?? 0),
    minimo_luz: String(inq?.minimo_luz ?? 10),
    notas: inq?.notas ?? "",
  });

  const guardar = async () => {
    if (!f.inquilino.trim()) {
      toast.error("Indica el nombre del inquilino");
      return;
    }
    try {
      await alquStore.saveInquilino(inq?.id ?? null, {
        inquilino: f.inquilino.trim(),
        direccion: f.direccion.trim(),
        importe_alquiler: num(f.importe_alquiler),
        importe_basura: num(f.importe_basura),
        frecuencia_basura: f.frecuencia_basura,
        iva: num(f.iva),
        precio_kw: num(f.precio_kw),
        minimo_luz: num(f.minimo_luz),
        notas: f.notas.trim() || null,
      });
      toast.success("Guardado");
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {inq ? (
          <Button variant="outline" size="sm">
            Editar
          </Button>
        ) : (
          <Button size="sm" className="gradient-primary text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" /> Nuevo inquilino
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{inq ? inq.inquilino : "Nuevo inquilino"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Inquilino</Label>
            <Input value={f.inquilino} onChange={(e) => setF({ ...f, inquilino: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Dirección</Label>
            <Input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alquiler (€)</Label>
            <Input
              inputMode="decimal"
              value={f.importe_alquiler}
              onChange={(e) => setF({ ...f, importe_alquiler: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Basura (€)</Label>
            <Input
              inputMode="decimal"
              value={f.importe_basura}
              onChange={(e) => setF({ ...f, importe_basura: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Frecuencia basura</Label>
            <Select
              value={f.frecuencia_basura}
              onValueChange={(v) => setF({ ...f, frecuencia_basura: v as FrecuenciaBasura })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRECUENCIAS.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IVA (%)</Label>
            <Input
              inputMode="decimal"
              value={f.iva}
              onChange={(e) => setF({ ...f, iva: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Precio KW (€)</Label>
            <Input
              inputMode="decimal"
              value={f.precio_kw}
              onChange={(e) => setF({ ...f, precio_kw: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mínimo luz (€)</Label>
            <Input
              inputMode="decimal"
              value={f.minimo_luz}
              onChange={(e) => setF({ ...f, minimo_luz: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Notas</Label>
            <Input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
          </div>
        </div>
        <Button onClick={guardar} className="gradient-primary text-primary-foreground">
          Guardar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- Vista --------------------------------- */

export function AlquileresView() {
  const { inquilinos, cobros, loaded } = useAlqu();
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [sub, setSub] = useState<SubVista>("mensualidad");

  const anios = useMemo(() => {
    const base = now.getFullYear();
    return [base - 2, base - 1, base, base + 1];
  }, [now]);

  const delMes = cobros.filter((c) => c.anio === anio && c.mes === mes);
  const totalMes = delMes.reduce((a, c) => a + c.total_a_cobrar, 0);
  const cobradoMes = delMes
    .filter((c) => c.estado_pago === "Cobrado")
    .reduce((a, c) => a + c.total_a_cobrar, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <Home className="h-6 w-6 text-primary" /> ALQU · Alquileres
          </h2>
          <p className="text-xs text-muted-foreground">
            {MESES[mes - 1]} {anio} · Trimestre Q{trimestreDe(mes)}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total a cobrar · {MESES[mes - 1]}
          </p>
          <p className="text-2xl font-extrabold">{eur(totalMes)}</p>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-[10px] uppercase tracking-wide text-emerald-600">Ya cobrado</p>
          <p className="text-2xl font-extrabold text-emerald-600">{eur(cobradoMes)}</p>
        </Card>
        <Card className="border-border/60 bg-card/60 p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pendiente</p>
          <p className="text-2xl font-extrabold">{eur(totalMes - cobradoMes)}</p>
        </Card>
      </div>

      <div className="inline-flex flex-wrap rounded-xl border border-border/60 bg-card/60 p-1 backdrop-blur">
        {SUBTABS.map((t) => (
          <Button
            key={t.key}
            variant="ghost"
            size="sm"
            onClick={() => setSub(t.key)}
            className={cn(
              "h-9 rounded-lg px-4 text-xs font-semibold",
              sub === t.key
                ? "gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {!loaded && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {sub === "mensualidad" && (
        <div className="grid gap-4">
          {inquilinos.map((inq) => (
            <FilaMensual
              key={`${inq.id}-${anio}-${mes}`}
              inq={inq}
              cobros={cobros}
              anio={anio}
              mes={mes}
            />
          ))}
        </div>
      )}

      {sub === "recibos" && (
        <div className="grid gap-4 md:grid-cols-2">
          {delMes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no hay recibos guardados para este mes.
            </p>
          )}
          {delMes.map((c) => {
            const inq = inquilinos.find((i) => i.id === c.inquilino_id);
            if (!inq) return null;
            return (
              <Card key={c.id} className="space-y-3 border-border/60 bg-card/60 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold">{inq.inquilino}</p>
                    <p className="text-xs text-muted-foreground">{inq.direccion}</p>
                  </div>
                  <Badge
                    className={cn(
                      c.estado_pago === "Cobrado"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-amber-500/15 text-amber-500",
                    )}
                  >
                    {c.estado_pago}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Receipt className="h-4 w-4" /> Alquiler
                    </span>
                    <span className="font-semibold">
                      {eur(c.importe_alquiler || inq.importe_alquiler)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="h-4 w-4" /> Luz ({c.lectura_anterior} →{" "}
                      {c.lectura_actual} = {c.kw_consumidos} KW × {inq.precio_kw} +{" "}
                      {eur(inq.minimo_luz)})
                    </span>
                    <span className="font-semibold">{eur(c.total_luz)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Trash2 className="h-4 w-4" /> Basura ({inq.frecuencia_basura})
                    </span>
                    <span className="font-semibold">{eur(c.importe_basura_cobrado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Droplets className="h-4 w-4" /> Agua
                    </span>
                    <span className="font-semibold">{eur(c.importe_agua)}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase">Total a pagar</span>
                  <span className="text-xl font-extrabold">{eur(c.total_a_cobrar)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {c.estado_basura_trimestre}
                  {c.fecha_cobro ? ` · Cobrado el ${c.fecha_cobro}` : ""}
                  {c.quien_cobra ? ` · ${c.quien_cobra}` : ""}
                </p>
                {c.notas && (
                  <p className="rounded-md bg-muted/40 p-2 text-[11px] whitespace-pre-wrap">
                    <span className="font-semibold">Notas:</span> {c.notas}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {sub === "inquilinos" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <InquilinoDialog inq={null} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {inquilinos.map((inq) => (
              <Card
                key={inq.id}
                className="flex flex-wrap items-center justify-between gap-3 border-border/60 bg-card/60 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{inq.inquilino}</p>
                  <p className="truncate text-xs text-muted-foreground">{inq.direccion}</p>
                  <p className="mt-1 text-xs">
                    {eur(inq.importe_alquiler)} · KW {inq.precio_kw} · mín. {eur(inq.minimo_luz)} ·
                    basura {eur(inq.importe_basura)} {inq.frecuencia_basura} · IVA {inq.iva}%
                  </p>
                  {inq.notas && (
                    <p className="text-[11px] text-muted-foreground">Notas: {inq.notas}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <InquilinoDialog inq={inq} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={async () => {
                      if (!confirm(`¿Eliminar a ${inq.inquilino}?`)) return;
                      try {
                        await alquStore.removeInquilino(inq.id);
                        toast.success("Eliminado");
                      } catch {
                        toast.error("No se pudo eliminar");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
