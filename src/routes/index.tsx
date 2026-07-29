import { createFileRoute } from "@tanstack/react-router";
import { SalesDashboard } from "@/components/SalesDashboard";
import { AuthGate } from "@/components/AuthGate";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Dashboard de Ventas y Rendimiento" },
      {
        name: "twitter:description",
        content:
          "Panel visual de ventas, beneficios y clasificación del equipo comercial en tiempo real.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <SalesDashboard />
    </AuthGate>
  ),
});
