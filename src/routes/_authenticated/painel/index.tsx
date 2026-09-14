import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { obterUrlsAssinadas } from "@/lib/painel.functions";
import { copiarTexto } from "@/lib/copiar";
import { exportarPlanilha } from "@/lib/exportar";
import { digitos, formatarData, mascaraCpf, mascaraTelefone, normalizar } from "@/lib/br";

export const Route = createFileRoute("/_authenticated/painel/")({
  head: () => ({
    meta: [
      { title: "Painel de atletas" },
      {
        name: "description",
        content:
          "Painel privado com todos os atletas por projeto e por ano de nascimento, pronto para copiar campo por campo.",
      },
      { property: "og:title", content: "Painel de atletas" },
      {
        property: "og:description",
        content: "Todos os atletas por projeto e ano de nascimento, prontos para copiar.",
      },
    ],
  }),
  component: Painel,
});

type Projeto = Tables<"projetos">;
type Atleta = Tables<"atletas">;

const CAMPOS_SEQUENCIA = [
  { chave: "nome_completo", rotulo: "Nome" },
  { chave: "data_nascimento", rotulo: "Data de nascimento" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "rg", rotulo: "RG" },
  { chave: "nome_responsavel", rotulo: "Responsavel" },
  { chave: "telefone_responsavel", rotulo: "Telefone" },
] as const;

type ChaveCampo = (typeof CAMPOS_SEQUENCIA)[number]["chave"];

interface Sequencia {
  atletaId: string;
  indice: number;
}

