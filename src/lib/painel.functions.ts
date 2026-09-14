import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  bucket: z.enum(["documentos", "logos"]),
  caminhos: z.array(z.string().min(1).max(300)).max(10),
  segundos: z.number().int().min(10).max(3600).default(60),
});

export const obterUrlsAssinadas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const urls: { caminho: string; url: string }[] = [];

    for (const caminho of data.caminhos) {
      const { data: assinada } = await context.supabase.storage
        .from(data.bucket)
        .createSignedUrl(caminho, data.segundos);
      if (assinada?.signedUrl) urls.push({ caminho, url: assinada.signedUrl });
    }

    return { urls };
  });
