// Cliente HTTP da central e controle do processo do servidor do aluno.

import { spawn } from "node:child_process";
import { createServer } from "node:net";

/** Uma porta livre no localhost. */
export function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/**
 * Faz um pedido e devolve { status, cabecalhos, corpo, json, ms, erro? }.
 * Nunca lança: falha de rede vira status 0 com a explicação em erro.
 */
export async function pedir(base, { metodo = "GET", caminho, corpo, cabecalhos = {}, limiteMs = 5000 }) {
  const inicio = performance.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), limiteMs);
  const h = { accept: "application/json", "user-agent": "central-do-predio/2.4", ...cabecalhos };
  let body;
  if (corpo !== undefined) {
    body = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
    h["content-type"] ??= "application/json";
  }
  try {
    const r = await fetch(base + caminho, { method: metodo, headers: h, body, signal: ctl.signal, redirect: "manual" });
    const texto = await r.text();
    let json;
    try {
      json = texto ? JSON.parse(texto) : undefined;
    } catch {
      json = undefined;
    }
    return { status: r.status, cabecalhos: Object.fromEntries(r.headers), corpo: texto, json, ms: Math.round((performance.now() - inicio) * 10) / 10 };
  } catch (e) {
    const motivo = e?.name === "AbortError" ? `sem resposta em ${limiteMs / 1000} s` : (e?.cause?.code ?? e?.message ?? String(e));
    return { status: 0, cabecalhos: {}, corpo: "", json: undefined, ms: Math.round(performance.now() - inicio), erro: `${metodo} ${caminho}: ${motivo}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sobe o servidor do aluno com `npm start` (PORT e DB_ARQUIVO no ambiente) e
 * espera GET /saude responder 200. Devolve { base, parar(), log() }.
 */
export async function subirServidor({ pasta, env = {}, comando = ["npm", ["start"]], prontoEm = "/saude", limiteMs = 40000 }) {
  const porta = await portaLivre();
  const saida = [];
  const filho = spawn(comando[0], comando[1], {
    cwd: pasta,
    env: { ...process.env, NODE_ENV: "production", PORT: String(porta), ...env },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const guardar = (b) => {
    saida.push(b.toString());
    if (saida.length > 200) saida.splice(0, saida.length - 200);
  };
  filho.stdout.on("data", guardar);
  filho.stderr.on("data", guardar);
  let saiu = null;
  filho.on("exit", (code) => (saiu = code ?? -1));
  const base = `http://127.0.0.1:${porta}`;
  const log = () => saida.join("").split("\n").slice(-25).join("\n");
  const parar = async () => {
    if (saiu !== null) return;
    try {
      process.kill(-filho.pid, "SIGTERM");
    } catch {
      // já saiu
    }
    for (let i = 0; i < 50 && saiu === null; i++) await new Promise((r) => setTimeout(r, 100));
    if (saiu === null) {
      try {
        process.kill(-filho.pid, "SIGKILL");
      } catch {
        // já saiu
      }
    }
  };
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (saiu !== null) throw new Error(`O servidor encerrou ao subir (código ${saiu}). Últimas linhas do log:\n${log()}`);
    const r = await pedir(base, { caminho: prontoEm, limiteMs: 1500 });
    if (r.status === 200) return { base, porta, parar, log };
    await new Promise((r) => setTimeout(r, 300));
  }
  await parar();
  throw new Error(`O servidor não respondeu GET ${prontoEm} com 200 em ${limiteMs / 1000} s (ele escuta na porta do ambiente, process.env.PORT?). Últimas linhas do log:\n${log()}`);
}
