import { parseCSV, parseNumber, parseDate } from "./csv-import";

export type BankExpense = {
  fecha: string;
  monto: number; // positivo (valor absoluto del cargo)
  concepto: string;
  referencia: string;
};

export type BankIncome = BankExpense; // monto positivo (abono)

export type BankImportResult = {
  expenses: BankExpense[];
  incomes: BankIncome[];
  /** Abonos ignorados por ser cobros con tarjeta/TPV (ya contabilizados). */
  ignoredCard: number;
  ignoredPositives: number;
  totalRows: number;
};

/** Abonos que NO se importan: cobros con tarjeta / TPV ya registrados a mano. */
const CARD_HINTS = [
  "tarjeta",
  "tpv",
  "visa",
  "mastercard",
  "redsys",
  "comercio",
  "datafono",
  "datafonos",
];

export function isCardIncome(concepto: string): boolean {
  const n = concepto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return CARD_HINTS.some((h) => n.includes(h));
}


/**
 * Detects the most likely "amount" column: the numeric column that contains at
 * least one negative value; falls back to the numeric column with more decimals.
 */
function detectAmountColumn(headers: string[], rows: string[][]): number {
  let bestIdx = -1;
  let bestScore = -Infinity;
  for (let c = 0; c < headers.length; c++) {
    let numeric = 0;
    let negatives = 0;
    for (const r of rows) {
      const raw = (r[c] ?? "").trim();
      if (!raw) continue;
      const n = parseNumber(raw);
      if (Number.isFinite(n)) {
        numeric++;
        if (n < 0) negatives++;
      }
    }
    const score = numeric + negatives * 100;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = c;
    }
  }
  return bestIdx;
}

function detectDateColumn(headers: string[], rows: string[][]): number {
  let bestIdx = -1;
  let bestCount = 0;
  for (let c = 0; c < headers.length; c++) {
    let ok = 0;
    for (const r of rows) {
      if (parseDate(r[c] ?? "")) ok++;
    }
    if (ok > bestCount) {
      bestCount = ok;
      bestIdx = c;
    }
  }
  return bestIdx;
}

function detectConceptColumn(headers: string[], amountIdx: number, dateIdx: number): number {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const idx = headers.findIndex((h) => {
    const n = norm(h);
    return (
      n.includes("concepto") ||
      n.includes("descrip") ||
      n.includes("detalle") ||
      n.includes("movimiento") ||
      n.includes("beneficiar")
    );
  });
  if (idx >= 0) return idx;
  // First text column that isn't date/amount
  for (let c = 0; c < headers.length; c++) {
    if (c === amountIdx || c === dateIdx) continue;
    return c;
  }
  return -1;
}

export function parseBankCsv(text: string, fileName: string): BankImportResult {
  const parsed = parseCSV(text);
  const amountIdx = detectAmountColumn(parsed.headers, parsed.rows);
  const dateIdx = detectDateColumn(parsed.headers, parsed.rows);
  const conceptIdx = detectConceptColumn(parsed.headers, amountIdx, dateIdx);

  const expenses: BankExpense[] = [];
  let ignoredPositives = 0;
  const today = new Date().toISOString().slice(0, 10);

  parsed.rows.forEach((r, i) => {
    if (amountIdx < 0) return;
    const raw = (r[amountIdx] ?? "").trim();
    if (!raw) return;
    const n = parseNumber(raw);
    if (!Number.isFinite(n)) return;
    if (n >= 0) {
      ignoredPositives++;
      return;
    }
    const fecha =
      (dateIdx >= 0 ? parseDate(r[dateIdx] ?? "") : null) ?? today;
    const concepto =
      (conceptIdx >= 0 ? (r[conceptIdx] ?? "").trim() : "") || "Movimiento bancario";
    const referencia = `${fileName}|${i}|${fecha}|${n.toFixed(2)}|${concepto.slice(0, 40)}`
      .toLowerCase()
      .replace(/[^a-z0-9|\-.]/g, "_");
    expenses.push({ fecha, monto: Math.abs(n), concepto, referencia });
  });

  return { expenses, ignoredPositives, totalRows: parsed.rows.length };
}
