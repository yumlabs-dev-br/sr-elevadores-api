import { criarApp } from "./app.ts";
import { MemoriaChamadasRepository } from "./repositories/memoria.repository.ts";
// Etapa 3: troque a memória pelo SQLite (os dados passam a sobreviver ao reinício):
//   import { abrirBanco } from "./db/conexao.ts";
//   import { SqliteChamadasRepository } from "./repositories/sqlite.repository.ts";
//   const repo = new SqliteChamadasRepository(abrirBanco(arquivo));

const porta = Number(process.env.PORT ?? 3000);
const arquivo = process.env.DB_ARQUIVO ?? "dados/elevadores.db";

const repo = new MemoriaChamadasRepository();
const app = criarApp(repo);

app.listen(porta, () => {
  console.log(`Serviço de despacho no ar: http://localhost:${porta} (dados: ${repo.constructor.name}${repo instanceof MemoriaChamadasRepository ? "" : `, ${arquivo}`})`);
});
