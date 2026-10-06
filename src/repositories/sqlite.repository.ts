import type { DatabaseSync } from "node:sqlite";
import type { Chamada, NovaChamada } from "../domain/chamada.ts";
import { ErroHttp } from "../http/erros.ts";
import type { ChamadasRepository, FiltroChamadas, Metricas, Pagina } from "./chamadas.repository.ts";

type Linha = Record<string, unknown>;

/** Converte uma linha da tabela "chamadas" no objeto Chamada. */
const paraChamada = (l: Linha): Chamada => ({
  id: Number(l.id),
  andar: Number(l.andar),
  destino: Number(l.destino),
  status: l.status as Chamada["status"],
  elevador: (l.elevador as string | null) ?? null,
  criada_em: Number(l.criada_em),
  embarque_em: l.embarque_em === null ? null : Number(l.embarque_em),
  chegada_em: l.chegada_em === null ? null : Number(l.chegada_em),
});

/**
 * Repositório SQLite — Etapas 3 e 4. Os dados sobrevivem ao reinício do
 * servidor. criar() e buscar() já estão prontos como exemplo de SQL com
 * parâmetros (?): nunca monte SQL concatenando valores do usuário.
 */
export class SqliteChamadasRepository implements ChamadasRepository {
  constructor(private readonly db: DatabaseSync) {}

  criar(nova: NovaChamada): Chamada {
    const r = this.db.prepare("INSERT INTO chamadas (andar, destino, criada_em) VALUES (?, ?, ?)").run(nova.andar, nova.destino, nova.criada_em);
    return this.buscar(Number(r.lastInsertRowid))!;
  }

  buscar(id: number): Chamada | null {
    const l = this.db.prepare("SELECT * FROM chamadas WHERE id = ?").get(id) as Linha | undefined;
    return l ? paraChamada(l) : null;
  }

  listar(filtro: FiltroChamadas): Pagina<Chamada> {
    // TODO Etapa 3: SELECT com WHERE status = ? (só se houver filtro), ORDER BY id,
    // LIMIT ? OFFSET ? — e um SELECT COUNT(*) para o total.
    void filtro;
    throw new ErroHttp(501, "TODO Etapa 3: implemente listar() no SqliteChamadasRepository");
  }

  atualizar(id: number, mudancas: Partial<Pick<Chamada, "status" | "elevador" | "embarque_em" | "chegada_em">>): Chamada {
    // TODO Etapa 3: UPDATE chamadas SET ... WHERE id = ? com os campos de mudancas; depois devolva buscar(id).
    void id;
    void mudancas;
    throw new ErroHttp(501, "TODO Etapa 3: implemente atualizar() no SqliteChamadasRepository");
  }

  metricas(): Metricas {
    // TODO Etapa 4: calcule em SQL (COUNT, AVG, GROUP BY andar). Veja docs/openapi.yaml (GET /metricas).
    // Espera de uma chamada = embarque_em − criada_em (só de quem embarcou). Arredonde as médias com 1 casa.
    // p95: ordene as esperas e pegue a da posição ⌈0,95 × n⌉ (LIMIT 1 OFFSET ⌈0,95 × n⌉ − 1).
    throw new ErroHttp(501, "TODO Etapa 4: implemente metricas() no SqliteChamadasRepository");
  }
}
