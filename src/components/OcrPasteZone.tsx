import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImagePlus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  composeAlbaran,
  type ParsedAlbaran,
  type StockLetter,
} from "@/lib/albaran-parser";
import { readAlbaranImage } from "@/lib/albaran-ai.functions";
import { getVentasStore } from "@/lib/ventas-store";
import { useEmpresa } from "@/lib/empresa";

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

type Status =
  | { kind: "idle" }
  | { kind: "ocr"; progress: number }
  | { kind: "parsed"; parsed: ParsedAlbaran; text: string }
  | { kind: "saving"; parsed: ParsedAlbaran; text: string }
  | { kind: "saved"; parsed: ParsedAlbaran }
  | { kind: "error"; message: string };

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

/**
 * Reduce la captura antes de enviarla al servidor: las capturas de móvil pesan
 * varios MB y hacían fallar la petición. Si algo falla, devuelve el original.
 */
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


export function OcrPasteZone() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fechaOverride, setFechaOverride] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const runOcr = useCallback(async (source: File | Blob) => {
    setStatus({ kind: "ocr", progress: 5 });
    try {
      const imageDataUrl = await toCompactDataUrl(source);
      setStatus({ kind: "ocr", progress: 40 });
      const v = await readAlbaranImage({ data: { imageDataUrl } });
      setStatus({ kind: "ocr", progress: 85 });
      const parsed = composeAlbaran({
        total: v?.total ?? null,
        pvd_values: v?.pvd_values ?? [],
        tpv_values: v?.tpv_values ?? [],
        banco_values: v?.banco_values ?? [],
        entrega: v?.entrega ?? null,
        stock: (v?.stock as StockLetter | null) ?? null,
        fecha: v?.fecha ?? null,
        numero: v?.numero ?? null,
      });
      if (parsed.fecha) setFechaOverride(parsed.fecha);
      setStatus({
        kind: "parsed",
        parsed,
        text: `Lectura con IA:\n${JSON.stringify(v, null, 2)}`,
      });
      return;
    } catch (err) {
      console.error("AI vision error", err);
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Error leyendo la imagen",
      });
    }
  }, []);


  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        setStatus({ kind: "error", message: "El archivo debe ser una imagen." });
        return;
      }
      runOcr(file);
    },
    [runOcr],
  );


  // Ctrl+V / Cmd+V global paste
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const save = async () => {
    if (status.kind !== "parsed") return;
    if (!status.parsed.empleado) {
      setStatus({
        kind: "error",
        message: "No se pudo detectar el STOCK (A/C/T) en la imagen. Sube una captura más clara.",
      });
      return;
    }
    setStatus({ kind: "saving", parsed: status.parsed, text: status.text });
    try {
      const p = status.parsed;
      await ventasStore.setImported(
        [
          {
            id: p.numero
              ? `alb-${p.numero}`
              : `ocr-${(fechaOverride ?? new Date().toISOString().slice(0, 10))}-${p.empleado}-${p.pvp}-${p.pvd}`,
            fecha: fechaOverride ?? new Date().toISOString().slice(0, 10),
            empleado: p.empleado!,
            total_venta: p.ingreso,
            beneficio: p.beneficio_real,
            metodo_pago: p.metodo_pago,
            pvp: p.pvp,
            pvd: p.pvd,
            entrega: p.entrega,
            efectivo_amount: p.efectivo_amount,
            tpv_amount: p.tpv_amount,
            banco_amount: p.banco_amount,
          },
        ],
        "Albarán (OCR)",
      );
      setStatus({ kind: "saved", parsed: p });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Error guardando",
      });
    }
  };

  const reset = () => setStatus({ kind: "idle" });

  return (
    <Card className="gradient-card border-border/50 shadow-elevated">
      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">Añadir albarán por imagen</h3>
            <p className="text-xs text-muted-foreground">
              Pega una captura con <kbd className="rounded bg-muted px-1">Ctrl</kbd>+
              <kbd className="rounded bg-muted px-1">V</kbd>, arrástrala o sube un archivo.
              Detecta <b>PVP</b>, <b>PVD</b>, <b>ENTREGA</b>, <b>TPV</b> y <b>BANCO</b>.
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            className="gap-2"
            onClick={async () => {
              try {
                if (!navigator.clipboard || !("read" in navigator.clipboard)) {
                  setStatus({
                    kind: "error",
                    message:
                      "Tu navegador no permite pegar imágenes con un botón. Usa Ctrl+V dentro de la página.",
                  });
                  return;
                }
                const items = await (navigator.clipboard as any).read();
                for (const it of items) {
                  const type = it.types.find((t: string) => t.startsWith("image/"));
                  if (type) {
                    const blob: Blob = await it.getType(type);
                    const file = new File([blob], `clipboard.${type.split("/")[1] || "png"}`, {
                      type,
                    });
                    handleFile(file);
                    return;
                  }
                }
                setStatus({
                  kind: "error",
                  message: "No hay ninguna imagen en el portapapeles.",
                });
              } catch (err) {
                setStatus({
                  kind: "error",
                  message:
                    err instanceof Error
                      ? `No se pudo leer el portapapeles: ${err.message}`
                      : "No se pudo leer el portapapeles.",
                });
              }
            }}
          >
            <ClipboardPaste className="h-4 w-4" />
            Pegar captura
          </Button>
        </div>


        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          {/* Zona izquierda: drop / upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border/60 hover:border-primary/60 hover:bg-muted/30",
            )}
          >
            {status.kind === "ocr" ? (
              <>
                <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Leyendo imagen… {status.progress}%</p>
              </>
            ) : (
              <>
                <div className="mb-3 flex gap-2">
                  <ClipboardPaste className="h-6 w-6 text-primary" />
                  <ImagePlus className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Pega o suelta una captura del albarán</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  o haz clic para elegir un archivo
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Zona derecha: resultado */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            {status.kind === "idle" && (
              <p className="text-sm text-muted-foreground">
                Aquí verás los valores extraídos y los cálculos antes de guardar.
              </p>
            )}
            {status.kind === "error" && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div className="flex-1">
                  <p className="font-medium">Error</p>
                  <p className="text-xs opacity-80">{status.message}</p>
                  <Button size="sm" variant="ghost" className="mt-2" onClick={reset}>
                    Reintentar
                  </Button>
                </div>
              </div>
            )}
            {(status.kind === "parsed" || status.kind === "saving") && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Field label="PVP (TOTAL)" value={eur.format(status.parsed.pvp)} strong />
                  <Field label="PVD (coste)" value={eur.format(status.parsed.pvd)} />
                  <Field
                    label="Entrega"
                    value={
                      status.parsed.entrega != null ? eur.format(status.parsed.entrega) : "—"
                    }
                  />
                  <Field
                    label="Beneficio real"
                    value={eur.format(status.parsed.beneficio_real)}
                    strong
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Desglose de cobro
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <Field label="Efectivo" value={eur.format(status.parsed.efectivo_amount)} />
                    <Field label="TPV" value={eur.format(status.parsed.tpv_amount)} />
                    <Field label="Banco" value={eur.format(status.parsed.banco_amount)} />
                  </div>
                </div>
                {status.parsed.warnings.length > 0 && (
                  <div className="rounded-md bg-warning/10 p-2 text-xs text-warning">
                    {status.parsed.warnings.map((w, i) => (
                      <p key={i}>⚠ {w}</p>
                    ))}
                  </div>
                )}
                <details className="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    Ver texto OCR detectado (debug)
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-tight">
                    {status.text || "(vacío)"}
                  </pre>
                </details>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Stock detectado
                    </p>
                    <p className="text-sm font-medium">
                      {status.parsed.stock
                        ? `${status.parsed.stock} · ${status.parsed.empleado}`
                        : "— no detectado —"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Input
                      type="date"
                      value={fechaOverride ?? new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setFechaOverride(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={save}
                    disabled={status.kind === "saving"}
                    className="flex-1 gradient-primary text-primary-foreground"
                  >
                    {status.kind === "saving" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…
                      </>
                    ) : (
                      "Guardar venta"
                    )}
                  </Button>
                  <Button variant="ghost" onClick={reset}>
                    Descartar
                  </Button>
                </div>
              </div>
            )}
            {status.kind === "saved" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Guardado: {eur.format(status.parsed.ingreso)} de ingreso ·{" "}
                  {eur.format(status.parsed.beneficio_real)} de beneficio
                </div>
                <Button size="sm" variant="outline" onClick={reset}>
                  Añadir otro
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular-nums",
          strong ? "text-base font-semibold" : "text-sm font-medium",
        )}
      >
        {value}
      </p>
    </div>
  );
}
