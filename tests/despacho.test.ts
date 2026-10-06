import request from "supertest";
import { describe, expect, it } from "vitest";
import { appDeTeste } from "./apoio.ts";

// Exemplo (passa quando a Etapa 2 estiver pronta).
describe("POST /despacho", () => {
  it("sem chamadas, o elevador fica parado (−1)", async () => {
    const r = await request(appDeTeste()).post("/despacho").send({ segundos: 0, elevadores: [{ id: "A", andar: 0, lotacao: 0, capacidade: 8 }] });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ destinos: { A: -1 } });
  });
});
