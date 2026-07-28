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

// OCR-tolerant keywords (no cierran con \b para permitir "TPV6" o "TPV:6")
const TPV_RE = "(?:T[\\.\\s]*P[\\.\\s]*[VUY]|1PV|IPV|LPV|TARJETA)";
const BANCO_RE = "(?:BANC[O0]|BAN[O0]|TRANSFER(?:ENCIA)?)";
const FINANCIAL_KEYWORD_RE = `(?:PDV|PVD|COSTE|${TPV_RE}|${BANCO_RE})`;

function normalizeFinancialText(text: string): string {
  return text
    .replace(new RegExp(`(\\d)(?=${FINANCIAL_KEYWORD_RE})`, "gi"), "$1 ")
    .replace(new RegExp(`(${FINANCIAL_KEYWORD_RE})(?=\\d)`, "gi"), "$1 ");
}

function parseNum(raw: string): number | null {
  let s = raw.replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function firstNumberAfter(text: string, keyword: string): number | null {
  const re = new RegExp(
    `(?:^|[^A-Z0-9])${keyword}(?![A-Z])[^\\d\\-]{0,10}([\\-]?\\d{1,3}(?:[.\\s]\\d{3})*(?:[.,]\\d+)?|[\\-]?\\d+(?:[.,]\\d+)?)`,
    "i",
  );
  const m = re.exec(text);
  return m ? parseNum(m[1]) : null;
}

function sumAllValues(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}


function collectAllAfter(text: string, keywordRe: string): number[] {
  const re = new RegExp(
    `(?:^|[^A-Z0-9])${keywordRe}(?![A-Z])[^\\d\\-]{0,10}([\\-]?\\d+(?:[.,]\\d+)?)`,
    "gi",
  );
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseNum(m[1]);
    if (n != null && n > 0) out.push(n);
  }
  return out;
}

// Valores de "KEYWORD <num>" que aparecen SOLOS al principio de una línea
// (las anotaciones manuales del albarán). Evita contar dos veces el mismo
// importe cuando la palabra clave también aparece dentro de la descripción
// del artículo ("redmi watch 5 active 1 tpv 50" + línea "TPV 50").
function collectLineLeading(text: string, keywordRe: string): number[] {
  const lineRe = new RegExp(
    `^[^A-Z0-9]{0,3}${keywordRe}(?![A-Z])[^\\d\\-]{0,10}([\\-]?\\d+(?:[.,]\\d+)?)\\s*$`,
    "i",
  );
  const out: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = lineRe.exec(line.trim());
    if (m) {
      const n = parseNum(m[1]);
      if (n != null && n > 0) out.push(n);
    }
  }
  return out;
}

// Prefiere las anotaciones de línea; si no hay ninguna, usa el texto completo.
function collectPreferLines(text: string, keywordRe: string): number[] {
  const lines = collectLineLeading(text, keywordRe);
  return lines.length > 0 ? lines : collectAllAfter(text, keywordRe);
}

// Último "TOTAL ... <num>" del texto (típicamente el TOTAL (€) del pie).
function findLastTotal(text: string): number | null {
  const re = /\bTOTAL\b(?!\s*L[ÍI]NEA)(?:\s*\(?\s*€?\s*\)?)?\s*[:.]?\s*([\-]?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?)/gi;
  let last: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseNum(m[1]);
    if (n != null) last = n;
  }
  return last;
}

// Fallback: suma de la columna "Total Línea" de la captura del albarán.
// En el OCR esa columna aparece como un bloque de números sueltos justo
// después del encabezado "TOTAL LINEA" (los importes de impuesto llevan "%").
function sumTotalLineaColumn(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const headerIdx = lines.findIndex((l) => /TOTAL\s*L[ÍI]NEA/i.test(l));
  if (headerIdx === -1) return null;
  let total = 0;
  let found = 0;
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line) continue;
    if (line.includes("%")) continue; // columna Impuesto
    const m = /^[\-]?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?$/.exec(line);
    if (!m) continue;
    const n = parseNum(line);
    if (n == null) continue;
    total += n;
    found++;
  }
  return found > 0 ? total : null;
}


