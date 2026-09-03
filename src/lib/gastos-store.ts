import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EMPRESAS, EMPRESA_KEYS, type EmpresaKey } from "./empresa";

export type GastoCategoria = "personales" | "tienda";
export type GastoFuente = "efectivo" | "banco";

export type Gasto = {
  id: string;
  fecha: string; // ISO
  monto: number; // positivo, EUR
  concepto: string;
  categoria: GastoCategoria;
  fuente: GastoFuente;
  referencia?: string | null;
};

type Snapshot = {
  rows: Gasto[];
  loaded: boolean;
};

function makeId() {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createGastosStore(empresa: EmpresaKey) {
  const table = EMPRESAS[empresa].gastosTable;
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = { rows: [], loaded: false };
  let loadStarted = false;

  function emit() {
    listeners.forEach((l) => l());
  }

  async function loadFromCloud() {
    const { data, error } = await supabase
      .from(table as any)
      .select("id, fecha, monto, concepto, categoria, fuente, referencia")
      .order("fecha", { ascending: false });
    if (error) {
      console.error(`Error cargando ${table}:`, error);
      snapshot = { ...snapshot, loaded: true };
      emit();
      return;
    }
    snapshot = {
      rows: ((data ?? []) as any[]).map((r: any) => ({
        id: r.id,
        fecha: r.fecha,
        monto: Number(r.monto),
        concepto: r.concepto ?? "",
        categoria: (r.categoria ?? "tienda") as GastoCategoria,
        fuente: (r.fuente ?? "efectivo") as GastoFuente,
        referencia: r.referencia ?? null,
      })),
      loaded: true,
    };
    emit();
  }

  function ensureLoaded() {
    if (loadStarted || typeof window === "undefined") return;
    loadStarted = true;
    loadFromCloud();
    const channel = supabase
      .channel(`gastos-store-${empresa}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => loadFromCloud(),
      )
      .subscribe();
    window.addEventListener("beforeunload", () => {
      supabase.removeChannel(channel);
    });
  }

  return {
    empresa,
    get: (): Snapshot => {
      ensureLoaded();
      return snapshot;
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },

    addManual: async (input: {
      fecha: string;
      monto: number;
      concepto: string;
      categoria: GastoCategoria;
      fuente?: GastoFuente;
    }) => {
      const row: Gasto = {
        id: makeId(),
        fecha: input.fecha,
        monto: Math.abs(input.monto),
        concepto: input.concepto,
        categoria: input.categoria,
        fuente: input.fuente ?? "efectivo",
        referencia: null,
      };
      const { error } = await supabase.from(table as any).insert({
        id: row.id,
        fecha: row.fecha,
        monto: row.monto,
        concepto: row.concepto,
        categoria: row.categoria,
        fuente: row.fuente,
      } as any);
      if (error) throw error;
      snapshot = { rows: [row, ...snapshot.rows], loaded: true };
      emit();
    },

    bulkUpsertBank: async (
      items: { fecha: string; monto: number; concepto: string; referencia: string }[],
    ) => {
      if (!items.length) return { added: 0, skipped: 0 };
      // Huella por contenido: si ya tenemos ese movimiento (misma fecha,
      // importe y concepto) no se vuelve a insertar, aunque su id sea antiguo.
      const fp = (fecha: string, monto: number, concepto: string) =>
        `${fecha}|${Math.abs(monto).toFixed(2)}|${concepto.trim().slice(0, 40).toLowerCase()}`;
      const existingFp = new Set(
        snapshot.rows
          .filter((r) => r.fuente === "banco")
          .map((r) => fp(r.fecha, r.monto, r.concepto)),
      );
      const fresh = items.filter(
        (it) => !existingFp.has(fp(it.fecha, it.monto, it.concepto)),
      );
      const skipped = items.length - fresh.length;
      if (!fresh.length) return { added: 0, skipped };

      const payload = fresh.map((it) => ({
        id: `bank-${it.referencia}`,
        fecha: it.fecha,
        monto: Math.abs(it.monto),
        concepto: it.concepto,
        categoria: "tienda" as const,
        fuente: "banco" as const,
        referencia: it.referencia,
      }));
      const existing = new Set(snapshot.rows.map((r) => r.id));
      const { error } = await supabase
        .from(table as any)
        .upsert(payload as any, { onConflict: "id" });
      if (error) throw error;
      await loadFromCloud();
      const added = payload.filter((p) => !existing.has(p.id)).length;
      return { added, skipped };
    },


    clear: async () => {
      const { error } = await supabase.from(table as any).delete().neq("id", "");
      if (error) throw error;
      snapshot = { rows: [], loaded: true };
      emit();
    },

    remove: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
      snapshot = { rows: snapshot.rows.filter((r) => r.id !== id), loaded: true };
      emit();
    },
  };
}

export type GastosStore = ReturnType<typeof createGastosStore>;

const stores = new Map<EmpresaKey, GastosStore>();

export function getGastosStore(empresa: EmpresaKey): GastosStore {
  let s = stores.get(empresa);
  if (!s) {
    s = createGastosStore(empresa);
    stores.set(empresa, s);
  }
  return s;
}

const SERVER_SNAPSHOT: Snapshot = { rows: [], loaded: false };

export function useGastos(empresa: EmpresaKey): Snapshot {
  const store = getGastosStore(empresa);
  return useSyncExternalStore(store.subscribe, store.get, () => SERVER_SNAPSHOT);
}

/** Gastos de todas las empresas juntos (vista General). */
export function useGastosGeneral(): Snapshot {
  const a = useGastos(EMPRESA_KEYS[0]);
  const b = useGastos(EMPRESA_KEYS[1]);
  return {
    rows: [...a.rows, ...b.rows].sort((x, y) => (x.fecha < y.fecha ? 1 : -1)),
    loaded: a.loaded && b.loaded,
  };
}

export const CATEGORIA_LABEL: Record<GastoCategoria, string> = {
  personales: "Gastos Personales",
  tienda: "Gastos Tienda",
};

export const FUENTE_LABEL: Record<GastoFuente, string> = {
  efectivo: "Efectivo (Caja)",
  banco: "Banco (CSV)",
};
