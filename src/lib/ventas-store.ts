import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VentaRow } from "./dashboard-mock";

type Snapshot = {
  rows: VentaRow[] | null;
  importedAt: string | null;
  fileName: string | null;
  loaded: boolean;
};

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

function sortRows(rows: VentaRow[]): VentaRow[] {
  return rows.slice().sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0,
  );
}

async function loadFromCloud() {
  const { data, error } = await supabase
    .from("ventas")
    .select("id, fecha, empleado, total_venta, beneficio, updated_at")
    .order("fecha", { ascending: true });

  if (error) {
    console.error("Error cargando ventas:", error);
    snapshot = { ...snapshot, loaded: true };
    emit();
    return;
  }

  const rows: VentaRow[] = (data ?? []).map((r) => ({
    id: r.id,
    fecha: r.fecha,
    empleado: r.empleado,
    total_venta: Number(r.total_venta),
    beneficio: Number(r.beneficio),
  }));

  // Compute a friendly "importedAt" from the most recent updated_at
  const mostRecent = (data ?? []).reduce<string | null>((acc, r) => {
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

  // Realtime: any change from another device refreshes local state
  const channel = supabase
    .channel("ventas-store")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ventas" },
      () => {
        loadFromCloud();
      },
    )
    .subscribe();

  // Best-effort cleanup on unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      supabase.removeChannel(channel);
    });
  }
}

export const ventasStore = {
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

    // Figure out which ids already existed to report accurate counts
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
    }));

    const { error } = await supabase
      .from("ventas")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error("Error guardando ventas:", error);
      throw error;
    }

    // Optimistic local merge (realtime will confirm shortly)
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

  clear: async () => {
    // Delete everything from the cloud
    const { error } = await supabase.from("ventas").delete().neq("id", "");
    if (error) {
      console.error("Error borrando ventas:", error);
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

const SERVER_SNAPSHOT: Snapshot = {
  rows: null,
  importedAt: null,
  fileName: null,
  loaded: false,
};

export function useVentasImport(): Snapshot {
  return useSyncExternalStore(
    ventasStore.subscribe,
    ventasStore.get,
    () => SERVER_SNAPSHOT,
  );
}
