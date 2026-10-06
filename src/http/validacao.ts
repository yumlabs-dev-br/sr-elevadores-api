import { ErroHttp } from "./erros.ts";

/** Corpo do pedido como objeto (ou 400). */
export function objeto(corpo: unknown): Record<string, unknown> {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new ErroHttp(400, "envie um objeto JSON no corpo (Content-Type: application/json)");
  return corpo as Record<string, unknown>;
}

/** Inteiro entre min e max (ou 400 com o nome do campo). */
export function inteiro(valor: unknown, campo: string, min: number, max: number): number {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < min || valor > max) throw new ErroHttp(400, `${campo} deve ser um inteiro de ${min} a ${max}`);
  return valor;
}

/** Inteiro vindo da query string (?pagina=2), com padrão. */
export function inteiroDaQuery(valor: unknown, campo: string, padrao: number, min: number, max: number): number {
  if (valor === undefined) return padrao;
  const n = Number(valor);
  if (typeof valor !== "string" || valor.trim() === "" || !Number.isInteger(n) || n < min || n > max) throw new ErroHttp(400, `${campo} deve ser um inteiro de ${min} a ${max}`);
  return n;
}
