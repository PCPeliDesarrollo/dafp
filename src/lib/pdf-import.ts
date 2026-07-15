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

  // Split the document into per-albarán chunks. Each albarán starts with
  // "Albarán nº <n>#<code>"; a document may repeat that line in the footer.
  const headerRe = /Albarán nº\s+(\d+#\d+)/g;
  const positions: { num: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    positions.push({ num: m[1], index: m.index });
  }
  // Keep only the FIRST occurrence per albarán number (top-of-page header).
  const firstByNum = new Map<string, number>();
  for (const p of positions) {
    if (!firstByNum.has(p.num)) firstByNum.set(p.num, p.index);
  }
  const uniquePositions = Array.from(firstByNum.entries())
    .map(([num, index]) => ({ num, index }))
    .sort((a, b) => a.index - b.index);

  for (let i = 0; i < uniquePositions.length; i++) {
    const start = uniquePositions[i].index;
    const end =
      i + 1 < uniquePositions.length ? uniquePositions[i + 1].index : text.length;
    const chunk = text.slice(start, end);
    const num = uniquePositions[i].num;
    if (seen.has(num)) continue;

    const fechaM = /Fecha\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(chunk);
    const stockM = /STOCK\s+([A-Z])\b/.exec(chunk);
    // The "Base Imponible / Impuestos / Total" summary lists 3 amounts; the
    // third is the invoice total. Grab the last 3 "N,NN €" tokens after the
    // "Base Imponible" heading.
    const summaryStart = chunk.search(/Base Imponible/);
    if (!fechaM || !stockM || summaryStart < 0) continue;
    const summary = chunk.slice(summaryStart);
    const amounts = Array.from(summary.matchAll(/([\d.]+,\d{2})\s*€/g)).map(
      (a) => a[1],
    );
    if (amounts.length < 3) continue;
    const totalStr = amounts[2];
    const total = parseESNumber(totalStr);
    if (!Number.isFinite(total)) continue;

    seen.add(num);
    out.push({
      numero: num,
      fecha: toIso(fechaM[1]),
      stock: stockM[1].toUpperCase(),
      total,
    });
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
