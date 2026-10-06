import { ErroHttp } from "../http/erros.ts";
import type { ChamadasRepository } from "../repositories/chamadas.repository.ts";

export interface ElevadorAgora {
  id: string;
  andar: number;
  lotacao: number;
  capacidade: number;
}

type Sentido = "sobe" | "desce";

/** O próximo pedido no sentido (subindo: o menor ≥ andar; descendo: o maior ≤ andar); −1 se não houver. */
export function proximoNoSentido(andar: number, sentido: Sentido, pedidos: number[]): number {
  let melhor = -1;
  for (const p of pedidos) {
    if (sentido === "sobe" && p >= andar && (melhor === -1 || p < melhor)) melhor = p;
    if (sentido === "desce" && p <= andar && (melhor === -1 || p > melhor)) melhor = p;
  }
  return melhor;
}

/**
 * Despacho pelo algoritmo do elevador (Etapa 2). Diferente da Situação A, a
 * central NÃO manda mais as chamadas: os pedidos vêm do que a API guardou.
 */
export class DespachoService {
  private sentidos = new Map<string, Sentido>();

  constructor(private readonly repo: ChamadasRepository) {}

  decidir(elevadores: ElevadorAgora[]): Record<string, number> {
    // TODO Etapa 2, para cada elevador e:
    //   pedidos = destinos das chamadas "em_viagem" com elevador === e.id
    //           + andares das chamadas "aguardando" (se o elevador não estiver lotado)
    //   siga o sentido guardado em this.sentidos (padrão "sobe"); sem pedido à frente, inverta;
    //   destinos[e.id] = alvo (−1 = parado)
    void this.repo;
    void this.sentidos;
    void elevadores;
    throw new ErroHttp(501, "TODO Etapa 2: implemente DespachoService.decidir()");
  }
}
