# Recuperar el módulo ALQU

## Objetivo
Añadir al menú principal una pestaña **ALQU**, visible solo para el superusuario, aprovechando las dos tablas y los 13 inquilinos que ya existen en la base de datos.

## Qué se construirá
- **Inquilinos**: listado y edición de nombre, dirección, alquiler, basura, frecuencia, IVA, precio/KW, mínimo de luz y notas.
- **Mensualidades**: selector de año y mes, una fila por inquilino y entrada rápida de lectura actual, agua, basura y estado de pago.
- **Lecturas automáticas**: recuperar la última lectura anterior disponible del inquilino y calcular los KW consumidos sin permitir consumos negativos.
- **Cálculo de luz**: `((KW consumidos × precio/KW) + mínimo de luz) × (1 + IVA/100)`.
- **Basura periódica**: proponer el cobro según la frecuencia mensual, bimestral o trimestral; si ya está cobrada dentro del periodo, dejarla a 0 y mostrar que no corresponde. El usuario podrá forzar o quitar el cobro manualmente.
- **Recibo**: vista clara e imprimible con alquiler, lecturas, consumo, precio/KW, mínimo, IVA de luz, basura, agua y total.
- **Cobro**: guardar estado pendiente/cobrado, fecha y persona que cobra.

## Datos y seguridad
- Usar los 13 inquilinos existentes sin duplicarlos.
- Guardar cada inquilino una sola vez por año y mes, actualizando el registro existente.
- Mantener acceso de lectura y edición de ALQU exclusivamente para el superusuario, tanto en la pantalla como en la base de datos.

## Integración y comprobación
- Mantener el diseño oscuro y los controles actuales de la aplicación.
- Conservar el mes seleccionado mientras se cambia entre las vistas internas de ALQU.
- Comprobar cálculos, guardado, recuperación de lectura anterior, basura periódica, marcado como cobrado, impresión y presentación en móvil y escritorio.
