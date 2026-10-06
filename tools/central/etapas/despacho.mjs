// Situação B — "Serviço de despacho": as checagens de cada etapa.
//
// Cada etapa sobe o servidor do aluno (npm start), fala com ele por HTTP de
// verdade e devolve { passou, resumo, checagens: [{ nome, ok, detalhe }], ... }.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pedir, subirServidor } from "../http.mjs";
import { MOVIMENTO, PASSO_S, simular } from "../modelo.mjs";

/** Meta da Etapa 2: custo médio (pontos) da solução de referência × 1,03. */
export const META_DESPACHO = 6434;
export const SEMENTES = [1, 2, 3];
export const TESTES_MINIMOS = 8;

const novaPasta = () => mkdtempSync(join(tmpdir(), "central-"));
const objeto = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const temErro = (r) => objeto(r.json) && typeof r.json.erro === "string" && r.json.erro.trim() !== "";
const linha = (m, c) => `${m} ${c}`;
const resumoResposta = (r) => (r.erro ? r.erro : `${r.status}${r.corpo ? ` ${r.corpo.slice(0, 160)}` : ""}`);

/** Registro de checagens com o formato do relatório. */
function relatorio() {
  const checagens = [];
  return {
    checagens,
    checar(nome, ok, detalhe = "") {
      checagens.push({ nome, ok: !!ok, detalhe: ok ? "" : detalhe });
      return !!ok;
    },
  };
}

// ─── Etapa 1: contrato REST das chamadas ─────────────────────────────────────

