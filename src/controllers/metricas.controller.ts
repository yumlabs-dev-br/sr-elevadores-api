import type { Request, Response } from "express";
import type { MetricasService } from "../services/metricas.service.ts";

export class MetricasController {
  constructor(private readonly service: MetricasService) {}

  obter = (_req: Request, res: Response) => {
    res.json(this.service.calcular());
  };
}
