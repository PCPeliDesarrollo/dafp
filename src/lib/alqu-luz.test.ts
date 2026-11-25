import { test } from "node:test";
import assert from "node:assert/strict";
import { precioKwhFactura, precioKwhMes, precioKwhRecibo, isAlcabalas } from "./alqu-luz.ts";

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
test("el precio editable del recibo tiene prioridad sobre la factura", () => {
  assert.equal(precioKwhRecibo(0.25, 0.2, 0.18), 0.25);
});
test("sin precio editable se mantiene el precio de la factura", () => {
  assert.equal(precioKwhRecibo(null, 0.2, 0.18), 0.2);
});
test("el precio mensual corregido sustituye al cálculo de la factura", () => {
  assert.equal(precioKwhMes(0.25, 300, 1500), 0.25);
});
test("sin corrección mensual se usa importe dividido entre kWh", () => {
  assert.equal(precioKwhMes(null, 300, 1500), 0.2);
});
