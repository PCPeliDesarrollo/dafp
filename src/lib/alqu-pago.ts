/** Ficha mínima de un recibo necesaria para saber en qué día paga un inquilino. */
export type PaymentCobro = {
  inquilino_id: string;
  anio: number;
  mes: number;
  estado_pago: "Pendiente" | "Cobrado";
  fecha_cobro: string | null;
};

export type PaymentDay =
  | { kind: "mes"; day: number; fecha: string }
  | { kind: "habitual"; day: number; fecha: string };

const dayOfMonth = (fecha: string | null) => {
  if (!fecha) return null;
  const day = Number(fecha.slice(8, 10));
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : null;
};

/**
 * Día en que paga el inquilino: si el recibo del mes elegido ya está cobrado, ese día exacto;
 * si aún no lo está, el último pago registrado (para poder seguir viendo su costumbre).
 */
export function paymentDayInfo(
  cobros: PaymentCobro[],
  inquilinoId: string,
  anio: number,
  mes: number,
): PaymentDay | null {
  const thisMonth = cobros.find((c) => c.inquilino_id === inquilinoId && c.anio === anio && c.mes === mes);
  if (thisMonth?.estado_pago === "Cobrado") {
    const day = dayOfMonth(thisMonth.fecha_cobro);
    if (day && thisMonth.fecha_cobro) return { kind: "mes", day, fecha: thisMonth.fecha_cobro };
  }
  const paid = cobros
    .filter((c) => c.inquilino_id === inquilinoId && c.estado_pago === "Cobrado" && dayOfMonth(c.fecha_cobro))
    .sort((a, b) => b.anio * 12 + b.mes - (a.anio * 12 + a.mes));
  if (!paid.length) return null;
  return { kind: "habitual", day: dayOfMonth(paid[0].fecha_cobro)!, fecha: paid[0].fecha_cobro! };
}
