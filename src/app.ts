import express from "express";
import { naoEncontrado, tratarErros } from "./http/erros.ts";
import type { ChamadasRepository } from "./repositories/chamadas.repository.ts";
import { rotas } from "./routes/index.ts";

/** Cria o app Express (sem subir o servidor): é isto que os testes usam. */
export function criarApp(repo: ChamadasRepository) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(rotas(repo));
  app.use(naoEncontrado);
  app.use(tratarErros);
  return app;
}
