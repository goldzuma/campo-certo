import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso do professor" },
      {
        name: "description",
        content: "Area restrita do professor para consultar os cadastros dos atletas.",
      },
      { property: "og:title", content: "Acesso do professor" },
      {
        property: "og:description",
        content: "Area restrita do professor para consultar os cadastros dos atletas.",
      },
    ],
  }),
  component: Autenticacao,
});

function Autenticacao() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel" });
    });
  }, [navigate]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro("");
    setAviso("");
    setEnviando(true);

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setEnviando(false);
      if (error) {
        setErro("Email ou senha incorretos");
        return;
      }
      navigate({ to: "/painel" });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}/painel` },
    });
    setEnviando(false);
    if (error) {
      setErro("Nao foi possivel criar a conta. Confira o email e use uma senha com pelo menos 6 caracteres");
      return;
    }
    if (data.session) {
      navigate({ to: "/painel" });
      return;
    }
    setAviso("Conta criada. Confirme o acesso pelo link enviado para o seu email");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-fundo-fundo px-4">
      <div className="w-full max-w-sm border border-border bg-card p-6">
        <h1 className="titulo-grupo text-linha">Painel do professor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Area restrita. Os dados dos atletas ficam visiveis apenas para voce.
        </p>

        <form onSubmit={enviar} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11 w-full border border-input bg-background px-3 text-base"
            />
          </div>
          <div>
            <label htmlFor="senha" className="block text-sm font-medium">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 h-11 w-full border border-input bg-background px-3 text-base"
            />
          </div>

          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          {aviso ? <p className="text-sm text-primary">{aviso}</p> : null}

          <button
            type="submit"
            disabled={enviando}
            className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setModo(modo === "entrar" ? "criar" : "entrar");
            setErro("");
            setAviso("");
          }}
          className="mt-4 text-sm text-muted-foreground underline"
        >
          {modo === "entrar" ? "Primeiro acesso, criar minha conta" : "Ja tenho conta, quero entrar"}
        </button>
      </div>
    </main>
  );
}
