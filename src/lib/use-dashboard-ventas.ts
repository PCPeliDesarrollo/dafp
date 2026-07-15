import { useQuery } from "@tanstack/react-query";
import { generateMockVentas, type VentaRow } from "./dashboard-mock";
import { useVentasImport } from "./ventas-store";

/**
 * Hook to fetch dashboard sales data.
 *
 * Data source priority:
 *  1. CSV imported by the user (stored in localStorage via ventasStore).
 *  2. Mock data (until the user imports a CSV from their billing software).
 */
export function useDashboardVentas() {
  const imported = useVentasImport();

  const query = useQuery<VentaRow[]>({
    queryKey: ["dashboard_ventas"],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 200));
      return generateMockVentas();
    },
    staleTime: 60_000,
    enabled: !imported.rows,
  });

  if (imported.rows) {
    return {
      data: imported.rows,
      isLoading: false,
      isError: false,
      source: "csv" as const,
      importedAt: imported.importedAt,
      fileName: imported.fileName,
    };
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    source: "mock" as const,
    importedAt: null,
    fileName: null,
  };
}
