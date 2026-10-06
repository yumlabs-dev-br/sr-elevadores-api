// Situação C — "Painel de operação": as checagens de cada etapa.
//
// Sobe o monorepo do aluno (npm start: compila o painel e sobe a API, que
// serve o painel), reproduz aqui a MESMA simulação do prédio (mesma semente e
// mesmo despacho) para saber os números certos, e confere com um navegador de
// verdade (Playwright) o que o painel mostra.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pedir, subirServidor } from "../http.mjs";
import { ANDARES, CAPACIDADE, despachoPadrao, MOVIMENTO, PASSO_S, simular } from "../modelo.mjs";

const SEMENTE = 11;
const umaCasa = (v) => Math.round(v * 10) / 10;
const media = (xs) => (xs.length ? umaCasa(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const objeto = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const resumoResposta = (r) => (r.erro ? r.erro : `${r.status}${r.corpo ? ` ${r.corpo.slice(0, 160)}` : ""}`);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

// ─── O que o prédio deveria mostrar (a mesma conta da API de referência) ─────

async function operacaoEsperada(semente) {
  const pessoas = [];
  const passos = [];
  await simular(MOVIMENTO.pico, semente, {
    decidir: despachoPadrao(),
    aoChegar: (p) => pessoas.push(p),
    aoPasso: (_q, cabines, esperando) => {
      passos.push({ esperandoPorAndar: Array.from({ length: ANDARES }, (_, a) => esperando.filter((p) => p.origem === a).length), lotacao: cabines.reduce((s, c) => s + c.dentro.length, 0), capacidade: cabines.length * CAPACIDADE });
    },
  });
  const espera = (p) => (p.embarcou - p.chegou) * PASSO_S;
  const metricas = () => {
    const esperas = pessoas.filter((p) => p.embarcou !== null).map(espera).sort((a, b) => a - b);
    const viagens = pessoas.filter((p) => p.desembarcou !== null).length;
    const decorrido = passos.length * PASSO_S;
    return {
      periodo: 1,
      segundos: (passos.length - 1) * PASSO_S,
      espera_media_s: media(esperas),
      espera_p95_s: esperas.length ? esperas[Math.ceil(0.95 * esperas.length) - 1] : null,
      viagens,
      viagens_por_hora: umaCasa(viagens / (decorrido / 3600)),
      ocupacao_pct: umaCasa((passos.reduce((s, x) => s + x.lotacao / x.capacidade, 0) / passos.length) * 100),
      chamadas_abertas: passos.at(-1).esperandoPorAndar.reduce((a, b) => a + b, 0),
    };
  };
  const series = (andar, janela) => {
    const minutoAtual = Math.floor((passos.length - 1) / 12);
    const pontos = [];
    for (let m = Math.max(0, minutoAtual - janela + 1); m <= minutoAtual; m++) {
      const ultimo = passos[Math.min(passos.length - 1, m * 12 + 11)];
      const embarcaram = pessoas.filter((p) => p.embarcou !== null && Math.floor(p.embarcou / 12) === m && (andar === null || p.origem === andar));
      pontos.push({ minuto: m, esperando: andar === null ? ultimo.esperandoPorAndar.reduce((a, b) => a + b, 0) : ultimo.esperandoPorAndar[andar], espera_media_s: media(embarcaram.map(espera)) });
    }
    const andares = [...new Set(pessoas.map((p) => p.origem))].sort((a, b) => a - b);
    return { andar, janela_min: janela, pontos, por_andar: andares.map((a) => ({ andar: a, chamadas: pessoas.filter((p) => p.origem === a).length, espera_media_s: media(pessoas.filter((p) => p.origem === a && p.embarcou !== null).map(espera)) })) };
  };
  return { metricas, series };
}

// ─── Subir o painel e abrir o navegador ──────────────────────────────────────

async function subirPainel(pasta, env) {
  return subirServidor({ pasta, env: { SIMULACAO_SEMENTE: String(SEMENTE), ...env }, prontoEm: "/api/saude", limiteMs: 240000 });
}

/** Espera o período congelado terminar (ritmo rápido, sem repetir). */
async function esperarFimDoPeriodo(base) {
  for (let i = 0; i < 120; i++) {
    const r = await pedir(base, { caminho: "/api/metricas" });
    if (r.json?.segundos === 895) return true;
    await new Promise((x) => setTimeout(x, 250));
  }
  return false;
}

async function navegador() {
  let pw;
  try {
    pw = await import("playwright");
  } catch {
    throw new Error("O Playwright não está instalado. Rode: npm install && npx playwright install chromium");
  }
  try {
    return await pw.chromium.launch();
  } catch (e) {
    throw new Error(`Não consegui abrir o Chromium do Playwright (rode: npx playwright install chromium).\n${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}

const valorDe = (pg, testid) => pg.locator(`[data-testid="${testid}"]`).first().getAttribute("data-valor", { timeout: 2000 }).catch(() => null);

/** Espera um atributo chegar a um valor (o painel atualiza sozinho). */
async function esperarAtributo(pg, seletor, atributo, esperado, ms = 12000) {
  const fim = Date.now() + ms;
  let ultimo = null;
  while (Date.now() < fim) {
    ultimo = await pg.locator(seletor).first().getAttribute(atributo, { timeout: 1000 }).catch(() => null);
    if (ultimo === String(esperado)) return { ok: true, ultimo };
    await pg.waitForTimeout(250);
  }
  return { ok: false, ultimo };
}

const KPIS = [
  ["espera-media", "espera_media_s"],
  ["espera-p95", "espera_p95_s"],
  ["viagens-hora", "viagens_por_hora"],
  ["ocupacao", "ocupacao_pct"],
];

// ─── Etapa 1: os indicadores vêm da API ──────────────────────────────────────

export async function etapa1({ pasta }) {
  const { checagens, checar } = relatorio();
  const s = await subirPainel(pasta, { SIMULACAO_RITMO_MS: "5", SIMULACAO_REPETIR: "0" });
  const b = await navegador();
  try {
    checar("O prédio rodou o período inteiro", await esperarFimDoPeriodo(s.base), "GET /api/metricas não chegou ao fim do período (segundos 895).");
    const esperado = (await operacaoEsperada(SEMENTE)).metricas();
    const api = (await pedir(s.base, { caminho: "/api/metricas" })).json;
    checar("GET /api/metricas com os números do prédio", objeto(api) && KPIS.every(([, c]) => api[c] === esperado[c]), `a API deveria responder ${JSON.stringify(esperado)}; veio ${JSON.stringify(api)?.slice(0, 220)}`);

    const pg = await b.newPage();
    const pedidos = [];
    pg.on("request", (r) => pedidos.push(r.url()));
    await pg.goto(s.base + "/", { waitUntil: "domcontentloaded" });
    const r = await esperarAtributo(pg, '[data-testid="kpi-espera-media"]', "data-valor", esperado.espera_media_s);
    checar("O painel pediu GET /api/metricas", pedidos.some((u) => u.includes("/api/metricas")), "nenhuma requisição para /api/metricas saiu do navegador — services/api.ts (buscarMetricas) e hooks/useMetricas.ts");
    if (checar(`Espera média no painel = ${esperado.espera_media_s}`, r.ok, `o cartão mostra ${r.ultimo === "" || r.ultimo === null ? "nada" : r.ultimo} (ainda são os dados de exemplo?)`)) {
      for (const [id, campo] of KPIS.slice(1)) {
        const v = await valorDe(pg, `kpi-${id}`);
        checar(`${campo} no painel = ${esperado[campo]}`, v === String(esperado[campo]), `o cartão mostra ${v}`);
      }
    }
    checar('Sem o selo "Dados de exemplo" nos indicadores', (await pg.locator('[data-testid="selo-exemplo"][data-secao="kpis"]').count()) === 0, 'a seção ainda diz que mostra dados de exemplo — o hook deve marcar origem "api" quando a resposta chega');

    // A API fora do ar: o painel avisa e deixa tentar de novo.
    const pg2 = await b.newPage();
    await pg2.route("**/api/metricas", (rota) => rota.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ erro: "manutenção programada" }) }));
    await pg2.goto(s.base + "/", { waitUntil: "domcontentloaded" });
    const aviso = await pg2.locator('[data-testid="erro-kpis"]').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    if (checar("API fora do ar (503): o painel mostra o erro", aviso, 'com /api/metricas respondendo 503, nenhum aviso apareceu — trate o status (não só a falta de rede) e preencha "erro" no hook')) {
      checar("A mensagem do erro vem da API", ((await pg2.locator('[data-testid="erro-kpis"]').first().textContent()) ?? "").includes("manutenção programada"), 'use o "erro" que a API devolve no corpo');
      await pg2.unroute("**/api/metricas");
      await pg2.locator('[data-testid="tentar-kpis"]').first().click();
      const volta = await esperarAtributo(pg2, '[data-testid="kpi-espera-media"]', "data-valor", esperado.espera_media_s, 8000);
      checar('"Tentar de novo" busca outra vez e o erro some', volta.ok && (await pg2.locator('[data-testid="erro-kpis"]').count()) === 0, "depois de clicar em Tentar de novo, os valores não voltaram (recarregar() deve disparar a busca)");
    }
  } finally {
    await b.close();
    await s.parar();
  }
  const ok = checagens.filter((c) => c.ok).length;
  return { passou: ok === checagens.length, resumo: `${ok}/${checagens.length} checagens dos indicadores`, checagens };
}

// ─── Etapa 2: gráficos com filtros (API + painel) ────────────────────────────

export async function etapa2({ pasta }) {
  const { checagens, checar } = relatorio();
  const s = await subirPainel(pasta, { SIMULACAO_RITMO_MS: "5", SIMULACAO_REPETIR: "0" });
  const b = await navegador();
  try {
    checar("O prédio rodou o período inteiro", await esperarFimDoPeriodo(s.base), "GET /api/metricas não chegou ao fim do período.");
    const op = await operacaoEsperada(SEMENTE);
    const todos = op.series(null, 15);
    const r1 = await pedir(s.base, { caminho: "/api/series" });
    checar("GET /api/series (padrão: todos os andares, 15 min)", r1.status === 200 && igual(r1.json, todos), `esperava ${JSON.stringify(todos).slice(0, 200)}…; veio ${resumoResposta(r1)}`);
    const terceiro = op.series(3, 60);
    const r2 = await pedir(s.base, { caminho: "/api/series?andar=3&janela=60" });
    checar("GET /api/series?andar=3&janela=60", r2.status === 200 && igual(r2.json, terceiro), `esperava ${JSON.stringify(terceiro).slice(0, 200)}…; veio ${resumoResposta(r2)}`);
    for (const q of ["andar=12", "andar=terceiro", "janela=7"]) {
      const r = await pedir(s.base, { caminho: `/api/series?${q}` });
      checar(`GET /api/series?${q} → 400 {erro}`, r.status === 400 && typeof r.json?.erro === "string", `esperava 400 com {"erro": ...}; veio ${resumoResposta(r)}`);
    }

    const pg = await b.newPage();
    await pg.goto(s.base + "/", { waitUntil: "domcontentloaded" });
    const soma = (sr) => sr.pontos.reduce((acc, p) => acc + p.esperando, 0);
    const g = await esperarAtributo(pg, '[data-testid="grafico-fila"]', "data-total", soma(todos));
    checar("O gráfico da fila mostra os dados da API", g.ok, `o gráfico soma ${g.ultimo} pessoas; pela API seriam ${soma(todos)} (ainda são os dados de exemplo?)`);
    checar('Sem o selo "Dados de exemplo" nos gráficos', (await pg.locator('[data-testid="selo-exemplo"][data-secao="series"], [data-testid="selo-exemplo"][data-secao="andares"]').count()) === 0, 'os gráficos ainda dizem que mostram dados de exemplo');

    const pedidoAndar = pg.waitForRequest((r) => /\/api\/series\?.*andar=3/.test(r.url()) && /janela=15/.test(r.url()), { timeout: 8000 }).then(() => true).catch(() => false);
    await pg.locator('[data-testid="filtro-andar"]').selectOption("3");
    checar("Filtrar o 3º andar pede GET /api/series?andar=3&janela=15", await pedidoAndar, "trocar o andar não gerou a requisição com ?andar=3 (o hook deve buscar de novo quando o filtro muda)");
    const g3 = await esperarAtributo(pg, '[data-testid="grafico-fila"]', "data-total", soma(op.series(3, 15)), 8000);
    checar("O gráfico passa a mostrar só o 3º andar", g3.ok, `o gráfico soma ${g3.ultimo}; para o 3º andar seriam ${soma(op.series(3, 15))}`);
    const pedidoJanela = pg.waitForRequest((r) => /\/api\/series\?.*janela=60/.test(r.url()), { timeout: 8000 }).then(() => true).catch(() => false);
    await pg.locator('[data-testid="janela-60"]').click();
    checar("Trocar a janela pede ...&janela=60", await pedidoJanela, "clicar em 60 min não gerou a requisição com janela=60");
  } finally {
    await b.close();
    await s.parar();
  }
  const ok = checagens.filter((c) => c.ok).length;
  return { passou: ok === checagens.length, resumo: `${ok}/${checagens.length} checagens dos gráficos`, checagens };
}

// ─── Etapa 3: o prédio ao vivo (Server-Sent Events) ──────────────────────────

/** Lê eventos de um text/event-stream até juntar `quantos` do tipo pedido. */
async function lerEventos(url, tipo, quantos, ms = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  const eventos = [];
  let tipoResposta = "";
  try {
    const r = await fetch(url, { headers: { accept: "text/event-stream" }, signal: ctl.signal });
    tipoResposta = r.headers.get("content-type") ?? "";
    if (r.status !== 200 || !r.body) return { status: r.status, tipoResposta, eventos };
    const leitor = r.body.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    while (eventos.length < quantos) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let fim;
      while ((fim = buffer.indexOf("\n\n")) >= 0) {
        const bloco = buffer.slice(0, fim);
        buffer = buffer.slice(fim + 2);
        const ev = /^event: ?(.*)$/m.exec(bloco)?.[1]?.trim() ?? "message";
        const dados = [...bloco.matchAll(/^data: ?(.*)$/gm)].map((m) => m[1]).join("\n");
        if (ev === tipo && dados) eventos.push(dados);
      }
    }
    return { status: 200, tipoResposta, eventos };
  } catch {
    return { status: eventos.length ? 200 : 0, tipoResposta, eventos };
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
}

export async function etapa3({ pasta }) {
  const { checagens, checar } = relatorio();
  const s = await subirPainel(pasta, { SIMULACAO_RITMO_MS: "250", SIMULACAO_REPETIR: "1" });
  const b = await navegador();
  try {
    const sse = await lerEventos(s.base + "/api/eventos", "posicao", 3);
    checar("GET /api/eventos é um fluxo de eventos (text/event-stream)", sse.status === 200 && sse.tipoResposta.includes("text/event-stream"), `veio status ${sse.status} com Content-Type "${sse.tipoResposta}"`);
    let lidos = [];
    try {
      lidos = sse.eventos.map((d) => JSON.parse(d));
    } catch {
      lidos = [];
    }
    if (checar('3 eventos "posicao" em JSON', lidos.length === 3, `chegaram ${sse.eventos.length} eventos "posicao" em 8 s (escreva "event: posicao" e "data: {json}" seguidos de uma linha em branco, a cada passo)`)) {
      const formato = lidos.every((e) => Number.isInteger(e.segundos) && Array.isArray(e.elevadores) && e.elevadores.length === 2 && e.elevadores.every((x) => typeof x.id === "string" && Number.isInteger(x.andar)) && Array.isArray(e.esperando_por_andar));
      checar("Cada evento segue o contrato EventoPosicao", formato, `veio ${JSON.stringify(lidos[0]).slice(0, 220)}`);
      checar("Os eventos acompanham o relógio do prédio", lidos[2].segundos > lidos[0].segundos || lidos[2].periodo > lidos[0].periodo, `os segundos não avançaram: ${lidos.map((e) => e.segundos).join(", ")}`);
    }

    const pg = await b.newPage();
    const polling = [];
    pg.on("request", (r) => /\/api\/(estado|posicao)/.test(r.url()) && polling.push(r.url()));
    await pg.goto(s.base + "/", { waitUntil: "domcontentloaded" });
    await pg.waitForTimeout(1500);
    const vistos = new Set();
    for (let i = 0; i < 14; i++) {
      vistos.add(await pg.locator('[data-testid="predio"]').first().getAttribute("data-segundos").catch(() => null));
      await pg.waitForTimeout(250);
    }
    vistos.delete(null);
    checar("O prédio do painel se mexe sozinho (eventos ao vivo)", vistos.size >= 4, `em 3,5 s o relógio do prédio mostrou ${vistos.size} valor(es): ${[...vistos].join(", ")} — o useEventos deve abrir um EventSource em /api/eventos`);
    checar('Sem o selo "Dados de exemplo" no prédio', (await pg.locator('[data-testid="selo-exemplo"][data-secao="predio"]').count()) === 0, "o prédio ainda diz que mostra dados de exemplo");
    checar('O cabeçalho mostra "Ao vivo"', ((await pg.locator('[data-testid="status-conexao"]').first().textContent()) ?? "").includes("Ao vivo"), "o status da conexão não está como Ao vivo");
    checar("Sem polling: a posição chega por eventos", polling.length === 0, `o painel fez ${polling.length} requisições de posição — use o fluxo de eventos, não consultas repetidas`);
  } finally {
    await b.close();
    await s.parar();
  }
  const ok = checagens.filter((c) => c.ok).length;
  return { passou: ok === checagens.length, resumo: `${ok}/${checagens.length} checagens do tempo real`, checagens };
}

// ─── Etapa 4: contrato tipado de ponta a ponta e fim dos dados de exemplo ────

function arquivos(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(ts|tsx)$/.test(nome)) out.push(p);
  }
  return out;
}

export async function etapa4({ pasta }) {
  const { checagens, checar } = relatorio();
  const roda = (args) => spawnSync("npm", args, { cwd: pasta, encoding: "utf8", env: { ...process.env, CI: "1" }, timeout: 240000 });
  const cauda = (r) => `${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n").filter((l) => l.trim() && !l.startsWith(">")).slice(-12).join("\n");

  const web = join(pasta, "apps/web/src");
  const usamMocks = arquivos(web).filter((f) => !relative(web, f).startsWith("mocks") && !/\.test\.tsx?$/.test(f) && /from\s+["'][^"']*mocks\//.test(readFileSync(f, "utf8")));
  checar("O painel não importa mais os dados de exemplo (mocks)", usamMocks.length === 0, `ainda importam mocks: ${usamMocks.map((f) => relative(pasta, f)).join(", ")}`);
  const contrato = (dir) => arquivos(join(pasta, dir)).some((f) => /from\s+["']@sr\/contracts["']/.test(readFileSync(f, "utf8")));
  checar("A API usa os tipos de @sr/contracts", contrato("apps/api/src"), "nenhum arquivo de apps/api/src importa @sr/contracts");
  checar("O painel usa os tipos de @sr/contracts", contrato("apps/web/src"), "nenhum arquivo de apps/web/src importa @sr/contracts");

  const tipos = roda(["run", "typecheck"]);
  checar("npm run typecheck sem erros (API, painel e contratos)", tipos.status === 0, cauda(tipos));
  const testes = roda(["test"]);
  checar("npm test passa", testes.status === 0, cauda(testes));

  // O painel sem os mocks ainda funciona: abre e mostra os números da API.
  if (checagens.every((c) => c.ok)) {
    const s = await subirPainel(pasta, { SIMULACAO_RITMO_MS: "5", SIMULACAO_REPETIR: "0" });
    const b = await navegador();
    try {
      await esperarFimDoPeriodo(s.base);
      const esperado = (await operacaoEsperada(SEMENTE)).metricas();
      const pg = await b.newPage();
      const erros = [];
      pg.on("pageerror", (e) => erros.push(String(e)));
      await pg.goto(s.base + "/", { waitUntil: "domcontentloaded" });
      const r = await esperarAtributo(pg, '[data-testid="kpi-espera-media"]', "data-valor", esperado.espera_media_s);
      checar("O painel sem mocks abre e mostra os números da API", r.ok && erros.length === 0, erros.length ? `erro no navegador: ${erros[0].slice(0, 200)}` : `a espera média mostrada é ${r.ultimo}`);
      checar('Nenhum selo "Dados de exemplo" no painel', (await pg.locator('[data-testid="selo-exemplo"]').count()) === 0, "ainda há seções marcadas como dados de exemplo");
    } finally {
      await b.close();
      await s.parar();
    }
  }
  const ok = checagens.filter((c) => c.ok).length;
  return { passou: ok === checagens.length, resumo: `${ok}/${checagens.length} checagens do contrato e do fim dos mocks`, checagens };
}

export const ETAPAS = {
  1: { titulo: "Indicadores ligados à API", rodar: etapa1 },
  2: { titulo: "Gráficos com filtros", rodar: etapa2 },
  3: { titulo: "Prédio ao vivo (SSE)", rodar: etapa3 },
  4: { titulo: "Contrato tipado e fim dos mocks", rodar: etapa4 },
};