export async function etapa1({ pasta }) {
  const { checagens, checar } = relatorio();
  const dir = novaPasta();
  const s = await subirServidor({ pasta, env: { DB_ARQUIVO: join(dir, "etapa1.db") } });
  try {
    const b = s.base;
    const criar = (corpo) => pedir(b, { metodo: "POST", caminho: "/chamadas", corpo });

    const r1 = await criar({ andar: 3, destino: 0, segundos: 15 });
    checar("POST /chamadas válido → 201", r1.status === 201, `esperava 201, veio ${resumoResposta(r1)}`);
    const c1 = r1.json;
    const id = objeto(c1) ? c1.id : undefined;
    checar("corpo da chamada criada", objeto(c1) && Number.isInteger(id) && c1.status === "aguardando" && c1.andar === 3 && c1.destino === 0 && c1.criada_em === 15 && c1.elevador === null, `esperava {id, andar: 3, destino: 0, status: "aguardando", elevador: null, criada_em: 15, ...}; veio ${r1.corpo.slice(0, 200)}`);
    checar("cabeçalho Location: /chamadas/{id}", r1.cabecalhos.location === `/chamadas/${id}`, `esperava Location: /chamadas/${id}; veio ${r1.cabecalhos.location ?? "nenhum"}`);

    const r2 = await pedir(b, { caminho: `/chamadas/${id}` });
    checar("GET /chamadas/{id} → 200 com a mesma chamada", r2.status === 200 && objeto(r2.json) && r2.json.id === id && r2.json.andar === 3, `esperava 200 com a chamada ${id}; veio ${resumoResposta(r2)}`);
    const r3 = await pedir(b, { caminho: "/chamadas/987654" });
    checar("GET de chamada que não existe → 404 {erro}", r3.status === 404 && temErro(r3), `esperava 404 com {"erro": ...}; veio ${resumoResposta(r3)}`);

    for (const [nome, corpo] of [
      ["andar fora do prédio", { andar: 12, destino: 0, segundos: 0 }],
      ["destino igual ao andar", { andar: 4, destino: 4, segundos: 0 }],
      ["sem segundos", { andar: 1, destino: 2 }],
      ["andar que não é número", { andar: "3", destino: 0, segundos: 0 }],
    ]) {
      const r = await criar(corpo);
      checar(`POST com ${nome} → 400 {erro}`, r.status === 400 && temErro(r), `esperava 400 com {"erro": ...}; veio ${resumoResposta(r)}`);
    }
    const rq = await pedir(b, { metodo: "POST", caminho: "/chamadas", corpo: '{"andar": 3,' });
    checar("POST com JSON quebrado → 400", rq.status === 400, `esperava 400; veio ${resumoResposta(rq)}`);

    const rv = await pedir(b, { metodo: "PATCH", caminho: `/chamadas/${id}`, corpo: { status: "em_viagem", elevador: "A", segundos: 30 } });
    checar("PATCH aguardando → em_viagem → 200", rv.status === 200 && objeto(rv.json) && rv.json.status === "em_viagem" && rv.json.elevador === "A" && rv.json.embarque_em === 30, `esperava 200 com status "em_viagem", elevador "A", embarque_em 30; veio ${resumoResposta(rv)}`);
    const rc = await pedir(b, { metodo: "PATCH", caminho: `/chamadas/${id}`, corpo: { status: "concluida", segundos: 55 } });
    checar("PATCH em_viagem → concluida → 200", rc.status === 200 && objeto(rc.json) && rc.json.status === "concluida" && rc.json.chegada_em === 55, `esperava 200 com status "concluida", chegada_em 55; veio ${resumoResposta(rc)}`);
    const rr = await pedir(b, { metodo: "PATCH", caminho: `/chamadas/${id}`, corpo: { status: "concluida", segundos: 60 } });
    checar("PATCH de chamada já concluída → 409 {erro}", rr.status === 409 && temErro(rr), `esperava 409 com {"erro": ...}; veio ${resumoResposta(rr)}`);

    const outra = (await criar({ andar: 7, destino: 1, segundos: 20 })).json;
    const rpula = await pedir(b, { metodo: "PATCH", caminho: `/chamadas/${outra?.id}`, corpo: { status: "concluida", segundos: 40 } });
    checar("PATCH aguardando → concluida (pulando a viagem) → 409", rpula.status === 409 && temErro(rpula), `esperava 409; veio ${resumoResposta(rpula)}`);
    const rinv = await pedir(b, { metodo: "PATCH", caminho: `/chamadas/${outra?.id}`, corpo: { status: "voando", segundos: 40 } });
    checar("PATCH com status desconhecido → 400", rinv.status === 400 && temErro(rinv), `esperava 400; veio ${resumoResposta(rinv)}`);
    const rsem = await pedir(b, { metodo: "PATCH", caminho: `/chamadas/${outra?.id}`, corpo: { status: "em_viagem", segundos: 40 } });
    checar('PATCH "em_viagem" sem elevador → 400', rsem.status === 400 && temErro(rsem), `esperava 400; veio ${resumoResposta(rsem)}`);
    const r404 = await pedir(b, { metodo: "PATCH", caminho: "/chamadas/987654", corpo: { status: "em_viagem", elevador: "A", segundos: 40 } });
    checar("PATCH de chamada que não existe → 404", r404.status === 404, `esperava 404; veio ${resumoResposta(r404)}`);

    const rl = await pedir(b, { caminho: "/chamadas?status=concluida" });
    const itens = objeto(rl.json) && Array.isArray(rl.json.itens) ? rl.json.itens : null;
    checar("GET /chamadas?status=concluida → {itens, total, pagina, por_pagina}", rl.status === 200 && itens && rl.json.total === 1 && itens.length === 1 && itens[0].id === id && rl.json.pagina === 1 && rl.json.por_pagina === 20, `esperava 200 com {"itens": [a chamada ${id}], "total": 1, "pagina": 1, "por_pagina": 20}; veio ${resumoResposta(rl)}`);
    const rs = await pedir(b, { caminho: "/chamadas?status=perdida" });
    checar("GET /chamadas?status=desconhecido → 400", rs.status === 400 && temErro(rs), `esperava 400; veio ${resumoResposta(rs)}`);
  } finally {
    await s.parar();
    rmSync(dir, { recursive: true, force: true });
  }
  const ok = checagens.filter((c) => c.ok).length;
  return { passou: ok === checagens.length, resumo: `${ok}/${checagens.length} checagens do contrato`, checagens };
}

// ─── Etapa 2: despacho (a central usa a API o turno inteiro) ─────────────────

