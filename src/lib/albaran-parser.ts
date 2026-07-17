// Parser + calculadora de albaranes basado en palabras clave.
// Todo el texto se normaliza a MAYÚSCULAS antes de aplicar los regex.

export type MetodoPago = "efectivo" | "tpv" | "banco";

export type StockLetter = "A" | "C" | "T";

export const STOCK_TO_EMPLEADO: Record<StockLetter, string> = {
  A: "Ainhoa",
  C: "Cristina",
  T: "Tomás",
};

export type ParsedAlbaran = {
  pvp: number;
  pvd: number;
  entrega: number | null;
  metodo_pago: MetodoPago; // método dominante (para compatibilidad)
  efectivo_amount: number;
  tpv_amount: number;
  banco_amount: number;
  ingreso: number;
  coste: number;
  beneficio_real: number;
  stock: StockLetter | null;
  empleado: string | null;
  fecha: string | null;
  numero: string | null;
  warnings: string[];
};

// OCR-tolerant keywords
const TPV_RE = "(?:T[\\.\\s]*P[\\.\\s]*[VU]|1PV|TARJETA)";
const BANCO_RE = "(?:BANC[O0]|TRANSFER(?:ENCIA)?)";

function parseNum(raw: string): number | null {
  let s = raw.replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function firstNumberAfter(text: string, keyword: string): number | null {
  const re = new RegExp(
    `\\b${keyword}\\b[^\\d\\-]{0,10}([\\-]?\\d{1,3}(?:[.\\s]\\d{3})*(?:[.,]\\d+)?|[\\-]?\\d+(?:[.,]\\d+)?)`,
    "i",
  );
  const m = re.exec(text);
  return m ? parseNum(m[1]) : null;
}

// Suma TODAS las apariciones de "KEYWORD <num>" en el texto.
function sumAllAfter(text: string, keywordRe: string): number {
  const re = new RegExp(
    `\\b${keywordRe}\\b[^\\d\\-]{0,10}([\\-]?\\d+(?:[.,]\\d+)?)`,
    "gi",
  );
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseNum(m[1]);
    if (n != null && n > 0) total += n;
  }
  return total;
}

// Último "TOTAL ... <num>" del texto (típicamente el TOTAL (€) del pie).
function findLastTotal(text: string): number | null {
  const re = /\bTOTAL\b(?:\s*\(?\s*€?\s*\)?)?\s*[:.]?\s*([\-]?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?)/gi;
  let last: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseNum(m[1]);
    if (n != null) last = n;
  }
  return last;
}

