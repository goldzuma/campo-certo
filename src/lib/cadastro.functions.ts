import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.object({ slug: z.string().min(1).max(80) });

const cadastroSchema = z.object({
  slug: z.string().min(1).max(80),
  nome_completo: z.string().trim().min(3).max(160),
  data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cpf: z.string().regex(/^\d{11}$/),
  rg: z.string().trim().min(2).max(40),
  orgao_emissor: z.string().trim().max(40).optional().default(""),
  nome_mae: z.string().trim().max(160).optional().default(""),
  nome_responsavel: z.string().trim().min(3).max(160),
  telefone_responsavel: z.string().regex(/^\d{10,11}$/),
  documentos: z.array(z.string().min(1).max(300)).max(2).default([]),
  consentimento: z.literal(true),
});

export const obterProjetoPublico = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: projeto } = await supabaseAdmin
      .from("projetos")
      .select("id, nome, slug, logo_url, ativo")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!projeto || !projeto.ativo) {
      return { encontrado: false as const };
    }

    let logo: string | null = null;
    if (projeto.logo_url) {
      const { data: assinada } = await supabaseAdmin.storage
        .from("logos")
        .createSignedUrl(projeto.logo_url, 3600);
      logo = assinada?.signedUrl ?? null;
    }

    return {
      encontrado: true as const,
      projeto: { id: projeto.id, nome: projeto.nome, logo },
    };
  });

export const submeterCadastro = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cadastroSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: projeto } = await supabaseAdmin
      .from("projetos")
      .select("id, ativo")
      .eq("slug", data.slug)
      .maybeSingle();

    // Resposta generica em qualquer situacao, para que ninguem consiga
    // descobrir dados de outro atleta a partir do formulario publico.
    if (!projeto || !projeto.ativo) {
      return { ok: true as const };
    }

    const { data: existente } = await supabaseAdmin
      .from("atletas")
      .select("id, documentos")
      .eq("cpf", data.cpf)
      .maybeSingle();

    const documentosAnteriores = existente?.documentos ?? [];
    const documentos = [...documentosAnteriores, ...data.documentos].slice(-4);

    const registro = {
      projeto_id: projeto.id,
      nome_completo: data.nome_completo,
      data_nascimento: data.data_nascimento,
      cpf: data.cpf,
      rg: data.rg,
      orgao_emissor: data.orgao_emissor || null,
      nome_mae: data.nome_mae || null,
      nome_responsavel: data.nome_responsavel,
      telefone_responsavel: data.telefone_responsavel,
      documentos,
      consentimento_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    if (existente) {
      await supabaseAdmin.from("atletas").update(registro).eq("id", existente.id);
    } else {
      await supabaseAdmin.from("atletas").insert(registro);
    }

    return { ok: true as const };
  });
