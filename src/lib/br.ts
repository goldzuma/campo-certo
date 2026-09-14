export function digitos(valor: string): string {
  return (valor || "").replace(/\D+/g, "");
}

export function mascaraCpf(valor: string): string {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function mascaraTelefone(valor: string): string {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validarCpf(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const calc = (fatia: number) => {
    let soma = 0;
    let peso = fatia + 1;
    for (let i = 0; i < fatia; i += 1) {
      soma += Number(d[i]) * peso;
      peso -= 1;
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function tituloCase(valor: string): string {
  const minusculas = new Set(["da", "de", "di", "do", "du", "das", "dos", "e"]);
  return valor
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, indice) =>
      indice > 0 && minusculas.has(palavra)
        ? palavra
        : palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1),
    )
    .join(" ");
}

export function contarPalavras(valor: string): number {
  return valor.trim().split(/\s+/).filter(Boolean).length;
}

export function idadeEm(dataIso: string, referencia = new Date()): number {
  const nascimento = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(nascimento.getTime())) return Number.NaN;
  let idade = referencia.getFullYear() - nascimento.getFullYear();
  const mes = referencia.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && referencia.getDate() < nascimento.getDate())) idade -= 1;
  return idade;
}

export function formatarData(dataIso: string): string {
  if (!dataIso) return "";
  const [ano, mes, dia] = (dataIso.split("T")[0] ?? "").split("-");
  if (!ano || !mes || !dia) return dataIso;
  return `${dia}/${mes}/${ano}`;
}

export function normalizar(valor: string): string {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function gerarSlug(valor: string): string {
  return normalizar(valor)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function primeiroNome(valor: string): string {
  return valor.trim().split(/\s+/)[0] || "";
}
