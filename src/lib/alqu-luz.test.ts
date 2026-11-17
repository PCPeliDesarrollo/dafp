import { test } from "node:test";
import assert from "node:assert/strict";
import { precioKwhFactura, isAlcabalas } from "./alqu-luz.ts";

test("precio kWh = monto total / kWh totales", () => {
  assert.equal(precioKwhFactura(300, 1500), 0.2);
});
test("sin factura válida no hay precio", () => {
  assert.equal(precioKwhFactura(300, 0), null);
  assert.equal(precioKwhFactura(0, 100), null);
});
test("detecta apartamentos de las Alcabalas", () => {
  assert.equal(isAlcabalas("ALCABALAS APAR 3"), true);
  assert.equal(isAlcabalas("CALLE MAYOR 2"), false);
});
