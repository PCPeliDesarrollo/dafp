import type { VentaRow } from "./dashboard-mock";

// pdf.js in the browser needs an explicit worker URL. Vite resolves this at
// build time via the ?url suffix.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - worker asset URL
import PdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let pdfjsLibPromise: Promise<any> | null = null;
async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((mod) => {
      const lib = (mod as any).default ?? mod;
      lib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

/**
 * Extract text from every page of a PDF, grouping items into visual lines by
 * their y-coordinate so regex parsing over the resulting string is reliable.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[])
      .filter((it) => typeof it.str === "string")
      .sort(
        (a, b) =>
          b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
      );
    let lastY: number | null = null;
    for (const it of items) {
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) out += "\n";
      else if (lastY !== null) out += " ";
      out += it.str;
      lastY = y;
    }
    out += "\n\n";
  }
  return out;
}

export type AlbaranRow = {
  numero: string;
  fecha: string; // ISO YYYY-MM-DD
  stock: string; // e.g. "A", "T", "C"
  total: number;
};

// Match one albarán block: header (nº + fecha), STOCK X marker, and the
// "Base Imponible / Impuestos / Total" summary — Total is the 3rd amount.
const ALBARAN_RE =
  /Albarán nº\s+(\d+#\d+)[\s\S]{0,1500}?Fecha\s+(\d{1,2}\/\d{1,2}\/\d{2,4})[\s\S]{0,800}?STOCK\s+([A-Z])[\s\S]{0,5000}?Base Imponible[\s\S]{0,400}?Total[\s\S]{0,300}?([\d.]+,\d{2})\s*€[\s\S]{0,80}?([\d.]+,\d{2})\s*€[\s\S]{0,80}?([\d.]+,\d{2})\s*€/g;

function parseESNumber(s: string): number {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function toIso(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  const yy = y.length === 2 ? (Number(y) > 50 ? "19" : "20") + y : y;
  return `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function parseAlbaranes(text: string): AlbaranRow[] {
  const out: AlbaranRow[] = [];
  const seen = new Set<string>();
  ALBARAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ALBARAN_RE.exec(text)) !== null) {
    const [, numero, fecha, stock, , , totalStr] = m;
    if (seen.has(numero)) continue;
    seen.add(numero);
    const total = parseESNumber(totalStr);
    if (!Number.isFinite(total)) continue;
    out.push({ numero, fecha: toIso(fecha), stock: stock.toUpperCase(), total });
  }
  return out;
}

export type StockMap = Record<string, string>; // "A" -> "Ainhoa"

export const DEFAULT_STOCK_MAP: StockMap = {
  A: "Ainhoa",
  T: "Tomás",
  C: "Cristina",
};

export function albaranesToVentas(
  albaranes: AlbaranRow[],
  stockMap: StockMap,
  margenPct: number,
): { rows: VentaRow[]; skipped: AlbaranRow[] } {
  const rows: VentaRow[] = [];
  const skipped: AlbaranRow[] = [];
  for (const a of albaranes) {
    const empleado = stockMap[a.stock]?.trim();
    if (!empleado) {
      skipped.push(a);
      continue;
    }
    const beneficio = Math.round(a.total * (margenPct / 100) * 100) / 100;
    rows.push({
      id: `alb-${a.numero}`,
      fecha: a.fecha,
      empleado,
      total_venta: a.total,
      beneficio,
    });
  }
  return { rows, skipped };
}
