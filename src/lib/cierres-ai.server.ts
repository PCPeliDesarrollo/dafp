export type CierreVisionEntry = {
  codigo: "BF" | "EF" | "BS" | "ES" | "VA" | "VT" | "VC" | "VS";
  /** Solo para códigos de vendedor (V*): "bruto" = ventas, "neto" = beneficio. */
  tipo?: "bruto" | "neto" | null;
  monto: number;
  mes: number | null;
  anio: number | null;
};

export type CierresVision = { entries: CierreVisionEntry[] };

const SYSTEM = `Eres un lector experto de hojas de contabilidad manuscritas o impresas en español.
Devuelve SOLO un JSON válido con esta forma exacta:
{"entries":[{"codigo":"BF"|"EF"|"BS"|"ES"|"VA"|"VT"|"VC"|"VS","tipo":"bruto"|"neto"|null,"monto":number,"mes":number|null,"anio":number|null}]}

Reglas:
- Busca todas las anotaciones con los códigos BF, EF, BS, ES y su importe en euros. Para estos, "tipo" es null.
- Busca también los códigos de vendedor: VA (Ainhoa), VT (Tomás), VC (Cristina), VS o VO (Otros). Cada uno puede aparecer dos veces: acompañado de "(bruto)" = ventas totales de ese vendedor, y de "(neto)" = beneficio real de ese vendedor. Rellena "tipo" con "bruto" o "neto" según lo indicado junto al código. Si pone VO devuelve el código "VS".
- "monto": el importe tal cual, en número (usa punto decimal). Los importes en formato español (1.234,56) equivalen a 1234.56.
- "mes": número de mes 1-12 si en la imagen aparece el mes al que pertenece esa cantidad (nombre del mes o número). Si no lo ves, null.
- "anio": año de 4 cifras si aparece; si no, null.
- Si una misma imagen contiene varios meses, devuelve una entrada por cada código y mes.
- No inventes nada: si un importe no es legible, omite esa entrada.`;

function normalize(parsed: any): CierresVision {
  const list = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const entries: CierreVisionEntry[] = [];
  for (const e of list) {
    let codigo = String(e?.codigo ?? "").toUpperCase();
    if (codigo === "VO") codigo = "VS";
    const monto = Number(e?.monto);
    const esVend = ["VA", "VT", "VC", "VS"].includes(codigo);
    if (
      (!["BF", "EF", "BS", "ES"].includes(codigo) && !esVend) ||
      !Number.isFinite(monto)
    )
      continue;
    const tipoRaw = String(e?.tipo ?? "").toLowerCase();
    const tipo = esVend ? (tipoRaw.startsWith("net") ? "neto" : "bruto") : null;
    const mes = Number(e?.mes);
    const anio = Number(e?.anio);
    entries.push({
      codigo: codigo as CierreVisionEntry["codigo"],
      tipo,
      monto,
      mes: Number.isFinite(mes) && mes >= 1 && mes <= 12 ? mes : null,
      anio: Number.isFinite(anio) && anio > 1990 ? anio : null,
    });
  }
  return { entries };
}

export async function readCierresImageFromGateway(imageDataUrl: string): Promise<CierresVision> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Falta la clave de IA en el servidor.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Lee esta hoja de cuentas y devuelve el JSON." },
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
  return normalize(JSON.parse(match[0]));
}
