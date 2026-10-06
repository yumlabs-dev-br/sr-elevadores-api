import request from "supertest";
import { describe, expect, it } from "vitest";
import { appDeTeste } from "./apoio.ts";

// Exemplo de teste de rota (passa quando a Etapa 1 estiver pronta).
// Na Etapa 4, escreva os seus: validação (400), transições (409), paginação, métricas...
describe("chamadas", () => {
  it("POST /chamadas cria com 201 e Location", async () => {
    const r = await request(appDeTeste()).post("/chamadas").send({ andar: 3, destino: 0, segundos: 15 });
    expect(r.status).toBe(201);
    expect(r.headers.location).toBe(`/chamadas/${r.body.id}`);
    expect(r.body).toMatchObject({ andar: 3, destino: 0, status: "aguardando", criada_em: 15 });
  });
});
