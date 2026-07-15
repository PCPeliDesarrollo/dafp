import { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  autoMap,
  mapRows,
  parseCSV,
  type ColumnMap,
  type CsvParseResult,
  type ImportError,
} from "@/lib/csv-import";
import {
  DEFAULT_STOCK_MAP,
  albaranesToVentas,
  extractPdfText,
  parseAlbaranes,
  type AlbaranRow,
  type StockMap,
} from "@/lib/pdf-import";
import { ventasStore } from "@/lib/ventas-store";
import type { VentaRow } from "@/lib/dashboard-mock";

/* -------------------------------------------------------------------------- */
/*                              CSV import panel                              */
/* -------------------------------------------------------------------------- */

const FIELD_LABELS: { key: keyof ColumnMap; label: string; required: boolean }[] = [
  { key: "fecha", label: "Fecha", required: true },
  { key: "empleado", label: "Empleado", required: true },
  { key: "total_venta", label: "Total venta (€)", required: true },
  { key: "beneficio", label: "Beneficio (€)", required: true },
  { key: "id", label: "ID / Nº factura (opcional)", required: false },
];

type ImportedInfo = { added: number; updated: number; total: number; name: string };

function CsvPanel({ onImported }: { onImported: (info: ImportedInfo) => void }) {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [map, setMap] = useState<ColumnMap>({
    fecha: "",
    empleado: "",
    total_venta: "",
    beneficio: "",
    id: "",
  });
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    } catch (e: any) {
      setFileError(e?.message ?? "No se pudo leer el archivo.");
    }
  };

  const preview = useMemo(() => {
    if (!parsed) return null;
    const missing = FIELD_LABELS.filter((f) => f.required && !map[f.key]);
    if (missing.length) return { ready: false as const };
    return { ready: true as const, ...mapRows(parsed, map) };
  }, [parsed, map]);

  const doImport = async () => {
    if (!preview?.ready) return;
    try {
      const info = await ventasStore.setImported(preview.rows, fileName);
      onImported({ ...info, name: fileName });
    } catch (e: any) {
      setFileError(e?.message ?? "No se pudieron guardar las ventas en la nube.");
    }
  };


  return (
    <div className="space-y-4">
      {!parsed && (
        <>
          <label
            htmlFor="csv-file"
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 p-8 text-center transition-colors",
              "hover:border-primary/50 hover:bg-muted/50",
            )}
          >
            <Upload className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">
              Selecciona un archivo .csv
            </p>
            <p className="text-xs text-muted-foreground">
              Separadores "," o ";" · números ES (1.234,56) o EN (1,234.56)
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
        </>
      )}

      {parsed && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
            <span className="truncate font-medium">{fileName}</span>
            <span className="text-muted-foreground">
              {parsed.rows.length} filas · sep "{parsed.delimiter === "\t" ? "TAB" : parsed.delimiter}"
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELD_LABELS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">
                  {f.label}
                  {f.required && <span className="ml-1 text-destructive">*</span>}
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
                    {!f.required && <SelectItem value="__none__">— ninguna —</SelectItem>}
                    {parsed.headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {preview?.ready && (
            <PreviewSummary
              okCount={preview.rows.length}
              errors={preview.errors}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setParsed(null); setFileName(""); }}>
              Cambiar archivo
            </Button>
            <Button
              onClick={doImport}
              disabled={!preview?.ready || preview.rows.length === 0}
            >
              Importar {preview?.ready ? `(${preview.rows.length})` : ""}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              PDF import panel                              */
/* -------------------------------------------------------------------------- */

function PdfPanel({ onImported }: { onImported: (info: ImportedInfo) => void }) {
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [albaranes, setAlbaranes] = useState<AlbaranRow[] | null>(null);
  const [stockMap, setStockMap] = useState<StockMap>({ ...DEFAULT_STOCK_MAP });
  const [margen, setMargen] = useState<number>(20);
  const [fileError, setFileError] = useState<string | null>(null);

  const stocksMostrados = useMemo(() => {
    // Always show the three known STOCK slots (A/T/C) so the user sees the
    // full mapping — plus any extra letter detected in this PDF.
    const base = new Set(Object.keys(DEFAULT_STOCK_MAP));
    for (const a of albaranes ?? []) base.add(a.stock);
    return Array.from(base).sort();
  }, [albaranes]);

  const stocksDetectados = useMemo(
    () => new Set((albaranes ?? []).map((a) => a.stock)),
    [albaranes],
  );

  const dateRange = useMemo(() => {
    if (!albaranes?.length) return null;
    const dates = albaranes.map((a) => a.fecha).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [albaranes]);


  const onFile = async (file: File) => {
    setFileError(null);
    setBusy(true);
    try {
      const text = await extractPdfText(file);
      const parsed = parseAlbaranes(text);
      if (!parsed.length) {
        setFileError("No se han encontrado albaranes en este PDF.");
        setAlbaranes(null);
      } else {
        setAlbaranes(parsed);
        setFileName(file.name);
        // Ensure map contains any newly detected stock code
        setStockMap((prev) => {
          const next = { ...prev };
          for (const s of new Set(parsed.map((p) => p.stock))) {
            if (!(s in next)) next[s] = "";
          }
          return next;
        });
      }
    } catch (e: any) {
      setFileError(e?.message ?? "No se pudo leer el PDF.");
    } finally {
      setBusy(false);
    }
  };

  const converted = useMemo(() => {
    if (!albaranes) return null;
    return albaranesToVentas(albaranes, stockMap, margen);
  }, [albaranes, stockMap, margen]);

  const doImport = async () => {
    if (!converted) return;
    try {
      const info = await ventasStore.setImported(converted.rows, fileName);
      onImported({ ...info, name: fileName });
    } catch (e: any) {
      setFileError(e?.message ?? "No se pudieron guardar los albaranes en la nube.");
    }
  };


  return (
    <div className="space-y-4">
      {!albaranes && (
        <>
          <label
            htmlFor="pdf-file"
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 p-8 text-center transition-colors",
              "hover:border-primary/50 hover:bg-muted/50",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <FileText className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">
              {busy ? "Analizando PDF…" : "Selecciona el PDF de reportes de ventas"}
            </p>
            <p className="text-xs text-muted-foreground">
              Extrae automáticamente cada albarán (fecha, STOCK, total).
            </p>
            <input
              id="pdf-file"
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={busy}
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
        </>
      )}

      {albaranes && converted && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
            <span className="truncate font-medium">{fileName}</span>
            <span className="text-muted-foreground">
              {albaranes.length} albaranes ·{" "}
              {dateRange &&
                (dateRange.min === dateRange.max
                  ? new Date(dateRange.min).toLocaleDateString("es-ES")
                  : `${new Date(dateRange.min).toLocaleDateString("es-ES")} → ${new Date(dateRange.max).toLocaleDateString("es-ES")}`)}
            </span>
          </div>

          <div>
            <Label className="text-xs">Asigna cada STOCK a su comercial</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {stocksMostrados.map((s) => {
                const enPdf = stocksDetectados.has(s);
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-9 min-w-16 items-center justify-center rounded-md border px-2 text-xs font-semibold",
                        enPdf
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/60 bg-card/60 text-muted-foreground",
                      )}
                      title={enPdf ? "Presente en este PDF" : "No aparece en este PDF"}
                    >
                      STOCK {s}
                    </span>
                    <Input
                      value={stockMap[s] ?? ""}
                      placeholder="Nombre del comercial"
                      onChange={(e) =>
                        setStockMap((m) => ({ ...m, [s]: e.target.value }))
                      }
                      className="h-9"
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Los STOCK resaltados aparecen en este PDF. Deja el nombre vacío
              para omitir todas las ventas de ese STOCK.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label className="text-xs">Margen de beneficio estimado (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={margen}
                onChange={(e) => setMargen(Number(e.target.value) || 0)}
                className="mt-1 h-9"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                El PDF no incluye el coste; se aplica este margen sobre el total
                para calcular el beneficio.
              </p>
            </div>
            <Badge
              variant="outline"
              className="h-9 justify-center border-primary/30 bg-primary/10 text-primary"
            >
              {converted.rows.length} ventas listas
            </Badge>
          </div>

          {converted.skipped.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
              Se omitirán {converted.skipped.length} albaranes sin comercial
              asignado ({Array.from(new Set(converted.skipped.map((s) => `STOCK ${s.stock}`))).join(", ")}).
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAlbaranes(null)}>
              Cambiar archivo
            </Button>
            <Button onClick={doImport} disabled={converted.rows.length === 0}>
              Importar ({converted.rows.length})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Shared helpers / UI                            */
/* -------------------------------------------------------------------------- */

function PreviewSummary({
  okCount,
  errors,
}: {
  okCount: number;
  errors: ImportError[];
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className="bg-success/15 text-success hover:bg-success/15">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {okCount} válidas
        </Badge>
        {errors.length > 0 && (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {errors.length} con errores
          </Badge>
        )}
      </div>
      {errors.length > 0 && (
        <ScrollArea className="h-24 rounded-md border border-border/40 p-2 text-xs">
          {errors.slice(0, 30).map((e, i) => (
            <div key={i} className="text-muted-foreground">
              Fila {e.row}: {e.reason}
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Dialog                                    */
/* -------------------------------------------------------------------------- */

export function CsvImportDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<ImportedInfo | null>(null);
  const [tab, setTab] = useState<"pdf" | "csv">("pdf");

  const handleImported = (info: ImportedInfo) => setDone(info);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(() => setDone(null), 200);
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar{"\u00a0"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar ventas
          </DialogTitle>
          <DialogDescription>
            Sube el reporte exportado desde tu programa de facturación. Cada
            venta se guarda con su fecha real y se acumula con las
            importaciones anteriores (los albaranes repetidos se actualizan,
            no se duplican).
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="font-medium">¡Importación completada!</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{done.added}</span>{" "}
              nuevas ·{" "}
              <span className="font-medium text-foreground">{done.updated}</span>{" "}
              actualizadas · desde{" "}
              <span className="font-medium text-foreground">{done.name}</span>.
            </p>
            <p className="text-xs text-muted-foreground">
              Total acumulado: {done.total} ventas.
            </p>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => setOpen(false)}>Ver dashboard</Button>
            </DialogFooter>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pdf" className="gap-2">
                <FileText className="h-4 w-4" /> PDF (facturación)
              </TabsTrigger>
              <TabsTrigger value="csv" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pdf" className="mt-4">
              <PdfPanel onImported={handleImported} />
            </TabsContent>
            <TabsContent value="csv" className="mt-4">
              <CsvPanel onImported={handleImported} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
