import type { ChamadasRepository, Metricas } from "../repositories/chamadas.repository.ts";

/** Números do prédio para o painel de operação. */
export class MetricasService {
  constructor(private readonly repo: ChamadasRepository) {}

  calcular(): Metricas {
    return this.repo.metricas();
  }
}
