import type { EmpresaKey } from "./empresa";
import type { CierreFuente, CierreInput, VendedorLetra } from "./cierres-store";

/**
 * Códigos de vendedor: VA = Ainhoa, VT = Tomás, VC = Cristina, VS/VO = Otros.
 * "(bruto)" son las ventas totales y "(neto)" los beneficios reales.
 */
export const VENDEDOR_LETRA: Record<string, VendedorLetra> = {
  A: "A",
  T: "T",
  C: "C",
  S: "S",
  O: "S",
};

/**
 * Códigos de cierre histórico:
 *  BF = Banco Francisco  -> banco de FJV
 *  EF = Efectivo Francisco -> efectivo de FJV
 *  BS = Banco PCP -> banco de PCP
 *  ES = Efectivo PCP -> efectivo de PCP
 */
export const CIERRE_CODIGOS: Record<
  string,
  { empresa: EmpresaKey; fuente: CierreFuente; label: string }
> = {
  BF: { empresa: "fjv", fuente: "banco", label: "Banco FJV" },
  EF: { empresa: "fjv", fuente: "efectivo", label: "Efectivo FJV" },
  BS: { empresa: "pcp", fuente: "banco", label: "Banco PCP" },
  ES: { empresa: "pcp", fuente: "efectivo", label: "Efectivo PCP" },
};

export const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseAmount(raw: string): number | null {
  let s = raw.replace(/[€\s]/g, "").replace(/[()]/g, "");
  if (!s) return null;
  const negative = raw.trim().startsWith("-") || /\(.*\)/.test(raw);
  s = s.replace(/^-/, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    if (decimals === 3) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function findMesAnio(line: string): { mes?: number; anio?: number } {
  const norm = normalize(line);
  let mes: number | undefined;
  let anio: number | undefined;

  const nameIdx = MESES_ES.findIndex((m) => norm.includes(m.slice(0, 4)) && norm.includes(m.slice(0, 3)));
  if (nameIdx >= 0) {
    const exact = MESES_ES.findIndex((m) => norm.includes(m));
    mes = (exact >= 0 ? exact : nameIdx) + 1;
  }

  const yearMatch = norm.match(/\b(20\d{2})\b/);
  if (yearMatch) anio = Number(yearMatch[1]);

  // formatos 07/2025, 7-2025
  const mmYyyy = norm.match(/\b(0?[1-9]|1[0-2])[\/\-](20\d{2})\b/);
  if (mmYyyy) {
    mes = Number(mmYyyy[1]);
    anio = Number(mmYyyy[2]);
  }
  // formatos 2025-07
  const yyyyMm = norm.match(/\b(20\d{2})[\/\-](0?[1-9]|1[0-2])\b/);
  if (yyyyMm) {
    anio = Number(yyyyMm[1]);
    mes = Number(yyyyMm[2]);
  }
  return { mes, anio };
}

export type ParseCierresResult = {
  entries: CierreInput[];
  warnings: string[];
};

/**
 * Lee texto libre / CSV con líneas tipo:
 *   "JULIO 2025"      (contexto de mes)
 *   "BF 1.234,56"     (código + importe)
 *   "07/2025;ES;980"  (todo en la misma línea)
 */
export function parseCierresText(
  text: string,
  fallback: { mes: number; anio: number; empresaVendedores?: EmpresaKey },
): ParseCierresResult {
  const empresaFallback: EmpresaKey = fallback.empresaVendedores ?? "fjv";
  /** Empresa deducida del contexto (título FJV/PCP o últimos códigos BF/EF vs BS/ES). */
  let ctxEmpresa: EmpresaKey | null = null;
  const warnings: string[] = [];
  const map = new Map<string, CierreInput>();
  let ctxMes = fallback.mes;
  let ctxAnio = fallback.anio;
  let sawAny = false;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const { mes, anio } = findMesAnio(line);
    const codeMatches = [
      ...line.matchAll(/\b(BF|EF|BS|ES)\b|\bV\s*([ATCSO])\b\s*\(?\s*(brut\w*|net\w*)\)?/gi),
    ];

    const nline = normalize(line);
    if (/\bfjv\b|francisco/.test(nline)) ctxEmpresa = "fjv";
    else if (/\bpcp\b/.test(nline)) ctxEmpresa = "pcp";

    if (!codeMatches.length) {
      if (mes) ctxMes = mes;
      if (anio) ctxAnio = anio;
      continue;
    }

    const lineMes = mes ?? ctxMes;
    const lineAnio = anio ?? ctxAnio;
    if (mes) ctxMes = mes;
    if (anio) ctxAnio = anio;

    for (let i = 0; i < codeMatches.length; i++) {
      const m = codeMatches[i]!;
      const esVendedor = !m[1];
      const letra = esVendedor ? VENDEDOR_LETRA[m[2]!.toUpperCase()] : undefined;
      const tipo = esVendedor
        ? m[3]!.toLowerCase().startsWith("brut")
          ? ("bruto" as const)
          : ("neto" as const)
        : undefined;
      const codigo = esVendedor
        ? `V${m[2]!.toUpperCase()} (${tipo})`
        : m[1]!.toUpperCase();
      const start = (m.index ?? 0) + m[0]!.length;
      const end = i + 1 < codeMatches.length ? codeMatches[i + 1]!.index ?? line.length : line.length;
      const segment = line.slice(start, end);
      const numMatch = segment.match(/-?\(?\d[\d.,]*\)?/);
      if (!numMatch) {
        warnings.push(`Sin importe para ${codigo} en: "${line}"`);
        continue;
      }
      const monto = parseAmount(numMatch[0]);
      if (monto == null) {
        warnings.push(`Importe no válido para ${codigo} en: "${line}"`);
        continue;
      }
      if (!esVendedor) ctxEmpresa = CIERRE_CODIGOS[codigo]!.empresa;
      const empresa: EmpresaKey = esVendedor
        ? ctxEmpresa ?? empresaFallback
        : CIERRE_CODIGOS[codigo]!.empresa;
      const fuente: CierreFuente = esVendedor
        ? (`${tipo}:${letra}` as CierreFuente)
        : CIERRE_CODIGOS[codigo]!.fuente;
      const key = `${empresa}-${lineAnio}-${lineMes}-${fuente}`;
      map.set(key, {
        empresa,
        anio: lineAnio,
        mes: lineMes,
        fuente,
        codigo,
        monto,
        notas: null,
      });
      sawAny = true;
    }
  }

  if (!sawAny)
    warnings.push(
      "No se ha encontrado ningún código BF, EF, BS, ES ni VA/VT/VC/VS (bruto/neto).",
    );

  return { entries: Array.from(map.values()), warnings };
}

export function formatMesAnio(mes: number, anio: number): string {
  const nombre = MESES_ES[mes - 1] ?? String(mes);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}
