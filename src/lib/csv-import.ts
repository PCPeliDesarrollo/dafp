import type { VentaRow } from "./dashboard-mock";

export type CsvParseResult = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

// Auto-detect delimiter between comma / semicolon / tab
function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] ?? "";
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

export function parseCSV(text: string): CsvParseResult {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean);
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delimiter) {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && clean[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim());
  return { headers, rows: nonEmpty, delimiter };
}

// Parse a numeric string tolerating "1.234,56" (ES) and "1,234.56" (US)
export function parseNumber(raw: string): number {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[€$\s]/g, "");
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Assume the last separator is decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// Parse ISO (YYYY-MM-DD) or DD/MM/YYYY or DD-MM-YYYY
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eu = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s);
  if (eu) {
    const d = eu[1].padStart(2, "0");
    const m = eu[2].padStart(2, "0");
    let y = eu[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${m}-${d}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

export type ColumnMap = {
  fecha: string;
  empleado: string;
  total_venta: string;
  beneficio: string;
  id?: string;
};

// Best-effort auto-mapping using header names
export function autoMap(headers: string[]): ColumnMap {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const find = (...needles: string[]) =>
    headers.find((h) => {
      const n = norm(h);
      return needles.some((x) => n.includes(x));
    }) ?? "";
  return {
    fecha: find("fecha", "date"),
    empleado: find("empleado", "vendedor", "comercial", "usuario", "employee"),
    total_venta:
      find("total_venta") ||
      find("total", "importe", "amount") ||
      "",
    beneficio: find("beneficio", "profit", "ganancia", "margen bruto"),
    id: find("id", "num", "factura"),
  };
}

export type ImportError = { row: number; reason: string };
export type ImportResult = {
  rows: VentaRow[];
  errors: ImportError[];
};

export function mapRows(
  parsed: CsvParseResult,
  map: ColumnMap,
): ImportResult {
  const idx = (name: string) => (name ? parsed.headers.indexOf(name) : -1);
  const iFecha = idx(map.fecha);
  const iEmp = idx(map.empleado);
  const iTotal = idx(map.total_venta);
  const iBen = idx(map.beneficio);
  const iId = idx(map.id ?? "");

  const rows: VentaRow[] = [];
  const errors: ImportError[] = [];

  parsed.rows.forEach((r, i) => {
    const rowNum = i + 2; // +1 header, +1 human-index
    const fecha = iFecha >= 0 ? parseDate(r[iFecha] ?? "") : null;
    const empleado = iEmp >= 0 ? (r[iEmp] ?? "").trim() : "";
    const total = iTotal >= 0 ? parseNumber(r[iTotal] ?? "") : NaN;
    const beneficio = iBen >= 0 ? parseNumber(r[iBen] ?? "") : NaN;

    if (!fecha) return errors.push({ row: rowNum, reason: "Fecha inválida" });
    if (!empleado) return errors.push({ row: rowNum, reason: "Empleado vacío" });
    if (!Number.isFinite(total))
      return errors.push({ row: rowNum, reason: "Total de venta inválido" });
    if (!Number.isFinite(beneficio))
      return errors.push({ row: rowNum, reason: "Beneficio inválido" });

    const id =
      (iId >= 0 && (r[iId] ?? "").trim()) ||
      `csv-${rowNum}-${fecha}-${empleado}`;

    rows.push({
      id,
      fecha,
      empleado,
      total_venta: total,
      beneficio,
    });
  });

  return { rows, errors };
}
