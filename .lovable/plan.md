# Archivo mensual de recibos ALQU

## Objetivo
Guardar cada recibo en el historial de ALQU y facilitar su consulta por mes y año.

## Cambios
- Mantener el guardado definitivo en la base de datos cuando se pulse **Guardar**.
- Añadir una pestaña **Recibos guardados**.
- Agrupar los recibos por año y mes, con totales, estado y acceso para abrir e imprimir cada recibo.
- Mostrar claramente los meses sin recibos y conservar el selector de periodo actual.

## Detalles técnicos
- Se reutilizarán los cobros mensuales ya almacenados; no se duplicarán datos ni se crearán copias locales.
- Cada inquilino seguirá teniendo un único recibo por mes, actualizable mediante el guardado existente.
- La nueva vista respetará los permisos exclusivos del superusuario para ALQU.

## Verificación
- Comprobar el listado mensual, la apertura de recibos y la visualización en escritorio y móvil.
