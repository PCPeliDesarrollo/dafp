import * as XLSX from "xlsx";
import {
  parseBankCsv,
  isCardIncome,
  type BankExpense,
  type BankIncome,
  type BankImportResult,
} from "./bank-csv";
import { parseDate, parseNumber } from "./csv-import";
import { extractPdfText } from "./pdf-import";



const HEADER_HINTS = ["fecha", "importe", "monto", "concepto", "movim", "detalle", "descrip"];

function norm(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findHeaderRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cells = rows[i].map((c) => norm(String(c ?? "")));
    let hits = 0;
    for (const cell of cells) {
      if (HEADER_HINTS.some((h) => cell.includes(h))) hits++;
    }
    if (hits >= 2) return i;
  }
  return 0;
}

function rowsToCsv(rows: any[][]): string {
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(escape).join(",")).join("\n");
}

async function parseXlsx(file: File, fileName: string): Promise<BankImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, cellNF: false });
  // Aggregate across every sheet (in case the bank splits by month)
  const merged: BankExpense[] = [];
  const mergedIncomes: BankIncome[] = [];
  let ignoredCard = 0;
  let totalRows = 0;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      dateNF: "yyyy-mm-dd",
      defval: "",
    });
    if (!rows.length) continue;
    const headerIdx = findHeaderRow(rows);
    const trimmed = rows.slice(headerIdx).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
    if (trimmed.length < 2) continue;
    const csv = rowsToCsv(trimmed);
    const res = parseBankCsv(csv, `${fileName}#${name}`);
    merged.push(...res.expenses);
    mergedIncomes.push(...res.incomes);
    ignoredCard += res.ignoredCard;
    totalRows += res.totalRows;
  }
  return {
    expenses: merged,
    incomes: mergedIncomes,
    ignoredCard,
    ignoredPositives: ignoredCard,
    totalRows,
  };
}

// Best-effort PDF bank statement parser: matches lines with a date and a signed
// amount (negatives = charges, positives = abonos). Concept is the text between.
const DATE_RE = /(\d{1,2}[\/\-.](?:\d{1,2}|[A-Za-z]{3,})[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})/;
const AMOUNT_RE = /(-?\s?\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})/;

async function parsePdf(file: File, fileName: string): Promise<BankImportResult> {
  const text = await extractPdfText(file);
  const lines = text.split(/\r?\n/);
  const expenses: BankExpense[] = [];
  const incomes: BankIncome[] = [];
  let ignoredCard = 0;
  let totalRows = 0;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const d = DATE_RE.exec(line);
    if (!d) return;
    totalRows++;
    const rest = line.replace(d[0], " ");
    const m = AMOUNT_RE.exec(rest);
    if (!m) return;
    const fecha = parseDate(d[1]);
    if (!fecha) return;
    const monto = parseNumber(m[1].replace(/\s/g, ""));
    if (!Number.isFinite(monto) || monto === 0) return;
    let concepto = rest
      .replace(m[0], " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!concepto) concepto = "Movimiento bancario";
    const referencia = `${fileName}|${i}|${fecha}|${monto.toFixed(2)}|${concepto.slice(0, 40)}`
      .toLowerCase()
      .replace(/[^a-z0-9|\-.]/g, "_");
    const item = { fecha, monto: Math.abs(monto), concepto, referencia };
    if (monto < 0) expenses.push(item);
    else if (isCardIncome(concepto)) ignoredCard++;
    else incomes.push(item);
  });
  return { expenses, incomes, ignoredCard, ignoredPositives: ignoredCard, totalRows };
}


export async function parseBankFile(file: File): Promise<BankImportResult> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) {
    return parseXlsx(file, name);
  }
  if (lower.endsWith(".pdf")) {
    return parsePdf(file, name);
  }
  // default: CSV / txt
  const text = await file.text();
  return parseBankCsv(text, name);
}
