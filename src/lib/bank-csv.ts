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
  /** Apuntes descartados por no poder leer su fecha (nunca se inventa). */
  sinFecha: number;

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
  const norm = (s: string) =>
    String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const countValid = (c: number) =>
    rows.reduce((acc, r) => acc + (parseDate(r[c] ?? "") ? 1 : 0), 0);

  // 1) Preferimos la columna cuyo encabezado habla de fecha (fecha operación,
  //    fecha valor, f. contable…), siempre que contenga fechas reales.
  const headerCandidates = headers
    .map((h, c) => ({ c, n: norm(h) }))
    .filter(({ n }) => n.includes("fecha") || /^f\.?\s|date/.test(n))
    // "fecha operación/contable" manda sobre "fecha valor"
    .sort((a, b) => {
      const score = (n: string) =>
        n.includes("opera") || n.includes("contable") ? 2 : 1;
      return score(b.n) - score(a.n);
    });
  for (const { c } of headerCandidates) {
    if (countValid(c) > 0) return c;
  }

  // 2) Si no hay encabezado claro, la columna con más fechas válidas.
  let bestIdx = -1;
  let bestCount = 0;
  for (let c = 0; c < headers.length; c++) {
    const ok = countValid(c);
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
  const incomes: BankIncome[] = [];
  let ignoredCard = 0;
  let sinFecha = 0;

  parsed.rows.forEach((r) => {
    if (amountIdx < 0) return;
    const raw = (r[amountIdx] ?? "").trim();
    if (!raw) return;
    const n = parseNumber(raw);
    if (!Number.isFinite(n) || n === 0) return;
    // La fecha del banco es sagrada: si no se puede leer, NO se inventa
    // (antes se usaba la fecha de hoy y los apuntes caían en el mes actual).
    const fecha = dateIdx >= 0 ? parseDate(r[dateIdx] ?? "") : null;
    if (!fecha) {
      sinFecha++;
      return;
    }
    const concepto =
      (conceptIdx >= 0 ? (r[conceptIdx] ?? "").trim() : "") || "Movimiento bancario";
    // Referencia estable (sin nombre de archivo ni nº de fila) para que
    // reimportar el mismo extracto no duplique nada.
    const referencia = `${fecha}|${n.toFixed(2)}|${concepto.slice(0, 40)}`
      .toLowerCase()
      .replace(/[^a-z0-9|\-.]/g, "_");
    const item = { fecha, monto: Math.abs(n), concepto, referencia };
    if (n < 0) {
      expenses.push(item);
    } else if (isCardIncome(concepto)) {
      ignoredCard++;
    } else {
      incomes.push(item);
    }
  });

  return {
    expenses,
    incomes,
    ignoredCard,
    ignoredPositives: ignoredCard,
    sinFecha,
    totalRows: parsed.rows.length,
  };
}


