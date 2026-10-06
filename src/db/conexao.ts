import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const PASTA_MIGRACOES = join(dirname(fileURLToPath(import.meta.url)), "migracoes");

/**
 * Abre o banco SQLite (o módulo node:sqlite já vem no Node 22+) e aplica as
 * migrações de src/db/migracoes em ordem. ":memory:" cria um banco só na
 * memória (útil nos testes).
 */
export function abrirBanco(arquivo: string): DatabaseSync {
  if (arquivo !== ":memory:") mkdirSync(dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  for (const nome of readdirSync(PASTA_MIGRACOES).filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(PASTA_MIGRACOES, nome), "utf8"));
  }
  return db;
}
