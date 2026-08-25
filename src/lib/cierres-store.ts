import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EmpresaKey } from "./empresa";

/** Letras de vendedor: A = Ainhoa, T = Tomás, C = Cristina, S = Otros. */
export type VendedorLetra = "A" | "T" | "C" | "S";

/**
 * Fuente del importe cerrado:
 *  - "efectivo" / "banco": dinero final del mes (BF/EF/BS/ES)
 *  - "bruto:<letra>" / "neto:<letra>": ventas y beneficios de cada vendedor (VA/VT/VC/VS)
 */
export type CierreFuente =
  | "banco"
  | "efectivo"
  | `bruto:${VendedorLetra}`
  | `neto:${VendedorLetra}`;

export const VENDEDOR_NOMBRE: Record<VendedorLetra, string> = {
  A: "Ainhoa",
  T: "Tomás",
  C: "Cristina",
  S: "Otros",
};

export function parseFuenteVendedor(
  fuente: string,
): { tipo: "bruto" | "neto"; letra: VendedorLetra } | null {
  const m = /^(bruto|neto):([ATCS])$/.exec(fuente);
  if (!m) return null;
  return { tipo: m[1] as "bruto" | "neto", letra: m[2] as VendedorLetra };
}

export function cierreFuenteLabel(fuente: string): string {
  const v = parseFuenteVendedor(fuente);
  if (v) {
    return `${VENDEDOR_NOMBRE[v.letra]} · ${v.tipo === "bruto" ? "Ventas" : "Beneficio"}`;
  }
  return fuente === "banco" ? "Banco" : "Efectivo";
}

export type Cierre = {
  id: string;
  empresa: EmpresaKey;
  anio: number;
  mes: number; // 1-12
  fuente: CierreFuente;
  codigo: string | null;
  monto: number;
  notas: string | null;
};

export type CierreInput = Omit<Cierre, "id">;

type Snapshot = { rows: Cierre[]; loaded: boolean };

const listeners = new Set<() => void>();
let snapshot: Snapshot = { rows: [], loaded: false };
let loadStarted = false;

function emit() {
  listeners.forEach((l) => l());
}

function mapRow(r: any): Cierre {
  return {
    id: r.id,
    empresa: r.empresa as EmpresaKey,
    anio: Number(r.anio),
    mes: Number(r.mes),
    fuente: r.fuente as CierreFuente,
    codigo: r.codigo ?? null,
    monto: Number(r.monto),
    notas: r.notas ?? null,
  };
}

async function loadFromCloud() {
  const { data, error } = await supabase
    .from("cierres_mensuales" as any)
    .select("id, empresa, anio, mes, fuente, codigo, monto, notas")
    .order("anio", { ascending: true })
    .order("mes", { ascending: true });

  if (error) {
    console.error("Error cargando cierres_mensuales:", error);
    snapshot = { ...snapshot, loaded: true };
    emit();
    return;
  }
  snapshot = { rows: ((data ?? []) as any[]).map(mapRow), loaded: true };
  emit();
}

function ensureLoaded() {
  if (loadStarted || typeof window === "undefined") return;
  loadStarted = true;
  loadFromCloud();
  supabase
    .channel("cierres-mensuales-store")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cierres_mensuales" },
      () => loadFromCloud(),
    )
    .subscribe();
}

export const cierresStore = {
  get: (): Snapshot => {
    ensureLoaded();
    return snapshot;
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Guarda cierres sobrescribiendo el existente de esa empresa/año/mes/fuente. */
  upsert: async (entries: CierreInput[]) => {
    ensureLoaded();
    if (!entries.length) return { total: 0 };
    const { error } = await supabase
      .from("cierres_mensuales" as any)
      .upsert(
        entries.map((e) => ({
          empresa: e.empresa,
          anio: e.anio,
          mes: e.mes,
          fuente: e.fuente,
          codigo: e.codigo ?? null,
          monto: e.monto,
          notas: e.notas ?? null,
        })) as any,
        { onConflict: "empresa,anio,mes,fuente" },
      );
    if (error) {
      console.error("Error guardando cierres_mensuales:", error);
      throw error;
    }
    await loadFromCloud();
    return { total: entries.length };
  },
  remove: async (id: string) => {
    const { error } = await supabase
      .from("cierres_mensuales" as any)
      .delete()
      .eq("id", id);
    if (error) throw error;
    snapshot = { ...snapshot, rows: snapshot.rows.filter((r) => r.id !== id) };
    emit();
  },
};

const SERVER_SNAPSHOT: Snapshot = { rows: [], loaded: false };

export function useCierres(): Snapshot {
  return useSyncExternalStore(cierresStore.subscribe, cierresStore.get, () => SERVER_SNAPSHOT);
}

/** Cierres de una empresa (o todas si es "general") para un mes/año concreto. */
export function cierresDelMes(
  rows: Cierre[],
  empresas: EmpresaKey[],
  anio: number,
  mes: number,
): Cierre[] {
  return rows.filter(
    (r) => empresas.includes(r.empresa) && r.anio === anio && r.mes === mes,
  );
}

export function sumCierres(rows: Cierre[], fuente?: CierreFuente): number {
  return rows
    .filter((r) => !fuente || r.fuente === fuente)
    .reduce((acc, r) => acc + r.monto, 0);
}
