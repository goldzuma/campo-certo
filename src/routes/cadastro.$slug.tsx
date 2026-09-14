import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { obterProjetoPublico, submeterCadastro } from "@/lib/cadastro.functions";
import {
  contarPalavras,
  digitos,
  idadeEm,
  mascaraCpf,
  mascaraTelefone,
  primeiroNome,
  tituloCase,
  validarCpf,
} from "@/lib/br";

export const Route = createFileRoute("/cadastro/$slug")({
  head: () => ({
    meta: [
      { title: "Cadastro do atleta" },
      {
        name: "description",
        content:
          "Formulario para pais e responsaveis cadastrarem o atleta nas competicoes da escolinha.",
      },
      { property: "og:title", content: "Cadastro do atleta" },
      {
        property: "og:description",
        content: "Preencha os dados do atleta para as inscricoes das competicoes.",
      },
    ],
  }),
  component: PaginaCadastro,
});

const TAMANHO_MAXIMO = 8 * 1024 * 1024;
const LIMITE_COMPRESSAO = 2 * 1024 * 1024;

async function comprimirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/") || arquivo.size <= LIMITE_COMPRESSAO) return arquivo;

  try {
    const bitmap = await createImageBitmap(arquivo);
    const maiorLado = Math.max(bitmap.width, bitmap.height);
    const escala = maiorLado > 1600 ? 1600 / maiorLado : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const contexto = canvas.getContext("2d");
    if (!contexto) return arquivo;
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72),
    );
    if (!blob || blob.size >= arquivo.size) return arquivo;
    return new File([blob], `${arquivo.name.replace(/\.\w+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
}

type Erros = Record<string, string>;

function PaginaCadastro() {
  const { slug } = Route.useParams();
  const buscarProjeto = useServerFn(obterProjetoPublico);
  const enviarCadastro = useServerFn(submeterCadastro);

  const consulta = useQuery({
    queryKey: ["projeto-publico", slug],
    queryFn: () => buscarProjeto({ data: { slug } }),
  });

  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [orgao, setOrgao] = useState("");
  const [mae, setMae] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [consentimento, setConsentimento] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);

  if (consulta.isLoading) {
    return (
      <main className="tema-claro flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-base text-muted-foreground">Carregando o cadastro...</p>
      </main>
    );
  }

  if (!consulta.data?.encontrado) {
    return (
      <main className="tema-claro flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-foreground">Cadastro indisponivel</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Este link nao esta ativo neste momento. Fale com o professor para receber o link correto
            do seu projeto.
          </p>
        </div>
      </main>
    );
  }

  const projeto = consulta.data.projeto;

  function validar(): Erros {
    const novos: Erros = {};

    if (contarPalavras(nome) < 2) novos.nome = "Escreva o nome e o sobrenome do aluno";
    if (!nascimento) {
      novos.nascimento = "Informe a data de nascimento";
    } else {
      const idade = idadeEm(nascimento);
      if (Number.isNaN(idade) || idade < 4 || idade > 20) {
        novos.nascimento = "Confira a data de nascimento";
      }
    }
    if (!validarCpf(cpf)) novos.cpf = "CPF invalido, confira os numeros";
    if (rg.trim().length < 2) novos.rg = "Informe o RG do aluno";
    if (contarPalavras(responsavel) < 2) novos.responsavel = "Escreva o nome completo do responsavel";
    if (digitos(telefone).length < 10) novos.telefone = "Informe um telefone com DDD";
    if (arquivos.some((arquivo) => arquivo.size > TAMANHO_MAXIMO)) {
      novos.arquivos = "Cada arquivo precisa ter no maximo 8 MB";
    }
    if (!consentimento) novos.consentimento = "Marque a autorizacao para continuar";

    return novos;
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando || enviado) return;

    const novos = validar();
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    setEnviando(true);
    try {
      const caminhos: string[] = [];
      for (const original of arquivos.slice(0, 2)) {
        const arquivo = await comprimirImagem(original);
        const extensao = arquivo.name.split(".").pop() || "jpg";
        const caminho = `${projeto.id}/${crypto.randomUUID()}.${extensao.toLowerCase()}`;
        const { error } = await supabase.storage
          .from("documentos")
          .upload(caminho, arquivo, { contentType: arquivo.type || "application/octet-stream" });
        if (!error) caminhos.push(caminho);
      }

      await enviarCadastro({
        data: {
          slug,
          nome_completo: tituloCase(nome),
          data_nascimento: nascimento,
          cpf: digitos(cpf),
          rg: rg.trim(),
          orgao_emissor: orgao.trim(),
          nome_mae: mae.trim() ? tituloCase(mae) : "",
          nome_responsavel: tituloCase(responsavel),
          telefone_responsavel: digitos(telefone),
          documentos: caminhos,
          consentimento: true,
        },
      });

      setEnviado(primeiroNome(tituloCase(nome)));
    } catch {
      setErros({ geral: "Nao conseguimos enviar agora. Confira a internet e tente novamente" });
    } finally {
      setEnviando(false);
    }
  }

  function novoFilho() {
    setNome("");
    setNascimento("");
    setCpf("");
    setRg("");
    setOrgao("");
    setMae("");
    setArquivos([]);
    setConsentimento(false);
    setErros({});
    setEnviado(null);
    if (campoArquivo.current) campoArquivo.current.value = "";
  }

  return (
    <main className="tema-claro min-h-screen bg-background pb-16 text-foreground">
      <div className="mx-auto w-full max-w-md px-5 pt-8">
        <header className="flex items-center gap-3">
          {projeto.logo ? (
            <img
              src={projeto.logo}
              alt={`Escudo do projeto ${projeto.nome}`}
              className="h-14 w-14 shrink-0 object-contain"
            />
          ) : null}
          <div>
            <h1 className="text-2xl leading-tight font-semibold">{projeto.nome}</h1>
            <p className="text-sm text-muted-foreground">Cadastro do atleta</p>
          </div>
        </header>

        {enviado ? (
          <section className="mt-10 border border-border bg-card p-6">
            <h2 className="text-2xl font-semibold">Cadastro enviado</h2>
            <p className="mt-2 text-base">
              Os dados de {enviado} foram recebidos pelo professor.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              As informacoes ficam guardadas com seguranca e somente o professor pode ver.
            </p>
            <button
              type="button"
              onClick={novoFilho}
              className="mt-6 h-12 w-full bg-primary text-base font-semibold text-primary-foreground"
            >
              Cadastrar outro filho
            </button>
          </section>
        ) : (
          <form onSubmit={enviar} className="mt-8 space-y-6" noValidate>
            <Campo id="nome" rotulo="Nome completo do aluno" erro={erros.nome}>
              <input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onBlur={() => setNome((atual) => tituloCase(atual))}
                autoComplete="off"
                className="campo"
              />
            </Campo>

            <Campo id="nascimento" rotulo="Data de nascimento" erro={erros.nascimento}>
              <input
                id="nascimento"
                type="date"
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
                className="campo"
              />
            </Campo>

            <Campo id="cpf" rotulo="CPF" erro={erros.cpf}>
              <input
                id="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                className="campo tabular-nums"
              />
            </Campo>

            <Campo id="rg" rotulo="RG" erro={erros.rg}>
              <input id="rg" value={rg} onChange={(e) => setRg(e.target.value)} className="campo" />
            </Campo>

            <Campo id="orgao" rotulo="Orgao emissor" opcional>
              <input
                id="orgao"
                placeholder="SSP/BA"
                value={orgao}
                onChange={(e) => setOrgao(e.target.value)}
                className="campo"
              />
            </Campo>

            <Campo id="mae" rotulo="Nome da mae" opcional>
              <input
                id="mae"
                value={mae}
                onChange={(e) => setMae(e.target.value)}
                className="campo"
              />
            </Campo>

            <Campo id="responsavel" rotulo="Nome do responsavel" erro={erros.responsavel}>
              <input
                id="responsavel"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                onBlur={() => setResponsavel((atual) => tituloCase(atual))}
                className="campo"
              />
            </Campo>

            <Campo id="telefone" rotulo="Telefone do responsavel" erro={erros.telefone}>
              <input
                id="telefone"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                className="campo tabular-nums"
              />
            </Campo>

            <Campo
              id="arquivos"
              rotulo="Foto do documento"
              erro={erros.arquivos}
              ajuda="Envie a frente e o verso. Ate 2 arquivos, imagem ou PDF."
            >
              <input
                id="arquivos"
                ref={campoArquivo}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                multiple
                onChange={(e) => setArquivos(Array.from(e.target.files ?? []).slice(0, 2))}
                className="w-full border border-input bg-card px-3 py-3 text-base"
              />
            </Campo>

            <label className="flex items-start gap-3 border border-border bg-card p-4 text-sm">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span>
                Autorizo o uso destes dados exclusivamente para inscricao do meu filho em
                competicoes esportivas.
              </span>
            </label>
            {erros.consentimento ? (
              <p className="text-sm text-destructive">{erros.consentimento}</p>
            ) : null}

            {erros.geral ? <p className="text-sm text-destructive">{erros.geral}</p> : null}

            <button
              type="submit"
              disabled={enviando}
              className="h-14 w-full bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-60"
            >
              {enviando ? "Enviando..." : "Enviar cadastro"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function Campo({
  id,
  rotulo,
  erro,
  ajuda,
  opcional,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-medium">
        {rotulo}
        {opcional ? <span className="ml-2 text-sm text-muted-foreground">opcional</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {ajuda ? <p className="mt-1 text-sm text-muted-foreground">{ajuda}</p> : null}
      {erro ? <p className="mt-1 text-sm font-medium text-destructive">{erro}</p> : null}
    </div>
  );
}
