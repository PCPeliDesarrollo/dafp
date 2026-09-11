import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type AlquInquilino = Tables<"alqu_inquilinos">;
export type AlquCobro = Tables<"alqu_cobros_mensuales">;
export type AlquInquilinoUpdate = TablesUpdate<"alqu_inquilinos">;
export type AlquCobroInput = TablesInsert<"alqu_cobros_mensuales">;

export async function loadAlquData() {
  const [inquilinosResult, cobrosResult] = await Promise.all([
    supabase.from("alqu_inquilinos").select("*").order("inquilino"),
    supabase
      .from("alqu_cobros_mensuales")
      .select("*")
      .order("anio", { ascending: false })
      .order("mes", { ascending: false }),
  ]);
  if (inquilinosResult.error) throw inquilinosResult.error;
  if (cobrosResult.error) throw cobrosResult.error;
  return {
    inquilinos: inquilinosResult.data ?? [],
    cobros: cobrosResult.data ?? [],
  };
}

export async function updateAlquInquilino(id: string, values: AlquInquilinoUpdate) {
  const { error } = await supabase.from("alqu_inquilinos").update(values).eq("id", id);
  if (error) throw error;
}

export async function upsertAlquCobro(values: AlquCobroInput) {
  const { data, error } = await supabase
    .from("alqu_cobros_mensuales")
    .upsert(values, { onConflict: "inquilino_id,anio,mes" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function previousReading(cobros: AlquCobro[], inquilinoId: string, anio: number, mes: number) {
  const target = anio * 12 + mes;
  return (
    cobros
      .filter((c) => c.inquilino_id === inquilinoId && c.anio * 12 + c.mes < target)
      .sort((a, b) => b.anio * 12 + b.mes - (a.anio * 12 + a.mes))[0]?.lectura_actual ?? 0
  );
}

export function periodicWindow(mes: number, frecuencia: AlquInquilino["frecuencia_basura"]) {
  const size = frecuencia === "Mensual" ? 1 : frecuencia === "Bimestral" ? 2 : 3;
  return { start: Math.floor((mes - 1) / size) * size + 1, size };
}

export function garbageAlreadyPaid(
  cobros: AlquCobro[],
  inquilino: AlquInquilino,
  anio: number,
  mes: number,
  excludingId?: string,
) {
  const { start, size } = periodicWindow(mes, inquilino.frecuencia_basura);
  return cobros.some(
    (c) =>
      c.id !== excludingId &&
      c.inquilino_id === inquilino.id &&
      c.anio === anio &&
      c.mes >= start &&
      c.mes < start + size &&
      c.aplica_basura_mes &&
      c.estado_pago === "Cobrado",
  );
}

export function residualWaterAlreadyPaid(
  cobros: AlquCobro[],
  inquilinoId: string,
  anio: number,
  mes: number,
  excludingId?: string,
) {
  const start = Math.floor((mes - 1) / 2) * 2 + 1;
  return cobros.some(
    (c) =>
      c.id !== excludingId &&
      c.inquilino_id === inquilinoId &&
      c.anio === anio &&
      c.mes >= start &&
      c.mes < start + 2 &&
      c.aplica_agua_residual,
  );
}

export function calculateAlquAmounts(
  inquilino: AlquInquilino,
  lecturaAnterior: number,
  lecturaActual: number,
  aplicaBasura: boolean,
  agua: number,
  aplicaAguaResidual: boolean,
  aguaResidual: number,
) {
  const kw = Math.max(0, lecturaActual - lecturaAnterior);
  const baseLuz = kw * Number(inquilino.precio_kw) + Number(inquilino.minimo_luz);
  const luz = baseLuz * (1 + Number(inquilino.iva) / 100);
  const basura = aplicaBasura ? Number(inquilino.importe_basura) : 0;
  const residual = aplicaAguaResidual ? Math.max(0, aguaResidual) : 0;
  return {
    kw,
    baseLuz,
    luz,
    basura,
    residual,
    total: Number(inquilino.importe_alquiler) + luz + basura + Math.max(0, agua) + residual,
  };
}