/** Um período de 15 min contra a API: chamadas, despacho e embarques via HTTP. */
async function periodo(base, semente, movimento = MOVIMENTO.almoco) {
  let pedidos = 0;
  const exigir = async (metodo, caminho, corpo, status) => {
    const r = await pedir(base, { metodo, caminho, corpo });
    pedidos++;
    if (r.status !== status) throw new Error(`${linha(metodo, caminho)} respondeu ${resumoResposta(r)} — a central esperava ${status}.`);
    return r;
  };
  const rodada = await simular(movimento, semente, {
    aoChegar: async (p, segundos) => {
      const r = await exigir("POST", "/chamadas", { andar: p.origem, destino: p.destino, segundos }, 201);
      if (!objeto(r.json) || !Number.isInteger(r.json.id)) throw new Error(`POST /chamadas respondeu 201, mas sem o id da chamada no corpo.`);
      p.chamadaId = r.json.id;
    },
    decidir: async (estado) => {
      const r = await exigir("POST", "/despacho", { segundos: estado.segundos, elevadores: estado.elevadores.map(({ id, andar, lotacao, capacidade }) => ({ id, andar, lotacao, capacidade })) }, 200);
      if (!objeto(r.json) || !objeto(r.json.destinos)) throw new Error(`POST /despacho deve responder {"destinos": {"A": andar}}; veio ${r.corpo.slice(0, 160)}.`);
      return r.json;
    },
    aoEmbarcar: async (p, c, segundos) => {
      await exigir("PATCH", `/chamadas/${p.chamadaId}`, { status: "em_viagem", elevador: c.id, segundos }, 200);
    },
    aoDesembarcar: async (p, segundos) => {
      await exigir("PATCH", `/chamadas/${p.chamadaId}`, { status: "concluida", segundos }, 200);
    },
  });
  return { ...rodada, pedidos };
}

/** Replay compacto (só o necessário para a cena da plataforma). */
const replay = (rodada) => ({ quadros: rodada.quadros, partes: rodada.partes, custo: rodada.custo });

