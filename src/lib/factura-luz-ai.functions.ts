import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readFacturaLuzFromGateway, type FacturaLuzVision } from "./factura-luz-ai.server";

export const readFacturaLuzImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data }): Promise<FacturaLuzVision> => readFacturaLuzFromGateway(data.imageDataUrl));
