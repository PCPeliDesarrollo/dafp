import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SalesDashboard } from "@/components/SalesDashboard";
import { AnnualView } from "@/components/AnnualView";
import { AuthGate } from "@/components/AuthGate";
import { EmpresaProvider, EMPRESAS, type VistaKey } from "@/lib/empresa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSuperuser } from "@/lib/use-superuser";


type TabKey = VistaKey | "anual";

const TABS: { key: TabKey; label: string }[] = [
  { key: "fjv", label: EMPRESAS.fjv.label },
  { key: "pcp", label: EMPRESAS.pcp.label },
  { key: "general", label: "General" },
  { key: "anual", label: "Año completo" },
];

function DashboardTabs() {
  const { isSuper } = useSuperuser();
  const [vista, setVista] = useState<TabKey>("fjv");
  const tabs = isSuper ? TABS : TABS.filter((t) => t.key !== "anual");

  if (!isSuper && vista === "anual") setVista("fjv");


  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="inline-flex flex-wrap rounded-xl border border-border/60 bg-card/60 p-1 backdrop-blur">
          {TABS.map((t) => (
            <Button
              key={t.key}
              variant="ghost"
              size="sm"
              onClick={() => setVista(t.key)}
              className={cn(
                "h-9 rounded-lg px-4 text-xs font-semibold",
                vista === t.key
                  ? "gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>
      {vista === "anual" ? (
        <AnnualView />
      ) : (
        <EmpresaProvider key={vista} value={vista}>
          <SalesDashboard />
        </EmpresaProvider>
      )}
    </div>
  );
}


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
      <DashboardTabs />
    </AuthGate>
  ),
});