export async function etapa2({ pasta }) {
  const { checagens, checar } = relatorio();
  const custos = [];
  let primeiro = null;
  for (const semente of SEMENTES) {
    const dir = novaPasta();
    const s = await subirServidor({ pasta, env: { DB_ARQUIVO: join(dir, "etapa2.db") } });
    try {
      const r = await periodo(s.base, semente);
      primeiro ??= r;
      if (!checar(`Período ${semente}: a central operou o prédio pela API`, !r.erro, r.erro)) break;
      custos.push(r.custo);
      checar(`Período ${semente}: custo ${Math.round(r.custo)} pts (${r.pedidos} requisições)`, true);
    } finally {
      await s.parar();
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const media = custos.length === SEMENTES.length ? custos.reduce((a, b) => a + b, 0) / custos.length : null;
  if (media !== null) checar(`Custo médio ${Math.round(media)} pts ≤ meta ${META_DESPACHO} pts`, media <= META_DESPACHO, `${Math.round(media - META_DESPACHO)} pts acima da meta — o despacho segue o sentido do elevador? considera as chamadas "aguardando" e os destinos de quem está "em_viagem" nele?`);
  return { passou: checagens.every((c) => c.ok), resumo: media === null ? "a simulação não completou" : `custo médio ${Math.round(media)} pts (meta ≤ ${META_DESPACHO})`, checagens, media, meta: META_DESPACHO, replay: primeiro ? replay(primeiro) : null };
}

// ─── Etapa 3: persistência e paginação ───────────────────────────────────────

export async function etapa3({ pasta }) {
  const { checagens, checar } = relatorio();
  const dir = novaPasta();
  const env = { DB_ARQUIVO: join(dir, "etapa3.db") };
  let rodada = null;
  try {
    const s1 = await subirServidor({ pasta, env });
    try {
      rodada = await periodo(s1.base, 1);
    } finally {
      await s1.parar();
    }
    if (!checar("A central operou um período inteiro", !rodada.erro, rodada.erro)) return fim();
    checar("O servidor foi reiniciado (mesmo arquivo de banco)", true);

    const s2 = await subirServidor({ pasta, env });
    try {
      const b = s2.base;
      const pessoas = rodada.pessoas;
      const concluidas = pessoas.filter((p) => p.desembarcou !== null).length;
      const rc = await pedir(b, { caminho: "/chamadas?status=concluida&por_pagina=100" });
      checar(`Depois de reiniciar: ${concluidas} chamadas concluídas continuam lá`, rc.status === 200 && rc.json?.total === concluidas, `GET /chamadas?status=concluida devolveu total ${rc.json?.total ?? resumoResposta(rc)} — esperava ${concluidas}. Os dados estão indo para o SQLite (DB_ARQUIVO)?`);
      const alguem = pessoas.find((p) => p.embarcou !== null && p.chamadaId);
      if (alguem) {
        const r = await pedir(b, { caminho: `/chamadas/${alguem.chamadaId}` });
        checar("Depois de reiniciar: GET /chamadas/{id} com os tempos certos", r.status === 200 && r.json?.embarque_em === alguem.embarcou * PASSO_S && r.json?.criada_em === alguem.chegou * PASSO_S, `esperava criada_em ${alguem.chegou * PASSO_S} e embarque_em ${alguem.embarcou * PASSO_S}; veio ${resumoResposta(r)}`);
      }
      const p1 = await pedir(b, { caminho: "/chamadas?por_pagina=10" });
      const ids1 = Array.isArray(p1.json?.itens) ? p1.json.itens.map((c) => c.id) : [];
      checar(`Página 1 de 10: total ${pessoas.length}, ordenada por id`, p1.status === 200 && p1.json?.total === pessoas.length && ids1.length === 10 && ids1.every((v, i) => i === 0 || v > ids1[i - 1]), `esperava 10 itens em ordem crescente de id e total ${pessoas.length}; veio ${resumoResposta(p1)}`);
      const p2 = await pedir(b, { caminho: "/chamadas?pagina=2&por_pagina=10" });
      const ids2 = Array.isArray(p2.json?.itens) ? p2.json.itens.map((c) => c.id) : [];
      checar("Página 2 continua de onde a 1 parou", p2.status === 200 && p2.json?.pagina === 2 && ids2.length > 0 && ids2[0] > ids1[ids1.length - 1], `esperava "pagina": 2 e o primeiro id maior que ${ids1.at(-1)}; veio ${resumoResposta(p2)}`);
      const longe = await pedir(b, { caminho: "/chamadas?pagina=999&por_pagina=10" });
      checar("Página além do fim → 200 com itens vazios", longe.status === 200 && Array.isArray(longe.json?.itens) && longe.json.itens.length === 0 && longe.json.total === pessoas.length, `esperava 200 com "itens": [] e "total": ${pessoas.length}; veio ${resumoResposta(longe)}`);
      for (const q of ["por_pagina=0", "por_pagina=101", "pagina=0", "pagina=abc"]) {
        const r = await pedir(b, { caminho: `/chamadas?${q}` });
        checar(`GET /chamadas?${q} → 400`, r.status === 400 && temErro(r), `esperava 400 com {"erro": ...}; veio ${resumoResposta(r)}`);
      }
    } finally {
      await s2.parar();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return fim();

  function fim() {
    const ok = checagens.filter((c) => c.ok).length;
    return { passou: ok === checagens.length, resumo: `${ok}/${checagens.length} checagens de persistência e paginação`, checagens };
  }
}

// ─── Etapa 4: métricas e testes automatizados ────────────────────────────────

function esperado(pessoas) {
  const espera = (p) => (p.embarcou - p.chegou) * PASSO_S;
  const embarcaram = pessoas.filter((p) => p.embarcou !== null);
  const ordenadas = embarcaram.map(espera).sort((a, b) => a - b);
  const media = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const andares = [...new Set(pessoas.map((p) => p.origem))].sort((a, b) => a - b);
  return {
    chamadas: pessoas.length,
    concluidas: pessoas.filter((p) => p.desembarcou !== null).length,
    espera_media_s: media(ordenadas),
    espera_p95_s: ordenadas.length ? ordenadas[Math.ceil(0.95 * ordenadas.length) - 1] : null,
    por_andar: andares.map((andar) => ({ andar, chamadas: pessoas.filter((p) => p.origem === andar).length, espera_media_s: media(embarcaram.filter((p) => p.origem === andar).map(espera)) })),
  };
}

const perto = (a, b) => (a === null || b === null ? a === b : typeof a === "number" && Math.abs(a - b) <= 0.15);

export async function etapa4({ pasta }) {
  const { checagens, checar } = relatorio();
  const dir = novaPasta();
  try {
    const s = await subirServidor({ pasta, env: { DB_ARQUIVO: join(dir, "etapa4.db") } });
    try {
      const rodada = await periodo(s.base, 2);
      if (checar("A central operou um período inteiro", !rodada.erro, rodada.erro)) {
        const e = esperado(rodada.pessoas);
        const r = await pedir(s.base, { caminho: "/metricas" });
        const m = r.json;
        if (checar("GET /metricas → 200 em JSON", r.status === 200 && objeto(m), `veio ${resumoResposta(r)}`)) {
          checar(`chamadas = ${e.chamadas}`, m.chamadas === e.chamadas, `veio ${JSON.stringify(m.chamadas)}`);
          checar(`concluidas = ${e.concluidas}`, m.concluidas === e.concluidas, `veio ${JSON.stringify(m.concluidas)}`);
          checar(`espera_media_s = ${e.espera_media_s}`, perto(m.espera_media_s, e.espera_media_s), `veio ${JSON.stringify(m.espera_media_s)} (média de embarque_em − criada_em de quem embarcou, com 1 casa)`);
          checar(`espera_p95_s = ${e.espera_p95_s}`, m.espera_p95_s === e.espera_p95_s, `veio ${JSON.stringify(m.espera_p95_s)} (ordene as esperas e pegue a da posição ⌈0,95 × n⌉)`);
          const pa = Array.isArray(m.por_andar) ? m.por_andar : [];
          const certos = e.por_andar.every((x) => {
            const y = pa.find((z) => z?.andar === x.andar);
            return y && y.chamadas === x.chamadas && perto(y.espera_media_s, x.espera_media_s);
          });
          checar(`por_andar (${e.por_andar.length} andares, em ordem)`, certos && pa.length === e.por_andar.length && pa.every((z, i) => i === 0 || z.andar > pa[i - 1].andar), `esperava ${JSON.stringify(e.por_andar).slice(0, 220)}; veio ${JSON.stringify(m.por_andar).slice(0, 220)}`);
        }
      }
    } finally {
      await s.parar();
    }

    // Os testes do aluno (Vitest): passam todos e são pelo menos TESTES_MINIMOS.
    const saida = join(dir, "vitest.json");
    const t = spawnSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${saida}`], { cwd: pasta, encoding: "utf8", env: { ...process.env, CI: "1" }, timeout: 180000 });
    let rel = null;
    try {
      rel = JSON.parse(readFileSync(saida, "utf8"));
    } catch {
      rel = null;
    }
    if (checar("npm test roda (Vitest)", rel !== null, `os testes não rodaram: ${(t.stderr || t.stdout || "").split("\n").slice(-8).join("\n")}`)) {
      checar(`Todos os testes passam (${rel.numPassedTests} ok, ${rel.numFailedTests} falhando)`, rel.numFailedTests === 0 && rel.success !== false, "corrija os testes que falham antes de enviar");
      checar(`Pelo menos ${TESTES_MINIMOS} testes (você tem ${rel.numTotalTests})`, rel.numTotalTests >= TESTES_MINIMOS, `escreva mais ${TESTES_MINIMOS - rel.numTotalTests} teste(s) em tests/ — ex.: paginação, 409 nas transições, métricas`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const ok = checagens.filter((c) => c.ok).length;
  return { passou: ok === checagens.length, resumo: `${ok}/${checagens.length} checagens de métricas e testes`, checagens };
}

export const ETAPAS = {
  1: { titulo: "Contrato REST das chamadas", rodar: etapa1 },
  2: { titulo: "Despacho pela API", rodar: etapa2 },
  3: { titulo: "Persistência e paginação", rodar: etapa3 },
  4: { titulo: "Métricas e testes", rodar: etapa4 },
};
