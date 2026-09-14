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
  component: Painel;
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

function Painel() {
  return <div />;
}
