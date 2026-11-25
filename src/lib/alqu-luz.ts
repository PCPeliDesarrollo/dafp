/** Factura global de luz de las Alcabalas: el precio del kWh de cada mes = importe total / kWh totales. */
export const isAlcabalas = (direccion: string | null | undefined) => /alcabalas/i.test(direccion ?? "");

export function precioKwhFactura(montoTotal: number, kwhTotales: number): number | null {
  if (!(montoTotal > 0) || !(kwhTotales > 0)) return null;
  return montoTotal / kwhTotales;
}

/** Un precio personalizado en el recibo tiene prioridad sobre la factura y el contrato. */
export function precioKwhRecibo(precioManual: number | null | undefined, precioFactura: number | null | undefined, precioContrato: number): number {
  return precioManual ?? precioFactura ?? precioContrato;
}
