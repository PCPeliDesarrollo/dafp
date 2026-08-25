import { useCallback, useMemo, useRef, useState } from "react";
import {
  Archive,
  ClipboardPaste,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  cierresStore,
  cierreFuenteLabel,
  useCierres,
  type CierreFuente,
  type CierreInput,
} from "@/lib/cierres-store";
import {
  CIERRE_CODIGOS,
  MESES_ES,
  VENDEDOR_LETRA,
  formatMesAnio,
  parseCierresText,
} from "@/lib/cierres-parser";
import { readCierresImage } from "@/lib/cierres-ai.functions";
import { EMPRESAS, EMPRESA_KEYS, type EmpresaKey } from "@/lib/empresa";

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

async function toCompactDataUrl(source: Blob, maxSide = 1800): Promise<string> {
  const original = await fileToDataUrl(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("imagen no válida"));
      el.src = original;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale >= 1 && original.length < 1_200_000) return original;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", 0.85);
    return out.length > 30 ? out : original;
  } catch {
    return original;
  }
}

export function CierresImportDialog() {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  /** Empresa a la que pertenecen los códigos de vendedor (VA/VT/VC/VS) de la foto. */
  const [empresaVend, setEmpresaVend] = useState<EmpresaKey>("fjv");
  const [text, setText] = useState("");
  const [pending, setPending] = useState<CierreInput[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const { rows } = useCierres();

  const historial = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => b.anio - a.anio || b.mes - a.mes || a.empresa.localeCompare(b.empresa)),
    [rows],
  );

  const analizar = useCallback(
    (raw: string) => {
      const res = parseCierresText(raw, { mes, anio, empresaVendedores: empresaVend });
      setPending(res.entries);
      setWarnings(res.warnings);
      setMessage(null);
    },
    [mes, anio, empresaVend],
  );

  const leerImagen = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setMessage(null);
      try {
        const imageDataUrl = await toCompactDataUrl(blob);
        const v = await readCierresImage({ data: { imageDataUrl } });
        const entries: CierreInput[] = [];
        const map = new Map<string, CierreInput>();
        for (const e of v.entries) {
          const m = e.mes ?? mes;
          const y = e.anio ?? anio;
          const esVend = e.codigo.startsWith("V");
          const empresa: EmpresaKey = esVend ? empresaVend : CIERRE_CODIGOS[e.codigo]!.empresa;
          const letra = esVend ? VENDEDOR_LETRA[e.codigo.slice(1)] : undefined;
          if (esVend && !letra) continue;
          const tipo = e.tipo === "neto" ? "neto" : "bruto";
          const fuente: CierreFuente = esVend
            ? (`${tipo}:${letra}` as CierreFuente)
            : CIERRE_CODIGOS[e.codigo]!.fuente;
          map.set(`${empresa}-${y}-${m}-${fuente}`, {
            empresa,
            anio: y,
            mes: m,
            fuente,
            codigo: esVend ? `${e.codigo} (${tipo})` : e.codigo,
            monto: e.monto,
            notas: null,
          });
        }
        entries.push(...map.values());
        setPending(entries);
        setWarnings(
          entries.length
            ? []
            : ["La captura no contenía códigos BF, EF, BS, ES ni VA/VT/VC/VS."],
        );
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Error leyendo la captura");
      } finally {
        setBusy(false);
      }
    },
    [mes, anio],
  );

  const pegarCaptura = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          await leerImagen(blob);
          return;
        }
      }
      setMessage("No hay ninguna imagen en el portapapeles.");
    } catch {
      setMessage("No se pudo leer el portapapeles. Usa el botón de subir imagen.");
    }
  };

  const guardar = async () => {
    if (!pending.length) return;
    setBusy(true);
    try {
      await cierresStore.upsert(pending);
      setMessage(`Guardados ${pending.length} importes de cierre.`);
      setPending([]);
      setText("");
    } catch {
      setMessage("No se pudieron guardar los cierres.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Archive className="h-4 w-4" />
          Cuentas anteriores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cierres de meses y años anteriores</DialogTitle>
          <DialogDescription>
            Importes finales ya cerrados. BF = Banco FJV, EF = Efectivo FJV, BS = Banco PCP,
            ES = Efectivo PCP. Vendedores: VA = Ainhoa, VT = Tomás, VC = Cristina, VS/VO = Otros
            («bruto» = ventas, «neto» = beneficio). Sube un CSV, pega el texto o pega una captura.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Mes por defecto</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_ES.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Año por defecto</Label>
              <Input
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value) || now.getFullYear())}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Empresa de los vendedores (VA / VT / VC / VS)</Label>
            <Select
              value={empresaVend}
              onValueChange={(v) => setEmpresaVend(v as EmpresaKey)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPRESA_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {EMPRESAS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Si el archivo o la captura indica el mes/año, se usa ese; si no, se usan estos. Los
            códigos BF/EF/BS/ES ya llevan su empresa; los de vendedor usan la empresa elegida
            arriba.
          </p>

          <div className="grid gap-1.5">
            <Label>Texto o CSV</Label>
            <Textarea
              rows={6}
              placeholder={"JULIO 2025\nBF 12.450,20\nEF 3.120\nBS 8.900,15\nES 1.450"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={(e) => e.target.value.trim() && analizar(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => analizar(text)}
              disabled={!text.trim() || busy}
            >
              Analizar texto
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <Upload className="h-4 w-4" />
              Subir CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => imgRef.current?.click()}
              disabled={busy}
            >
              <ImagePlus className="h-4 w-4" />
              Subir captura
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={pegarCaptura}
              disabled={busy}
            >
              <ClipboardPaste className="h-4 w-4" />
              Pegar captura
            </Button>
            {busy && <Loader2 className="h-4 w-4 animate-spin self-center" />}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const raw = await f.text();
              setText(raw);
              analizar(raw);
            }}
          />
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) leerImagen(f);
            }}
          />

          {warnings.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}

          {pending.length > 0 && (
            <div className="rounded-xl border border-border/60">
              <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                Se va a guardar ({pending.length})
              </div>
              <div className="divide-y divide-border/50">
                {pending.map((p) => (
                  <div
                    key={`${p.empresa}-${p.anio}-${p.mes}-${p.fuente}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {p.codigo} · {EMPRESAS[p.empresa].label} ·{" "}
                      {cierreFuenteLabel(p.fuente)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatMesAnio(p.mes, p.anio)}
                    </span>
                    <span className="font-semibold tabular-nums">{eur.format(p.monto)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end p-3">
                <Button size="sm" onClick={guardar} disabled={busy}>
                  Guardar cierres
                </Button>
              </div>
            </div>
          )}

          {message && <p className="text-xs text-muted-foreground">{message}</p>}

          <div className="rounded-xl border border-border/60">
            <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              Cierres guardados ({historial.length})
            </div>
            <div className="max-h-64 divide-y divide-border/50 overflow-y-auto">
              {historial.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">Todavía no hay cierres guardados.</p>
              )}
              {historial.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {formatMesAnio(c.mes, c.anio)} · {EMPRESAS[c.empresa].label} ·{" "}
                    {cierreFuenteLabel(c.fuente)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{eur.format(c.monto)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => cierresStore.remove(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
