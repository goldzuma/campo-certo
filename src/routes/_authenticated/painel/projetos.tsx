import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { obterUrlsAssinadas } from "@/lib/painel.functions";
import { copiarTexto } from "@/lib/copiar";
import { gerarSlug } from "@/lib/br";

export const Route = createFileRoute("/_authenticated/painel/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos e links de cadastro" },
      {
        name: "description",
        content:
          "Crie escolinhas, envie o escudo, ative ou desative e copie o link de cadastro para o grupo do WhatsApp.",
      },
      { property: "og:title", content: "Projetos e links de cadastro" },
      {
        property: "og:description",
        content: "Crie escolinhas e copie o link de cadastro para o grupo do WhatsApp.",
      },
    ],
  }),
  component: Projetos,
});

type Projeto = Tables<"projetos">;

function Projetos() {
  const clienteConsulta = useQueryClient();
  const buscarUrls = useServerFn(obterUrlsAssinadas);
  const [novoNome, setNovoNome] = useState("");
  const [origem, setOrigem] = useState("");
  const [logos, setLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    setOrigem(window.location.origin);
  }, []);

  const consulta = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as Projeto[];
    },
  });

  const consultaAtletas = useQuery({
    queryKey: ["contagem-atletas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("atletas").select("projeto_id");
      if (error) throw error;
      return data as { projeto_id: string }[];
    },
  });

  const projetos = consulta.data ?? [];

  const contagens = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const linha of consultaAtletas.data ?? []) {
      mapa.set(linha.projeto_id, (mapa.get(linha.projeto_id) ?? 0) + 1);
    }
    return mapa;
  }, [consultaAtletas.data]);

  useEffect(() => {
    const pendentes = projetos.filter((item) => item.logo_url && !logos[item.id]);
    if (pendentes.length === 0) return;
    let ativo = true;
    (async () => {
      const resposta = await buscarUrls({
        data: {
          bucket: "logos",
          caminhos: pendentes.map((item) => item.logo_url as string).slice(0, 10),
          segundos: 3600,
        },
      });
      if (!ativo) return;
      const novos: Record<string, string> = {};
      for (const item of pendentes) {
        const achado = resposta.urls.find((url) => url.caminho === item.logo_url);
        if (achado) novos[item.id] = achado.url;
      }
      setLogos((atual) => ({ ...atual, ...novos }));
    })();
    return () => {
      ativo = false;
    };
  }, [projetos, logos, buscarUrls]);

  function recarregar() {
    clienteConsulta.invalidateQueries({ queryKey: ["projetos"] });
  }

  async function criar() {
    const nome = novoNome.trim();
    if (nome.length < 3) {
      toast.error("Escreva o nome do projeto");
      return;
    }
    const slug = `${gerarSlug(nome)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("projetos").insert({ nome, slug });
    if (error) {
      toast.error("Nao foi possivel criar o projeto");
      return;
    }
    setNovoNome("");
    toast.success("Projeto criado");
    recarregar();
  }

  async function renomear(projeto: Projeto, nome: string) {
    const limpo = nome.trim();
    if (!limpo || limpo === projeto.nome) return;
    const { error } = await supabase
      .from("projetos")
      .update({ nome: limpo, atualizado_em: new Date().toISOString() })
      .eq("id", projeto.id);
    if (error) {
      toast.error("Nao foi possivel renomear");
      return;
    }
    toast.success("Nome atualizado");
    recarregar();
  }

  async function alternarAtivo(projeto: Projeto) {
    const { error } = await supabase
      .from("projetos")
      .update({ ativo: !projeto.ativo, atualizado_em: new Date().toISOString() })
      .eq("id", projeto.id);
    if (error) {
      toast.error("Nao foi possivel alterar o projeto");
      return;
    }
    recarregar();
  }

  async function enviarLogo(projeto: Projeto, arquivo: File) {
    const extensao = arquivo.name.split(".").pop() || "png";
    const caminho = `${projeto.id}/escudo-${Date.now()}.${extensao.toLowerCase()}`;
    const { error } = await supabase.storage.from("logos").upload(caminho, arquivo, {
      contentType: arquivo.type || "image/png",
      upsert: true,
    });
    if (error) {
      toast.error("Nao foi possivel enviar o escudo");
      return;
    }
    await supabase.from("projetos").update({ logo_url: caminho }).eq("id", projeto.id);
    setLogos((atual) => {
      const copia = { ...atual };
      delete copia[projeto.id];
      return copia;
    });
    toast.success("Escudo atualizado");
    recarregar();
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 text-foreground">
      <header className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
        <h1 className="titulo-grupo text-linha">Projetos</h1>
        <Link to="/painel" className="text-sm text-primary underline">
          Voltar para o painel
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={novoNome}
            onChange={(evento) => setNovoNome(evento.target.value)}
            placeholder="Nome da nova escolinha"
            className="h-9 w-64 border border-input bg-card px-3 text-sm"
            aria-label="Nome da nova escolinha"
          />
          <button
            type="button"
            onClick={criar}
            className="h-9 bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            Criar projeto
          </button>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        {projetos.map((projeto) => {
          const url = `${origem}/cadastro/${projeto.slug}`;
          const mensagem = `Pais e responsáveis, preencham o cadastro do atleta neste link para as inscrições das competições: ${url}`;
          return (
            <section key={projeto.id} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-4">
                {logos[projeto.id] ? (
                  <img
                    src={logos[projeto.id]}
                    alt={`Escudo do projeto ${projeto.nome}`}
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center border border-border text-xs text-muted-foreground">
                    escudo
                  </div>
                )}

                <input
                  defaultValue={projeto.nome}
                  onBlur={(evento) => renomear(projeto, evento.target.value)}
                  aria-label={`Nome do projeto ${projeto.nome}`}
                  className="h-9 w-72 border border-input bg-background px-2 text-base font-semibold"
                />

                <span className="tabular-nums text-sm text-muted-foreground">
                  {contagens.get(projeto.id) ?? 0} atletas
                </span>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={projeto.ativo}
                    onChange={() => alternarAtivo(projeto)}
                  />
                  {projeto.ativo ? "Ativo" : "Inativo"}
                </label>

                <label className="ml-auto cursor-pointer border border-border px-3 py-1.5 text-sm">
                  Enviar escudo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(evento) => {
                      const arquivo = evento.target.files?.[0];
                      if (arquivo) enviarLogo(projeto, arquivo);
                    }}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Link público de cadastro</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 truncate border border-border bg-background px-2 py-2 text-xs">
                      {url}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await copiarTexto(url)) toast.success("Link copiado");
                      }}
                      className="h-9 border border-border px-3 text-sm"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Mensagem pronta para o WhatsApp</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="flex-1 border border-border bg-background px-2 py-2 text-xs">
                      {mensagem}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await copiarTexto(mensagem)) toast.success("Mensagem copiada");
                      }}
                      className="h-9 border border-border px-3 text-sm"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {projetos.length === 0 && !consulta.isLoading ? (
          <p className="text-sm text-muted-foreground">
            Crie a primeira escolinha para gerar o link de cadastro.
          </p>
        ) : null}
      </div>
    </div>
  );
}
