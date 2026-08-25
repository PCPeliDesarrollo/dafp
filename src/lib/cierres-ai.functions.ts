import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readCierresImageFromGateway, type CierresVision } from "./cierres-ai.server";

export const readCierresImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data }): Promise<CierresVision> => {
    return readCierresImageFromGateway(data.imageDataUrl);
  });
