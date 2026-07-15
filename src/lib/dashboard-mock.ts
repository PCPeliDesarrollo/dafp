// Mock data for `dashboard_ventas` table.
// Replace with a real Supabase query when connecting the backend.
//
// Expected Supabase table:
//   create table public.dashboard_ventas (
//     id uuid primary key default gen_random_uuid(),
//     fecha date not null,
//     empleado text not null,
//     total_venta numeric not null,
//     beneficio numeric not null
//   );

export type VentaRow = {
  id: string;
  fecha: string; // ISO date (YYYY-MM-DD)
  empleado: string;
  total_venta: number;
  beneficio: number;
};

const EMPLEADOS = ["Lucía Fernández", "Marcos Ruiz", "Elena García", "Javier Soto", "Nora Vidal"];

// Simple deterministic PRNG so mock data is stable across renders/SSR.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuid(i: number) {
  const hex = (i + 0x1000000).toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-${hex}${hex.slice(0, 4)}`;
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Generates ~30 days of sales for 4-5 employees.
 * Uses a fixed reference date so SSR and CSR match; the "today" filter
 * treats the most recent generated day as "today".
 */
export function generateMockVentas(): VentaRow[] {
  const rand = mulberry32(42);
  const rows: VentaRow[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let counter = 0;
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const iso = toISO(date);

    for (const empleado of EMPLEADOS) {
      // 1-4 sales per employee per day
      const sales = 1 + Math.floor(rand() * 4);
      for (let s = 0; s < sales; s++) {
        const total = Math.round((150 + rand() * 1850) * 100) / 100;
        const marginPct = 0.12 + rand() * 0.28; // 12% - 40%
        const beneficio = Math.round(total * marginPct * 100) / 100;
        rows.push({
          id: uuid(counter++),
          fecha: iso,
          empleado,
          total_venta: total,
          beneficio,
        });
      }
    }
  }
  return rows;
}

export const EMPLEADO_OBJETIVO_MENSUAL = 25000; // € target per employee/month
export const EMPLEADOS_LIST = EMPLEADOS;