export function parseAlbaranText(rawText: string): ParsedAlbaran {
  const text = normalizeFinancialText((rawText ?? "").toUpperCase());
  const warnings: string[] = [];
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // 1) TOTAL del albarán = importe cobrado en EFECTIVO (base del albarán).
  //    Si no hay TOTAL, se suma la columna "Total Línea" de la captura,
  //    y en último caso el keyword PVP.
  let totalAlbaran: number | null = findLastTotal(text);
  if (totalAlbaran == null) totalAlbaran = sumTotalLineaColumn(text);
  if (totalAlbaran == null) totalAlbaran = firstNumberAfter(text, "PVP");

  // 2) PVD = suma de las anotaciones "PDV|PVD|COSTE X" (coste).
  //    Se priorizan las anotaciones que van solas en su línea para no
  //    duplicar valores que también aparecen en la descripción del artículo.
  let pvdValues = [
    ...collectPreferLines(text, "PDV"),
    ...collectPreferLines(text, "PVD"),
    ...collectPreferLines(text, "COSTE"),
  ];

  // 3) Cobros ADICIONALES por tarjeta / banco anotados en comentarios
  //    ("TPV 6" bajo la línea = 6€ extra cobrados con tarjeta, encima del TOTAL).
  const tpv_amount = round2(sumAllValues(collectPreferLines(text, TPV_RE)));
  const banco_amount = round2(sumAllValues(collectPreferLines(text, BANCO_RE)));

  // Fallback: venta manual "PDV 2 TPV 6" sin TOTAL → sólo hay cobro por tarjeta.
  if (totalAlbaran == null && (tpv_amount > 0 || banco_amount > 0)) {
    totalAlbaran = 0; // no hay efectivo, sólo TPV/BANCO
  }
  if (totalAlbaran == null) {
    warnings.push("No se detectó PVP ni TOTAL; se usa 0.");
  }

  // 4) Efectivo = TOTAL del albarán. PVP final = efectivo + TPV + BANCO.
  const efectivo_amount = round2(Math.max(0, totalAlbaran ?? 0));
  const pvp = round2(efectivo_amount + tpv_amount + banco_amount);

  // 4b) El OCR pierde a veces el punto decimal del coste ("PVD 3.14" → "PVD 314").
  //     Si el coste supera el PVP, se reparan esos enteros dividiendo por 100.
  let pvdSum = sumAllValues(pvdValues);
  if (pvp > 0 && pvdSum > pvp) {
    const repaired = pvdValues.map((v) =>
      Number.isInteger(v) && v >= 100 ? v / 100 : v,
    );
    const repairedSum = sumAllValues(repaired);
    if (repairedSum <= pvp) {
      pvdValues = repaired;
      pvdSum = repairedSum;
      warnings.push(
        "Se corrigieron decimales del PVD mal leídos por el OCR; revisa el coste.",
      );
    } else {
      warnings.push("El PVD detectado es mayor que el PVP; revisa la captura.");
    }
  }
  const pvd = round2(pvdSum);

  if (pvdSum === 0) warnings.push("No se detectó PVD/PDV; coste = 0.");


  // 5) ENTREGA (pago parcial global sobre un PVP mayor)
  const entregaVal = firstNumberAfter(text, "ENTREGA");



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
  else {
    // El OCR pierde a veces el "#": "ALBARÁN Nº 100404" → "10#0404"
    const altNum = /ALBAR[\u00c1A]N[^0-9]{0,6}([0-9]{5,8})\b/i.exec(text);
    if (altNum) {
      const raw = altNum[1];
      numero = `${raw.slice(0, raw.length - 4)}#${raw.slice(-4)}`;
    }
  }

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

// Construye un ParsedAlbaran a partir de valores ya extraídos (p. ej. por IA),
// aplicando exactamente la misma lógica de cálculo que el parser de texto.
export function composeAlbaran(input: {
  total: number | null;
  pvd_values: number[];
  tpv_values: number[];
  banco_values: number[];
  entrega: number | null;
  stock: StockLetter | null;
  fecha: string | null;
  numero: string | null;
}): ParsedAlbaran {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const warnings: string[] = [];

  const tpv_amount = round2(sumAllValues(input.tpv_values));
  const banco_amount = round2(sumAllValues(input.banco_values));
  const efectivo_amount = round2(Math.max(0, input.total ?? 0));
  const pvp = round2(efectivo_amount + tpv_amount + banco_amount);
  const pvd = round2(sumAllValues(input.pvd_values));

  if (input.total == null) warnings.push("No se detectó el TOTAL del albarán.");
  if (pvd === 0) warnings.push("No se detectó PVD/PDV; coste = 0.");
  if (pvd > pvp) warnings.push("El PVD detectado es mayor que el PVP; revisa la captura.");

  let ingreso = pvp;
  let coste = pvd;
  let beneficio_real = pvp - pvd;
  let entrega: number | null = null;
  if (input.entrega != null && input.entrega > 0 && pvp > 0) {
    entrega = input.entrega;
    ingreso = input.entrega;
    coste = input.entrega * (pvd / pvp);
    beneficio_real = input.entrega * ((pvp - pvd) / pvp);
  }

  const metodo_pago: MetodoPago =
    efectivo_amount >= tpv_amount && efectivo_amount >= banco_amount
      ? "efectivo"
      : tpv_amount >= banco_amount
      ? "tpv"
      : "banco";

  if (!input.stock)
    warnings.push("No se detectó STOCK (A/C/T); asigna el empleado manualmente.");

  return {
    pvp,
    pvd,
    entrega: entrega != null ? round2(entrega) : null,
    metodo_pago,
    efectivo_amount,
    tpv_amount,
    banco_amount,
    ingreso: round2(ingreso),
    coste: round2(coste),
    beneficio_real: round2(beneficio_real),
    stock: input.stock,
    empleado: input.stock ? STOCK_TO_EMPLEADO[input.stock] : null,
    fecha: input.fecha,
    numero: input.numero,
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
