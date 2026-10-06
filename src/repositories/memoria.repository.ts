import type { Chamada, NovaChamada } from "../domain/chamada.ts";
import type { ChamadasRepository, FiltroChamadas, Metricas, Pagina } from "./chamadas.repository.ts";

/**
 * Repositório em memória: pronto para as Etapas 1 e 2. Tudo some quando o
 * servidor reinicia — na Etapa 3 você troca por SqliteChamadasRepository.
 */
export class MemoriaChamadasRepository implements ChamadasRepository {
  private chamadas: Chamada[] = [];
  private proximoId = 1;

  criar(nova: NovaChamada): Chamada {
    const chamada: Chamada = { id: this.proximoId++, ...nova, status: "aguardando", elevador: null, embarque_em: null, chegada_em: null };
    this.chamadas.push(chamada);
    return { ...chamada };
  }

  buscar(id: number): Chamada | null {
    const c = this.chamadas.find((x) => x.id === id);
    return c ? { ...c } : null;
  }

  listar({ status, pagina, porPagina }: FiltroChamadas): Pagina<Chamada> {
    const filtradas = this.chamadas.filter((c) => !status || c.status === status);
    const inicio = (pagina - 1) * porPagina;
    return { itens: filtradas.slice(inicio, inicio + porPagina).map((c) => ({ ...c })), total: filtradas.length, pagina, por_pagina: porPagina };
  }

  atualizar(id: number, mudancas: Partial<Pick<Chamada, "status" | "elevador" | "embarque_em" | "chegada_em">>): Chamada {
    const c = this.chamadas.find((x) => x.id === id);
    if (!c) throw new Error(`chamada ${id} não existe`);
    Object.assign(c, mudancas);
    return { ...c };
  }

  metricas(): Metricas {
    throw new Error("Métricas só no SQLite (Etapa 4): use SqliteChamadasRepository.");
  }
}
