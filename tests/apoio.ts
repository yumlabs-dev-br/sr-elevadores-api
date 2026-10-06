import { criarApp } from "../src/app.ts";
import { MemoriaChamadasRepository } from "../src/repositories/memoria.repository.ts";
// Etapa 4: para testar as métricas, use o SQLite em memória:
//   import { abrirBanco } from "../src/db/conexao.ts";
//   import { SqliteChamadasRepository } from "../src/repositories/sqlite.repository.ts";
//   export const appDeTeste = () => criarApp(new SqliteChamadasRepository(abrirBanco(":memory:")));

/** Um app novo, com dados só na memória, para cada teste. */
export const appDeTeste = () => criarApp(new MemoriaChamadasRepository());
