/** The selected month is the tenant's last month; retirement starts next month. */
export function alquBajaDesde(anio: number, mes: number) {
  const nextYear = mes === 12 ? anio + 1 : anio;
  const nextMonth = mes === 12 ? 1 : mes + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

export function alquActivoEnMes(tenant: { baja_desde: string | null }, anio: number, mes: number) {
  const selected = `${anio}-${String(mes).padStart(2, "0")}-01`;
  return !tenant.baja_desde || selected < tenant.baja_desde;
}