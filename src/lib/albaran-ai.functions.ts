import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageDataUrl: z.string().min(20),
});

export type AlbaranVision = {
  numero: string | null;
  fecha: string | null;
  stock: "A" | "C" | "T" | null;
  total: number | null;
  pvd_values: number[];
  tpv_values: number[];
  banco_values: number[];
  entrega: number | null;
};

const SYSTEM = `Eres un lector experto de albaranes de venta españoles.
Devuelve SOLO un JSON válido con esta forma exacta:
{"numero":string|null,"fecha":"YYYY-MM-DD"|null,"stock":"A"|"C"|"T"|null,"total":number|null,"pvd_items":[{"valor":number,"cantidad":number}],"tpv_values":number[],"banco_values":number[],"entrega":number|null}

Reglas:
- "numero": el número de albarán tal cual, por ejemplo "10#0355".
- "fecha": la fecha del albarán.
- "stock": la letra del cliente "STOCK A" / "STOCK C" / "STOCK T".
- "total": el TOTAL (€) del pie del albarán (base imponible + impuestos).
- "pvd_items": TODAS las anotaciones manuales "PVD" o "PDV" bajo las líneas de artículo (coste POR UNIDAD). Para cada una, "valor" es el número anotado con sus decimales exactos (PVD 3.14 => 3.14, PVD 0.15 => 0.15) y "cantidad" es la columna "Cant" de la línea de artículo a la que pertenece esa anotación (si no la ves, usa 1). NO multipliques tú: devuelve valor y cantidad por separado.
- "tpv_values": TODAS las anotaciones manuales "TPV" bajo las líneas (cobros con tarjeta). No incluyas números que estén dentro del texto de la descripción del artículo si ya están anotados debajo; cada anotación cuenta una sola vez.
- "banco_values": anotaciones "BANCO" o transferencias.
- "entrega": si hay una anotación "ENTREGA", su importe; si no, null.
No inventes valores. Si no ves algo, usa null o lista vacía.`;

export const readAlbaranImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<AlbaranVision> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Falta la clave de IA en el servidor.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Lee este albarán y devuelve el JSON." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Límite de peticiones de IA alcanzado, prueba en un minuto.");
    if (res.status === 402) throw new Error("Sin créditos de IA disponibles.");
    if (!res.ok) throw new Error(`Error de IA (${res.status})`);

    const json = (await res.json()) as any;
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La IA no devolvió un resultado legible.");
    const parsed = JSON.parse(match[0]);

    const nums = (v: unknown): number[] =>
      Array.isArray(v)
        ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
        : [];

    // PVD anotado es coste POR UNIDAD → se multiplica por la cantidad de la línea.
    const pvdItems: number[] = Array.isArray(parsed?.pvd_items)
      ? parsed.pvd_items
          .map((it: any) => {
            const valor = Number(it?.valor);
            const cantRaw = Number(it?.cantidad);
            const cant = Number.isFinite(cantRaw) && cantRaw > 0 ? cantRaw : 1;
            return Number.isFinite(valor) && valor > 0
              ? Math.round(valor * cant * 100) / 100
              : 0;
          })
          .filter((n: number) => n > 0)
      : nums(parsed?.pvd_values);

    const stock = ["A", "C", "T"].includes(parsed?.stock) ? parsed.stock : null;

    return {
      numero: typeof parsed?.numero === "string" ? parsed.numero.replace(/\s+/g, "") : null,
      fecha: typeof parsed?.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)
        ? parsed.fecha
        : null,
      stock,
      total: Number.isFinite(Number(parsed?.total)) ? Number(parsed.total) : null,
      pvd_values: pvdItems,

      tpv_values: nums(parsed?.tpv_values),
      banco_values: nums(parsed?.banco_values),
      entrega: Number.isFinite(Number(parsed?.entrega)) && Number(parsed.entrega) > 0
        ? Number(parsed.entrega)
        : null,
    };
  });
