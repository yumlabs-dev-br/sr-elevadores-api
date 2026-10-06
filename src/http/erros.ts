import type { ErrorRequestHandler, RequestHandler } from "express";

/**
 * Erro com status HTTP. Lance de qualquer camada (ex.: throw new ErroHttp(404,
 * "chamada 7 não existe")) e o middleware tratarErros responde
 * { "erro": mensagem } com o status certo.
 */
export class ErroHttp extends Error {
  constructor(
    public readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroHttp";
  }
}

/** Rota que não existe: 404 em JSON (o padrão do Express é HTML). */
export const naoEncontrado: RequestHandler = (req, res) => {
  res.status(404).json({ erro: `rota ${req.method} ${req.path} não existe` });
};

/** Último middleware: transforma qualquer erro numa resposta JSON. */
export const tratarErros: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ErroHttp) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  // JSON quebrado no corpo (express.json) e corpo grande demais.
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ erro: "o corpo não é um JSON válido" });
    return;
  }
  if (typeof err?.status === "number" && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ erro: err.message ?? "pedido inválido" });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: "erro interno no servidor" });
};
