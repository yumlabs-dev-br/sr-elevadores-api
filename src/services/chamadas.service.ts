import { TRANSICOES, type Chamada, type StatusChamada } from "../domain/chamada.ts";
import { ErroHttp } from "../http/erros.ts";
import type { ChamadasRepository, FiltroChamadas, Pagina } from "../repositories/chamadas.repository.ts";

/**
 * Regras das chamadas (Etapa 1). O service não sabe nada de HTTP: recebe
 * valores já lidos pelo controller e lança ErroHttp quando uma regra é violada.
 */
export class ChamadasService {
  constructor(private readonly repo: ChamadasRepository) {}

  criar(andar: number, destino: number, segundos: number): Chamada {
    // TODO Etapa 1: destino igual ao andar → ErroHttp(400, ...); senão repo.criar({ andar, destino, criada_em: segundos }).
    void andar;
    void destino;
    void segundos;
    throw new ErroHttp(501, "TODO Etapa 1: implemente ChamadasService.criar()");
  }

  /** Exemplo pronto: chamada que não existe vira 404. */
  buscar(id: number): Chamada {
    const c = this.repo.buscar(id);
    if (!c) throw new ErroHttp(404, `chamada ${id} não existe`);
    return c;
  }

  listar(filtro: FiltroChamadas): Pagina<Chamada> {
    return this.repo.listar(filtro);
  }

  mudarStatus(id: number, status: StatusChamada, segundos: number, elevador?: string): Chamada {
    // TODO Etapa 1:
    //   1. atual = this.buscar(id)   (404 se não existe)
    //   2. a mudança precisa estar em TRANSICOES[atual.status]; senão ErroHttp(409, ...)
    //   3. "em_viagem" exige elevador (senão 400) e grava elevador + embarque_em = segundos
    //   4. "concluida" grava chegada_em = segundos
    void TRANSICOES;
    void id;
    void status;
    void segundos;
    void elevador;
    throw new ErroHttp(501, "TODO Etapa 1: implemente ChamadasService.mudarStatus()");
  }
}