export function parseAlbaranText(rawText: string): ParsedAlbaran {
  const text = (rawText ?? "").toUpperCase();
  const warnings: string[] = [];
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // 1) PVP = TOTAL del albarán (prioritario). Si no hay TOTAL, cae al keyword PVP
  //    y como último recurso, al valor tras "PDV X TPV Y" (venta manual sin TOTAL).
  let pvpVal: number | null = findLastTotal(text);
  if (pvpVal == null) pvpVal = firstNumberAfter(text, "PVP");

  // 2) PVD = suma de todas las anotaciones "PDV|PVD X" (coste)
  let pvdSum =
    sumAllAfter(text, "PDV") +
    sumAllAfter(text, "PVD") +
    sumAllAfter(text, "COSTE");

  // 3) Pagos parciales por método: suma de todos los "TPV X" y "BANCO X"
  const tpv_amount = round2(sumAllAfter(text, TPV_RE));
  const banco_amount = round2(sumAllAfter(text, BANCO_RE));

  // Fallback: venta manual "PDV 2 TPV 6" sin TOTAL ni PVP → el "6" tras TPV es el PVP
  if (pvpVal == null && tpv_amount === 0 && banco_amount === 0) {
    warnings.push("No se detectó PVP ni TOTAL; se usa 0.");
  }
  if (pvpVal == null && (tpv_amount > 0 || banco_amount > 0) && pvdSum > 0) {
    // patrón "PDV X TPV Y" solitario → PVP = importe pagado
    pvpVal = tpv_amount + banco_amount;
  }

  const pvp = pvpVal ?? 0;
  const pvd = round2(pvdSum);

  if (pvdSum === 0) warnings.push("No se detectó PVD/PDV; coste = 0.");

  // 4) ENTREGA (pago parcial global sobre un PVP mayor)
  const entregaVal = firstNumberAfter(text, "ENTREGA");

  // 5) Efectivo = resto del PVP tras descontar TPV + BANCO (nunca negativo)
  const nonCash = tpv_amount + banco_amount;
  const efectivo_amount = round2(Math.max(0, pvp - nonCash));

  if (nonCash > pvp + 0.01) {
    warnings.push(
      `TPV+BANCO (${round2(nonCash)}€) supera el TOTAL (${round2(pvp)}€). Revisa la captura.`,
    );
  }

  // Método dominante (para el campo legado metodo_pago)
  const metodo_pago: MetodoPago =
    efectivo_amount >= tpv_amount && efectivo_amount >= banco_amount
      ? "efectivo"
      : tpv_amount >= banco_amount
      ? "tpv"
      : "banco";

  // 6) Fecha "dd/mm/yyyy" (opcionalmente precedida por "FECHA").
  let fecha: string | null = null;
  const fechaM =
    /\bFECHA\b[^\d]{0,10}(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i.exec(text) ||
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/.exec(text);
  if (fechaM) {
    const d = fechaM[1].padStart(2, "0");
    const m = fechaM[2].padStart(2, "0");
    let y = fechaM[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    fecha = `${y}-${m}-${d}`;
  }

  // 7) Nº de albarán → ID único para upsert
  let numero: string | null = null;
  const numM =
    /ALBAR[ÁA]N\s*(?:N[ºO°]?\.?)?\s*([0-9]+\s*#\s*[0-9]+)/i.exec(text) ||
    /\b([0-9]{1,4}\s*#\s*[0-9]{2,6})\b/.exec(text);
  if (numM) numero = numM[1].replace(/\s+/g, "");

  // 8) STOCK
  let stock: StockLetter | null = null;
  const stockM = /\bSTOCK\b[^A-Z0-9]*([ACT])\b/.exec(text);
  if (stockM) stock = stockM[1] as StockLetter;
  else {
    const altM = /\b([ACT])\b\s*(?:STOCK|\bSTK\b)/.exec(text);
    if (altM) stock = altM[1] as StockLetter;
  }
  const empleado = stock ? STOCK_TO_EMPLEADO[stock] : null;
  if (!stock)
    warnings.push("No se detectó STOCK (A/C/T); asigna el empleado manualmente.");

  // 9) Cálculo ingreso / coste / beneficio (respeta ENTREGA si aplica)
  let ingreso: number;
  let coste: number;
  let beneficio_real: number;
  let entrega: number | null = null;
  if (entregaVal != null && entregaVal > 0 && pvp > 0) {
    entrega = entregaVal;
    ingreso = entregaVal;
    coste = entregaVal * (pvd / pvp);
    beneficio_real = entregaVal * ((pvp - pvd) / pvp);
  } else {
    ingreso = pvp;
    coste = pvd;
    beneficio_real = pvp - pvd;
  }

  return {
    pvp: round2(pvp),
    pvd: round2(pvd),
    entrega: entrega != null ? round2(entrega) : null,
    metodo_pago,
    efectivo_amount,
    tpv_amount,
    banco_amount,
    ingreso: round2(ingreso),
    coste: round2(coste),
    beneficio_real: round2(beneficio_real),
    stock,
    empleado,
    fecha,
    numero,
    warnings,
  };
}

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo (Caja)",
  tpv: "Tarjeta (TPV)",
  banco: "Transferencias (BANCO)",
};

// Devuelve el desglose por método de una venta.
// Usa los importes explícitos si están presentes; si no, cae al método dominante.
export function getMetodoBreakdown(row: {
  total_venta: number;
  metodo_pago?: MetodoPago | string | null;
  efectivo_amount?: number | null;
  tpv_amount?: number | null;
  banco_amount?: number | null;
}): { efectivo: number; tpv: number; banco: number } {
  const hasBreakdown =
    row.efectivo_amount != null ||
    row.tpv_amount != null ||
    row.banco_amount != null;
  if (hasBreakdown) {
    return {
      efectivo: Number(row.efectivo_amount ?? 0),
      tpv: Number(row.tpv_amount ?? 0),
      banco: Number(row.banco_amount ?? 0),
    };
  }
  const mp = (row.metodo_pago ?? "efectivo") as MetodoPago;
  const total = Number(row.total_venta ?? 0);
  return {
    efectivo: mp === "efectivo" ? total : 0,
    tpv: mp === "tpv" ? total : 0,
    banco: mp === "banco" ? total : 0,
  };
}
