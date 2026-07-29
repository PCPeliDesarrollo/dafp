import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readAlbaranImageFromGateway, type AlbaranVision } from "./albaran-ai.server";

export const readAlbaranImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ imageDataUrl: z.string().min(20) }).parse(data))
  .handler(async ({ data }): Promise<AlbaranVision> => {
    return readAlbaranImageFromGateway(data.imageDataUrl);
  });
