import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EmpresaKey } from "./empresa";

export type Aportacion = {
  id: string;
  empresa: EmpresaKey;
  fecha: string;
  monto: number;
  concepto: string;
  fuente: "efectivo" | "banco";
  devuelta: boolean;
  fecha_devolucion: string | null;
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useAportaciones(enabled: boolean) {
  const [rows, setRows] = useState<Aportacion[]>([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await supabase
      .from("aportaciones" as any)
      .select("*")
      .order("fecha", { ascending: false });
    if (error) {
      console.error("Error cargando aportaciones", error);
      return;
    }
    setRows(
      ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        empresa: r.empresa,
        fecha: r.fecha,
        monto: Number(r.monto),
        concepto: r.concepto ?? "",
        fuente: r.fuente === "banco" ? "banco" : "efectivo",
        devuelta: !!r.devuelta,
        fecha_devolucion: r.fecha_devolucion,
      })),
    );
  }, [enabled]);
  useEffect(() => {
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, [load]);
  return rows;
}

export async function addAportacion(a: Omit<Aportacion, "id" | "devuelta" | "fecha_devolucion">) {
  const { error } = await supabase.from("aportaciones" as any).insert(a as any);
  if (error) throw error;
  notify();
}

export async function setAportacionDevuelta(id: string, devuelta: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("aportaciones" as any)
    .update({ devuelta, fecha_devolucion: devuelta ? today : null } as any)
    .eq("id", id);
  if (error) throw error;
  notify();
}

export async function deleteAportacion(id: string) {
  const { error } = await supabase.from("aportaciones" as any).delete().eq("id", id);
  if (error) throw error;
  notify();
}
