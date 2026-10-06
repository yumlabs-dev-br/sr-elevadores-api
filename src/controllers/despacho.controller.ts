import type { Request, Response } from "express";
import { ErroHttp } from "../http/erros.ts";
import { inteiro, objeto } from "../http/validacao.ts";
import type { DespachoService } from "../services/despacho.service.ts";

export class DespachoController {
  constructor(private readonly service: DespachoService) {}

  /** POST /despacho — Etapa 2. Corpo: {segundos, elevadores: [{id, andar, lotacao, capacidade}]}. */
  decidir = (req: Request, res: Response) => {
    // TODO Etapa 2: valide o corpo (objeto, segundos, elevadores não vazio; cada um com id texto e andar 0–9)
    //   e responda res.json({ destinos: this.service.decidir(elevadores) })
    void inteiro;
    void objeto;
    void req;
    void res;
    throw new ErroHttp(501, "TODO Etapa 2: implemente POST /despacho (DespachoController.decidir)");
  };
}
