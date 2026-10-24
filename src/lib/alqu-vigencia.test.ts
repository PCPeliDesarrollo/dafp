import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { alquActivoEnMes, alquBajaDesde } from "./alqu-vigencia";

describe("Baja mensual ALQU", () => {
  test("OTMAN y RUBÉN dados de baja en octubre no aparecen en las listas de noviembre", () => {
    const tenants = [
      { inquilino: "OTMAN", baja_desde: "2026-11-01" },
      { inquilino: "RUBÉN (NUEVO OCTUBRE)", baja_desde: "2026-11-01" },
      { inquilino: "LOLA", baja_desde: null },
    ];
    assert.deepEqual(tenants.filter((tenant) => alquActivoEnMes(tenant, 2026, 10)).map((tenant) => tenant.inquilino), ["OTMAN", "RUBÉN (NUEVO OCTUBRE)", "LOLA"]);
    assert.deepEqual(tenants.filter((tenant) => alquActivoEnMes(tenant, 2026, 11)).map((tenant) => tenant.inquilino), ["LOLA"]);
  });
  test("una baja en octubre conserva octubre y desaparece desde noviembre", () => {
    const tenant = { baja_desde: alquBajaDesde(2026, 10) };
    assert.equal(tenant.baja_desde, "2026-11-01");
    assert.equal(alquActivoEnMes(tenant, 2026, 9), true);
    assert.equal(alquActivoEnMes(tenant, 2026, 10), true);
    assert.equal(alquActivoEnMes(tenant, 2026, 11), false);
    assert.equal(alquActivoEnMes(tenant, 2027, 1), false);
  });
  test("una baja en diciembre desaparece desde enero del año siguiente", () => {
    assert.equal(alquBajaDesde(2026, 12), "2027-01-01");
    assert.equal(alquActivoEnMes({ baja_desde: "2027-01-01" }, 2027, 1), false);
  });
  test("sin baja el inquilino sigue activo", () => {
    assert.equal(alquActivoEnMes({ baja_desde: null }, 2027, 1), true);
  });
});