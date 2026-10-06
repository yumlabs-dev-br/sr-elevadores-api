// Simulação do prédio (10 andares, 5 s por passo) — a mesma das Situações
// reais da plataforma, com ganchos para cada evento: quem chamou o elevador,
// quem embarcou, quem desembarcou. Cada etapa transforma esses eventos em
// requisições HTTP para a API do aluno.
//
// Sem dependências: roda no Node 22+ (validador e computador do aluno).

export const ANDARES = 10;
export const PASSO_S = 5;
export const PASSOS = 180;
export const CAPACIDADE = 8;
export const PACIENCIA = 60;

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rotuloPasso = (k) => {
  const s = k * PASSO_S;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** O próximo pedido no sentido (subindo: o menor ≥ andar; descendo: o maior ≤ andar); −1 se não houver. */
export function proximoNoSentido(andar, sentido, pedidos) {
  let melhor = -1;
  for (const p of pedidos) {
    if (sentido === "sobe" && p >= andar && (melhor === -1 || p < melhor)) melhor = p;
    if (sentido === "desce" && p <= andar && (melhor === -1 || p > melhor)) melhor = p;
  }
  return melhor;
}

/** Despacho de referência (algoritmo do elevador, sem disputar chamadas): o do painel de operação. */
export function despachoPadrao() {
  const sentidos = {};
  return (estado) => {
    const alvos = [];
    const destinos = {};
    for (const e of estado.elevadores) {
      const livres = estado.chamadas.map((c) => c.andar).filter((a) => !alvos.includes(a));
      const pedidos = [...e.destinos, ...(e.lotacao < e.capacidade ? livres : [])];
      let sentido = sentidos[e.id] ?? "sobe";
      let alvo = proximoNoSentido(e.andar, sentido, pedidos);
      if (alvo === -1) {
        sentido = sentido === "sobe" ? "desce" : "sobe";
        alvo = proximoNoSentido(e.andar, sentido, pedidos);
      }
      sentidos[e.id] = sentido;
      destinos[e.id] = alvo;
      if (alvo !== -1) alvos.push(alvo);
    }
    return { destinos };
  };
}

/** Movimentos do prédio: { elevadores, chegada (pessoas por passo), doTerreo, paraTerreo }. */
export const MOVIMENTO = {
  tranquilo: { elevadores: 1, chegada: 0.12, doTerreo: 0.3, paraTerreo: 0.3 },
  almoco: { elevadores: 1, chegada: 0.3, doTerreo: 0.3, paraTerreo: 0.3 },
  pico: { elevadores: 2, chegada: 0.6, doTerreo: 0.4, paraTerreo: 0.3 },
};

/** Quem chega, onde e para onde (os mesmos para a mesma semente). */
export function cenario(m, semente) {
  const rng = mulberry32(semente ^ 0xe1e7);
  const pessoas = [];
  for (let k = 0; k < PASSOS - 12; k++) {
    let n = 0;
    let acumulado = m.chegada;
    while (acumulado > 0) {
      if (rng() < Math.min(1, acumulado)) n++;
      acumulado -= 1;
    }
    for (let i = 0; i < n; i++) {
      const sorteio = rng();
      let origem;
      let destino;
      const andar = () => 1 + Math.floor(rng() * (ANDARES - 1));
      if (sorteio < m.doTerreo) [origem, destino] = [0, andar()];
      else if (sorteio < m.doTerreo + m.paraTerreo) [origem, destino] = [andar(), 0];
      else {
        origem = andar();
        destino = andar();
        while (destino === origem) destino = andar();
      }
      pessoas.push({ id: pessoas.length + 1, origem, destino, chegou: k, embarcou: null, desembarcou: null, elevador: null });
    }
  }
  return pessoas;
}

/**
 * Roda 15 minutos do prédio. A cada passo:
 *   1. quem chegou → aoChegar(pessoa, segundos)
 *   2. decidir(estado) → { destinos: { A: andar } }  (−1 ou null = parado)
 *   3. os elevadores andam; ao abrir a porta: aoDesembarcar / aoEmbarcar
 *   4. aoPasso(quadro, cabines, esperando) — fim do passo
 * Qualquer exceção nos ganchos interrompe e vira o erro da rodada.
 * Custo = segundos esperando + segundos dentro; espera acima de 1 min conta triplo.
 */
export async function simular(m, semente, { decidir, aoChegar = async () => {}, aoEmbarcar = async () => {}, aoDesembarcar = async () => {}, aoPasso = async () => {} }) {
  const todas = cenario(m, semente);
  const cabines = Array.from({ length: m.elevadores }, (_, i) => ({ id: "AB"[i], andar: 0, destino: null, porta: false, dentro: [] }));
  const esperando = [];
  let proxima = 0;
  let atendidas = 0;
  let espera = 0;
  let viagem = 0;
  let irritacao = 0;
  const quadros = [];
  const partes = () => ({ "Espera no andar (s)": espera, "Dentro do elevador (s)": viagem, "Irritação (espera > 1 min)": irritacao });
  const fim = (erro) => ({ quadros, custo: espera + viagem + irritacao, partes: partes(), pessoas: todas, erro });
  try {
    for (let k = 0; k < PASSOS; k++) {
      const segundos = k * PASSO_S;
      while (proxima < todas.length && todas[proxima].chegou === k) {
        const p = todas[proxima++];
        esperando.push(p);
        await aoChegar(p, segundos);
      }
      const estado = {
        segundos,
        andares: ANDARES,
        elevadores: cabines.map((c) => ({ id: c.id, andar: c.andar, destinos: [...new Set(c.dentro.map((p) => p.destino))].sort((a, b) => a - b), lotacao: c.dentro.length, capacidade: CAPACIDADE })),
        chamadas: [...new Set(esperando.map((p) => p.origem))].sort((a, b) => a - b).map((andar) => {
          const ali = esperando.filter((p) => p.origem === andar);
          return { andar, pessoas: ali.length, espera_max: Math.max(...ali.map((p) => (k - p.chegou) * PASSO_S)) };
        }),
      };
      const r = await decidir(estado, rotuloPasso(k));
      const dest = r && typeof r === "object" && !Array.isArray(r) ? r.destinos : undefined;
      if (!dest || typeof dest !== "object" || Array.isArray(dest)) return fim(`${rotuloPasso(k)}: a decisão deve ser {"destinos": {"A": andar}}; veio ${JSON.stringify(r) ?? "nada"}.`);
      for (const [id, v] of Object.entries(dest)) {
        const c = cabines.find((x) => x.id === id);
        if (!c) return fim(`${rotuloPasso(k)}: o elevador ${JSON.stringify(id)} não existe (use ${cabines.map((x) => `"${x.id}"`).join(" ou ")}).`);
        if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < -1 || v >= ANDARES)) return fim(`${rotuloPasso(k)}: o destino do elevador ${id} deve ser um andar de 0 a ${ANDARES - 1} (ou −1 para ficar parado); veio ${JSON.stringify(v)}.`);
        c.destino = v === null || v === -1 ? null : v;
      }
      for (const c of cabines) {
        c.porta = false;
        if (c.destino === null) continue;
        if (c.andar !== c.destino) {
          c.andar += c.destino > c.andar ? 1 : -1;
          continue;
        }
        // Chegou: abre a porta, desce quem ia para cá, entra quem esperava aqui.
        c.porta = true;
        const ficam = [];
        for (const p of c.dentro) {
          if (p.destino === c.andar) {
            p.desembarcou = k;
            atendidas++;
            await aoDesembarcar(p, segundos);
          } else ficam.push(p);
        }
        c.dentro = ficam;
        for (const p of esperando.filter((x) => x.origem === c.andar)) {
          if (c.dentro.length >= CAPACIDADE) break;
          p.embarcou = k;
          p.elevador = c.id;
          c.dentro.push(p);
          esperando.splice(esperando.indexOf(p), 1);
          await aoEmbarcar(p, c, segundos);
        }
      }
      for (const p of esperando) {
        espera += PASSO_S;
        if ((k - p.chegou) * PASSO_S >= PACIENCIA) irritacao += 2 * PASSO_S;
      }
      for (const c of cabines) viagem += PASSO_S * c.dentro.length;
      quadros.push({
        t: k,
        rotulo: rotuloPasso(k),
        cabines: cabines.map((c) => ({ id: c.id, andar: c.andar, destino: c.destino, porta: c.porta, dentro: c.dentro.map((p) => p.destino) })),
        esperando: esperando.map((p) => ({ andar: p.origem, destino: p.destino, espera: (k - p.chegou) * PASSO_S })),
        atendidas,
        espera,
        viagem,
        irritacao,
      });
      await aoPasso(quadros[quadros.length - 1], cabines, esperando);
    }
  } catch (e) {
    return fim(e instanceof Error ? e.message : String(e));
  }
  return fim(undefined);
}
