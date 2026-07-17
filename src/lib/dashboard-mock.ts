// Mock data for `dashboard_ventas` table.
// Replace with a real Supabase query when connecting the backend.

import type { MetodoPago } from "./albaran-parser";

export type VentaRow = {
  id: string;
  fecha: string; // ISO date (YYYY-MM-DD)
  empleado: string;
  total_venta: number; // = ingreso real
  beneficio: number; // = beneficio real
  metodo_pago?: MetodoPago;
  pvp?: number | null;
  pvd?: number | null;
  entrega?: number | null;
  efectivo_amount?: number | null;
  tpv_amount?: number | null;
  banco_amount?: number | null;
};

const EMPLEADOS = ["Lucía Fernández", "Marcos Ruiz", "Elena García", "Javier Soto", "Nora Vidal"];

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
      const sales = 1 + Math.floor(rand() * 4);
      for (let s = 0; s < sales; s++) {
        const total = Math.round((150 + rand() * 1850) * 100) / 100;
        rows.push({
          id: uuid(counter++),
          fecha: iso,
          empleado,
          total_venta: total,
          beneficio: 0,
          metodo_pago: "efectivo",
        });
      }
    }
  }
  return rows;
}

export const EMPLEADO_OBJETIVO_MENSUAL = 25000;
export const EMPLEADOS_LIST = EMPLEADOS;