function Painel() {
  const navigate = useNavigate();
  const clienteConsulta = useQueryClient();
  const buscarUrls = useServerFn(obterUrlsAssinadas);

  const [projetoAtivo, setProjetoAtivo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [comMascara, setComMascara] = useState(false);
  const [fechados, setFechados] = useState<number[]>([]);
  const [sequencia, setSequencia] = useState<Sequencia | null>(null);
  const [editando, setEditando] = useState<Atleta | null>(null);
  const [documentos, setDocumentos] = useState<{ atleta: Atleta; urls: string[] } | null>(null);

  useEffect(() => {
    const salvo = window.localStorage.getItem("copiar-com-mascara");
    if (salvo === "1") setComMascara(true);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setBuscaAplicada(busca), 220);
    return () => window.clearTimeout(id);
  }, [busca]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setSequencia(null);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const consultaProjetos = useQuery({
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
    queryKey: ["atletas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atletas")
        .select("*")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return data as Atleta[];
    },
  });

  const projetos = consultaProjetos.data ?? [];
  const atletas = consultaAtletas.data ?? [];

  useEffect(() => {
    if (!projetoAtivo && projetos.length > 0) setProjetoAtivo(projetos[0]?.id ?? null);
  }, [projetos, projetoAtivo]);

  const projeto = projetos.find((item) => item.id === projetoAtivo) ?? null;

  const contagens = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const atleta of atletas) {
      mapa.set(atleta.projeto_id, (mapa.get(atleta.projeto_id) ?? 0) + 1);
    }
    return mapa;
  }, [atletas]);

  const filtrados = useMemo(() => {
    const termo = normalizar(buscaAplicada.trim());
    const termoDigitos = digitos(buscaAplicada);
    return atletas.filter((atleta) => {
      if (atleta.projeto_id !== projetoAtivo) return false;
      if (!termo) return true;
      if (normalizar(atleta.nome_completo).includes(termo)) return true;
      if (termoDigitos.length >= 2 && atleta.cpf.includes(termoDigitos)) return true;
      if (String(atleta.ano_nascimento ?? "").includes(termoDigitos)) return true;
      return false;
    });
  }, [atletas, projetoAtivo, buscaAplicada, termoSeguro(buscaAplicada)]);

  const grupos = useMemo(() => {
    const mapa = new Map<number, Atleta[]>();
    for (const atleta of filtrados) {
      const ano = atleta.ano_nascimento ?? 0;
      const lista = mapa.get(ano) ?? [];
      lista.push(atleta);
      mapa.set(ano, lista);
    }
    return [...mapa.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtrados]);

  function alternarMascara() {
    const proximo = !comMascara;
    setComMascara(proximo);
    window.localStorage.setItem("copiar-com-mascara", proximo ? "1" : "0");
  }

  function valorCopia(atleta: Atleta, chave: ChaveCampo): string {
    if (chave === "cpf") return comMascara ? mascaraCpf(atleta.cpf) : digitos(atleta.cpf);
    if (chave === "telefone_responsavel") {
      return comMascara
        ? mascaraTelefone(atleta.telefone_responsavel)
        : digitos(atleta.telefone_responsavel);
    }
    if (chave === "data_nascimento") return formatarData(atleta.data_nascimento);
    return String(atleta[chave] ?? "");
  }

  async function copiar(texto: string, rotulo: string) {
    const ok = await copiarTexto(texto);
    if (ok) toast.success(`${rotulo} copiado`);
    else toast.error("Nao foi possivel copiar");
  }

  async function copiarLinha(atleta: Atleta) {
    const linha = CAMPOS_SEQUENCIA.map((campo) => valorCopia(atleta, campo.chave)).join("\t");
    await copiar(linha, "Linha");
  }

  async function avancarSequencia(atleta: Atleta) {
    const atual = sequencia && sequencia.atletaId === atleta.id ? sequencia.indice : 0;
    const campo = CAMPOS_SEQUENCIA[atual];
    if (!campo) {
      setSequencia(null);
      return;
    }
    await copiar(valorCopia(atleta, campo.chave), campo.rotulo);
    const proximo = atual + 1;
    if (proximo >= CAMPOS_SEQUENCIA.length) setSequencia(null);
    else setSequencia({ atletaId: atleta.id, indice: proximo });
  }

  function linhasExportacao(lista: Atleta[]) {
    return lista.map((atleta) => [
      atleta.nome_completo,
      formatarData(atleta.data_nascimento),
      comMascara ? mascaraCpf(atleta.cpf) : digitos(atleta.cpf),
      atleta.rg,
      atleta.nome_responsavel,
      comMascara
        ? mascaraTelefone(atleta.telefone_responsavel)
        : digitos(atleta.telefone_responsavel),
      (atleta.documentos ?? []).length,
    ]);
  }

  async function abrirDocumentos(atleta: Atleta) {
    const caminhos = atleta.documentos ?? [];
    if (caminhos.length === 0) {
      toast.info("Este atleta ainda nao tem documentos enviados");
      return;
    }
    const resposta = await buscarUrls({
      data: { bucket: "documentos", caminhos, segundos: 60 },
    });
    setDocumentos({ atleta, urls: resposta.urls.map((item) => item.url) });
  }

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const totalProjeto = filtrados.length;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-border bg-card">
        <div className="px-4 py-4">
          <h1 className="titulo-grupo text-linha">Atletas</h1>
          <p className="text-xs text-muted-foreground">Painel do professor</p>
        </div>
        <nav className="px-2">
          {projetos.map((item) => {
            const ativo = item.id === projetoAtivo;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setProjetoAtivo(item.id)}
                className={`flex w-full items-center justify-between px-2 py-2 text-left text-sm ${
                  ativo ? "bg-accent font-semibold text-primary" : "text-foreground/90"
                }`}
              >
                <span className="truncate">
                  {item.nome}
                  {item.ativo ? "" : " · inativo"}
                </span>
                <span className="ml-2 tabular-nums text-xs text-muted-foreground">
                  {contagens.get(item.id) ?? 0}
                </span>
              </button>
            );
          })}
          {projetos.length === 0 && !consultaProjetos.isLoading ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              Nenhum projeto criado ainda.
            </p>
          ) : null}
        </nav>
        <div className="mt-4 border-t border-border px-4 py-3">
          <Link to="/painel/projetos" className="text-sm text-primary underline">
            Gerenciar projetos
          </Link>
          <button
            type="button"
            onClick={sair}
            className="mt-3 block text-sm text-muted-foreground underline"
          >
            Sair da conta
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome, CPF ou ano"
            className="h-9 w-72 border border-input bg-card px-3 text-sm"
            aria-label="Buscar atletas"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={comMascara} onChange={alternarMascara} />
            Copiar com máscara
          </label>
          <span className="tabular-nums text-sm text-muted-foreground">
            {totalProjeto} atletas
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={filtrados.length === 0}
              onClick={() =>
                exportarPlanilha(
                  `atletas-${projeto?.slug ?? "projeto"}`,
                  linhasExportacao(filtrados),
                )
              }
              className="h-9 border border-border px-3 text-sm disabled:opacity-50"
            >
              Exportar projeto
            </button>
          </div>
        </header>

        <div className="px-4 pb-24">
          {projeto && filtrados.length === 0 && !buscaAplicada ? (
            <EstadoVazio projeto={projeto} />
          ) : null}

          {buscaAplicada && filtrados.length === 0 ? (
            <p className="py-10 text-sm text-muted-foreground">
              Nenhum atleta encontrado para esta busca.
            </p>
          ) : null}

          {grupos.map(([ano, lista]) => {
            const aberto = !fechados.includes(ano);
            return (
              <section key={ano} className="mt-6">
                <div className="flex items-center gap-3 border-b-2 border-primary/70 pb-1">
                  <button
                    type="button"
                    onClick={() =>
                      setFechados((atual) =>
                        atual.includes(ano)
                          ? atual.filter((item) => item !== ano)
                          : [...atual, ano],
                      )
                    }
                    className="titulo-grupo text-left text-linha"
                    aria-expanded={aberto}
                  >
                    {ano} — {lista.length} {lista.length === 1 ? "atleta" : "atletas"}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportarPlanilha(`atletas-${ano}`, linhasExportacao(lista))}
                    className="ml-auto h-7 border border-border px-2 text-xs"
                  >
                    Exportar {ano}
                  </button>
                </div>

                {aberto ? (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold tracking-wide text-muted-foreground">
                        <th className="px-2 py-1 font-semibold">Nome completo</th>
                        <th className="px-2 py-1 font-semibold">Data de nascimento</th>
                        <th className="px-2 py-1 font-semibold">CPF</th>
                        <th className="px-2 py-1 font-semibold">RG</th>
                        <th className="px-2 py-1 font-semibold">Responsável</th>
                        <th className="px-2 py-1 font-semibold">Telefone</th>
                        <th className="px-2 py-1 font-semibold">Documentos</th>
                        <th className="px-2 py-1 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((atleta) => {
                        const emSequencia = sequencia?.atletaId === atleta.id;
                        const indiceAtual = emSequencia ? sequencia.indice : -1;
                        return (
                          <tr
                            key={atleta.id}
                            className="border-b border-border/60"
                            style={{ height: "36px" }}
                          >
                            {CAMPOS_SEQUENCIA.map((campo, indice) => (
                              <td key={campo.chave} className="p-0">
                                <Celula
                                  exibicao={
                                    campo.chave === "cpf"
                                      ? mascaraCpf(atleta.cpf)
                                      : campo.chave === "telefone_responsavel"
                                        ? mascaraTelefone(atleta.telefone_responsavel)
                                        : campo.chave === "data_nascimento"
                                          ? formatarData(atleta.data_nascimento)
                                          : String(atleta[campo.chave] ?? "")
                                  }
                                  destaque={indiceAtual === indice}
                                  onCopiar={() => copiar(valorCopia(atleta, campo.chave), campo.rotulo)}
                                  titulo={`Copiar ${campo.rotulo}`}
                                />
                              </td>
                            ))}
                            <td className="px-2">
                              <button
                                type="button"
                                onClick={() => abrirDocumentos(atleta)}
                                className="tabular-nums text-sm text-primary underline"
                              >
                                {(atleta.documentos ?? []).length}
                              </button>
                            </td>
                            <td className="px-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => copiarLinha(atleta)}
                                  className="border border-border px-2 py-0.5 text-xs"
                                >
                                  Copiar linha
                                </button>
                                <button
                                  type="button"
                                  onClick={() => avancarSequencia(atleta)}
                                  className={`border px-2 py-0.5 text-xs ${
                                    emSequencia
                                      ? "border-primary bg-primary/20 text-primary"
                                      : "border-border"
                                  }`}
                                >
                                  {emSequencia
                                    ? `Copiar ${CAMPOS_SEQUENCIA[indiceAtual]?.rotulo ?? ""}`
                                    : "Copiar em sequência"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditando(atleta)}
                                  aria-label={`Editar ${atleta.nome_completo}`}
                                  className="border border-border px-2 py-0.5 text-xs"
                                >
                                  Editar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : null}
              </section>
            );
          })}
        </div>
      </main>

      {documentos ? (
        <Lightbox
          nome={documentos.atleta.nome_completo}
          urls={documentos.urls}
          onFechar={() => setDocumentos(null)}
        />
      ) : null}

      {editando ? (
        <Gaveta
          atleta={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            clienteConsulta.invalidateQueries({ queryKey: ["atletas"] });
          }}
        />
      ) : null}
    </div>
  );
}

