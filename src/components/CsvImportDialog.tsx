import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  autoMap,
  mapRows,
  parseCSV,
  type ColumnMap,
  type CsvParseResult,
  type ImportError,
} from "@/lib/csv-import";
import { ventasStore } from "@/lib/ventas-store";
import type { VentaRow } from "@/lib/dashboard-mock";

type Step = "upload" | "map" | "done";

const FIELD_LABELS: { key: keyof ColumnMap; label: string; required: boolean }[] = [
  { key: "fecha", label: "Fecha", required: true },
  { key: "empleado", label: "Empleado", required: true },
  { key: "total_venta", label: "Total venta (€)", required: true },
  { key: "beneficio", label: "Beneficio (€)", required: true },
  { key: "id", label: "ID / Nº factura (opcional)", required: false },
];

export function CsvImportDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [map, setMap] = useState<ColumnMap>({
    fecha: "",
    empleado: "",
    total_venta: "",
    beneficio: "",
    id: "",
  });
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [rowsOk, setRowsOk] = useState<VentaRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setParsed(null);
    setMap({ fecha: "", empleado: "", total_venta: "", beneficio: "", id: "" });
    setErrors([]);
    setRowsOk([]);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file: File) => {
    setFileError(null);
    try {
      const text = await file.text();
      const p = parseCSV(text);
      if (!p.headers.length) {
        setFileError("El archivo no contiene cabeceras válidas.");
        return;
      }
      setParsed(p);
      setFileName(file.name);
      setMap({ ...autoMap(p.headers) });
      setStep("map");
    } catch (e: any) {
      setFileError(e?.message ?? "No se pudo leer el archivo.");
    }
  };

  const preview = useMemo(() => {
    if (!parsed) return null;
    const missing = FIELD_LABELS.filter((f) => f.required && !map[f.key]);
    if (missing.length) return { ready: false, missing };
    const result = mapRows(parsed, map);
    return { ready: true, missing: [], ...result };
  }, [parsed, map]);

  const canImport =
    preview?.ready && "rows" in preview && preview.rows.length > 0;

  const confirmImport = () => {
    if (!preview || !("rows" in preview)) return;
    setRowsOk(preview.rows);
    setErrors(preview.errors);
    ventasStore.setImported(preview.rows, fileName);
    setStep("done");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar CSV de ventas
          </DialogTitle>
          <DialogDescription>
            Sube el CSV exportado desde tu programa de facturación. Se aceptan
            separadores coma (,) o punto y coma (;) y números en formato español
            (1.234,56) o inglés (1,234.56).
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <label
              htmlFor="csv-file"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 p-10 text-center transition-colors",
                "hover:border-primary/50 hover:bg-muted/50",
              )}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Haz clic para seleccionar un archivo .csv
              </p>
              <p className="text-xs text-muted-foreground">
                También puedes arrastrarlo aquí
              </p>
              <input
                ref={inputRef}
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            {fileError && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> {fileError}
              </p>
            )}
          </div>
        )}

        {step === "map" && parsed && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
              <span className="truncate font-medium">{fileName}</span>
              <span className="text-muted-foreground">
                {parsed.rows.length} filas · separador "
                {parsed.delimiter === "\t" ? "TAB" : parsed.delimiter}"
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {FIELD_LABELS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">
                    {f.label}
                    {f.required && (
                      <span className="ml-1 text-destructive">*</span>
                    )}
                  </Label>
                  <Select
                    value={map[f.key] ?? ""}
                    onValueChange={(v) =>
                      setMap((m) => ({ ...m, [f.key]: v === "__none__" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecciona columna…" />
                    </SelectTrigger>
                    <SelectContent>
                      {!f.required && (
                        <SelectItem value="__none__">— ninguna —</SelectItem>
                      )}
                      {parsed.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {preview && preview.ready && "rows" in preview && (
              <div className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className="bg-success/15 text-success hover:bg-success/15">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {preview.rows.length} válidas
                  </Badge>
                  {preview.errors.length > 0 && (
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-destructive"
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {preview.errors.length} con errores
                    </Badge>
                  )}
                </div>
                {preview.errors.length > 0 && (
                  <ScrollArea className="h-24 rounded-md border border-border/40 p-2 text-xs">
                    {preview.errors.slice(0, 30).map((e, i) => (
                      <div key={i} className="text-muted-foreground">
                        Fila {e.row}: {e.reason}
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </div>
            )}

            {preview && !preview.ready && (
              <p className="text-xs text-muted-foreground">
                Asigna todas las columnas obligatorias para continuar.
              </p>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="font-medium">¡Importación completada!</p>
            <p className="text-sm text-muted-foreground">
              {rowsOk.length} ventas importadas desde{" "}
              <span className="font-medium text-foreground">{fileName}</span>.
              {errors.length > 0 &&
                ` Se omitieron ${errors.length} filas con errores.`}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === "map" && (
            <>
              <Button variant="ghost" onClick={reset}>
                Cambiar archivo
              </Button>
              <Button onClick={confirmImport} disabled={!canImport}>
                Importar {canImport ? `(${(preview as any).rows.length})` : ""}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => setOpen(false)}>Ver dashboard</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
