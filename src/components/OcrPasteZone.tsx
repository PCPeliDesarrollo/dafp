import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImagePlus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parseAlbaranText, METODO_PAGO_LABEL, type ParsedAlbaran } from "@/lib/albaran-parser";
import { ventasStore } from "@/lib/ventas-store";
import { EMPLEADOS_LIST } from "@/lib/dashboard-mock";

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

export function OcrPasteZone() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [empleado, setEmpleado] = useState<string>(EMPLEADOS_LIST[0] ?? "");
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const runOcr = useCallback(async (source: File | Blob | string) => {
    setStatus({ kind: "ocr", progress: 0 });
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(source as any, "spa+eng", {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setStatus({ kind: "ocr", progress: Math.round((m.progress ?? 0) * 100) });
          }
        },
      });
      const parsed = parseAlbaranText(data.text ?? "");
      setStatus({ kind: "parsed", parsed, text: data.text ?? "" });
    } catch (err) {
      console.error("OCR error", err);
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
    setStatus({ kind: "saving", parsed: status.parsed, text: status.text });
    try {
      const p = status.parsed;
      await ventasStore.setImported(
        [
          {
            id: `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fecha,
            empleado: empleado || "Sin asignar",
            total_venta: p.ingreso,
            beneficio: p.beneficio_real,
            metodo_pago: p.metodo_pago,
            pvp: p.pvp,
            pvd: p.pvd,
            entrega: p.entrega,
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
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Añadir albarán por imagen</h3>
            <p className="text-xs text-muted-foreground">
              Pega una captura con <kbd className="rounded bg-muted px-1">Ctrl</kbd>+
              <kbd className="rounded bg-muted px-1">V</kbd>, arrástrala o sube un archivo.
              Detecta <b>PVP</b>, <b>PVD</b>, <b>ENTREGA</b>, <b>TPV</b> y <b>BANCO</b>.
            </p>
          </div>
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
                  <Field label="PVP" value={eur.format(status.parsed.pvp)} />
                  <Field label="PVD" value={eur.format(status.parsed.pvd)} />
                  <Field
                    label="Entrega"
                    value={
                      status.parsed.entrega != null ? eur.format(status.parsed.entrega) : "—"
                    }
                  />
                  <Field
                    label="Método"
                    value={METODO_PAGO_LABEL[status.parsed.metodo_pago]}
                  />
                  <Field
                    label="Ingreso"
                    value={eur.format(status.parsed.ingreso)}
                    strong
                  />
                  <Field
                    label="Beneficio real"
                    value={eur.format(status.parsed.beneficio_real)}
                    strong
                  />
                </div>
                {status.parsed.warnings.length > 0 && (
                  <div className="rounded-md bg-warning/10 p-2 text-xs text-warning">
                    {status.parsed.warnings.map((w, i) => (
                      <p key={i}>⚠ {w}</p>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Empleado</Label>
                    <select
                      value={empleado}
                      onChange={(e) => setEmpleado(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-border/60 bg-background px-2 text-sm"
                    >
                      {EMPLEADOS_LIST.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
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
