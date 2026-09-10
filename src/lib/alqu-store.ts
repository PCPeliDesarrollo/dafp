import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FrecuenciaBasura = "Mensual" | "Trimestral" | "Bimestral";
export type EstadoBasura =
  | "Cobrado este trimestre"
  | "No corresponde pagar"
  | "Pendiente de cobro";
export type EstadoPago = "Pendiente" | "Cobrado";

export type Inquilino = {
  id: string;
  inquilino: string;
  direccion: string;
  importe_alquiler: number;
  importe_basura: number;
  frecuencia_basura: FrecuenciaBasura;
  iva: number;
  precio_kw: number;
  minimo_luz: number;
  notas: string | null;
};

export type Cobro = {
  id: string;
  inquilino_id: string;
  anio: number;
  mes: number;
  trimestre: number;
  lectura_anterior: number;
  lectura_actual: number;
  kw_consumidos: number;
  total_luz: number;
  aplica_basura_mes: boolean;
  estado_basura_trimestre: EstadoBasura;
  importe_basura_cobrado: number;
  importe_agua: number;
  total_a_cobrar: number;
  fecha_cobro: string | null;
  quien_cobra: string | null;
  estado_pago: EstadoPago;
};

type Snapshot = { inquilinos: Inquilino[]; cobros: Cobro[]; loaded: boolean };

const listeners = new Set<() => void>();
let snapshot: Snapshot = { inquilinos: [], cobros: [], loaded: false };
let loadStarted = false;

function emit() {
  listeners.forEach((l) => l());
}

function mapInquilino(r: any): Inquilino {
  return {
    id: r.id,
    inquilino: r.inquilino ?? "",
    direccion: r.direccion ?? "",
    importe_alquiler: Number(r.importe_alquiler ?? 0),
    importe_basura: Number(r.importe_basura ?? 0),
    frecuencia_basura: (r.frecuencia_basura ?? "Trimestral") as FrecuenciaBasura,
    iva: Number(r.iva ?? 21),
    precio_kw: Number(r.precio_kw ?? 0),
    minimo_luz: Number(r.minimo_luz ?? 0),
    notas: r.notas ?? null,
  };
}

function mapCobro(r: any): Cobro {
  return {
    id: r.id,
    inquilino_id: r.inquilino_id,
    anio: Number(r.anio),
    mes: Number(r.mes),
    trimestre: Number(r.trimestre),
    lectura_anterior: Number(r.lectura_anterior ?? 0),
    lectura_actual: Number(r.lectura_actual ?? 0),
    kw_consumidos: Number(r.kw_consumidos ?? 0),
    total_luz: Number(r.total_luz ?? 0),
    aplica_basura_mes: !!r.aplica_basura_mes,
    estado_basura_trimestre: (r.estado_basura_trimestre ??
      "Pendiente de cobro") as EstadoBasura,
    importe_basura_cobrado: Number(r.importe_basura_cobrado ?? 0),
    importe_agua: Number(r.importe_agua ?? 0),
    total_a_cobrar: Number(r.total_a_cobrar ?? 0),
    fecha_cobro: r.fecha_cobro ?? null,
    quien_cobra: r.quien_cobra ?? null,
    estado_pago: (r.estado_pago ?? "Pendiente") as EstadoPago,
  };
}

async function loadFromCloud() {
  const [inq, cob] = await Promise.all([
    supabase.from("alqu_inquilinos" as any).select("*").order("inquilino"),
    supabase
      .from("alqu_cobros_mensuales" as any)
      .select("*")
      .order("anio")
      .order("mes"),
  ]);
  if (inq.error) console.error("Error cargando alqu_inquilinos:", inq.error);
  if (cob.error) console.error("Error cargando alqu_cobros_mensuales:", cob.error);
  snapshot = {
    inquilinos: ((inq.data ?? []) as any[]).map(mapInquilino),
    cobros: ((cob.data ?? []) as any[]).map(mapCobro),
    loaded: true,
  };
  emit();
}

function ensureLoaded() {
  if (loadStarted || typeof window === "undefined") return;
  loadStarted = true;
  loadFromCloud();
  supabase
    .channel("alqu-store")
    .on("postgres_changes", { event: "*", schema: "public", table: "alqu_inquilinos" }, () =>
      loadFromCloud(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "alqu_cobros_mensuales" },
      () => loadFromCloud(),
    )
    .subscribe();
}

export const alquStore = {
  get: (): Snapshot => {
    ensureLoaded();
    return snapshot;
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  saveInquilino: async (
    id: string | null,
    values: Omit<Inquilino, "id">,
  ) => {
    if (id) {
      const { error } = await supabase
        .from("alqu_inquilinos" as any)
        .update(values as any)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("alqu_inquilinos" as any).insert(values as any);
      if (error) throw error;
    }
    await loadFromCloud();
  },
  removeInquilino: async (id: string) => {
    const { error } = await supabase.from("alqu_inquilinos" as any).delete().eq("id", id);
    if (error) throw error;
    await loadFromCloud();
  },
  saveCobro: async (
    input: Omit<Cobro, "id" | "trimestre"> & { id?: string },
  ) => {
    const { id, ...rest } = input;
    const { error } = await supabase
      .from("alqu_cobros_mensuales" as any)
      .upsert({ ...(id ? { id } : {}), ...rest } as any, {
        onConflict: "inquilino_id,anio,mes",
      });
    if (error) throw error;
    await loadFromCloud();
  },
  removeCobro: async (id: string) => {
    const { error } = await supabase.from("alqu_cobros_mensuales" as any).delete().eq("id", id);
    if (error) throw error;
    await loadFromCloud();
  },
};

const SERVER_SNAPSHOT: Snapshot = { inquilinos: [], cobros: [], loaded: false };

export function useAlqu(): Snapshot {
  return useSyncExternalStore(alquStore.subscribe, alquStore.get, () => SERVER_SNAPSHOT);
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function trimestreDe(mes: number) {
  return Math.floor((mes - 1) / 3) + 1;
}

export function eur(n: number) {
  return `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Mes anterior (año, mes) a partir de un periodo. */
export function mesAnterior(anio: number, mes: number): { anio: number; mes: number } {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

export function calcTotalLuz(inq: Inquilino, kw: number) {
  return Math.max(0, kw) * inq.precio_kw + inq.minimo_luz;
}

/**
 * Periodo de agrupación del recibo de basura según la frecuencia:
 * trimestral = trimestre natural, bimestral = bimestre natural,
 * mensual = el propio mes.
 */
export function periodoBasura(inq: Inquilino, anio: number, mes: number): string {
  if (inq.frecuencia_basura === "Mensual") return `${anio}-M${mes}`;
  if (inq.frecuencia_basura === "Bimestral") return `${anio}-B${Math.floor((mes - 1) / 2) + 1}`;
  return `${anio}-Q${trimestreDe(mes)}`;
}

/**
 * ¿Ya se ha cobrado la basura en el periodo (trimestre/bimestre) de este mes?
 * Solo cuenta si el recibo aplicaba basura y está cobrado, en otro mes distinto.
 */
export function basuraYaCobrada(
  inq: Inquilino,
  cobros: Cobro[],
  anio: number,
  mes: number,
): boolean {
  const periodo = periodoBasura(inq, anio, mes);
  return cobros.some(
    (c) =>
      c.inquilino_id === inq.id &&
      !(c.anio === anio && c.mes === mes) &&
      periodoBasura(inq, c.anio, c.mes) === periodo &&
      c.aplica_basura_mes &&
      c.estado_pago === "Cobrado",
  );
}
