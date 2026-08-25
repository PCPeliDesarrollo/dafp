import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VentaRow } from "./dashboard-mock";
import { EMPRESAS, type EmpresaKey } from "./empresa";

type Snapshot = {
  rows: VentaRow[] | null;
  importedAt: string | null;
  fileName: string | null;
  loaded: boolean;
};

function sortRows(rows: VentaRow[]): VentaRow[] {
  return rows.slice().sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0,
  );
}

function createVentasStore(empresa: EmpresaKey) {
  const table = EMPRESAS[empresa].ventasTable;
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = {
    rows: null,
    importedAt: null,
    fileName: null,
    loaded: false,
  };
  let loadStarted = false;

  function emit() {
    listeners.forEach((l) => l());
  }

  async function loadFromCloud() {
    const { data, error } = await supabase
      .from(table as any)
      .select(
        "id, fecha, empleado, total_venta, beneficio, metodo_pago, pvp, pvd, entrega, efectivo_amount, tpv_amount, banco_amount, canje_amount, cliente, updated_at",
      )
      .order("fecha", { ascending: true });

    if (error) {
      console.error(`Error cargando ${table}:`, error);
      snapshot = { ...snapshot, loaded: true };
      emit();
      return;
    }

    const rows: VentaRow[] = ((data ?? []) as any[]).map((r: any) => {
      const pvp = r.pvp != null ? Number(r.pvp) : null;
      const pvd = r.pvd != null ? Number(r.pvd) : null;
      const entrega = r.entrega != null ? Number(r.entrega) : null;
      const hasParsedAlbaranValues = pvp != null || pvd != null || entrega != null;
      return {
        id: r.id,
        fecha: r.fecha,
        empleado: r.empleado,
        total_venta: Number(r.total_venta),
        beneficio: hasParsedAlbaranValues ? Number(r.beneficio) : 0,
        metodo_pago: (r.metodo_pago ?? "efectivo") as VentaRow["metodo_pago"],
        pvp,
        pvd,
        entrega,
        efectivo_amount: r.efectivo_amount != null ? Number(r.efectivo_amount) : null,
        tpv_amount: r.tpv_amount != null ? Number(r.tpv_amount) : null,
        banco_amount: r.banco_amount != null ? Number(r.banco_amount) : null,
        canje_amount: r.canje_amount != null ? Number(r.canje_amount) : 0,
        cliente: r.cliente ?? null,
      };
    });

    const mostRecent = ((data ?? []) as any[]).reduce<string | null>((acc, r) => {
      if (!r.updated_at) return acc;
      return !acc || r.updated_at > acc ? r.updated_at : acc;
    }, null);

    snapshot = {
      rows: rows.length ? rows : null,
      importedAt: mostRecent,
      fileName: rows.length ? "Datos en la nube" : null,
      loaded: true,
    };
    emit();
  }

  function ensureLoaded() {
    if (loadStarted || typeof window === "undefined") return;
    loadStarted = true;

    loadFromCloud();

    const channel = supabase
      .channel(`ventas-store-${empresa}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          loadFromCloud();
        },
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

    /**
     * Upsert imported rows into the cloud. Rows are keyed by `id`, so
     * re-importing the same albarán updates it in place instead of duplicating.
     */
    setImported: async (
      rows: VentaRow[],
      fileName: string,
    ): Promise<{ added: number; updated: number; total: number }> => {
      ensureLoaded();

      const ids = rows.map((r) => r.id);
      const existing = new Set(
        snapshot.rows?.filter((r) => ids.includes(r.id)).map((r) => r.id) ?? [],
      );

      const payload = rows.map((r) => ({
        id: r.id,
        fecha: r.fecha,
        empleado: r.empleado,
        total_venta: r.total_venta,
        beneficio: r.beneficio,
        metodo_pago: r.metodo_pago ?? "efectivo",
        pvp: r.pvp ?? null,
        pvd: r.pvd ?? null,
        entrega: r.entrega ?? null,
        efectivo_amount: r.efectivo_amount ?? null,
        tpv_amount: r.tpv_amount ?? null,
        banco_amount: r.banco_amount ?? null,
        canje_amount: r.canje_amount ?? 0,
        cliente: r.cliente ?? null,
      }));

      const { error } = await supabase
        .from(table as any)
        .upsert(payload as any, { onConflict: "id" });

      if (error) {
        console.error(`Error guardando ${table}:`, error);
        throw error;
      }

      const map = new Map<string, VentaRow>();
      for (const r of snapshot.rows ?? []) map.set(r.id, r);
      for (const r of rows) map.set(r.id, r);

      snapshot = {
        rows: sortRows(Array.from(map.values())),
        importedAt: new Date().toISOString(),
        fileName,
        loaded: true,
      };
      emit();

      let added = 0;
      let updated = 0;
      for (const r of rows) {
        if (existing.has(r.id)) updated++;
        else added++;
      }
      return { added, updated, total: snapshot.rows!.length };
    },

    /**
     * Elimina ventas antiguas de la misma fecha y comercial que quedaron
     * guardadas con un id inestable (formato antiguo `ocr-...` o el id sin
     * huella `alb-<fecha>-<empleado>`), para que un albarán no aparezca
     * duplicado. Nunca borra albaranes con número propio.
     */
    dropLegacyDuplicates: async (fecha: string, empleado: string, keepId: string) => {
      const legacyIds = [`alb-${fecha}-${empleado}`].filter((id) => id !== keepId);

      const { error } = await supabase
        .from(table as any)
        .delete()
        .eq("fecha", fecha)
        .eq("empleado", empleado)
        .like("id", "ocr-%")
        .neq("id", keepId);

      if (error) {
        console.error(`Error limpiando duplicados en ${table}:`, error);
      }

      if (legacyIds.length) {
        const { error: legacyError } = await supabase
          .from(table as any)
          .delete()
          .in("id", legacyIds);
        if (legacyError) {
          console.error(`Error limpiando ids antiguos en ${table}:`, legacyError);
        }
      }

      const rows = (snapshot.rows ?? []).filter(
        (r) =>
          !(
            r.id !== keepId &&
            r.fecha === fecha &&
            r.empleado === empleado &&
            (r.id.startsWith("ocr-") || legacyIds.includes(r.id))
          ),
      );
      snapshot = { ...snapshot, rows: rows.length ? rows : null };
      emit();
    },


    /** Fija el PVD (coste) de un albarán y recalcula su beneficio (PVP total − PVD). */
    updatePvd: async (id: string, pvd: number) => {
      const row = snapshot.rows?.find((r) => r.id === id);
      if (!row) throw new Error("Venta no encontrada");
      const beneficio = row.total_venta - pvd;
      const { error } = await supabase
        .from(table as any)
        .update({ pvd, beneficio } as any)
        .eq("id", id);
      if (error) {
        console.error(`Error actualizando PVD en ${table}:`, error);
        throw error;
      }
      const rows = (snapshot.rows ?? []).map((r) =>
        r.id === id ? { ...r, pvd, beneficio } : r,
      );
      snapshot = { ...snapshot, rows: rows.length ? rows : null };
      emit();
    },

    /** Elimina un albarán concreto por id. */
    remove: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) {
        console.error(`Error eliminando venta en ${table}:`, error);
        throw error;
      }
      const rows = (snapshot.rows ?? []).filter((r) => r.id !== id);
      snapshot = { ...snapshot, rows: rows.length ? rows : null };
      emit();
    },

    clear: async () => {

      const { error } = await supabase.from(table as any).delete().neq("id", "");
      if (error) {
        console.error(`Error borrando ${table}:`, error);
        throw error;
      }
      snapshot = {
        rows: null,
        importedAt: null,
        fileName: null,
        loaded: true,
      };
      emit();
    },
  };
}

export type VentasStore = ReturnType<typeof createVentasStore>;

const stores = new Map<EmpresaKey, VentasStore>();

export function getVentasStore(empresa: EmpresaKey): VentasStore {
  let s = stores.get(empresa);
  if (!s) {
    s = createVentasStore(empresa);
    stores.set(empresa, s);
  }
  return s;
}

const SERVER_SNAPSHOT: Snapshot = {
  rows: null,
  importedAt: null,
  fileName: null,
  loaded: false,
};

export function useVentasImport(empresa: EmpresaKey): Snapshot {
  const store = getVentasStore(empresa);
  return useSyncExternalStore(store.subscribe, store.get, () => SERVER_SNAPSHOT);
}
