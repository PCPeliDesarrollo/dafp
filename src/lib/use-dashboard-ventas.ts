import { useVentasImport } from "./ventas-store";
import { EMPRESA_KEYS, type VistaKey } from "./empresa";
import type { VentaRow } from "./dashboard-mock";

/**
 * Hook to fetch dashboard sales data for a given company (or the combined
 * "general" view). Data comes from Lovable Cloud in realtime.
 */
export function useDashboardVentas(vista: VistaKey) {
  const fjv = useVentasImport(EMPRESA_KEYS[0]);
  const pcp = useVentasImport(EMPRESA_KEYS[1]);

  if (vista === "general") {
    const rows: VentaRow[] = [...(fjv.rows ?? []), ...(pcp.rows ?? [])].sort((a, b) =>
      a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0,
    );
    const loaded = fjv.loaded && pcp.loaded;
    return {
      data: loaded ? rows : undefined,
      isLoading: !loaded,
      isError: false,
      source: (rows.length ? "csv" : "mock") as "csv" | "mock",
      importedAt: fjv.importedAt ?? pcp.importedAt,
      fileName: null as string | null,
    };
  }

  const snap = vista === "pcp" ? pcp : fjv;
  return {
    data: snap.loaded ? (snap.rows ?? []) : undefined,
    isLoading: !snap.loaded,
    isError: false,
    source: (snap.rows ? "csv" : "mock") as "csv" | "mock",
    importedAt: snap.importedAt,
    fileName: snap.fileName,
  };
}
