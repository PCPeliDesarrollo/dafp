import { useSyncExternalStore } from "react";
import type { VentaRow } from "./dashboard-mock";

const STORAGE_KEY = "dashboard_ventas_import";

type Snapshot = {
  rows: VentaRow[] | null;
  importedAt: string | null;
  fileName: string | null;
};

const listeners = new Set<() => void>();
let snapshot: Snapshot = { rows: null, importedAt: null, fileName: null };
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) snapshot = JSON.parse(raw);
  } catch {
    /* ignore */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    if (snapshot.rows) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export const ventasStore = {
  get: (): Snapshot => {
    hydrate();
    return snapshot;
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /**
   * Merge newly-imported rows with what's already stored.
   * Rows are keyed by `id`, so re-importing the same albarán/factura updates
   * it in place instead of duplicating. Returns counts for feedback.
   */
  setImported: (
    rows: VentaRow[],
    fileName: string,
  ): { added: number; updated: number; total: number } => {
    hydrate();
    const map = new Map<string, VentaRow>();
    for (const r of snapshot.rows ?? []) map.set(r.id, r);
    let added = 0;
    let updated = 0;
    for (const r of rows) {
      if (map.has(r.id)) updated++;
      else added++;
      map.set(r.id, r);
    }
    snapshot = {
      rows: Array.from(map.values()).sort((a, b) =>
        a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0,
      ),
      importedAt: new Date().toISOString(),
      fileName,
    };
    persist();
    emit();
    return { added, updated, total: snapshot.rows!.length };
  },

  clear: () => {
    snapshot = { rows: null, importedAt: null, fileName: null };
    persist();
    emit();
  },
};

const SERVER_SNAPSHOT: Snapshot = {
  rows: null,
  importedAt: null,
  fileName: null,
};

export function useVentasImport(): Snapshot {
  return useSyncExternalStore(
    ventasStore.subscribe,
    ventasStore.get,
    () => SERVER_SNAPSHOT,
  );
}
