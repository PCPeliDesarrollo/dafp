import { useQuery } from "@tanstack/react-query";
import { generateMockVentas, type VentaRow } from "./dashboard-mock";

/**
 * Hook to fetch dashboard sales data.
 *
 * When connecting to Supabase, replace the queryFn with:
 *
 *   const { data, error } = await supabase
 *     .from("dashboard_ventas")
 *     .select("*")
 *     .order("fecha", { ascending: false });
 *   if (error) throw error;
 *   return data as VentaRow[];
 */
export function useDashboardVentas() {
  return useQuery<VentaRow[]>({
    queryKey: ["dashboard_ventas"],
    queryFn: async () => {
      // Simulate network latency
      await new Promise((r) => setTimeout(r, 250));
      return generateMockVentas();
    },
    staleTime: 60_000,
  });
}
