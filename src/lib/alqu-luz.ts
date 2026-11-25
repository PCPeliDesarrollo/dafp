/** Factura global de luz de las Alcabalas: el precio del kWh de cada mes = importe total / kWh totales. */
export const isAlcabalas = (direccion: string | null | undefined) => /alcabalas/i.test(direccion ?? "");

export function precioKwhFactura(montoTotal: number, kwhTotales: number): number | null {
  if (!(montoTotal > 0) || !(kwhTotales > 0)) return null;
  return montoTotal / kwhTotales;
}

/** En Alcabalas, el recibo guardado conserva su precio; si aún no tiene uno, usa el de la ficha del inquilino. */
export function precioKwhAlcabalas(precioRecibo: number | null | undefined, precioContrato: number): number {
  return precioRecibo ?? precioContrato;
}

/** Un precio personalizado en el recibo tiene prioridad sobre la factura y el contrato. */
export function precioKwhRecibo(precioManual: number | null | undefined, precioFactura: number | null | undefined, precioContrato: number): number {
  return precioManual ?? precioFactura ?? precioContrato;
}
