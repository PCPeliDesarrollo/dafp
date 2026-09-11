# Lecturas iniciales y recibos ALQU

## Cambios
- Convertir “Lectura anterior” en un campo editable para cada mensualidad, incluida la primera registrada.
- Guardar esa lectura junto con la actual; al abrir el mes siguiente, usar automáticamente la lectura actual del último mes guardado.
- Tras guardar la mensualidad, abrir el recibo actualizado con alquiler, luz, basura, agua y total.
- Mantener disponible el botón para volver a abrir e imprimir el recibo.

## Detalles técnicos
- Añadir `lectura_anterior` al borrador mensual y utilizarlo en cálculos y validaciones.
- Actualizar la vista previa con el registro recién guardado para evitar mostrar valores antiguos.
- Verificar el flujo completo y los cálculos de luz con IVA.
