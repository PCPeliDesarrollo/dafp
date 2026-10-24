import { describe, expect, test } from "bun:test";
import { alquActivoEnMes, alquBajaDesde } from "./alqu-vigencia";

describe("Baja mensual ALQU", () => {
  test("una baja en octubre conserva octubre y desaparece desde noviembre", () => {
    const tenant = { baja_desde: alquBajaDesde(2026, 10) };
    expect(tenant.baja_desde).toBe("2026-11-01");
    expect(alquActivoEnMes(tenant, 2026, 9)).toBe(true);
    expect(alquActivoEnMes(tenant, 2026, 10)).toBe(true);
    expect(alquActivoEnMes(tenant, 2026, 11)).toBe(false);
    expect(alquActivoEnMes(tenant, 2027, 1)).toBe(false);
  });
  test("una baja en diciembre desaparece desde enero del año siguiente", () => {
    expect(alquBajaDesde(2026, 12)).toBe("2027-01-01");
    expect(alquActivoEnMes({ baja_desde: "2027-01-01" }, 2027, 1)).toBe(false);
  });
  test("sin baja el inquilino sigue activo", () => {
    expect(alquActivoEnMes({ baja_desde: null }, 2027, 1)).toBe(true);
  });
});