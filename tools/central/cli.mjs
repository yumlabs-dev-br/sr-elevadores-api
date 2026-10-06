#!/usr/bin/env node
// Central do prédio — as mesmas checagens que a plataforma roda ao validar.
//
//   node tools/central/cli.mjs despacho 2          (na pasta do seu repositório)
//   node cli.mjs despacho 2 --pasta ../repo --json resultado.json   (validador)
//
// Sai com código 0 se a etapa passou e 1 se não passou.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ETAPAS as DESPACHO } from "./etapas/despacho.mjs";

const SITUACOES = { despacho: { titulo: "Serviço de despacho", etapas: DESPACHO } };
const PAINEL = await import("./etapas/painel.mjs").catch(() => null);
if (PAINEL) SITUACOES.painel = { titulo: "Painel de operação", etapas: PAINEL.ETAPAS };

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const pasta = resolve(opcao("--pasta") ?? ".");
const json = opcao("--json");
const [qual, numero] = args;
const situacao = SITUACOES[qual];
const etapa = situacao?.etapas[numero];

const tty = process.stdout.isTTY;
const cor = (c, t) => (tty ? `\x1b[${c}m${t}\x1b[0m` : t);

if (!etapa) {
  console.log(`Uso: node tools/central/cli.mjs <${Object.keys(SITUACOES).join("|")}> <etapa>\n`);
  for (const [k, s] of Object.entries(SITUACOES)) for (const [n, e] of Object.entries(s.etapas)) console.log(`  ${k} ${n}  ${s.titulo} — ${e.titulo}`);
  process.exit(2);
}

console.log(cor("1", `\n${situacao.titulo} — Etapa ${numero}: ${etapa.titulo}`));
console.log(cor("2", `pasta: ${pasta}\n`));
let resultado;
try {
  resultado = await etapa.rodar({ pasta });
} catch (e) {
  resultado = { passou: false, resumo: "não foi possível rodar a etapa", checagens: [{ nome: "Subir o servidor", ok: false, detalhe: e instanceof Error ? e.message : String(e) }] };
}
for (const c of resultado.checagens) {
  console.log(`${c.ok ? cor("32", "✓") : cor("31", "✗")} ${c.nome}`);
  if (!c.ok && c.detalhe) console.log(cor("31", c.detalhe.split("\n").map((l) => `    ${l}`).join("\n")));
}
console.log(`\n${resultado.passou ? cor("32;1", "PASSOU") : cor("31;1", "NÃO PASSOU")} — ${resultado.resumo}\n`);
if (json) writeFileSync(json, JSON.stringify({ situacao: qual, etapa: Number(numero), ...resultado }));
process.exit(resultado.passou ? 0 : 1);