function termoSeguro(valor: string) {
  return digitos(valor);
}

function Celula({
  exibicao,
  destaque,
  titulo,
  onCopiar,
}: {
  exibicao: string;
  destaque: boolean;
  titulo: string;
  onCopiar: () => void;
}) {
  const referencia = useRef<HTMLButtonElement | null>(null);

  return (
    <button
      ref={referencia}
      type="button"
      title={titulo}
      onClick={() => {
        const elemento = referencia.current;
        if (elemento) {
          elemento.classList.remove("flash-copia");
          void elemento.offsetWidth;
          elemento.classList.add("flash-copia");
          window.setTimeout(() => elemento.classList.remove("flash-copia"), 160);
        }
        onCopiar();
      }}
      className={`celula-copiavel truncate py-1 text-sm ${
        destaque ? "bg-primary/25 font-semibold text-primary" : ""
      }`}
    >
      {exibicao}
    </button>
  );
}

function EstadoVazio({ projeto }: { projeto: Projeto }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/cadastro/${projeto.slug}`);
  }, [projeto.slug]);

  return (
    <section className="mt-10 max-w-xl border border-border bg-card p-6">
      <h2 className="titulo-grupo text-linha">Nenhum atleta ainda</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Envie este link no grupo do WhatsApp. Os cadastros aparecem aqui automaticamente.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 truncate border border-border bg-background px-2 py-2 text-xs">
          {url}
        </code>
        <button
          type="button"
          onClick={async () => {
            const ok = await copiarTexto(url);
            if (ok) toast.success("Link copiado");
          }}
          className="h-9 bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          Copiar link
        </button>
      </div>
    </section>
  );
}

function Lightbox({
  nome,
  urls,
  onFechar,
}: {
  nome: string;
  urls: string[];
  onFechar: () => void;
}) {
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      role="dialog"
      aria-label={`Documentos de ${nome}`}
      className="fixed inset-0 z-40 flex flex-col bg-fundo-fundo/95 p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="titulo-grupo text-linha">Documentos de {nome}</h2>
        <button type="button" onClick={onFechar} className="border border-border px-3 py-1 text-sm">
          Fechar
        </button>
      </div>
      <div className="mt-4 grid flex-1 gap-4 overflow-auto md:grid-cols-2">
        {urls.map((url, indice) => (
          <figure key={url} className="border border-border bg-card p-3">
            <img
              src={url}
              alt={`Documento ${indice + 1} de ${nome}`}
              className="max-h-[60vh] w-full object-contain"
            />
            <figcaption className="mt-2">
              <a
                href={url}
                download
                className="text-sm text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                Baixar arquivo {indice + 1}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Gaveta({
  atleta,
  onFechar,
  onSalvo,
}: {
  atleta: Atleta;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [forma, setForma] = useState({
    nome_completo: atleta.nome_completo,
    data_nascimento: atleta.data_nascimento,
    cpf: mascaraCpf(atleta.cpf),
    rg: atleta.rg,
    orgao_emissor: atleta.orgao_emissor ?? "",
    nome_mae: atleta.nome_mae ?? "",
    nome_responsavel: atleta.nome_responsavel,
    telefone_responsavel: mascaraTelefone(atleta.telefone_responsavel),
  });
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const { error } = await supabase
      .from("atletas")
      .update({
        nome_completo: forma.nome_completo.trim(),
        data_nascimento: forma.data_nascimento,
        cpf: digitos(forma.cpf),
        rg: forma.rg.trim(),
        orgao_emissor: forma.orgao_emissor.trim() || null,
        nome_mae: forma.nome_mae.trim() || null,
        nome_responsavel: forma.nome_responsavel.trim(),
        telefone_responsavel: digitos(forma.telefone_responsavel),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", atleta.id);
    setSalvando(false);
    if (error) {
      toast.error("Nao foi possivel salvar as alteracoes");
      return;
    }
    toast.success("Cadastro atualizado");
    onSalvo();
  }

  async function excluir() {
    const { error } = await supabase.from("atletas").delete().eq("id", atleta.id);
    if (error) {
      toast.error("Nao foi possivel excluir");
      return;
    }
    toast.success("Atleta excluido");
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-fundo-fundo/70">
      <div className="h-full w-full max-w-md overflow-auto border-l border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="titulo-grupo text-linha">Editar atleta</h2>
          <button
            type="button"
            onClick={onFechar}
            className="border border-border px-3 py-1 text-sm"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {(
            [
              ["nome_completo", "Nome completo", "text"],
              ["data_nascimento", "Data de nascimento", "date"],
              ["cpf", "CPF", "text"],
              ["rg", "RG", "text"],
              ["orgao_emissor", "Orgao emissor", "text"],
              ["nome_mae", "Nome da mae", "text"],
              ["nome_responsavel", "Nome do responsavel", "text"],
              ["telefone_responsavel", "Telefone do responsavel", "text"],
            ] as [keyof typeof forma, string, string][]
          ).map(([chave, rotulo, tipo]) => (
            <div key={chave}>
              <label htmlFor={`campo-${chave}`} className="block text-xs text-muted-foreground">
                {rotulo}
              </label>
              <input
                id={`campo-${chave}`}
                type={tipo}
                value={forma[chave]}
                onChange={(evento) => {
                  const bruto = evento.target.value;
                  const valor =
                    chave === "cpf"
                      ? mascaraCpf(bruto)
                      : chave === "telefone_responsavel"
                        ? mascaraTelefone(bruto)
                        : bruto;
                  setForma((atual) => ({ ...atual, [chave]: valor }));
                }}
                className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm tabular-nums"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="mt-5 h-10 w-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Salvar alterações
        </button>

        <div className="mt-8 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-destructive">Excluir atleta</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta acao apaga o cadastro para sempre. Digite EXCLUIR para confirmar.
          </p>
          <input
            value={confirmacao}
            onChange={(evento) => setConfirmacao(evento.target.value)}
            aria-label="Confirmacao de exclusao"
            className="mt-2 h-9 w-full border border-input bg-background px-2 text-sm"
          />
          <button
            type="button"
            disabled={confirmacao.trim().toUpperCase() !== "EXCLUIR"}
            onClick={excluir}
            className="mt-2 h-9 w-full bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-40"
          >
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}
