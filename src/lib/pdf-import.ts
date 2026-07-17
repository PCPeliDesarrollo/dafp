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

  // Only real page headers are followed shortly by the "Agente" label.
  // Footer references like "Albarán nº 10#0368  Pág.1/3" do NOT have it, so
  // this pattern skips them and picks the correct header for every albarán,
  // even when several pages share the same footer number.
  const headerRe = /Albarán nº\s+(\d+#\d+)[\s\S]{0,120}?Agente/g;
  const uniquePositions: { num: string; index: number }[] = [];
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    if (found.has(m[1])) continue;
    found.add(m[1]);
    uniquePositions.push({ num: m[1], index: m.index });
  }
  uniquePositions.sort((a, b) => a.index - b.index);


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
): { rows: VentaRow[]; skipped: AlbaranRow[] } {
  const rows: VentaRow[] = [];
  const skipped: AlbaranRow[] = [];
  for (const a of albaranes) {
    const empleado = stockMap[a.stock]?.trim();
    if (!empleado) {
      skipped.push(a);
      continue;
    }
    // Beneficio real se obtiene por OCR de la captura del albarán (PVP-PVD).
    // Aquí solo se registra el ingreso bruto; beneficio queda a 0 hasta OCR.
    rows.push({
      id: `alb-${a.numero}`,
      fecha: a.fecha,
      empleado,
      total_venta: a.total,
      beneficio: 0,
    });
  }
  return { rows, skipped };
}
