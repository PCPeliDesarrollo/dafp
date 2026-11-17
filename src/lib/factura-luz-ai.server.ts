export type FacturaLuzVision = { monto_total: number | null; kwh_totales: number | null };

const SYSTEM = `Eres un lector experto de facturas de compañías eléctricas españolas.
Devuelve SOLO un JSON válido: {"monto_total":number|null,"kwh_totales":number|null}
- "monto_total": el TOTAL A PAGAR de la factura (con impuestos), en euros.
- "kwh_totales": el consumo total de energía del periodo facturado en kWh (suma de todos los periodos punta/llano/valle si aparecen por separado).
- Usa punto decimal: "1.234,56" = 1234.56.
- Si no es legible, null. No inventes.`;

export async function readFacturaLuzFromGateway(imageDataUrl: string): Promise<FacturaLuzVision> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Falta la clave de IA en el servidor.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions: SYSTEM,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Lee esta factura de luz y devuelve el JSON." },
        { type: "input_image", image_url: imageDataUrl },
      ] }],
      text: { format: { type: "json_schema", name: "factura_luz", strict: true, schema: {
        type: "object", additionalProperties: false, required: ["monto_total", "kwh_totales"],
        properties: { monto_total: { type: ["number", "null"] }, kwh_totales: { type: ["number", "null"] } },
      } } },
    }),
  });
  if (res.status === 429) throw new Error("Límite de peticiones de IA alcanzado, prueba en un minuto.");
  if (res.status === 402) throw new Error("Sin créditos de IA disponibles.");
  if (!res.ok || !res.body) throw new Error(`Error de IA (${res.status})`);
  const reader = res.body.getReader(); const decoder = new TextDecoder();
  let buf = ""; let raw = "";
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim(); if (!d || d === "[DONE]") continue;
      try { const ev = JSON.parse(d); if (ev.type === "response.output_text.delta") raw += ev.delta ?? ""; if (ev.type === "response.failed" || ev.type === "error") throw new Error("La IA no pudo leer la factura."); } catch (e) { if (e instanceof Error && e.message.startsWith("La IA")) throw e; }
    }
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("La IA no devolvió un resultado legible.");
  const p = JSON.parse(match[0]);
  const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : null; };
  return { monto_total: num(p?.monto_total), kwh_totales: num(p?.kwh_totales) };
}
