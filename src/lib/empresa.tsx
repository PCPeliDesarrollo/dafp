import { createContext, useContext, type ReactNode } from "react";

/** Empresas gestionadas en el dashboard. "general" es la vista combinada. */
export type EmpresaKey = "fjv" | "pcp";
export type VistaKey = EmpresaKey | "general";

export const EMPRESAS: Record<EmpresaKey, { label: string; ventasTable: string; gastosTable: string }> = {
  fjv: { label: "FJV", ventasTable: "ventas", gastosTable: "gastos" },
  pcp: { label: "PCP", ventasTable: "ventas_pcp", gastosTable: "gastos_pcp" },
};

export const EMPRESA_KEYS: EmpresaKey[] = ["fjv", "pcp"];

const EmpresaContext = createContext<VistaKey>("fjv");

export function EmpresaProvider({
  value,
  children,
}: {
  value: VistaKey;
  children: ReactNode;
}) {
  return <EmpresaContext.Provider value={value}>{children}</EmpresaContext.Provider>;
}

/** Vista activa: una empresa concreta o "general". */
export function useVista(): VistaKey {
  return useContext(EmpresaContext);
}

/**
 * Empresa activa para escribir datos. En la vista "general" no se escribe,
 * así que cae a la primera empresa por seguridad de tipos.
 */
export function useEmpresa(): EmpresaKey {
  const vista = useVista();
  return vista === "general" ? "fjv" : vista;
}
