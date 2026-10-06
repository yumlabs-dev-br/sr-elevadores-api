import type { Chamada, NovaChamada, StatusChamada } from "../domain/chamada.ts";

export interface FiltroChamadas {
  status?: StatusChamada;
  pagina: number;
  porPagina: number;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface Metricas {
  chamadas: number;
  concluidas: number;
  espera_media_s: number | null;
  espera_p95_s: number | null;
  por_andar: { andar: number; chamadas: number; espera_media_s: number | null }[];
}

/**
 * Contrato da camada de dados. Os serviços só conhecem esta interface: trocar
 * a memória pelo SQLite (Etapa 3) não muda nenhuma regra de negócio.
 */
export interface ChamadasRepository {
  criar(nova: NovaChamada): Chamada;
  buscar(id: number): Chamada | null;
  /** Ordenadas por id, do menor para o maior. */
  listar(filtro: FiltroChamadas): Pagina<Chamada>;
  atualizar(id: number, mudancas: Partial<Pick<Chamada, "status" | "elevador" | "embarque_em" | "chegada_em">>): Chamada;
  /** Etapa 4: números do prédio (de preferência calculados em SQL). */
  metricas(): Metricas;
}
