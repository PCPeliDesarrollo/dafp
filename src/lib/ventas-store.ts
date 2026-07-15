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
  setImported: (rows: VentaRow[], fileName: string) => {
    snapshot = {
      rows,
      importedAt: new Date().toISOString(),
      fileName,
    };
    persist();
    emit();
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
