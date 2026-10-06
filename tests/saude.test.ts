import request from "supertest";
import { describe, expect, it } from "vitest";
import { appDeTeste } from "./apoio.ts";

describe("GET /saude", () => {
  it("responde 200 com { ok: true }", async () => {
    const r = await request(appDeTeste()).get("/saude");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it("rota que não existe responde 404 em JSON", async () => {
    const r = await request(appDeTeste()).get("/nao-existe");
    expect(r.status).toBe(404);
    expect(r.body.erro).toBeTypeOf("string");
  });
});
