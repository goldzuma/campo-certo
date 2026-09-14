-- Admins
CREATE TABLE public.administradores (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.administradores TO authenticated;
GRANT ALL ON public.administradores TO service_role;
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le proprio registro" ON public.administradores
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.eh_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.administradores WHERE id = _user_id)
$$;

-- primeiro usuario cadastrado se torna admin
CREATE OR REPLACE FUNCTION public.registrar_primeiro_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.administradores) THEN
    INSERT INTO public.administradores (id, email) VALUES (NEW.id, NEW.email);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_primeiro_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.registrar_primeiro_admin();

-- Projetos
CREATE TABLE public.projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.projetos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projetos ativos visiveis publicamente" ON public.projetos
  FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "admin le projetos" ON public.projetos
  FOR SELECT TO authenticated USING (public.eh_admin(auth.uid()));
CREATE POLICY "admin cria projetos" ON public.projetos
  FOR INSERT TO authenticated WITH CHECK (public.eh_admin(auth.uid()));
CREATE POLICY "admin edita projetos" ON public.projetos
  FOR UPDATE TO authenticated USING (public.eh_admin(auth.uid()));
CREATE POLICY "admin remove projetos" ON public.projetos
  FOR DELETE TO authenticated USING (public.eh_admin(auth.uid()));

-- Atletas
CREATE TABLE public.atletas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  ano_nascimento INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM data_nascimento)::INTEGER) STORED,
  cpf TEXT NOT NULL UNIQUE,
  rg TEXT NOT NULL,
  orgao_emissor TEXT,
  nome_mae TEXT,
  nome_responsavel TEXT NOT NULL,
  telefone_responsavel TEXT NOT NULL,
  documentos TEXT[] NOT NULL DEFAULT '{}',
  consentimento_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atletas TO authenticated;
GRANT ALL ON public.atletas TO service_role;
ALTER TABLE public.atletas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le atletas" ON public.atletas
  FOR SELECT TO authenticated USING (public.eh_admin(auth.uid()));
CREATE POLICY "admin edita atletas" ON public.atletas
  FOR UPDATE TO authenticated USING (public.eh_admin(auth.uid()));
CREATE POLICY "admin remove atletas" ON public.atletas
  FOR DELETE TO authenticated USING (public.eh_admin(auth.uid()));

CREATE INDEX idx_atletas_projeto ON public.atletas(projeto_id);
CREATE INDEX idx_atletas_ano ON public.atletas(ano_nascimento);
