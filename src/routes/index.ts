import { Router } from "express";
import { ChamadasController } from "../controllers/chamadas.controller.ts";
import { DespachoController } from "../controllers/despacho.controller.ts";
import { MetricasController } from "../controllers/metricas.controller.ts";
import type { ChamadasRepository } from "../repositories/chamadas.repository.ts";
import { ChamadasService } from "../services/chamadas.service.ts";
import { DespachoService } from "../services/despacho.service.ts";
import { MetricasService } from "../services/metricas.service.ts";

/** Monta as rotas ligando cada camada (rota → controller → service → repository). */
export function rotas(repo: ChamadasRepository): Router {
  const chamadas = new ChamadasController(new ChamadasService(repo));
  const despacho = new DespachoController(new DespachoService(repo));
  const metricas = new MetricasController(new MetricasService(repo));

  const r = Router();
  r.get("/saude", (_req, res) => {
    res.json({ ok: true });
  });

  r.post("/chamadas", chamadas.criar);
  r.get("/chamadas", chamadas.listar);
  r.get("/chamadas/:id", chamadas.buscar);
  r.patch("/chamadas/:id", chamadas.atualizar);

  r.post("/despacho", despacho.decidir);

  r.get("/metricas", metricas.obter);
  return r;
}
