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
  metodo_pago: MetodoPago;
  ingreso: number;
  coste: number;
  beneficio_real: number;
  stock: StockLetter | null;
  empleado: string | null;
  fecha: string | null;
  warnings: string[];
};


function firstNumberAfter(text: string, keyword: string): number | null {
  // Acepta "PVP 200", "PVP: 200", "PVP=200", "PVP\n200", "PVP 1.234,56"
  const re = new RegExp(
    `\\b${keyword}\\b[^\\d\\-]*([\\-]?\\d{1,3}(?:[.\\s]\\d{3})*(?:[.,]\\d+)?|[\\-]?\\d+(?:[.,]\\d+)?)`,
    "i",
  );
  const m = re.exec(text);
  if (!m) return null;
  // "1.234,56" -> 1234.56 ; "1234.56" -> 1234.56 ; "50" -> 50
  let raw = m[1].replace(/\s/g, "");
  if (raw.includes(",")) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseAlbaranText(rawText: string): ParsedAlbaran {
  const text = (rawText ?? "").toUpperCase();
  const warnings: string[] = [];

  // PVP: primero busca la palabra clave; si no aparece, cae a "TOTAL (€)" del pie.
  let pvpVal = firstNumberAfter(text, "PVP");
  if (pvpVal == null) {
    const totM = /\bTOTAL\b[^\n]{0,20}?([\-]?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?)/i.exec(text);
    if (totM) {
      let raw = totM[1].replace(/\s/g, "");
      if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
      const n = Number(raw);
      if (Number.isFinite(n)) pvpVal = n;
    }
  }
  // PVD: acepta también "PDV" (errata habitual) y "COSTE".
  let pvdVal = firstNumberAfter(text, "PVD");
  if (pvdVal == null) pvdVal = firstNumberAfter(text, "PDV");
  if (pvdVal == null) pvdVal = firstNumberAfter(text, "COSTE");
  const entregaVal = firstNumberAfter(text, "ENTREGA");

  if (pvpVal == null) warnings.push("No se detectó PVP; se usa 0.");
  if (pvdVal == null) warnings.push("No se detectó PVD; se usa 0.");

  const pvp = pvpVal ?? 0;
  const pvd = pvdVal ?? 0;

  // Fecha "dd/mm/yyyy" o "dd-mm-yyyy" (opcionalmente precedida por "FECHA").
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

  const hasTpv = /\bTPV\b/.test(text);
  const hasBanco = /\bBANCO\b/.test(text);
  const metodo_pago: MetodoPago = hasTpv ? "tpv" : hasBanco ? "banco" : "efectivo";

  // Detect STOCK letter (A, C, T). Accepts "STOCK A", "STOCK: A", "STOCK\nA".
  let stock: StockLetter | null = null;
  const stockM = /\bSTOCK\b[^A-Z0-9]*([ACT])\b/.exec(text);
  if (stockM) {
    stock = stockM[1] as StockLetter;
  } else {
    // Fallback: isolated letter A/C/T on its own line/token near "STOCK" section
    const altM = /\b([ACT])\b\s*(?:STOCK|\bSTK\b)/.exec(text);
    if (altM) stock = altM[1] as StockLetter;
  }
  const empleado = stock ? STOCK_TO_EMPLEADO[stock] : null;
  if (!stock) warnings.push("No se detectó STOCK (A/C/T); asigna el empleado manualmente.");


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
    if (entregaVal != null && pvp <= 0) {
      warnings.push("ENTREGA presente pero PVP=0; se ignora la entrega.");
    }
    ingreso = pvp;
    coste = pvd;
    beneficio_real = pvp - pvd;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    pvp: round2(pvp),
    pvd: round2(pvd),
    entrega: entrega != null ? round2(entrega) : null,
    metodo_pago,
    ingreso: round2(ingreso),
    coste: round2(coste),
    beneficio_real: round2(beneficio_real),
    stock,
    empleado,
    warnings,
  };
}

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo (Caja)",
  tpv: "Tarjeta (TPV)",
  banco: "Transferencias (BANCO)",
};
