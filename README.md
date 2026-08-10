# dafp

Actúa como un desarrollador experto en React y Supabase. Necesito que crees una sección de "Dashboard de Ventas y Rendimiento" muy visual, moderna y profesional.

Para que después sea fácil conectarlo a mi base de datos real de Supabase, simula una tabla llamada `dashboard_ventas` con la siguiente estructura de datos (genera datos de prueba realistas para los últimos 30 días con 4 o 5 empleados ficticios):

- id (uuid)

- fecha (date)

- empleado (text)

- total_venta (numeric)

- beneficio (numeric)

El dashboard debe incluir de forma muy visual:

1. **Tarjetas de KPI en la parte superior (con iconos y porcentajes de variación respecto al día anterior):**

   - Total Vendido Hoy (€)

   - Beneficio Neto Hoy (€)

   - Margen de Beneficio Medio (%)

   - Número de Ventas Realizadas Hoy

2. **Gráficos interactivos (usa la librería que prefieras, como Recharts o Shadcn UI charts):**

   - Un gráfico de barras que compare el total vendido hoy por cada empleado, para ver claramente quién va ganando el día.

   - Un gráfico de línea temporal que muestre la evolución diaria de las ventas y los beneficios durante los últimos 15 días.

3. **Sección de Clasificación (Leaderboard):**

   - Un ranking visual de los empleados más vendedores del mes actual, mostrando su foto de perfil (o iniciales), su total vendido, su beneficio generado y una barra de progreso de consecución de objetivos.

4. **Filtros rápidos:**

   - Permite filtrar todo el dashboard por rango de fechas (Hoy, Esta semana, Este mes, Personalizado).

Haz que el diseño sea ultra-limpio, usando un modo oscuro o un tema claro muy profesional con componentes de Shadcn UI y Tailwind CSS. Asegúrate de que el código esté estructurado pensando en que pronto sustituiremos estos datos de prueba por una conexión real a Supabase utilizando hooks de React Query (`useQuery`).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dafp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/727adc5f-7d93-442f-9aa7-cc61b53cc6ff).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
