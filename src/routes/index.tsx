import { createFileRoute } from "@tanstack/react-router";
import { SalesDashboard } from "@/components/SalesDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Ventas y Rendimiento" },
      {
        name: "description",
        content:
          "Panel visual de ventas, beneficios y clasificación del equipo comercial en tiempo real.",
      },
      { property: "og:title", content: "Dashboard de Ventas y Rendimiento" },
      {
        property: "og:description",
        content:
          "Panel visual de ventas, beneficios y clasificación del equipo comercial en tiempo real.",
      },
    ],
  }),
  component: SalesDashboard,
});
