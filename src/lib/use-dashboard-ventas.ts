import { useQuery } from "@tanstack/react-query";
import { generateMockVentas, type VentaRow } from "./dashboard-mock";
import { useVentasImport } from "./ventas-store";

/**
 * Hook to fetch dashboard sales data.
 *
 * Data source priority:
 *  1. Ventas guardadas en Lovable Cloud (sincronizadas en tiempo real).
 *  2. Datos de demostración (mientras no haya ventas importadas).
 */
export function useDashboardVentas() {
  const imported = useVentasImport();

  const query = useQuery<VentaRow[]>({
    queryKey: ["dashboard_ventas_mock"],
    queryFn: async () => generateMockVentas(),
    staleTime: 60_000,
    // Only fall back to mock data once the cloud fetch finished with no rows
    enabled: imported.loaded && !imported.rows,
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

  // While the cloud fetch is in flight, show a loading state instead of mock
  if (!imported.loaded) {
    return {
      data: undefined,
      isLoading: true,
      isError: false,
      source: "mock" as const,
      importedAt: null,
      fileName: null,
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
