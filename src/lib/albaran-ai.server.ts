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
- "fecha": copia exclusivamente la fecha impresa en el campo principal "Fecha" de la cabecera del albarán. Comprueba con cuidado día y mes; no uses fechas de líneas, comentarios ni otras referencias. No cambies el día. Si no es perfectamente legible, devuelve null.
- "stock": la letra del cliente "STOCK A" / "STOCK C" / "STOCK T".
- "total": el TOTAL (€) del pie del albarán (base imponible + impuestos). Si no aparece un TOTAL final claro, usa la suma de la columna "Total Línea".
- "pvd_items": TODAS las anotaciones manuales "PVD" o "PDV" bajo las líneas de artículo (coste POR UNIDAD). Para cada una, "valor" es el número anotado con sus decimales exactos (PVD 3.14 => 3.14, PVD 0.15 => 0.15) y "cantidad" es la columna "Cant" de la línea de artículo a la que pertenece esa anotación (si no la ves, usa 1). NO multipliques tú: devuelve valor y cantidad por separado.
- "tpv_values": TODAS las anotaciones manuales "TPV" bajo las líneas (cobros con tarjeta). No incluyas números que estén dentro del texto de la descripción del artículo si ya están anotados debajo; cada anotación cuenta una sola vez.
- "banco_values": anotaciones "BANCO" o transferencias.
- "entrega": si hay una anotación "ENTREGA", su importe; si no, null.
No inventes valores. Si no ves algo, usa null o lista vacía.`;

function asPositiveNumbers(v: unknown): number[] {
  return Array.isArray(v)
    ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
}

function normalizeVisionResult(parsed: any): AlbaranVision {
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
    : asPositiveNumbers(parsed?.pvd_values);

  const stock = ["A", "C", "T"].includes(parsed?.stock) ? parsed.stock : null;

  return {
    numero: typeof parsed?.numero === "string" ? parsed.numero.replace(/\s+/g, "") : null,
    fecha:
      typeof parsed?.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)
        ? parsed.fecha
        : null,
    stock,
    total: Number.isFinite(Number(parsed?.total)) ? Number(parsed.total) : null,
    pvd_values: pvdItems,
    tpv_values: asPositiveNumbers(parsed?.tpv_values),
    banco_values: asPositiveNumbers(parsed?.banco_values),
    entrega:
      Number.isFinite(Number(parsed?.entrega)) && Number(parsed.entrega) > 0
        ? Number(parsed.entrega)
        : null,
  };
}

export async function readAlbaranImageFromGateway(imageDataUrl: string): Promise<AlbaranVision> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Falta la clave de IA en el servidor.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Lee este albarán y devuelve el JSON." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (res.status === 429) throw new Error("Límite de peticiones de IA alcanzado, prueba en un minuto.");
  if (res.status === 402) throw new Error("Sin créditos de IA disponibles.");
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Error de IA (${res.status})${errorText ? `: ${errorText.slice(0, 180)}` : ""}`);
  }

  const json = (await res.json()) as any;
  const raw: string = json?.choices?.[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("La IA no devolvió un resultado legible.");
  return normalizeVisionResult(JSON.parse(match[0]));
}