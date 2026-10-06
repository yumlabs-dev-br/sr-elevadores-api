/**
 * Domínio: a chamada de elevador. Uma pessoa aperta o botão no andar (chamada
 * "aguardando"), embarca num elevador ("em_viagem") e chega ao destino
 * ("concluida"). Os tempos são em segundos da simulação do prédio.
 */

export const ANDARES = 10;

export type StatusChamada = "aguardando" | "em_viagem" | "concluida";
export const STATUS: StatusChamada[] = ["aguardando", "em_viagem", "concluida"];

export interface Chamada {
  id: number;
  andar: number;
  destino: number;
  status: StatusChamada;
  /** Elevador que levou a pessoa (null enquanto aguarda). */
  elevador: string | null;
  criada_em: number;
  embarque_em: number | null;
  chegada_em: number | null;
}

export interface NovaChamada {
  andar: number;
  destino: number;
  criada_em: number;
}

/** Mudanças de status permitidas (o resto é 409 Conflict). */
export const TRANSICOES: Record<StatusChamada, StatusChamada[]> = {
  aguardando: ["em_viagem"],
  em_viagem: ["concluida"],
  concluida: [],
};

export const ehStatus = (v: unknown): v is StatusChamada => typeof v === "string" && (STATUS as string[]).includes(v);
