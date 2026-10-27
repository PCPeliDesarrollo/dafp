import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { paymentDayInfo, type PaymentCobro } from "./alqu-pago";

const cobro = (
  mes: number,
  estado_pago: PaymentCobro["estado_pago"],
  fecha_cobro: string | null,
  anio = 2026,
  inquilino_id = "t1",
): PaymentCobro => ({ inquilino_id, anio, mes, estado_pago, fecha_cobro });

describe("Día de pago ALQU", () => {
  test("el recibo cobrado del mes manda sobre el historial", () => {
    const cobros = [cobro(10, "Cobrado", "2026-10-26"), cobro(11, "Cobrado", "2026-11-03")];
    assert.deepEqual(paymentDayInfo(cobros, "t1", 2026, 11), { kind: "mes", day: 3, fecha: "2026-11-03" });
  });
  test("sin cobro este mes se muestra el último pago registrado", () => {
    const cobros = [cobro(9, "Cobrado", "2026-09-21"), cobro(10, "Cobrado", "2026-10-24"), cobro(11, "Pendiente", null)];
    assert.deepEqual(paymentDayInfo(cobros, "t1", 2026, 11), { kind: "habitual", day: 24, fecha: "2026-10-24" });
  });
  test("sin historial no hay día de pago que mostrar", () => {
    assert.equal(paymentDayInfo([cobro(11, "Pendiente", null)], "t1", 2026, 11), null);
  });
  test("una fecha de cobro vacía no cuenta como pago", () => {
    assert.equal(paymentDayInfo([cobro(10, "Cobrado", null)], "t1", 2026, 10), null);
  });
  test("no se mezclan los pagos de otros inquilinos", () => {
    const cobros = [cobro(10, "Cobrado", "2026-10-05"), cobro(10, "Cobrado", "2026-10-06", 2026, "t2")];
    assert.deepEqual(paymentDayInfo(cobros, "t1", 2026, 10), { kind: "mes", day: 5, fecha: "2026-10-05" });
    assert.deepEqual(paymentDayInfo(cobros, "t2", 2026, 10), { kind: "mes", day: 6, fecha: "2026-10-06" });
  });
});
