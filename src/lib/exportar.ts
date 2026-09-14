import * as XLSX from "xlsx";

export const COLUNAS_EXPORTACAO = [
  "Nome completo",
  "Data de nascimento",
  "CPF",
  "RG",
  "Responsavel",
  "Telefone",
  "Documentos",
] as const;

export function exportarPlanilha(nomeArquivo: string, linhas: (string | number)[][]) {
  const planilha = XLSX.utils.aoa_to_sheet([[...COLUNAS_EXPORTACAO], ...linhas]);
  planilha["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 12 }];
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Atletas");
  XLSX.writeFile(livro, `${nomeArquivo}.xlsx`);
}
