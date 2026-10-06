import type { Request, Response } from "express";
import { ehStatus } from "../domain/chamada.ts";
import { ErroHttp } from "../http/erros.ts";
import { inteiro, inteiroDaQuery, objeto } from "../http/validacao.ts";
import type { ChamadasService } from "../services/chamadas.service.ts";

/**
 * Controller: traduz HTTP ↔ service. Lê e valida o pedido (helpers em
 * http/validacao.ts), chama o service e monta a resposta (status, corpo,
 * cabeçalhos). Erros: lance ErroHttp — o middleware responde {"erro": ...}.
 */
export class ChamadasController {
  constructor(private readonly service: ChamadasService) {}

  /** POST /chamadas — Etapa 1. */
  criar = (req: Request, res: Response) => {
    // TODO Etapa 1:
    //   corpo = objeto(req.body); andar/destino com inteiro(..., 0, 9); segundos com inteiro(..., 0, 86400)
    //   chamada = this.service.criar(...)
    //   res.status(201).location(`/chamadas/${chamada.id}`).json(chamada)
    void objeto;
    void inteiro;
    void req;
    void res;
    throw new ErroHttp(501, "TODO Etapa 1: implemente POST /chamadas (ChamadasController.criar)");
  };

  /** GET /chamadas/:id — exemplo pronto. */
  buscar = (req: Request, res: Response) => {
    res.json(this.service.buscar(this.id(req)));
  };

  /** GET /chamadas?status=&pagina=&por_pagina= — Etapa 1 (filtro) e Etapa 3 (paginação). */
  listar = (req: Request, res: Response) => {
    // TODO Etapa 1: status (se vier) precisa ser válido (ehStatus) → senão 400.
    //   pagina com inteiroDaQuery(req.query.pagina, "pagina", 1, 1, 1000000)
    //   porPagina com inteiroDaQuery(req.query.por_pagina, "por_pagina", 20, 1, 100)
    //   res.json(this.service.listar({ status, pagina, porPagina }))
    void ehStatus;
    void inteiroDaQuery;
    void req;
    void res;
    throw new ErroHttp(501, "TODO Etapa 1: implemente GET /chamadas (ChamadasController.listar)");
  };

  /** PATCH /chamadas/:id — Etapa 1. Corpo: {status, segundos, elevador?}. */
  atualizar = (req: Request, res: Response) => {
    // TODO Etapa 1: id = this.id(req); valide status (ehStatus → senão 400) e segundos;
    //   elevador é opcional (texto); res.json(this.service.mudarStatus(...))
    void req;
    void res;
    throw new ErroHttp(501, "TODO Etapa 1: implemente PATCH /chamadas/:id (ChamadasController.atualizar)");
  };

  private id(req: Request): number {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new ErroHttp(404, `chamada ${req.params.id} não existe`);
    return id;
  }
}
